
// 没改好
import type { BaseResponse, Config, Swiper, Icon } from '@/types/api';

interface WardrobeSearchParams {
  user_id?: number
  pageSize?: number
  qrcode?: string
  password?: string
}
export async function getWardrobeList(
  params: WardrobeSearchParams
): Promise<Config> {
  const response = await use$Get<BaseResponse<Config>>('/wardrobe/list/visitor', params);
  return response.data;
}
