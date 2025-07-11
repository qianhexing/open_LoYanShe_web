import type { BaseResponse, PaginationParams, PaginationResponse, Favorite } from '@/types/api';
interface InsertParams {
  pk_id?: number
  collect_type: number | string
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

