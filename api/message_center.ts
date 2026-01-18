import type { BaseResponse, PaginationParams, PaginationResponse, NoticeMessage } from '@/types/api'
import { use$Post } from '@/composables/httpCore'

/**
 * 获取通知列表
 * @param params 分页参数
 * @returns 通知列表
 */
export async function getNoticeList(
  params: PaginationParams
): Promise<PaginationResponse<NoticeMessage>> {
  const response = await use$Post<BaseResponse<PaginationResponse<NoticeMessage>>>(
    '/messageCenter/notice',
    params
  )
  return response.data
}

