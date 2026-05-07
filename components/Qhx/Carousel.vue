<!--
  Qhx 通用轮播：触控/鼠标拖动、指示点、可选箭头与自动播放，样式与站点 qhx 主题一致。
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export interface QhxCarouselItem {
  src: string
  alt?: string
  /** 点击整页跳转（可选） */
  href?: string
}

const props = withDefaults(
  defineProps<{
    /** 轮播数据；与 #item 插槽一起使用时传入 */
    items?: readonly QhxCarouselItem[]
    /** 当前页索引，不传则为非受控 */
    modelValue?: number
    /** 自动播放间隔（毫秒），0 表示关闭 */
    autoplay?: number
    /** 是否在末尾回到首张 */
    loop?: boolean
    /** 是否显示底部指示点 */
    indicators?: boolean
    /** 是否显示左右箭头（小屏可配合 CSS 隐藏） */
    arrows?: boolean
    /** 交互或悬停时暂停自动播放 */
    pauseOnInteraction?: boolean
    /** 根节点额外 class */
    rootClass?: string
  }>(),
  {
    items: () => [],
    autoplay: 0,
    loop: true,
    indicators: true,
    arrows: false,
    pauseOnInteraction: true,
    rootClass: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [index: number]
  change: [index: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const localIndex = ref(0)
const isDragging = ref(false)
const swipeOffset = ref(0)
const containerWidth = ref(320)
const autoplayPaused = ref(false)

const DRAG_THRESHOLD = 56
const RUBBER_BAND_FACTOR = 0.35

const slideCount = computed(() => Math.max(0, props.items.length))

function clampIndex(i: number): number {
  const n = slideCount.value
  if (n <= 0) return 0
  if (!props.loop) return Math.min(Math.max(0, i), n - 1)
  return ((i % n) + n) % n
}

const currentIndex = computed(() => {
  const v = props.modelValue
  if (v !== undefined) return clampIndex(v)
  return clampIndex(localIndex.value)
})

function setIndex(index: number) {
  const next = clampIndex(index)
  if (props.modelValue !== undefined) {
    emit('update:modelValue', next)
  } else {
    localIndex.value = next
  }
  emit('change', next)
}

function goPrev() {
  const n = slideCount.value
  if (n <= 0) return
  if (!props.loop && currentIndex.value <= 0) return
  setIndex(currentIndex.value - 1)
}

function goNext() {
  const n = slideCount.value
  if (n <= 0) return
  if (!props.loop && currentIndex.value >= n - 1) return
  setIndex(currentIndex.value + 1)
}

watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined) localIndex.value = clampIndex(v)
  }
)

watch(slideCount, (n) => {
  if (n === 0) return
  if (currentIndex.value >= n) setIndex(n - 1)
})

const trackTransformStyle = computed(() => {
  const basePercent = currentIndex.value * 100
  const swipePercent = (swipeOffset.value / Math.max(containerWidth.value, 1)) * 100
  return {
    transform: `translate3d(-${basePercent - swipePercent}%, 0, 0)`
  }
})

function applyRubberBand(rawDelta: number): number {
  const n = slideCount.value
  if (n <= 1) return rawDelta * RUBBER_BAND_FACTOR
  if (props.loop) return rawDelta
  const atStart = currentIndex.value <= 0 && rawDelta > 0
  const atEnd = currentIndex.value >= n - 1 && rawDelta < 0
  if (atStart || atEnd) return rawDelta * RUBBER_BAND_FACTOR
  return rawDelta
}

let dragStartX = 0

function refreshWidth() {
  if (rootRef.value) {
    containerWidth.value = rootRef.value.offsetWidth
  }
}

function onDragStart(clientX: number) {
  if (slideCount.value <= 1) return
  dragStartX = clientX
  isDragging.value = true
  swipeOffset.value = 0
  refreshWidth()
  if (props.pauseOnInteraction) autoplayPaused.value = true
}

function onDragMove(clientX: number) {
  if (!isDragging.value || slideCount.value <= 1) return
  const rawDelta = clientX - dragStartX
  swipeOffset.value = applyRubberBand(rawDelta)
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  const delta = swipeOffset.value
  if (Math.abs(delta) > DRAG_THRESHOLD) {
    if (delta < 0) goNext()
    else goPrev()
  }
  swipeOffset.value = 0
}

function handleTouchStart(e: TouchEvent) {
  onDragStart(e.touches[0].clientX)
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  onDragMove(e.touches[0].clientX)
}

function handleTouchEnd() {
  onDragEnd()
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  onDragStart(e.clientX)
  const onMove = (ev: MouseEvent) => onDragMove(ev.clientX)
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    onDragEnd()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

let autoplayTimer: ReturnType<typeof setInterval> | null = null

function startAutoplay() {
  stopAutoplay()
  if (!import.meta.client) return
  if (!props.autoplay || props.autoplay <= 0 || slideCount.value <= 1) return
  autoplayTimer = setInterval(() => {
    if (autoplayPaused.value) return
    goNext()
  }, props.autoplay)
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

watch(
  () => [props.autoplay, slideCount.value] as const,
  () => startAutoplay(),
  { immediate: true }
)

onMounted(() => {
  refreshWidth()
  if (import.meta.client) {
    window.addEventListener('resize', refreshWidth)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', refreshWidth)
  }
  stopAutoplay()
})

function onRootEnter() {
  if (props.pauseOnInteraction) autoplayPaused.value = true
}

function onRootLeave() {
  if (props.pauseOnInteraction) autoplayPaused.value = false
}

function onIndicatorClick(i: number) {
  setIndex(i)
  if (props.pauseOnInteraction) {
    autoplayPaused.value = true
  }
}

defineExpose({
  goPrev,
  goNext,
  setIndex
})
</script>

<template>
  <div
    v-if="slideCount > 0"
    ref="rootRef"
    class="qhx-carousel relative w-full overflow-hidden rounded-[18px] bg-qhx-bg-card shadow-lg select-none"
    :class="rootClass"
    role="region"
    aria-roledescription="carousel"
    @mouseenter="onRootEnter"
    @mouseleave="onRootLeave"
  >
    <div
      class="qhx-carousel-track flex touch-pan-y"
      :class="{ 'qhx-carousel-track--dragging': isDragging }"
      :style="trackTransformStyle"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        class="qhx-carousel-slide shrink-0 w-full"
        role="group"
        :aria-roledescription="`第 ${i + 1} 张，共 ${slideCount} 张`"
        :aria-hidden="i !== currentIndex"
      >
        <slot
          name="item"
          :item="item"
          :index="i"
          :active="i === currentIndex"
        >
          <component
            :is="item.href ? 'a' : 'div'"
            v-bind="item.href ? { href: item.href } : {}"
            class="block h-full w-full outline-none"
          >
            <img
              :src="item.src"
              :alt="item.alt ?? ''"
              class="h-full w-full object-cover"
              draggable="false"
              :loading="i === 0 ? 'eager' : 'lazy'"
            />
          </component>
        </slot>
      </div>
    </div>

    <div
      v-if="arrows && slideCount > 1"
      class="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1"
    >
      <button
        type="button"
        class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow transition hover:bg-black/50 disabled:opacity-30"
        :disabled="!loop && currentIndex <= 0"
        aria-label="上一张"
        @click="goPrev"
      >
        <span class="text-lg leading-none" aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow transition hover:bg-black/50 disabled:opacity-30"
        :disabled="!loop && currentIndex >= slideCount - 1"
        aria-label="下一张"
        @click="goNext"
      >
        <span class="text-lg leading-none" aria-hidden="true">›</span>
      </button>
    </div>

    <div
      v-if="indicators && slideCount > 1"
      class="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-2"
      aria-label="轮播分页"
    >
      <button
        v-for="i in slideCount"
        :key="i - 1"
        type="button"
        class="h-2 w-2 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary"
        :class="
          i - 1 === currentIndex
            ? 'w-5 bg-qhx-primary'
            : 'bg-gray-300/90 hover:bg-gray-400'
        "
        :aria-current="i - 1 === currentIndex ? 'true' : undefined"
        :aria-label="`第 ${i} 张`"
        @click="onIndicatorClick(i - 1)"
      />
    </div>
  </div>
</template>

<style scoped>
.qhx-carousel-track {
  transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}

.qhx-carousel-track--dragging {
  transition: none;
  cursor: grab;
}

.qhx-carousel-track--dragging:active {
  cursor: grabbing;
}
</style>
