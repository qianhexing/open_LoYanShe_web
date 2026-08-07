<!-- pk_type=1 帖子：完整富文本 + 九宫格，无封面 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import SafeRichText from '@/components/SafeRichText.vue'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  parseCommunityImgList,
  withOssImageProcess,
  normalizeRawImgPath
} from '@/utils/communityLiveMedia'
import { parseRichText } from '@/utils/public'

const props = defineProps<{
  journal: Journal
}>()

const community = computed(() => props.journal.community)

const postTitle = computed(() => community.value?.title?.trim() || '帖子')

const postRichNodes = computed(() => {
  const content = community.value?.content
  if (!content) return null
  try {
    return parseRichText(content.replace(/60vh/g, '70vh'))
  } catch {
    return null
  }
})

const postGridList = computed(() => {
  const alt = postTitle.value
  return parseCommunityImgList(community.value?.img_list).map((m) => ({
    src: `${BASE_IMG}${withOssImageProcess(m.displayPath, 'image/quality,q_100/resize,w_400,h_400')}`,
    alt,
    videoSrc: m.videoPath
  }))
})

const postPreviewList = computed(() => {
  const alt = postTitle.value
  return parseCommunityImgList(community.value?.img_list).map((m) => ({
    src: normalizeRawImgPath(m.displayPath),
    alt,
    videoSrc: m.videoPath
  }))
})
</script>

<template>
  <template v-if="community">
    <h3 class="mb-2 text-base font-semibold leading-snug text-[#3d2833] dark:text-[var(--ink-primary)]">
      {{ postTitle }}
    </h3>
    <div
      v-if="postRichNodes"
      class="journal-carousel-type-post__rich text-sm leading-[1.75] text-[#4a2f3d] dark:text-[var(--ink-secondary)]"
      @click.stop
    >
      <SafeRichText :nodes="postRichNodes" />
    </div>
    <p v-else class="text-sm text-[#8a6f7d] dark:text-[var(--ink-muted)]">暂无正文</p>
    <div
      v-if="postGridList.length"
      class="journal-carousel-type-post__grid mt-3 grid grid-cols-3 gap-2"
      @click.stop
    >
      <QhxPreviewImage
        :list="postGridList"
        :preview="postPreviewList"
        class-name="journal-carousel-type-post__cell relative w-full overflow-hidden rounded-[10px] shadow-md"
      />
    </div>
  </template>
  <TypeInvalid v-else />
</template>

<style scoped>
.journal-carousel-type-post__rich :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

/* 九宫格固定 1:1，避免原图比例撑破格子 */
.journal-carousel-type-post__grid :deep(.preview-image-cell) {
  aspect-ratio: 1 / 1;
  width: 100%;
  display: block;
  position: relative;
}

.journal-carousel-type-post__grid :deep(.preview-image-thumb) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: cover;
  object-position: center;
}
</style>
