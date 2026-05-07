import type { BaseResponse, QrCode } from '@/types/api';
import type { PaginationResponse } from '@/types/api';
export async function getQrCodeList(
  params: {
    page?: number
    pageSize?: number
    pk_id?: number
    pk_type?: number
  }
): Promise<PaginationResponse<QrCode>> {
  const response = await use$Post<BaseResponse<PaginationResponse<QrCode>>>('/qrcode/list', params);
  return response.data;
}