import type { User } from '~/types/api'
import type { FeatureNavFlatItem } from '~/types/featuresNav'
import { featureNavFlat } from '~/data/featuresNav'

export function parseFeatureMessageConfig(u: User | null): Record<string, unknown> {
  if (!u?.message_config) return {}
  const mc = u.message_config as unknown
  if (typeof mc === 'string') {
    try {
      return JSON.parse(mc) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof mc === 'object' && mc !== null && !Array.isArray(mc)) {
    return { ...(mc as Record<string, unknown>) }
  }
  return {}
}

/** 顶置菜单：与 `message_config.menu`、当前 `featureNavFlat` 对齐 */
export function useFeaturePinnedMenu() {
  const { user } = storeToRefs(useUserStore())

  const catalogFirstById = computed(() => {
    const m = new Map<string, FeatureNavFlatItem>()
    for (const row of featureNavFlat) {
      if (!m.has(row.id)) m.set(row.id, row)
    }
    return m
  })

  const savedMenuRaw = computed(() => {
    const menu = parseFeatureMessageConfig(user.value).menu
    if (!Array.isArray(menu)) return [] as string[]
    return menu.map((x) => String(x)).filter(Boolean)
  })

  /** 仅在「功能合集」页用于隐藏下方条目：仍为线上的顶置 id */
  const pinnedOnlineIdSet = computed(
    () => new Set(savedMenuRaw.value.filter((id) => catalogFirstById.value.has(id)))
  )

  /** 顶置展示：按菜单顺序且每个 id 只出现一次（避免重复 key / 错乱） */
  const visiblePinnedItems = computed(() => {
    const seen = new Set<string>()
    const out: FeatureNavFlatItem[] = []
    for (const id of savedMenuRaw.value) {
      if (seen.has(id)) continue
      const row = catalogFirstById.value.get(id)
      if (!row) continue
      seen.add(id)
      out.push(row)
    }
    return out
  })

  return {
    user,
    catalogFirstById,
    savedMenuRaw,
    pinnedOnlineIdSet,
    visiblePinnedItems
  }
}
