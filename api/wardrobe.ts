
// 没改好
import type { BaseResponse, Wardrobe, WardrobeClothes, PaginationResponse, PaginationParams } from '@/types/api';

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
export interface ClothesParams extends PaginationParams {
  wardrobe_id: number
  filter_list?: Record<string, any>
  password?: string
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
