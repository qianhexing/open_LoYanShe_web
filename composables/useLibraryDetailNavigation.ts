import { useConfigStore } from '@/stores/config'

const SITE_ORIGIN = 'https://lolitalibrary.com'

function normalizeWebPath(path: string): string {
  if (path.includes('://')) return path
  return path.startsWith('/') ? path : `/${path}`
}

function buildQueryString(
  params: Record<string, string | number | null | undefined>
): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') qs.set(key, String(value))
  }
  const serialized = qs.toString()
  return serialized ? `?${serialized}` : ''
}

/** UniApp 内嵌 WebView（与项目内其它跳转一致） */
export function isHtml5PlusWebview(): boolean {
  return (
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Html5Plus')
  )
}

/**
 * 打开图鉴详情：浏览器新标签；Html5Plus 走原生页；鸿蒙等走 port 桥接。
 * 行为与 `components/library/LibraryItem.vue` 的 `handleJump` 对齐。
 */
export function openLibraryDetailTab(
  libraryId: number | string | null | undefined
): void {
  if (libraryId == null || libraryId === '') return
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/library/libraryDetail/libraryDetail?id=${idNum}`,
      fail: () => {
        const abs = new URL(
          `/library/detail/${idNum}`,
          window.location.origin
        ).href
        uniApi.navigateTo?.({
          url: `/pages/common/outerLink?url=${encodeURIComponent(abs)}`
        })
      }
    })
    return
  }

  const port = configStore.getPort()
  if (port) {
    try {
      port.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'LibraryDetail',
          params: { id: idNum }
        })
      )
    } catch {
      window.open(
        new URL(`/library/detail/${idNum}`, window.location.origin).href,
        '_blank',
        'noopener,noreferrer'
      )
    }
    return
  }

  window.open(
    new URL(`/library/detail/${idNum}`, window.location.origin).href,
    '_blank',
    'noopener,noreferrer'
  )
}

/**
 * 打开站内 H5 路径：UniApp outerLink2 / 鸿蒙 Outlink / 浏览器新标签。
 * 与 wardrobe/detail、CommunityDetailForeignSection 等移动端跳转一致。
 */
export function openLibraryWebPath(webPath: string): void {
  if (!webPath || !import.meta.client || typeof window === 'undefined') return

  const path = normalizeWebPath(webPath)
  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs
  const mobileUrl = path.includes('://') ? path : `${SITE_ORIGIN}${path}`
  const desktopUrl = path.includes('://')
    ? path
    : new URL(path, window.location.origin).href

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/common/outerLink2?url=${mobileUrl}`,
      fail: () => {
        console.warn('[libraryNav] uni outerLink2 失败', mobileUrl)
      }
    })
    return
  }

  const port = configStore.getPort()
  if (port) {
    try {
      port.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: { url: mobileUrl }
        })
      )
    } catch {
      window.open(desktopUrl, '_blank', 'noopener,noreferrer')
    }
    return
  }

  window.open(desktopUrl, '_blank', 'noopener,noreferrer')
}

/**
 * 打开衣柜详情：UniApp 原生页 / 鸿蒙 Outlink / 浏览器新标签。
 * 与 `components/Wardrobe/WardrobeItem.vue` 跳转行为对齐。
 */
export function openWardrobeDetail(options: {
  userId: number | string
  wardrobeId: number | string
  password?: string
}): void {
  const { userId, wardrobeId, password } = options
  if (userId == null || userId === '' || wardrobeId == null || wardrobeId === '') return
  if (!import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/wardrobe/wardrobe?user_id=${userId}&wardrobe_id=${wardrobeId}`,
      fail: () => {
        console.warn('[libraryNav] uni wardrobe 跳转失败', userId, wardrobeId)
      }
    })
    return
  }

  const webPath = `/wardrobe/detail/${userId}${buildQueryString({
    wardrobe_id: wardrobeId,
    password
  })}`
  openLibraryWebPath(webPath)
}

/**
 * 打开成就相册详情：UniApp outerLink2 / 鸿蒙 Outlink / 浏览器新标签。
 */
export function openAlbumDetail(options: {
  albumId: number | string
  userId?: number | string | null
}): void {
  const { albumId, userId } = options
  if (albumId == null || albumId === '') return
  const webPath = `/album/detail/${albumId}${buildQueryString({ user_id: userId ?? undefined })}`
  openLibraryWebPath(webPath)
}

/** 用于 `<a href>` 的绝对地址（仅客户端能带 origin；SSR 回落为路径） */
export function libraryDetailPageHref(
  libraryId: number | string | null | undefined
): string {
  if (libraryId == null || libraryId === '') return '#'
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return '#'
  if (import.meta.client && typeof window !== 'undefined') {
    try {
      return new URL(`/library/detail/${idNum}`, window.location.origin).href
    } catch {
      return `/library/detail/${idNum}`
    }
  }
  return `/library/detail/${idNum}`
}
