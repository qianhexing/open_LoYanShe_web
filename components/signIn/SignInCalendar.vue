<script setup lang="ts">
export interface CalendarDateParts {
  y: number
  m: number
  d: number
}

const emit = defineEmits<{
  chooseDay: [value: CalendarDateParts]
  changeMonth: [startDate: string]
}>()

const weekTitles = ['日', '一', '二', '三', '四', '五', '六']

const currentTime = ref<CalendarDateParts>(formatDate(new Date()))
const calendarTime = ref<CalendarDateParts>({ ...currentTime.value })
const activeTime = ref<CalendarDateParts>({ ...currentTime.value })
const calendarDays = ref<Array<number | ''>>([])

function formatDate(date: Date | string): CalendarDateParts {
  const dateObj = new Date(date)
  return {
    m: dateObj.getMonth() + 1,
    y: dateObj.getFullYear(),
    d: dateObj.getDate(),
  }
}

function getCountDays(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function pad2(value: number) {
  return value >= 10 ? String(value) : `0${value}`
}

function initCalendar(year: number, month: number) {
  const week = new Date(`${year}-${pad2(month)}-01T00:00:00.000Z`).getDay()
  const countDays = getCountDays(calendarTime.value.y, calendarTime.value.m)
  const temp: Array<number | ''> = []

  for (let i = 0; i < countDays; i++) {
    if (i === 0) {
      for (let x = 0; x <= week; x++) {
        temp[x] = ''
      }
    }
    temp[i + week] = i + 1
  }

  calendarDays.value = temp
}

function emitChooseDay(day: number) {
  const dateStr = `${calendarTime.value.y}-${pad2(calendarTime.value.m)}-${pad2(day)}`
  activeTime.value = formatDate(`${dateStr}T00:00:00.000Z`)
  emit('chooseDay', activeTime.value)
}

function changeMonth(direction: 0 | 1) {
  let month = calendarTime.value.m
  let year = calendarTime.value.y

  if (direction === 0) {
    if (month - 1 < 1) {
      month = 12
      year -= 1
    } else {
      month -= 1
    }
  } else if (month + 1 > 12) {
    month = 1
    year += 1
  } else {
    month += 1
  }

  const startDate = `${year}-${pad2(month)}-01`
  emit('changeMonth', startDate)
  calendarTime.value = formatDate(`${startDate}T00:00:00.000Z`)
  initCalendar(calendarTime.value.y, calendarTime.value.m)
}

function isActiveDay(day: number | '') {
  if (day === '') return false
  return (
    activeTime.value.y === calendarTime.value.y &&
    activeTime.value.m === calendarTime.value.m &&
    activeTime.value.d === day
  )
}

function isToday(day: number | '') {
  if (day === '') return false
  return (
    calendarTime.value.y === currentTime.value.y &&
    calendarTime.value.m === currentTime.value.m &&
    day === currentTime.value.d
  )
}

onMounted(() => {
  emit('chooseDay', activeTime.value)
  initCalendar(calendarTime.value.y, calendarTime.value.m)
})

defineExpose({
  getMonthStartDate: () => `${calendarTime.value.y}-${pad2(calendarTime.value.m)}-01`,
})
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
      <button
        type="button"
        class="w-8 h-8 rounded-full bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20 transition-colors"
        @click="changeMonth(0)"
      >
        <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 mx-auto" />
      </button>
      <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {{ calendarTime.y }} 年 {{ pad2(calendarTime.m) }} 月
      </div>
      <button
        type="button"
        class="w-8 h-8 rounded-full bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20 transition-colors"
        @click="changeMonth(1)"
      >
        <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 mx-auto" />
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1 px-2 pt-2">
      <div
        v-for="week in weekTitles"
        :key="week"
        class="text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 py-1"
      >
        {{ week }}
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1 p-2">
      <button
        v-for="(day, index) in calendarDays"
        :key="`${index}-${day}`"
        type="button"
        class="relative aspect-square rounded-lg text-sm font-semibold transition-colors disabled:cursor-default"
        :class="[
          day === ''
            ? 'invisible'
            : isActiveDay(day)
              ? 'bg-qhx-primary text-white shadow-sm'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100',
        ]"
        :disabled="day === ''"
        @click="typeof day === 'number' && emitChooseDay(day)"
      >
        <slot name="item" :item="day" :index="index">
          <span>{{ day }}</span>
        </slot>
        <span
          v-if="isToday(day)"
          class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-normal"
          :class="isActiveDay(day) ? 'text-white/90' : 'text-qhx-primary'"
        >
          今天
        </span>
      </button>
    </div>
  </div>
</template>
