/**
 * 与后端 `/intent/analyze` 返回的 `data` 对齐：`{ type: number, params: object }`
 * 已知约定：`0` 加衣柜；`1` 相似推荐（params 含 keyword）；`2` 查裙子信息（params 含 filter_lists 等）；`-1` 未能理解
 */
export interface AiIntentAnalysisResult {
  type: number
  params: Record<string, unknown>
}
