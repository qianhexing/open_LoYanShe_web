import type { BaseResponse, PaginationParams, PaginationResponse, Library } from '@/types/api';
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
}
export async function getLibraryList(
  params: SearchParams
): Promise<PaginationResponse<Library>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Library>>>(
    '/library/list',
    params
  );
  return response.data;
}