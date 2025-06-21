// 没改好
import type { BaseResponse, Config } from '@/types/api';
export async function getConfig(): Promise<Config> {
  const response = await use$Get<BaseResponse<Config>>('/config');
  return response.data;
}