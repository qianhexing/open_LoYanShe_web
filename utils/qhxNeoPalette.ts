/**
 * 拟态（Neumorphism）配色 — 单一数据源。
 * 由 stores/theme.ts 写入 :root，与 assets/css/tailwind.css 中 :root 默认值保持同步。
 */
export interface QhxNeoPalette {
  bg: string
  light: string
  dark: string
  mid: string
  text: string
  textSoft: string
  /** 页面顶部径向高光 */
  glow: string
  /** 键盘焦点环 color */
  focusRing: string
  /** 卡片描边 */
  border: string
  /** 区块分割 */
  divider: string
}

/** 浅色拟态（白底冷灰阴影，主表面为白） */
export const QHX_NEO_LIGHT: QhxNeoPalette = {
  bg: '#ffffff',
  light: '#ffffff',
  dark: '#d1d5db',
  mid: '#f3f4f6',
  text: '#111827',
  textSoft: '#6b7280',
  glow: '#ffffff',
  focusRing: 'rgba(59, 130, 246, 0.35)',
  border: 'rgba(255, 255, 255, 0.72)',
  divider: 'rgba(15, 23, 42, 0.08)'
}

/** 深色拟态 */
export const QHX_NEO_DARK: QhxNeoPalette = {
  bg: '#2a2624',
  light: '#3d3835',
  dark: '#1a1816',
  mid: '#322e2c',
  text: '#e8e3df',
  textSoft: '#b5ada8',
  glow: '#35302d',
  focusRing: 'rgba(200, 160, 150, 0.45)',
  border: 'rgba(255, 255, 255, 0.12)',
  divider: 'rgba(255, 255, 255, 0.08)'
}

export const QHX_NEO_CSS_PREFIX = '--qhx-neo-'

export function qhxNeoToCssVars(neo: QhxNeoPalette): Record<string, string> {
  return {
    [`${QHX_NEO_CSS_PREFIX}bg`]: neo.bg,
    [`${QHX_NEO_CSS_PREFIX}light`]: neo.light,
    [`${QHX_NEO_CSS_PREFIX}dark`]: neo.dark,
    [`${QHX_NEO_CSS_PREFIX}mid`]: neo.mid,
    [`${QHX_NEO_CSS_PREFIX}text`]: neo.text,
    [`${QHX_NEO_CSS_PREFIX}text-soft`]: neo.textSoft,
    [`${QHX_NEO_CSS_PREFIX}glow`]: neo.glow,
    [`${QHX_NEO_CSS_PREFIX}focus-ring`]: neo.focusRing,
    [`${QHX_NEO_CSS_PREFIX}border`]: neo.border,
    [`${QHX_NEO_CSS_PREFIX}divider`]: neo.divider
  }
}
