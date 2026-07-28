import { useConfigStore } from '@/stores/config'
import type { AblumForeign } from '@/types/api'
import {
  buildHumanPlatformNav,
  type BuildHumanPlatformNavOptions,
} from '@/utils/humanPlatformNav'

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
 * 打开图鉴详情：UniApp 直接打开 H5 地址；鸿蒙等走 port 桥接；浏览器新标签。
 */
export function openLibraryDetailTab(
  libraryId: number | string | null | undefined
): void {
  if (libraryId == null || libraryId === '') return
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return

  // UniApp：不再进原生图鉴页，直接外链打开 H5 详情
  if (isHtml5PlusWebview()) {
    openLibraryWebPath(`/library/detail/${idNum}`)
    return
  }

  const configStore = useConfigStore()
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
 * 打开帖子详情：UniApp outerLink2 / 鸿蒙 CommunityDetail / 浏览器新标签。
 * 与 `pages/journal/[id].vue`、`CommunityItem` 跳转行为对齐。
 */
export function openCommunityDetailTab(
  communityId: number | string | null | undefined
): void {
  if (communityId == null || communityId === '') return
  const idNum = Number(communityId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs
  const fullUrl = `${SITE_ORIGIN}/community/detail/${idNum}`

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/common/outerLink2?url=${fullUrl}`,
      fail: () => {
        console.warn('[libraryNav] uni community 跳转失败', fullUrl)
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
          path: 'CommunityDetail',
          params: { id: idNum }
        })
      )
    } catch {
      openLibraryWebPath(`/community/detail/${idNum}`)
    }
    return
  }

  openLibraryWebPath(`/community/detail/${idNum}`)
}

/**
 * 打开用户空间：UniApp 原生页 / 鸿蒙 UserSpace / 浏览器新标签。
 * 与 `UserRankingList`、`DanmakuComment` 跳转行为对齐。
 */
export function openUserSpaceTab(
  userId: number | string | null | undefined
): void {
  if (userId == null || userId === '') return
  const idNum = Number(userId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/userSpace/userSpace?id=${idNum}`,
      fail: () => {
        uniApi.navigateTo?.({
          url: `/pages/common/outerLink2?url=${SITE_ORIGIN}/userSpace/${idNum}`
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
          path: 'UserSpace',
          params: { id: idNum }
        })
      )
    } catch {
      openLibraryWebPath(`/userSpace/${idNum}`)
    }
    return
  }

  openLibraryWebPath(`/userSpace/${idNum}`)
}

/** 打开服饰详情：UniApp outerLink2 / 鸿蒙 Outlink / 浏览器新标签。 */
export function openClothesDetailTab(
  clothesId: number | string | null | undefined
): void {
  if (clothesId == null || clothesId === '') return
  const idNum = Number(clothesId)
  if (!Number.isFinite(idNum)) return
  openLibraryWebPath(`/clothes/detail/${idNum}`)
}

/** 打开搭配详情：UniApp outerLink2 / 鸿蒙 Outlink / 浏览器新标签。 */
export function openMatchingDetailTab(
  matchingId: number | string | null | undefined
): void {
  if (matchingId == null || matchingId === '') return
  const idNum = Number(matchingId)
  if (!Number.isFinite(idNum)) return
  openLibraryWebPath(`/matching/detail/${idNum}`)
}

/** 相册打卡关联内容是否可跳转 */
export function canJumpAlbumForeignRelated(
  pkType: number | null | undefined,
  foreign: AblumForeign | null | undefined
): boolean {
  if (!foreign || pkType == null) return false
  switch (pkType) {
    case 1:
      return !!foreign.community?.community_id
    case 2:
      return !!foreign.wardrobe_clothes?.clothes_id
    case 3:
      return !!foreign.matching_list?.matching_id
    case 4:
      return !!foreign.library?.library_id
    default:
      return false
  }
}

/** 打开相册打卡关联内容详情（按 pk_type 分发，兼容多运行环境） */
export function openAlbumForeignRelatedContent(
  pkType: number | null | undefined,
  foreign: AblumForeign | null | undefined
): boolean {
  if (!canJumpAlbumForeignRelated(pkType, foreign) || !foreign) return false

  switch (pkType) {
    case 1: {
      const communityId = foreign.community?.community_id
      if (communityId) openCommunityDetailTab(communityId)
      return !!communityId
    }
    case 2: {
      const clothesId = foreign.wardrobe_clothes?.clothes_id
      if (clothesId) openClothesDetailTab(clothesId)
      return !!clothesId
    }
    case 3: {
      const matchingId = foreign.matching_list?.matching_id
      if (matchingId) openMatchingDetailTab(matchingId)
      return !!matchingId
    }
    case 4: {
      const libraryId = foreign.library?.library_id
      if (libraryId) openLibraryDetailTab(libraryId)
      return !!libraryId
    }
    default:
      return false
  }
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

/**
 * 打开人台页：按 addr 是否 rad 分流。
 * - rad → 新版 `/humanPlatform/:id`
 * - 非 rad → 旧版 `/pc/humanPlatform/:id`
 * UniApp / 鸿蒙走外链；浏览器可站内跳转（inAppNavigate）或新标签。
 */
export function openHumanPlatform(
  options: BuildHumanPlatformNavOptions & {
    /** 仅新版：站内 navigateTo；默认 false（新标签，与列表入口一致） */
    inAppNavigate?: boolean
    /** UniApp outerLink2 是否全屏，默认 true */
    fullScreen?: boolean
  },
): void {
  if (options.videoId == null || options.videoId === '') return
  if (!import.meta.client || typeof window === 'undefined') return

  const { inAppNavigate = false, fullScreen = true, ...navOptions } = options
  const { path, isLegacy, fullUrl } = buildHumanPlatformNav(navOptions)
  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs
  const desktopUrl = isLegacy
    ? fullUrl
    : new URL(path, window.location.origin).href

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    const qs = fullScreen ? 'fullScreen=true&' : ''
    uniApi.navigateTo({
      url: `/pages/common/outerLink2?${qs}url=${fullUrl}`,
      fail: () => {
        console.warn('[libraryNav] uni humanPlatform 跳转失败', fullUrl)
      },
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
          params: { url: fullUrl },
        }),
      )
    } catch {
      window.open(desktopUrl, '_blank', 'noopener,noreferrer')
    }
    return
  }

  if (!isLegacy && inAppNavigate) {
    void navigateTo(path)
    return
  }

  window.open(desktopUrl, '_blank', 'noopener,noreferrer')
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
