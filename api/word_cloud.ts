import type { BaseResponse } from '@/types/api'

export interface WordCloudItem {
  word: string
  count: number
}

export interface WordCloudRandomData {
  rows: WordCloudItem[]
}

export async function getWordCloudRandom(): Promise<WordCloudRandomData> {
  const response = await use$Post<BaseResponse<WordCloudRandomData>>(
    '/wordcloud/count/random',
    {}
  )
  return response.data
}

export async function insertWordcloud(params: { word: string }): Promise<unknown> {
  const response = await use$Post<BaseResponse<unknown>>('/wordcloud/insert', params)
  return response.data
}
