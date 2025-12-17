
// 没改好
import type { BaseResponse, PaginationResponse, Wiki, WikiType, FilterList } from '@/types/api';
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

// 获取wiki详情
export interface WikiDetailParams {
  wiki_id?: number
  wiki_name?: string
  type_id?: number
}
export interface WikiDetail extends Wiki {
  wiki_describe?: string
  wiki_illustration?: string
  other_name?: string
  filter_library?: FilterList[]
}
export async function getWikiDetail (params: WikiDetailParams): Promise<WikiDetail> {
  const response = await use$Post<BaseResponse<WikiDetail>>('/wiki/detail', params);
  return response.data;
}

// 获取wiki段落列表
export interface WikiSection {
  section_id: number
  section_title: string
  section_content: string
  sort: number
}
export interface WikiSectionParams {
  wiki_id: number
}
export async function getWikiSectionListById (params: WikiSectionParams): Promise<WikiSection[]> {
  const response = await use$Post<BaseResponse<WikiSection[]>>('/wikiSection/list', params);
  return response.data;
}

// 合并wiki
export interface MergeWikiParams {
  wiki_id: number
  merge_id: string
}
export async function mergeWiki (params: MergeWikiParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wiki/merge', params);
  return response.data;
}

// 修改wiki段落排序
export interface ChangeWikiSectionSortParams {
  wiki_id: number
  sort: { section_id: number; sort: number }[]
}
export async function changeWikiSectionSort (params: ChangeWikiSectionSortParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wikiSection/sort', params);
  return response.data;
}

// 删除wiki
export interface DeleteWikiParams {
  wiki_id: number
}
export async function deleteWiki (params: DeleteWikiParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wiki/delete', params);
  return response.data;
}

// 关联wiki
export interface InsertWikiForeignIdsParams {
  ids: string
  pk_type: number
  pk_id?: number
  wiki_id?: number
}
export async function insertWikiForeignIds (params: InsertWikiForeignIdsParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wiki/foreign/insert/ids', params);
  return response.data;
}