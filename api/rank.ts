import type { BaseResponse, PaginationParams, PaginationResponse, User } from '@/types/api';
import { use$Post } from '@/composables/httpCore';

interface RankListParams extends PaginationParams {
  type: 'good' | 'collect' | 'contribute' | 'contribute7' | 'exp'
}

export interface RankItem {
  library_id?: number
  user_id?: number
  user_name?: string
  user_face?: string
  cover?: string
  square_cover?: string
  shop_logo?: string
  name?: string
  count?: number
  [key: string]: any
}

export async function getRankList(
  params: RankListParams
): Promise<PaginationResponse<RankItem | User>> {
  const response = await use$Post<BaseResponse<PaginationResponse<RankItem | User>>>(
    '/rank/list',
    params
  );
  return response.data;
}

