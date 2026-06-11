
import type { BaseResponse, PaginationParams, PaginationResponse, TemplateInterface  } from '@/types/api';
interface SearchParams extends PaginationParams {
  pk_type?: number
}
export async function getTemplateList(
  params: SearchParams
): Promise<PaginationResponse<TemplateInterface>> {
  const response = await use$Post<BaseResponse<PaginationResponse<TemplateInterface>>>(
    '/template/list',
    params
  );
  return response.data;
}

export async function getTemplateOne(
  params: {
    template_id: number
  }
): Promise<TemplateInterface> {
  const response = await use$Post<BaseResponse<TemplateInterface>>(
    '/template/id',
    params
  );
  return response.data;
}
