<script setup lang="ts">
import type { Library } from '@/types/api'
import dayjs from 'dayjs'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatLabel } from '@/utils/public'
import { openLibraryDetailTab } from '@/composables/useLibraryDetailNavigation'

interface TimelineGroup {
  date: string
  year: string
  month: string
  sortKey: number
  libraries: Library[]
}

const props = withDefaults(defineProps<{
  list: Library[]
}>(), {
  list: () => [],
})

const configStore = useConfigStore()
const config = computed(() => configStore.config)

function formatDateForGroup(dateStr?: string | null): Omit<TimelineGroup, 'libraries'> {
  if (!dateStr) {
    return { date: '未知时间', year: '—', month: '未定', sortKey: 0 }
  }
  const parsed = dayjs(dateStr)
  return {
    date: `${parsed.format('YYYY')}年${parsed.format('MM')}月`,
    year: parsed.format('YYYY'),
    month: `${parsed.format('MM')}月`,
    sortKey: parsed.startOf('month').valueOf(),
  }
}

const timelineData = computed((): TimelineGroup[] => {
  const grouped: Record<string, TimelineGroup> = {}

  for (const item of props.list) {
    const meta = formatDateForGroup(item.sale_time)
    if (!grouped[meta.date]) {
      grouped[meta.date] = { ...meta, libraries: [] }
    }
    grouped[meta.date].libraries.push(item)
  }

  return Object.values(grouped).sort((a, b) => b.sortKey - a.sortKey)
})

const totalCount = computed(() => props.list.length)

function coverSrc(library: Library) {
  if (!library.cover) return `${BASE_IMG}static/plan_cover/default.jpg`
  return `${BASE_IMG}${library.cover}?x-oss-process=image/quality,q_100/resize,w_240`
}

function openDetail(libraryId: number) {
  openLibraryDetailTab(libraryId)
}

function formatPrice(library: Library) {
  if (!library.library_price) return ''
  const currency = formatLabel(library.shop_country || library.shop?.shop_country || 0, config.value?.money_type)
  return `￥${library.library_price}${currency ? ` ${currency}` : ''}`
}
</script>

<template>
  <div class="library-timeline">
    <div
      v-if="timelineData.length > 0"
      class="timeline-summary mx-2 mb-4 rounded-xl border border-gray-100/90 bg-white/70 px-3 py-2.5 shadow-sm dark:border-gray-700/70 dark:bg-gray-800/45 md:mx-4 md:px-4 md:py-3"
    >
      <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 md:text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-200">初贩时间轴</span>
        <span>{{ timelineData.length }} 个时间节点 · 共 {{ totalCount }} 款</span>
      </div>
    </div>

    <div v-if="timelineData.length === 0" class="py-14 text-center text-sm text-gray-500 dark:text-gray-400">
      暂无图鉴数据
    </div>

    <div v-else class="timeline-scroll relative px-1 pb-2 md:px-6 md:pb-4">
      <div
        class="timeline-axis"
        aria-hidden="true"
      />

      <div
        v-for="(group, index) in timelineData"
        :key="`${group.date}-${index}`"
        class="timeline-group"
        :class="index % 2 === 0 ? 'timeline-group--left' : 'timeline-group--right'"
      >
        <div class="timeline-marker" aria-hidden="true">
          <span class="timeline-node">
            <span class="timeline-node__core" />
          </span>
        </div>

        <div class="timeline-date-chip">
          <span class="timeline-date-chip__year">{{ group.year }}</span>
          <span class="timeline-date-chip__month">{{ group.month }}</span>
          <span class="timeline-date-chip__count">{{ group.libraries.length }} 款</span>
        </div>

        <div
          class="timeline-cards"
          :class="group.libraries.length > 1 ? 'timeline-cards--multi' : ''"
        >
          <article
            v-for="library in group.libraries"
            :key="library.library_id"
            class="timeline-card polaroid-card group cursor-pointer"
            role="link"
            tabindex="0"
            @click="openDetail(library.library_id)"
            @keydown.enter.prevent="openDetail(library.library_id)"
            @keydown.space.prevent="openDetail(library.library_id)"
          >
            <div class="timeline-card__cover">
              <img
                :src="coverSrc(library)"
                :alt="library.name"
                class="timeline-card__img"
                loading="lazy"
                draggable="false"
              >
              <div v-if="library.library_type" class="timeline-card__type">
                <QhxTag>{{ library.library_type }}</QhxTag>
              </div>
            </div>
            <div class="timeline-card__body">
              <h4 class="timeline-card__title">
                {{ library.name }}
              </h4>
              <div v-if="library.state || formatPrice(library)" class="timeline-card__meta">
                <QhxTag v-if="library.state" :active="true">{{ library.state }}</QhxTag>
                <span v-if="formatPrice(library)" class="timeline-card__price">{{ formatPrice(library) }}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-timeline {
  --tl-primary: var(--primary-color, #ff9eb5);
  --tl-axis-width: 2px;
  --tl-node-size: 0.75rem;
  --tl-center-offset: 0.625rem;
  --tl-card-max: 7.25rem;
  --tl-cards-top: 2.75rem;
  --tl-group-pb: 1.5rem;
}

.timeline-scroll {
  background-image:
    radial-gradient(ellipse 90% 40% at 50% 0%, color-mix(in srgb, var(--tl-primary) 8%, transparent), transparent 58%),
    radial-gradient(ellipse 60% 30% at 100% 40%, color-mix(in srgb, var(--tl-primary) 4%, transparent), transparent 50%);
}

.dark .timeline-scroll {
  background-image:
    radial-gradient(ellipse 90% 40% at 50% 0%, color-mix(in srgb, var(--tl-primary) 12%, transparent), transparent 58%),
    radial-gradient(ellipse 60% 30% at 100% 40%, color-mix(in srgb, var(--tl-primary) 6%, transparent), transparent 50%);
}

.timeline-summary {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* 全端统一：居中竖轴 + 左右交替 */
.timeline-axis {
  position: absolute;
  left: 50%;
  top: 0.5rem;
  bottom: 0.75rem;
  width: var(--tl-axis-width);
  transform: translateX(-50%);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--tl-primary) 55%, #fff) 8%,
    color-mix(in srgb, var(--tl-primary) 55%, #fff) 92%,
    transparent
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--tl-primary) 15%, transparent);
  z-index: 0;
}

.timeline-group {
  position: relative;
  display: block;
  padding-bottom: var(--tl-group-pb);
  min-height: 5rem;
}

.timeline-marker {
  position: absolute;
  left: 50%;
  top: 0.1rem;
  z-index: 2;
  display: flex;
  justify-content: center;
  transform: translateX(-50%);
}

.timeline-node {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--tl-node-size);
  height: var(--tl-node-size);
  border-radius: 999px;
  background: color-mix(in srgb, var(--tl-primary) 12%, #fff);
  border: 1.5px solid color-mix(in srgb, var(--tl-primary) 55%, transparent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--tl-primary) 8%, transparent),
    0 1px 6px rgba(0, 0, 0, 0.08);
}

.dark .timeline-node {
  background: color-mix(in srgb, var(--tl-primary) 18%, #111827);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--tl-primary) 10%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.35);
}

.timeline-node__core {
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--tl-primary);
}

.timeline-date-chip {
  position: absolute;
  left: 50%;
  top: 1.35rem;
  z-index: 3;
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 0.2rem 0.35rem;
  transform: translateX(-50%);
  padding: 0.2rem 0.5rem;
  max-width: calc(100% - 1rem);
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--tl-primary) 28%, #e5e7eb);
  background: color-mix(in srgb, var(--tl-primary) 6%, #fff);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  white-space: nowrap;
}

.dark .timeline-date-chip {
  border-color: color-mix(in srgb, var(--tl-primary) 32%, #374151);
  background: color-mix(in srgb, var(--tl-primary) 10%, #1f2937);
}

.timeline-date-chip__year {
  font-size: 0.5625rem;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--tl-primary) 75%, #6b7280);
}

.timeline-date-chip__month {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #111827;
}

.dark .timeline-date-chip__month {
  color: #f3f4f6;
}

.timeline-date-chip__count {
  font-size: 0.5625rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tl-primary) 12%, transparent);
  color: color-mix(in srgb, var(--tl-primary) 82%, #374151);
}

.timeline-cards {
  width: calc(50% - var(--tl-center-offset) - var(--tl-axis-width));
  max-width: var(--tl-card-max);
  margin-top: var(--tl-cards-top);
  display: grid;
  gap: 0.4rem;
}

.timeline-cards--multi {
  grid-template-columns: 1fr;
}

.timeline-group--left .timeline-cards {
  margin-right: calc(50% + var(--tl-center-offset));
  margin-left: 0;
}

.timeline-group--right .timeline-cards {
  margin-left: calc(50% + var(--tl-center-offset));
  margin-right: 0;
}

.timeline-card {
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.dark .timeline-card {
  background: #111827;
  border-color: #374151;
}

.timeline-card:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .timeline-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 22px rgba(0, 0, 0, 0.1),
      0 0 0 1px color-mix(in srgb, var(--tl-primary) 18%, transparent);
  }
}

.timeline-card__cover {
  position: relative;
  margin: 0.3rem 0.3rem 0;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #f3f4f6;
  background: #f9fafb;
  aspect-ratio: 1;
}

.dark .timeline-card__cover {
  border-color: #374151;
  background: #1f2937;
}

.timeline-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.timeline-card:hover .timeline-card__img {
  transform: scale(1.03);
}

.timeline-card__type {
  position: absolute;
  left: 0.25rem;
  top: 0.25rem;
  z-index: 1;
  transform: scale(0.82);
  transform-origin: top left;
}

.timeline-card__body {
  padding: 0.3rem 0.4rem 0.45rem;
}

.timeline-card__title {
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.35;
  color: #111827;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .timeline-card__title {
  color: #f3f4f6;
}

.timeline-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.25rem;
  transform: scale(0.88);
  transform-origin: top left;
}

.timeline-card__price {
  font-size: 0.625rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--tl-primary) 80%, #374151);
}

@media (min-width: 768px) {
  .library-timeline {
    --tl-node-size: 1.125rem;
    --tl-center-offset: 1rem;
    --tl-card-max: 13rem;
    --tl-cards-top: 3.75rem;
    --tl-group-pb: 2.25rem;
  }

  .timeline-axis {
    width: 3px;
    top: 0.75rem;
    bottom: 1rem;
    box-shadow: 0 0 18px color-mix(in srgb, var(--tl-primary) 18%, transparent);
  }

  .timeline-node {
    border-width: 2px;
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--tl-primary) 8%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .timeline-node__core {
    width: 0.375rem;
    height: 0.375rem;
  }

  .timeline-date-chip {
    top: 1.85rem;
    padding: 0.3rem 0.65rem;
    gap: 0.3rem 0.45rem;
  }

  .timeline-date-chip__year {
    font-size: 0.625rem;
  }

  .timeline-date-chip__month {
    font-size: 0.8125rem;
  }

  .timeline-date-chip__count {
    font-size: 0.625rem;
    padding: 0.05rem 0.4rem;
  }

  .timeline-cards {
    gap: 0.55rem;
  }

  .timeline-card {
    border-radius: 12px;
  }

  .timeline-card__cover {
    margin: 0.4rem 0.4rem 0;
    border-radius: 10px;
  }

  .timeline-card__type {
    transform: scale(0.9);
  }

  .timeline-card__body {
    padding: 0.4rem 0.55rem 0.55rem;
  }

  .timeline-card__title {
    font-size: 0.75rem;
  }

  .timeline-card__meta {
    transform: none;
    margin-top: 0.35rem;
  }

  .timeline-card__price {
    font-size: 0.6875rem;
  }
}

@media (min-width: 1280px) {
  .library-timeline {
    --tl-center-offset: 1.125rem;
    --tl-card-max: 15rem;
    --tl-cards-top: 4rem;
    --tl-group-pb: 2.75rem;
  }

  .timeline-card__title {
    font-size: 0.8125rem;
  }

  .timeline-group--left .timeline-cards--multi,
  .timeline-group--right .timeline-cards--multi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 17rem;
  }
}
</style>
