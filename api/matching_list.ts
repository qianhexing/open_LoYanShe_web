import type { BaseResponse, PaginationParams, PaginationResponse } from '@/types/api';

export interface MatchingListItem {
  matching_id: number
  cover?: string
  height: number
  width: number
  note?: string
  user_face: string
  user_name: string
  main_style?: string
  tags_list: Array<{ tags_id: number; tags_name: string }>
  clothes_list?: Array<{ clothes_img: string }>
  library_list?: Array<{ square_cover?: string; cover?: string }>
  create_time?: Date
  update_time?: Date
  user_id?: number
  [key: string]: unknown
}

export interface MatchingListDetail extends MatchingListItem {
  // 详情页可能包含更多字段
  [key: string]: unknown
}

// 插入搭配列表参数
export interface InsertMatchingListParams {
  cover?: string
  height?: number
  width?: number
  note?: string
  main_style?: string
  clothes_list?: Array<{ clothes_id?: number; clothes_img?: string }>
  library_list?: Array<{ library_id?: number; square_cover?: string; cover?: string }>
  [key: string]: unknown
}

// 更新搭配列表参数
export interface UpdateMatchingListParams {
  matching_id: number
  cover?: string
  height?: number
  width?: number
  note?: string
  main_style?: string
  clothes_list?: Array<{ clothes_id?: number; clothes_img?: string }>
  library_list?: Array<{ library_id?: number; square_cover?: string; cover?: string }>
  [key: string]: unknown
}

// 更新标签参数
export interface UpdateMatchingListTagsParams {
  matching_id: number
  tags_list?: Array<number | { tags_id: number }>
  [key: string]: unknown
}

// 列表查询参数
interface MatchingListParams extends PaginationParams {
  keyword?: string
  filter_list?: Record<string, unknown>
  [key: string]: unknown
}

// 详情查询参数
interface MatchingDetailParams {
  matching_id?: number
  id?: number
  [key: string]: unknown
}

// 删除参数
interface DeleteMatchingListParams {
  matching_id: number
  [key: string]: unknown
}

// 插入搭配列表
export async function insertMatchingList(
  params: InsertMatchingListParams
): Promise<MatchingListItem> {
  const response = await use$Post<BaseResponse<MatchingListItem>>(
    '/matchingList/insert',
    params
  );
  return response.data;
}

// 获取搭配列表（需要登录）
export async function getMatchingListList(
  params: MatchingListParams
): Promise<PaginationResponse<MatchingListItem>> {
  const response = await use$Post<BaseResponse<PaginationResponse<MatchingListItem>>>(
    '/matchingList/list',
    params
  );
  return response.data;
}

// 获取搭配列表（访客）
export async function getMatchingListListVisitor(
  params: MatchingListParams
): Promise<PaginationResponse<MatchingListItem>> {
  const response = await use$Post<BaseResponse<PaginationResponse<MatchingListItem>>>(
    '/matchingList/list/visitor',
    params
  );
  return response.data;
}

// 获取随机搭配列表
export async function getMatchingListListRandom(
  params: MatchingListParams
): Promise<PaginationResponse<MatchingListItem>> {
  const response = await use$Post<BaseResponse<PaginationResponse<MatchingListItem>>>(
    '/matchingList/list/random',
    params
  );
  return response.data;
}

// 删除搭配列表
export async function deleteMatchingList(
  params: DeleteMatchingListParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/matchingList/delete',
    params
  );
  return response.data;
}

// 更新搭配列表
export async function updateMatchingList(
  params: UpdateMatchingListParams
): Promise<MatchingListItem> {
  const response = await use$Post<BaseResponse<MatchingListItem>>(
    '/matchingList/update',
    params
  );
  return response.data;
}

// 更新搭配列表标签
export async function updateMatchingListTags(
  params: UpdateMatchingListTagsParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/matchingList/update/tags',
    params
  );
  return response.data;
}

// 获取搭配详情
export async function getMatchingDetail(
  params: MatchingDetailParams
): Promise<MatchingListDetail> {
  const response = await use$Post<BaseResponse<MatchingListDetail>>(
    '/matchingList/id',
    params
  );
  return response.data;
}
