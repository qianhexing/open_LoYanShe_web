/**
 * 模块说明：
 * 此模块主要用于统一管理 HTTP 请求，借助封装的请求方法，让组件可以更便捷地发起请求。
 * 提供了自定义的 HTTP 请求方法，例如 `use$Get`，同时给出了一个获取动态内容的请求示例 `GetFeeds`。
 */
import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#app'

interface RequestOptions {
  [key: string]: any;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// 请求拦截器
function handleRequest(options: RequestOptions) {
  // 这需要Pinia
  // const {UserInfo} = storeToRefs(useUserStore())
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json'
    // 这实现Authorization头自动携带
    // 'Authorization': `Bearer ${UserInfo.value.token}`,
  }
}

// 响应拦截器
function handleResponse(response: any) {
  // 这里可以根据业务需求处理响应
  if (response.error) {
    throw new Error(response.error.message || '响应错误')
  }
  return response
}

/**
 * 创建自定义的 $fetch 请求函数。
 * 此函数是一个高阶函数，接收一个 HTTP 方法作为参数，返回一个封装好的请求函数。
 * @param {string} method - HTTP 请求方法，如 'GET'、'POST'、'DELETE'、'PUT' 等。
 * @returns {Function} - 封装好的请求函数，接收 URL 和请求数据作为参数。
 */
function createDollarFetchRequest(method: HttpMethod) {
  return async function(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ) {

    const baseURL = useRuntimeConfig().public.baseUrl as string
    const fullPath = `${baseURL}${url}`

    // 这是不使用代理时 构建完整的请求 URL
    // const requestUrl = new URL(fullPath).toString()

    try {
      handleRequest(options)
      const response = await $fetch(fullPath, {
        method,
        body: data,
        ...options
      })
      return handleResponse(response)
    } catch (error) {
      console.error('请求错误:', error)
      throw error
    }
  }
}

// 提供 $fetch & HTTP 方法 - 统一管理请求 - 再到组件中使用
// export const GetFeeds = async function (offset: number, query: string) {

// }
/**
 * 使用自定义的 GET 请求方法。
 * 该函数是通过 `createDollarFetchRequest` 函数创建的，专门用于发起 GET 请求。
 * @param {string} url - 请求的地址。在baseUrl后拼接，baseUrl在`./nuxt.config.ts`]设置
 * @param {RequestOptions} options - 可选的请求选项[请看文档](https://nuxt.com/docs/api/composables/use-fetch)。
 * @returns {Promise<any>} - 响应数据的 Promise。
 */
export const use$Get = createDollarFetchRequest('GET')

/**
 * 使用自定义的 POST 请求方法。
 * 该函数是通过 `createDollarFetchRequest` 函数创建的，专门用于发起 POST 请求。
 * @param {string} url - 请求的地址。在baseUrl后拼接，baseUrl在`./nuxt.config.ts`]设置
 * @param {any} data - 可选的请求数据。例如：JSON.stringify({'offset': offset,'query': query})
 * @param {RequestOptions} options - 可选的请求选项[请看文档](https://nuxt.com/docs/api/composables/use-fetch)。
 * @returns {Promise<any>} - 响应数据的 Promise。
 */
export const use$Post = createDollarFetchRequest('POST')

/**
 * 使用自定义的 PUT 请求方法。
 * 该函数是通过 `createDollarFetchRequest` 函数创建的，专门用于发起 PUT 请求。
 * @param {string} url - 请求的地址。在baseUrl后拼接，baseUrl在`./nuxt.config.ts`]设置。
 * @param {any} data - 可选的请求数据。例如：JSON.stringify({'offset': offset,'query': query})
 * @param {RequestOptions} options - 可选的请求选项[请看文档](https://nuxt.com/docs/api/composables/use-fetch)。
 * @returns {Promise<any>} - 响应数据的 Promise。
 */
export const use$Put = createDollarFetchRequest('PUT')

/**
 * 使用自定义的 DELETE 请求方法。
 * 该函数是通过 `createDollarFetchRequest` 函数创建的，专门用于发起 DELETE 请求。
 * @param {string} url - 请求的地址。在baseUrl后拼接，baseUrl在`./nuxt.config.ts`]设置
 * @param {any} data - 可选的请求数据。例如：JSON.stringify({'offset': offset,'query': query})
 * @param {RequestOptions} options - 可选的请求选项[请看文档](https://nuxt.com/docs/api/composables/use-fetch)。
 * @returns {Promise<any>} - 响应数据的 Promise。
 */
export const use$Delete = createDollarFetchRequest('DELETE')
