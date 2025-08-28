
import type { BaseResponse, PaginationParams, PaginationResponse, Effect  } from '@/types/api';
interface SearchParams extends PaginationParams {
}
export async function getEffectList(
  params: PaginationParams
): Promise<PaginationResponse<Effect>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Effect>>>(
    '/effect/list',
    params
  );
  return response.data;
}
