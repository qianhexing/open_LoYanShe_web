import { getCommentList } from '@/api/comment'
import type { Comment, CommentJsonData } from '@/types/api'
import type { GalleryMessageMarker } from '@/types/gallery'

/** 展馆留言评论 type；随机 100 条接口就绪前先走 list */
export const GALLERY_COMMENT_TYPE = 'gallery'

/** 暂用 10 条；后续换成随机 100 条接口时只改此处 */
const GALLERY_MESSAGE_PAGE_SIZE = 10

/** 坐标保留一位小数 */
export function roundGalleryCoord(n: number): number {
  return Math.round(n * 10) / 10
}

/** 写入评论：json_data.position = [x, y, z] */
export function buildGalleryCommentJsonData(
  x: number,
  y: number,
  z: number
): CommentJsonData {
  return {
    position: [
      roundGalleryCoord(x),
      roundGalleryCoord(y),
      roundGalleryCoord(z)
    ]
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** 仅解析 json_data.position = [x, y, z] */
export function parseGalleryCommentPosition(
  jsonData?: CommentJsonData | Record<string, unknown> | string | null
): [number, number, number] | null {
  let data: Record<string, unknown> | null = null

  if (typeof jsonData === 'string') {
    try {
      const parsed = JSON.parse(jsonData.trim()) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  } else if (jsonData && typeof jsonData === 'object') {
    data = jsonData as Record<string, unknown>
  }

  if (!data || !Array.isArray(data.position) || data.position.length < 3) return null

  const x = toFiniteNumber(data.position[0])
  const y = toFiniteNumber(data.position[1])
  const z = toFiniteNumber(data.position[2])
  if (x == null || y == null || z == null) return null
  return [x, y, z]
}

export function commentToGalleryMessage(
  comment: Comment,
  fallbackPosition?: [number, number, number] | null
): GalleryMessageMarker | null {
  const position = parseGalleryCommentPosition(comment.json_data) ?? fallbackPosition ?? null
  if (!position) return null
  return {
    comment_id: comment.comment_id,
    content: comment.comment_content || '',
    mountImg: comment.mount_img || undefined,
    position,
    userName: comment.user?.user_name,
    userFace: comment.user?.user_face,
    date: comment.date
  }
}

/**
 * 展馆留言：拉取带坐标的评论并转为标点。
 * 写入走 CommunityCommentModal（insertComment + json_data.position）。
 */
export function useGalleryMessages(galleryId: MaybeRefOrGetter<string | number>) {
  const messages = ref<GalleryMessageMarker[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const resolveId = () => {
    const raw = toValue(galleryId)
    const id = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(id) && id > 0 ? id : 0
  }

  const fetchMessages = async (): Promise<GalleryMessageMarker[]> => {
    const id = resolveId()
    if (!id) {
      messages.value = []
      return []
    }

    loading.value = true
    error.value = null
    try {
      const response = await getCommentList({
        type: GALLERY_COMMENT_TYPE,
        id,
        page: 1,
        pageSize: GALLERY_MESSAGE_PAGE_SIZE
      })
      const rows = response?.rows ?? []
      const markers = rows
        .map(c => commentToGalleryMessage(c))
        .filter((item): item is GalleryMessageMarker => item != null)

      if (import.meta.dev && rows.length > 0 && markers.length === 0) {
        console.warn(
          '[gallery] 已拉取评论但无法解析坐标，需 json_data.position = [x, y, z]',
          rows.map(r => ({
            comment_id: r.comment_id,
            json_data: r.json_data
          }))
        )
      }

      messages.value = markers
      return markers
    } catch (e) {
      console.error('[gallery] 留言加载失败', e)
      error.value = e instanceof Error ? e.message : '留言加载失败'
      messages.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  const rememberMessage = (
    comment: Comment,
    fallbackPosition?: [number, number, number] | null
  ): GalleryMessageMarker | null => {
    const marker = commentToGalleryMessage(comment, fallbackPosition)
    if (!marker) return null
    messages.value = [
      marker,
      ...messages.value.filter(m => m.comment_id !== marker.comment_id)
    ]
    return marker
  }

  /** 从本地列表移除已删除留言 */
  const forgetMessages = (commentIds: number[]) => {
    if (!commentIds.length) return
    const idSet = new Set(commentIds)
    messages.value = messages.value.filter(m => !idSet.has(m.comment_id))
  }

  return {
    messages,
    loading,
    error,
    fetchMessages,
    rememberMessage,
    forgetMessages
  }
}
