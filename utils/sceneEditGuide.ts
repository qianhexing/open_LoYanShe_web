/** 场景编辑页步骤引导：localStorage 标记，完成或跳过后不再展示 */
export const SCENE_EDIT_GUIDE_STORAGE_KEY = 'loyanshe-scene-edit-guide-v1'

export function hasCompletedSceneEditGuide(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(SCENE_EDIT_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markSceneEditGuideCompleted(): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(SCENE_EDIT_GUIDE_STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export type SceneEditGuideStepId =
  | 'welcome'
  | 'left-toolbar'
  | 'role-panel'
  | 'texture-panel'
  | 'right-panels'
  | 'canvas'
  | 'camera-view'

/** 引导时需单独展开的侧栏（先全收再展开该项） */
export type SceneEditGuidePanelKey =
  | 'role'
  | 'texture'
  | 'material'
  | 'clothing'
  | 'scene'
  | 'effect'
  | 'template'
  | 'custom'

/** 进入某一步时对功能栏列表的布局要求 */
export type SceneEditGuideStepLayout = {
  /** 收起左侧角色/贴图与右侧素材等所有展开列表，仅保留标签条便于高亮 */
  collapseAllLists?: boolean
  /**
   * 与 collapseAllLists 配合：同时收起左侧主工具栏（保存/图片等竖条）
   * 默认 true；left-toolbar 步请设 expandToolbar 而非关闭此项
   */
  collapseToolbar?: boolean
  /** 展开左侧主工具栏 */
  expandToolbar?: boolean
  /** 在 collapseAllLists 之后展开指定列表（如演示列表内容） */
  expandPanel?: SceneEditGuidePanelKey
}

export type SceneEditGuideStep = {
  id: SceneEditGuideStepId
  title: string
  description: string
  /** 页面元素 id，通过 getElementById 定位；无则居中 */
  targetId?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  layout?: SceneEditGuideStepLayout
}

export const SCENE_EDIT_GUIDE_STEPS: SceneEditGuideStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用场景编辑器',
    description:
      '这里可以搭建 3D 手账场景：添加素材、调整灯光与镜头，并保存分享。接下来会简要介绍各功能区域的位置与用法。',
    placement: 'center',
    layout: { collapseAllLists: true }
  },
  {
    id: 'left-toolbar',
    title: '左侧工具栏',
    targetId: 'scene-guide-left-toolbar',
    placement: 'right',
    description:
      '保存、撤销，以及添加图片、点位、文本、灯光等。点击顶部齿轮可展开/收起；编辑时建议保持展开以便快速操作。',
    layout: { collapseAllLists: true, expandToolbar: true }
  },
  {
    id: 'role-panel',
    title: '角色动画',
    targetId: 'scene-guide-role-panel',
    placement: 'right',
    description:
      '场景中的 glTF 角色会出现在此面板。展开后可点选动画片段预览骨骼动作；也可通过工具栏「角色示例」加载演示模型。',
    layout: { collapseAllLists: true }
  },
  {
    id: 'texture-panel',
    title: '贴图 / 视频替换',
    targetId: 'scene-guide-texture-panel',
    placement: 'right',
    description:
      '列出名称含 replace 的可替换网格。选中一项即可打开贴图/视频编辑器，可更换图片或视频贴图；也可在画布中选中物体后，通过底部操作条进入。',
    layout: { collapseAllLists: true }
  },
  {
    id: 'right-panels',
    title: '右侧素材库',
    targetId: 'scene-guide-right-material',
    placement: 'left',
    description:
      '右侧「素材」已合并素材、服饰与场景，展开后可筛选类型；另有特效、模版、自定义等。点选条目即可加入场景。',
    layout: { collapseAllLists: true }
  },
  {
    id: 'canvas',
    title: '画布与物体操作',
    targetId: 'scene',
    placement: 'top',
    description:
      '在画布中点击可选中物体，底部会出现移动、旋转、缩放等操作。快捷键：G 移动、R 旋转、S 缩放；支持关联、动效、复制与删除。',
    layout: { collapseAllLists: true }
  },
  {
    id: 'camera-view',
    title: '镜头与视角',
    targetId: 'scene-guide-camera-list',
    placement: 'left',
    description:
      '顶部切换条：有场景分组时优先显示分组；无分组且有已保存镜头时显示镜头列表（样式相同，超出可横向滚动）。工具栏「记录镜头」可保存当前视角。',
    layout: { collapseAllLists: true }
  }
]
