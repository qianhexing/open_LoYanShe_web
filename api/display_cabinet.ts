import type { BaseResponse, PaginationParams, PaginationResponse, DisplayCabinet } from '@/types/api';
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
  pk_type?: number
}
// 获取实体店展示柜列表
export async function getDisplayCabinetList(
  data: SearchParams
): Promise<PaginationResponse<DisplayCabinet[]>> {
  const response = await use$Post<BaseResponse<PaginationResponse<DisplayCabinet[]>>>('/displayCabinet/list', data)
  return response.data
}

export async function insertDisplayCabinet(
  data: DisplayCabinet
): Promise<DisplayCabinet> {
  const response = await use$Post<BaseResponse<DisplayCabinet>>('/displayCabinet/insert', data)
  return response.data
}