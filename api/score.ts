import type { BaseResponse } from '@/types/api'

export type ScoreTargetType = 'library' | 'shop'

export interface InsertScoreParams {
  id: number
  type: ScoreTargetType
  score: number
}

export interface ScoreOneParams {
  id: number
  type: ScoreTargetType
}

export interface ScoreRecord {
  score_id: number
  score: number
  id: number
  type: ScoreTargetType
  data?: string
}

export async function insertScore(params: InsertScoreParams): Promise<boolean> {
  const response = await use$Post<BaseResponse<boolean>>('/score/insert', params)
  return response.data
}

/** 查询当前用户是否已评分（需登录）；未评分为 false */
export async function getScoreOne(params: ScoreOneParams): Promise<ScoreRecord | false> {
  const response = await use$Post<BaseResponse<ScoreRecord | false>>('/score/one', params)
  return response.data
}
