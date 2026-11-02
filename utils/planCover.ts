/** 定尾计划封面：后端以逗号分隔多张相对路径 */

export const PLAN_COVER_MAX = 9
export const PLAN_COVER_DEFAULT = 'static/plan_cover/default.jpg'

/** 拆分 plan_cover 为相对路径列表（兼容中英文逗号） */
export function parsePlanCoverPaths(raw?: string | null, max = PLAN_COVER_MAX): string[] {
  if (!raw) return []
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
}

/** 拼接为后端存储的逗号串 */
export function joinPlanCoverPaths(paths: string[]): string {
  return paths.map((p) => p.trim()).filter(Boolean).join(',')
}

/** 取第一张封面相对路径（无则空） */
export function firstPlanCoverPath(raw?: string | null): string {
  return parsePlanCoverPaths(raw)[0] || ''
}
