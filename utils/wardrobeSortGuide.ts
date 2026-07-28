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

export const WARDROBE_SORT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'wardrobe-list',
    title: '长按衣柜可排序',
    description:
      '左侧衣柜列表支持长按后拖动，调整多个衣柜的显示顺序，松手后会自动保存。',
    targetId: 'wardrobe-guide-sidebar-list',
    placement: 'right',
    padding: 6,
  },
  {
    id: 'clothes-list',
    title: '长按服饰可排序',
    description:
      '排序模式下，长按第一件服饰卡片并拖动即可调整顺序；其他服饰同样支持拖动。若无法拖动，请先在衣柜设置中将排序模式改为「自定义」。',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
  {
    id: 'move-to-wardrobe',
    title: '拖拽服饰可切换衣柜',
    description:
      '排序模式下，将服饰拖到左侧其他衣柜名称上松手，即可把该服饰切换到目标衣柜。',
    targetId: 'wardrobe-guide-sidebar-list',
    placement: 'right',
    padding: 6,
  },
]
