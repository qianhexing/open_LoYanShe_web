import type { StepGuideItem } from '@/components/Qhx/StepGuide.vue'

/** 衣柜详情页整体功能简介引导 */
export const WARDROBE_OVERVIEW_GUIDE_STORAGE_KEY = 'loyanshe-wardrobe-overview-guide-v1'

export function hasCompletedWardrobeOverviewGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(WARDROBE_OVERVIEW_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

/** 引导高亮：顶部展开/收起衣柜详情按钮 */
export const WARDROBE_GUIDE_HEADER_TOGGLE_ID = 'wardrobe-guide-header-toggle'

/** 引导高亮：添加 + 批量添加入口 */
export const WARDROBE_GUIDE_ADD_TOOLS_ID = 'wardrobe-guide-add-tools'

/** title/description 存 i18n key，页面侧用 t() 本地化 */
export const WARDROBE_OVERVIEW_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'welcome',
    title: 'wardrobe.guide.overview.welcome.title',
    description: 'wardrobe.guide.overview.welcome.desc',
    placement: 'center',
  },
  {
    id: 'add-wardrobe',
    title: 'wardrobe.guide.overview.add_wardrobe.title',
    description: 'wardrobe.guide.overview.add_wardrobe.desc',
    targetId: 'wardrobe-guide-add-wardrobe',
    placement: 'right',
    padding: 6,
  },
  {
    id: 'add-clothes-focus',
    title: 'wardrobe.guide.overview.add_clothes.title',
    description: 'wardrobe.guide.overview.add_clothes.desc',
    targetId: WARDROBE_GUIDE_ADD_TOOLS_ID,
    placement: 'bottom',
    padding: 10,
  },
  {
    id: 'sort',
    title: 'wardrobe.guide.overview.sort.title',
    description: 'wardrobe.guide.overview.sort.desc',
    targetId: 'wardrobe-guide-tool-sort',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'edit',
    title: 'wardrobe.guide.overview.edit.title',
    description: 'wardrobe.guide.overview.edit.desc',
    targetId: 'wardrobe-guide-tool-edit',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'matching',
    title: 'wardrobe.guide.overview.matching.title',
    description: 'wardrobe.guide.overview.matching.desc',
    targetId: 'wardrobe-guide-tool-matching',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'more-tools',
    title: 'wardrobe.guide.overview.more.title',
    description: 'wardrobe.guide.overview.more.desc',
    targetId: 'wardrobe-guide-main-toolbar',
    placement: 'bottom',
    padding: 8,
  },
  {
    id: 'header-detail',
    title: 'wardrobe.guide.overview.header.title',
    description: 'wardrobe.guide.overview.header.desc',
    targetId: WARDROBE_GUIDE_HEADER_TOGGLE_ID,
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'tutorial-button',
    title: 'wardrobe.guide.overview.tutorial.title',
    description: 'wardrobe.guide.overview.tutorial.desc',
    targetId: 'wardrobe-guide-tool-tutorial',
    placement: 'left',
    padding: 6,
  },
]
