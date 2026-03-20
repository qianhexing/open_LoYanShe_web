<!-- 悬浮可拖拽按钮，支持插槽，松开自动吸附边界 -->
<template>
  <div
    ref="rootRef"
    class="fixed z-[100] cursor-grab active:cursor-grabbing touch-none select-none"
    :class="{ 'transition-all duration-300 ease-out': !isDragging }"
    :style="buttonStyle"
    @mousedown="onDragStart"
    @touchstart="onDragStart"
    @click.capture="onCaptureClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

type Edge = 'left' | 'right' | 'top' | 'bottom'

type InitialPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'right'

interface Props {
  /** 初始 x 位置，默认贴右 */
  initialX?: number
  /** 初始 y 位置 */
  initialY?: number
  /** 初始位置预设：bottom-left 左下角, right 右侧居中 */
  initialPosition?: InitialPosition
  /** 距边缘的安全距离 */
  margin?: number
  /** 吸附动画时长 ms */
  snapDuration?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialX: undefined,
  initialY: undefined,
  initialPosition: 'right',
  margin: 12,
  snapDuration: 300
})

const emit = defineEmits<{
  dragEnd: [position: { x: number; y: number; edge: Edge }]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const pos = ref({ x: 0, y: 0 })
const startMouse = ref({ x: 0, y: 0 })
const startPos = ref({ x: 0, y: 0 })
const hasDragged = ref(false)
const DRAG_THRESHOLD = 5
const size = ref({ w: 0, h: 0 })
const rafId = ref<number | null>(null)

const updatePosition = (x: number, y: number) => {
  if (rafId.value !== null) cancelAnimationFrame(rafId.value)
  rafId.value = requestAnimationFrame(() => {
    pos.value = { x, y }
    rafId.value = null
  })
}

/** 计算最近边缘并返回吸附后的位置 */
const snapToEdge = (): { x: number; y: number; edge: Edge } => {
  const m = props.margin
  const { w, h } = size.value
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600

  const cx = pos.value.x + w / 2
  const cy = pos.value.y + h / 2

  const distLeft = cx
  const distRight = vw - cx
  const distTop = cy
  const distBottom = vh - cy

  const minDist = Math.min(distLeft, distRight, distTop, distBottom)

  if (minDist === distLeft) {
    return { x: m, y: pos.value.y, edge: 'left' }
  }
  if (minDist === distRight) {
    return { x: vw - w - m, y: pos.value.y, edge: 'right' }
  }
  if (minDist === distTop) {
    return { x: pos.value.x, y: m, edge: 'top' }
  }
  return { x: pos.value.x, y: vh - h - m, edge: 'bottom' }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const onDragStart = (e: MouseEvent | TouchEvent) => {
  if (!rootRef.value) return
  hasDragged.value = false
  isDragging.value = true
  const isTouch = 'touches' in e
  const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
  const clientY = isTouch ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
  startMouse.value = { x: clientX, y: clientY }
  startPos.value = { ...pos.value }
}

const onMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !rootRef.value) return
  const isTouch = 'touches' in e
  const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
  const clientY = isTouch ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
  const dx = clientX - startMouse.value.x
  const dy = clientY - startMouse.value.y
  if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) hasDragged.value = true

  const m = props.margin
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { w, h } = size.value

  const nx = clamp(startPos.value.x + dx, m, vw - w - m)
  const ny = clamp(startPos.value.y + dy, m, vh - h - m)

  updatePosition(nx, ny)
}

const onCaptureClick = (e: MouseEvent) => {
  if (hasDragged.value) {
    e.preventDefault()
    e.stopPropagation()
  }
}

const onDragEnd = () => {
  if (!isDragging.value || !rootRef.value) return
  isDragging.value = false
  const snapped = snapToEdge()
  pos.value = { x: snapped.x, y: snapped.y }
  emit('dragEnd', snapped)
}

const initPosition = () => {
  if (typeof window === 'undefined') return
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { w, h } = size.value
  const m = props.margin

  if (props.initialX !== undefined && props.initialY !== undefined) {
    pos.value = {
      x: clamp(props.initialX, m, vw - w - m),
      y: clamp(props.initialY, m, vh - h - m)
    }
  } else if (props.initialPosition === 'bottom-left') {
    pos.value = { x: m, y: vh - h - m }
  } else if (props.initialPosition === 'bottom-right') {
    pos.value = { x: vw - w - m, y: vh - h - m }
  } else if (props.initialPosition === 'top-left') {
    pos.value = { x: m, y: m }
  } else if (props.initialPosition === 'top-right') {
    pos.value = { x: vw - w - m, y: m }
  } else {
    pos.value = { x: vw - w - m, y: vh / 2 - h / 2 }
  }
}

const observeSize = (): (() => void) | undefined => {
  if (!rootRef.value || typeof ResizeObserver === 'undefined') return undefined
  const ro = new ResizeObserver(() => {
    if (rootRef.value) {
      const rect = rootRef.value.getBoundingClientRect()
      size.value = { w: rect.width, h: rect.height }
    }
  })
  ro.observe(rootRef.value)
  return () => ro.disconnect()
}

const buttonStyle = computed(() => ({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  transform: 'none'
}))

let resizeCleanup: (() => void) | undefined

onMounted(async () => {
  await nextTick()
  if (rootRef.value) {
    const rect = rootRef.value.getBoundingClientRect()
    size.value = { w: rect.width, h: rect.height }
    initPosition()
  }
  resizeCleanup = observeSize()
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onDragEnd)
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onDragEnd)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onDragEnd)
  resizeCleanup?.()
})
</script>
