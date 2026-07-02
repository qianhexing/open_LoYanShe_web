import type { WardrobeClothes } from '@/types/api'

/** 与 ClothesFavoriteCoverOverlay / libraryScore 一致（index 0 为无星/未定） */
export const CLOTHES_FAVORITE_CAPTIONS = ['', '拉完了', 'NPC', '人上人', '顶级', '夯爆了！'] as const

/** 评级分享图行序：夯爆了 → 拉 → 未定 */
export const FAVORITE_SHARE_ROW_DEFS = [
  { level: 5, label: '夯爆了！' },
  { level: 4, label: '顶级' },
  { level: 3, label: '人上人' },
  { level: 2, label: 'NPC' },
  { level: 1, label: '拉完了' },
  { level: 0, label: '未定', undetermined: true as const },
] as const

export function normalizeClothesFavoriteLevel(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
}

/** 是否归入「未定」：未设置、无效或 0 星 */
export function isUndeterminedFavorite(item: Pick<WardrobeClothes, 'is_favorite'>): boolean {
  const v = item.is_favorite
  if (v === undefined || v === null) return true
  return normalizeClothesFavoriteLevel(v) === 0
}

export function getClothesFavoriteLevel(item: Pick<WardrobeClothes, 'is_favorite'>): number {
  return normalizeClothesFavoriteLevel(item.is_favorite)
}

export function getClothesFavoriteCaption(level: number): string {
  const i = Math.min(5, Math.max(0, Math.round(level)))
  const cap = CLOTHES_FAVORITE_CAPTIONS[i]
  return cap || '未定'
}

/** 按评级分享图 6 行分组（每行对应 FAVORITE_SHARE_ROW_DEFS 一项） */
export function groupItemsByFavoriteScore<T>(
  items: T[],
  getScore: (item: T) => number
): T[][] {
  const buckets: T[][] = FAVORITE_SHARE_ROW_DEFS.map(() => [])
  for (const item of items) {
    const level = normalizeClothesFavoriteLevel(getScore(item))
    if (level === 0) {
      buckets[5].push(item)
      continue
    }
    const rowIdx = FAVORITE_SHARE_ROW_DEFS.findIndex((d) => d.level === level)
    if (rowIdx >= 0) buckets[rowIdx].push(item)
    else buckets[5].push(item)
  }
  return buckets
}

export function groupClothesForFavoriteShare(items: WardrobeClothes[]): WardrobeClothes[][] {
  return groupItemsByFavoriteScore(items, (item) => getClothesFavoriteLevel(item))
}
