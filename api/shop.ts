import type { BaseResponse, PaginationParams, PaginationResponse, Shop } from '@/types/api';
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
}
export async function getShopList(
  params: SearchParams
): Promise<PaginationResponse<Shop>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Shop>>>(
    '/shop/list',
    params
  );
  return response.data;
}