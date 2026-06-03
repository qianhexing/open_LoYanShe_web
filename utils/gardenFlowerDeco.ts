import type { DecoItem } from '@/api/deco'
import {
  GARDEN_PLANT_MODELS,
  getGardenPlantById,
  resolvePlantIndex,
  type GardenPlantModel,
} from '@/utils/gardenPlants'

export interface GardenFlowerDecoMeta {
  decoId: number
  url: string
  title: string
  cover?: string | null
  hasOwn: boolean
  targetHeight?: number
  scale?: number
}

export interface ResolvedGardenFlowerModel {
  url: string
  id: string
  targetHeight?: number
  scale?: number
}

const registry = new Map<number, GardenFlowerDecoMeta>()
let defaultDecoId: number | null = null

function parseDecoJsonData(json: Record<string, unknown> | null) {
  if (!json) return {}
  const targetHeight = Number(json.target_height ?? json.targetHeight)
  const scale = Number(json.scale)
  return {
    targetHeight: Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : undefined,
    scale: Number.isFinite(scale) && scale > 0 ? scale : undefined,
  }
}

export function getDecoDisplayTitle(item: DecoItem): string {
  if (item.title?.trim()) return item.title.trim()
  const jd = item.json_data as { name?: string } | null
  return jd?.name?.trim() || `花朵${item.deco_id}`
}

export function setGardenFlowerDecoRegistry(items: DecoItem[]) {
  registry.clear()
  for (const item of items) {
    if (!item.url?.trim()) continue
    const extra = parseDecoJsonData(item.json_data)
    registry.set(item.deco_id, {
      decoId: item.deco_id,
      url: item.url,
      title: getDecoDisplayTitle(item),
      cover: item.cover,
      hasOwn: item.has_own === 1,
      targetHeight: extra.targetHeight,
      scale: extra.scale,
    })
  }
  const owned = items.find((row) => row.has_own === 1)
  defaultDecoId = owned?.deco_id ?? items[0]?.deco_id ?? null
}

export function getDefaultGardenFlowerDecoId(): string {
  return defaultDecoId != null ? String(defaultDecoId) : ''
}

export function getGardenFlowerDecoMeta(
  flowerTypeId: string | undefined
): GardenFlowerDecoMeta | undefined {
  const id = Number(flowerTypeId)
  if (!Number.isFinite(id) || id <= 0) return undefined
  return registry.get(id)
}

export function isGardenFlowerDecoId(flowerTypeId: string | undefined): boolean {
  return getGardenFlowerDecoMeta(flowerTypeId) != null
}

/** 解析 3D 花朵模型（deco_id 优先，兼容旧版 GARDEN_PLANT_MODELS.id） */
export function resolveGardenFlowerModel(
  flowerTypeId: string | undefined,
  fallbackIndex: number
): ResolvedGardenFlowerModel {
  const deco = getGardenFlowerDecoMeta(flowerTypeId)
  if (deco) {
    return {
      url: deco.url,
      id: String(deco.decoId),
      targetHeight: deco.targetHeight,
      scale: deco.scale,
    }
  }

  const legacy: GardenPlantModel | undefined = getGardenPlantById(flowerTypeId)
  if (legacy) {
    return {
      url: legacy.url,
      id: legacy.id,
      targetHeight: legacy.targetHeight,
      scale: legacy.scale,
    }
  }

  const plants = GARDEN_PLANT_MODELS
  const plantIdx = resolvePlantIndex(flowerTypeId, fallbackIndex)
  const plant = plants[plantIdx] ?? plants[0]
  return {
    url: plant?.url ?? '',
    id: plant?.id ?? '',
    targetHeight: plant?.targetHeight,
    scale: plant?.scale,
  }
}
