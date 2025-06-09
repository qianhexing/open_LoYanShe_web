import type { BaseResponse, PaginationParams, PaginationResponse, Shop } from '@/types/api';
export async function getShopList(
  params: PaginationParams
): Promise<PaginationResponse<Shop>> {
  // 1. 首先获取完整响应
  const response = await use$Post<BaseResponse<PaginationResponse<Shop>>>(
    '/shop/list',
    params
  );
  return response.data;
}