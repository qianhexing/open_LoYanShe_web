import type { BaseResponse, QrCode, PaginationResponse } from '@/types/api'

export async function getQrCodeList(params: {
  page?: number
  pageSize?: number
  pk_id?: number
  pk_type?: number
}): Promise<PaginationResponse<QrCode>> {
  const response = await use$Post<BaseResponse<PaginationResponse<QrCode>>>('/qrcode/list', params)
  return response.data
}

export async function insertQrCode(params: {
  pk_id: number
  pk_type: number
}): Promise<QrCode> {
  const response = await use$Post<BaseResponse<QrCode>>('/qrcode/insert', params)
  return response.data
}

export async function updateQrCode(params: {
  code_id: number
  expires_time: number | null
}): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/qrcode/update', params)
  return response.data
}

export async function deleteQrCode(params: { code_id: number }): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/qrcode/delete', params)
  return response.data
}

export async function getQrCodeByCode(params: {
  code_content: string
}): Promise<{ toUrl: string }> {
  const response = await use$Post<BaseResponse<{ toUrl: string }>>('/qrcode/id/code', params)
  return response.data
}
