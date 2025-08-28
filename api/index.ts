// 没改好
import type { BaseResponse, Config, Swiper, Icon, FileInterface } from '@/types/api';

export async function getConfig(): Promise<Config> {
  const response = await use$Get<BaseResponse<Config>>('/config');
  return response.data;
}
export async function getSwiper(): Promise<Swiper[]> {
  const response = await use$Get<BaseResponse<Swiper[]>>('/getSwiper?pk_type=1');
  return response.data;
}
interface IconParams{
  icon_belong?: number | null  // 可选字段
}
export async function getHomeIcon(data: IconParams): Promise<Icon[]> {
  const response = await use$Post<BaseResponse<Icon[]>>('/home/icon', data);
  return response.data;
}

export async function uploadImage(file: File): Promise<FileInterface> {
  const formData = new FormData()
  formData.append('file', file) // myFile 是 File 类型
  const response = await use$Post<BaseResponse<FileInterface>>('/qhxUpload', formData);
  return response.data;
}
interface fontParams{
  charset: string  // 可选字段
}
export async function createFont(data: fontParams): Promise<FileInterface> {
  const response = await use$Post<BaseResponse<FileInterface>>('/createFont', data);
  return response.data;
}
