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

export const WARDROBE_EDIT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'edit-toolbar',
    title: '编辑模式',
    description:
      '已进入编辑模式。此模式下可在列表中快速修改服饰，无需进入详情页。',
    targetId: 'wardrobe-guide-tool-edit',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'edit-clothes',
    title: '点击编辑按钮',
    description:
      '第一件服饰卡片右侧会出现铅笔图标，点击即可打开编辑弹窗；其他服饰同样可点右侧按钮快速编辑。',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
]

export const WARDROBE_MATCHING_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'matching-toolbar',
    title: '搭配模式',
    description:
      '已进入搭配模式。可点选服饰加入搭配草稿，组合出整套穿搭。',
    targetId: 'wardrobe-guide-tool-matching',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'matching-clothes',
    title: '加入搭配草稿',
    description:
      '点击第一件服饰右上角的加号加入草稿；已加入的可点垃圾桶移除。其他服饰操作方式相同，完成后点击右下角悬浮按钮保存搭配。',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
]

export const WARDROBE_SELECT_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'select-toolbar',
    title: '多选模式',
    description:
      '已进入多选模式。可选中多件服饰，进行批量移动、打标签或删除。',
    targetId: 'wardrobe-guide-tool-select',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'select-clothes',
    title: '选择服饰',
    description:
      '点击第一件服饰卡片或右上角勾选框即可选中；其他服饰同样操作，选中后底部会显示批量操作栏。',
    targetId: WARDROBE_GUIDE_FIRST_CLOTHES_ID,
    placement: 'top',
    padding: 8,
  },
  {
    id: 'select-bar',
    title: '底部批量操作',
    description:
      '底部栏提供：切换衣柜（批量移动）、添加 tag、批量状态、批量排序与批量删除。需先选中至少一件服饰，部分操作才会启用。',
    targetId: WARDROBE_GUIDE_SELECT_BAR_ID,
    placement: 'top',
    padding: 8,
  },
]
