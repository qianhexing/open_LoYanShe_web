<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 0–5，与衣柜服饰 `is_favorite` 一致 */
  level: number
}>()

const CAPTIONS = [' ', '拉完了', 'NPC', '人上人', '顶级', '夯爆了！'] as const

const caption = computed(() => {
  const i = Math.min(5, Math.max(0, Math.round(props.level)))
  return CAPTIONS[i]
})

const stars = computed(() => Math.min(5, Math.max(0, Math.round(props.level))))

/** 新拟态：柔光凸起块（封面叠加用浅灰底，在照片上仍能辨认） */
const neuSurface =
  'border border-white/55 bg-[#e8eaf0] shadow-[6px_6px_14px_rgb(163_177_198/0.55),-5px_-5px_14px_rgb(255_255_255/0.95),inset_0_1px_1px_rgb(255_255_255/0.85)] dark:border-white/[0.08] dark:bg-[#3d4354] dark:shadow-[7px_7px_16px_rgb(0_0_0/0.5),-5px_-5px_14px_rgb(255_255_255/0.05),inset_0_1px_1px_rgb(255_255_255/0.08)]'
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
    <!-- 右上角：星级与评语同一拟态块内紧贴排列 -->
    <div class="absolute top-2 right-2 max-w-[min(100%-0.75rem,13rem)]">
      <div
        :class="[
          neuSurface,
          'flex flex-col items-end gap-0 rounded-2xl px-2.5 py-1.5'
        ]"
      >
        <div class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          <UIcon
            v-for="s in 5"
            :key="s"
            :name="stars >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
            class="text-[10px] sm:text-xs drop-shadow-[0_1px_0_rgb(255_255_255/0.65)] dark:drop-shadow-none"
            :class="stars >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'"
          />
        </div>

        <span
          class="select-none text-right text-[clamp(0.62rem,2.2vw,0.85rem)] font-semibold leading-tight tracking-wide text-gray-700 dark:text-gray-100"
        >
          {{ caption }}
        </span>
      </div>
    </div>
  </div>
</template>
