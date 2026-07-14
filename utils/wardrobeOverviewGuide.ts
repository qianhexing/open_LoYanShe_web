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

export const WARDROBE_OVERVIEW_GUIDE_STEPS: StepGuideItem[] = [
  {
    id: 'welcome',
    title: '欢迎使用衣柜',
    description:
      '这里是你的 Lolita 衣柜空间。创建衣柜后，通过「添加」和「批量添加」录入服饰是最核心的操作；接下来也会介绍排序、搭配等常用功能。',
    placement: 'center',
  },
  {
    id: 'add-wardrobe',
    title: '新建衣柜',
    description:
      '点击左侧「新建衣柜」，可创建新的衣柜分类，用来收纳不同系列、场景或主题的服饰。',
    targetId: 'wardrobe-guide-add-wardrobe',
    placement: 'right',
    padding: 6,
  },
  {
    id: 'add-clothes-focus',
    title: '重点：添加与批量添加',
    description:
      '录入服饰是衣柜最核心的操作「添加」适合逐件录入「批量添加」适合一次录入多件，购入新裙后可快速入库。',
    targetId: WARDROBE_GUIDE_ADD_TOOLS_ID,
    placement: 'bottom',
    padding: 10,
  },
  {
    id: 'sort',
    title: '排序',
    description:
      '点击「排序」进入排序模式，可调整衣柜与服饰的显示顺序。首次使用还会有更详细的拖拽引导。',
    targetId: 'wardrobe-guide-tool-sort',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'edit',
    title: '编辑模式',
    description:
      '点击「编辑模式」后，服饰卡片会出现编辑入口，可快速修改名称、状态、标签等信息。',
    targetId: 'wardrobe-guide-tool-edit',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'matching',
    title: '搭配模式',
    description:
      '点击「搭配模式」后，点选服饰右上角的加号即可加入搭配草稿，方便组合出整套穿搭。',
    targetId: 'wardrobe-guide-tool-matching',
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'more-tools',
    title: '更多实用功能',
    description:
      '工具栏还提供多选批量操作、筛选查找、布局设置等，帮助你更高效地管理衣柜。',
    targetId: 'wardrobe-guide-main-toolbar',
    placement: 'bottom',
    padding: 8,
  },
  {
    id: 'header-detail',
    title: '展开衣柜详情',
    description:
      '点击顶部此按钮可展开或收起衣柜详情区，查看名称、描述、总价等信息；收起后可为服饰列表留出更多浏览空间。',
    targetId: WARDROBE_GUIDE_HEADER_TOGGLE_ID,
    placement: 'bottom',
    padding: 6,
  },
  {
    id: 'tutorial-button',
    title: '教程入口',
    description:
      '右侧「教程」按钮可随时打开教程设置：查看各功能引导、控制是否自动弹出，或为单项教程开启「不再提示」。',
    targetId: 'wardrobe-guide-tool-tutorial',
    placement: 'left',
    padding: 6,
  },
]
