/** 衣橱详情页左上角侧栏工具：展示位置 */
export type WardrobeToolbarPlacement = 'sidebar' | 'more'

export type WardrobeToolbarToolId =
  | 'addWardrobe'
  | 'search'
  | 'timeline'
  | 'statistics'
  | 'galaxy'
  | 'matchingList'
  | 'plan'
  | 'browse'

export interface WardrobeToolbarToolMeta {
  id: WardrobeToolbarToolId
  label: string
  icon: string
  defaultPlacement: WardrobeToolbarPlacement
  /** 固定位置，布局设置中不可调整 */
  placementLocked?: boolean
  /** 「更多」菜单副标题 */
  moreDescription?: string
  /** 「更多」菜单图标渐变（Tailwind from/to） */
  moreIconBgClass?: string
}

export interface WardrobeToolbarPrefs {
  order: WardrobeToolbarToolId[]
  placements: Record<WardrobeToolbarToolId, WardrobeToolbarPlacement>
}

/**
 * 工具栏目录：新增功能时在此追加一项即可，
 * 默认顺序、位置与配置 UI 会自动生效。
 */
export const WARDROBE_TOOLBAR_TOOLS: WardrobeToolbarToolMeta[] = [
  {
    id: 'addWardrobe',
    label: '新建衣柜',
    icon: 'material-symbols:add-2',
    defaultPlacement: 'sidebar',
    placementLocked: true,
  },
  {
    id: 'search',
    label: '搜索',
    icon: 'i-heroicons-magnifying-glass',
    defaultPlacement: 'sidebar',
  },
  {
    id: 'timeline',
    label: '时间轴',
    icon: 'material-symbols:view-timeline',
    defaultPlacement: 'sidebar',
  },
  {
    id: 'statistics',
    label: '统计',
    icon: 'material-symbols:bar-chart-4-bars',
    defaultPlacement: 'sidebar',
  },
  {
    id: 'galaxy',
    label: '星系',
    icon: 'material-symbols:auto-awesome',
    defaultPlacement: 'more',
    moreDescription: '查看衣柜可视化',
    moreIconBgClass: 'from-purple-500 to-pink-500',
  },
  {
    id: 'matchingList',
    label: '搭配清单',
    icon: 'material-symbols:style',
    defaultPlacement: 'more',
    moreDescription: '查看我的所有搭配',
    moreIconBgClass: 'from-amber-500 to-orange-500',
  },
  {
    id: 'plan',
    label: '定制计划',
    icon: 'material-symbols:calendar-month',
    defaultPlacement: 'more',
    moreDescription: '查看攒钱计划列表',
    moreIconBgClass: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'browse',
    label: '逛逛',
    icon: 'material-symbols:travel-explore',
    defaultPlacement: 'more',
    moreDescription: '随机翻看公开衣柜',
    moreIconBgClass: 'from-sky-500 to-indigo-500',
  },
]

export const WARDROBE_TOOLBAR_PREFS_KEY = 'wardrobe-detail-toolbar-prefs'
/** @deprecated 仅用于从旧版迁移 */
export const WARDROBE_TOOLBAR_PLACEMENT_KEY = 'wardrobe-detail-toolbar-placement'

const toolById = new Map(
  WARDROBE_TOOLBAR_TOOLS.map((tool) => [tool.id, tool]),
)

const defaultOrder = WARDROBE_TOOLBAR_TOOLS.map((tool) => tool.id)

export function getWardrobeToolbarTool(id: WardrobeToolbarToolId): WardrobeToolbarToolMeta | undefined {
  return toolById.get(id)
}

export function getDefaultToolbarPlacements(): Record<WardrobeToolbarToolId, WardrobeToolbarPlacement> {
  const out = {} as Record<WardrobeToolbarToolId, WardrobeToolbarPlacement>
  for (const tool of WARDROBE_TOOLBAR_TOOLS) {
    out[tool.id] = tool.defaultPlacement
  }
  return out
}

export function getDefaultToolbarOrder(): WardrobeToolbarToolId[] {
  return [...defaultOrder]
}

export function getDefaultToolbarPrefs(): WardrobeToolbarPrefs {
  return {
    order: getDefaultToolbarOrder(),
    placements: getDefaultToolbarPlacements(),
  }
}

export function resolveToolbarOrder(
  stored: WardrobeToolbarToolId[] | null | undefined,
): WardrobeToolbarToolId[] {
  if (!stored?.length) return getDefaultToolbarOrder()

  const validIds = new Set(defaultOrder)
  const seen = new Set<WardrobeToolbarToolId>()
  const out: WardrobeToolbarToolId[] = []

  for (const id of stored) {
    if (!validIds.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) out.push(id)
  }
  return out
}

export function resolveToolbarPlacements(
  stored: Partial<Record<WardrobeToolbarToolId, WardrobeToolbarPlacement>> | null | undefined,
): Record<WardrobeToolbarToolId, WardrobeToolbarPlacement> {
  const defaults = getDefaultToolbarPlacements()
  if (!stored) return defaults

  const out = { ...defaults }
  for (const tool of WARDROBE_TOOLBAR_TOOLS) {
    const saved = stored[tool.id]
    if (saved !== 'sidebar' && saved !== 'more') continue
    if (tool.placementLocked && saved !== tool.defaultPlacement) continue
    out[tool.id] = saved
  }
  return out
}

export function resolveToolbarPrefs(
  stored: Partial<WardrobeToolbarPrefs> | null | undefined,
): WardrobeToolbarPrefs {
  return {
    order: resolveToolbarOrder(stored?.order),
    placements: resolveToolbarPlacements(stored?.placements),
  }
}

export function sortToolbarToolsByOrder(
  tools: WardrobeToolbarToolMeta[],
  order: WardrobeToolbarToolId[],
): WardrobeToolbarToolMeta[] {
  const indexMap = new Map(order.map((id, index) => [id, index]))
  return [...tools].sort(
    (a, b) => (indexMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (indexMap.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
}

export function readToolbarPrefs(): WardrobeToolbarPrefs {
  if (!import.meta.client || typeof localStorage === 'undefined') {
    return getDefaultToolbarPrefs()
  }
  try {
    const raw = localStorage.getItem(WARDROBE_TOOLBAR_PREFS_KEY)
    if (raw) {
      return resolveToolbarPrefs(JSON.parse(raw) as Partial<WardrobeToolbarPrefs>)
    }

    const legacyRaw = localStorage.getItem(WARDROBE_TOOLBAR_PLACEMENT_KEY)
    if (legacyRaw) {
      const legacyPlacements = JSON.parse(legacyRaw) as Partial<
        Record<WardrobeToolbarToolId, WardrobeToolbarPlacement>
      >
      return resolveToolbarPrefs({ placements: resolveToolbarPlacements(legacyPlacements) })
    }

    return getDefaultToolbarPrefs()
  } catch {
    return getDefaultToolbarPrefs()
  }
}

export function persistToolbarPrefs(prefs: WardrobeToolbarPrefs) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WARDROBE_TOOLBAR_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* 忽略写入失败 */
  }
}

/** 布局设置中可调整位置的工具 */
export function getConfigurableToolbarTools(): WardrobeToolbarToolMeta[] {
  return WARDROBE_TOOLBAR_TOOLS.filter((tool) => !tool.placementLocked)
}
