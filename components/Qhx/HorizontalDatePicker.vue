<template>
  <div class="h-datepicker" :class="{ 'is-compact': compact }">
    <div class="h-header">
      <button class="nav-btn" @click="scrollByDays(-7)" aria-label="上一周">‹</button>
      <div class="h-title">{{ displayMonth }}</div>
      <button class="nav-btn" @click="scrollByDays(7)" aria-label="下一周">›</button>
    </div>

    <div
      ref="scrollerRef"
      class="h-scroller"
      tabindex="0"
      @keydown.left.prevent="onArrow(-1)"
      @keydown.right.prevent="onArrow(1)"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <div class="h-track" :style="{ width: trackWidth + 'px' }">
        <div
          v-for="d in days"
          :key="d.key"
          class="h-cell"
          :class="{
            today: isSameDate(d.date, today),
            active: isSameDate(d.date, modelValueLocal)
          }"
          @click="handleCellClick(d.date)"
        >
          <div class="weekday">{{ d.weekday }}</div>
          <div class="day">{{ d.day }}</div>
          <div class="month" v-if="d.day === 1">{{ d.month }}</div>
        </div>
      </div>
    </div>

    <div class="h-footer">
      <button class="today-btn" @click="goToday">今天</button>
      <div class="picked">已选：{{ formatDate(modelValueLocal) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

type DateInput = Date | string | number | null | undefined

const props = defineProps<{
  modelValue?: DateInput
  rangeDays?: number
  pastDays?: number
  cellWidth?: number
  compact?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: Date): void; (e: 'change', v: Date): void }>()

const cellWidth = computed(() => props.cellWidth ?? 56)
const compact = computed(() => props.compact === true)

const today = startOfDay(new Date())
const initialDate = normalizeToDate(props.modelValue) ?? today
const modelValueLocal = ref<Date>(startOfDay(initialDate))

const pastDays = computed(() => Math.max(0, props.pastDays ?? 15))
const rangeDays = computed(() => Math.max(1, props.rangeDays ?? 60))
const days = computed(() => buildDays(modelValueLocal.value, pastDays.value, rangeDays.value))
const trackWidth = computed(() => days.value.length * cellWidth.value)

const scrollerRef = ref<HTMLDivElement | null>(null)

const displayMonth = computed(() => {
  const d = modelValueLocal.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

// --- 工具函数 ---
function normalizeToDate(input: DateInput): Date | null {
  if (!input) return null
  if (input instanceof Date) return new Date(input.getTime())
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return startOfDay(c)
}
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function buildDays(center: Date, past: number, total: number) {
  const start = addDays(center, -past)
  return Array.from({ length: total }, (_, i) => {
    const d = addDays(start, i)
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
    return {
      key: formatDate(d),
      date: d,
      day: d.getDate(),
      weekday,
      month: `${d.getMonth() + 1}月`
    }
  })
}

// --- 选择逻辑 ---
function selectDate(d: Date) {
  modelValueLocal.value = startOfDay(d)
  emit('update:modelValue', modelValueLocal.value)
  emit('change', modelValueLocal.value)
  scrollIntoView()
}

function handleCellClick(d: Date) {
  // 移动端如果刚刚是滑动操作，则不触发点击
  if (wasTouchScrolling.value) {
    wasTouchScrolling.value = false
    return
  }
  selectDate(d)
}

function goToday() {
  selectDate(today)
}

function onArrow(step: number) {
  const idx = days.value.findIndex(x => isSameDate(x.date, modelValueLocal.value))
  const next = Math.min(Math.max(0, idx + step), days.value.length - 1)
  selectDate(days.value[next].date)
}

function scrollByDays(n: number) {
  const idx = days.value.findIndex(x => isSameDate(x.date, modelValueLocal.value))
  const next = Math.min(Math.max(0, idx + n), days.value.length - 1)
  selectDate(days.value[next].date)
}

function scrollIntoView(smooth = true) {
  const scroller = scrollerRef.value
  if (!scroller) return
  const active = scroller.querySelector('.h-cell.active') as HTMLElement | null
  if (active) {
    const targetLeft = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2
    scroller.scrollTo({ left: Math.max(0, targetLeft), behavior: smooth ? 'smooth' : 'auto' })
  }
}

// --- 移动端滑动逻辑 ---
let touchStartX = 0
let touchStartScrollLeft = 0
const wasTouchScrolling = ref(false)

function onTouchStart(e: TouchEvent) {
  const scroller = scrollerRef.value
  if (!scroller) return
  touchStartX = e.touches[0].clientX
  touchStartScrollLeft = scroller.scrollLeft
  wasTouchScrolling.value = false
}

function onTouchMove(e: TouchEvent) {
  const scroller = scrollerRef.value
  if (!scroller) return
  const delta = e.touches[0].clientX - touchStartX
  if (Math.abs(delta) > 10) wasTouchScrolling.value = true // 识别为滑动行为
  scroller.scrollLeft = touchStartScrollLeft - delta
}

function onTouchEnd() {
  // 不触发任何选中逻辑，只用于浏览
}

// --- PC 拖拽 ---
let isDragging = false
let startX = 0
let scrollLeft = 0

function onMouseDown(e: MouseEvent) {
  const scroller = scrollerRef.value
  if (!scroller) return
  isDragging = true
  scroller.classList.add('dragging')
  startX = e.pageX - scroller.offsetLeft
  scrollLeft = scroller.scrollLeft
}
function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  const scroller = scrollerRef.value
  if (!scroller) return
  e.preventDefault()
  const x = e.pageX - scroller.offsetLeft
  const walk = (x - startX) * 1.2
  scroller.scrollLeft = scrollLeft - walk
}
function onMouseUp() {
  const scroller = scrollerRef.value
  if (!scroller) return
  isDragging = false
  scroller.classList.remove('dragging')
}

// --- 生命周期 ---
onMounted(() => {
  modelValueLocal.value = startOfDay(today)
  emit('update:modelValue', modelValueLocal.value)
  emit('change', modelValueLocal.value)
  requestAnimationFrame(() => scrollIntoView(false))
})

watch(() => props.modelValue, (v) => {
  const d = normalizeToDate(v)
  if (d && !isSameDate(d, modelValueLocal.value)) {
    modelValueLocal.value = startOfDay(d)
    requestAnimationFrame(() => scrollIntoView(true))
  }
})
</script>


<style scoped>
.h-datepicker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  user-select: none;
  -webkit-user-select: none;
}

.h-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.h-title {
  font-weight: 600;
  font-size: 16px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  transition: background 0.2s;
}
.nav-btn:hover {
  background: #e5e7eb;
}
.nav-btn:active {
  background: #d1d5db;
}

.h-scroller {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  outline: none;
  scrollbar-width: none;
  cursor: grab;
}
.h-scroller.dragging {
  cursor: grabbing;
}
.h-scroller::-webkit-scrollbar {
  display: none;
}

.h-track {
  display: flex;
  align-items: center;
  padding: 6px 0;
}

.h-cell {
  width: 56px;
  min-width: 56px;
  flex: 0 0 auto;
  text-align: center;
  padding: 8px 6px;
  margin: 0 4px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  transform-origin: center;
}
.h-cell:hover {
  background: #f3f4f6;
}
.h-cell.today {
  border-color: var(--c-accent, #60a5fa);
}
.h-cell.active {
  background: var(--c-accent-bg, #e0f2fe);
  border-color: var(--c-accent, #38bdf8);
  transform: scale(1.1);
  animation: fadeIn 0.3s ease;
}

.weekday {
  font-size: 12px;
  color: #6b7280;
}
.day {
  font-size: 18px;
  font-weight: 700;
}
.month {
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
}

.h-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #4b5563;
}

.today-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}
.today-btn:hover {
  background: #f9fafb;
}

@keyframes fadeIn {
  from {
    opacity: 0.5;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 紧凑模式 */
.is-compact .h-cell { width: 48px; min-width: 48px; }
.is-compact .day { font-size: 16px; }
</style>
