<template>
  <div class="qhx-datetime-picker">
    <!-- 触发输入框 -->
    <div
      ref="triggerRef"
      class="trigger-input"
      :class="{ 'has-value': displayValue, 'is-disabled': disabled }"
      @click="openPicker"
    >
      <span class="trigger-text">{{ displayValue || placeholder }}</span>
      <UIcon
        name="i-heroicons-calendar-days"
        class="trigger-icon text-gray-400 dark:text-gray-500 flex-shrink-0"
      />
    </div>

    <!-- 弹窗 -->
    <QhxModal v-model="show" :trigger-position="clickPosition" @close="onClose">
      <div
        class="datetime-modal w-[95vw] max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50"
      >
        <!-- 头部 -->
        <div class="px-4 py-3 border-b border-gray-200/60 dark:border-gray-700">
          <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 text-center">
            选择日期时间
          </h3>
        </div>

        <!-- 日期选择区域 -->
        <div class="p-4">
          <!-- 年月模式：年 + 月 滚动选择 -->
          <div v-if="props.mode === 'yearmonth'" class="yearmonth-section flex gap-3">
            <QhxScrollPicker
              v-model="yearIndex"
              :items="yearOptions"
              :item-height="40"
              :visible-count="5"
              label-key="label"
              @change="onYearMonthChange"
            />
            <QhxScrollPicker
              v-model="monthIndex"
              :items="monthOptions"
              :item-height="40"
              :visible-count="5"
              label-key="label"
              @change="onYearMonthChange"
            />
          </div>

          <!-- 日期模式：日历 + 年月导航 -->
          <div v-else-if="props.mode === 'date'" class="date-section">
            <div class="calendar-header flex items-center justify-between mb-3">
              <button
                type="button"
                class="nav-btn w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                @click="prevMonth"
              >
                <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
              </button>
              <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {{ currentYear }} 年 {{ currentMonth + 1 }} 月
              </span>
              <button
                type="button"
                class="nav-btn w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                @click="nextMonth"
              >
                <UIcon name="i-heroicons-chevron-right" class="w-5 h-5" />
              </button>
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                class="ml-2 shrink-0"
                @click="goToday"
              >
                今日
              </UButton>
            </div>
            <div class="calendar-weekdays flex">
              <span
                v-for="w in weekNames"
                :key="w"
                class="flex-1 text-center text-xs text-gray-500 dark:text-gray-400 py-1"
              >
                {{ w }}
              </span>
            </div>
            <div class="calendar-days grid grid-cols-7 gap-0.5 mt-1">
              <div
                v-for="(d, i) in calendarDays"
                :key="i"
                class="day-cell aspect-square flex items-center justify-center text-sm rounded-lg cursor-pointer transition-all"
                :class="{
                  'text-gray-400 dark:text-gray-500': d.isOther,
                  'text-gray-800 dark:text-gray-200': !d.isOther,
                  'bg-qhx-primary text-white font-semibold': d.isSelected && !d.isOther,
                  'bg-gray-100 dark:bg-gray-700': d.isToday && !d.isSelected,
                  'hover:bg-gray-100 dark:hover:bg-gray-700': !d.isSelected && !d.isOther
                }"
                @click="!d.isOther && selectDay(d.date)"
              >
                {{ d.day }}
              </div>
            </div>
          </div>

          <!-- 时间选择：时分秒 -->
          <div
            v-if="enableTimePicker"
            class="time-section mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">选择时间</div>
            <div class="flex gap-2">
              <QhxScrollPicker
                v-model="hourIndex"
                :items="hourOptions"
                :item-height="36"
                :visible-count="5"
                label-key="label"
                @change="onTimeChange"
              />
              <QhxScrollPicker
                v-model="minuteIndex"
                :items="minuteOptions"
                :item-height="36"
                :visible-count="5"
                label-key="label"
                @change="onTimeChange"
              />
              <QhxScrollPicker
                v-model="secondIndex"
                :items="secondOptions"
                :item-height="36"
                :visible-count="5"
                label-key="label"
                @change="onTimeChange"
              />
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex gap-2 px-4 py-3 border-t border-gray-200/60 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <UButton
            v-if="clearable"
            color="gray"
            variant="ghost"
            size="sm"
            class="flex-1"
            @click="handleClear"
          >
            清除
          </UButton>
          <UButton
            size="sm"
            class="flex-1 bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="confirm"
          >
            确认
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

interface PickerItem {
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    placeholder?: string
    mode?: 'date' | 'yearmonth'
    format?: string
    clearable?: boolean
    disabled?: boolean
    /** 是否开启时分秒选择，false 时只选日期，输出时间为 00:00:00 */
    enableTimePicker?: boolean
  }>(),
  {
    placeholder: '选择日期时间',
    mode: 'date',
    format: 'YYYY-MM-DD HH:mm:ss',
    clearable: true,
    disabled: false,
    enableTimePicker: true
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
  (e: 'change', v: string | null): void
}>()

const show = ref(false)
const triggerRef = ref<HTMLElement>()
const clickPosition = ref({ x: 0, y: 0 })

const weekNames = ['日', '一', '二', '三', '四', '五', '六']

// 解析初始值
function parseValue(v: string | null | undefined): dayjs.Dayjs {
  if (!v) return dayjs()
  const d = dayjs(v)
  return d.isValid() ? d : dayjs()
}

const innerDate = ref(parseValue(props.modelValue))

// 年月日
const currentYear = ref(innerDate.value.year())
const currentMonth = ref(innerDate.value.month())
const selectedDay = ref(innerDate.value.date())

// 年月模式索引
const yearOptions = computed((): PickerItem[] => {
  const base = currentYear.value
  return Array.from({ length: 50 }, (_, i) => {
    const y = base - 25 + i
    return { label: `${y}年`, value: y }
  })
})

const monthOptions = computed((): PickerItem[] =>
  Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}月`,
    value: i
  }))
)

const yearIndex = ref(25)
const monthIndex = ref(innerDate.value.month())

watch(
  () => currentYear.value,
  (y) => {
    const idx = yearOptions.value.findIndex((o) => o.value === y)
    if (idx >= 0) yearIndex.value = idx
  },
  { immediate: true }
)

watch(yearIndex, (i) => {
  const opt = yearOptions.value[i]
  if (opt) currentYear.value = opt.value
})

watch(monthIndex, (i) => {
  currentMonth.value = i
})

// 时分秒
const hourOptions: PickerItem[] = Array.from({ length: 24 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i
}))
const minuteOptions: PickerItem[] = Array.from({ length: 60 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i
}))
const secondOptions: PickerItem[] = Array.from({ length: 60 }, (_, i) => ({
  label: String(i).padStart(2, '0'),
  value: i
}))

const hourIndex = ref(innerDate.value.hour())
const minuteIndex = ref(innerDate.value.minute())
const secondIndex = ref(innerDate.value.second())

// 日历天
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const first = dayjs().year(year).month(month).date(1)
  const start = first.day()
  const daysInMonth = first.daysInMonth()
  const today = dayjs()
  const selected = dayjs().year(year).month(month).date(selectedDay.value)

  const days: {
    day: number
    date: dayjs.Dayjs
    isOther: boolean
    isToday: boolean
    isSelected: boolean
  }[] = []

  for (let i = 0; i < start; i++) {
    const d = first.subtract(start - i, 'day')
    days.push({
      day: d.date(),
      date: d,
      isOther: true,
      isToday: false,
      isSelected: false
    })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = dayjs().year(year).month(month).date(i)
    days.push({
      day: i,
      date: d,
      isOther: false,
      isToday: d.isSame(today, 'day'),
      isSelected: d.isSame(selected, 'day')
    })
  }
  const rest = 42 - days.length
  for (let i = 1; i <= rest; i++) {
    const d = dayjs()
      .year(year)
      .month(month)
      .date(daysInMonth)
      .add(i, 'day')
    days.push({
      day: d.date(),
      date: d,
      isOther: true,
      isToday: false,
      isSelected: false
    })
  }
  return days
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentYear.value--
    currentMonth.value = 11
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentYear.value++
    currentMonth.value = 0
  } else {
    currentMonth.value++
  }
}

function selectDay(d: dayjs.Dayjs) {
  selectedDay.value = d.date()
  currentYear.value = d.year()
  currentMonth.value = d.month()
}

function goToday() {
  const today = dayjs()
  currentYear.value = today.year()
  currentMonth.value = today.month()
  selectedDay.value = today.date()
  if (props.enableTimePicker) {
    hourIndex.value = today.hour()
    minuteIndex.value = today.minute()
    secondIndex.value = today.second()
  }
}

function onYearMonthChange() {
  // 年月变化时同步
}

function onTimeChange() {
  // 时分秒变化
}

function buildResult(): string {
  const h = props.enableTimePicker ? (hourOptions[hourIndex.value]?.value ?? 0) : 0
  const m = props.enableTimePicker ? (minuteOptions[minuteIndex.value]?.value ?? 0) : 0
  const s = props.enableTimePicker ? (secondOptions[secondIndex.value]?.value ?? 0) : 0

  if (props.mode === 'yearmonth') {
    return dayjs()
      .year(currentYear.value)
      .month(currentMonth.value)
      .date(1)
      .hour(h)
      .minute(m)
      .second(s)
      .format(props.format)
  }
  return dayjs()
    .year(currentYear.value)
    .month(currentMonth.value)
    .date(selectedDay.value)
    .hour(h)
    .minute(m)
    .second(s)
    .format(props.format)
}

const displayValue = computed(() => props.modelValue || '')

function openPicker(e?: MouseEvent) {
  if (props.disabled) return
  if (e) {
    clickPosition.value = { x: e.clientX, y: e.clientY }
  }
  innerDate.value = parseValue(props.modelValue)
  currentYear.value = innerDate.value.year()
  currentMonth.value = innerDate.value.month()
  selectedDay.value = innerDate.value.date()
  hourIndex.value = innerDate.value.hour()
  minuteIndex.value = innerDate.value.minute()
  secondIndex.value = innerDate.value.second()
  monthIndex.value = innerDate.value.month()
  const yIdx = yearOptions.value.findIndex((o) => o.value === currentYear.value)
  if (yIdx >= 0) yearIndex.value = yIdx
  show.value = true
}

function onClose() {
  show.value = false
}

function confirm() {
  const str = buildResult()
  emit('update:modelValue', str)
  emit('change', str)
  show.value = false
}

function handleClear() {
  emit('update:modelValue', null)
  emit('change', null)
  show.value = false
}

watch(
  () => props.modelValue,
  (v) => {
    if (!show.value) return
    innerDate.value = parseValue(v)
    currentYear.value = innerDate.value.year()
    currentMonth.value = innerDate.value.month()
    selectedDay.value = innerDate.value.date()
    hourIndex.value = innerDate.value.hour()
    minuteIndex.value = innerDate.value.minute()
    secondIndex.value = innerDate.value.second()
    monthIndex.value = innerDate.value.month()
    const yIdx = yearOptions.value.findIndex((o) => o.value === currentYear.value)
    if (yIdx >= 0) yearIndex.value = yIdx
  }
)
</script>

<style scoped>
.trigger-input {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgb(209 213 219);
  background: rgb(255 255 255);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  user-select: none;
}

.dark .trigger-input {
  border-color: rgb(75 85 99);
  background: rgb(31 41 55);
}

.trigger-input:hover:not(.is-disabled) {
  border-color: rgb(147 197 253);
}

.dark .trigger-input:hover:not(.is-disabled) {
  border-color: rgb(59 130 246);
}

.trigger-input:focus-within,
.trigger-input.has-value {
  border-color: var(--qhx-primary, #3b82f6);
  outline: 2px solid rgb(59 130 246 / 0.2);
  outline-offset: -1px;
}

.trigger-input.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trigger-text {
  flex: 1;
  text-align: left;
  font-size: 14px;
  color: rgb(17 24 39);
}

.dark .trigger-text {
  color: rgb(243 244 246);
}

.trigger-input:not(.has-value) .trigger-text {
  color: rgb(156 163 175);
}

.dark .trigger-input:not(.has-value) .trigger-text {
  color: rgb(107 114 128);
}

.day-cell {
  min-height: 32px;
}
</style>
