<script setup lang="ts">
import type { Community } from '@/types/api'
import {
  openCommunityDetailTab,
  openUserSpaceTab,
} from '@/composables/useLibraryDetailNavigation'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatRich } from '@/utils/public'
import {
  normalizeRawImgPath,
  parseCommunityImgList,
  withOssImageProcess,
} from '@/utils/communityLiveMedia'

const props = defineProps<{
  items: Community[]
  keywords: string[]
}>()

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(raw: string): string {
  if (!raw) return ''
  let html = raw
  for (const kw of props.keywords) {
    if (!kw.trim()) continue
    const re = new RegExp(escapeRegExp(kw), 'gi')
    html = html.replace(re, (match) => `<mark class="search-highlight">${match}</mark>`)
  }
  return html
}

function normalizeImages(item: Community): Array<{
  src: string
  videoSrc?: string
  isLive: boolean
}> {
  const fromContent = item.content
    ? formatRich(item.content).image.map((img) => {
        const path = normalizeRawImgPath(img)
        return { src: path, isLive: false as const }
      })
    : []
  const fromImgList = parseCommunityImgList(item.img_list).map((m) => ({
    src: m.displayPath,
    videoSrc: m.videoPath,
    isLive: m.kind === 'live',
  }))
  return [...fromContent, ...fromImgList]
}

function contentPreview(item: Community): string {
  if (!item.content) return ''
  return formatRich(item.content).text
}

function openDetail(id: number) {
  openCommunityDetailTab(id)
}

function openUser(userId?: number) {
  openUserSpaceTab(userId)
}
</script>

<template>
  <ul v-if="items.length" class="space-y-3">
    <li
      v-for="item in items"
      :key="item.community_id"
      class="search-card rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition hover:border-qhx-primary/35 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/90"
    >
      <div
        v-if="item.user"
        class="mb-3 flex cursor-pointer items-center gap-3"
        @click="openUser(item.user?.user_id)"
      >
        <img
          v-if="item.user.user_face"
          :src="`${BASE_IMG}${item.user.user_face}?x-oss-process=image/quality,q_80/resize,w_80,h_80`"
          :alt="item.user.user_name"
          class="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ item.user.user_name }}
            </span>
            <span
              v-if="item.user.level != null"
              class="rounded-md bg-qhx-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-qhx-primary"
            >
              LV{{ item.user.level }}
            </span>
          </div>
          <div class="mt-0.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span v-if="item.times_count != null">{{ item.times_count }} 浏览</span>
            <span v-if="item.date">{{ item.date.slice(0, 10) }}</span>
          </div>
        </div>
      </div>

      <button type="button" class="w-full text-left" @click="openDetail(item.community_id)">
        <div class="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            v-if="item.sort && item.sort !== 0"
            class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          >
            置顶
          </span>
          <span
            v-if="item.boutique && item.boutique !== 0"
            class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          >
            精
          </span>
          <span
            v-if="item.type"
            class="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
          >
            {{ item.type }}
          </span>
        </div>

        <h3
          v-if="item.title"
          class="mb-2 line-clamp-2 text-base font-semibold leading-snug text-gray-900 dark:text-gray-100"
          v-html="highlightText(item.title)"
        />

        <div
          v-if="contentPreview(item)"
          class="community-preview line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
          v-html="highlightText(contentPreview(item))"
        />
      </button>

      <div
        v-if="normalizeImages(item).length"
        class="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4"
      >
        <div
          v-for="(img, index) in normalizeImages(item).slice(0, 9)"
          :key="`${item.community_id}-${index}`"
          class="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
          @click="openDetail(item.community_id)"
        >
          <img
            :src="`${BASE_IMG}${withOssImageProcess(img.src, 'image/quality,q_80/resize,w_200,h_200')}`"
            alt=""
            class="h-full w-full cursor-pointer object-cover"
            loading="lazy"
          />
          <span
            v-if="img.isLive"
            class="pointer-events-none absolute left-1 top-1 z-[1] rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
            style="background: rgba(0, 0, 0, 0.55)"
            aria-hidden="true"
          >
            LIVE
          </span>
          <div
            v-if="index === 8 && normalizeImages(item).length > 9"
            class="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white"
          >
            +{{ normalizeImages(item).length - 9 }}
          </div>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
:deep(.search-highlight) {
  background: color-mix(in srgb, var(--qhx-primary, #c76b98) 18%, transparent);
  color: var(--qhx-primary, #c76b98);
  border-radius: 0.2rem;
  padding: 0 0.15rem;
}

.community-preview :deep(p),
.community-preview :deep(div) {
  display: inline;
}
</style>
