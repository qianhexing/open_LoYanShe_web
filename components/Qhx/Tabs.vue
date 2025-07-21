<template>
  <div class="w-full overflow-hidden">
    <!-- Tabs Header -->
    <div class="border-b border-gray-200 p-2 max-md:flex">
      <slot name="header" :currentIndex="currentIndex" :goTo="goTo">
        <!-- 默认的 tab 按钮，当没有提供 header slot 时显示 -->
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          @click="goTo(i)"
          class="py-2 w-auto px-4 text-center transition max-md:flex-1"
          :class="{
            'text-qhx-primary border-b-2 border-qhx-primary w-auto font-semibold': currentIndex === i,
            'text-gray-500': currentIndex !== i
          }"
        >
          {{ tab }}
        </button>
      </slot>
    </div>

    <!-- Panels Container -->
    <div
      class="flex transition-transform duration-300 ease-in-out"
      :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'

const props = defineProps<{
  tabs: string[]
}>()

const currentIndex = ref(0)
provide('currentIndex', currentIndex)

const goTo = (index: number) => {
  currentIndex.value = index
}

// 滑动逻辑
let startX = 0
let deltaX = 0

const handleTouchStart = (e: TouchEvent) => {
  startX = e.touches[0].clientX
}

const handleTouchMove = (e: TouchEvent) => {
  deltaX = e.touches[0].clientX - startX
}

const handleTouchEnd = () => {
  if (Math.abs(deltaX) > 50) {
    if (deltaX < 0 && currentIndex.value < props.tabs.length - 1) {
      currentIndex.value++
    } else if (deltaX > 0 && currentIndex.value > 0) {
      currentIndex.value--
    }
  }
  deltaX = 0
}
</script>

<style scoped>
/* 防止子内容不换行 */
.flex > * {
  flex-shrink: 0;
  width: 100%;
}
</style>
