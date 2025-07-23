import type { BaseResponse } from '@/types/api';
interface InsertParams {
  balck_user: number
  pk_type?: number
}
// 拉黑
export async function insertBlack(
  params: InsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/black/insert',
    params
  );
  return response.data;
}
// 是否拉黑
export async function isBlack(
  params: InsertParams
): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/black/is',
    params
  );
  return response.data;
}
