import type { BaseResponse, PaginationParams, PaginationResponse, Study } from '@/types/api';
interface SearchParams extends PaginationParams {
  parent_id?: number | null  // 可选字段
}
export async function getStudyList(
  params: SearchParams
): Promise<PaginationResponse<Study>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Study>>>(
    '/study/list',
    params
  );
  return response.data;
}