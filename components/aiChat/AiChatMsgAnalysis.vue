<script setup lang="ts">
import {
	libraryDetailPageHref,
	openLibraryDetailTab
} from '@/composables/useLibraryDetailNavigation'
import type { ChatMessage } from '@/types/aiChat'
import type { Library, WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps<{
	msg: ChatMessage
	pickingSimilarPair: { messageId: string; libraryId: number } | null
	openingCustomClothes: boolean
}>()

const emit = defineEmits<{
	pickSimilar: [messageId: string, lib: Library]
	joinWardrobe: [
		source: 'library' | 'shared',
		item: Library | WardrobeClothes,
		ev?: MouseEvent
	]
	customAdd: [ev: MouseEvent]
}>()

function isRowPickingSimilar(mId: string, lib: Library) {
	const p = props.pickingSimilarPair
	if (!p || p.messageId !== mId || lib.library_id == null) return false
	return p.libraryId === Number(lib.library_id)
}
</script>

<template>
  <div
    class="max-w-[95%] min-w-0 rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-sm text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
    <p v-if="msg.intentHint" class="mb-2 text-[13px] leading-snug text-qhx-text">
      {{ msg.intentHint }}
    </p>
    <!-- <pre
      class="max-h-[50dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-qhx-bg px-2.5 py-2 font-mono text-xs text-qhx-text shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]"
    >{{ formatAnalysis(msg.analysis) }}</pre> -->
    <div
      v-if="msg.libraries?.length || (msg.analysis?.type === 0 && msg.sharedClothes !== undefined)"
      class="mt-3 flex flex-col gap-4"
      role="list">
      <template v-if="msg.libraries?.length">
        <template v-if="msg.similarRecommendAwaitPick && !msg.similarPickResolved">
          <div
            class="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
            role="list"
            aria-label="请选择作为相似推荐的裙子">
            <div class="flex w-max gap-3 px-1">
              <button
                v-for="lib in msg.libraries"
                :key="lib.library_id"
                type="button"
                class="relative flex w-[6.25rem] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-qhx-bg p-2 text-left shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] outline-none ring-offset-2 ring-offset-qhx-bg-card transition-[transform,opacity] focus-visible:ring-2 focus-visible:ring-qhx-primary/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-[7rem]"
                :disabled="pickingSimilarPair !== null"
                :aria-busy="isRowPickingSimilar(msg.id, lib)"
                :aria-label="`选择 ${lib.name}`"
                @click="emit('pickSimilar', msg.id, lib)">
                <div
                  v-if="isRowPickingSimilar(msg.id, lib)"
                  class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-qhx-bg/80 backdrop-blur-[2px]"
                  aria-hidden="true">
                  <span
                    class="inline-block size-8 shrink-0 animate-spin rounded-full border-2 border-qhx-border border-t-qhx-primary" />
                  <span class="text-[11px] text-qhx-text/80">加载中…</span>
                </div>
                <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg shadow-sm">
                  <img
                    :src="`${BASE_IMG}${lib.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                    :alt="lib.name"
                    class="neo-chat-carousel-thumb-img pointer-events-none"
                    loading="lazy"
                    decoding="async" />
                </div>
                <span class="neo-chat-carousel-title pointer-events-none text-qhx-text">
                  {{ lib.name }}
                </span>
              </button>
            </div>
          </div>
        </template>
        <template v-else-if="msg.analysis?.type === 2">
          <div
            class="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
            role="list"
            aria-label="筛选结果图鉴">
            <div class="flex w-max gap-3 px-1">
              <a
                v-for="lib in msg.libraries"
                :key="lib.library_id"
                :href="libraryDetailPageHref(lib.library_id)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex w-[6.25rem] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-qhx-bg p-2 text-left text-qhx-text no-underline shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] transition-[transform,opacity] active:scale-[0.98] active:opacity-95 sm:w-[7rem]"
                role="listitem"
                :title="lib.name"
                @click.prevent="openLibraryDetailTab(lib.library_id)">
                <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg shadow-sm">
                  <img
                    :src="`${BASE_IMG}${lib.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                    :alt="lib.name"
                    class="neo-chat-carousel-thumb-img pointer-events-none"
                    loading="lazy"
                    decoding="async" />
                </div>
                <span class="neo-chat-carousel-title pointer-events-none text-qhx-text">
                  {{ lib.name }}
                </span>
              </a>
            </div>
          </div>
        </template>
        <template v-else-if="msg.analysis?.type === 0">
          <div
            class="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
            aria-label="图鉴候选">
            <div class="flex w-max gap-3 px-1">
              <button
                v-for="lib in msg.libraries"
                :key="lib.library_id"
                type="button"
                class="flex w-[6.25rem] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-qhx-bg p-2 text-left text-qhx-text shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] outline-none ring-offset-2 ring-offset-qhx-bg-card transition-[transform,opacity] focus-visible:ring-2 focus-visible:ring-qhx-primary/50 active:scale-[0.98] active:opacity-95 sm:w-[7rem]"
                :aria-label="`图鉴 ${lib.name}`"
                :title="lib.name"
                @click="emit('joinWardrobe', 'library', lib, $event)">
                <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg shadow-sm">
                  <img
                    :src="`${BASE_IMG}${lib.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                    :alt="lib.name"
                    class="neo-chat-carousel-thumb-img pointer-events-none"
                    loading="lazy"
                    decoding="async" />
                </div>
                <span class="neo-chat-carousel-title pointer-events-none text-qhx-text">
                  {{ lib.name }}
                </span>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <a
            v-for="lib in msg.libraries"
            :key="lib.library_id"
            :href="libraryDetailPageHref(lib.library_id)"
            target="_blank"
            rel="noopener noreferrer"
            class="ai-chat-lib-preview flex min-w-0 items-center gap-2.5 rounded-xl bg-qhx-bg px-2 py-2 text-left text-qhx-text no-underline shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] transition-opacity hover:opacity-95 active:opacity-90"
            role="listitem"
            @click.prevent="openLibraryDetailTab(lib.library_id)">
            <img
              :src="`${BASE_IMG}${lib.cover}?x-oss-process=image/quality,q_80/resize,w_160`"
              :alt="lib.name"
              class="size-14 shrink-0 rounded-lg object-cover shadow-sm pointer-events-none"
              loading="lazy"
              decoding="async" />
            <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-qhx-text pointer-events-none">
              {{ lib.name }}
            </span>
            <UIcon name="i-heroicons-chevron-right" class="size-4 shrink-0 text-qhx-primary/70 pointer-events-none" aria-hidden="true" />
          </a>
        </template>
      </template>

      <div
        v-if="msg.analysis?.type === 0 && msg.sharedClothes !== undefined"
        class="rounded-xl border border-qhx-border/40 bg-qhx-bg/40 px-2 py-2">
        <p class="mb-2 px-0.5 text-[11px] leading-snug text-qhx-text/75">用户共享服饰（与「添加服饰」同源数据）· 点击卡片触发加衣柜</p>
        <div v-if="msg.sharedClothes.length === 0" class="px-1 py-2 text-center text-xs text-qhx-text/60">暂无匹配共享服饰</div>
        <div
          v-else
          class="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory"
          role="list"
          aria-label="共享服饰">
          <div class="flex w-max gap-3 px-1">
            <button
              v-for="(sc, sci) in msg.sharedClothes"
              :key="sc.clothes_id ?? `sc-${sci}`"
              type="button"
              class="flex w-[6.25rem] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-qhx-bg p-2 text-left text-qhx-text shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] outline-none ring-offset-1 ring-offset-qhx-bg-card transition-[transform,opacity] focus-visible:ring-2 focus-visible:ring-qhx-primary/45 active:scale-[0.98] sm:w-[7rem]"
              :aria-label="`共享服饰 ${sc.clothes_note || '未命名'}`"
              @click="emit('joinWardrobe', 'shared', sc, $event)">
              <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg shadow-sm">
                <img v-if="sc.clothes_img" :src="`${BASE_IMG}${sc.clothes_img}`" alt="" class="neo-chat-carousel-thumb-img" loading="lazy" decoding="async" />
                <div v-else class="absolute inset-0 flex items-center justify-center bg-qhx-bg-card">
                  <UIcon name="i-heroicons-photo" class="size-7 text-qhx-text/35" />
                </div>
              </div>
              <span class="neo-chat-carousel-title text-qhx-text">
                {{ sc.clothes_note || '未命名' }}
              </span>
              <div class="neo-chat-carousel-meta flex h-[2rem] shrink-0 items-center justify-center gap-x-1 overflow-hidden whitespace-nowrap text-[10px] leading-tight text-qhx-text/65">
                <span class="inline-flex min-w-0 max-w-[40%] items-center gap-0.5 text-qhx-primary/85">
                  <UIcon name="i-heroicons-hand-thumb-up" class="size-3 shrink-0" />
                  <span class="truncate">{{ sc.good_count ?? 0 }}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span class="inline-flex min-w-0 max-w-[40%] items-center gap-0.5" title="引用数">
                  <UIcon name="i-heroicons-link" class="size-3 shrink-0 opacity-80" />
                  <span class="truncate">{{ sc.citation_count ?? 0 }}</span>
                </span>
                <template v-if="sc.price != null">
                  <span aria-hidden="true">·</span>
                  <span class="truncate">¥{{ sc.price }}</span>
                </template>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="msg.analysis?.type === 0"
      class="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-qhx-border/45 bg-qhx-bg/35 px-3 py-3 text-center shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)]">
      <span class="text-[12px] leading-snug text-qhx-text/72">没有想要的结果？</span>
      <button
        type="button"
        class="inline-flex min-h-10 items-center justify-center rounded-xl border border-qhx-border/40 bg-qhx-bg px-4 py-2 text-xs font-semibold text-qhx-primary shadow-[4px_4px_12px_var(--neo-raise-d),-3px_-3px_12px_var(--neo-raise-l)] transition-[transform,opacity] hover:brightness-[1.02] active:scale-[0.98] active:shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] disabled:pointer-events-none disabled:opacity-45"
        :disabled="openingCustomClothes"
        :aria-busy="openingCustomClothes"
        @click="emit('customAdd', $event)">
        {{ openingCustomClothes ? '打开中…' : '自定义服饰' }}
      </button>
    </div>
  </div>
</template>
