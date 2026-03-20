import type { BaseResponse } from '@/types/api'
import type { Journal } from '@/types/api'

/** 新增手账 */
export async function journalInsert(params: {
  journal_time: string
  pk_type: number
  pk_id: number
  note?: string
  json_data?: Record<string, unknown>
}): Promise<Journal> {
  const response = await use$Post<BaseResponse<Journal>>('/journal/insert', params)
  return response.data
}

/** 修改手账 */
export async function journalUpdate(params: {
  journal_id: number
  journal_time?: string
  pk_type?: number
  pk_id?: number
  note?: string
}): Promise<Journal> {
  const response = await use$Post<BaseResponse<Journal>>('/journal/update', params)
  return response.data
}

/** 删除手账 */
export async function journalDelete(params: { journal_id: number }): Promise<null> {
  const response = await use$Post<BaseResponse<null>>('/journal/delete', params)
  return response.data
}

/** 按日统计当月数量 */
export async function journalCountByDay(params: {
  year: string
  month: string
  user_id: number
}): Promise<{ day: number; count: number }[]> {
  const response = await use$Post<
    BaseResponse<{ day: number; count: number }[]>
  >('/journal/countByDay', params)
  return response.data
}

/** 按年月(日)查询数据：不传 day 时返回当月所有数据，传 day 时返回当日数据 */
export async function journalListByDate(params: {
  year: string
  month: string
  day?: string
  user_id: number
}): Promise<Journal[]> {
  const response = await use$Post<BaseResponse<Journal[]>>(
    '/journal/listByDate',
    params
  )
  return response.data
}
