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
export async function getStudyId(
  params: {
    study_id: number
  }
): Promise<Study> {
  const response = await use$Post<BaseResponse<Study>>(
    '/study/id',
    params
  );
  return response.data;
}