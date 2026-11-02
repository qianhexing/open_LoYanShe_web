/** 改名费用（经验） */
export const RENAME_EXP_COST = 100

/** 昵称：1–6 字，仅中文 / 英文 / 数字 */
const USER_NAME_PATTERN = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/

/** 将 former_name（逗号分隔）解析为曾用名列表 */
export function parseFormerNames(formerName: string | null | undefined): string[] {
  if (!formerName?.trim()) return []
  return formerName
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

/** 展示文案：曾用名：A / B */
export function formatFormerNamesLabel(formerName: string | null | undefined): string {
  const names = parseFormerNames(formerName)
  if (!names.length) return ''
  return `曾用名：${names.join(' / ')}`
}

/** 本地校验昵称格式；通过返回 null，失败返回提示文案 */
export function validateUserNameFormat(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '昵称不能为空'
  if (trimmed.length < 1 || trimmed.length > 6) return '昵称必须1-6个字'
  if (!USER_NAME_PATTERN.test(trimmed)) return '不可有特殊字符'
  return null
}

/** 将旧昵称追加到 former_name（逗号分隔，去重） */
export function appendFormerName(
  formerName: string | null | undefined,
  oldName: string | null | undefined
): string {
  const list = parseFormerNames(formerName)
  const old = oldName?.trim()
  if (old && !list.includes(old)) {
    list.push(old)
  }
  return list.join(',')
}
