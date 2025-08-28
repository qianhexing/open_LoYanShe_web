
import type { BaseResponse, PaginationParams, PaginationResponse, Material  } from '@/types/api';
interface SearchParams extends PaginationParams {
}
export async function getMaterialctList(
  params: PaginationParams
): Promise<PaginationResponse<Material>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Material>>>(
    '/material/list',
    params
  );
  return response.data;
}
