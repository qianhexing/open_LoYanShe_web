
import type { BaseResponse, PaginationParams, PaginationResponse, Scene  } from '@/types/api';
import type { SceneJSON } from '@/utils/threeCore'
export async function getSceneId(
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

export async function updateScene(
  params: {
    sence_id: number,
    json_data?: SceneJSON
    sence_cover?: string
  }
): Promise<Scene> {
  const response = await use$Post<BaseResponse<Scene>>(
    '/sence/update',
    params
  );
  return response.data;
}

export async function insertScene(
  params: {
    json_data: SceneJSON
    sence_cover?: string
  }
): Promise<Scene> {
  const response = await use$Post<BaseResponse<Scene>>(
    '/sence/insert',
    params
  );
  return response.data;
}

interface GetSceneListParams extends PaginationParams {
  visitor_id: number
}

export async function getSenceList(
  params: GetSceneListParams
): Promise<PaginationResponse<Scene>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Scene>>>(
    '/sence/list',
    params
  );
  return response.data;
}