import {
  deleteClothesConfigOption,
  type ClothesConfigOptionKind,
} from '@/api/wardrobe'

export type { ClothesConfigOptionKind }

export function clothesTermDeletedMessage(updated?: number) {
  const count = updated ?? 0
  if (count > 0) return `已删除，更新了 ${count} 件服饰`
  return '已删除，没有相关服饰'
}

/** 删除词表词条，然后重新拉取 /clothes/config */
export async function deleteClothesConfigOptionThenReload(
  kind: ClothesConfigOptionKind,
  value: string,
) {
  const label = value.trim()
  if (!label) return { updated: 0 }
  const result = await deleteClothesConfigOption({ kind, value: label })
  await useWardrobeStore().getWardrobeConfig(true)
  return { updated: result?.updated ?? 0 }
}
