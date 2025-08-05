
import type { BaseResponse, PaginationParams, PaginationResponse, Scene  } from '@/types/api';
export async function getStudyId(
  params: {
    sence_id: number
  }
): Promise<Scene> {
  const response = await use$Post<BaseResponse<Scene>>(
    '/sence/id',
    params
  );
  return response.data;
}
