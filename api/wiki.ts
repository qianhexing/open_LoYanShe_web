
// 没改好
import type { BaseResponse, PaginationResponse, Wiki, WikiType } from '@/types/api';
interface WikiSearchParams {
  type_id?: number
  wiki_name?: string
  parent_id?: number | null
  where?: Record<string, any>
  keywords?: string
  page?: number
  pageSize?: number
}

export async function getWikiOptions (params: WikiSearchParams): Promise<PaginationResponse<Wiki>> {
  const response = await use$Get<BaseResponse<PaginationResponse<Wiki>>>('/wiki/getOptions', params);
  return response.data;
}

export async function getWikiOptionsByKeywords (params: WikiSearchParams): Promise<Wiki[]>   {
  const response = await use$Get<BaseResponse<Wiki[]>>('/wiki/getOptions', params);
  return response.data;
}
// 获取wiki列表
export async function getWikiList (params: WikiSearchParams): Promise<PaginationResponse<Wiki>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Wiki>>>('/wiki/list', params);
  return response.data;
}
// 新增wiki片段
export async function insertWikiSection (data: Wiki): Promise<Wiki> {
  const response = await use$Post<BaseResponse<Wiki>>('/wikiSection/insert', data);
  return response.data;
}



// 获取wiki类型选项
export async function getWikiTypeOptions (params: WikiSearchParams): Promise<WikiType> {
  const response = await use$Post<BaseResponse<WikiType>>('/wikiType/getOptions', params);
  return response.data;
}
export interface WikiResponse {
  rows: Wiki[]
  count: number
  default_options: Wiki[]
}
// 获取wiki列表
export async function getWikiWikiList (params: WikiSearchParams): Promise<WikiResponse> {
  const response = await use$Post<BaseResponse<WikiResponse>>('/wiki/wiki/list', params);
  return response.data;
}
export interface SortParams {
  type_id: number
  sort: { wiki_id: number, sort: number }[]
}
export async function sortWikiList (params: SortParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wiki/sort', params);
  return response.data;
}
// // 新增wiki片段
// export async function insertWikiSection (data: Wiki): Promise<Wiki> {
//   return request({
//     url: 'wikiSection/insert',
//     method: 'post',
//     data
//   })
// }

// export function getWikiDetail (data) {
//   return request({
//     url: 'wiki/detail',
//     method: 'post',
//     data
//   })
// }


// export function getWikiSectionListById (data) {
//   return request({
//     url: 'wikiSection/list',
//     method: 'post',
//     data
//   })
// }

// export function mergeWiki (data) {
//   return request({
//     url: 'wiki/merge',
//     method: 'post',
//     data
//   })
// }

// export function insertWiki (data) {
//   return request({
//     url: 'wiki/insert',
//     method: 'post',
//     data
//   })
// }

// export function updataWiki (data) {
//   return request({
//     url: 'wiki/update',
//     method: 'post',
//     data
//   })
// }
// export function changeWikiSectionSort (data) {
//   return request({
//     url: 'wikiSection/sort',
//     method: 'post',
//     data
//   })
// }

export async function getWikiFilterOptions (data: WikiSearchParams): Promise<Wiki> {
  const response = await use$Post<BaseResponse<Wiki>>('/wiki/filter/options', data);
  return response.data;
}

// export function deleteWiki (data) {
//   return request({
//     url: 'wiki/delete',
//     method: 'post',
//     data
//   })
// }

// export function insertWikiForeignIds (data) {
//   return request({
//     url: 'wiki/foreign/insert/ids',
//     method: 'post',
//     data
//   })
// }
// export function deleteWikiForeign (data) {
//   return request({
//     url: 'wiki/foreign/delete',
//     method: 'post',
//     data
//   })
// }
// export function updateWikiForeign (data) {
//   return request({
//     url: 'wiki/foreign/update',
//     method: 'post',
//     data
//   })
// }