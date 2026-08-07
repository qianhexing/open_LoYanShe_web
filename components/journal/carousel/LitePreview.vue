<!-- 邻页轻量预览：帖子标题底；其它类型封面+标题 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  firstCommunityDisplayPath,
  withOssImageProcess
} from '@/utils/communityLiveMedia'
import {
  getJournalFirstImagePath,
  getJournalLiteTitle
} from '@/components/journal/carousel/shared'

const props = defineProps<{
  journal: Journal
  imageParams?: string
}>()

const isPost = computed(() => props.journal.pk_type === 1)

const liteTitle = computed(() => getJournalLiteTitle(props.journal))

const coverSrc = computed(() => {
  if (isPost.value) return null
  const path = getJournalFirstImagePath(props.journal)
  if (!path) return null
  return `${BASE_IMG}${path}${props.imageParams || ''}`
})

const postLiteThumb = computed(() => {
  if (!isPost.value) return null
  const path = firstCommunityDisplayPath(props.journal.community?.img_list)
  if (!path) return null
  return `${BASE_IMG}${withOssImageProcess(path, 'image/quality,q_80/resize,w_600,h_600')}`
})
</script>

<template>
  <div class="journal-carousel-lite relative h-full min-h-0 w-full overflow-hidden">
    <template v-if="isPost">
      <img
        v-if="postLiteThumb"
        :src="postLiteThumb"
        alt=""
        class="absolute inset-0 h-full w-full object-cover opacity-40"
        draggable="false"
        loading="lazy"
      >
      <div class="journal-carousel-lite__post relative z-[1] flex h-full flex-col justify-end px-3 pb-4 pt-8">
        <div class="line-clamp-3 text-base font-semibold text-[#3d2833] dark:text-[var(--ink-primary)]">
          {{ liteTitle }}
        </div>
      </div>
    </template>
    <template v-else>
      <img
        v-if="coverSrc"
        :src="coverSrc"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        draggable="false"
        loading="lazy"
      >
      <div
        v-else
        class="journal-carousel-lite__placeholder absolute inset-0 flex items-center justify-center"
      >
        <UIcon name="i-heroicons-book-open" class="h-12 w-12 opacity-35" />
      </div>
      <div class="journal-carousel-lite__fade pointer-events-none absolute inset-x-0 bottom-0 h-28" />
      <div class="absolute inset-x-0 bottom-0 z-[1] px-3 pb-3 pt-8">
        <div class="line-clamp-2 text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
          {{ liteTitle }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.journal-carousel-lite__post {
  background: linear-gradient(180deg, transparent 0%, var(--paper-sheet) 55%);
}

.journal-carousel-lite__placeholder {
  color: var(--ink-faint, #9d8090);
  background:
    linear-gradient(160deg, rgba(184, 92, 72, 0.08) 0%, transparent 55%),
    var(--paper-dent);
}

.journal-carousel-lite__fade {
  background: linear-gradient(180deg, transparent, rgba(250, 246, 240, 0.92));
}

:global(.dark) .journal-carousel-lite__fade {
  background: linear-gradient(180deg, transparent, rgba(34, 30, 25, 0.92));
}
</style>
