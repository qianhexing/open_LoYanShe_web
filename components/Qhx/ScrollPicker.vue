<template>
  <div class="scroll-picker flex-1 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-600/60 relative">
    <div
      ref="pickerRef"
      class="overflow-y-auto cursor-grab active:cursor-grabbing scroll-picker-inner"
      :class="{ 'is-dragging': isDragging }"
      :style="{ height: viewportHeight + 'px' }"
      @scroll.passive="onScroll"
      @wheel.stop.passive
      @mousedown.prevent="startDrag"
    >
      <div aria-hidden="true" :style="{ height: paddingY + 'px' }" />
      <div
        v-for="(item, i) in items"
        :key="getItemKey(item, i)"
        class="picker-item text-center truncate px-1 select-none"
        :class="
          activeIndex === i
            ? 'font-semibold text-qhx-primary'
            : 'text-gray-500 dark:text-gray-400'
        "
        :style="{ height: itemHeight + 'px', lineHeight: itemHeight + 'px' }"
        @click="onItemClick(i)"
      >
        {{ getLabel(item) }}
      </div>
      <div aria-hidden="true" :style="{ height: paddingY + 'px' }" />
    </div>
    <div
      class="picker-highlight pointer-events-none absolute left-0 right-0 border-y-2 border-qhx-primary"
      :style="highlightStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

interface PickerItem {
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    modelValue?: number
    items: PickerItem[]
    itemHeight?: number
    visibleCount?: number
    labelKey?: string
  }>(),
  {
    modelValue: 0,
    itemHeight: 40,
    visibleCount: 5,
    labelKey: 'label'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: number): void
  (e: 'update:index', v: number): void
  (e: 'change', item: PickerItem): void
}>()

const pickerRef = ref<HTMLElement>()
/** 当前高亮索引（跟手展示） */
const activeIndex = ref(0)

/** 来自用户滚动的更新，避免 watch 回写 scrollTop */
let updatingFromScroll = false
/** 程序化定位中，忽略 scroll 回调 */
let programmaticScroll = false
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null
let dragMoved = false
let programmaticUnlockTimer: ReturnType<typeof setTimeout> | null = null

const isDragging = ref(false)
let lastY = 0
let dragStartY = 0

const itemHeight = computed(() => props.itemHeight)
const viewportHeight = computed(() => props.itemHeight * props.visibleCount)
const paddingY = computed(
  () => (props.itemHeight * props.visibleCount) / 2 - props.itemHeight / 2
)
const highlightStyle = computed(() => ({
  top: '50%',
  transform: 'translateY(-50%)',
  height: `${props.itemHeight}px`
}))

const clampedModel = computed(() =>
  Math.min(Math.max(0, props.modelValue ?? 0), Math.max(0, props.items.length - 1))
)

function getLabel(item: PickerItem) {
  return item[props.labelKey as keyof PickerItem] ?? String(item.value)
}

function getItemKey(item: PickerItem, i: number) {
  return `${item.value}-${i}`
}

function indexFromScrollTop(scrollTop: number) {
  const i = Math.round(scrollTop / props.itemHeight)
  return Math.min(props.items.length - 1, Math.max(0, i))
}

function scrollTopForIndex(i: number) {
  return i * props.itemHeight
}

function emitIndex(i: number) {
  if (i === (props.modelValue ?? 0)) return
  updatingFromScroll = true
  emit('update:modelValue', i)
  emit('update:index', i)
  if (props.items[i]) emit('change', props.items[i])
  nextTick(() => {
    updatingFromScroll = false
  })
}

function setScrollTop(top: number, smooth = false) {
  const el = pickerRef.value
  if (!el) return
  programmaticScroll = true
  if (programmaticUnlockTimer) clearTimeout(programmaticUnlockTimer)

  if (smooth && typeof el.scrollTo === 'function') {
    el.scrollTo({ top, behavior: 'smooth' })
    programmaticUnlockTimer = setTimeout(() => {
      programmaticScroll = false
      programmaticUnlockTimer = null
    }, 320)
  } else {
    el.scrollTop = top
    requestAnimationFrame(() => {
      programmaticScroll = false
    })
  }
}

function syncScrollToModel(smooth = false) {
  const i = clampedModel.value
  activeIndex.value = i
  const el = pickerRef.value
  if (!el) return
  const target = scrollTopForIndex(i)
  if (Math.abs(el.scrollTop - target) < 1) return
  setScrollTop(target, smooth)
}

function onScroll() {
  const el = pickerRef.value
  if (!el || programmaticScroll) return

  const i = indexFromScrollTop(el.scrollTop)
  if (i !== activeIndex.value) activeIndex.value = i
  emitIndex(i)

  // 拖拽中不吸附，避免与手动 scrollTop 抢位置
  if (isDragging.value) return

  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    scrollEndTimer = null
    snapToNearest()
  }, 90)
}

function snapToNearest() {
  const el = pickerRef.value
  if (!el || programmaticScroll || isDragging.value) return
  const i = indexFromScrollTop(el.scrollTop)
  activeIndex.value = i
  emitIndex(i)
  const target = scrollTopForIndex(i)
  if (Math.abs(el.scrollTop - target) > 0.5) {
    setScrollTop(target, true)
  }
}

function onItemClick(i: number) {
  if (dragMoved) return
  activeIndex.value = i
  emitIndex(i)
  setScrollTop(scrollTopForIndex(i), true)
}

function startDrag(e: MouseEvent) {
  if (e.button !== 0 || !pickerRef.value) return
  isDragging.value = true
  dragMoved = false
  lastY = e.clientY
  dragStartY = e.clientY
  // 同步关闭 snap，避免等 class 生效前被浏览器吸回
  pickerRef.value.style.scrollSnapType = 'none'
  if (scrollEndTimer) {
    clearTimeout(scrollEndTimer)
    scrollEndTimer = null
  }
  window.addEventListener('mousemove', onMouseMove, { passive: false })
  window.addEventListener('mouseup', onMouseUp, { once: true })
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value || !pickerRef.value) return
  e.preventDefault()
  const delta = e.clientY - lastY
  if (Math.abs(e.clientY - dragStartY) > 3) dragMoved = true
  // 拖拽时直接改 scrollTop，并同步高亮（不依赖 snap）
  pickerRef.value.scrollTop -= delta
  lastY = e.clientY
  const i = indexFromScrollTop(pickerRef.value.scrollTop)
  if (i !== activeIndex.value) {
    activeIndex.value = i
    emitIndex(i)
  }
}

function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  if (pickerRef.value) pickerRef.value.style.scrollSnapType = ''
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    scrollEndTimer = null
    snapToNearest()
    requestAnimationFrame(() => {
      dragMoved = false
    })
  }, 50)
}

watch(
  () => props.modelValue,
  () => {
    if (updatingFromScroll) return
    syncScrollToModel(false)
  }
)

watch(
  () => props.items,
  async () => {
    if (updatingFromScroll) return
    await nextTick()
    syncScrollToModel(false)
  }
)

onMounted(async () => {
  await nextTick()
  syncScrollToModel(false)
})

onBeforeUnmount(() => {
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  if (programmaticUnlockTimer) clearTimeout(programmaticUnlockTimer)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<style scoped>
.scroll-picker-inner {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-snap-type: y proximity;
  touch-action: pan-y;
  user-select: none;
}

.scroll-picker-inner.is-dragging {
  /* 拖拽时关闭 snap，否则浏览器会把 scrollTop 吸回去导致拖不动 */
  scroll-snap-type: none;
  cursor: grabbing;
}

.scroll-picker-inner::-webkit-scrollbar {
  display: none;
}

.picker-item {
  scroll-snap-align: center;
}
</style>
