import type { TeapartyState } from '@/types/api'

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
