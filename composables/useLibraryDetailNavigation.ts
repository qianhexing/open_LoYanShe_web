import { useConfigStore } from '@/stores/config'
import type { AblumForeign } from '@/types/api'
import {
  buildHumanPlatformNav,
  type BuildHumanPlatformNavOptions,
} from '@/utils/humanPlatformNav'
import {
  isHtml5PlusWebview,
  isHarmonyWebview,
  isIosWebview,
  isNativeAppShell,
  nativeOpenOutlink,
  openCommunityDetailInShell,
  openInNativeShell,
  openLibraryDetailInShell,
  openUserSpaceInShell,
  SITE_ORIGIN,
} from '@/utils/nativeShell'

export {
  isHtml5PlusWebview,
  isIosWebview,
  isNativeAppShell,
} from '@/utils/nativeShell'

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

/**
 * 打开图鉴详情：UniApp 外链 H5；鸿蒙 / iOS port `LibraryDetail`；浏览器新标签。
 */
export function openLibraryDetailTab(
  libraryId: number | string | null | undefined
): void {
  if (libraryId == null || libraryId === '') return
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return
  openLibraryDetailInShell(idNum)
}

/**
 * 打开帖子详情：UniApp outerLink2 / 鸿蒙·iOS CommunityDetail / 浏览器新标签。
 */
export function openCommunityDetailTab(
  communityId: number | string | null | undefined
): void {
  if (communityId == null || communityId === '') return
  const idNum = Number(communityId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return
  openCommunityDetailInShell(idNum)
}

/**
 * 打开用户空间：UniApp 原生页 / 鸿蒙·iOS UserSpace / 浏览器新标签。
 */
export function openUserSpaceTab(
  userId: number | string | null | undefined
): void {
  if (userId == null || userId === '') return
  const idNum = Number(userId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return
  openUserSpaceInShell(idNum)
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
 * 打开站内 H5 路径：UniApp outerLink2 / 鸿蒙·iOS Outlink / 浏览器新标签。
 */
export function openLibraryWebPath(webPath: string): void {
  if (!webPath || !import.meta.client || typeof window === 'undefined') return

  const path = normalizeWebPath(webPath)
  openInNativeShell(path.includes('://') ? path : `${SITE_ORIGIN}${path}`)
}

/**
 * 打开衣柜详情：UniApp 原生页 / 鸿蒙 Outlink / 浏览器新标签。
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
 * UniApp / 鸿蒙·iOS 走外链；浏览器可站内跳转（inAppNavigate）或新标签。
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
  const desktopUrl = isLegacy
    ? fullUrl
    : new URL(path, window.location.origin).href

  if (isHtml5PlusWebview()) {
    openInNativeShell(fullUrl, { fullScreen })
    return
  }

  if (nativeOpenOutlink(fullUrl)) return

  if (isIosWebview() || isHarmonyWebview() || isNativeAppShell()) {
    openInNativeShell(fullUrl, {
      inAppNavigate: (p) => {
        void navigateTo(p)
      },
    })
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
