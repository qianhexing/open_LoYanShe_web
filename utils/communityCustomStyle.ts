/** 社区帖子自定义主题（存于 Community.custom_style JSON 对象） */
export interface CommunityCustomStyle {
  btnColor: string | null
  btnFontColor: string | null
  fontColor: string | null
  backColor: string | null
  back_mode: boolean
  back_opacity: number
  /** 背景图路径（相对 BASE_IMG） */
  background: string | null
}

export function createDefaultCommunityCustomStyle(): CommunityCustomStyle {
  return {
    btnColor: null,
    btnFontColor: null,
    fontColor: null,
    backColor: null,
    back_mode: false,
    back_opacity: 1,
    background: null
  }
}

/** 从 API 返回的 custom_style（对象或 JSON 字符串）解析为表单结构 */
export function parseCommunityCustomStyle(
  raw: Record<string, unknown> | string | null | undefined
): CommunityCustomStyle {
  const defaults = createDefaultCommunityCustomStyle()
  if (raw == null) return defaults

  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return defaults
    }
  } else {
    obj = raw
  }

  return {
    btnColor: typeof obj.btnColor === 'string' ? obj.btnColor : null,
    btnFontColor: typeof obj.btnFontColor === 'string' ? obj.btnFontColor : null,
    fontColor: typeof obj.fontColor === 'string' ? obj.fontColor : null,
    backColor: typeof obj.backColor === 'string' ? obj.backColor : null,
    back_mode: typeof obj.back_mode === 'boolean' ? obj.back_mode : defaults.back_mode,
    back_opacity:
      typeof obj.back_opacity === 'number' && Number.isFinite(obj.back_opacity)
        ? obj.back_opacity
        : defaults.back_opacity,
    background: typeof obj.background === 'string' ? obj.background : null
  }
}

/** 提交前格式化为 JSON 对象（与衣柜 custom_style 字段结构一致） */
export function serializeCommunityCustomStyle(
  style: CommunityCustomStyle
): Record<string, unknown> {
  return {
    btnColor: style.btnColor,
    btnFontColor: style.btnFontColor,
    fontColor: style.fontColor,
    backColor: style.backColor,
    back_mode: style.back_mode,
    back_opacity: style.back_opacity,
    background: style.background
  }
}

/** 是否配置了任意自定义主题项 */
export function hasCommunityCustomStyle(style: CommunityCustomStyle): boolean {
  return !!(
    style.btnColor ||
    style.btnFontColor ||
    style.fontColor ||
    style.backColor ||
    style.background ||
    style.back_opacity !== 1 ||
    style.back_mode
  )
}
