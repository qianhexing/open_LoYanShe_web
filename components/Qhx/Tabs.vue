<template>
  <div class="w-full overflow-hidden" ref="rootRef">
    <!-- Tabs Header -->
    <div
      ref="tabsWrapper"
      class="tabs-header border-b border-gray-200 p-2 overflow-x-auto overflow-y-hidden bg-white transition-all"
      :class="{ 'tabs-header-scrolling': isScrolling }"
      :style="{
        position: isFixed ? 'fixed' : 'relative',
        top: isFixed ? sticky_offset + 'px' : 'auto',
        left: isFixed ? fixedLeft + 'px' : 'auto',
        width: isFixed ? fixedWidth + 'px' : '100%',
        zIndex: isFixed ? 999 : 'auto'
      }"
    >
      <div class="relative inline-flex">
        <slot name="header" :currentIndex="currentIndex" :goTo="goTo">
          <!-- 默认的 tab 按钮 -->
          <button
            v-for="(tab, i) in tabs"
            :key="i"
            @click="goTo(i)"
            ref="tabItems"
            class="py-2 px-4 text-center transition-all duration-200 tab-list whitespace-nowrap relative z-10 shrink-0"
            :class="{
              'text-qhx-primary font-semibold': currentIndex === i,
              'text-gray-500': currentIndex !== i
            }"
          >
            {{ tab }}
          </button>
        </slot>
        <!-- 滑动指示器 -->
        <div
          v-if="tabItems.length > 0"
          class="tabs-indicator"
          :style="indicatorStyle"
        />
      </div>
    </div>

    <!-- 占位：仅在 fixed 时才出现 -->
    <div
      v-if="isFixed"
      :style="{ height: placeholderHeight + 'px' }"
    ></div>

    <!-- Panels Container -->
    <div
      class="flex panels-container"
      :class="{ 'panels-dragging': isDragging }"
      :style="panelsTransformStyle"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'

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
// 滑动逻辑（实时跟随 + 边界弹性）
// ========================
let startX = 0
const isDragging = ref(false)
const swipeOffset = ref(0)
const containerWidth = ref(300) // 默认值，onMounted 时更新

const DRAG_THRESHOLD = 200
const RUBBER_BAND_FACTOR = 0.35 // 边界弹性系数

const panelsTransformStyle = computed(() => {
  const basePercent = currentIndex.value * 100
  const swipePercent = (swipeOffset.value / containerWidth.value) * 100
  const totalPercent = basePercent - swipePercent
  return {
    transform: `translateX(-${totalPercent}%)`
  }
})

// 滑动指示器：跟随 currentIndex 平滑滑动
const indicatorStyle = computed(() => {
  if (tabItems.value.length === 0) return {}
  const items = tabItems.value
  const active = items[currentIndex.value]
  if (!active) return { left: '0px', width: '40px' }
  return {
    left: `${active.offsetLeft}px`,
    width: `${active.offsetWidth}px`
  }
})

const applyRubberBand = (rawDelta: number): number => {
  const max = props.tabs.length
  const atStart = currentIndex.value <= 0 && rawDelta > 0
  const atEnd = currentIndex.value >= max - 1 && rawDelta < 0
  if (atStart || atEnd) {
    return rawDelta * RUBBER_BAND_FACTOR
  }
  return rawDelta
}

const handleTouchStart = (e: TouchEvent) => {
  if (!props.need_swipe) return
  startX = e.touches[0].clientX
  isDragging.value = true
  swipeOffset.value = 0
  if (rootRef.value) {
    containerWidth.value = rootRef.value.offsetWidth
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (!props.need_swipe || !isDragging.value) return
  const rawDelta = e.touches[0].clientX - startX
  swipeOffset.value = applyRubberBand(rawDelta)
}

const handleTouchEnd = () => {
  if (!props.need_swipe) return
  isDragging.value = false

  const delta = swipeOffset.value
  if (Math.abs(delta) > DRAG_THRESHOLD) {
    if (delta < 0 && currentIndex.value < props.tabs.length - 1) {
      currentIndex.value++
    } else if (delta > 0 && currentIndex.value > 0) {
      currentIndex.value--
    }
    emit('change', currentIndex.value)
  }
  swipeOffset.value = 0
}

// 桌面端：鼠标按下并拖动
const handleMouseDown = (e: MouseEvent) => {
  if (!props.need_swipe) return
  startX = e.clientX
  isDragging.value = true
  swipeOffset.value = 0
  if (rootRef.value) containerWidth.value = rootRef.value.offsetWidth

  const onMove = (e: MouseEvent) => {
    const rawDelta = e.clientX - startX
    swipeOffset.value = applyRubberBand(rawDelta)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    handleTouchEnd()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ========================
// 滚动吸顶逻辑（新增 placeholder）
// ========================
const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null

const handleHeaderScroll = () => {
  isScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    isScrolling.value = false
  }, 800)
}

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
  tabsWrapper.value?.addEventListener('scroll', handleHeaderScroll)

  if (props.sticky && tabsWrapper.value) {
    // 记录原始高度
    placeholderHeight.value = tabsWrapper.value.offsetHeight

    fixedWidth.value = tabsWrapper.value.offsetWidth
    window.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  tabsWrapper.value?.removeEventListener('scroll', handleHeaderScroll)
  if (scrollTimer) clearTimeout(scrollTimer)
})
</script>

<style scoped>
/* 防止子内容不换行 */
.panels-container .flex > *,
.flex > * {
  flex-shrink: 0;
  width: 100%;
}

/* 滑动切换：松手时使用流畅动画 */
.panels-container {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

/* 拖动时禁用过渡，实现实时跟随 */
.panels-container.panels-dragging {
  transition: none;
  cursor: grabbing;
  user-select: none;
}

/* Tab 头部：紧凑布局，超出滚动 */
.tabs-header {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.tabs-header.tabs-header-scrolling {
  scrollbar-color: rgb(203 213 225) transparent;
}
.tabs-header::-webkit-scrollbar {
  height: 4px;
}
.tabs-header::-webkit-scrollbar-track {
  background: transparent;
}
.tabs-header::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}
.tabs-header.tabs-header-scrolling::-webkit-scrollbar-thumb {
  background: rgb(203 213 225);
}
.tabs-header::-webkit-scrollbar-thumb {
  transition: background 0.2s ease;
}

/* 底部滑动指示器 */
.tabs-indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  @apply bg-qhx-primary;
  border-radius: 1px;
  transition: left 0.25s cubic-bezier(0.32, 0.72, 0, 1),
    width 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}
</style>
