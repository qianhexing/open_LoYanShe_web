import type {
  BaseResponse,
  PaginationParams,
  PaginationResponse,
  Favorite,
  FavoriteFolder,
  FavoriteDetail,
  CollectVisitorRow,
} from '@/types/api'
interface InsertParams {
  pk_id?: number
  collect_type?: number | string | null
  ids?: Array<number>
}
export async function insertCollect(
  params: InsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/collect/insert',
    params
  );
  return response.data;
}
export async function isCollect(
  params: InsertParams
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
