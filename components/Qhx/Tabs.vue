<template>
  <div class="w-full overflow-hidden" ref="rootRef">
    <!-- Tabs Header -->
    <div
      ref="tabsWrapper"
      class="border-b border-gray-200 p-2 max-md:flex overflow-x-auto bg-white transition-all"
      :style="{
        position: isFixed ? 'fixed' : 'relative',
        top: isFixed ? sticky_offset + 'px' : 'auto',
        left: isFixed ? fixedLeft + 'px' : 'auto',
        width: isFixed ? fixedWidth + 'px' : '100%',
        zIndex: isFixed ? 999 : 'auto'
      }"
    >
      <slot name="header" :currentIndex="currentIndex" :goTo="goTo">
        <!-- 默认的 tab 按钮 -->
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          @click="goTo(i)"
          ref="tabItems"
          class="py-2 w-auto px-4 text-center transition tab-list whitespace-nowrap"
          :class="{
            'text-qhx-primary border-b-2 border-qhx-primary font-semibold': currentIndex === i,
            'text-gray-500': currentIndex !== i
          }"
        >
          {{ tab }}
        </button>
      </slot>
    </div>

    <!-- 占位：仅在 fixed 时才出现 -->
    <div
      v-if="isFixed"
      :style="{ height: placeholderHeight + 'px' }"
    ></div>

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
import { ref, onMounted, onUnmounted, provide } from 'vue'

const rootRef = ref<HTMLElement | null>(null)
const tabsWrapper = ref<HTMLElement | null>(null)
const tabItems = ref<HTMLElement[]>([])
const totalWidth = ref(0)

// ========================
// 吸顶 props
// ========================
const props = withDefaults(
  defineProps<{
    tabs: string[]
    tab_scroll?: boolean
    need_swipe?: boolean
    sticky?: boolean
    sticky_offset?: number
  }>(),
  {
    tab_scroll: false,
    need_swipe: true,
    sticky: false,
    sticky_offset: 0
  }
)

const emit = defineEmits(['change'])
const currentIndex = ref(0)
provide('currentIndex', currentIndex)

// ========================
// 计算 tab 的总宽度（保持原逻辑）
// ========================
const calculateTotalWidth = () => {
  if (tabItems.value.length > 0) {
    totalWidth.value = tabItems.value.reduce((sum, item) => {
      return sum + item.getBoundingClientRect().width
    }, 0)
  }
}

const goTo = (index: number) => {
  currentIndex.value = index
  emit('change', index)
}

// ========================
// 滑动逻辑（保持原样）
// ========================
let startX = 0
let deltaX = 0

const handleTouchStart = (e: TouchEvent) => {
  if (!props.need_swipe) return
  startX = e.touches[0].clientX
}

const handleTouchMove = (e: TouchEvent) => {
  if (!props.need_swipe) return
  deltaX = e.touches[0].clientX - startX
}

const handleTouchEnd = () => {
  if (!props.need_swipe) return
  if (Math.abs(deltaX) > 50) {
    if (deltaX < 0 && currentIndex.value < props.tabs.length - 1) {
      currentIndex.value++
    } else if (deltaX > 0 && currentIndex.value > 0) {
      currentIndex.value--
    }
    emit('change', currentIndex.value)
  }
  deltaX = 0
}

// ========================
// 滚动吸顶逻辑（新增 placeholder）
// ========================
const isFixed = ref(false)
const fixedLeft = ref(0)
const fixedWidth = ref(0)
const placeholderHeight = ref(0)

let wrapperTop = 0

const handleScroll = () => {
  if (!props.sticky || !tabsWrapper.value) return

  const scrollTop = window.scrollY

  if (!isFixed.value) {
    wrapperTop = tabsWrapper.value.offsetTop
  }

  if (scrollTop + props.sticky_offset >= wrapperTop) {
    if (!isFixed.value) {
      const rect = tabsWrapper.value.getBoundingClientRect()
      fixedLeft.value = rect.left
      fixedWidth.value = rect.width
      placeholderHeight.value = rect.height   // ⭐ 新增：记录高度用于占位
      isFixed.value = true
    }
  } else {
    isFixed.value = false
  }
}

onMounted(() => {
  calculateTotalWidth()

  if (props.sticky && tabsWrapper.value) {
    // 记录原始高度
    placeholderHeight.value = tabsWrapper.value.offsetHeight

    fixedWidth.value = tabsWrapper.value.offsetWidth
    window.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
/* 防止子内容不换行 */
.flex > * {
  flex-shrink: 0;
  width: 100%;
}
</style>
