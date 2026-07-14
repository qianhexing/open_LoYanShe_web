import { WARDROBE_SORT_GUIDE_STORAGE_KEY } from '@/utils/wardrobeSortGuide'
import { WARDROBE_OVERVIEW_GUIDE_STORAGE_KEY } from '@/utils/wardrobeOverviewGuide'
import {
  WARDROBE_EDIT_GUIDE_STORAGE_KEY,
  WARDROBE_MATCHING_GUIDE_STORAGE_KEY,
  WARDROBE_SELECT_GUIDE_STORAGE_KEY,
} from '@/utils/wardrobeModeGuides'

/** message_config 中衣柜弹窗教程总开关 */
export const WARDROBE_TUTORIAL_POPUP_KEY = 'wardrobe_tutorial_popup'

export type WardrobeTutorialId = 'overview' | 'sort' | 'edit' | 'matching' | 'select'

export type WardrobeTutorialPopupStatus = 'disabled' | 'will_show' | 'dismissed'

export interface WardrobeTutorialItem {
  id: WardrobeTutorialId
  title: string
  description: string
  storageKey: string
}

export const WARDROBE_TUTORIAL_ITEMS: WardrobeTutorialItem[] = [
  {
    id: 'overview',
    title: '整体简介',
    description: '衣柜常用功能一览与上手引导',
    storageKey: WARDROBE_OVERVIEW_GUIDE_STORAGE_KEY,
  },
  {
    id: 'sort',
    title: '排序',
    description: '长按衣柜列表与服饰卡片可调整显示顺序',
    storageKey: WARDROBE_SORT_GUIDE_STORAGE_KEY,
  },
  {
    id: 'edit',
    title: '编辑模式',
    description: '在列表中快速修改服饰信息',
    storageKey: WARDROBE_EDIT_GUIDE_STORAGE_KEY,
  },
  {
    id: 'matching',
    title: '搭配模式',
    description: '点选服饰加入搭配草稿并保存搭配',
    storageKey: WARDROBE_MATCHING_GUIDE_STORAGE_KEY,
  },
  {
    id: 'select',
    title: '多选模式',
    description: '批量选中服饰进行移动、打标签或删除',
    storageKey: WARDROBE_SELECT_GUIDE_STORAGE_KEY,
  },
]

export function hasWardrobeTutorialPopupConfig(
  messageConfig?: Record<string, unknown> | null,
): boolean {
  if (!messageConfig || typeof messageConfig !== 'object') return false
  return WARDROBE_TUTORIAL_POPUP_KEY in messageConfig
}

export function isWardrobeTutorialPopupEnabled(
  messageConfig?: Record<string, unknown> | null,
): boolean {
  if (!hasWardrobeTutorialPopupConfig(messageConfig)) return false
  return (messageConfig as Record<string, unknown>)[WARDROBE_TUTORIAL_POPUP_KEY] !== false
}

export function hasDismissedWardrobeTutorial(storageKey: string): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return true
  }
}

export function getWardrobeTutorialPopupStatus(
  id: WardrobeTutorialId,
  globalEnabled: boolean,
): WardrobeTutorialPopupStatus {
  if (!globalEnabled) return 'disabled'
  const item = WARDROBE_TUTORIAL_ITEMS.find((t) => t.id === id)
  if (!item) return 'will_show'
  return hasDismissedWardrobeTutorial(item.storageKey) ? 'dismissed' : 'will_show'
}

export function clearWardrobeTutorialCaches() {
  if (!import.meta.client) return
  for (const item of WARDROBE_TUTORIAL_ITEMS) {
    try {
      localStorage.removeItem(item.storageKey)
    } catch {
      /* ignore */
    }
  }
}

export function setWardrobeTutorialDismissed(storageKey: string, dismissed: boolean) {
  if (!import.meta.client) return
  try {
    if (dismissed) {
      localStorage.setItem(storageKey, '1')
    } else {
      localStorage.removeItem(storageKey)
    }
  } catch {
    /* ignore */
  }
}

export function wardrobeTutorialStatusLabel(status: WardrobeTutorialPopupStatus): string {
  switch (status) {
    case 'disabled':
      return '已关闭'
    case 'dismissed':
      return '不再提示'
    default:
      return '将弹出'
  }
}
