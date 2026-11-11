/**
 * 原生壳跳转桥：
 * - Uni（Html5Plus）：uni.navigateTo outerLink2 / navigateBack + postMessage
 * - 鸿蒙：MessagePort → { type: 'jump'|'back'|'BackAndReload'|'reloadHome'|... }
 * - iOS / Android：webkit.messageHandlers.LoYanSheBridge（不依赖 MessagePort）
 *
 * reloadHome：通知原生主页按「发帖重置 / 删帖保页」重拉 feed（与 BackAndReload 不同，后者只刷外链 H5）
 */
import { useConfigStore } from '@/stores/config'

export const SITE_ORIGIN = 'https://lolitalibrary.com'
export const IOS_SHELL_KEY = 'ios_webview'
export const HARMONY_SHELL_KEY = 'harmony_webview'
export const ANDROID_SHELL_KEY = 'android_webview'
/** 与 iOS / Android `OutlinkBridge.handlerName` 一致 */
export const IOS_BRIDGE_HANDLER = 'LoYanSheBridge'
/** @alias IOS_BRIDGE_HANDLER — Android 同名 */
export const ANDROID_BRIDGE_HANDLER = IOS_BRIDGE_HANDLER

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

type IosMessageHandler = {
  postMessage: (body: string) => void
}

type LoNativeWindow = Window & {
  webkit?: { messageHandlers?: Record<string, IosMessageHandler | undefined> }
  LoYanSheBridge?: { postMessage?: (body: string) => void }
  __loOnNativeMessage?: (payload: string) => void
  __loSendToH5?: (payload: string) => void
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

/** 是否存在 iOS WK 桥（不依赖 MessagePort） */
export function hasIosNativeBridge(): boolean {
  if (!import.meta.client || typeof window === 'undefined') return false
  try {
    const handler = (window as LoNativeWindow).webkit?.messageHandlers?.[IOS_BRIDGE_HANDLER]
    return typeof handler?.postMessage === 'function'
  } catch {
    return false
  }
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
    if (sessionStorage.getItem(IOS_SHELL_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return hasIosNativeBridge()
}

/** 是否存在 Android LoYanSheBridge（JavascriptInterface / webkit shim） */
export function hasAndroidNativeBridge(): boolean {
  if (!import.meta.client || typeof window === 'undefined') return false
  try {
    const win = window as LoNativeWindow
    const handler = win.webkit?.messageHandlers?.[ANDROID_BRIDGE_HANDLER]
    if (typeof handler?.postMessage === 'function') return true
    if (typeof win.LoYanSheBridge?.postMessage === 'function') return true
  } catch {
    /* ignore */
  }
  return false
}

export function isAndroidWebview(): boolean {
  if (!import.meta.client || typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('client')
    if (String(q || '').toLowerCase() === 'android') return true
  } catch {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(ANDROID_SHELL_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return hasAndroidNativeBridge()
}

/**
 * iOS / Android Outlink 原生自带返回按钮时，H5 需留出同宽占位（如工具栏 `pl-11`），
 * 或隐藏自绘返回外观、保留布局槽位，避免与原生返回重叠。
 */
export function needsNativeBackSlot(): boolean {
  return isIosWebview() || isAndroidWebview()
}

export function isHarmonyWebview(): boolean {
  if (!import.meta.client) return false
  if (isIosWebview() || isAndroidWebview()) return false
  try {
    if (sessionStorage.getItem(HARMONY_SHELL_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  return !!useConfigStore().getPort()
}

/** Uni / iOS / Android / 鸿蒙 任一原生壳 */
export function isNativeShell(): boolean {
  if (isHtml5PlusWebview()) return true
  if (isIosWebview()) return true
  if (isAndroidWebview()) return true
  if (!import.meta.client) return false
  if (useConfigStore().getPort()) return true
  try {
    return (
      sessionStorage.getItem(HARMONY_SHELL_KEY) === '1' ||
      sessionStorage.getItem(ANDROID_SHELL_KEY) === '1'
    )
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

export function markAndroidShell(): void {
  if (!import.meta.client || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(ANDROID_SHELL_KEY, '1')
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

/** 对外暴露当前鸿蒙 MessagePort（iOS / Android 不使用） */
export function getNativePort(): MessagePort | null {
  if (isIosWebview() || isAndroidWebview()) return null
  return getPort()
}

function resolveUni(override?: UniNavigate | null): UniNavigate | null {
  if (override) return override
  const uniApi = useConfigStore().uniWebviewJs as UniNavigate | null
  return uniApi
}

/**
 * iOS WK / Android JavascriptInterface 同名桥：
 * `webkit.messageHandlers.LoYanSheBridge` 或 `window.LoYanSheBridge.postMessage`
 */
export function postIosBridge(message: NativeBridgeMessage): boolean {
  if (!import.meta.client || typeof window === 'undefined') return false
  const win = window as LoNativeWindow
  const payload = JSON.stringify(message)
  try {
    const handler = win.webkit?.messageHandlers?.[IOS_BRIDGE_HANDLER]
    if (typeof handler?.postMessage === 'function') {
      handler.postMessage(payload)
      return true
    }
    if (typeof win.LoYanSheBridge?.postMessage === 'function') {
      win.LoYanSheBridge.postMessage(payload)
      return true
    }
  } catch {
    return false
  }
  return false
}

/** @alias postIosBridge — Android 同通道 */
export const postAndroidBridge = postIosBridge

/** 向壳发桥接消息：iOS / Android 走 LoYanSheBridge；鸿蒙走 MessagePort */
export function postNativeBridge(message: NativeBridgeMessage): boolean {
  if (isIosWebview() || isAndroidWebview()) {
    return postIosBridge(message)
  }
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

export type NativeReloadHomeParams = {
  /** true：发帖后重置主页列表；false：删帖后保页重拉 */
  reset: boolean
  /** 发帖成功时带上新帖 id，便于原生定位/高亮 */
  community_id?: number
}

/**
 * 通知原生主页重拉 feed。
 * 发帖：`{ type: 'reloadHome', params: { reset: true, community_id } }`
 * 删帖：`{ type: 'reloadHome', params: { reset: false } }`
 * iOS / Android 走 LoYanSheBridge；鸿蒙走 MessagePort。
 */
export function nativeReloadHome(params: NativeReloadHomeParams): boolean {
  const payload: Record<string, unknown> = { reset: Boolean(params.reset) }
  if (
    params.community_id != null &&
    Number.isFinite(Number(params.community_id))
  ) {
    payload.community_id = Number(params.community_id)
  }
  return postNativeBridge({ type: 'reloadHome', params: payload })
}

/** 通知原生打开登录页（鸿蒙 / iOS） */
export function nativeLogin(returnUrl?: string): boolean {
  return postNativeBridge({
    type: 'login',
    params: returnUrl ? { url: returnUrl } : undefined,
  })
}

/** 同步尝试 Outlink jump */
export function nativeOpenOutlink(url: string): boolean {
  return nativeJump('Outlink', { url: toAbsoluteSiteUrl(url) })
}

function waitForHarmonyPort(timeoutMs = 800): Promise<MessagePort | null> {
  // iOS / Android 不走 MessagePort
  if (isIosWebview() || isAndroidWebview()) return Promise.resolve(null)
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

function postJumpWhenHarmonyPortReady(
  path: string,
  params: Record<string, unknown>,
  timeoutMs = 800,
): Promise<boolean> {
  return waitForHarmonyPort(timeoutMs).then((port) => {
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
 * 解析并分发原生 → H5 下行消息（setTheme / setLang / reload 等）
 */
export function handleNativeInboundPayload(
  raw: unknown,
  handlers: {
    onSetTheme?: (data: unknown) => void
    /** 壳内切换语言：data 为 zh/en/ja 或 { lang } */
    onSetLang?: (data: unknown) => void
    onReload?: () => void
    onMessage?: (msg: NativeBridgeMessage) => void
  } = {},
): void {
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const message = JSON.parse(text) as NativeBridgeMessage
    handlers.onMessage?.(message)
    if (message.type === 'setTheme') {
      handlers.onSetTheme?.(message.data)
      return
    }
    if (message.type === 'setLang' || message.type === 'setLocale') {
      handlers.onSetLang?.(message.data ?? message.params)
      return
    }
    if (message.type === 'reload') {
      handlers.onReload?.()
    }
  } catch {
    /* ignore */
  }
}

/**
 * 安装 iOS / Android 下行回调。原生通过 `window.__loSendToH5(str)` 或 `__loOnNativeMessage`。
 * 同时挂一层 port shim，兼容业务里仍写 `port.postMessage` 的旧代码（实际转发到 LoYanSheBridge）。
 * 下行统一派发 `loyanshe-native` CustomEvent（nativePicker 等按 requestId 订阅）。
 */
export function installWkStyleNativeBridge(
  shell: 'ios' | 'android',
  options: { onInbound?: (raw: string) => void } = {},
): void {
  if (!import.meta.client || typeof window === 'undefined') return
  if (shell === 'ios') markIosShell()
  else markAndroidShell()

  const win = window as LoNativeWindow
  win.__loOnNativeMessage = (payload: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent('loyanshe-native', { detail: payload }),
      )
    } catch {
      /* ignore */
    }
    options.onInbound?.(payload)
  }

  const shim = {
    postMessage(data: unknown) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      const handler = win.webkit?.messageHandlers?.[IOS_BRIDGE_HANDLER]
      if (typeof handler?.postMessage === 'function') {
        handler.postMessage(payload)
        return
      }
      if (typeof win.LoYanSheBridge?.postMessage === 'function') {
        win.LoYanSheBridge.postMessage(payload)
      }
    },
    start() {},
    close() {},
    onmessage: null as ((ev: MessageEvent) => void) | null,
  }
  // 不覆盖已有鸿蒙真 port；iOS / Android 写入 shim 供旧调用点使用
  if (!getPort() || isIosWebview() || isAndroidWebview()) {
    useConfigStore().setPort(shim as unknown as MessagePort)
  }
}

/** @alias installWkStyleNativeBridge('ios') */
export function installIosNativeBridge(options: {
  onInbound?: (raw: string) => void
} = {}): void {
  installWkStyleNativeBridge('ios', options)
}

/** Android：与 iOS 同通道，不建 MessagePort */
export function installAndroidNativeBridge(options: {
  onInbound?: (raw: string) => void
} = {}): void {
  installWkStyleNativeBridge('android', options)
}

/**
 * 在壳内打开 H5：
 * Uni → outerLink2；iOS → WK jump Outlink；鸿蒙 → MessagePort Outlink；浏览器 → 新标签。
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

  // iOS / Android：LoYanSheBridge 应已就绪，失败则同 WebView 内跳（勿 window.open）
  if (isIosWebview() || isAndroidWebview()) {
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
    return
  }

  // 鸿蒙：MessagePort 可能尚未建连，短等后再发（勿 window.open）
  if (isHarmonyWebview() || isNativeShell()) {
    void postJumpWhenHarmonyPortReady('Outlink', { url: absolute }).then((ok) => {
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
 */
export function nativeNamedJump(
  path: string,
  params: Record<string, unknown>,
  fallbackH5Path: string,
): void {
  if (!import.meta.client) return

  if (nativeJump(path, params)) return

  if (isIosWebview() || isAndroidWebview()) {
    openInNativeShell(fallbackH5Path)
    return
  }

  if (isHarmonyWebview() || isNativeShell()) {
    void postJumpWhenHarmonyPortReady(path, params).then((ok) => {
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
 * Uni：postMessage + navigateBack；iOS：WK；鸿蒙：MessagePort。
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

  if (isIosWebview() || isAndroidWebview()) {
    // 桥未挂上时退回 history
    window.history.back()
    return true
  }

  if (isHarmonyWebview() || isNativeShell()) {
    void waitForHarmonyPort(500).then((port) => {
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
