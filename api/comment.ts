import type { BaseResponse, PaginationParams, PaginationResponse, Comment } from '@/types/api';
interface SearchParams extends PaginationParams {
  id?: number
  type?: string
  comment_id?: number
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

export async function getReplyList(
  params: SearchParams
): Promise<PaginationResponse<Comment>> {
  const response = await use$Post<BaseResponse<PaginationResponse<Comment>>>(
    '/reply/comment/id/list',
    params
  );
  return response.data;
}

interface InsertParams extends PaginationParams {
  id?: number
  type?: string
  comment_id?: number
  comment_content?: string
  mount_img?: string
  reply_to?: number
}
export async function insertComment(
  params: InsertParams
): Promise<Comment> {
  const response = await use$Post<BaseResponse<Comment>>(
    '/comment/insert',
    params
  );
  return response.data;
}
