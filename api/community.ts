import type { BaseResponse, PaginationParams, PaginationResponse, Community, CommunityForeign } from '@/types/api';
interface SearchParams extends PaginationParams {
  keywords?: string | null  // 可选字段
}
export async function getCommunityList(
  params: SearchParams
): Promise<PaginationResponse<Community>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Community>>>(
    '/community/list',
    params
  );
  return response.data;
}
interface DetailParams {
  community_id?: number  // 可选字段
}
export async function getCommunityDetail(
  params: DetailParams
): Promise<Community> {
  const response = await use$Post<BaseResponse<Community>>(
    '/community/id',
    params
  );
  return response.data;
}

interface SearchParams extends PaginationParams {
  pk_type?: number  // 可选字段
  where?: {
    sort?: number
  }
  pk_id?: number  // 可选字段
}
export async function getCommunityForeignList(
  params: SearchParams
): Promise<PaginationResponse<CommunityForeign>> {
  const response = await use$Post<BaseResponse<PaginationResponse<CommunityForeign>>>(
    '/community/foreign/list',
    params
  );
  return response.data;
}

