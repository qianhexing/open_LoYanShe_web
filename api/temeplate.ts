
import type { BaseResponse, PaginationParams, PaginationResponse, TemplateInterface  } from '@/types/api';
interface SearchParams extends PaginationParams {
}
export async function getTemplateList(
  params: PaginationParams
): Promise<PaginationResponse<TemplateInterface>> {
  const response = await use$Post<BaseResponse<PaginationResponse<TemplateInterface>>>(
    '/template/list',
    params
  );
  return response.data;
}
