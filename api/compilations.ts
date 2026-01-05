import type { BaseResponse, PaginationParams, PaginationResponse, Compilations } from '@/types/api';
interface SearchParams extends PaginationParams {
  keyword?: string | null  // 可选字段
}
// 新增单条合集数据
export async function insertCompDetail(
  data: Partial<Compilations>
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/detail/insert', data)
}

// 获取合集贡献（示例 comp_id）
export async function getCompContribution(
  data: { comp_id: number }
): Promise<BaseResponse<Compilations>> {
  return await use$Post<BaseResponse<Compilations>>('/comp/contribution', data)
}

// 批量新增合集数据
export async function insertCompDetailArray(
  data: { comp_id: number; library_id: number[] }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/detail/insert/array', data)
}

// 获取合集列表（带分页）
export async function getCompList(
  data: PaginationParams & { keywords?: string }
): Promise<BaseResponse<PaginationResponse<Compilations>>> {
  return await use$Post<BaseResponse<PaginationResponse<Compilations>>>(
    '/comp/list',
    data
  )
}

// 根据 ID 获取合集详情
export async function getCompById(
  params: {
    comp_id: number
  }
): Promise<Compilations> {
  const response = await use$Post<BaseResponse<Compilations>>(
    '/comp/id',
    params
  );
  return response.data;
}

// 删除合集数据
export async function deleteCompList(
  data: { comp_id: number; library_id: number }
): Promise<BaseResponse<null>> {
  return await use$Post<BaseResponse<null>>('/comp/detail/delete', data)
}

// 获取合集详情列表（如子项列表等）
export async function getCompDetailList(
  data: PaginationParams & { comp_id: number; keywords?: string }
): Promise<PaginationResponse<any[]>> {
  const response = await use$Post<BaseResponse<PaginationResponse<any[]>>>('/comp/detail/list', data)
  return response.data
}