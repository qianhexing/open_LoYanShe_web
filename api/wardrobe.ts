
// 没改好
import type { BaseResponse, Wardrobe, WardrobeClothes, PaginationResponse, PaginationParams, User } from '@/types/api';

export interface WardrobeSearchParams {
  page?: number
  user_id?: number
  pageSize?: number
  qrcode?: string
  password?: string
  filter_list?: Record<string, any>
}
export async function getWardrobeList(
  params: WardrobeSearchParams
): Promise<PaginationResponse<Wardrobe>> {
  const response = await use$Get<BaseResponse<PaginationResponse<Wardrobe>>>('/wardrobe/list/visitor', params);
  return response.data;
}
/**
 * POST `/clothes/list` 可选排序（与衣柜 `sort_type` 二选一由后端约定；建议传 `sort_list` 时忽略衣柜默认排序）。
 *
 * - `add_time_asc`：按加入该衣柜的时间从早到晚（时间轴阅读顺序）
 * - `add_time_desc`：按加入时间从晚到早（最新在前）
 *
 * 后端需在查询中 `ORDER BY` 关联表里「服饰加入衣柜」的时间字段（如 `wardrobe_clothes.add_time`），
 * 且分页结果须为该全局排序下的连续切片。
 */
export type ClothesListSortList = 'add_time_asc' | 'add_time_desc'

export interface ClothesParams extends PaginationParams {
  wardrobe_id: number
  filter_list?: Record<string, any>
  password?: string
  /** 按加入衣柜时间排序；不传则沿用衣柜 `sort_type` */
  sort_list?: ClothesListSortList
}
interface ClothesResponse<T = any> {
  rows: T[];
  count: number
  tags_list: Array<string>
  info: Wardrobe
}
export async function getClothesList(
  params: ClothesParams
): Promise<ClothesResponse<WardrobeClothes>> {
  const response = await use$Post<BaseResponse<ClothesResponse<WardrobeClothes>>>('/clothes/list', params);
  return response.data;
}

/** 单次拉取某衣柜下全部服饰（与列表排序一致由后端保证） */
export interface ClothesAllParams {
  wardrobe_id: number
  password?: string
  filter_list?: Record<string, unknown>
}

/** `/clothes/all` 可能返回仅含 clothes_id / wardrobe_id 的精简项，或 clothes_id 为字符串 */
export type ClothesAllRow = Partial<WardrobeClothes> & { clothes_id?: number | string }

export function normalizeClothesAllPayload(payload: unknown): ClothesAllRow[] {
  if (payload == null) return []
  if (Array.isArray(payload)) return payload as ClothesAllRow[]
  if (typeof payload === 'object') {
    const o = payload as Record<string, unknown>
    const nested = o.rows ?? o.list ?? o.clothes
    if (Array.isArray(nested)) return nested as ClothesAllRow[]
    const inner = o.data
    if (Array.isArray(inner)) return inner as ClothesAllRow[]
  }
  return []
}

/** 从列表项中解析有效服饰 id（兼容 number / string） */
export function parseClothesIdsFromRows(rows: readonly { clothes_id?: unknown }[]): number[] {
  const ids: number[] = []
  for (const r of rows) {
    const raw = r?.clothes_id as unknown
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && n > 0) ids.push(n)
  }
  return ids
}

export async function getClothesAll(params: ClothesAllParams): Promise<WardrobeClothes[]> {
  const response = await use$Post<BaseResponse<unknown>>('/clothes/all', params)
  const rows = normalizeClothesAllPayload(response?.data)
  return rows as WardrobeClothes[]
}

/** 优先 `/clothes/all`，失败时分页 `/clothes/list` 兜底拼齐 */
export async function getClothesListAllFallback(params: ClothesAllParams): Promise<WardrobeClothes[]> {
  try {
    const rows = await getClothesAll(params)
    return Array.isArray(rows) ? rows : []
  } catch {
    const out: WardrobeClothes[] = []
    let page = 1
    const pageSize = 500
    while (true) {
      const res = await getClothesList({
        wardrobe_id: params.wardrobe_id,
        page,
        pageSize,
        password: params.password,
        filter_list: params.filter_list as Record<string, unknown> | undefined
      })
      const chunk = res.rows ?? []
      out.push(...chunk)
      const total = res.count ?? 0
      if (chunk.length < pageSize || out.length >= total) break
      page++
    }
    return out
  }
}
interface sortParams {
  sort: Array<{ clothes_id: number, sort: number}>
  wardrobe_id: number
}

export async function sortClothee(
  params: sortParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/clothes/sort', params);
  return response.data;
}

export async function checkWadrobePassword(
  params: {
    password: string
    wardrobe_id: number
  }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wardrobe/check/password', params);
  return response.data;
}
export interface WardrobeConfigInterface {
  clothes_part: Array<string>
  color_list: Array<string>
  wardrobe_status: Array<string>
}

export async function wardrobeConfig(): Promise<WardrobeConfigInterface> {
  const response = await use$Post<BaseResponse<WardrobeConfigInterface>>('/clothes/config');
  return response.data;
}

export async function insertClothes(
  params: WardrobeClothes
): Promise<WardrobeClothes> {
  const response = await use$Post<BaseResponse<WardrobeClothes>>('/clothes/insert', params);
  return response.data;
}

export async function updateClothes(
  params: WardrobeClothes
): Promise<WardrobeClothes> {
  const response = await use$Post<BaseResponse<WardrobeClothes>>('/clothes/update', params);
  return response.data;
}
export async function changeWardrobeClothes (data: {
  clothes_id: number
  wardrobe_id: number
}): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/clothes/update/wardrobe', data);
  return response.data;
}

/** 批量移动服饰到指定衣柜，ids 为逗号分割字符串，如 "1,2,3" */
export async function changeWardrobeClothesBatch(data: {
  ids: string
  wardrobe_id: number
}): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/clothes/update/wardrobe', data);
  return response.data;
}

/** 批量删除服饰，ids 为逗号分割字符串，如 "1,2,3" */
export async function deleteClothesByIds(params: { ids: string }): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/clothes/delete/ids', params);
  return response.data;
}

export async function deteleClothes(
  params: {
    clothes_id: number
  }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/clothes/delete', params);
  return response.data;
}
export async function insertWardrobe(
  params: Wardrobe
): Promise<Wardrobe> {
  const response = await use$Post<BaseResponse<Wardrobe>>('/wardrobe/insert', params);
  return response.data;
}

export async function updateWardrobe(
  params: Wardrobe
): Promise<Wardrobe> {
  const response = await use$Post<BaseResponse<Wardrobe>>('/wardrobe/update', params);
  return response.data;
}

export async function deleteWardrobe(
  params: {
    wardrobe_id: number
  }
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wardrobe/delete', params);
  return response.data;
}

export async function getClothesDetail(
  params: {
    clothes_id: number
  }
): Promise<WardrobeClothes> {
  const response = await use$Post<BaseResponse<WardrobeClothes>>('/clothes/id', params);
  return response.data;
}

// 衣柜排序
interface WardrobeSortParams {
  sort: Array<{ wardrobe_id: number; sort: number }>
}

export async function sortWardrobe(
  params: WardrobeSortParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/wardrobe/sort', params);
  return response.data;
}

// 获取衣柜列表选项（用于添加图鉴到衣柜）
export interface WardrobeListOption extends Wardrobe {
  is_wardrobe?: number | boolean
  checked?: boolean
}

export async function getWardrobeListOptions(
  params: {
    library_id: number
  }
): Promise<WardrobeListOption[]> {
  const response = await use$Post<BaseResponse<WardrobeListOption[]>>('/wardrobe/options', params);
  return response.data;
}

// 获取衣柜可视化数据
export interface WardrobeVisualizationData {
  user: User;
  wardrobe: Wardrobe[];
  wardrobe_clothes: WardrobeClothes[];
}

export async function getWardrobeVisualization(
  params: {
    user_id: number
  }
): Promise<WardrobeVisualizationData> {
  const response = await use$Post<BaseResponse<WardrobeVisualizationData>>('/visualization/wardrobe', params);
  return response.data;
}

// 全局搜索衣柜服饰
export interface ClothesSearchParams extends PaginationParams {
  filter_list?: Array<{ field: string; op: string; value: string | number }>
  wardrobe_id?: number[]
}

interface ClothesSearchResponse {
  rows: WardrobeClothes[];
  count: number;
}

export async function getClothesSearch(
  params: ClothesSearchParams
): Promise<ClothesSearchResponse> {
  const response = await use$Post<BaseResponse<ClothesSearchResponse>>('/clothes/search', params);
  return response.data;
}

/** 共享服饰列表（筛选 is_shared=1, is_enable=0，按 good_count-bad_count 降序） */
export interface ClothesSharedListParams extends PaginationParams {
  keywords?: string // 支持空格、英文逗号、中文逗号分隔多条件
}

interface ClothesSharedListResponse {
  rows: WardrobeClothes[]
  count: number
}

export async function getClothesSharedList(
  params: ClothesSharedListParams
): Promise<ClothesSharedListResponse> {
  const { page = 1, pageSize = 10, keywords } = params;
  const response = await use$Post<BaseResponse<ClothesSharedListResponse>>('/clothes/shared/list', {
    page,
    pageSize,
    ...(keywords ? { keywords } : {})
  });
  return response.data;
}

/** 增加服饰引用次数（当用户通过 include_clothes 或选择共享服饰引用他人服饰时调用） */
export interface ClothesCitationAddResponse {
  clothes_id: number
  citation_count: number
}

export async function addClothesCitation(params: { clothes_id: number }): Promise<ClothesCitationAddResponse> {
  const response = await use$Post<BaseResponse<ClothesCitationAddResponse>>('/clothes/citation/add', params)
  return response.data
}

/** 衣柜统计接口（与 APP 一致）；visitor 场景可传 user_id */
export interface WardrobeStatisticsPartRow {
  type_count: number
  clothes_part?: string | null
}

export interface WardrobeStatisticsStatusRow {
  total: number
  title?: string | null
}

export interface WardrobeStatisticsParams {
  wardrobe_id?: number[]
  /** 浏览他人衣柜时与 `/wardrobe/list/visitor` 一致 */
  user_id?: number
}

/** 衣柜统计中联动的店铺来源（图鉴 shop + 自定义店名等） */
export interface WardrobeStatisticsShopRow {
  shop_id: number | null
  shop_name: string
  shop_logo: string | null
  clothes_count: number
  is_custom: boolean
  /** 数字店：library 内该 shop_id 且 is_enable=0 的图鉴条数；纯文字自定义店通常无此字段 */
  total_library_count?: number
}

export interface WardrobeStatisticsData {
  clothes_part?: WardrobeStatisticsPartRow[]
  wardrobe_status?: WardrobeStatisticsStatusRow[]
  wardrobe?: Wardrobe[]
  shops?: WardrobeStatisticsShopRow[]
  library?: Array<WardrobeClothes & {
    design_elements?: string
    pattern_elements?: string
    theme?: string
    clothes_main_style?: string
  }>
}

export async function getWardrobeStatistics(
  params: WardrobeStatisticsParams
): Promise<WardrobeStatisticsData> {
  const response = await use$Post<BaseResponse<WardrobeStatisticsData>>('/wardrobe/statistics', params)
  return response.data
}
