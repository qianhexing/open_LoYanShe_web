/**
 * 手账轮播类型内容组件出口，便于按 pk_type 复用。
 *
 * @example
 * import { TypeBody, TypePost, isJournalCarouselPlainText } from '@/components/journal/carousel'
 */
export { default as TypeBody } from './TypeBody.vue'
export { default as TypeNote } from './TypeNote.vue'
export { default as TypePost } from './TypePost.vue'
export { default as TypeClothes } from './TypeClothes.vue'
export { default as TypeMatching } from './TypeMatching.vue'
export { default as TypeLibrary } from './TypeLibrary.vue'
export { default as TypePlan } from './TypePlan.vue'
export { default as TypeScene } from './TypeScene.vue'
export { default as TypeNoteFallback } from './TypeNoteFallback.vue'
export { default as TypeInvalid } from './TypeInvalid.vue'
export { default as LitePreview } from './LitePreview.vue'

export {
  JOURNAL_PK_LABELS,
  getJournalTypeLabel,
  parseJournalTags,
  journalHasLinkedBody,
  getJournalFirstImagePath,
  getJournalLiteTitle,
  journalTypeEntityReady,
  isJournalCarouselPlainText,
  journalCarouselShowsCover,
  isJournalCarouselScene,
  journalCanJumpDetail
} from './shared'
