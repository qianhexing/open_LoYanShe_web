import { use$Post } from '@/composables/httpCore'
import type { BaseResponse, LibrarySimilarItem, PaginationResponse } from '@/types/api'

/** 识图搜索 tags（OSS 向量预筛 + SQL 候选池 + metadata 加权） */
export interface LibraryImageSearchTags {
  library_type?: string
  pattern_elements?: string
  design_elements?: string
  library_pattern?: string
  theme?: string
  color?: string
  main_style?: string
  cloth_elements?: string
  season?: string
  shop_id?: number
  parent_id?: number
}

export interface LibraryImageSearchParams {
  /** 完整图片 URL，如 https://image.lolitalibrary.com/xxx.jpg */
  url: string
  topK?: number
  tags?: LibraryImageSearchTags
  /** 预留：走 resolveImageSearchTags → analyzeImageTagsFromUrl，与用户 tags 合并 */
  auto_analyze_tags?: boolean
}

/**
 * 图鉴识图搜索（需登录，Authorization header）
 * 打分与 `/library/similar` 同源：similarity_score = metadata_similarity_score + vector_similarity_bonus
 */
export async function searchLibraryByImage(
  params: LibraryImageSearchParams
): Promise<PaginationResponse<LibrarySimilarItem>> {
  const body: Record<string, unknown> = {
    url: params.url,
    topK: params.topK ?? 20,
  }
  if (params.tags && Object.keys(params.tags).length) {
    body.tags = params.tags
  }
  if (params.auto_analyze_tags != null) {
    body.auto_analyze_tags = params.auto_analyze_tags
  }

  const response = await use$Post<BaseResponse<PaginationResponse<LibrarySimilarItem>>>(
    '/vector/library/search/list',
    body
  )
  return response.data
}

export type LibraryTagAnalyzeUrlRole = 'cover' | 'detail' | 'mannequin' | 'model' | 'other'

export interface LibraryTagAnalyzeParams {
  urls?: string[]
  url?: string
  url_roles?: LibraryTagAnalyzeUrlRole[]
  fields?: string[]
  skip_cache?: boolean
}

export interface MatchedWikiItem {
  wiki_id: number
  wiki_name: string
  score: number
  source: string
}

/** 识 Tag 返回的标签，与图鉴入库表单字段一一对应 */
export interface LibraryAnalyzeTags {
  library_type?: string
  library_pattern?: string
  pattern_elements?: string
  design_elements?: string
  cloth_elements?: string
  secondary_cloth?: string
  main_style?: string
  theme?: string
  color?: string
}

export interface LibraryAnalyzeTagsData {
  tags: LibraryAnalyzeTags
  matched_wiki?: Partial<Record<string, MatchedWikiItem[]>>
  unmatched?: Partial<Record<string, string[]>>
  meta?: {
    urls?: string[]
    url_roles?: string[]
    image_count?: number
    model_vision?: string
    model_select?: string
    knowledge_index_id?: string
    cached?: boolean
    duration_ms?: number
    analyze_version?: string
    warnings?: string[]
  }
}

/**
 * 图鉴识 Tag（需登录，Authorization header）
 * 图片需先 OSS 直传，再传公网可访问 URL
 */
export async function analyzeLibraryTags(
  params: LibraryTagAnalyzeParams
): Promise<LibraryAnalyzeTagsData> {
  const response = await use$Post<BaseResponse<LibraryAnalyzeTagsData>>(
    '/vector/library/analyze-tags',
    params
  )
  return response.data
}
