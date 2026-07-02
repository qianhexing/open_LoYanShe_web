<script setup lang="ts">
import { computed, ref } from 'vue'
import { clampUserLibraryScore, getScoreCaption, starFillRatio } from '@/utils/libraryScore'

const props = withDefaults(
  defineProps<{
    modelValue: number
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const hoverPreview = ref<number | null>(null)

const displayValue = computed(() => hoverPreview.value ?? props.modelValue)
const caption = computed(() =>
  displayValue.value >= 1 ? getScoreCaption(displayValue.value) : '未定'
)

const starSizeClass = computed(() =>
  props.size === 'md' ? 'h-7 w-7' : 'h-5 w-5'
)

function setScore(next: number) {
  emit('update:modelValue', next <= 0 ? 0 : clampUserLibraryScore(next))
}
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-1.5">
    <div
      class="inline-flex items-center gap-0.5 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-1.5 py-1 dark:border-amber-400/25 dark:bg-amber-500/10"
    >
      <div
        v-for="s in 5"
        :key="s"
        class="relative inline-flex shrink-0 items-center justify-center"
        :class="starSizeClass"
        @mouseleave="hoverPreview = null"
      >
        <UIcon
          name="i-heroicons-star"
          :class="[starSizeClass, 'text-amber-200/70 dark:text-stone-500']"
        />
        <UIcon
          v-if="starFillRatio(s, displayValue) > 0"
          name="i-heroicons-star-solid"
          :class="[starSizeClass, 'pointer-events-none absolute inset-0 text-amber-500 dark:text-amber-400']"
          :style="starFillRatio(s, displayValue) === 0.5 ? { clipPath: 'inset(0 50% 0 0)' } : undefined"
        />
        <button
          v-if="s > 1"
          type="button"
          class="absolute left-0 top-0 z-10 h-full w-1/2 rounded-l focus:outline-none"
          :aria-label="`设为 ${s - 0.5} 星`"
          @mouseenter="hoverPreview = s - 0.5"
          @click="setScore(s - 0.5)"
        />
        <button
          type="button"
          class="absolute top-0 z-10 h-full rounded-r focus:outline-none"
          :class="s > 1 ? 'right-0 w-1/2' : 'inset-0 w-full'"
          :aria-label="`设为 ${s} 星`"
          @mouseenter="hoverPreview = s"
          @click="setScore(s)"
        />
      </div>
    </div>
    <span class="shrink-0 text-[10px] font-medium text-amber-800/90 dark:text-amber-100/90">
      {{ caption }}
    </span>
  </div>
</template>
