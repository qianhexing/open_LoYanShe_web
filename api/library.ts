import type { BaseResponse, PaginationParams, PaginationResponse, Library, FilterList, Shop } from '@/types/api';
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
  filter_list?: FilterList[]
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

interface DetailParams{
  library_id?: number | null  // 可选字段
}
interface DetailResponse extends PaginationParams {
  library: Library
  parent?: Library
  shop?: Shop
}
export async function getLibraryDetail(
  params: DetailParams
): Promise<DetailResponse> {
  const response = await use$Get<BaseResponse<DetailResponse>>(
    `/library/detail?library_id=${params.library_id}`
  );
  return response.data;
}
