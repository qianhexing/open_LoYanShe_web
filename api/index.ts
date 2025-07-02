// 没改好
import type { BaseResponse, Config, Swiper, Icon } from '@/types/api';

export async function getConfig(): Promise<Config> {
  const response = await use$Get<BaseResponse<Config>>('config');
  return response.data;
}
export async function getSwiper(): Promise<Swiper[]> {
  const response = await use$Get<BaseResponse<Swiper[]>>('getSwiper?pk_type=1');
  return response.data;
}
interface IconParams{
  icon_belong?: number | null  // 可选字段
}
export async function getHomeIcon(data: IconParams): Promise<Icon[]> {
  const response = await use$Post<BaseResponse<Icon[]>>('home/icon', data);
  return response.data;
}