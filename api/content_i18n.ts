import type { BaseResponse } from '@/types/api'

/** content_i18n.pk_type：1 帖子 / 2 评论 */
export const ContentI18nPkType = {
  Community: 1,
  Comment: 2,
} as const

export type ContentI18nPkTypeValue =
  (typeof ContentI18nPkType)[keyof typeof ContentI18nPkType]

export interface ContentI18nTranslateParams {
  pk_type: ContentI18nPkTypeValue | number
  pk_id: number
  lang: string
  force?: boolean
  source_lang?: string
}

export interface ContentI18nTranslateResult {
  pk_type: number
  pk_id: number
  lang: string
  /** 帖子: { title, content }；评论: { comment_content } */
  payload: Record<string, string>
  content_hash: string
  source: 'mt' | 'origin' | 'human'
  model: string | null
  cached: boolean
  i18n_id?: number
}

/** 按需翻译：详情/评论点「翻译」时调用（需登录） */
export async function translateContent(
  params: ContentI18nTranslateParams
): Promise<ContentI18nTranslateResult> {
  const response = await use$Post<BaseResponse<ContentI18nTranslateResult>>(
    '/content/i18n/translate',
    params
  )
  return response.data
}
