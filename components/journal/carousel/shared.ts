import type { Journal } from '@/types/api'
import { firstCommunityDisplayPath, parseCommunityImgList } from '@/utils/communityLiveMedia'

export const JOURNAL_PK_LABELS: Record<number, string> = {
  0: '手账',
  1: '帖子',
  2: '服饰',
  3: '搭配',
  4: '图鉴',
  5: '计划',
  6: '3D场景'
}

export function getJournalTypeLabel(pkType: number): string {
  return JOURNAL_PK_LABELS[pkType] ?? '其他'
}

export function parseJournalTags(tags?: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export function journalHasLinkedBody(j: Journal): boolean {
  return !!(
    j.community ||
    j.comment ||
    j.wardrobe_clothes ||
    j.matching_list ||
    j.library ||
    j.plan ||
    j.sence
  )
}

/** 各类型首图相对路径（帖子 Live→jpg） */
export function getJournalFirstImagePath(j: Journal): string | null {
  if (j.pk_type === 1 && j.community?.img_list) {
    return firstCommunityDisplayPath(j.community.img_list)
  }
  if (j.pk_type === 0 && j.comment?.mount_img) {
    const first = j.comment.mount_img.split(',')[0]?.trim()
    return first || null
  }
  if (j.pk_type === 2 && j.wardrobe_clothes?.clothes_img) {
    return j.wardrobe_clothes.clothes_img.trim() || null
  }
  if (j.pk_type === 3 && j.matching_list?.cover) {
    return j.matching_list.cover.trim() || null
  }
  if (j.pk_type === 4 && j.library?.cover) {
    return j.library.cover.trim() || null
  }
  if (j.pk_type === 5 && j.plan) {
    const cover = j.plan.plan_cover || j.plan.parent_plan?.plan_cover
    if (cover) return cover.trim()
    if (j.plan.wardrobe_clothes?.clothes_img) return j.plan.wardrobe_clothes.clothes_img.trim()
    return null
  }
  if (j.pk_type === 6 && j.sence?.sence_cover) {
    return j.sence.sence_cover.trim() || null
  }
  return null
}

export function getJournalLiteTitle(j: Journal): string {
  if (j.pk_type === 1 && j.community?.title) return j.community.title
  if (j.pk_type === 0 && j.comment?.comment_content) {
    return j.comment.comment_content.replace(/<[^>]+>/g, '').trim().slice(0, 48) || '手账'
  }
  if (j.pk_type === 2) return j.wardrobe_clothes?.clothes_note || '服饰'
  if (j.pk_type === 3) return j.matching_list?.note || '搭配'
  if (j.pk_type === 4) return j.library?.name || '图鉴'
  if (j.pk_type === 5) return j.plan?.plan_name || '计划'
  if (j.pk_type === 6) return j.sence?.sence_desc?.trim() || '3D场景'
  return j.note?.trim() || getJournalTypeLabel(j.pk_type)
}

/** 是否有关联实体数据（类型组件可据此判断失效） */
export function journalTypeEntityReady(j: Journal): boolean {
  switch (j.pk_type) {
    case 0:
      return !!j.comment
    case 1:
      return !!j.community
    case 2:
      return !!j.wardrobe_clothes
    case 3:
      return !!j.matching_list
    case 4:
      return !!j.library
    case 5:
      return !!j.plan
    case 6:
      return !!j.sence
    default:
      return false
  }
}

/**
 * 纯文本布局：无封面、无九宫格。
 * 可用于居中/滚动等判断复用。
 */
export function isJournalCarouselPlainText(j: Journal): boolean {
  if (j.pk_type === 1) {
    return parseCommunityImgList(j.community?.img_list).length === 0
  }
  return !getJournalFirstImagePath(j)
}

/** 是否展示顶部大封面（帖子 / 3D 场景走专用布局，不展示封面） */
export function journalCarouselShowsCover(j: Journal): boolean {
  if (j.pk_type === 1 || j.pk_type === 6) return false
  if (isJournalCarouselPlainText(j)) return false
  return !!getJournalFirstImagePath(j)
}

export function isJournalCarouselScene(j: Journal | null | undefined): boolean {
  return j?.pk_type === 6 && !!j.sence?.sence_id
}

/**
 * 是否可跳转关联详情。
 * 签到/手账(0)、计划(5) 不跳转。
 */
export function journalCanJumpDetail(j: Journal): boolean {
  if (j.pk_type === 1) return !!j.community?.community_id
  if (j.pk_type === 2) return !!j.wardrobe_clothes?.clothes_id
  if (j.pk_type === 3) return !!j.matching_list?.matching_id
  if (j.pk_type === 4) return !!j.library?.library_id
  if (j.pk_type === 6) return !!j.sence?.sence_id
  return false
}
