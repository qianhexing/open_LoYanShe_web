import type { BaseResponse, PaginationParams, PaginationResponse, Library, FilterList, Shop, LibraryVideo, LibraryPipe } from '@/types/api';
import type { Wiki, User } from '@/types/api'
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
  filter_list?: FilterList[]
  need_Statistics?: boolean
  parent_id?: boolean
  examin?: number[]
  sort?: number  // 排序模式
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
  attributes?: string[]
}
interface DetailResponse extends PaginationParams {
  library: Library
  parent?: Library
  shop?: Shop
  style_list?: Wiki[]
}
export async function getLibraryDetail(
  params: DetailParams
): Promise<DetailResponse> {
  const response = await use$Get<BaseResponse<DetailResponse>>(
    `/library/detail?library_id=${params.library_id}`
  );
  return response.data;
}
interface VideoParams{
  pk_id: number
}
export async function getLibraryVideo(
  params: VideoParams
): Promise<LibraryVideo[]> {
  const response = await use$Post<BaseResponse<LibraryVideo[]>>(
    '/libraryVideo/all',
    params
  );
  return response.data;
}

export interface InsertParams {
  library_id?: number | null
  name: string
  cover?: string
  shop_id: number | null
  main_style?: string | null
  library_type?: string | null
  size?: string | null
  fabric_composition?: string | null
  theme?: string | null
  library_pattern?: string | null
  pattern_elements?: string | null
  design_elements?: string | null
  cloth_elements?: string | null
  state?: string | null
  start_time?: string | null
  end_time?: string | null
  arrears_start?: string | null
  arrears_end?: string | null
  secondary_cloth?: string | null
  sale_time?: string | null
  notes?: string | null
  season?: string | null
  library_price?: number | null
  color?: string | null
  link?: string | null
  parent_id?: number | null
  square_cover?: string | null
  detail_image?: string | null
  quality_test?: string | null
  size_image?: string | null
}
export async function insertLibrary(params: InsertParams): Promise<Library> {
  const response = await use$Post<BaseResponse<Library>>('/library/insert', params)
  return response.data
}
export async function getLibraryById(params: DetailParams): Promise<Library> {
  const response = await use$Post<BaseResponse<Library>>(
    '/library/id',
    params
  );
  return response.data;
}
export async function updateLibrary(params: InsertParams): Promise<Library> {
  const response = await use$Post<BaseResponse<Library>>('/library/update', params)
  return response.data
}

// 审核模式：获取修改参数
export interface ReviewParams {
  library_id: number
  review: number
}
export interface ReviewData {
  link: string | null
  name: string
  size: string | null
  color: string | null
  cover: string | null
  notes: string | null
  state: string | null
  theme: string | null
  season: string | null
  shop_id: number | null
  complete: boolean
  end_time: string | null
  edit_user: number
  parent_id: number
  sale_time: string | null
  main_style: string | null
  size_image: string | null
  start_time: string | null
  arrears_end: string | null
  detail_image: string | null
  library_type: string | null
  square_cover: string | null
  arrears_start: string | null
  library_price: number | null
  cloth_elements: string | null
  design_elements: string | null
  library_pattern: string | null
  secondary_cloth: string | null
  pattern_elements: string | null
  fabric_composition: string | null
}
export interface LibraryHistoryNew {
  history_id?: number
  params: Library
  user_id?: number
  create_time?: string
  type?: number
  library_id?: number
  is_apply?: number
  user?: User
  reason?: string | null
}
export async function getLibraryReviewData(params: ReviewParams): Promise<LibraryHistoryNew> {
  const response = await use$Post<BaseResponse<LibraryHistoryNew>>('/library/history/review', params)
  return response.data
}

// 提交审核
export interface ReviewSubmitParams {
  library_id: number
  history_id: number
  is_apply: number
  reason?: string | null
}
export async function submitLibraryReview(params: ReviewSubmitParams): Promise<void> {
  const response = await use$Post<BaseResponse<void>>('/library/review/submit', params)
  return response.data
}

interface PipeParams extends PaginationParams {
  time?: string
  state?: number
  shop_id?: number
  examin?: number
  sort?: number
}
export async function getLibraryPipeList(params: PipeParams): Promise<PaginationResponse<LibraryPipe>> {
  const response = await use$Post<BaseResponse<PaginationResponse<LibraryPipe>>>('/library/pipe/list', params)
  return response.data
}
interface PipeParamsAll {
  start_time?: string
  end_time?: string
  shop_id?: number
  pk_type?: number
  pk_id?: number
  cache?: boolean
}
export async function getLibraryPipeListAll(params: PipeParamsAll): Promise<LibraryPipe[]> {
  const response = await use$Post<BaseResponse<LibraryPipe[]>>('/library/pipe/all', params)
  return response.data
}

export interface PipeInsertParams {
  state: number
  start_time: string
  end_time: string
  note: string
  pk_id: number
  pk_type: number
  include_library?: string
}
export async function insertLibraryPipe(params: PipeInsertParams): Promise<LibraryPipe> {
  const response = await use$Post<BaseResponse<LibraryPipe>>('/library/pipe/insert', params)
  return response.data
}

export interface LibraryHistoryParams {
  library_id: number
}
export async function getLibraryHistory(params: LibraryHistoryParams): Promise<LibraryHistoryNew[]> {
  const response = await use$Post<BaseResponse<LibraryHistoryNew[]>>('/library/histroy/all', params)
  return response.data
}