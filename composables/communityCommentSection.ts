import type { InjectionKey, ShallowRef } from 'vue'
import type { Comment, User } from '@/types/api'

export type RefreshCommentRepliesFn = (parentCommentId: number) => void

/** 子评论列表里点「回复」时传给上级：insert 仍用评论 id + reply_to 为被回复人 user_id */
export interface CommentSubReplyMeta {
  reply_to: number
  replyToUser: User
}

/** 评论区块「回复」统一载荷（主楼 / 子列表共用） */
export interface CommentOpenReplyPayload {
  comment: Comment
  /** 子评场景：主楼 comment_id，成功后刷新该主楼下的子列表 */
  threadRootCommentId?: number
  subReply?: CommentSubReplyMeta
  event?: MouseEvent
}

/** 社区详情页注入：CommentSection 挂载时写入，用于回复成功后刷新子评论 */
export const communityCommentSectionRefreshKey = Symbol.for(
  'qhx.community.detail.commentSection.refreshReplies'
) as InjectionKey<ShallowRef<RefreshCommentRepliesFn | null>>
