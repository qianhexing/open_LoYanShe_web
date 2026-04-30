import type { InjectionKey } from 'vue'
import type { Study } from '@/types/api'

export interface StudyManageTreeApi {
  isExpanded: (studyId: number) => boolean
  canExpandRow: (row: Study) => boolean
  toggleExpand: (row: Study) => void
  childrenRows: (parentId: number) => Study[] | undefined
  childrenLoading: (parentId: number) => boolean
  formatImg: (url: string) => string
  studyTypeLabel: (t: number) => string
  onEdit: (row: Study) => void
  onDelete: (row: Study) => void
  /** 在可展开节点下新增子项（表单预填 parent_id） */
  onAddChild: (parent: Study) => void
}

export const studyManageTreeKey: InjectionKey<StudyManageTreeApi> = Symbol('studyManageTree')
