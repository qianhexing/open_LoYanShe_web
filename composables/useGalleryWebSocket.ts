import type { WebSocketMessage } from '@/composables/useWebSocket'
import type { Comment } from '@/types/api'
import type { GalleryPresenceUser } from '@/types/gallery'
import { formatRich } from '@/utils/public'

const MAX_TICKER_ITEMS = 4
/** 无新讯息时 ticker 展示时长 */
const TICKER_VISIBLE_MS = 5000
/** 位置上报节流（协议建议 50~100ms） */
const POSITION_THROTTLE_MS = 80

export interface GalleryCommentTickerItem {
  commentId: number
  userName: string
  contentPlain: string
}

export interface GalleryPositionPayload {
  x: number
  y?: number
  z?: number
  rotation?: number
  extra?: Record<string, unknown>
}

/** 去除 HTML 标签，合并空白为纯文本 */
export function stripGalleryCommentHtml(html?: string): string {
  if (!html) return ''
  const { text } = formatRich(html)
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function commentToTickerItem(comment: Comment): GalleryCommentTickerItem | null {
  const commentId = Number(comment.comment_id)
  if (!Number.isFinite(commentId) || commentId <= 0) return null

  const userName = comment.user?.user_name?.trim() || '旅人'
  const contentPlain = stripGalleryCommentHtml(comment.comment_content)
  if (!contentPlain) return null

  return { commentId, userName, contentPlain }
}

export function formatGalleryTickerText(item: GalleryCommentTickerItem): string {
  return `${item.userName}在某处留下了讯息 ${item.contentPlain}`
}

function getGalleryWebSocketUrl(galleryId: string | number): string {
  const id = encodeURIComponent(String(galleryId))
  if (process.client) {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `ws://localhost:3003/gallery/${id}`
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${hostname}/wss/gallery/${id}`
  }
  return `ws://localhost:3003/gallery/${id}`
}

function toFinite(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/** 服务端 rotation 多为角度；本地场景用弧度 */
function rotationToRadians(value: unknown): number {
  const raw = toFinite(value, 0)
  // 绝对值很大时视为已经是弧度的少见情况：按角度处理更贴合协议示例（90）
  return (raw * Math.PI) / 180
}

function presenceKey(raw: Record<string, unknown>): string | null {
  const connectionId = raw.connectionId ?? raw.connection_id
  if (connectionId != null && String(connectionId)) return String(connectionId)
  const userId = raw.userId ?? raw.user_id
  if (userId != null && String(userId)) return `user_${userId}`
  return null
}

function parsePresenceUser(raw: unknown): GalleryPresenceUser | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const key = presenceKey(data)
  if (!key) return null

  const userId = toFinite(data.userId ?? data.user_id, 0)
  const x = toFinite(data.x, 0)
  const y = toFinite(data.y, 0)
  // z 可选：缺省时用 0（水平面 Z）
  const z = data.z !== undefined && data.z !== null ? toFinite(data.z, 0) : 0
  const rotation = rotationToRadians(data.rotation)

  const user =
    data.user && typeof data.user === 'object'
      ? (data.user as Record<string, unknown>)
      : null

  const userName =
    (typeof data.userName === 'string' && data.userName)
    || (typeof data.user_name === 'string' && data.user_name)
    || (typeof user?.user_name === 'string' && user.user_name)
    || undefined

  const userFace =
    (typeof data.userFace === 'string' && data.userFace)
    || (typeof data.user_face === 'string' && data.user_face)
    || (typeof user?.user_face === 'string' && user.user_face)
    || undefined

  return {
    connectionId: key,
    userId,
    userName: userName || undefined,
    userFace: userFace || undefined,
    x,
    y,
    z,
    rotation
  }
}

function parsePresenceList(raw: unknown): GalleryPresenceUser[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(parsePresenceUser)
    .filter((item): item is GalleryPresenceUser => item != null)
}

/**
 * 展馆 WebSocket：评论广播 + 多用户位置同步。
 */
export function useGalleryWebSocket(options: {
  galleryId: MaybeRefOrGetter<string | number>
  token: MaybeRefOrGetter<string | null | undefined>
  /** 本地位置；连接后按节流自动上报 */
  position?: MaybeRefOrGetter<GalleryPositionPayload | null | undefined>
  onComment?: (comment: Comment) => void
}) {
  const tickerItems = ref<GalleryCommentTickerItem[]>([])
  /** connectionId → 其他用户 */
  const remoteUsers = ref<GalleryPresenceUser[]>([])
  const remoteMap = new Map<string, GalleryPresenceUser>()

  const { connect, disconnect, isConnected, send } = useWebSocket()

  let lastPositionSentAt = 0
  let positionTimer: ReturnType<typeof setTimeout> | null = null
  let tickerClearTimer: ReturnType<typeof setTimeout> | null = null

  const clearTickerTimer = () => {
    if (!tickerClearTimer) return
    clearTimeout(tickerClearTimer)
    tickerClearTimer = null
  }

  const scheduleTickerClear = () => {
    clearTickerTimer()
    tickerClearTimer = setTimeout(() => {
      tickerClearTimer = null
      tickerItems.value = []
    }, TICKER_VISIBLE_MS)
  }

  const syncRemoteList = () => {
    remoteUsers.value = Array.from(remoteMap.values())
  }

  const upsertRemote = (user: GalleryPresenceUser) => {
    const prev = remoteMap.get(user.connectionId)
    remoteMap.set(user.connectionId, prev
      ? {
          ...prev,
          ...user,
          userName: user.userName || prev.userName,
          userFace: user.userFace || prev.userFace
        }
      : user)
    syncRemoteList()
  }

  const removeRemote = (raw: Record<string, unknown>) => {
    const key = presenceKey(raw)
    if (key && remoteMap.delete(key)) {
      syncRemoteList()
      return
    }
    const userId = toFinite(raw.userId ?? raw.user_id, NaN)
    if (!Number.isFinite(userId)) return
    let changed = false
    for (const [k, u] of remoteMap) {
      if (u.userId === userId) {
        remoteMap.delete(k)
        changed = true
      }
    }
    if (changed) syncRemoteList()
  }

  const clearRemotes = () => {
    if (remoteMap.size === 0) return
    remoteMap.clear()
    syncRemoteList()
  }

  const pushTicker = (comment: Comment) => {
    const item = commentToTickerItem(comment)
    if (!item) return
    if (tickerItems.value.some(row => row.commentId === item.commentId)) return
    tickerItems.value = [item, ...tickerItems.value].slice(0, MAX_TICKER_ITEMS)
    scheduleTickerClear()
  }

  const sendPosition = (pos: GalleryPositionPayload) => {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y ?? 0)) return false
    return send({
      type: 'position',
      x: pos.x,
      y: pos.y ?? 0,
      ...(pos.z !== undefined ? { z: pos.z } : {}),
      ...(pos.rotation !== undefined ? { rotation: pos.rotation } : {}),
      ...(pos.extra ? { extra: pos.extra } : {})
    })
  }

  const flushPosition = () => {
    if (!options.position) return
    const pos = toValue(options.position)
    if (!pos || !isConnected.value) return
    const now = Date.now()
    const wait = POSITION_THROTTLE_MS - (now - lastPositionSentAt)
    if (wait > 0) {
      if (positionTimer) return
      positionTimer = setTimeout(() => {
        positionTimer = null
        flushPosition()
      }, wait)
      return
    }
    lastPositionSentAt = now
    sendPosition(pos)
  }

  const connectGallery = () => {
    const rawId = toValue(options.galleryId)
    const token = toValue(options.token)?.trim()
    const id = typeof rawId === 'number' ? rawId : Number(rawId)

    if (positionTimer) {
      clearTimeout(positionTimer)
      positionTimer = null
    }
    disconnect()
    clearRemotes()
    clearTickerTimer()
    tickerItems.value = []

    if (!token || !Number.isFinite(id) || id <= 0) return

    connect({
      url: getGalleryWebSocketUrl(id),
      token,
      autoReconnect: true,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      onConnected: (data: WebSocketMessage) => {
        if (import.meta.dev) {
          console.info('[gallery-ws] 连接成功', data.galleryId ?? id)
        }
        const list = parsePresenceList(data.presence)
        remoteMap.clear()
        for (const user of list) remoteMap.set(user.connectionId, user)
        syncRemoteList()
        // 入场后立刻上报一次当前位置
        lastPositionSentAt = 0
        flushPosition()
      },
      onMessage: (message: WebSocketMessage) => {
        if (message.type === 'gallery_comment' && message.data) {
          const comment = message.data as Comment
          pushTicker(comment)
          options.onComment?.(comment)
          return
        }

        if (message.type === 'user_join') {
          const user = parsePresenceUser(message.data ?? message)
          if (user) upsertRemote(user)
          return
        }

        if (message.type === 'user_position') {
          const user = parsePresenceUser(message.data ?? message)
          if (user) upsertRemote(user)
          return
        }

        if (message.type === 'user_leave') {
          const raw = (message.data && typeof message.data === 'object'
            ? message.data
            : message) as Record<string, unknown>
          removeRemote(raw)
        }
      },
      onError: (error) => {
        console.error('[gallery-ws] 连接错误', error)
      },
      onClose: (event) => {
        if (import.meta.dev) {
          console.info('[gallery-ws] 连接关闭', event.code, event.reason)
        }
        clearRemotes()
      }
    })
  }

  watch(
    [() => toValue(options.galleryId), () => toValue(options.token)],
    () => {
      if (process.client) connectGallery()
    },
    { immediate: true }
  )

  if (options.position) {
    watch(
      () => toValue(options.position),
      () => {
        if (process.client) flushPosition()
      },
      { deep: true }
    )
  }

  onBeforeUnmount(() => {
    if (positionTimer) {
      clearTimeout(positionTimer)
      positionTimer = null
    }
    clearTickerTimer()
    disconnect()
    clearRemotes()
  })

  return {
    tickerItems: readonly(tickerItems),
    remoteUsers: readonly(remoteUsers),
    isConnected,
    sendPosition
  }
}
