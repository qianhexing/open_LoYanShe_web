import type {
  BaseResponse,
  PaginationParams,
  PaginationResponse,
  Favorite,
  FavoriteFolder,
  FavoriteDetail,
  CollectVisitorRow,
} from '@/types/api'
export interface CollectInsertParams {
  pk_id?: number
  collect_type?: number | string | null
  ids?: Array<number>
  /** 收藏附加数据；已存在时与原有 json_data 深度合并（数组直接覆盖） */
  json_data?: Record<string, unknown>
}

export interface CollectUpdateParams {
  /** 收藏记录 id */
  id: number
  /** 与原有 json_data 深度合并（数组直接覆盖） */
  json_data?: Record<string, unknown>
}

/** 单条收藏记录（POST /collect/update 返回） */
export interface CollectRecord {
  id: number
  favorite_id?: number
  user_id?: number
  collect_type?: number
  pk_id?: number
  create_time?: string
  notice?: number
  json_data?: Record<string, unknown> | null
}

export async function insertCollect(
  params: CollectInsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/collect/insert',
    params
  );
  return response.data;
}

/** 批量收藏结果（POST /collect/insert/batch） */
export interface CollectBatchInsertResult {
  /** 本次新增数量 */
  added: number
  /** 去重后的请求数量 */
  total: number
}

export interface CollectBatchInsertParams {
  /** 收藏夹 ID（单个） */
  favorite_id: number
  /** 收藏对象 ID 列表（pk_id） */
  ids: number[]
  /** 收藏类型（批量内统一） */
  collect_type: number
  /** 可选，写入/更新时与原有 json_data 深度合并（数组直接覆盖） */
  json_data?: Record<string, unknown>
}

/**
 * 批量收藏：一个收藏夹 → 多个对象
 * 与单条 insertCollect（一个 pk_id → 多个收藏夹 ids）方向相反
 */
export async function batchInsertCollect(
  params: CollectBatchInsertParams
): Promise<CollectBatchInsertResult> {
  const response = await use$Post<BaseResponse<CollectBatchInsertResult>>(
    '/collect/insert/batch',
    params
  )
  return response.data
}

/** 按 id 更新收藏；json_data 与原有数据深度合并 */
export async function updateCollect(
  params: CollectUpdateParams
): Promise<CollectRecord> {
  const response = await use$Post<BaseResponse<CollectRecord>>(
    '/collect/update',
    params
  )
  return response.data
}
export async function isCollect(
  params: Pick<CollectInsertParams, 'pk_id' | 'collect_type'>
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/collect/is',
    params
  );
  return response.data;
}

interface OptionsParams {
  collect_type: number
  pk_id: number
}

// 获取收藏夹
export async function getFavoriteOptions(
  params: OptionsParams
): Promise<Favorite[]> {
  const response = await use$Post<BaseResponse<Favorite[]>>(
    '/favorite/options',
    params
  );
  return response.data;
}

export interface FavoriteListVisitorParams extends PaginationParams {
  user_id: number
}

/** 某用户的收藏夹列表（游客/登录均可，与旧站 favorite/list/visitor 一致） */
export async function getFavoriteListVisitor(
  params: FavoriteListVisitorParams
): Promise<PaginationResponse<FavoriteFolder>> {
  const response = await use$Get<BaseResponse<PaginationResponse<FavoriteFolder>>>(
    '/favorite/list/visitor',
    params
  )
  return response.data
}

export interface CollectListVisitorParams extends PaginationParams {
  /** 收藏夹 id */
  id: number
}

/** 收藏夹内条目分页 */
export async function getCollectListVisitor(
  params: CollectListVisitorParams
): Promise<PaginationResponse<CollectVisitorRow>> {
  const response = await use$Post<BaseResponse<PaginationResponse<CollectVisitorRow>>>(
    '/collect/list/visitor',
    params
  )
  return response.data
}

export async function getFavoriteDetail(params: { id: number | string }): Promise<FavoriteDetail> {
  const response = await use$Get<BaseResponse<FavoriteDetail>>('/favorite/detail', {
    id: params.id,
  })
  return response.data
}

export async function deleteFavoriteFolder(params: { id: number }): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/favorite/delete', params)
  return response.data
}

export async function deleteCollectItem(params: { id: number }): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/collect/delete', params)
  return response.data
}

export interface InsertFavoriteParams {
  favorite_name: string
  collect_type: number
  favorite_desc?: string
  favorite_pic?: string
  is_private?: number
}

/** 新建收藏夹（POST /favorite/insert） */
export async function insertFavorite(params: InsertFavoriteParams): Promise<FavoriteFolder> {
  const response = await use$Post<BaseResponse<FavoriteFolder>>('/favorite/insert', params)
  return response.data
}
