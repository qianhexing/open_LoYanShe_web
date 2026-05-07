<!-- 投票展示与提交；依赖 /vote 系列接口 -->
<script setup lang="ts">
import type { VoteDetail, VoteOption, VoteRecordChoice } from '@/types/api'
import type { RichNode } from '@/utils/public'
import { formatRich, parseRichText } from '@/utils/public'
import { getVoteDetail, getVoteIsVote, insertVoteRecord } from '@/api/vote'
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    voteId: number
    /** 外层容器额外 class */
    wrapClass?: string
  }>(),
  { wrapClass: '' }
)

const toast = useToast()

const detail = ref<VoteDetail | null>(null)
const isVoted = ref(false)
const checkList = ref<VoteRecordChoice[]>([])
const loading = ref(false)
const richByOptionId = ref<Record<number, RichNode[]>>({})

function plainPreview(opt: VoteOption) {
  const t = formatRich(opt.options_content).text
  return t.replace(/<[^>]*>/g, '').trim() || ' '
}

function syncOptionRich() {
  if (typeof document === 'undefined' || !detail.value) return
  const rec: Record<number, RichNode[]> = {}
  for (const o of detail.value.vote_options) {
    const { text } = formatRich(o.options_content)
    rec[o.options_id] = parseRichText(text)
  }
  richByOptionId.value = rec
}

const voteOpen = computed(() => {
  const end = detail.value?.vote_end_time
  if (end == null || end === '') return true
  return dayjs(end).isAfter(dayjs())
})

const isSelected = (optionsId: number) =>
  checkList.value.some((c) => c.options_id === optionsId)

const barWidth = (opt: VoteOption) => {
  const total = detail.value?.vote_number ?? 0
  if (total === 0) return '0%'
  return `${(opt.options_number / total) * 100}%`
}

async function loadDetail() {
  const data = await getVoteDetail({ vote_id: props.voteId })
  detail.value = data
  syncOptionRich()
}

async function loadIsVote() {
  const res = await getVoteIsVote({ vote_id: props.voteId })
  if (res && Array.isArray(res) && res.length > 0) {
    checkList.value = res.map((r) => ({ options_id: r.options_id }))
    isVoted.value = true
  } else {
    isVoted.value = false
    checkList.value = []
  }
}

function chooseOptions(item: VoteOption) {
  if (isVoted.value) return
  const single = detail.value?.vote_type === 0
  if (single) {
    if (
      checkList.value.length > 0 &&
      checkList.value[0].options_id === item.options_id
    ) {
      checkList.value = []
    } else {
      checkList.value = [{ options_id: item.options_id }]
    }
  } else {
    const i = checkList.value.findIndex(
      (c) => c.options_id === item.options_id
    )
    if (i === -1) {
      checkList.value = [...checkList.value, { options_id: item.options_id }]
    } else {
      const next = [...checkList.value]
      next.splice(i, 1)
      checkList.value = next
    }
  }
}

async function submit() {
  if (loading.value) {
    toast.add({ title: '请求中请稍候', color: 'amber' })
    return
  }
  if (checkList.value.length === 0) {
    toast.add({ title: '请选择', color: 'amber' })
    return
  }
  const options_id = checkList.value.map((c) => c.options_id)
  loading.value = true
  try {
    await insertVoteRecord({ vote_id: props.voteId, options_id })
    await loadDetail()
    await loadIsVote()
  } finally {
    loading.value = false
  }
}

watch(
  () => props.voteId,
  () => {
    void loadDetail()
    void loadIsVote()
  }
)

watch(
  () => detail.value?.vote_options,
  () => syncOptionRich(),
  { deep: true }
)

onMounted(() => {
  void loadDetail()
  void loadIsVote()
})
</script>

<template>
  <div :class="['py-1', wrapClass]">
    <template v-if="detail">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ detail.vote_title }}
        （{{ detail.vote_type === 0 ? '单选' : '多选' }}）
      </p>
      <div class="mt-1">
        <div
          v-for="opt in detail.vote_options"
          :key="opt.options_id"
          role="button"
          tabindex="0"
          class="relative my-2.5 flex w-full min-w-0 cursor-pointer items-stretch overflow-hidden rounded-[10px] shadow-[2px_2px_5px] shadow-gray-200/90 transition duration-300 select-none dark:shadow-gray-900/50"
          :class="
            isVoted
              ? 'cursor-default'
              : 'hover:opacity-95'
          "
          @click="chooseOptions(opt)"
          @keydown.enter.prevent="chooseOptions(opt)"
        >
          <div
            class="pointer-events-none absolute left-0 top-0 z-0 h-full rounded-l-[10px] transition-[width] duration-300"
            :class="
              isSelected(opt.options_id)
                ? 'bg-red-100 dark:bg-red-900/25'
                : 'bg-zinc-200/90 dark:bg-zinc-600/50'
            "
            :style="{ width: barWidth(opt) }"
            aria-hidden="true"
          />
          <div
            class="relative z-[1] flex min-w-0 flex-1 items-center bg-[#f5f5f5] px-4 py-1.5 text-sm leading-snug dark:bg-zinc-800/90"
            :class="
              isSelected(opt.options_id)
                ? 'text-red-500 dark:text-red-400'
                : 'text-zinc-900 dark:text-zinc-100'
            "
          >
            <SafeRichText
              v-if="(richByOptionId[opt.options_id]?.length ?? 0) > 0"
              :nodes="richByOptionId[opt.options_id]!"
            />
            <span v-else class="text-sm">{{ plainPreview(opt) }}</span>
          </div>
          <div
            class="relative z-[1] flex shrink-0 items-center bg-[#f5f5f5] px-3 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-300"
            :class="
              isSelected(opt.options_id)
                ? 'text-red-500 dark:text-red-400'
                : ''
            "
          >
            {{ opt.options_number }}
          </div>
        </div>
      </div>
      <div
        class="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400"
      >
        <div class="min-w-0 flex-1">
          <template v-if="!isVoted">
            <UButton
              v-if="voteOpen"
              size="xs"
              :loading="loading"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="submit"
            >
              投票
            </UButton>
            <span v-else>投票已截止</span>
          </template>
          <span v-else>已投票</span>
        </div>
        <span class="mr-3 shrink-0">投票人数 {{ detail.vote_number }}</span>
      </div>
    </template>
  </div>
</template>
