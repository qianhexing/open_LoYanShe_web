/** 与 data/featuresNav.ts 中的数组数据结构一致 */

export type FeatureNavTone =
  | 'pink'
  | 'purple'
  | 'rose'
  | 'teal'
  | 'blue'
  | 'green'
  | 'orange'
  | 'yellow'
  | 'indigo'
  | 'cyan'

export type FeatureNavUniStrategy = 'router' | 'outer' | 'native'

export type FeatureNavHarmonyStrategy = 'outlink' | 'jump'

/**
 * UniApp WebView（Html5Plus）内跳转策略
 * - router：与 H5 同源，router.push(web path)
 * - outer：打开包装页 `/pages/common/outerLink?url=` +（默认 siteOrigin+path，或由 outerUrl 指定）
 * - native：uni.navigateTo({ url })，需填 url（可含 {userId}）
 */
export interface FeatureNavUniApp {
  strategy: FeatureNavUniStrategy
  /** strategy 为 native 时必填，如 /pages/userSpace/userSpace?id={userId} */
  url?: string
  /**
   * strategy 为 outer 时可选；不填则用 siteOrigin + 解析后的 path。
   * 可写完整 https 地址，支持 {userId}
   */
  outerUrl?: string
}

/**
 * 鸿蒙 WebView（MessagePort）跳转
 * - outlink：type jump + path Outlink + url（默认 siteOrigin+path，或由 url 指定完整链）
 * - jump：type jump + 原生 path + params（与壳约定一致）
 */
export interface FeatureNavHarmony {
  strategy: FeatureNavHarmonyStrategy
  /** strategy 为 jump 时：壳侧页面名，如 UserSpace、LibraryDetail */
  path?: string
  /** jump 参数，值可含 {userId}；纯数字 id 会转为 number */
  params?: Record<string, string>
  /**
   * strategy 为 outlink 时可选；不填则用 siteOrigin + 解析后的 path。
   * 可写完整 https 地址，支持 {userId}
   */
  url?: string
}

export interface FeatureNavItem {
  id: string
  title: string
  desc: string
  tone: FeatureNavTone
  icon: string
  /**
   * Web 路径，以 / 开头。需要用户 id 时用占位符 {userId}
   */
  path: string
  /** requiresUserId 为 true 且未登录时跳转此路径，默认 /register */
  fallbackPath?: string
  requiresUserId?: boolean
  /** 网页端是否新标签打开（默认 false，走 router.push） */
  openNewTab?: boolean
  /** UniApp；缺省 strategy=outer，无 url */
  uniapp?: FeatureNavUniApp
  /** 鸿蒙；缺省 strategy=outlink */
  harmony?: FeatureNavHarmony
}

/** 平面一条：在原条目上多加 sectionTitle，同一 title 归为同一板块（顺序即出现顺序） */
export type FeatureNavFlatItem = FeatureNavItem & {
  sectionTitle: string
}

export interface FeatureNavSection {
  id: string
  title: string
  items: FeatureNavItem[]
}

export interface FeaturesNavManifest {
  /** 用于 Uni outerLink、鸿蒙 Outlink、合成绝对地址 */
  siteOrigin: string
  intro: {
    title: string
    subtitle: string
  }
  sections: FeatureNavSection[]
}
