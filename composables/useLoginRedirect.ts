import {
  HOME_PATH,
  LOGIN_PATH,
  REGISTER_PATH,
  buildLoginTo as buildLoginToPath,
  sanitizeLoginRedirect,
} from '@/utils/loginRedirect'

export { sanitizeLoginRedirect, buildLoginTo } from '@/utils/loginRedirect'

export function useLoginRedirect() {
  const route = useRoute()

  function getRedirectFromQuery(): string | null {
    const raw = route.query.redirect
    const value = Array.isArray(raw) ? raw[0] : raw
    return sanitizeLoginRedirect(typeof value === 'string' ? value : undefined)
  }

  function buildLoginTo(redirectTo?: string) {
    const fromQuery = getRedirectFromQuery()
    const fromCurrent =
      route.path !== LOGIN_PATH && route.path !== REGISTER_PATH
        ? sanitizeLoginRedirect(route.fullPath)
        : null
    return buildLoginToPath(
      sanitizeLoginRedirect(redirectTo) ?? fromQuery ?? fromCurrent ?? undefined,
    )
  }

  function buildRegisterTo() {
    const redirect = getRedirectFromQuery()
    if (redirect) {
      return { path: REGISTER_PATH, query: { redirect } }
    }
    return REGISTER_PATH
  }

  async function navigateToLogin(redirectTo?: string) {
    await navigateTo(buildLoginTo(redirectTo))
  }

  async function navigateAfterLogin() {
    const target = getRedirectFromQuery() ?? HOME_PATH
    await navigateTo(target)
  }

  return {
    getRedirectFromQuery,
    buildLoginTo,
    buildRegisterTo,
    navigateToLogin,
    navigateAfterLogin,
  }
}
