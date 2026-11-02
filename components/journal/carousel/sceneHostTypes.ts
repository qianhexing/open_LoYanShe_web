import type { InjectionKey, Ref } from 'vue'

/** 相对 stage 的宿主布局（px） */
export type JournalCarouselSceneLayout = {
  top: number
  left: number
  width: number
  height: number
}

/**
 * 轮播内 TypeScene 与父级单 WebGL 宿主的信令。
 * 画布不在 slide 内，避免 virtual-window 卸载拆掉 context。
 */
export type JournalCarouselSceneHostApi = {
  /** 当前是否处于「操作场景」（封面隐藏）；父级「恢复滑动」会写 false */
  cardInteractive: Ref<boolean>
  /** 当前页进入场景卡（仅登记，不立刻 load 模型） */
  enter: (sceneId: number, slotEl: HTMLElement) => void
  /** 离开场景卡：clear 内容并隐藏宿主 */
  leave: (sceneId: number) => void
  /** 「操作场景」：对齐占位、显示宿主并 load */
  interact: (sceneId: number, slotEl: HTMLElement) => void
  /** 「恢复滑动」：隐藏宿主，同卡保留已加载内容 */
  idle: () => void
}

export const journalCarouselSceneHostKey: InjectionKey<JournalCarouselSceneHostApi> =
  Symbol('journalCarouselSceneHost')
