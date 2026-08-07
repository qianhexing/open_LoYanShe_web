<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Journal } from '@/types/api'
import QhxCarousel from '@/components/Qhx/Carousel.vue'
import type { QhxCarouselItem } from '@/components/Qhx/Carousel.vue'
import JournalCarouselCard from '@/components/journal/JournalCarouselCard.vue'
import { journalCanJumpDetail } from '@/components/journal/carousel/shared'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'

export interface JournalCarouselDay {
  day: number
  count: number
  firstImage: string | null
  isToday: boolean
}

const props = defineProps<{
  year: number
  month: number
  days: readonly JournalCarouselDay[]
  journals: readonly Journal[]
  imageParams?: string
  isOwnJournal?: boolean
  statusBarHeight?: number
  loading?: boolean
}>()

const emit = defineEmits<{
  exit: []
  'prev-month': []
  'next-month': []
  'item-click': [journal: Journal, event: MouseEvent]
  more: [journal: Journal, event: MouseEvent]
}>()

/** 跨月进入时落点：start=首条，end=末条，auto=今日/首条有数据日 */
type MonthEnterEdge = 'start' | 'end' | 'auto'

const carouselIndex = ref(0)
const selectedDay = ref<number | null>(null)
const dayStripRef = ref<HTMLElement | null>(null)
const syncingFromStrip = ref(false)
const pendingEnterEdge = ref<MonthEnterEdge>('auto')
/** 已发起切月、等待当月数据就绪 */
const awaitingMonthData = ref(false)
const appliedMonthKey = ref('')

const monthKey = computed(() => `${props.year}-${props.month}`)
const monthPrefix = computed(
  () => `${props.year}-${String(props.month).padStart(2, '0')}`
)

/** 时间正序：左滑/下一张 = 日期往后；切上月落在末张 = 上月末 */
const sortedJournals = computed(() => {
  const prefix = monthPrefix.value
  return props.journals
    .filter((j) => (j.journal_time || '').slice(0, 7) === prefix)
    .sort((a, b) => {
      const ka = a.journal_time?.slice(0, 10) || ''
      const kb = b.journal_time?.slice(0, 10) || ''
      if (ka !== kb) return ka.localeCompare(kb)
      const ta = a.create_time ? dayjs(a.create_time).valueOf() : 0
      const tb = b.create_time ? dayjs(b.create_time).valueOf() : 0
      return ta - tb
    })
})

const showMonthLoading = computed(
  () => props.loading || awaitingMonthData.value
)

const isEmptyMonth = computed(() => sortedJournals.value.length === 0)

/** 始终至少 1 页：无手账时用空状态卡片，便于再滑切月 */
const carouselItems = computed<QhxCarouselItem[]>(() => {
  if (isEmptyMonth.value) {
    return [{ src: '', alt: '本月暂无手账' }]
  }
  return sortedJournals.value.map((_, i) => ({
    src: '',
    alt: `手账 ${i + 1}`
  }))
})

function dayFromJournal(j: Journal): number | null {
  if (!j.journal_time) return null
  const parts = j.journal_time.split(/[-T\s]/)
  const day = Number.parseInt(parts[2], 10)
  return Number.isNaN(day) ? null : day
}

function findFirstIndexForDay(day: number): number {
  return sortedJournals.value.findIndex((j) => dayFromJournal(j) === day)
}

function pickInitialDay(): number | null {
  const todayItem = props.days.find((d) => d.isToday && d.count > 0)
  if (todayItem) return todayItem.day
  const withItems = props.days.find((d) => d.count > 0)
  return withItems?.day ?? (props.days.find((d) => d.isToday)?.day ?? null)
}

function syncSelectedDayFromIndex(index: number) {
  const j = sortedJournals.value[index]
  if (!j) {
    selectedDay.value = pickInitialDay()
    return
  }
  const day = dayFromJournal(j)
  if (day != null) selectedDay.value = day
}

function scrollDayIntoView(day: number | null) {
  if (day == null || !dayStripRef.value) return
  const el = dayStripRef.value.querySelector<HTMLElement>(`[data-day="${day}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}

function selectDay(day: number) {
  selectedDay.value = day
  const idx = findFirstIndexForDay(day)
  if (idx >= 0) {
    syncingFromStrip.value = true
    carouselIndex.value = idx
    nextTick(() => {
      syncingFromStrip.value = false
    })
  }
  nextTick(() => scrollDayIntoView(day))
}

function onCarouselChange(index: number) {
  carouselIndex.value = index
  if (syncingFromStrip.value || isEmptyMonth.value) return
  syncSelectedDayFromIndex(index)
  nextTick(() => scrollDayIntoView(selectedDay.value))
}

function dayThumb(d: JournalCarouselDay): string | null {
  if (!d.firstImage) return null
  return `${BASE_IMG}${d.firstImage}${props.imageParams || ''}`
}

const pageLabel = computed(() => {
  const total = sortedJournals.value.length
  if (total <= 0) return '空'
  return `${carouselIndex.value + 1} / ${total}`
})

let prevBodyOverflow = ''

function lockBodyScroll() {
  if (!import.meta.client) return
  prevBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  if (!import.meta.client) return
  document.body.style.overflow = prevBodyOverflow
}

function applyEnterPosition() {
  const edge = pendingEnterEdge.value
  const n = sortedJournals.value.length

  if (n === 0) {
    carouselIndex.value = 0
    selectedDay.value = pickInitialDay()
    // 空月消费 edge（仅一张空状态卡）
    pendingEnterEdge.value = 'auto'
    nextTick(() => scrollDayIntoView(selectedDay.value))
    return
  }

  pendingEnterEdge.value = 'auto'

  if (edge === 'start') {
    carouselIndex.value = 0
  } else if (edge === 'end') {
    carouselIndex.value = n - 1
  } else {
    const day = pickInitialDay()
    selectedDay.value = day
    if (day != null) {
      const idx = findFirstIndexForDay(day)
      carouselIndex.value = idx >= 0 ? idx : 0
    } else {
      carouselIndex.value = 0
    }
    syncSelectedDayFromIndex(carouselIndex.value)
    nextTick(() => scrollDayIntoView(selectedDay.value))
    return
  }

  syncSelectedDayFromIndex(carouselIndex.value)
  nextTick(() => scrollDayIntoView(selectedDay.value))
}

function requestMonthSwitch(direction: 'prev' | 'next') {
  if (awaitingMonthData.value || props.loading) return
  awaitingMonthData.value = true
  // 正序下：上月 → 末张（该月最后一天），下月 → 首张（该月最早）
  pendingEnterEdge.value = direction === 'prev' ? 'end' : 'start'
  if (direction === 'prev') emit('prev-month')
  else emit('next-month')
}

function onCarouselOverflow(direction: 'prev' | 'next') {
  requestMonthSwitch(direction)
}

function onHeaderPrevMonth() {
  if (awaitingMonthData.value || props.loading) return
  // 顶栏切上月与边缘滑入一致：从该月末张开始
  pendingEnterEdge.value = 'end'
  awaitingMonthData.value = true
  emit('prev-month')
}

function onHeaderNextMonth() {
  if (awaitingMonthData.value || props.loading) return
  pendingEnterEdge.value = 'start'
  awaitingMonthData.value = true
  emit('next-month')
}

watch(
  () => monthKey.value,
  () => {
    awaitingMonthData.value = true
  }
)

watch(
  () => [monthKey.value, props.loading, sortedJournals.value.length] as const,
  ([key, loading]) => {
    if (loading) return
    const monthChanged = key !== appliedMonthKey.value
    if (monthChanged || awaitingMonthData.value) {
      appliedMonthKey.value = key
      awaitingMonthData.value = false
      applyEnterPosition()
      return
    }
    const n = sortedJournals.value.length
    if (n === 0) {
      carouselIndex.value = 0
      return
    }
    if (carouselIndex.value >= n) {
      carouselIndex.value = n - 1
      onCarouselChange(carouselIndex.value)
    }
  }
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('exit')
    return
  }
  if (showMonthLoading.value) return
  if (e.key === 'ArrowLeft') {
    if (isEmptyMonth.value || carouselIndex.value <= 0) {
      requestMonthSwitch('prev')
      return
    }
    onCarouselChange(carouselIndex.value - 1)
    return
  }
  if (e.key === 'ArrowRight') {
    const n = sortedJournals.value.length
    if (isEmptyMonth.value || carouselIndex.value >= n - 1) {
      requestMonthSwitch('next')
      return
    }
    onCarouselChange(carouselIndex.value + 1)
  }
}

onMounted(() => {
  lockBodyScroll()
  if (props.loading) {
    awaitingMonthData.value = true
  } else {
    appliedMonthKey.value = monthKey.value
    applyEnterPosition()
  }
  if (import.meta.client) {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  unlockBodyScroll()
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
  }
})

function canShowDetail(j: Journal): boolean {
  return journalCanJumpDetail(j)
}
</script>

<template>
  <Teleport to="body">
    <div
      class="journal-carousel-mode journal-book-tokens fixed inset-0 z-[110] flex flex-col font-serif"
      role="dialog"
      aria-modal="true"
      aria-label="手账轮播"
    >
      <div class="journal-carousel-mode__bg pointer-events-none absolute inset-0" aria-hidden="true" />

      <div
        v-if="(statusBarHeight || 0) > 0"
        class="shrink-0"
        :style="{ height: `${statusBarHeight}px` }"
        aria-hidden="true"
      />

      <!-- 顶栏 -->
      <header class="relative z-[1] flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          class="journal-carousel-mode__icon-btn flex h-9 w-9 items-center justify-center rounded-xl"
          aria-label="退出轮播"
          @click="emit('exit')"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="journal-carousel-mode__icon-btn flex h-8 w-8 items-center justify-center rounded-xl"
            aria-label="上一月"
            :disabled="showMonthLoading"
            @click="onHeaderPrevMonth"
          >
            <UIcon name="i-heroicons-chevron-left" class="h-4 w-4" />
          </button>
          <span class="min-w-[5.5rem] text-center text-sm font-semibold text-[#4a2f3d] dark:text-[var(--ink-primary)]">
            {{ year }}年{{ month }}月
          </span>
          <button
            type="button"
            class="journal-carousel-mode__icon-btn flex h-8 w-8 items-center justify-center rounded-xl"
            aria-label="下一月"
            :disabled="showMonthLoading"
            @click="onHeaderNextMonth"
          >
            <UIcon name="i-heroicons-chevron-right" class="h-4 w-4" />
          </button>
        </div>

        <div
          class="min-w-[2.5rem] text-right text-xs tabular-nums text-[#8a6f7d] dark:text-[var(--ink-muted)]"
          aria-live="polite"
        >
          {{ pageLabel }}
        </div>
      </header>

      <!-- 长条形日历 -->
      <div class="relative z-[1] shrink-0 px-2 pb-2">
        <div
          ref="dayStripRef"
          class="journal-carousel-mode__strip flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 py-1"
        >
          <button
            v-for="d in days"
            :key="d.day"
            type="button"
            class="journal-carousel-mode__day relative shrink-0 overflow-hidden rounded-xl"
            :class="{
              'journal-carousel-mode__day--active': selectedDay === d.day,
              'journal-carousel-mode__day--today': d.isToday,
              'journal-carousel-mode__day--empty': d.count === 0
            }"
            :data-day="d.day"
            :aria-label="`${month}月${d.day}日，${d.count}条`"
            :aria-current="selectedDay === d.day ? 'date' : undefined"
            @click="selectDay(d.day)"
          >
            <img
              v-if="dayThumb(d)"
              :src="dayThumb(d)!"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              draggable="false"
            >
            <span
              class="relative z-[1] flex h-full flex-col items-center justify-center gap-0.5 text-[11px] leading-none"
              :class="dayThumb(d) ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' : 'text-[#6b4f5f] dark:text-[var(--ink-muted)]'"
            >
              <span class="font-semibold">{{ d.day }}</span>
              <span v-if="d.isToday" class="journal-carousel-mode__today-mark">今</span>
            </span>
            <span
              v-if="d.count > 0"
              class="journal-carousel-mode__badge absolute right-0.5 top-0.5 z-[1]"
            >
              {{ d.count > 99 ? '99+' : d.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- 轮播卡片区：边界再滑自动切月；无数据为可再滑的空状态卡 -->
      <div class="relative z-[1] flex min-h-0 flex-1 flex-col px-3 pb-3 pt-1">
        <div
          v-if="showMonthLoading"
          class="journal-carousel-mode__empty flex flex-1 items-center justify-center rounded-2xl text-sm text-[#7a5f6f] dark:text-[var(--ink-muted)]"
        >
          加载中...
        </div>
        <div v-else class="journal-carousel-mode__stage min-h-0 flex-1">
          <QhxCarousel
            :model-value="carouselIndex"
            :items="carouselItems"
            :autoplay="0"
            :loop="false"
            :indicators="false"
            :arrows="false"
            virtual-window
            root-class="journal-carousel-mode__carousel h-full !rounded-2xl !bg-transparent !shadow-none"
            @update:model-value="onCarouselChange"
            @change="onCarouselChange"
            @overflow="onCarouselOverflow"
          >
            <template #item="{ index, active }">
              <div
                class="box-border h-full w-full px-0.5 pb-1 pt-0.5"
                :aria-hidden="!active"
              >
                <JournalCarouselCard
                  v-if="sortedJournals[index]"
                  :key="sortedJournals[index].journal_id"
                  :journal="sortedJournals[index]"
                  :image-params="imageParams"
                  :active="active"
                  :lite="!active"
                  :show-detail="active && canShowDetail(sortedJournals[index])"
                  :show-more="active && isOwnJournal"
                  @detail="(j, e) => emit('item-click', j, e)"
                  @more="(j, e) => emit('more', j, e)"
                />
                <div
                  v-else
                  class="journal-carousel-mode__empty-card flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl px-6 text-center"
                >
                  <UIcon name="i-heroicons-book-open" class="h-10 w-10 opacity-35" />
                  <div class="text-sm font-medium text-[#4a2f3d] dark:text-[var(--ink-primary)]">
                    {{ year }}年{{ month }}月暂无手账
                  </div>
                  <div class="text-xs text-[#9d8090] dark:text-[var(--ink-faint)]">
                    继续滑动可切换月份
                  </div>
                </div>
              </div>
            </template>
          </QhxCarousel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.journal-book-tokens {
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

:global(.dark) .journal-book-tokens {
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

.journal-carousel-mode__bg {
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(184, 140, 110, 0.16), transparent 55%),
    linear-gradient(180deg, var(--paper-bg) 0%, #f3ebe3 100%);
}

:global(.dark) .journal-carousel-mode__bg {
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(120, 90, 70, 0.28), transparent 55%),
    linear-gradient(180deg, #1a1418 0%, #221c19 100%);
}

.journal-carousel-mode__icon-btn {
  border: 1px solid var(--border-paper);
  background: var(--paper-sheet);
  color: var(--ink-muted);
  box-shadow: var(--shadow-soft);
}

.journal-carousel-mode__icon-btn:active {
  background: var(--paper-dent);
}

.journal-carousel-mode__strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
  mask-image: linear-gradient(90deg, transparent 0%, #000 12px, #000 calc(100% - 12px), transparent 100%);
}

.journal-carousel-mode__strip::-webkit-scrollbar {
  display: none;
}

.journal-carousel-mode__day {
  width: 3.25rem;
  height: 3.5rem;
  border: 1px solid var(--border-paper);
  background: var(--paper-sheet);
  box-shadow: var(--shadow-soft);
  transition: border-color 0.15s ease, transform 0.15s ease, outline-color 0.15s ease;
}

.journal-carousel-mode__day:active {
  transform: scale(0.97);
}

.journal-carousel-mode__day--empty {
  opacity: 0.72;
}

.journal-carousel-mode__day--today {
  border-color: var(--seal-red);
  box-shadow:
    0 0 0 2px rgba(184, 92, 72, 0.22),
    var(--shadow-soft);
}

.journal-carousel-mode__day--active {
  border: 2px solid var(--accent-warm);
  outline: 2px solid rgba(138, 115, 85, 0.45);
  outline-offset: 1px;
}

.journal-carousel-mode__today-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0.875rem;
  height: 0.75rem;
  padding: 0 0.15rem;
  border-radius: 9999px;
  font-size: 0.5rem;
  font-weight: 700;
  color: #fff;
  background: var(--seal-red);
}

.journal-carousel-mode__badge {
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 9999px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  color: #fff;
  background: var(--seal-red);
}

.journal-carousel-mode__empty,
.journal-carousel-mode__empty-card {
  border: 1px dashed var(--border-paper);
  background: var(--paper-dent);
  color: var(--ink-muted);
}

.journal-carousel-mode__icon-btn:disabled {
  opacity: 0.45;
  pointer-events: none;
}

.journal-carousel-mode__stage {
  min-height: 0;
}

.journal-carousel-mode__stage :deep(.journal-carousel-mode__carousel),
.journal-carousel-mode__stage :deep(.qhx-carousel) {
  height: 100%;
}

.journal-carousel-mode__stage :deep(.qhx-carousel-track) {
  height: 100%;
}

.journal-carousel-mode__stage :deep(.qhx-carousel-slide) {
  height: 100%;
}
</style>
