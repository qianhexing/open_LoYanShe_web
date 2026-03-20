import type { BaseResponse, PaginationParams, PaginationResponse } from '@/types/api';

export interface DecoItem {
  deco_id: number;
  type: number;
  url: string;
  /** 封面图（优先于 url 用于展示） */
  cover?: string | null;
  /** 标题（优先于 json_data.name 用于展示） */
  title?: string | null;
  json_data: Record<string, unknown> | null;
  is_free: number;
  price_type: number;
  create_time: string;
  has_own: number;
  desc?: string | null;
  conditions?: string | null;
}

interface DecoListParams extends PaginationParams {
  type?: number;
}

export async function getDecoList(
  params: DecoListParams
): Promise<PaginationResponse<DecoItem>> {
  const response = await use$Post<BaseResponse<PaginationResponse<DecoItem>>>(
    '/deco/list',
    params
  );
  return response.data;
}
