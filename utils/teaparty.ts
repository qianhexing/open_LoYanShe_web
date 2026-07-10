import type { TeapartyState } from '@/types/api'
import dayjs from 'dayjs'

export const TEAPARTY_STATE_OPTIONS: { value: TeapartyState; label: string }[] = [
  { value: 0, label: '筹办中' },
  { value: 1, label: '预约中' },
  { value: 2, label: '已取消' },
  { value: 3, label: '已结束' }
]

export function getTeapartyStateLabel(state?: TeapartyState | null): string {
  if (state == null) return ''
  return TEAPARTY_STATE_OPTIONS.find((opt) => opt.value === state)?.label ?? ''
}

export function getTeapartyStateBadgeClass(state?: TeapartyState | null): string {
  switch (state) {
    case 0:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 1:
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 2:
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    case 3:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function parseTeapartyPrice(value?: number | string | null): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** 展示票价文案；无有效票价且非免费参与时返回 null */
export function formatTeapartyPrice(price?: number | string | null, joinWay?: number | null): string | null {
  if (joinWay === 2) return '免费'
  const num = parseTeapartyPrice(price)
  if (num === null) return null
  if (num === 0) return '免费'
  return `¥${num.toFixed(2)}`
}

/** 未开始：筹办中(0) 或 预约中(1)；排除已取消/已结束 */
export function isTeapartyNotStarted(state?: TeapartyState | number | string | null): boolean {
  if (state == null || state === '') return true
  const n = Number(state)
  if (Number.isNaN(n)) return true
  if (n === 2 || n === 3) return false
  return n === 0 || n === 1
}

/** 解析茶会时间（兼容 ISO 字符串、毫秒/秒级时间戳） */
export function parseTeapartyTime(value?: Date | string | number | null) {
  if (value == null || value === '') return null
  if (value instanceof Date) return dayjs(value)
  if (typeof value === 'number') {
    return value < 1e12 ? dayjs.unix(value) : dayjs(value)
  }
  const text = String(value).trim()
  if (/^\d{10}$/.test(text)) return dayjs.unix(Number(text))
  if (/^\d{13}$/.test(text)) return dayjs(Number(text))
  return dayjs(text)
}

export function isTeapartyOnDate(
  startTime?: Date | string | number | null,
  date?: Date | string | dayjs.Dayjs
): boolean {
  const parsed = parseTeapartyTime(startTime)
  if (!parsed?.isValid()) return false
  return parsed.isSame(dayjs(date), 'day')
}

export function formatTeapartyLocation(item: {
  province?: string | null
  city?: string | null
  area?: string | null
  address?: string | null
}): string {
  return [item.province, item.city, item.area].filter(Boolean).join(' ')
}

export function formatTeapartyFullAddress(item: {
  province?: string | null
  city?: string | null
  area?: string | null
  address?: string | null
}): string {
  return [item.province, item.city, item.area, item.address].filter(Boolean).join(' ')
}

/** 生图时间：精确到时分 */
export function formatTeapartySnapshotDateTime(value?: Date | string | number | null): string {
  const parsed = parseTeapartyTime(value)
  if (!parsed?.isValid()) return ''
  return parsed.format('MM-DD HH:mm')
}

export function getTeapartySnapshotTimeLines(item: {
  start_time?: Date | string | number | null
  end_time?: Date | string | number | null
}): { startLine: string; endLine: string } {
  const start = formatTeapartySnapshotDateTime(item.start_time)
  const end = formatTeapartySnapshotDateTime(item.end_time)
  return {
    startLine: start ? `开始 ${start}` : '',
    endLine: end ? `结束 ${end}` : ''
  }
}
