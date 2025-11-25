import type { BaseResponse, PaginationParams, PaginationResponse, BrowTime } from '@/types/api';
interface BrowTimeParams {
  id: string | number
  type: string
}
export async function getBrowTimeOne(params: BrowTimeParams): Promise<BrowTime> {
  const response = await use$Post<BaseResponse<BrowTime>>('/times/one', params);
  return response.data;
}

export async function insertBrowTime(params: BrowTimeParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/times/update', params);
  return response.data; 
}