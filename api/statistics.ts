import type { BaseResponse } from '@/types/api';
import { use$Get } from '@/composables/httpCore';

// 模拟的分布数据接口
export interface DistributedMapData {
  ip_location: string;
  COUNT: number;
}

export async function getDistributedMaps(): Promise<BaseResponse<DistributedMapData[]>> {
  // 实际请求应该是：
  const response = await use$Get<BaseResponse<DistributedMapData[]>>('/distributedMaps');
  return response;
  // return response.data;
}
