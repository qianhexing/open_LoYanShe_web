import type { BaseResponse, PaginationParams, PaginationResponse, Compilations } from '@/types/api';
import { use$Post } from '@/composables/httpCore'

/** 合集 pk_type：0 图鉴 · 1 公开搭配合集 · 3 搭配夹 */
export const COMP_PK_TYPE_LIBRARY = 0
export const COMP_PK_TYPE_MATCHING_PUBLIC = 1
export const COMP_PK_TYPE_MATCHING_FOLDER = 3

// 创建合集
export async function insertComp(
  data: Partial<Compilations> & { pk_type: number; ids?: number[] }
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/insert', data)
}

// 更新合集
export async function updateComp(
  data: Partial<Compilations> & { comp_id: number }
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/update', data)
}

// 删除合集
export async function deleteComp(
  data: { comp_id: number }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/delete', data)
}

// 新增单条合集数据（搭配夹时 library_id = matching_id）
export async function insertCompDetail(
  data: { comp_id: number; library_id: number }
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/detail/insert', data)
}

// 获取合集贡献（示例 comp_id）
export async function getCompContribution(
  data: { comp_id: number }
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/contribution', data)
}

// 批量新增合集数据
export async function insertCompDetailArray(
  data: { comp_id: number; library_id: number[] }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/detail/insert/array', data)
}

// 获取合集列表（带分页）
export async function getCompList(
  data: PaginationParams & { keywords?: string; pk_type?: number }
): Promise<BaseResponse<PaginationResponse<Compilations>>> {
  return await use$Post<BaseResponse<PaginationResponse<Compilations>>>(
    '/comp/list',
    data
  )
}

/** 当前用户全部搭配夹（pk_type=3），对齐 /wardrobe/my */
export async function getCompMy(): Promise<Compilations[]> {
  const response = await use$Post<BaseResponse<Compilations[]>>('/comp/my', {})
  return response.data ?? []
}

/** 合集/搭配夹排序，对齐 /wardrobe/sort */
export async function sortComp(params: {
  sort: Array<{ comp_id: number; sort: number }>
  pk_type?: number
}): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/comp/sort', {
    pk_type: COMP_PK_TYPE_MATCHING_FOLDER,
    ...params,
  })
  return response.data
}

/** 合集内容排序（仿 /clothes/sort；搭配夹 library_id = matching_id） */
export async function sortCompDetail(params: {
  comp_id: number
  sort: Array<{ library_id?: number; matching_id?: number; comp_list_id?: number; sort?: number }>
}): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/comp/detail/sort', params)
  return response.data
}

/** 搭配夹选项（可选 matching_id 返回 is_in） */
export async function getCompOptions(params?: {
  matching_id?: number
}): Promise<Compilations[]> {
  const response = await use$Post<BaseResponse<Compilations[]>>('/comp/options', params ?? {})
  return response.data ?? []
}

// 根据 ID 获取合集详情
export async function getCompById(
  params: {
    comp_id: number
  }
): Promise<Compilations> {
  const response = await use$Post<BaseResponse<Compilations>>(
    '/comp/id',
    params
  );
  return response.data;
}

// 删除合集数据
export async function deleteCompList(
  data: { comp_id: number; library_id: number }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/detail/delete', data)
}

/** 批量删除合集内容（搭配夹 library_id = matching_id） */
export async function deleteCompDetailArray(
  data: { comp_id: number; library_id: number[] }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/comp/detail/delete/array', data)
  return response.data
}

/**
 * 清理合集中已失效的搭配子项（搭配已删/禁用，合集行仍启用）
 * - 不传：清理当前用户全部搭配夹(pk_type=3)
 * - 传 comp_id：只清指定合集（须为创建者；支持 pk_type 1/3）
 */
export async function cleanInvalidCompDetail(
  data?: { comp_id?: number }
): Promise<{ cleaned: number }> {
  const response = await use$Post<BaseResponse<{ cleaned: number }>>(
    '/comp/detail/clean',
    data ?? {},
  )
  return response.data ?? { cleaned: 0 }
}

// 用户删除自己添加的合集数据
export async function deleteCompListUser(
  data: { comp_id: number; library_id: number }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/detail/delete/user', data)
}

/** 合集详情行：图鉴带 library；搭配合集/搭配夹带 matching_list */
export interface CompDetailRow {
  comp_list_id?: number
  comp_id?: number
  library_id?: number
  matching_list?: {
    matching_id: number
    cover?: string
    note?: string
    main_style?: string
    user_id?: number
    is_private?: number
    clothes_list?: Array<{ clothes_img: string }>
    library_list?: Array<{ square_cover?: string; cover?: string }>
    height?: number
    width?: number
    tags_list?: Array<{ tags_id: number; tags_name: string }>
    [key: string]: unknown
  }
  library?: unknown
  user_id?: number
  user_face?: string
  user_name?: string
  [key: string]: unknown
}

// 获取合集详情列表（如子项列表等）
export async function getCompDetailList(
  data: PaginationParams & { comp_id: number; keywords?: string }
): Promise<PaginationResponse<CompDetailRow[]>> {
  const response = await use$Post<BaseResponse<PaginationResponse<CompDetailRow[]>>>('/comp/detail/list', data)
  return response.data
}
