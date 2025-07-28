import type { BaseResponse, PaginationParams, PaginationResponse, Comment } from '@/types/api';
interface SearchParams extends PaginationParams {
  id: number
  type: string
}
export async function getCommentList(
  params: SearchParams
): Promise<PaginationResponse<Comment>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Comment>>>(
    '/comment/list',
    params
  );
  return response.data;
}

// export async function getShopDetail(
//   params: {
//     shop_id: number
//   }
// ): Promise<Shop> {
//   const response = await use$Post<BaseResponse<Shop>>(
//     '/shop/id',
//     params
//   );
//   return response.data;
// }