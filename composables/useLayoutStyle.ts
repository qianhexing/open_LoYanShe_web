/** 0：带顶栏与底栏；1：空白（无 Header/Footer 等） */
export type LayoutStyle = 0 | 1

const LAYOUT_STYLE_KEY = 'layout-style'

export function useLayoutStyle() {
  const layoutStyle = useState<LayoutStyle>(LAYOUT_STYLE_KEY, () => 0)

  function setLayoutStyle(style: LayoutStyle) {
    layoutStyle.value = style
  }

  return { layoutStyle, setLayoutStyle }
}
