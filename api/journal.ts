import type {
  BaseResponse,
  Journal,
  PaginationParams,
  PaginationResponse
} from '@/types/api'

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

/**
 * 手账「列表模式」时间线（单次分页，前端可多页拼接）。
 *
 * --- 请后端新增 ---
 *
 * **POST** `/journal/list`
 *
 * **请求 body（与其它分页接口对齐：`page` + `pageSize`）**
 * - `user_id`（number，必填）：要查看的手账所属用户；**权限规则与 `/journal/listByDate` 相同**
 * - `page`（number，可选，默认 1）
 * - `pageSize`（number，可选，默认 100，建议服务端封顶例如 200）
 *
 * **响应 `data`**：本项目通用的 `{ rows: Journal[]; count: number }`（即 PaginationResponse）
 * - `rows`：每条 **结构与 `/journal/listByDate` 单条一致**（同样按需附带 community / comment / wardrobe_clothes / matching_list / library / plan 等嵌套，字段可与现有接口复用同一套组装逻辑）
 * - `count`：满足条件的总条数（分页累加直至 `rows 累积长度 >= count` 或本页为空）
 *
 * **排序建议**：`journal_time` 降序，同一天内 `create_time` 降序（与前端分组展示一致）
 */
export async function journalList(
  params: { user_id: number } & Partial<PaginationParams>
): Promise<PaginationResponse<Journal>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Journal>>>(
    '/journal/list',
    {
      user_id: params.user_id,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100
    }
  )
  return response.data
}
