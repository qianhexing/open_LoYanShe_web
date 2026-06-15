<script setup lang="ts">
import type { LibrarySimilarItem, Library } from '@/types/api'
import { getWardrobeClothesLibraryIds } from '@/api/wardrobe'
import { getLibrarySimilarBatch } from '@/api/library'
import { insertGood } from '@/api/good'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'

const props = defineProps<{
  /** 当前衣柜 ID；未选衣柜时不要调 open */
  wardrobeId?: number | null
}>()

const user = useUserStore()
const toast = useToast()

const PAGE_SIZE = 20

const showModal = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
/** 无 total：上一页有数据则允许继续加载，下一页空则视为结束 */
const hasMore = ref(false)
const libraryIds = ref<number[]>([])
const rows = ref<LibrarySimilarItem[]>([])

const favoriteModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)
const libraryTypeColorRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const wardrobeAddRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const collectLibraryId = ref<number | null>(null)

const seedLibraryCount = computed(() => libraryIds.value.length)
const resultCount = computed(() => rows.value.length)

const statusHint = computed(() => {
  if (loading.value) return '正在分析衣柜图鉴…'
  if (seedLibraryCount.value === 0) return '当前衣柜暂无图鉴，无法生成推荐'
  if (resultCount.value === 0) return '暂未找到相似图鉴，稍后再来看看'
  return `已基于 ${seedLibraryCount.value} 件图鉴匹配 · 共 ${resultCount.value} 条推荐`
})

const formatSimilarScore = (score: number) => {
  if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

const fetchSimilarPage = async (pageNum: number, append = false) => {
  const res = await getLibrarySimilarBatch({
    ids: libraryIds.value,
    page: pageNum,
    pageSize: PAGE_SIZE,
    need_Statistics: true,
  })
  const newRows = res.rows ?? []
  if (append) {
    if (newRows.length === 0) {
      hasMore.value = false
      return
    }
    const existingIds = new Set(rows.value.map((r) => r.library_id))
    rows.value.push(...newRows.filter((r) => !existingIds.has(r.library_id)))
    hasMore.value = true
  } else {
    rows.value = newRows
    hasMore.value = newRows.length > 0
  }
  page.value = pageNum
}

const open = async () => {
  if (!user.token) {
    toast.add({ title: '请先登录', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  const wid = props.wardrobeId ?? null
  if (wid == null) return
  showModal.value = true
  loading.value = true
  loadingMore.value = false
  page.value = 1
  hasMore.value = false
  rows.value = []
  libraryIds.value = []
  try {
    const ids = await getWardrobeClothesLibraryIds({ wardrobe_id: wid })
    if (ids.length === 0) return
    libraryIds.value = ids
    await fetchSimilarPage(1)
  } catch {
    rows.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loading.value || loadingMore.value || libraryIds.value.length === 0) return
  loadingMore.value = true
  try {
    await fetchSimilarPage(page.value + 1, true)
  } catch {
    hasMore.value = false
  } finally {
    loadingMore.value = false
  }
}

const onGoodClick = async (data: {
  pk_id: number
  pk_type: number
  type: number
  library_id: number
}) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  try {
    const result = await insertGood({ pk_id: data.pk_id, pk_type: data.pk_type, type: data.type })
    const idx = rows.value.findIndex((r) => r.library_id === data.library_id)
    if (idx !== -1) {
      const cur = rows.value[idx]
      rows.value[idx] = {
        ...cur,
        is_good: result ? 1 : 0,
        good_count: result ? (cur.good_count || 0) + 1 : Math.max((cur.good_count || 0) - 1, 0),
      }
    }
    toast.add({
      title: result ? '点赞成功' : '已取消点赞',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } catch {
    toast.add({ title: '操作失败', icon: 'i-heroicons-x-circle', color: 'red' })
  }
}

const onCollectClick = (
  data: { pk_id: number; collect_type: number; library_id: number },
  event?: MouseEvent,
) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  collectLibraryId.value = data.library_id
  const clickEvent =
    event ?? new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 })
  favoriteModalRef.value?.showModel({ pk_id: data.pk_id, collect_type: data.collect_type }, clickEvent)
}

const onCollectChange = (result: boolean) => {
  const lid = collectLibraryId.value
  collectLibraryId.value = null
  if (lid == null) return
  const idx = rows.value.findIndex((r) => r.library_id === lid)
  if (idx === -1) return
  const cur = rows.value[idx]
  if (result) {
    toast.add({ title: '收藏成功', icon: 'i-heroicons-check-circle', color: 'green' })
    rows.value[idx] = {
      ...cur,
      is_collect: 1,
      collect_count: (cur.collect_count || 0) + 1,
    }
  } else {
    toast.add({ title: '取消收藏', icon: 'i-heroicons-x-circle', color: 'red' })
    rows.value[idx] = {
      ...cur,
      is_collect: 0,
      collect_count: Math.max((cur.collect_count || 0) - 1, 0),
    }
  }
}

const onWardrobeClick = (data: { library: Library }) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  if (!data.library) {
    toast.add({ title: '图鉴信息不存在', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  libraryTypeColorRef.value?.showModel(data.library)
}

const onLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddRef.value?.showModel(data)
}

const onWardrobeAdded = (data?: { library_id?: number }) => {
  toast.add({ title: '加入衣柜成功', icon: 'i-heroicons-check-circle', color: 'green' })
  const lid = data?.library_id
  if (lid == null) return
  const idx = rows.value.findIndex((r) => r.library_id === lid)
  if (idx === -1) return
  const cur = rows.value[idx]
  rows.value[idx] = {
    ...cur,
    is_wardrobe: 1,
    wardrobe_count: (cur.wardrobe_count || 0) + 1,
  }
}

defineExpose({ open })
</script>

<template>
  <QhxModal v-model="showModal">
    <div
      class="wardrobe-similar-modal flex max-h-[88vh] w-[min(94vw,540px)] flex-col overflow-hidden rounded-3xl"
    >
      <div class="wardrobe-similar-toolbar flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="wardrobe-similar-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-200/90 to-purple-200/80 text-[#9d4080] shadow-sm dark:from-pink-900/50 dark:to-purple-900/40 dark:text-pink-200"
          >
            <UIcon name="i-heroicons-sparkles" class="text-lg" />
          </div>
          <div class="min-w-0 pt-0.5">
            <h3 class="text-base font-bold tracking-tight text-[#4a2f3d] dark:text-pink-50 sm:text-[17px]">
              根据本衣柜推荐
            </h3>
            <p class="mt-0.5 text-[11px] leading-snug text-[#8a6f7d] dark:text-pink-300/80 sm:text-xs">
              {{ statusHint }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8a6f7d] transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
          aria-label="关闭"
          @click="showModal = false"
        >
          <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
        </button>
      </div>

      <div class="wardrobe-similar-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 sm:px-4">
        <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-16">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-9 w-9 animate-spin text-[#9d6080] dark:text-pink-300"
          />
          <p class="text-sm text-[#7a5f6f] dark:text-pink-300/85">正在为你挑选相似图鉴…</p>
        </div>

        <div
          v-else-if="rows.length === 0"
          class="wardrobe-similar-empty flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center"
        >
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100/70 text-[#9d6080] dark:bg-pink-950/40 dark:text-pink-300"
          >
            <UIcon
              :name="seedLibraryCount === 0 ? 'hugeicons:wardrobe-04' : 'i-heroicons-magnifying-glass'"
              class="text-2xl"
            />
          </div>
          <p class="text-sm font-medium text-[#5e3a4b] dark:text-pink-100">
            {{ seedLibraryCount === 0 ? '衣柜里还没有图鉴' : '暂无相似推荐' }}
          </p>
          <p class="max-w-[240px] text-xs leading-relaxed text-[#8a6f7d] dark:text-pink-300/75">
            {{
              seedLibraryCount === 0
                ? '先往衣柜添加一些裙子，再来获取个性化推荐吧'
                : '可以尝试添加更多款式到衣柜，或稍后再来看看'
            }}
          </p>
        </div>

        <div v-else class="space-y-2.5">
          <LibraryItem
            v-for="sim in rows"
            :key="sim.library_id"
            :item="sim"
            size="wardrobe-similar"
            :show-actions="true"
            class-name="wardrobe-similar-card polaroid-card m-0 p-2.5 sm:p-3"
            @good-click="onGoodClick"
            @collect-click="onCollectClick"
            @wardrobe-click="onWardrobeClick"
          >
            <template #tagInfo>
              <span
                v-if="sim.similarity_score != null && !Number.isNaN(Number(sim.similarity_score))"
                class="wardrobe-similar-score inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              >
                <UIcon name="i-heroicons-sparkles" class="text-[9px] opacity-80" />
                相似 {{ formatSimilarScore(Number(sim.similarity_score)) }}
              </span>
            </template>
          </LibraryItem>

          <div class="wardrobe-similar-footer pt-1">
            <div v-if="loadingMore" class="flex items-center justify-center gap-2 py-3 text-sm text-[#8a6f7d] dark:text-pink-300/80">
              <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
              加载更多…
            </div>
            <button
              v-else-if="hasMore"
              type="button"
              class="wardrobe-similar-loadmore mx-auto flex w-full max-w-[280px] items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-[#9d4080] transition active:scale-[0.98] dark:text-pink-200"
              @click="loadMore"
            >
              <UIcon name="i-heroicons-chevron-down" class="text-base" />
              加载更多
            </button>
            <p v-else class="py-3 text-center text-xs text-[#a8929c] dark:text-pink-400/55">
              — 已经到底啦 —
            </p>
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
  <LibraryTypeColorChoose ref="libraryTypeColorRef" @choose="onLibraryTypeColorChoose" />
  <WardrobeAddLibrary ref="wardrobeAddRef" @change="onWardrobeAdded" />
  <FavoriteOptionsModal ref="favoriteModalRef" @change="onCollectChange" />
</template>

<style scoped>
.wardrobe-similar-modal {
  --neu-shadow-d: rgba(150, 110, 130, 0.24);
  --neu-shadow-l: rgba(255, 252, 254, 0.94);
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px var(--neu-shadow-d),
    -8px -8px 22px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .wardrobe-similar-modal {
  --neu-shadow-d: rgba(0, 0, 0, 0.5);
  --neu-shadow-l: rgba(100, 70, 90, 0.1);
  background-color: #241d26;
  box-shadow:
    8px 8px 22px var(--neu-shadow-d),
    -6px -6px 18px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 210, 230, 0.05);
}

.wardrobe-similar-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(157, 96, 128, 0.35) transparent;
}

.wardrobe-similar-body::-webkit-scrollbar {
  width: 5px;
}

.wardrobe-similar-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(157, 96, 128, 0.35);
}

.wardrobe-similar-empty {
  background: rgba(255, 255, 255, 0.28);
  box-shadow:
    inset 2px 2px 8px rgba(150, 110, 130, 0.12),
    inset -2px -2px 8px rgba(255, 252, 254, 0.65);
}

.dark .wardrobe-similar-empty {
  background: rgba(0, 0, 0, 0.12);
  box-shadow:
    inset 2px 2px 8px rgba(0, 0, 0, 0.28),
    inset -1px -1px 6px rgba(100, 70, 90, 0.08);
}

:deep(.wardrobe-similar-card) {
  border-radius: 1rem;
  border: 1px solid rgba(210, 170, 190, 0.35);
  background: rgba(255, 252, 254, 0.72);
  box-shadow:
    4px 4px 12px rgba(150, 110, 130, 0.14),
    -2px -2px 8px rgba(255, 252, 254, 0.85);
  animation: wardrobe-similar-in 0.35s ease both;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

:deep(.wardrobe-similar-card:nth-child(1)) { animation-delay: 0ms; }
:deep(.wardrobe-similar-card:nth-child(2)) { animation-delay: 40ms; }
:deep(.wardrobe-similar-card:nth-child(3)) { animation-delay: 80ms; }
:deep(.wardrobe-similar-card:nth-child(4)) { animation-delay: 120ms; }
:deep(.wardrobe-similar-card:nth-child(5)) { animation-delay: 160ms; }
:deep(.wardrobe-similar-card:nth-child(6)) { animation-delay: 200ms; }
:deep(.wardrobe-similar-card:nth-child(n + 7)) { animation-delay: 240ms; }

:deep(.wardrobe-similar-card:hover) {
  transform: translateY(-1px);
  box-shadow:
    6px 6px 16px rgba(150, 110, 130, 0.18),
    -3px -3px 10px rgba(255, 252, 254, 0.9);
}

.dark :deep(.wardrobe-similar-card) {
  border-color: rgba(180, 100, 140, 0.2);
  background: rgba(35, 28, 38, 0.72);
  box-shadow:
    4px 4px 14px rgba(0, 0, 0, 0.32),
    inset 1px 1px 0 rgba(255, 210, 230, 0.04);
}

.wardrobe-similar-score {
  color: #9d4080;
  background: linear-gradient(135deg, rgba(255, 182, 210, 0.35), rgba(210, 180, 255, 0.28));
  border: 1px solid rgba(210, 140, 180, 0.25);
}

.dark .wardrobe-similar-score {
  color: #f5b8d8;
  background: linear-gradient(135deg, rgba(120, 40, 80, 0.45), rgba(80, 40, 100, 0.35));
  border-color: rgba(200, 120, 160, 0.2);
}

.wardrobe-similar-loadmore {
  background: rgba(255, 252, 254, 0.55);
  box-shadow:
    4px 4px 12px rgba(150, 110, 130, 0.16),
    -3px -3px 10px rgba(255, 252, 254, 0.85),
    inset 1px 1px 0 rgba(255, 255, 255, 0.6);
}

.wardrobe-similar-loadmore:hover {
  background: rgba(255, 252, 254, 0.78);
}

.dark .wardrobe-similar-loadmore {
  background: rgba(40, 32, 44, 0.65);
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.35),
    inset 1px 1px 0 rgba(255, 210, 230, 0.05);
}

@keyframes wardrobe-similar-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
