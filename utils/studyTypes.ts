/** 研习 study_type：0 学习板块 · 1 内部链接（APP 路径，有路由映射）· 2 外部链接 */
export const STUDY_TYPE_LEARNING = 0
export const STUDY_TYPE_INTERNAL = 1
export const STUDY_TYPE_EXTERNAL = 2

export const STUDY_TYPE_LABELS: Record<number, string> = {
  [STUDY_TYPE_LEARNING]: '学习板块',
  [STUDY_TYPE_INTERNAL]: '内部链接',
  [STUDY_TYPE_EXTERNAL]: '外部链接'
}

export function studyTypeLabel(t: number): string {
  return STUDY_TYPE_LABELS[t] ?? `类型(${t})`
}

/** APP 内「研习更多」路径片段（管理端树形展开：仅学习板块或此类内部链接才显示展开） */
export const STUDY_MORE_PATH_MARK = 'pages/study/studyMore'

export function studyUrlHasStudyMore(url: string | null | undefined): boolean {
  return String(url || '').includes(STUDY_MORE_PATH_MARK)
}

/**
 * 是否显示树形展开：底层无展开；学习板块(0)可展开；
 * 内部链接(1)仅当 study_url 含 studyMore 路径时可展开；外链等不展开。
 */
export function studyRowCanShowTreeExpand(row: {
  study_type: number
  study_url?: string | null
  is_bottom?: number | null
}): boolean {
  if (Number(row.is_bottom) === 1) return false
  if (row.study_type === STUDY_TYPE_LEARNING) return true
  if (row.study_type === STUDY_TYPE_INTERNAL && studyUrlHasStudyMore(row.study_url)) return true
  return false
}

export const STUDY_MAIN_TYPE_FORM_OPTIONS = [
  { label: STUDY_TYPE_LABELS[STUDY_TYPE_LEARNING], value: STUDY_TYPE_LEARNING },
  { label: STUDY_TYPE_LABELS[STUDY_TYPE_INTERNAL], value: STUDY_TYPE_INTERNAL },
  { label: STUDY_TYPE_LABELS[STUDY_TYPE_EXTERNAL], value: STUDY_TYPE_EXTERNAL }
] as const

/** APP 内路径前缀模板（仅内部链接），须与下方路由映射一致 */
export const STUDY_INTERNAL_APP_PATH_TEMPLATES: Array<{ label: string; prefix: string }> = [
  { label: '研习 · 更多列表', prefix: 'pages/study/studyMore?id=' },
  { label: '百科 · 词条详情', prefix: 'pages/wiki/wikiDetail/wikiDetail?id=' }
]

/** APP 路径 → Web 路由（与 StudyItem 跳转一致） */
export const STUDY_INTERNAL_URL_ROUTE_MAPPINGS: Array<{
  pattern: RegExp
  getRoute: (m: RegExpMatchArray) => string
}> = [
  { pattern: /pages\/study\/studyMore\?id=(\d+)/, getRoute: (m) => `/study/more/${m[1]}` },
  { pattern: /pages\/wiki\/wikiDetail\/wikiDetail\?id=(\d+)/, getRoute: (m) => `/lolitaWiki/detail/${m[1]}` }
]
