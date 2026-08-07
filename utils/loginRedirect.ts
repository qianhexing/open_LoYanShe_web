export const LOGIN_PATH = '/login'
export const REGISTER_PATH = '/register'
export const HOME_PATH = '/'

const BLOCKED_REDIRECT_PREFIXES = [LOGIN_PATH, REGISTER_PATH]

/** 校验并规范化登录后的回跳路径（仅允许站内相对路径，避免 open redirect） */
export function sanitizeLoginRedirect(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  let decoded = path.trim()
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    return null
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
  const pathname = decoded.split('?')[0]?.split('#')[0] ?? decoded
  if (BLOCKED_REDIRECT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }
  return decoded
}

/** 去掉 url 上的 token 参数，避免过期 token 回灌 */
export function stripTokenFromUrl(url: string): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://lolitalibrary.com')
    u.searchParams.delete('token')
    return u.toString()
  } catch {
    return url
  }
}

/**
 * 登录成功后应回到的完整页面地址（鸿蒙 Outlink 用）
 * redirectTo 为站内相对路径时拼 origin；否则用当前页
 */
export function buildHarmonyReturnUrl(redirectTo?: string): string {
  if (typeof window === 'undefined') return ''
  const safe = sanitizeLoginRedirect(redirectTo)
  const href = safe
    ? `${window.location.origin}${safe}`
    : `${window.location.origin}${window.location.pathname}${window.location.search}`
  return stripTokenFromUrl(href)
}

/** 构建登录页路由（可在非 Vue 上下文中使用，如 HTTP 拦截器） */
export function buildLoginTo(redirectTo?: string) {
  const target = sanitizeLoginRedirect(redirectTo)
  if (target) {
    return { path: LOGIN_PATH, query: { redirect: target } }
  }
  return LOGIN_PATH
}

let redirectingToLogin = false

function releaseRedirectLock() {
  setTimeout(() => {
    redirectingToLogin = false
  }, 1500)
}

/**
 * 鸿蒙 WebView：通过 MessagePort 通知原生打开登录页，并携带登录后回跳地址
 * @returns 是否已交给原生处理
 */
export function notifyHarmonyNativeLogin(redirectTo?: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const port = useConfigStore().port
    if (!port) return false
    const returnUrl = buildHarmonyReturnUrl(redirectTo)
    port.postMessage(
      JSON.stringify({
        type: 'login',
        params: {
          url: returnUrl,
        },
      }),
    )
    return true
  } catch {
    return false
  }
}

/** 401 等场景：清除态后跳转登录（带当前页 redirect，防并发重复跳转） */
export async function redirectToLoginPage(redirectTo?: string) {
  if (typeof window === 'undefined' || redirectingToLogin) return
  redirectingToLogin = true
  try {
    useUserStore().clearUserInfo()
    // 鸿蒙外链 WebView：交给原生 Login，登录后按 url 回跳
    if (notifyHarmonyNativeLogin(redirectTo)) {
      return
    }
    const loginTo = buildLoginTo(redirectTo)
    await navigateTo(loginTo, { replace: true })
  } catch {
    if (notifyHarmonyNativeLogin(redirectTo)) {
      return
    }
    const loginTo = buildLoginTo(redirectTo)
    if (typeof loginTo === 'string') {
      window.location.replace(loginTo)
    } else {
      const q = new URLSearchParams(loginTo.query as Record<string, string>)
      window.location.replace(`${loginTo.path}?${q}`)
    }
  } finally {
    releaseRedirectLock()
  }
}
