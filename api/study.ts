import type { BaseResponse, PaginationParams, PaginationResponse, Study, StudyForeign } from '@/types/api';
interface SearchParams extends PaginationParams {
  parent_id?: number | null  // 可选字段
  study_id?: number
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

export async function getStudyForeignList(
  params: SearchParams
): Promise<PaginationResponse<StudyForeign>> {
  const response = await use$Post<BaseResponse<PaginationResponse<StudyForeign>>>(
    '/study/foreign/list',
    params
  );
  return response.data;
}
