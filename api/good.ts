import type { BaseResponse, PaginationParams, PaginationResponse, Library, FilterList, Shop } from '@/types/api';
interface InsertParams {
  pk_id: number
  pk_type: number
  type?: number
}
export async function insertGood(
  params: InsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/good/insert',
    params
  );
  return response.data;
}
export async function isGood(
  params: InsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/good/is',
    params
  );
  return response.data;
}
