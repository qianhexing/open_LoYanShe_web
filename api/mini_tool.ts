import type {
  BaseResponse,
  MiniTool,
  MiniToolHistoryItem,
  PaginationParams,
  PaginationResponse,
} from '@/types/api'

export interface MiniToolListParams {
  keyword?: string
  page?: number
  pageSize?: number
}

/** 小工具列表（默认按使用次数降序） */
export async function getMiniToolList(
  params: MiniToolListParams = {}
): Promise<MiniTool[] | PaginationResponse<MiniTool>> {
  const response = await use$Post<
    BaseResponse<MiniTool[] | PaginationResponse<MiniTool>>
  >('/mini_tool/list', params)
  return response.data
}

export async function getMiniToolDetail(params: {
  tool_id: number
}): Promise<MiniTool> {
  const response = await use$Post<BaseResponse<MiniTool>>(
    '/mini_tool/detail',
    params
  )
  return response.data
}

/** 上报使用；登录态下后端会写入单对单历史 */
export async function reportMiniToolUse(params: {
  tool_id: number
}): Promise<{ tool_id: number; use_count: number }> {
  const response = await use$Post<
    BaseResponse<{ tool_id: number; use_count: number }>
  >('/mini_tool/use', params)
  return response.data
}

/** 最近使用（需登录） */
export async function getMiniToolHistoryList(
  params: Partial<PaginationParams> = {}
): Promise<PaginationResponse<MiniToolHistoryItem>> {
  const response = await use$Post<
    BaseResponse<PaginationResponse<MiniToolHistoryItem>>
  >('/mini_tool/history/list', {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  })
  return response.data
}
