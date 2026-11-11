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
  titleKey: string
  descriptionKey: string
  storageKey: string
}

export const WARDROBE_TUTORIAL_ITEMS: WardrobeTutorialItem[] = [
  {
    id: 'overview',
    titleKey: 'wardrobe.tutorial.overview.title',
    descriptionKey: 'wardrobe.tutorial.overview.desc',
    storageKey: WARDROBE_OVERVIEW_GUIDE_STORAGE_KEY,
  },
  {
    id: 'sort',
    titleKey: 'wardrobe.tutorial.sort.title',
    descriptionKey: 'wardrobe.tutorial.sort.desc',
    storageKey: WARDROBE_SORT_GUIDE_STORAGE_KEY,
  },
  {
    id: 'edit',
    titleKey: 'wardrobe.tutorial.edit.title',
    descriptionKey: 'wardrobe.tutorial.edit.desc',
    storageKey: WARDROBE_EDIT_GUIDE_STORAGE_KEY,
  },
  {
    id: 'matching',
    titleKey: 'wardrobe.tutorial.matching.title',
    descriptionKey: 'wardrobe.tutorial.matching.desc',
    storageKey: WARDROBE_MATCHING_GUIDE_STORAGE_KEY,
  },
  {
    id: 'select',
    titleKey: 'wardrobe.tutorial.select.title',
    descriptionKey: 'wardrobe.tutorial.select.desc',
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

export function wardrobeTutorialStatusLabelKey(status: WardrobeTutorialPopupStatus): string {
  switch (status) {
    case 'disabled':
      return 'wardrobe.tutorial.status.disabled'
    case 'dismissed':
      return 'wardrobe.tutorial.status.dismissed'
    default:
      return 'wardrobe.tutorial.status.will_show'
  }
}
