<script setup lang="ts">
import { ref, onMounted, watch, defineProps, withDefaults, defineEmits, defineExpose, nextTick } from 'vue'

interface Props {
  options: optionsInterface[]
  defaultValue?: optionsInterface | null
  canCustomize?: boolean
  maxLength?: number
}
export interface optionsInterface {
  label: string,
  value: number | string
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [] as optionsInterface[],
  defaultValue: null,
  canCustomize: false,
  maxLength: 8
})
const customize = ref('') // 自定义词条
const show = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const selectedIndex = ref(0)
const selected = ref(props.defaultValue || (props.options.length ? props.options[0] : ''))
const isDrag = ref(false) // 判断是点击还是拖拽
const banScroll = ref(false)
const isDragging = ref(false)
const emit = defineEmits(['change', 'open', 'select'])

const showPicker = (e: MouseEvent) => {
  if (e) {
    clickPosition.value = {
      x: e.clientX, y: e.clientY
    }
  }
  show.value = true
  emit('open')
  isDrag.value = true
  nextTick(() => scrollToSelected())
}

defineExpose({ showPicker })

// 滚动相关：使用 padding 使选中项居中
const pickerRef = ref<HTMLDivElement>()
const itemHeight = 40
const visibleCount = 10
const paddingTop = (itemHeight * visibleCount) / 2 - itemHeight / 2

const scrollToSelected = () => {
  if (!pickerRef.value) return
  banScroll.value = true
  scrollToIndex(selectedIndex.value)
  setTimeout(() => {
    banScroll.value = false
  }, 250)
}

const onScroll = () => {
  if (!pickerRef.value) return
  if (banScroll.value) return
  const scrollTop = pickerRef.value.scrollTop
  const viewportCenter = scrollTop + (itemHeight * visibleCount) / 2
  const index = Math.round((viewportCenter - paddingTop - itemHeight / 2) / itemHeight)
  const clampedIndex = Math.min(props.options.length - 1, Math.max(0, index))
  selectedIndex.value = clampedIndex
  selected.value = props.options[clampedIndex]
  emit('change', selected.value)
}

const updateSelected = () => {
  if (!pickerRef.value) return
  const scrollTop = pickerRef.value.scrollTop
  const viewportCenter = scrollTop + (itemHeight * visibleCount) / 2
  const index = Math.round((viewportCenter - paddingTop - itemHeight / 2) / itemHeight)
  selectedIndex.value = Math.min(Math.max(index, 0), props.options.length - 1)
  selected.value = props.options[selectedIndex.value]
  emit('change', selected.value)
}

// 拖拽惯性滚动（鼠标+触摸）
let startY = 0
let lastY = 0
let velocity = 0
let animationFrame: number

const startDrag = (y: number) => {
  if (!pickerRef.value) return
  isDragging.value = true
  isDrag.value = true
  startY = y
  lastY = y
  cancelAnimationFrame(animationFrame)
}

const moveDrag = (y: number) => {
  isDrag.value = false
  if (!isDragging.value || !pickerRef.value) return
  const delta = y - lastY
  pickerRef.value.scrollTop -= delta
  velocity = delta
  lastY = y
  updateSelected()
}

const endDrag = () => {
  isDragging.value = false
  const deceleration = 0.92
  const step = () => {
    if (!pickerRef.value) return
    velocity *= deceleration
    if (Math.abs(velocity) < 0.5) {
      const viewportCenter = pickerRef.value.scrollTop + (itemHeight * visibleCount) / 2
      const index = Math.round((viewportCenter - paddingTop - itemHeight / 2) / itemHeight)
      const clampedIndex = Math.min(props.options.length - 1, Math.max(0, index))
      const target = paddingTop + clampedIndex * itemHeight + itemHeight / 2 - (itemHeight * visibleCount) / 2
      smoothScroll(pickerRef.value.scrollTop, target, 220)
      return
    }
    pickerRef.value.scrollTop -= velocity
    animationFrame = requestAnimationFrame(step)
  }
  animationFrame = requestAnimationFrame(step)
}

// easeOutCubic 缓动
const smoothScroll = (from: number, to: number, duration: number) => {
  const startTime = performance.now()
  const animate = (time: number) => {
    const t = Math.min((time - startTime) / duration, 1)
    const eased = 1 - (1 - t) ** 3
    if (!pickerRef.value) return
    pickerRef.value.scrollTop = from + (to - from) * eased
    if (t < 1) requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
}

const scrollToIndex = (index: number) => {
  if (!pickerRef.value) return
  const clampedIndex = Math.min(props.options.length - 1, Math.max(0, index))
  const target = paddingTop + clampedIndex * itemHeight + itemHeight / 2 - (itemHeight * visibleCount) / 2
  banScroll.value = true
  selectedIndex.value = clampedIndex
  selected.value = props.options[clampedIndex]
  smoothScroll(pickerRef.value.scrollTop, target, 220)
  emit('change', selected.value)
  setTimeout(() => { banScroll.value = false }, 250)
}

// 鼠标事件
const onMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  startDrag(e.clientY)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp, { once: true })
}

const onMouseMove = (e: MouseEvent) => moveDrag(e.clientY)
const onMouseUp = () => {
  window.removeEventListener('mousemove', onMouseMove)
  endDrag()
}

// 触摸事件
const onTouchStart = (e: TouchEvent) => startDrag(e.touches[0].clientY)
const onTouchMove = (e: TouchEvent) => {
  e.preventDefault()
  moveDrag(e.touches[0].clientY)
}
const onTouchEnd = () => endDrag()

const confirm = () => {
  if (customize.value !== '') {
    emit('select', { value: customize.value, label: customize.value })
  } else {
    emit('select', selected.value)
  }
  customize.value = ''
  show.value = false
}

// 初始化 selectedIndex
const initSelectedIndex = () => {
  const idx = props.options.findIndex(
    opt => opt?.value === (selected.value as optionsInterface)?.value
  )
  selectedIndex.value = idx >= 0 ? idx : 0
  selected.value = props.options[selectedIndex.value] || selected.value
}

watch(
  () => [props.defaultValue, props.options],
  () => {
    if (props.defaultValue) {
      selected.value = props.defaultValue
    } else if (props.options.length) {
      selected.value = props.options[0]
    }
    initSelectedIndex()
    if (show.value) nextTick(() => scrollToSelected())
  },
  { immediate: false }
)

watch(show, (isOpen) => {
  if (isOpen) {
    initSelectedIndex()
    nextTick(() => scrollToSelected())
  }
})

onMounted(() => {
  initSelectedIndex()
  nextTick(() => scrollToSelected())
})
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div class="w-[95vw] max-w-2xl bg-white dark:bg-gray-800 rounded-[12px] overflow-hidden py-4 flex flex-col items-center shadow-xl transition-all duration-200">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">请选择</div>
      <div class="relative w-[400px] max-md:w-[100vw]">
        <div 
          ref="pickerRef" 
          class="select-picker overflow-y-auto relative rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-shadow duration-200"
          :class="[isDragging ? 'cursor-grabbing shadow-inner' : 'cursor-grab active:cursor-grabbing']"
          :style="{ height: itemHeight * visibleCount + 'px' }"
          @mousedown.prevent="onMouseDown"
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend.prevent="onTouchEnd"
          @scroll="onScroll"
        >
          <div :style="{ height: paddingTop + 'px' }" />
          <div>
            <div
              v-for="(opt, i) in props.options"
              :key="i"
              :class="[
                'select-option text-center select-none transition-all duration-200 ease-out',
                selectedIndex === i
                  ? 'font-semibold text-qhx-primary scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
              :style="{ height: itemHeight + 'px', lineHeight: itemHeight + 'px' }"
              @click="scrollToIndex(i)"
            >
              {{ opt.label }}
            </div>
          </div>
          <div :style="{ height: paddingTop + 'px' }" />
        </div>
        <div
          class="select-highlight pointer-events-none absolute left-0 right-0 border-t-2 border-b-2 border-qhx-primary rounded transition-opacity duration-200"
          :style="{ top: '50%', transform: 'translateY(-50%)', height: itemHeight + 'px' }"
        />
      </div>
      <div class="mt-4 flex items-center w-full justify-between">
        <div class="ml-2">
          <UInput
            v-if="canCustomize"
            v-model="customize"
            placeholder="自定义词条"
            class="focus:ring-0"
            :maxlength="props.maxLength"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </div>
        <UButton 
          type="submit"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mx-2 transition-colors duration-200 active:scale-[0.98]"
          @click="confirm"
        >
          确认选择
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.select-picker {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}
.select-picker::-webkit-scrollbar {
  display: none;
}

.select-option {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
</style>
