<script setup lang="ts">
import { ref, onMounted, defineProps, withDefaults, defineEmits, defineExpose, nextTick } from 'vue'

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
  options: [],
  defaultValue: null,
  canCustomize: false,
  maxLength: 8
})
const listRef = ref<HTMLElement | null>(null)
const customize = ref('') // 自定义词条
const show = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const selectedIndex = ref(0)
const selected = ref(props.defaultValue || (props.options.length ? props.options[0] : ''))
const isDrag = ref(false) // 判断是点击还是拖拽
const banScorll = ref(false)
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

// 滚动相关
const pickerRef = ref<HTMLDivElement>()
const itemHeight = 40
const visibleCount = 10

const scrollToSelected = () => {
  if (!pickerRef.value) return
  banScorll.value = true
  // const scrollTop = selectedIndex.value * itemHeight
  // pickerRef.value.scrollTop = scrollTop - Math.floor(visibleCount/2) * itemHeight
  scrollToIndex(selectedIndex.value)
  setTimeout(() => {
    banScorll.value = false
  }, 200);
}

const onScroll = () => {
  if (!listRef.value) return
  if (banScorll.value) return
  const scrollTop = listRef.value.scrollTop
  const index = Math.round(scrollTop / itemHeight)
  const clampedIndex = Math.min(props.options.length - 1, Math.max(0, index))
  selected.value = props.options[clampedIndex]
  updateSelected()
  emit('change', selected.value) // 这里实时触发 change
}


const updateSelected = () => {
  if (!pickerRef.value) return
  const scrollTop = pickerRef.value.scrollTop
  const index = Math.round(scrollTop / itemHeight)
  selectedIndex.value = Math.min(Math.max(index, 0), props.options.length - 1)
  selected.value = props.options[selectedIndex.value]
  emit('change', selected.value)
}

// 拖拽惯性滚动（鼠标+触摸）
let isDragging = false
let startY = 0
let lastY = 0
let velocity = 0
let animationFrame: number

const startDrag = (y: number) => {
  if (!pickerRef.value) return
  isDragging = true
  isDrag.value = true
  startY = y
  lastY = y
  cancelAnimationFrame(animationFrame)
}

const moveDrag = (y: number) => {
  isDrag.value = false
  if (!isDragging || !pickerRef.value) return
  const delta = y - lastY
  pickerRef.value.scrollTop -= delta
  velocity = delta
  lastY = y
  updateSelected()
}

const endDrag = () => {
  isDragging = false
  const deceleration = 0.95

  const step = () => {
    if (!pickerRef.value) return
    velocity *= deceleration
    if (Math.abs(velocity) < 0.1) {
      const index = Math.round(pickerRef.value.scrollTop / itemHeight)
      const target = index * itemHeight
      smoothScroll(pickerRef.value.scrollTop, target, 200)
      return
    }
    pickerRef.value.scrollTop -= velocity
    animationFrame = requestAnimationFrame(step)
  }
  animationFrame = requestAnimationFrame(step)
}

// 缓动滚动到目标
const smoothScroll = (from: number, to: number, duration: number) => {
  const startTime = performance.now()
  const animate = (time: number) => {
    const t = Math.min((time - startTime) / duration, 1)
    const eased = t*(2-t) // easeOutQuad
    if (!pickerRef.value) return
    pickerRef.value.scrollTop = from + (to - from) * eased
    if (t < 1) requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
}

const scrollToIndex = (index: number) => {
  if (!listRef.value) return
  if (!pickerRef.value) return
  if (!isDrag.value) return
  const itemHeight = 40 // 和滚动处理函数里一致
  listRef.value.scrollTop = index * itemHeight
  selected.value = props.options[index]
  // updateSelected()
  const target = index * itemHeight
	smoothScroll(pickerRef.value.scrollTop, target, 200)
  emit('change', selected.value)
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
    emit('select', { value: customize.value, label: customize.value})
  } else {
    emit('select', selected.value)
  }
  customize.value = ''
  show.value = false
  
}
onMounted(() => {
  scrollToSelected()
})
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div class=" w-[95vw] max-w-2xl bg-white rounded-[10px] overflow-hidden py-4 flex flex-col items-center">
      <div class="text-xm mb-4">请选择</div>
      <div 
        ref="pickerRef" 
        class="w-[400px] max-md:w-[100vw] overflow-y-scroll relative border-gray-200 rounded cursor-grab"
        :style="{ height: itemHeight * visibleCount + 'px' }"
        @mousedown.prevent="onMouseDown"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend.prevent="onTouchEnd"
        @scroll="onScroll"
      >
        <div style="height: calc(50% - 20px)"></div>
        <div 
          ref="listRef" 
        >
          <div v-for="(opt, i) in props.options" :key="i"
              :class="['text-center', selectedIndex === i ? 'font-bold text-black text-lg' : 'text-gray-500']"
              :style="{ height: itemHeight + 'px', lineHeight: itemHeight + 'px' }"
               @click="scrollToIndex(i)"
          >
            {{ opt.label }}
          </div>
        </div>
        <div style="height: calc(50% - 20px)"></div>
      </div>
      <div class="absolute top-[calc(50%-8px)] left-0 w-full border-t-2 border-b-2 border-qhx-primary pointer-events-none"
            :style="{ transform: 'translateY(-50%)', height: itemHeight + 'px' }"></div>
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
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mx-2"
          @click="confirm"
        >
          确认选择
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
div::-webkit-scrollbar {
  display: none;
}
</style>
