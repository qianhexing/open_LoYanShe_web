
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

// 新增素材
export interface InsertMaterialParams {
  materia_title?: string | null
  materia_url: string | null
  cover?: string | null
  pk_type?: number | null
  pk_id?: number | null
  is_private?: number
  is_enable?: number
  options?: Record<string, any>
}

export async function insertMaterial(
  params: InsertMaterialParams
): Promise<Material> {
  const response = await use$Post<BaseResponse<Material>>(
    '/material/insert',
    params
  );
  return response.data;
}

// 更新素材
export interface UpdateMaterialParams extends InsertMaterialParams {
  materia_id: number
}

export async function updateMaterial(
  params: UpdateMaterialParams
): Promise<Material> {
  const response = await use$Post<BaseResponse<Material>>(
    '/material/update',
    params
  );
  return response.data;
}

// 删除素材
export async function deleteMaterial(
  materia_id: number
): Promise<void> {
  await use$Post<BaseResponse<void>>(
    '/material/delete',
    { materia_id }
  );
}