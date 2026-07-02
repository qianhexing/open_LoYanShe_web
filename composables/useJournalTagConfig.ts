import type { User } from '@/types/api'
import { parseFeatureMessageConfig } from '@/composables/useFeaturePinnedMenu'

/** message_config 中手账自定义标签列表的键名 */
export const JOURNAL_TAGS_CONFIG_KEY = 'journal_tags'

/** 筛选「签到」时匹配 pk_type=0 的手账 */
export const JOURNAL_SIGN_IN_FILTER_TAG = '签到'

/** 手账标签默认快捷选项 */
export const JOURNAL_DEFAULT_TAGS = [
  'OOTD',
  '通勤日记',
  JOURNAL_SIGN_IN_FILTER_TAG
] as const

export function getJournalCustomTagsFromUser(user: User | null | undefined): string[] {
  const raw = parseFeatureMessageConfig(user ?? null)[JOURNAL_TAGS_CONFIG_KEY]
  if (!Array.isArray(raw)) return []
  return raw.map(String).map((t) => t.trim()).filter(Boolean)
}

export function mergeJournalTagOptions(defaults: readonly string[], custom: string[]): string[] {
  const set = new Set<string>(defaults)
  const extras = custom.filter((t) => t && !set.has(t))
  return [...defaults, ...extras.sort((a, b) => a.localeCompare(b, 'zh-CN'))]
}

export function isJournalDefaultTag(tag: string): boolean {
  return (JOURNAL_DEFAULT_TAGS as readonly string[]).includes(tag)
}
