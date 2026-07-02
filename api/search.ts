import type {
  BaseResponse,
  Community,
  Library,
  PaginationParams,
  PaginationResponse,
  User,
} from '@/types/api'

/** 搜索类型：0 帖子，1 图鉴（与后端 SearchController 一致） */
export type SearchPkType = 0 | 1

export interface SearchByKeywordParams extends PaginationParams {
  keyword: string
  pk_type: SearchPkType
}

/** 帖子搜索首屏且关键词为单个词时，可能附带匹配用户 */
export type SearchByKeywordResponse<T = Community | Library> = PaginationResponse<T> & {
  user?: User | null
}

/**
 * 全文搜索（旧版 App `POST /search`）
 * - pk_type=0：帖子（title/content/用户名）
 * - pk_type=1：图鉴（名称、店铺、型色、元素等字段）
 */
export async function searchByKeyword(
  params: SearchByKeywordParams
): Promise<SearchByKeywordResponse> {
  const response = await use$Post<BaseResponse<SearchByKeywordResponse>>('/search', params)
  return response.data
}
