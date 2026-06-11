import type { Community } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  communityBackgroundImageCss,
  hasCommunityCustomStyle,
  parseCommunityCustomStyle,
  type CommunityBackgroundMode,
} from '@/utils/communityCustomStyle'

/** 详情页展示用主题（与衣柜 detail 的 customStyle 结构对齐） */
export type CommunityDetailThemeStyle = {
  background: string
  btnColor?: string
  backColor?: string
  back_mode?: CommunityBackgroundMode
  fontColor?: string
  back_opacity?: number
  btnFontColor?: string
}

function hexToRgba(color: string, opacity: number) {
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/** 社区帖子详情：从 detail.custom_style 解析页面背景、文字色与按钮色 */
export function useCommunityDetailTheme(detail: Ref<Community | null>) {
  const customStyle = computed((): CommunityDetailThemeStyle | null => {
    const parsed = parseCommunityCustomStyle(detail.value?.custom_style)
    if (!hasCommunityCustomStyle(parsed)) return null

    const back = parsed.backColor || '#ffffff'
    const opacity = parsed.back_opacity ?? 1
    const colorLayer = hexToRgba(back, opacity)
    const background = parsed.background
      ? `linear-gradient(${colorLayer}, ${colorLayer}), url(${BASE_IMG + parsed.background}) ${communityBackgroundImageCss(parsed.back_mode)}`
      : colorLayer

    return {
      background,
      btnColor: parsed.btnColor || undefined,
      backColor: parsed.backColor || undefined,
      back_mode: parsed.back_mode,
      fontColor: parsed.fontColor || undefined,
      back_opacity: parsed.back_opacity,
      btnFontColor: parsed.btnFontColor || undefined,
    }
  })

  const customBtnStyle = computed(() => {
    if (!customStyle.value) return {}
    const s: Record<string, string> = {}
    if (customStyle.value.btnColor) s.backgroundColor = customStyle.value.btnColor
    if (customStyle.value.btnFontColor) s.color = customStyle.value.btnFontColor
    return s
  })

  const hasCustomBtnBg = computed(() => Boolean(customStyle.value?.btnColor))
  const hasCustomBtnFont = computed(() => Boolean(customStyle.value?.btnFontColor))
  const hasAnyCustomBtnTheme = computed(
    () => hasCustomBtnBg.value || hasCustomBtnFont.value
  )

  const pageBackgroundStyle = computed(() => ({
    background: customStyle.value?.background,
    backgroundPosition: 'center',
  }))

  const pageContentStyle = computed(() => ({
    color: customStyle.value?.fontColor || 'inherit',
  }))

  return {
    customStyle,
    customBtnStyle,
    hasCustomBtnBg,
    hasCustomBtnFont,
    hasAnyCustomBtnTheme,
    pageBackgroundStyle,
    pageContentStyle,
  }
}
