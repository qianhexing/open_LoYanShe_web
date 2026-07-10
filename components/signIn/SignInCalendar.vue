<script setup lang="ts">
export interface CalendarDateParts {
  y: number
  m: number
  d: number
}

export interface CalendarDayDisplayMeta {
  count: number
  coverUrl: string | null
  hasCover: boolean
}

const props = defineProps<{
  getDayMeta?: (day: number) => CalendarDayDisplayMeta
}>()

const emit = defineEmits<{
  chooseDay: [value: CalendarDateParts]
  changeMonth: [startDate: string]
}>()

const emptyDayMeta: CalendarDayDisplayMeta = {
  count: 0,
  coverUrl: null,
  hasCover: false,
}

const currentTime = ref<CalendarDateParts>(formatDate(new Date()))
const calendarTime = ref<CalendarDateParts>({ ...currentTime.value })
const activeTime = ref<CalendarDateParts>({ ...currentTime.value })

function formatDate(date: Date | string): CalendarDateParts {
  const dateObj = new Date(date)
  return {
    m: dateObj.getMonth() + 1,
    y: dateObj.getFullYear(),
    d: dateObj.getDate(),
  }
}

function pad2(value: number) {
  return value >= 10 ? String(value) : `0${value}`
}

function getMonthStartDate() {
  return `${calendarTime.value.y}-${pad2(calendarTime.value.m)}-01`
}

function emitMonthChange() {
  emit('changeMonth', getMonthStartDate())
}

function emitChooseDay(day: number) {
  const dateStr = `${calendarTime.value.y}-${pad2(calendarTime.value.m)}-${pad2(day)}`
  activeTime.value = formatDate(`${dateStr}T00:00:00.000Z`)
  emit('chooseDay', activeTime.value)
}

function prevYear() {
  calendarTime.value = {
    ...calendarTime.value,
    y: calendarTime.value.y - 1,
  }
  emitMonthChange()
}

function nextYear() {
  calendarTime.value = {
    ...calendarTime.value,
    y: calendarTime.value.y + 1,
  }
  emitMonthChange()
}

function prevMonth() {
  let month = calendarTime.value.m
  let year = calendarTime.value.y
  if (month <= 1) {
    year -= 1
    month = 12
  } else {
    month -= 1
  }
  calendarTime.value = { ...calendarTime.value, y: year, m: month }
  emitMonthChange()
}

function nextMonth() {
  let month = calendarTime.value.m
  let year = calendarTime.value.y
  if (month >= 12) {
    year += 1
    month = 1
  } else {
    month += 1
  }
  calendarTime.value = { ...calendarTime.value, y: year, m: month }
  emitMonthChange()
}

function isActiveDay(day: number) {
  return (
    activeTime.value.y === calendarTime.value.y &&
    activeTime.value.m === calendarTime.value.m &&
    activeTime.value.d === day
  )
}

function resolveDayMeta(day: number): CalendarDayDisplayMeta {
  return props.getDayMeta?.(day) ?? emptyDayMeta
}

const daysInMonth = computed(() => {
  const { y, m } = calendarTime.value
  return new Date(y, m, 0).getDate()
})

const allDaysInMonth = computed(() =>
  Array.from({ length: daysInMonth.value }, (_, index) => index + 1)
)

onMounted(() => {
  emit('chooseDay', activeTime.value)
})

defineExpose({
  getMonthStartDate,
})
</script>

<template>
  <div class="sign-in-journal-calendar journal-book-page mb-3">
    <div class="mb-3 px-1">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="prevYear"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </button>
            <span class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)] min-w-[50px] text-center">
              {{ calendarTime.y }}年
            </span>
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="nextYear"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="prevMonth"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </button>
            <span class="text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)] min-w-[40px] text-center">
              {{ calendarTime.m }}月
            </span>
            <button
              type="button"
              class="journal-neu-icon-btn w-8 h-8 flex items-center justify-center rounded-xl text-[#6b4f5f] dark:text-[var(--ink-muted)]"
              @click="nextMonth"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-7 gap-2">
      <button
        v-for="day in allDaysInMonth"
        :key="day"
        type="button"
        class="journal-neu-tile relative aspect-[1/1] cursor-pointer overflow-hidden rounded-xl text-center min-w-0 min-h-[48px] transition-all active:scale-[0.98]"
        :class="{ 'journal-neu-tile--active': isActiveDay(day) }"
        @click="emitChooseDay(day)"
      >
        <slot name="item" :item="day" :meta="resolveDayMeta(day)">
          <img
            v-if="resolveDayMeta(day).coverUrl"
            :src="resolveDayMeta(day).coverUrl!"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <span
            class="absolute inset-0 flex items-center justify-center text-xs font-medium"
            :class="
              resolveDayMeta(day).hasCover
                ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                : 'text-gray-500 dark:text-gray-400'
            "
          >
            {{ day }}日
          </span>
          <span
            v-if="resolveDayMeta(day).count > 0"
            class="journal-neu-badge absolute top-[-2px] right-[-2px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white text-[10px] font-semibold px-1 leading-none z-[1]"
          >
            {{ resolveDayMeta(day).count > 99 ? '99+' : resolveDayMeta(day).count }}
          </span>
        </slot>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sign-in-journal-calendar.journal-book-page {
  --paper-bg: #f7f0e8;
  --paper-sheet: #fefcf9;
  --paper-raised: #fffefb;
  --paper-dent: #f5efe6;
  --ink-primary: #3d3429;
  --ink-secondary: #5c4f42;
  --ink-muted: #8a7b6a;
  --ink-faint: #b5a898;
  --border-paper: rgba(120, 95, 70, 0.14);
  --border-light: rgba(120, 95, 70, 0.08);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.85), 0 8px 32px rgba(110, 88, 62, 0.06);
  --shadow-soft: 0 2px 8px rgba(110, 88, 62, 0.05);
  --seal-red: #b85c48;
  --accent-warm: #8a7355;
  color: var(--ink-primary);
}

:global(.dark) .sign-in-journal-calendar.journal-book-page {
  --paper-bg: #1a1612;
  --paper-sheet: #221e19;
  --paper-raised: #2a2520;
  --paper-dent: #1e1a16;
  --ink-primary: #e8dfd0;
  --ink-secondary: #c9bfb0;
  --ink-muted: #9a8f80;
  --ink-faint: #6b6258;
  --border-paper: rgba(200, 180, 150, 0.12);
  --border-light: rgba(200, 180, 150, 0.06);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 32px rgba(0, 0, 0, 0.35);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.25);
  --seal-red: #c46a55;
  --accent-warm: #a89070;
}

.journal-neu-icon-btn {
  border: 1px solid var(--border-paper);
  background: var(--paper-sheet);
  color: var(--ink-muted);
  box-shadow: none;
}

.journal-neu-icon-btn:hover {
  color: var(--ink-secondary);
  border-color: rgba(120, 95, 70, 0.22);
}

.journal-neu-icon-btn:active {
  background: var(--paper-dent);
}

.journal-neu-tile {
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-soft);
}

.journal-neu-tile:hover {
  border-color: rgba(120, 95, 70, 0.28);
}

.journal-neu-tile--active {
  border: 2px solid var(--accent-warm);
  outline: 2px solid rgba(138, 115, 85, 0.5);
  outline-offset: 1px;
  box-shadow: var(--shadow-soft);
  z-index: 2;
}

:global(.dark) .journal-neu-tile--active {
  outline-color: rgba(168, 144, 112, 0.55);
}

.journal-neu-badge {
  background: var(--seal-red);
  box-shadow: 0 1px 3px rgba(110, 88, 62, 0.2);
}
</style>
