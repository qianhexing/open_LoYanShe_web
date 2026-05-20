<script setup lang="ts">
import {
	libraryDetailPageHref,
	openLibraryDetailTab
} from '@/composables/useLibraryDetailNavigation'
import type { LibrarySimilarItem } from '@/types/api'
import { formatSimilarityScore } from '@/utils/aiChatFormat'
import { BASE_IMG } from '@/utils/ipConfig'

defineProps<{
	intentHint?: string
	similarItems: LibrarySimilarItem[]
	showMax: number
}>()
</script>

<template>
  <div
    class="max-w-[95%] min-w-0 rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-sm text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
    <p v-if="intentHint" class="mb-2 text-[13px] leading-snug text-qhx-text">
      {{ intentHint }}
    </p>
    <div
      v-if="similarItems.length > 0"
      class="-mx-1 mt-3 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
      role="list"
      aria-label="相似推荐列表">
      <div class="flex w-max gap-3 px-1">
        <a
          v-for="item in similarItems.slice(0, showMax)"
          :key="item.library_id ?? item.name"
          :href="libraryDetailPageHref(item.library_id)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-[6.25rem] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-qhx-bg p-2 text-left shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] transition-[transform,opacity] active:scale-[0.98] active:opacity-95 sm:w-[7rem] text-qhx-text no-underline"
          role="listitem"
          :title="item.name"
          @click.prevent="openLibraryDetailTab(item.library_id)">
          <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg shadow-sm">
            <img
              :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
              :alt="item.name"
              class="neo-chat-carousel-thumb-img pointer-events-none"
              loading="lazy"
              decoding="async" />
          </div>
          <span class="neo-chat-carousel-title pointer-events-none text-qhx-text">
            {{ item.name }}
          </span>
          <span
            v-if="item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))"
            class="line-clamp-1 min-h-[0.875rem] shrink-0 text-center text-[10px] text-qhx-primary/85 pointer-events-none">
            相似度 {{ formatSimilarityScore(Number(item.similarity_score)) }}
          </span>
          <span v-else class="block min-h-[0.875rem] shrink-0 pointer-events-none" aria-hidden="true" />
        </a>
      </div>
    </div>
  </div>
</template>
