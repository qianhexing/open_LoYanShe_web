import type { BaseResponse, WardrobeClothes, Shop } from '@/types/api'

/** 年度总结数据接口 */
export interface YearlySummaryData {
  /** 入坑年数 */
  years_in_lolita: number
  /** 今年总消费 */
  total_spending: number
  /** 今年共买统计 [{label: 名称, value: 数字}] */
  purchase_stats: Array<{ label: string; value: number }>
  /** 最新的裙子 */
  latest_dress?: WardrobeClothes[]
  /** 最喜欢的小物 */
  favorite_accessories?: WardrobeClothes[]
  /** 最喜欢的袜子 */
  favorite_socks?: WardrobeClothes[]
  /** 最喜欢的包包 */
  favorite_bags?: WardrobeClothes[]
  /** 穿着率最高的 */
  most_worn?: WardrobeClothes[]
  /** 今年拉黑的店铺 */
  blacklisted_shops?: Shop[]
}

/** 获取年度总结数据 */
export async function getYearlySummary(
  params: {
    year?: number // 年份，默认为当前年份
  } = {}
): Promise<YearlySummaryData> {
  const response = await use$Post<BaseResponse<YearlySummaryData>>(
    '/yearly/summary',
    params
  )
  return response.data
}

