/**
 * 模块说明：
 * 此模块主要用于统一管理 HTTP 请求，借助封装的请求方法，让组件可以更便捷地发起请求。
 * 提供了自定义的 HTTP 请求方法，例如 `use$Get`，同时给出了一个获取动态内容的请求示例 `GetFeeds`。
 */
import { $fetch } from 'ofetch'
import { addQhxToast } from '@/utils/qhxToast'
import { BASE_URL } from '@/utils/ipConfig'
import { LOGIN_PATH, redirectToLoginPage } from '@/utils/loginRedirect'

const baseURL = BASE_URL

interface RequestOptions {
  [key: string]: any
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

type SilentError = Error & { silent?: boolean; __qhxToasted?: boolean }

type HttpErrorPayload = {
  status?: number
  statusCode?: number
  data?: unknown
  silent?: boolean
  message?: string
  msg?: string
  code?: number
  __qhxToasted?: boolean
}

function isSilentHttpError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'silent' in error &&
      (error as { silent?: boolean }).silent
  )
}

function unwrapPayload(error: unknown): Record<string, unknown> | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as HttpErrorPayload & { response?: { _data?: unknown } }
  const raw = e.data ?? e.response?._data ?? error
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return undefined
}

function httpErrorMessageOf(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim()
  const payload = unwrapPayload(error)
  const fromPayload = payload?.message ?? payload?.msg
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload.trim()

  if (error && typeof error === 'object') {
    const e = error as HttpErrorPayload
    const fromSelf = e.message || e.msg
    if (
      typeof fromSelf === 'string' &&
      fromSelf.trim() &&
      !/^\[(GET|POST|PUT|DELETE|PATCH)\]/i.test(fromSelf)
    ) {
      return fromSelf.trim()
    }
    const status = e.status ?? e.statusCode
    if (typeof status === 'number' && status > 0) return `请求失败（${status}）`
  }

  return '操作失败，请重试'
}

function notifyHttpError(error: unknown) {
  if (typeof document === 'undefined') return
  if (isSilentHttpError(error)) return
  if (error && typeof error === 'object' && (error as HttpErrorPayload).__qhxToasted) {
    return
  }
  const description = httpErrorMessageOf(error)
  const show = () => {
    addQhxToast({
      title: '错误',
      description,
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  }
  // 等当前 throw / Nuxt 错误处理走完再插入，避免被同步异常打断
  setTimeout(show, 0)
  if (error && typeof error === 'object') {
    ;(error as HttpErrorPayload).__qhxToasted = true
  }
}

function throwSilent(message: string): never {
  const error = new Error(message) as SilentError
  error.silent = true
  throw error
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  const current = pathname + search
  const redirectTo =
    pathname === LOGIN_PATH || pathname.startsWith('/register')
      ? undefined
      : current
  void redirectToLoginPage(redirectTo)
}

function isUnauthorized(httpStatus?: number, payload?: unknown): boolean {
  if (httpStatus === 401) return true
  if (payload && typeof payload === 'object' && (payload as { code?: number }).code === 401) {
    return true
  }
  return false
}

function unauthorizedStatus(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const payload = error as HttpErrorPayload
  const body = unwrapPayload(error)
  return isUnauthorized(
    payload.status ?? payload.statusCode,
    body ?? payload
  )
}

function payloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const p = payload as { message?: string; msg?: string }
    if (p.message) return String(p.message)
    if (p.msg) return String(p.msg)
  }
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  return fallback
}

function handleRequest(options: RequestOptions) {
  let token = null as null | string
  if (typeof window !== 'undefined' && useUserStore) {
    const userStore = storeToRefs(useUserStore())
    token = userStore.token.value
  }
  options.headers = {
    ...options.headers,
    Authorization: `${token}`,
  }
}

function createDollarFetchRequest(method: HttpMethod) {
  return async <T = any>(
    url: string,
    data?: Record<string, any> | FormData,
    options: RequestOptions = {},
  ): Promise<T> => {
    const fullPath = `${options.baseURL || baseURL}${url}`
    const body = method === 'GET' ? { params: data } : { body: data }

    try {
      handleRequest(options)
      const res = await $fetch.raw(fullPath, {
        method,
        ...body,
        ...options,
        // 必须放在 options 后面：4xx/5xx 也拿到 body，由我们自己提示
        ignoreResponseError: true,
      })
      const payload = res._data as T
      const httpStatus = res.status
      const bizCode =
        payload && typeof payload === 'object'
          ? (payload as { code?: number }).code
          : undefined

      if (isUnauthorized(httpStatus, payload)) {
        redirectToLogin()
        throwSilent(
          payloadMessage(payload, '登录已失效，请重新登录')
        )
      }

      const httpFailed = httpStatus < 200 || httpStatus >= 300
      const bizFailed = bizCode !== undefined && bizCode !== 200
      if (httpFailed || bizFailed) {
        const message = payloadMessage(
          payload,
          httpFailed ? `请求失败（${httpStatus}）` : '操作失败，请重试'
        )
        const error = new Error(message) as SilentError & HttpErrorPayload
        error.data = payload
        error.status = httpStatus
        error.statusCode = httpStatus
        notifyHttpError(error)
        throw error
      }

      return payload
    } catch (error) {
      console.error('请求错误:', error)
      if (isSilentHttpError(error)) throw error
      if (error && typeof error === 'object' && (error as HttpErrorPayload).__qhxToasted) {
        throw error
      }
      if (unauthorizedStatus(error)) {
        redirectToLogin()
        throwSilent(httpErrorMessageOf(error) || '登录已失效，请重新登录')
      }
      notifyHttpError(error)
      throw error
    }
  }
}

/**
 * 使用自定义的 GET 请求方法。
 */
export const use$Get = createDollarFetchRequest('GET')

/**
 * 使用自定义的 POST 请求方法。
 */
export const use$Post = createDollarFetchRequest('POST')

/**
 * 使用自定义的 PUT 请求方法。
 */
export const use$Put = createDollarFetchRequest('PUT')

/**
 * 使用自定义的 DELETE 请求方法。
 */
export const use$Delete = createDollarFetchRequest('DELETE')
