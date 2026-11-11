<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { CommentOpenReplyPayload } from '@/composables/communityCommentSection'

const CommentSection = defineAsyncComponent(
  () => import('@/components/comment/CommentSection.vue'),
)

withDefaults(
  defineProps<{
    communityId: number
    commentTotal: number
    commentSectionKey: number
    commentSectionReady: boolean
    focusCommentId?: number
    myAvatar: string
    myName?: string
    /** 场景抽屉内用毛玻璃；普通详情用卡片 */
    variant?: 'card' | 'glass'
    reserveBottomForFixedBar?: boolean
  }>(),
  {
    variant: 'card',
    reserveBottomForFixedBar: true,
    myName: '未登录',
  },
)

const emit = defineEmits<{
  'open-composer': []
  'open-reply': [payload: CommentOpenReplyPayload]
  total: [count: number]
}>()
</script>

<template>
  <div
    class="overflow-hidden"
    :class="
      variant === 'glass'
        ? 'community-scene-glass-panel rounded-lg shadow-inner mt-1 border border-white/50 dark:border-white/10'
        : 'mt-3 rounded-lg bg-qhx-bg-card shadow-lg'
    "
  >
    <div
      class="flex items-center gap-2 px-4 py-3 border-b"
      :class="
        variant === 'glass'
          ? 'border-white/40 dark:border-white/10'
          : 'border-gray-100 dark:border-gray-700/60'
      "
    >
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">评论</h3>
      <span class="text-xs text-gray-500 dark:text-gray-400">共 {{ commentTotal }} 条</span>
    </div>
    <div
      class="min-h-[min(50vh,480px)]"
      :class="variant === 'glass' ? '' : 'bg-white dark:bg-gray-900'"
    >
      <div class="px-4 pt-4 pb-2">
        <div class="mb-3 flex items-center gap-3">
          <UAvatar
            :src="myAvatar"
            :alt="myName"
            size="sm"
            class="flex-shrink-0 bg-gray-100"
          />
          <button
            type="button"
            class="flex h-10 flex-1 items-center rounded-full bg-gray-100 px-4 text-left text-sm text-gray-400 transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            @click="emit('open-composer')"
          >
            <span class="i-heroicons-pencil mr-2 h-4 w-4" />
            说点什么…
          </button>
        </div>
      </div>
      <CommentSection
        v-if="commentSectionReady"
        :key="commentSectionKey"
        type="community"
        :id="communityId"
        :focus-comment-id="focusCommentId"
        :reserve-bottom-for-fixed-bar="reserveBottomForFixedBar"
        @open-reply="emit('open-reply', $event)"
        @total="emit('total', $event)"
      />
      <div
        v-else
        class="flex min-h-[120px] items-center justify-center py-8 text-sm text-gray-400"
        aria-busy="true"
      >
        评论加载中…
      </div>
    </div>
  </div>
</template>

<style scoped>
.community-scene-glass-panel {
  background-color: rgba(255, 255, 255, 0.22);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

:root.dark .community-scene-glass-panel,
.dark .community-scene-glass-panel {
  background-color: rgba(38, 38, 38, 0.38);
}
</style>
