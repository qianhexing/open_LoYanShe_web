<template>
  <div class="scroll-picker flex-1 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-600/60 relative">
    <div
      ref="pickerRef"
      class="overflow-y-auto cursor-grab active:cursor-grabbing scroll-picker-inner"
      :style="{ height: itemHeight * visibleCount + 'px' }"
      @scroll.passive="onScroll"
      @mousedown.prevent="startDrag"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
    >
      <div :style="{ height: paddingTop + 'px' }" />
      <div>
        <div
          v-for="(item, i) in items"
          :key="i"
          :class="['text-center truncate px-1', modelIndex === i ? 'font-semibold text-qhx-primary' : 'text-gray-500 dark:text-gray-400']"
          :style="{ height: itemHeight + 'px', lineHeight: itemHeight + 'px' }"
          @click="scrollToIndex(i)"
        >
          {{ getLabel(item) }}
        </div>
      </div>
      <div :style="{ height: paddingBottom + 'px' }" />
    </div>
    <div
      class="picker-highlight pointer-events-none absolute left-0 right-0 border-y-2 border-qhx-primary"
      :style="highlightStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

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
const banScroll = ref(false)

const modelIndex = computed({
  get: () =>
    Math.min(Math.max(0, props.modelValue ?? 0), Math.max(0, props.items.length - 1)),
  set: (v) => {
    emit('update:modelValue', v)
    emit('update:index', v)
    if (props.items[v]) emit('change', props.items[v])
  }
})

const paddingTop = computed(
  () => (props.itemHeight * props.visibleCount) / 2 - props.itemHeight / 2
)
const paddingBottom = computed(
  () => (props.itemHeight * props.visibleCount) / 2 - props.itemHeight / 2
)
const highlightStyle = computed(() => ({
  top: '50%',
  transform: 'translateY(-50%)',
  height: `${props.itemHeight}px`
}))

function getLabel(item: PickerItem) {
  return item[props.labelKey as keyof PickerItem] ?? String(item.value)
}

let isDragging = false
let startY = 0
let lastY = 0

function startDrag(e: MouseEvent) {
  isDragging = true
  startY = e.clientY
  lastY = e.clientY
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp, { once: true })
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging || !pickerRef.value) return
  const delta = e.clientY - lastY
  pickerRef.value.scrollTop -= delta
  lastY = e.clientY
  updateFromScroll()
}

function onMouseUp() {
  isDragging = false
  window.removeEventListener('mousemove', onMouseMove)
}

function onTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY
  lastY = e.touches[0].clientY
}

function onTouchMove(e: TouchEvent) {
  if (!pickerRef.value) return
  const delta = e.touches[0].clientY - lastY
  pickerRef.value.scrollTop -= delta
  lastY = e.touches[0].clientY
  updateFromScroll()
}

function onTouchEnd() {
  // no-op
}

function updateFromScroll() {
  if (!pickerRef.value || banScroll.value) return
  const scrollTop = pickerRef.value.scrollTop
  //  viewport 中心对应的 item 索引：scrollTop + viewportHeight/2 = paddingTop + i*itemHeight + itemHeight/2
  const viewportCenter = scrollTop + (props.itemHeight * props.visibleCount) / 2
  const i = Math.round((viewportCenter - paddingTop.value - props.itemHeight / 2) / props.itemHeight)
  const clamped = Math.min(props.items.length - 1, Math.max(0, i))
  if (clamped !== modelIndex.value) {
    emit('update:modelValue', clamped)
    emit('update:index', clamped)
    if (props.items[clamped]) emit('change', props.items[clamped])
  }
}

const onScroll = () => {
  if (banScroll.value) return
  updateFromScroll()
}

function scrollToIndex(i: number) {
  if (!pickerRef.value) return
  banScroll.value = true
  // 使 item i 的中心对准 viewport 中心
  const target =
    paddingTop.value +
    i * props.itemHeight +
    props.itemHeight / 2 -
    (props.itemHeight * props.visibleCount) / 2
  pickerRef.value.scrollTop = target
  emit('update:modelValue', i)
  emit('update:index', i)
  if (props.items[i]) emit('change', props.items[i])
  setTimeout(() => { banScroll.value = false }, 150)
}

watch(
  () => [props.modelValue, props.items],
  () => {
    if (pickerRef.value && (props.modelValue ?? 0) >= 0) {
      const i = modelIndex.value
      const target =
        paddingTop.value +
        i * props.itemHeight +
        props.itemHeight / 2 -
        (props.itemHeight * props.visibleCount) / 2
      nextTick(() => {
        if (pickerRef.value) pickerRef.value.scrollTop = target
      })
    }
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => {
    if (pickerRef.value) {
      const i = modelIndex.value
      const target =
        paddingTop.value +
        i * props.itemHeight +
        props.itemHeight / 2 -
        (props.itemHeight * props.visibleCount) / 2
      pickerRef.value.scrollTop = target
    }
  })
})
</script>

<style scoped>
.scroll-picker-inner {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scroll-picker-inner::-webkit-scrollbar {
  display: none;
}
</style>
