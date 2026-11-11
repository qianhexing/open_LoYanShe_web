import type { StepGuideItem } from '@/components/Qhx/StepGuide.vue'
import { WARDROBE_GUIDE_FIRST_CLOTHES_ID } from '@/utils/wardrobeGuideTargets'

/** 衣柜详情页排序模式步骤引导：仅「不再提示」时写入 localStorage */
export const WARDROBE_SORT_GUIDE_STORAGE_KEY = 'loyanshe-wardrobe-sort-guide-v2'

export function hasCompletedWardrobeSortGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(WARDROBE_SORT_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

/** title/description 存 i18n key，页面侧用 t() 本地化 */
export const WARDROBE_SORT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'wardrobe-list',
    title: 'wardrobe.guide.sort.list.title',
    description: 'wardrobe.guide.sort.list.desc',
    targetId: 'wardrobe-guide-sidebar-list',
    placement: 'right',
    padding: 6,
  },
  {
    id: 'clothes-list',
    title: 'wardrobe.guide.sort.clothes.title',
    description: 'wardrobe.guide.sort.clothes.desc',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
  {
    id: 'move-to-wardrobe',
    title: 'wardrobe.guide.sort.move.title',
    description: 'wardrobe.guide.sort.move.desc',
    targetId: 'wardrobe-guide-sidebar-list',
    placement: 'right',
    padding: 6,
  },
]
