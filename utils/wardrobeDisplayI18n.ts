/** Display helpers for wardrobe enums stored as Chinese in DB.
 * 用户输入/配置内容（状态、季节、部位等）不走多语言，原样展示。
 */

type TFunc = (key: string, params?: Record<string, unknown>) => string

export function wardrobeStatusLabel(_t: TFunc, value: string | null | undefined): string {
  if (!value) return ''
  return value
}

export function wardrobeSeasonLabel(_t: TFunc, value: string | null | undefined): string {
  if (!value) return ''
  return value
}

export function wardrobePartLabel(_t: TFunc, value: string | null | undefined): string {
  if (!value) return ''
  return value
}

export function wardrobeStatusOptions(_t: TFunc) {
  return [
    { value: '已拥有', label: '已拥有' },
    { value: '待补款', label: '待补款' },
    { value: '已出', label: '已出' },
  ]
}

export function wardrobeSeasonOptions(_t: TFunc) {
  return [
    { value: '春', label: '春' },
    { value: '夏', label: '夏' },
    { value: '秋', label: '秋' },
    { value: '冬', label: '冬' },
  ]
}

/** Keep value/label as API Chinese; filter out 自定义. */
export function mapConfigStatusOptions(_t: TFunc, statuses: string[]) {
  return statuses
    .filter((status) => status !== '自定义')
    .map((status) => ({
      value: status,
      label: status,
    }))
}
