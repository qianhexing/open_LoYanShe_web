export interface GardenPlantModel {
  /** 花朵 deco_id（字符串），写入 comment.json_data.flower_types；兼容旧版 plant id */
  id: string
  url: string
  name?: string
  targetHeight?: number
  scale?: number
}

/** 可选植物类型库 */
export const GARDEN_PLANT_MODELS: ReadonlyArray<GardenPlantModel> = [
  { id: 'flower-12', url: '/sence/12.glb', name: '花型 A' },
  { id: 'flower-13', url: '/sence/10.glb', name: '花型 C' },
  { id: 'flower-14', url: '/sence/18.glb', name: '花型 D' },
  { id: 'flower-15', url: '/sence/1.gltf', name: '花型 E' },
]

export const DEFAULT_GARDEN_PLANT_ID = GARDEN_PLANT_MODELS[0]?.id ?? 'flower-12'

/** 花园植物数量上限（1 评论 = 1 株，InstancedMesh 渲染） */
export const MAX_GARDEN_FLOWER_COUNT = 2000
/** 手机端花园植物数量上限（性能考虑） */
export const MAX_GARDEN_FLOWER_COUNT_MOBILE = 500

export function getMaxGardenFlowerCount(mobile = false): number {
  return mobile ? MAX_GARDEN_FLOWER_COUNT_MOBILE : MAX_GARDEN_FLOWER_COUNT
}

/** comment.json_data 中与花园相关的字段 */
export interface CommentGardenJsonData {
  flower_types?: string
}

export function parseCommentFlowerType(jsonData: unknown): string | undefined {
  if (!jsonData || typeof jsonData !== 'object') return undefined
  const value = (jsonData as CommentGardenJsonData).flower_types
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolvePlantIndex(plantId: string | undefined, fallbackIndex: number): number {
  const plants = GARDEN_PLANT_MODELS
  if (!plants.length) return 0

  if (plantId) {
    const idx = plants.findIndex((item) => item.id === plantId)
    if (idx >= 0) return idx
  }

  return ((fallbackIndex % plants.length) + plants.length) % plants.length
}

export function getGardenPlantById(plantId: string | undefined): GardenPlantModel | undefined {
  if (!plantId) return undefined
  return GARDEN_PLANT_MODELS.find((item) => item.id === plantId)
}

/** 装扮楼评论排序（与签到花园 3D 种花顺序一致） */
export function sortGardenComments<T extends { floor?: number; comment_id?: number | string }>(
  rows: T[]
): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.floor ?? 0) - (b.floor ?? 0) ||
      Number(a.comment_id) - Number(b.comment_id)
  )
}

export interface GardenFlowerMeta {
  types: string[]
  commentIds: number[]
}

/** 从评论列表提取花园种花元数据 */
export function buildGardenFlowerMeta<
  T extends { floor?: number; comment_id?: number | string; json_data?: unknown },
>(
  rows: T[],
  total: number,
  pinned?: T | null,
  maxCount = MAX_GARDEN_FLOWER_COUNT
): GardenFlowerMeta {
  const merged = [...rows]
  if (
    pinned &&
    !merged.some((item) => item.comment_id === pinned.comment_id)
  ) {
    merged.push(pinned)
  }
  const sorted = sortGardenComments(merged).slice(
    0,
    Math.min(Math.max(0, total), maxCount)
  )
  return {
    types: sorted.map((item) => parseCommentFlowerType(item.json_data) ?? ''),
    commentIds: sorted.map((item) => {
      const id = Number(item.comment_id)
      return Number.isFinite(id) && id > 0 ? id : 0
    }),
  }
}
