<!--
  手账轮播公共卡片壳：顶栏 + 滚动/纯文本居中 + lite + 3D 全高 iframe。
  可跳转类型底部固定「查看详情」；卡片本身不跳转。
  各 pk_type 内容见 components/journal/carousel/*。
-->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import QhxTag from '@/components/Qhx/Tag.vue'
import TypeBody from '@/components/journal/carousel/TypeBody.vue'
import LitePreview from '@/components/journal/carousel/LitePreview.vue'
import {
  getJournalFirstImagePath,
  getJournalTypeLabel,
  journalCarouselShowsCover,
  journalHasLinkedBody,
  isJournalCarouselPlainText,
  isJournalCarouselScene,
  parseJournalTags
} from '@/components/journal/carousel/shared'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import { nextTick, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    journal: Journal
    imageParams?: string
    /** 底部显示「查看详情」（可跳转类型且当前页激活） */
    showDetail?: boolean
    showMore?: boolean
    /** 当前页激活（用于 3D iframe 懒挂载） */
    active?: boolean
    /** 轻量模式（邻页）：不挂载类型重组件 */
    lite?: boolean
  }>(),
  {
    showDetail: false,
    showMore: false,
    active: false,
    lite: false
  }
)

const emit = defineEmits<{
  detail: [journal: Journal, event: MouseEvent]
  more: [journal: Journal, event: MouseEvent]
}>()

const isPost = computed(() => props.journal.pk_type === 1)
/** 签到/随手记：内容即 CommentItem，不再重复展示 journal.note */
const isCheckIn = computed(() => props.journal.pk_type === 0)
const isScene = computed(() => isJournalCarouselScene(props.journal))

const coverSrc = computed(() => {
  if (!journalCarouselShowsCover(props.journal)) return null
  const path = getJournalFirstImagePath(props.journal)
  if (!path) return null
  return `${BASE_IMG}${path}${props.imageParams || ''}`
})

const isPlainText = computed(() => {
  if (props.lite || isScene.value) return false
  return isJournalCarouselPlainText(props.journal)
})

const scrollRef = ref<HTMLElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
const plainTextCentered = ref(true)
let plainTextRo: ResizeObserver | null = null

function updatePlainTextCenter() {
  if (!isPlainText.value || props.lite) {
    plainTextCentered.value = true
    return
  }
  const scroller = scrollRef.value
  const body = bodyRef.value
  if (!scroller || !body) return
  plainTextCentered.value = body.scrollHeight <= scroller.clientHeight + 2
}

function bindPlainTextObserver() {
  plainTextRo?.disconnect()
  plainTextRo = null
  if (!import.meta.client || !isPlainText.value || props.lite) return
  const scroller = scrollRef.value
  const body = bodyRef.value
  if (!scroller || !body) return
  plainTextRo = new ResizeObserver(() => updatePlainTextCenter())
  plainTextRo.observe(scroller)
  plainTextRo.observe(body)
  updatePlainTextCenter()
}

watch(
  () =>
    [
      isPlainText.value,
      props.lite,
      props.journal.journal_id,
      props.journal.community?.content
    ] as const,
  async () => {
    await nextTick()
    bindPlainTextObserver()
  }
)

onMounted(async () => {
  await nextTick()
  bindPlainTextObserver()
})

onUnmounted(() => {
  plainTextRo?.disconnect()
  plainTextRo = null
})

const typeLabel = computed(() => getJournalTypeLabel(props.journal.pk_type))

const timeLabel = computed(() => {
  const t = props.journal.create_time
  if (!t) return ''
  try {
    return dayjs(t).format('HH:mm')
  } catch {
    return ''
  }
})

const dateLabel = computed(() => {
  const key = props.journal.journal_time?.slice(0, 10)
  if (!key) return ''
  const d = dayjs(key)
  return d.isValid() ? d.format('M月D日') : ''
})

const tags = computed(() => parseJournalTags(props.journal.tags))

const hasLinkedBody = computed(() => journalHasLinkedBody(props.journal))

const showJournalNote = computed(
  () => !!props.journal.note && hasLinkedBody.value && !isCheckIn.value
)

const showDetailBtn = computed(() => props.showDetail && !props.lite)

function onDetail(e: MouseEvent) {
  emit('detail', props.journal, e)
}

function onMore(e: MouseEvent) {
  emit('more', props.journal, e)
}
</script>

<template>
  <article
    class="journal-carousel-card flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl"
    :class="{
      'journal-carousel-card--lite': lite,
      'journal-carousel-card--post': isPost,
      'journal-carousel-card--scene': isScene && !lite,
      'journal-carousel-card--has-detail': showDetailBtn
    }"
  >
    <header class="journal-carousel-card__head flex shrink-0 items-center justify-between gap-2 px-3 py-2">
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <span class="journal-carousel-card__chip">{{ typeLabel }}</span>
        <span v-if="dateLabel" class="journal-carousel-card__chip journal-carousel-card__chip--soft">
          {{ dateLabel }}
          <template v-if="timeLabel"> · {{ timeLabel }}</template>
        </span>
      </div>
      <button
        v-if="showMore && !lite"
        type="button"
        class="journal-carousel-card__more flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        @click.stop="onMore"
      >
        <UIcon name="i-heroicons-ellipsis-vertical" class="h-4 w-4" />
      </button>
    </header>

    <div v-if="lite" class="relative min-h-0 flex-1 overflow-hidden">
      <LitePreview :journal="journal" :image-params="imageParams" />
    </div>

    <!-- 3D：全高 iframe，不走封面滚动区 -->
    <div
      v-else-if="isScene"
      class="journal-carousel-card__scene-body flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1"
    >
      <TypeBody
        :journal="journal"
        :image-params="imageParams"
        :active="active"
      />
      <div
        v-if="tags.length || showJournalNote"
        class="mt-1.5 shrink-0 px-1"
      >
        <div v-if="tags.length" class="flex flex-wrap gap-0.5">
          <QhxTag v-for="tag in tags" :key="tag">{{ tag }}</QhxTag>
        </div>
        <div
          v-if="showJournalNote"
          class="mt-1 rounded-xl bg-[var(--paper-dent)] px-2.5 py-1.5 text-xs text-[#7a5f6a] dark:text-[var(--ink-muted)]"
        >
          {{ journal.note }}
        </div>
      </div>
    </div>

    <div
      v-else
      ref="scrollRef"
      class="journal-carousel-card__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      :class="{
        'journal-carousel-card__scroll--plain': isPlainText,
        'journal-carousel-card__scroll--plain-center': isPlainText && plainTextCentered
      }"
    >
      <div
        v-if="coverSrc"
        class="journal-carousel-card__cover relative w-full shrink-0 overflow-hidden"
      >
        <img
          :src="coverSrc"
          alt=""
          class="block h-full w-full object-cover"
          draggable="false"
          loading="eager"
        >
      </div>

      <div
        ref="bodyRef"
        class="journal-carousel-card__body px-3 pb-3 pt-2"
        :class="{ 'journal-carousel-card__body--plain': isPlainText }"
      >
        <TypeBody :journal="journal" :image-params="imageParams" :active="active" />

        <div v-if="tags.length" class="mt-2 flex flex-wrap gap-0.5">
          <QhxTag v-for="tag in tags" :key="tag">{{ tag }}</QhxTag>
        </div>

        <div
          v-if="showJournalNote"
          class="mt-2 rounded-xl bg-[var(--paper-dent)] px-2.5 py-2 text-xs text-[#7a5f6a] dark:text-[var(--ink-muted)]"
        >
          {{ journal.note }}
        </div>
      </div>
    </div>

    <!-- 底部固定：查看详情（签到/手账/计划等不展示）；贴合卡片底边，仅下方圆角 -->
    <footer
      v-if="showDetailBtn"
      class="journal-carousel-card__detail shrink-0"
    >
      <button
        type="button"
        class="journal-carousel-card__detail-btn flex w-full items-center justify-center px-3 py-2.5 text-sm font-medium"
        @click.stop="onDetail"
      >
        查看详情
      </button>
    </footer>
  </article>
</template>

<style scoped>
.journal-carousel-card {
  background: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-soft);
}

.journal-carousel-card--lite {
  user-select: none;
}

.journal-carousel-card__head {
  border-bottom: 1px solid var(--border-light);
  background: var(--paper-sheet);
}

.journal-carousel-card__scroll--plain {
  display: flex;
  flex-direction: column;
}

.journal-carousel-card__scroll--plain-center {
  justify-content: center;
}

.journal-carousel-card__body--plain {
  width: 100%;
  flex-shrink: 0;
}

.journal-carousel-card__cover {
  aspect-ratio: 4 / 3;
  max-height: min(52vh, 420px);
  background: var(--paper-dent);
}

.journal-carousel-card__chip {
  border-radius: 9999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ink-primary);
  background: var(--paper-dent);
  border: 1px solid var(--border-paper);
}

.journal-carousel-card__chip--soft {
  font-weight: 500;
  color: var(--ink-muted);
}

.journal-carousel-card__more {
  color: var(--ink-muted);
  background: var(--paper-dent);
  border: 1px solid var(--border-paper);
}

.journal-carousel-card__body {
  background: var(--paper-sheet);
}

.journal-carousel-card__scene-body {
  min-height: 0;
}

.journal-carousel-card__detail {
  margin: 0;
  /* 贴合卡片底边，与卡片 rounded-2xl 对齐 */
  border-radius: 0 0 1rem 1rem;
  overflow: hidden;
}

.journal-carousel-card__detail-btn {
  color: #fff;
  background: var(--primary-color, #ff9eb5);
  border: none;
  border-radius: 0 0 1rem 1rem;
  transition: opacity 0.15s ease;
}

.journal-carousel-card__detail-btn:active {
  opacity: 0.9;
}
</style>
