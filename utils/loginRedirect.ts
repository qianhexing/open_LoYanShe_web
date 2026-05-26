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

/** 构建登录页路由（可在非 Vue 上下文中使用，如 HTTP 拦截器） */
export function buildLoginTo(redirectTo?: string) {
  const target = sanitizeLoginRedirect(redirectTo)
  if (target) {
    return { path: LOGIN_PATH, query: { redirect: target } }
  }
  return LOGIN_PATH
}

let redirectingToLogin = false

/** 401 等场景：清除态后跳转登录（带当前页 redirect，防并发重复跳转） */
export async function redirectToLoginPage(redirectTo?: string) {
  if (typeof window === 'undefined' || redirectingToLogin) return
  redirectingToLogin = true
  try {
    useUserStore().clearUserInfo()
    const loginTo = buildLoginTo(redirectTo)
    await navigateTo(loginTo, { replace: true })
  } catch {
    const loginTo = buildLoginTo(redirectTo)
    if (typeof loginTo === 'string') {
      window.location.replace(loginTo)
    } else {
      const q = new URLSearchParams(loginTo.query as Record<string, string>)
      window.location.replace(`${loginTo.path}?${q}`)
    }
  }
}
