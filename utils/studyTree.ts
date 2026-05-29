import type { Study } from '@/types/api'

/** 树目录里是否显示：仅 `study_type === 0` 的分类节点；`study_type !== 0` 的（链接/关联等）不显示在树中 */
export function isStudyTreeRow(s: Study): boolean {
  return Number(s.study_type) === 0
}

/** 参与左侧树展示、展开计数的子节点 */
export function getTreeBranchChildren(s: Study | null | undefined): Study[] {
  if (!s?.children?.length) {
    return []
  }
  return s.children.filter(isStudyTreeRow)
}

/** 是否为分类节点：选中后应遍历子树，收集 `study_type !== 0` 的项到右侧 */
export function isCategoryFolderNode(s: Study | null | undefined): boolean {
  return s != null && Number(s.study_type) === 0
}

function walkDescendantNonFolderPicks(
  nodes: Study[] | undefined,
  out: Study[],
  seen: Set<number>,
) {
  if (!nodes?.length) {
    return
  }
  for (const n of nodes) {
    const st = Number(n.study_type)
    if (Number.isFinite(st) && st !== 0) {
      if (!seen.has(n.study_id)) {
        seen.add(n.study_id)
        out.push(n)
      }
    }
    if (n.children?.length) {
      walkDescendantNonFolderPicks(n.children, out, seen)
    }
  }
}

/**
 * 从子树中收集所有 `study_type !== 0` 的条目（深度遍历，不含当前节点自身；中间分类节点不收集但会下钻）
 */
export function getDescendantNonFolderPicks(s: Study | null | undefined): Study[] {
  if (!s?.children?.length) {
    return []
  }
  const out: Study[] = []
  const seen = new Set<number>()
  walkDescendantNonFolderPicks(s.children, out, seen)
  return out
}

/** 右侧：仅当选中「study_type 为 0 的分类」时，展示子树中所有 `study_type !== 0` 的项 */
export function getPicksForRightPanel(s: Study | null | undefined): Study[] {
  if (!isCategoryFolderNode(s)) {
    return []
  }
  return getDescendantNonFolderPicks(s)
}
