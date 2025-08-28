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

export async function getShopDetail(
  params: {
    shop_id: number
  }
): Promise<Shop> {
  const response = await use$Post<BaseResponse<Shop>>(
    '/shop/id',
    params
  );
  return response.data;
}

export async function getShopOptiosns(
  params: {
    shop_name: string
  }
): Promise<Shop[]> {
  const response = await use$Get<BaseResponse<Shop[]>>(
    '/shop/getOptions/keywords',
    params
  );
  return response.data;
}
