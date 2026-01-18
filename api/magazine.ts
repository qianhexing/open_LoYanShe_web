import type { BaseResponse, PaginationParams, PaginationResponse, Magazine } from '@/types/api';

// 获取杂志列表
interface SearchParams extends PaginationParams {
  keywords?: string | null
}

export async function getMagazineList(
  params: SearchParams
): Promise<PaginationResponse<Magazine>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Magazine>>>(
    '/magazine/list',
    params
  );
  return response.data;
}

// 获取杂志详情
interface DetailParams {
  magazine_id: number
}

export async function getMagazineDetail(
  params: DetailParams
): Promise<Magazine> {
  const response = await use$Post<BaseResponse<Magazine>>(
    '/magazine/id',
    params
  );
  return response.data;
}