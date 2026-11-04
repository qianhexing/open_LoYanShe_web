/**
 * 原生壳跳转桥：对齐 UniApp / 鸿蒙 Outlink / iOS Outlink。
 * - Uni（Html5Plus）：uni.navigateTo outerLink2 / navigateBack + postMessage
 * - 鸿蒙 / iOS：MessagePort → { type: 'jump'|'back'|'BackAndReload'|... }
 */
import { useConfigStore } from '@/stores/config'

export const SITE_ORIGIN = 'https://lolitalibrary.com'
export const IOS_SHELL_KEY = 'ios_webview'
export const HARMONY_SHELL_KEY = 'harmony_webview'

export type NativeBridgeMessage = {
  type: string
  path?: string
  params?: Record<string, unknown>
  data?: unknown
}

type UniNavigate = {
  navigateTo?: (opts: { url: string; fail?: (err?: unknown) => void }) => void
  navigateBack?: () => void
  postMessage?: (payload: { data: NativeBridgeMessage }) => void
}

export type OpenInNativeShellOptions = {
  fullScreen?: boolean
  /** 覆盖 store 内注入的 uni-webview-js */
  uni?: UniNavigate | null
  /** 浏览器内站内跳转（非壳）；传入则优先于 window.open */
  inAppNavigate?: (path: string) => void
}

export function isHtml5PlusWebview(): boolean {
  return (
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Html5Plus')
  )
}

export function isIosWebview(): boolean {
  if (!import.meta.client || typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('client')
    if (String(q || '').toLowerCase() === 'ios') return true
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(IOS_SHELL_KEY) === '1'
  } catch {
    return false
  }
}

export function isHarmonyWebview(): boolean {
  if (!import.meta.client) return false
  try {
    if (sessionStorage.getItem(HARMONY_SHELL_KEY) === '1') {
      // iOS 与鸿蒙共用 port；有 ios 标记时不算「仅鸿蒙」
      if (isIosWebview()) return false
      return true
    }
  } catch {
    /* ignore */
  }
  const port = useConfigStore().getPort()
  if (port && !isIosWebview()) return true
  return false
}

/** Uni / 鸿蒙 / iOS 任一原生壳 */
export function isNativeShell(): boolean {
  if (isHtml5PlusWebview()) return true
  if (isIosWebview()) return true
  if (!import.meta.client) return false
  if (useConfigStore().getPort()) return true
  try {
    return sessionStorage.getItem(HARMONY_SHELL_KEY) === '1'
  } catch {
    return false
  }
}

/** @alias isNativeShell — layout / 导航 composable 使用 */
export const isNativeAppShell = isNativeShell

export function markIosShell(): void {
  if (!import.meta.client || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(IOS_SHELL_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function markHarmonyShell(): void {
  if (!import.meta.client || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(HARMONY_SHELL_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function toAbsoluteSiteUrl(pathOrUrl: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return SITE_ORIGIN
  if (/^https?:\/\//i.test(raw)) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${SITE_ORIGIN}${path}`
}

function getPort(): MessagePort | null {
  if (!import.meta.client) return null
  return useConfigStore().getPort()
}

/** 对外暴露当前 MessagePort（鸿蒙 / iOS） */
export function getNativePort(): MessagePort | null {
  return getPort()
}

function resolveUni(override?: UniNavigate | null): UniNavigate | null {
  if (override) return override
  const uniApi = useConfigStore().uniWebviewJs as UniNavigate | null
  return uniApi
}

/** 向鸿蒙 / iOS MessagePort 发桥接消息 */
export function postNativeBridge(message: NativeBridgeMessage): boolean {
  const port = getPort()
  if (!port) return false
  try {
    port.postMessage(JSON.stringify(message))
    return true
  } catch {
    return false
  }
}

export function nativeJump(
  path: string,
  params?: Record<string, unknown>,
): boolean {
  return postNativeBridge({ type: 'jump', path, params })
}

export function nativeBack(params?: Record<string, unknown>): boolean {
  return postNativeBridge({ type: 'back', params })
}

export function nativeBackAndReload(): boolean {
  return postNativeBridge({ type: 'BackAndReload' })
}

/** 通知原生打开登录页（鸿蒙 / iOS） */
export function nativeLogin(returnUrl?: string): boolean {
  return postNativeBridge({
    type: 'login',
    params: returnUrl ? { url: returnUrl } : undefined,
  })
}

/** 同步尝试 Outlink jump（port 已就绪时） */
export function nativeOpenOutlink(url: string): boolean {
  return nativeJump('Outlink', { url: toAbsoluteSiteUrl(url) })
}

function waitForPort(timeoutMs = 800): Promise<MessagePort | null> {
  const existing = getPort()
  if (existing) return Promise.resolve(existing)
  if (!import.meta.client || typeof window === 'undefined') {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const start = Date.now()
    const timer = window.setInterval(() => {
      const port = getPort()
      if (port || Date.now() - start >= timeoutMs) {
        window.clearInterval(timer)
        resolve(port)
      }
    }, 50)
  })
}

function postJumpWhenPortReady(
  path: string,
  params: Record<string, unknown>,
  timeoutMs = 800,
): Promise<boolean> {
  return waitForPort(timeoutMs).then((port) => {
    if (!port) return false
    try {
      port.postMessage(JSON.stringify({ type: 'jump', path, params }))
      return true
    } catch {
      return false
    }
  })
}

/**
 * 在壳内打开 H5：
 * Uni → outerLink2；鸿蒙/iOS → jump Outlink；浏览器 → 新标签 / inAppNavigate。
 */
export function openInNativeShell(
  pathOrUrl: string,
  options: OpenInNativeShellOptions = {},
): void {
  if (!import.meta.client || typeof window === 'undefined') return
  const absolute = toAbsoluteSiteUrl(pathOrUrl)

  if (isHtml5PlusWebview()) {
    const uniApi = resolveUni(options.uni)
    if (typeof uniApi?.navigateTo === 'function') {
      const qs = options.fullScreen ? 'fullScreen=true&' : ''
      uniApi.navigateTo({
        url: `/pages/common/outerLink2?${qs}url=${absolute}`,
        fail: () => {
          console.warn('[nativeShell] uni outerLink2 失败', absolute)
        },
      })
      return
    }
  }

  if (nativeOpenOutlink(absolute)) return

  // iOS / 鸿蒙：port 可能尚未建连，短等后再发；仍失败则同 WebView 内跳转（勿 window.open）
  if (isIosWebview() || isHarmonyWebview() || isNativeShell()) {
    void postJumpWhenPortReady('Outlink', { url: absolute }).then((ok) => {
      if (ok) return
      if (options.inAppNavigate) {
        try {
          const u = new URL(absolute)
          options.inAppNavigate(u.pathname + u.search + u.hash)
          return
        } catch {
          /* fall through */
        }
      }
      window.location.href = absolute
    })
    return
  }

  if (options.inAppNavigate) {
    try {
      const u = new URL(absolute)
      options.inAppNavigate(u.pathname + u.search + u.hash)
      return
    } catch {
      /* fall through */
    }
  }

  window.open(absolute, '_blank', 'noopener,noreferrer')
}

/** @alias openInNativeShell */
export const openShellH5 = openInNativeShell

/**
 * 命名页 jump：LibraryDetail / CommunityDetail / UserSpace 等。
 * Uni 不走此路径（由调用方 outerLink）；鸿蒙/iOS 对齐同一 MessagePort。
 */
export function nativeNamedJump(
  path: string,
  params: Record<string, unknown>,
  fallbackH5Path: string,
): void {
  if (!import.meta.client) return

  if (nativeJump(path, params)) return

  if (isIosWebview() || isHarmonyWebview() || isNativeShell()) {
    void postJumpWhenPortReady(path, params).then((ok) => {
      if (!ok) openInNativeShell(fallbackH5Path)
    })
    return
  }

  openInNativeShell(fallbackH5Path)
}

/**
 * 打开社区详情：Uni outerLink2 / 鸿蒙·iOS CommunityDetail / 浏览器。
 */
export function openCommunityDetailInShell(communityId: number): void {
  if (!Number.isFinite(communityId)) return

  if (isHtml5PlusWebview()) {
    openInNativeShell(`/community/detail/${communityId}`)
    return
  }

  nativeNamedJump(
    'CommunityDetail',
    { id: communityId },
    `/community/detail/${communityId}`,
  )
}

/**
 * 打开用户空间：Uni 原生页 / 鸿蒙·iOS UserSpace / 浏览器。
 */
export function openUserSpaceInShell(userId: number): void {
  if (!Number.isFinite(userId)) return

  if (isHtml5PlusWebview()) {
    const uniApi = resolveUni()
    if (typeof uniApi?.navigateTo === 'function') {
      uniApi.navigateTo({
        url: `/pages/userSpace/userSpace?id=${userId}`,
        fail: () => {
          openInNativeShell(`/userSpace/${userId}`)
        },
      })
      return
    }
    openInNativeShell(`/userSpace/${userId}`)
    return
  }

  nativeNamedJump('UserSpace', { id: userId }, `/userSpace/${userId}`)
}

/**
 * 打开图鉴详情：Uni outerLink H5；鸿蒙·iOS LibraryDetail；浏览器。
 */
export function openLibraryDetailInShell(libraryId: number): void {
  if (!Number.isFinite(libraryId)) return

  if (isHtml5PlusWebview()) {
    openInNativeShell(`/library/detail/${libraryId}`)
    return
  }

  nativeNamedJump(
    'LibraryDetail',
    { id: libraryId },
    `/library/detail/${libraryId}`,
  )
}

/**
 * 返回上一页；可选通知壳刷新。
 * Uni：postMessage + navigateBack；鸿蒙/iOS：back / BackAndReload。
 */
export function navigateBackInShell(options: { reload?: boolean } = {}): boolean {
  if (!import.meta.client) return false
  const reload = Boolean(options.reload)

  if (isHtml5PlusWebview()) {
    const uniApi = resolveUni()
    const uniGlobal =
      (typeof window !== 'undefined'
        ? (window as unknown as { uni?: UniNavigate }).uni
        : undefined) || uniApi

    if (reload && typeof uniGlobal?.postMessage === 'function') {
      try {
        uniGlobal.postMessage({ data: { type: 'BackAndReload' } })
      } catch {
        /* ignore */
      }
    }
    if (typeof uniGlobal?.navigateBack === 'function') {
      uniGlobal.navigateBack()
      return true
    }
    try {
      // @ts-expect-error uni-webview 可能挂在全局
      if (typeof uni !== 'undefined' && typeof uni.navigateBack === 'function') {
        if (reload && typeof uni.postMessage === 'function') {
          uni.postMessage({ data: { type: 'BackAndReload' } })
        }
        uni.navigateBack()
        return true
      }
    } catch {
      /* ignore */
    }
  }

  if (reload) {
    if (nativeBackAndReload()) return true
  } else if (nativeBack()) {
    return true
  }

  if (isIosWebview() || isHarmonyWebview() || isNativeShell()) {
    void waitForPort(500).then((port) => {
      if (!port) {
        window.history.back()
        return
      }
      try {
        port.postMessage(
          JSON.stringify(
            reload ? { type: 'BackAndReload' } : { type: 'back' },
          ),
        )
      } catch {
        window.history.back()
      }
    })
    return true
  }

  return false
}
