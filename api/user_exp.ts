import type { BaseResponse, PaginationResponse, ExpRecord } from '@/types/api'
import { use$Post } from '@/composables/httpCore'

/** 获取经验获取记录列表，无需传参 */
export async function getExpRecordList(): Promise<PaginationResponse<ExpRecord>> {
  const response = await use$Post<BaseResponse<PaginationResponse<ExpRecord>>>(
    '/user/exp/record/list',
    {}
  )
  return response.data
}
