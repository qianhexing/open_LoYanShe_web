import type { BaseResponse, PaginationParams, PaginationResponse } from '@/types/api'
import { changeUserInfo } from '@/api/user'

/** 头像框列表项（对齐 uni-app `avatar_frame/list`） */
export interface AvatarFrameItem {
  frame_id: number
  frame_name?: string
  avatar_frame?: string
  /** 0 免费；非 0 为所需经验 */
  is_free?: number
  /** 已拥有时非 null */
  user_deco?: unknown | null
  /** 前端衍生：付费且未拥有 */
  disabled?: boolean
}

export async function getAvatarFrameList(
  params: PaginationParams,
): Promise<PaginationResponse<AvatarFrameItem>> {
  const response = await use$Post<BaseResponse<PaginationResponse<AvatarFrameItem>>>(
    '/avatar_frame/list',
    params,
  )
  return response.data
}

/** 更换头像框：`avatar_frame` 传 frame_id；0 表示无框 */
export async function changeUserAvatarFrame(frameId: number): Promise<void> {
  await changeUserInfo({ avatar_frame: frameId })
}

/** 装饰兑换（头像框用经验）：pk_type=0 表示头像框 */
export async function exchangeDeco(
  pkType: number,
  pkId: number,
  payType: string = 'exp',
): Promise<{ cost?: number }> {
  const response = await use$Post<BaseResponse<{ cost?: number }>>('/user/deco/exchange', {
    pk_type: pkType,
    pk_id: pkId,
    pay_type: payType,
  })
  return response.data
}
