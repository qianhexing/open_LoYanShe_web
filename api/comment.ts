import type { BaseResponse, PaginationParams, PaginationResponse, Comment } from '@/types/api';
interface SearchParams extends PaginationParams {
  id?: number | number[]
  type?: string
  comment_id?: number
  pinned?: number
}
interface CommentPaginationResponse extends PaginationResponse<Comment> {
  pinned?: Comment | null
}
export async function getCommentList(
  params: SearchParams
): Promise<CommentPaginationResponse> {
  const response = await use$Post<BaseResponse<CommentPaginationResponse>>(
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

export async function deleteComment(params: { comment_id: number }): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>(
    '/comment/delete',
    params
  );
  return response.data ?? false;
}
