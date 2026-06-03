import type { BaseResponse, CommentJsonData } from '@/types/api'

export interface SignInDayStat {
  total_count: number
}

export interface SignInDayComment {
  date: string
  comment_content: string
  mount_img?: string
}

export interface SignInStatisticsByDayData {
  rows: SignInDayStat[]
  comment_list?: SignInDayComment[]
}

export interface SignInDailyParams {
  comment_content?: string
  word_cloud?: boolean
  mount_img?: string
  reply_to?: number
  json_data?: CommentJsonData | Record<string, unknown>
}

export async function getIsSignIn(): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/signin/is', {})
  return response.data ?? false
}

export async function signInDaily(params: SignInDailyParams): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>('/signin/daily', params)
  return response.data
}

export async function getSignInStatisticsByDay(params: {
  start_date: string
}): Promise<SignInStatisticsByDayData> {
  const response = await use$Post<BaseResponse<SignInStatisticsByDayData>>(
    '/signin/statistics/day',
    params
  )
  return response.data
}
