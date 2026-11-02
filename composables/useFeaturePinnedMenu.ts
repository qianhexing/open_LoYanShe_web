import type { User } from '~/types/api'
import type { FeatureNavFlatItem } from '~/types/featuresNav'
import { featureNavFlat } from '~/data/featuresNav'

export type FeaturePinnedKind = 'feature' | 'tool'

/** 顶置一条：功能导航 or 小工具 */
export interface FeaturePinnedEntry {
  type: FeaturePinnedKind
  /** feature：导航 id；tool：tool_id 字符串 */
  id: string
}

export function pinnedEntryKey(entry: FeaturePinnedEntry): string {
  return `${entry.type}:${entry.id}`
}

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

/**
 * 兼容旧数据：`menu` 曾为纯 string[]（功能 id）。
 * 新数据：`{ type: 'feature' | 'tool', id }`；也接受 `tool:123` 前缀字符串。
 */
export function parsePinnedMenuEntry(raw: unknown): FeaturePinnedEntry | null {
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    if (s.startsWith('tool:')) {
      const id = s.slice(5).trim()
      return id ? { type: 'tool', id } : null
    }
    if (s.startsWith('feature:')) {
      const id = s.slice(8).trim()
      return id ? { type: 'feature', id } : null
    }
    return { type: 'feature', id: s }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const id = o.id != null ? String(o.id).trim() : ''
    if (!id) return null
    if (o.type === 'tool') return { type: 'tool', id }
    if (o.type === 'feature') return { type: 'feature', id }
  }
  return null
}

export function serializePinnedMenuEntry(
  entry: FeaturePinnedEntry
): { type: FeaturePinnedKind; id: string } {
  return { type: entry.type, id: entry.id }
}

/** 顶置菜单：与 `message_config.menu`、当前 `featureNavFlat` / 小工具对齐 */
export function useFeaturePinnedMenu() {
  const { user } = storeToRefs(useUserStore())

  const catalogFirstById = computed(() => {
    const m = new Map<string, FeatureNavFlatItem>()
    for (const row of featureNavFlat) {
      if (!m.has(row.id)) m.set(row.id, row)
    }
    return m
  })

  /** 规范化后的顶置列表（去重，保序） */
  const savedPinnedEntries = computed((): FeaturePinnedEntry[] => {
    const menu = parseFeatureMessageConfig(user.value).menu
    if (!Array.isArray(menu)) return []
    const seen = new Set<string>()
    const out: FeaturePinnedEntry[] = []
    for (const raw of menu) {
      const entry = parsePinnedMenuEntry(raw)
      if (!entry) continue
      if (entry.type === 'feature' && !catalogFirstById.value.has(entry.id)) {
        continue
      }
      if (entry.type === 'tool') {
        const n = Number(entry.id)
        if (!Number.isFinite(n) || n <= 0) continue
        entry.id = String(n)
      }
      const key = pinnedEntryKey(entry)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(entry)
    }
    return out
  })

  /** @deprecated 兼容旧调用：仅功能 id 字符串顺序 */
  const savedMenuRaw = computed(() =>
    savedPinnedEntries.value
      .filter((e) => e.type === 'feature')
      .map((e) => e.id)
  )

  /** 仅在「功能合集」页用于隐藏下方功能条目：仍为线上的功能顶置 id */
  const pinnedOnlineIdSet = computed(
    () =>
      new Set(
        savedPinnedEntries.value
          .filter((e) => e.type === 'feature')
          .map((e) => e.id)
      )
  )

  /** 顶置展示：功能项按目录解析（小工具需组件侧补 meta） */
  const visiblePinnedFeatureItems = computed(() => {
    const out: FeatureNavFlatItem[] = []
    for (const e of savedPinnedEntries.value) {
      if (e.type !== 'feature') continue
      const row = catalogFirstById.value.get(e.id)
      if (row) out.push(row)
    }
    return out
  })

  /** @deprecated 同 visiblePinnedFeatureItems，兼容旧名 */
  const visiblePinnedItems = visiblePinnedFeatureItems

  return {
    user,
    catalogFirstById,
    savedPinnedEntries,
    savedMenuRaw,
    pinnedOnlineIdSet,
    visiblePinnedFeatureItems,
    visiblePinnedItems
  }
}
