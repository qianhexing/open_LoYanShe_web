import type { BaseResponse, EventRedblack, PaginationParams, PaginationResponse } from '@/types/api'

interface EventRedblackListParams extends PaginationParams {
  pk_id: number
  pk_type: number
}

export async function getEventRedblackList(
  params: EventRedblackListParams
): Promise<PaginationResponse<EventRedblack>> {
  const response = await use$Post<BaseResponse<PaginationResponse<EventRedblack>>>(
    '/redblack/list',
    params
  )
  return response.data
}

interface InsertEventRedblackParams {
  pk_id: number
  pk_type: number
  attitude: number
  event_desc: string
  title?: string
}

export async function insertEventRedblack(
  params: InsertEventRedblackParams
): Promise<EventRedblack> {
  const response = await use$Post<BaseResponse<EventRedblack>>(
    '/redblack/insert',
    params
  )
  return response.data
}
