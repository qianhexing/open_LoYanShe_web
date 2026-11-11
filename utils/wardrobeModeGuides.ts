import type { StepGuideItem } from '@/components/Qhx/StepGuide.vue'
import {
  WARDROBE_GUIDE_FIRST_CLOTHES_ID,
  WARDROBE_GUIDE_SELECT_BAR_ID,
} from '@/utils/wardrobeGuideTargets'

/** 衣柜详情页编辑模式引导 */
export const WARDROBE_EDIT_GUIDE_STORAGE_KEY = 'loyanshe-wardrobe-edit-guide-v1'

/** 衣柜详情页搭配模式引导 */
export const WARDROBE_MATCHING_GUIDE_STORAGE_KEY = 'loyanshe-wardrobe-matching-guide-v1'

/** 衣柜详情页多选模式引导 */
export const WARDROBE_SELECT_GUIDE_STORAGE_KEY = 'loyanshe-wardrobe-select-guide-v1'

export function hasCompletedWardrobeEditGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(WARDROBE_EDIT_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function hasCompletedWardrobeMatchingGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(WARDROBE_MATCHING_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function hasCompletedWardrobeSelectGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(WARDROBE_SELECT_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

/** title/description 存 i18n key，页面侧用 t() 本地化 */
export const WARDROBE_EDIT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'edit-toolbar',
    title: 'wardrobe.guide.edit.toolbar.title',
    description: 'wardrobe.guide.edit.toolbar.desc',
    targetId: 'wardrobe-guide-tool-edit',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'edit-clothes',
    title: 'wardrobe.guide.edit.clothes.title',
    description: 'wardrobe.guide.edit.clothes.desc',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
]

export const WARDROBE_MATCHING_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'matching-toolbar',
    title: 'wardrobe.guide.matching.toolbar.title',
    description: 'wardrobe.guide.matching.toolbar.desc',
    targetId: 'wardrobe-guide-tool-matching',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'matching-clothes',
    title: 'wardrobe.guide.matching.clothes.title',
    description: 'wardrobe.guide.matching.clothes.desc',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
]

export const WARDROBE_SELECT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'select-toolbar',
    title: 'wardrobe.guide.select.toolbar.title',
    description: 'wardrobe.guide.select.toolbar.desc',
    targetId: 'wardrobe-guide-tool-select',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'select-clothes',
    title: 'wardrobe.guide.select.clothes.title',
    description: 'wardrobe.guide.select.clothes.desc',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
  {
    id: 'select-bar',
    title: 'wardrobe.guide.select.bar.title',
    description: 'wardrobe.guide.select.bar.desc',
    targetId: WARDROBE_GUIDE_SELECT_BAR_ID,
    placement: 'top',
    padding: 8,
  },
]
