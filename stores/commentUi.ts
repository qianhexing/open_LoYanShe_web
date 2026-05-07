import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

let highlightClearTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 评论 UI 全局状态：新发评论高亮等，便于跨页面/跨组件读写。
 */
export const useCommentUiStore = defineStore('commentUi', () => {
  /** 需要高亮展示的最新一条评论 comment_id（如刚发布成功） */
  const newCommentHighlightId = shallowRef<number | null>(null)

  function flashNewCommentHighlight(commentId: number, durationMs = 5000) {
    if (highlightClearTimer) {
      clearTimeout(highlightClearTimer)
      highlightClearTimer = null
    }
    newCommentHighlightId.value = Number(commentId)
    highlightClearTimer = setTimeout(() => {
      newCommentHighlightId.value = null
      highlightClearTimer = null
    }, durationMs)
  }

  function clearNewCommentHighlight() {
    if (highlightClearTimer) {
      clearTimeout(highlightClearTimer)
      highlightClearTimer = null
    }
    newCommentHighlightId.value = null
  }

  return {
    newCommentHighlightId,
    flashNewCommentHighlight,
    clearNewCommentHighlight,
  }
})
