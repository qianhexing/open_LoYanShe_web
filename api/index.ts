// 没改好
import type { BaseResponse, Config, Swiper, Icon, FileInterface } from '@/types/api';
import { BASE_IMG } from '@/utils/ipConfig';

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

export async function uploadImageUrl(file: { file: File; url: string; }): Promise<string> {
  let url: string
  if (file.file) {
    const res = await uploadImage(file.file)
    url = res.file_url
  } else {
    url = file.url.replace(BASE_IMG, '')
  }
  return url
}

// OSS 上传相关接口
interface CheckFileResponse {
  exists: boolean
  file_url?: string
  file_id?: number
  oss?: {
    AccessKeyId: string
    AccessKeySecret: string
    SecurityToken: string
    Expiration: string
    region: string
    bucket: string
    path: string
    file_md5: string
  }
}

interface CheckFileParams {
  file_md5: string
  path?: string
}

/**
 * 检查文件是否存在，存在返回地址，不存在返回OSS签名用于前端直传
 */
export async function checkFileAndGetUploadInfo(params: CheckFileParams): Promise<CheckFileResponse> {
  const response = await use$Post<BaseResponse<CheckFileResponse>>('/qhxUploadOss', params);
  return response.data;
}

interface InsertFileParams {
  file_url: string
  file_md5: string
  file_type?: number
  file_size?: number
}

/**
 * 插入文件记录到数据库
 */
export async function insertFile(params: InsertFileParams): Promise<FileInterface> {
  const response = await use$Post<BaseResponse<FileInterface>>('/file/insert/new', params);
  return response.data;
}