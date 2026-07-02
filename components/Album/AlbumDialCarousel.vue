<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

export interface AlbumDialSlide {
  id: string | number
  title: string
  image: string
  locked?: boolean
  isCover?: boolean
}

const props = withDefaults(
  defineProps<{
    slides: AlbumDialSlide[]
    modelValue?: number
    showPreview?: boolean
    angleStep?: number
    arcSpan?: number
  }>(),
  {
    modelValue: 0,
    showPreview: false,
    angleStep: 12,
    arcSpan: 132
  }
)

const emit = defineEmits<{
  'update:modelValue': [index: number]
  change: [index: number]
  select: [index: number, slide: AlbumDialSlide]
}>()

const rootRef = ref<HTMLElement | null>(null)
const dialSize = ref(340)
const isDragging = ref(false)
const dragFraction = ref(0)

const DRAG_THRESHOLD = 0.18
const RUBBER_BAND = 0.28

/** 圆半径 — 大圆只露出顶部弧段 */
const CIRCLE_R_RATIO = 0.54
/** 圆心落在舞台下方的间距系数 */
const CIRCLE_CY_GAP = 0.68
/** 舞台基础高度比例（介于紧凑与全展之间） */
const STAGE_BASE_RATIO = 0.27

/** 卡片 宽3:高4 */
const CARD_W = 54
const CARD_H = 72

const slideCount = computed(() => props.slides.length)

function cardHalfHeight(): number {
  const h = dialSize.value >= 768 ? 83 : CARD_H
  return (h * 1.12) / 2
}

function clampIndex(i: number): number {
  const n = slideCount.value
  if (n <= 0) return 0
  return Math.min(Math.max(0, i), n - 1)
}

const currentIndex = computed(() => clampIndex(props.modelValue ?? 0))
const activeSlide = computed(() => props.slides[currentIndex.value] ?? null)

function circleMetrics() {
  const r = dialSize.value * CIRCLE_R_RATIO
  const cx = dialSize.value / 2
  const cy = stageHeight.value + r * CIRCLE_CY_GAP
  return { r, cx, cy }
}

/** 适中高度：保证选中卡片完整，两侧略露即可 */
const stageHeight = computed(() => {
  const half = cardHalfHeight()
  return Math.ceil(dialSize.value * STAGE_BASE_RATIO + half * 1.55 + 14)
})

function pointOnCircle(angleDeg: number) {
  const { r, cx, cy } = circleMetrics()
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad)
  }
}

function setIndex(index: number) {
  const next = clampIndex(index)
  emit('update:modelValue', next)
  emit('change', next)
}

function applyRubberBand(rawDelta: number): number {
  const atStart = currentIndex.value <= 0 && rawDelta > 0
  const atEnd = currentIndex.value >= slideCount.value - 1 && rawDelta < 0
  if (atStart || atEnd) return rawDelta * RUBBER_BAND
  return rawDelta
}

let dragStartX = 0
let resizeObserver: ResizeObserver | null = null

function refreshSize() {
  if (!rootRef.value) return
  const w = rootRef.value.clientWidth
  if (w > 0) {
    dialSize.value = Math.min(Math.max(w, 280), 520)
  }
}

function getPxPerStep(): number {
  const { r } = circleMetrics()
  const stepRad = (props.angleStep * Math.PI) / 180
  return r * Math.sin(stepRad)
}

function onDragStart(clientX: number) {
  if (slideCount.value <= 1) return
  dragStartX = clientX
  isDragging.value = true
  dragFraction.value = 0
  refreshSize()
}

function onDragMove(clientX: number) {
  if (!isDragging.value || slideCount.value <= 1) return
  const rawDelta = clientX - dragStartX
  const adjusted = applyRubberBand(rawDelta)
  dragFraction.value = -adjusted / getPxPerStep()
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const virtualIndex = currentIndex.value + dragFraction.value
  let next = Math.round(virtualIndex)
  if (Math.abs(dragFraction.value) < DRAG_THRESHOLD) {
    next = currentIndex.value
  }
  next = clampIndex(next)
  dragFraction.value = 0
  if (next !== currentIndex.value) {
    setIndex(next)
  }
}

function handleTouchStart(e: TouchEvent) {
  onDragStart(e.touches[0].clientX)
}

function handleTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  e.preventDefault()
  onDragMove(e.touches[0].clientX)
}

function handleTouchEnd() {
  onDragEnd()
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  e.preventDefault()
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

function getItemStyle(index: number) {
  const offset = index - currentIndex.value - dragFraction.value
  const maxVisible = props.arcSpan / props.angleStep / 2 + 1.2
  if (Math.abs(offset) > maxVisible) {
    return { display: 'none' }
  }

  const angleDeg = 90 - offset * props.angleStep
  const { x, y } = pointOnCircle(angleDeg)
  const dist = Math.abs(offset)
  const scale = Math.max(0.76, 1.1 - dist * 0.13)
  const opacity = Math.max(0.5, 1 - dist * 0.15)
  /** 沿圆弧径向旋转，使卡片贴合轨道 */
  const rotate = 90 - angleDeg

  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
    opacity: String(opacity),
    zIndex: String(Math.round(120 - dist * 12)),
    transition: isDragging.value
      ? 'none'
      : 'left 0.32s cubic-bezier(0.34,1.2,0.64,1), top 0.32s cubic-bezier(0.34,1.2,0.64,1), transform 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.28s ease'
  }
}

function handleItemClick(index: number) {
  if (isDragging.value) return
  if (index !== currentIndex.value) {
    setIndex(index)
  }
}

const pointerStyle = computed(() => {
  const top = pointOnCircle(90)
  return { left: `${top.x}px`, top: `${top.y}px` }
})

function buildArcPath(rScale: number) {
  const { r, cx, cy } = circleMetrics()
  const radius = r * rScale
  const startAngle = 90 + props.arcSpan / 2
  const endAngle = 90 - props.arcSpan / 2
  const toPt = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) }
  }
  const s = toPt(startAngle)
  const e = toPt(endAngle)
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 0 1 ${e.x} ${e.y}`
}

const arcPath = computed(() => buildArcPath(1))
const arcPathInner = computed(() => buildArcPath(0.94))

watch(
  () => props.slides.length,
  () => nextTick(refreshSize)
)

onMounted(async () => {
  await nextTick()
  refreshSize()
  if (import.meta.client && rootRef.value) {
    resizeObserver = new ResizeObserver(refreshSize)
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="rootRef" class="album-dial-carousel w-full select-none">
    <div
      v-if="showPreview && activeSlide"
      class="album-dial-preview relative mx-auto mb-2 overflow-hidden rounded-xl shadow-lg ring-1 ring-gray-200/80"
      :style="{ width: `${Math.min(dialSize * 0.42, 200)}px`, aspectRatio: '3/4' }"
    >
      <img :src="activeSlide.image" :alt="activeSlide.title" class="h-full w-full object-cover" draggable="false" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div class="absolute inset-x-0 bottom-0 px-3 pb-2 pt-6">
        <p class="text-sm font-bold text-white drop-shadow">{{ activeSlide.title }}</p>
      </div>
    </div>

    <div
      class="album-dial-stage relative mx-auto touch-none overflow-hidden"
      :style="{ width: `${dialSize}px`, height: `${stageHeight}px` }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
    >
      <svg
        class="pointer-events-none absolute inset-0"
        :width="dialSize"
        :height="stageHeight"
        :viewBox="`0 0 ${dialSize} ${stageHeight}`"
      >
        <defs>
          <linearGradient id="album-dial-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#7130ae" stop-opacity="0.1" />
            <stop offset="50%" stop-color="#7130ae" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#7130ae" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        <path
          :d="arcPath"
          fill="none"
          stroke="url(#album-dial-arc-grad)"
          stroke-width="5"
          stroke-linecap="round"
          opacity="0.3"
        />
        <path
          :d="arcPath"
          fill="none"
          stroke="url(#album-dial-arc-grad)"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          :d="arcPathInner"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          class="text-qhx-primary/12"
        />
      </svg>

      <div
        class="album-dial-pointer pointer-events-none absolute z-[130]"
        :style="{ left: pointerStyle.left, top: pointerStyle.top, transform: 'translate(-50%, calc(-100% - 3px))' }"
      >
        <div class="flex flex-col items-center gap-0.5">
          <div class="h-0 w-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-qhx-primary drop-shadow-sm" />
          <div class="h-2.5 w-px rounded-full bg-gradient-to-b from-qhx-primary/70 to-transparent" />
        </div>
      </div>

      <div
        class="pointer-events-none absolute z-[90] -translate-x-1/2 -translate-y-1/2 rounded-full bg-qhx-primary/8 blur-lg"
        :style="{
          left: pointerStyle.left,
          top: pointerStyle.top,
          width: `${CARD_W + 20}px`,
          height: `${CARD_H + 12}px`
        }"
      />

      <button
        v-for="(slide, index) in slides"
        :key="slide.id"
        type="button"
        class="album-dial-item absolute overflow-hidden"
        :class="index === currentIndex ? 'album-dial-item--active' : 'album-dial-item--idle'"
        :style="getItemStyle(index)"
        @click="handleItemClick(index)"
      >
        <img :src="slide.image" :alt="slide.title" class="h-full w-full object-cover" draggable="false" />
        <div class="album-dial-item-shine pointer-events-none absolute inset-0" />
        <div v-if="slide.locked" class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/20">
            <UIcon name="i-heroicons-lock-closed" class="h-3 w-3 text-white" />
          </div>
        </div>
        <div
          v-if="slide.isCover"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-0.5 pb-0.5 pt-3 text-center text-[8px] font-semibold tracking-wide text-white"
        >
          封面
        </div>
      </button>

      <p class="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] tracking-wide text-gray-400/90">
        {{ currentIndex + 1 }} / {{ slideCount }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.album-dial-item {
  width: 54px;
  height: 72px;
  aspect-ratio: 3 / 4;
  cursor: grab;
  border-radius: 8px;
  background: #fff;
  transition: box-shadow 0.28s ease;
  transform-origin: center center;
  will-change: transform, left, top;
}

.album-dial-item--idle {
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.1),
    0 0 0 1.5px rgba(255, 255, 255, 0.95);
}

.album-dial-item--active {
  box-shadow:
    0 4px 16px rgba(113, 48, 174, 0.26),
    0 2px 6px rgba(0, 0, 0, 0.1),
    0 0 0 2px #7130ae;
}

.album-dial-item-shine {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
}

.album-dial-stage:active .album-dial-item {
  cursor: grabbing;
}

.album-dial-pointer {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));
}

@media (min-width: 768px) {
  .album-dial-item {
    width: 62px;
    height: 83px;
  }
}
</style>
