/** 图鉴评分 0-1、1-2 对应星级档；评语与服饰「喜爱级别」一致 */
export const SCORE_CAPTIONS = ['', '拉完了', 'NPC', '人上人', '顶级', '夯爆了！'] as const

export type LibraryScoreSource = {
  my_score?: number | null
  user_score?: number | null
  self_score?: number | null
}

/** 用户评分 1–5，0.5 步进 */
export function clampUserLibraryScore(n: number) {
  const half = Math.round(n * 2) / 2
  return Math.min(5, Math.max(1, half))
}

/** 综合分展示 0–5 */
export function normalizeAggregateScore(n: number) {
  const half = Math.round(n * 2) / 2
  return Math.min(5, Math.max(0, half))
}

export function formatLibraryScoreLabel(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** 按分值返回评语（与 ClothesFavoriteCoverOverlay 一致，四舍五入到 0–5 档） */
export function getScoreCaption(score: number): (typeof SCORE_CAPTIONS)[number] {
  const i = Math.min(5, Math.max(0, Math.round(score)))
  return SCORE_CAPTIONS[i]
}

export function pickUserLibraryScore(lib: LibraryScoreSource | null | undefined): number | null {
  if (!lib) return null
  const raw = lib.my_score ?? lib.user_score ?? lib.self_score
  if (raw === undefined || raw === null) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n >= 1 ? clampUserLibraryScore(n) : null
}

/** 第 starIndex 颗星（1–5）的填充比例：0 | 0.5 | 1 */
export function starFillRatio(starIndex: number, score: number) {
  const filled = score - (starIndex - 1)
  if (filled >= 1) return 1
  if (filled >= 0.5) return 0.5
  return 0
}
