import type { BaseResponse } from '@/types/api'

export interface WordCloudItem {
  word: string
  count: number
}

export interface WordCloudListData {
  rows: WordCloudItem[]
}

/** 随机词云（签到花园展示：近 365 天，随机 100 条） */
export async function getWordCloudRandom(): Promise<WordCloudListData> {
  const response = await use$Post<BaseResponse<WordCloudListData>>(
    '/wordcloud/count/random',
    {}
  )
  return response.data
}

/** 全量词云词频（近 365 天，按 count 降序，无 LIMIT） */
export async function getWordCloudAll(): Promise<WordCloudListData> {
  const response = await use$Post<BaseResponse<WordCloudListData>>(
    '/wordcloud/count/all',
    {}
  )
  return response.data
}

export async function insertWordcloud(params: { word: string }): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>('/wordcloud/insert', params)
  return response.data
}
