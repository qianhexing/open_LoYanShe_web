import type { BaseResponse, PaginationParams, PaginationResponse, Study, StudyForeign } from '@/types/api';

interface SearchParams extends PaginationParams {
  parent_id?: number | null
  study_id?: number
  keyword?: string
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

/** 新增研习（目录项） */
export interface InsertStudyParams {
  study_title?: string
  study_desc?: string
  study_cover?: string | null
  study_type?: number
  study_url?: string
  sort?: number
  parent_id?: number
}

export interface UpdateStudyParams extends InsertStudyParams {
  study_id: number
}

export async function insertStudy(params: InsertStudyParams): Promise<Study> {
  const response = await use$Post<BaseResponse<Study>>('/study/insert', params)
  return response.data
}

export async function updateStudy(params: UpdateStudyParams): Promise<Study> {
  const response = await use$Post<BaseResponse<Study>>('/study/update', params)
  return response.data
}

export async function deleteStudy(study_id: number): Promise<void> {
  await use$Post<BaseResponse<void>>('/study/delete', { study_id })
}
