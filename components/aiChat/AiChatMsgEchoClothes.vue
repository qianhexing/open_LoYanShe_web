<script setup lang="ts">
import type { WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

defineProps<{
	intentHint?: string
	echoClothes: WardrobeClothes
	/** 「添加定尾计划」提交成功后由父级置为 true */
	tailPlanAdded?: boolean
}>()
const emit = defineEmits<{
	continue: []
	openEcho: [clothesId: number]
	openWardrobe: [item: WardrobeClothes]
	addTailPlan: [item: WardrobeClothes, ev: MouseEvent]
}>()
</script>

<template>
  <div
    class="max-w-[95%] min-w-0 rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-sm text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
    <p v-if="intentHint" class="mb-2 text-[13px] leading-snug text-qhx-text">
      {{ intentHint }}
    </p>
    <div v-if="echoClothes.clothes_id != null" class="mt-2 flex gap-2.5">
      <!-- 收窄缩略图占位 -->
      <button
        type="button"
        class="flex w-[5rem] shrink-0 snap-start flex-col gap-0.5 rounded-lg bg-qhx-bg p-1.5 text-left text-qhx-text outline-none ring-offset-2 ring-offset-qhx-bg-card transition-[transform,opacity] shadow-[inset_2px_2px_5px_var(--neo-inset-d),inset_-2px_-2px_5px_var(--neo-inset-l)] focus-visible:ring-2 focus-visible:ring-qhx-primary/50 active:scale-[0.98] sm:w-[5.25rem]"
        @click="emit('openEcho', Number(echoClothes.clothes_id))">
        <div class="neo-chat-carousel-thumb relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-md shadow-sm">
          <img
            v-if="echoClothes.clothes_img"
            :src="`${BASE_IMG}${echoClothes.clothes_img}?x-oss-process=image/quality,q_80/resize,w_120`"
            :alt="echoClothes.clothes_note || '服饰'"
            class="neo-chat-carousel-thumb-img pointer-events-none"
            loading="lazy"
            decoding="async" />
          <div v-else class="absolute inset-0 flex items-center justify-center bg-qhx-bg-card">
            <UIcon name="i-heroicons-photo" class="size-5 text-qhx-text/35" />
          </div>
        </div>
        <span class="pointer-events-none text-center text-[10px] text-qhx-primary/85">查看详情</span>
      </button>

      <div class="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <p class="line-clamp-2 text-[11px] font-medium leading-snug text-qhx-text">
          {{ echoClothes.clothes_note || '未命名服饰' }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="inline-flex shrink-0 items-center justify-center rounded-lg border border-qhx-border/40 bg-qhx-bg px-2 py-1 text-[10px] font-semibold leading-tight text-qhx-text shadow-[2px_2px_5px_var(--neo-raise-d),-2px_-2px_5px_var(--neo-raise-l)] transition-[transform,opacity] hover:brightness-[1.03] active:scale-[0.98] active:shadow-[inset_1px_1px_3px_var(--neo-inset-d),inset_-1px_-1px_3px_var(--neo-inset-l)]"
            @click="emit('openWardrobe', echoClothes)">
            去衣柜查看
          </button>
          <span
            v-if="tailPlanAdded"
            class="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold leading-tight text-emerald-600 dark:text-emerald-400">
            <UIcon name="i-heroicons-check-circle" class="size-3.5 shrink-0" aria-hidden="true" />
            已定尾计划
          </span>
          <button
            v-else-if="echoClothes.plan_id === null"
            type="button"
            class="inline-flex shrink-0 items-center justify-center rounded-lg border border-qhx-primary/35 bg-qhx-bg px-2 py-1 text-[10px] font-semibold leading-tight text-qhx-primary shadow-[2px_2px_5px_var(--neo-raise-d),-2px_-2px_5px_var(--neo-raise-l)] transition-[transform,opacity] hover:brightness-[1.03] active:scale-[0.98] active:shadow-[inset_1px_1px_3px_var(--neo-inset-d),inset_-1px_-1px_3px_var(--neo-inset-l)]"
            @click="emit('addTailPlan', echoClothes, $event)">
            添加定尾计划
          </button>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="mt-3 text-xs font-medium text-qhx-primary/90 underline-offset-2 hover:underline"
      @click="emit('continue')">
      继续提问
    </button>
  </div>
</template>
