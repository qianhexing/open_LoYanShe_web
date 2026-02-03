import type { BaseResponse, PaginationParams, PaginationResponse, Shop, PhysicalShop } from '@/types/api';
import { use$Get, use$Post } from '@/composables/httpCore';
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

export interface InsertShopParams {
  shop_name: string
  user_id: number
  shop_url?: string | null
  wb_name?: string | null
  wb_url?: string | null
  shop_describe?: string | null
  shop_type?: string | null
  shop_style?: string | null
  shop_country?: number | null
  shop_state?: number | null
  main_type?: string | null
  shop_logo?: string | null
}

export interface UpdateShopParams extends InsertShopParams {
  shop_id: number
}

export async function insertShop(params: InsertShopParams): Promise<Shop> {
  const response = await use$Post<BaseResponse<Shop>>(
    '/shop/insert',
    params
  );
  return response.data;
}

export async function updateShop(params: UpdateShopParams): Promise<Shop> {
  const response = await use$Post<BaseResponse<Shop>>(
    '/shop/update',
    params
  );
  return response.data;
}

export async function getShopById(params: { shop_id: number }): Promise<Shop> {
  const response = await use$Post<BaseResponse<Shop>>(
    '/shop/id',
    params
  );
  return response.data;
}

// 获取所有实体店
export async function getAllPhysicalShops(): Promise<PhysicalShop[]> {
  const response = await use$Post<BaseResponse<PhysicalShop[]>>(
    '/physicalShop/all'
  );
  return response.data;
}