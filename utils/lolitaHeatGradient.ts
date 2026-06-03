import * as THREE from 'three'

/**
 * Lo娘分布图同款热力渐变（pages/visualization/distributedMaps）
 * ratio = 0 → 深紫（数值高 / 排名靠前），ratio = 1 → 浅白（数值低）
 */
export const LOLITA_HEAT_GRADIENT_COLORS = [
  '#7130ae',
  '#7740bb',
  '#7e51c6',
  '#865ccc',
  '#8e66d2',
  '#9670d7',
  '#9f7bdc',
  '#a784e0',
  '#b08fe4',
  '#ba99e8',
  '#c4a3eb',
  '#cdb1ef',
  '#d5b9f1',
  '#debff4',
  '#e6c5f6',
  '#edcdf9',
  '#f4d4fb',
  '#fadcfb',
  '#fce3fb',
  '#fdebfc',
  '#fef5fd',
  '#fefafd',
  '#fefcfe',
  '#fefeff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
] as const

export function interpolateLolitaHeatColor(ratio: number): THREE.Color {
  const t = Math.max(0, Math.min(1, ratio))
  if (t <= 0) return new THREE.Color(LOLITA_HEAT_GRADIENT_COLORS[0])

  const maxIndex = LOLITA_HEAT_GRADIENT_COLORS.length - 1
  const position = t * maxIndex
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const blend = position - lowerIndex

  const color1 = new THREE.Color(LOLITA_HEAT_GRADIENT_COLORS[lowerIndex])
  const color2 = new THREE.Color(LOLITA_HEAT_GRADIENT_COLORS[upperIndex])
  return color1.clone().lerp(color2, blend)
}

/** 按数值：越大越深紫，越小越浅 */
export function getLolitaHeatColorByValue(
  value: number,
  minValue: number,
  maxValue: number
): THREE.Color {
  const ratio =
    maxValue <= minValue ? 0 : (maxValue - value) / (maxValue - minValue)
  return interpolateLolitaHeatColor(ratio)
}

export function getLolitaHeatColorCssByValue(
  value: number,
  minValue: number,
  maxValue: number
): string {
  return `#${getLolitaHeatColorByValue(value, minValue, maxValue).getHexString()}`
}

/** 词云白底标签：同款紫渐变，最浅止于 #cdb1ef，避免近白色不可读 */
const WORD_CLOUD_HEAT_PALETTE = LOLITA_HEAT_GRADIENT_COLORS.slice(0, 12)

function interpolatePaletteColor(
  palette: readonly string[],
  ratio: number
): THREE.Color {
  const t = Math.max(0, Math.min(1, ratio))
  if (t <= 0) return new THREE.Color(palette[0])

  const maxIndex = palette.length - 1
  const position = t * maxIndex
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const blend = position - lowerIndex

  const color1 = new THREE.Color(palette[lowerIndex])
  const color2 = new THREE.Color(palette[upperIndex])
  return color1.clone().lerp(color2, blend)
}

/** 词云排位占比 → 色阶 ratio（0 最高名次，1 最低） */
export function getWordCloudRankHeatRatio(rankIndex: number, total: number): number {
  if (total <= 1) return 0
  return Math.max(0, Math.min(1, rankIndex / (total - 1)))
}

export function getLolitaHeatColorCssForWordCloudByRatio(ratio: number): string {
  return `#${interpolatePaletteColor(WORD_CLOUD_HEAT_PALETTE, ratio).getHexString()}`
}

export interface WordCloudHeatItem {
  name: string
  value: number
}

/**
 * 按当前词云全部词条的排位占比分色（非原始次数线性映射），
 * 使深紫→浅紫渐变色阶在词条间均匀铺开。
 */
export function buildWordCloudRankColorMap(
  words: WordCloudHeatItem[]
): Map<string, string> {
  const map = new Map<string, string>()
  if (!words.length) return map

  const sorted = [...words].sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN')
  )

  const total = sorted.length
  sorted.forEach((item, index) => {
    const ratio = getWordCloudRankHeatRatio(index, total)
    map.set(item.name, getLolitaHeatColorCssForWordCloudByRatio(ratio))
  })

  return map
}

/** 按排名：rank 越小（越靠前）越深紫 */
export function getLolitaHeatColorByRank(rank: number, maxRank: number): THREE.Color {
  if (maxRank <= 1) return new THREE.Color(LOLITA_HEAT_GRADIENT_COLORS[0])
  const ratio = (rank - 1) / (maxRank - 1)
  return interpolateLolitaHeatColor(ratio)
}
