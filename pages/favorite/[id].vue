<script setup lang="ts">
import { nextTick } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { BASE_IMG } from '@/utils/ipConfig'
import { formatRich } from '@/utils/public'
import {
  deleteFavoriteFolder,
  getCollectListVisitor,
  getFavoriteDetail,
} from '@/api/collect'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type {
  CollectCommunityInfo,
  CollectLibraryInfo,
  CollectVisitorRow,
  FavoriteDetail,
} from '@/types/api'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const route = useRoute()
const router = useRouter()
const toast = useToast()
const layoutReady = inject('layoutReady') as Ref<boolean>
const userStore = useUserStore()
const { user } = storeToRefs(userStore)

const folderId = computed(() => {
  const raw = route.params.id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) ? n : 0
})

const info = ref<FavoriteDetail | null>(null)
const detailLoading = ref(false)

const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const favoriteOptionsModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)

const showDeleteFolder = ref(false)
const deletingFolder = ref(false)

const isOwner = computed(
  () => !!user.value?.user_id && user.value?.user_id === info.value?.user_id
)

/** 旧站约定：able_delete === 0 时可删收藏夹 */
const canDeleteFolder = computed(
  () => isOwner.value && info.value && info.value.able_delete === 0
)

const totalCount = computed(() => Number(waterList.value?.total) || 0)

const coverSrc = (row: FavoriteDetail | null) =>
  `${BASE_IMG}${row?.favorite_pic || 'static/plan_cover/default.jpg'}`

const formatDateTime = (d?: string) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '—')

/** 「3天前」等相对时间（中文） */
const formatCollectedAgo = (d?: string) => {
  if (!d) return '—'
  const t = dayjs(d)
  if (!t.isValid()) return '—'
  return t.fromNow()
}

const libraryCover = (lib: CollectLibraryInfo) =>
  `${BASE_IMG}${lib.square_cover || lib.cover || ''}`

/** 帖子首图 URL：优先 small/img 列表，再从正文 HTML 中取第一张 */
function communityFirstImage(info: CollectCommunityInfo): string | null {
  const firstFromList = (raw: string | null | undefined): string | undefined => {
    if (raw == null || !String(raw).trim()) return undefined
    const first = String(raw)
      .split(',')
      .map((s) => s.trim())
      .find(Boolean)
    return first
  }
  const rel =
    firstFromList(info.small_img_list) ?? firstFromList(info.img_list)
  if (rel) {
    if (/^https?:\/\//i.test(rel)) return rel
    return `${BASE_IMG}${rel.replace(/^\//, '')}`
  }
  if (info.content) {
    const { image } = formatRich(info.content)
    const src = image[0]
    if (src) {
      if (/^https?:\/\//i.test(src)) return src
      return `${BASE_IMG}${src.replace(/^\//, '')}`
    }
  }
  return null
}

/** 1×1 透明图，用于无封面卡片上触发瀑布流高度重算 */
const pixelGif =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAEMADw=='

function stripHtml(html?: string) {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 120 ? `${text.slice(0, 120)}…` : text
}

function isLibraryInfo(
  r: CollectVisitorRow
): r is CollectVisitorRow & { info: CollectLibraryInfo } {
  return !!(r.info as CollectLibraryInfo | undefined)?.library_id
}

function isCommunityInfo(
  r: CollectVisitorRow
): r is CollectVisitorRow & { info: CollectCommunityInfo } {
  return !!(r.info as CollectCommunityInfo | undefined)?.community_id
}

async function loadDetail() {
  if (!folderId.value) return
  detailLoading.value = true
  try {
    info.value = await getFavoriteDetail({ id: folderId.value })
  } catch {
    info.value = null
  } finally {
    detailLoading.value = false
  }
}

async function fetchFavoriteCollects(page: number, pageSize: number) {
  if (!folderId.value) {
    return { rows: [] as CollectVisitorRow[], count: 0 }
  }
  const data = await getCollectListVisitor({
    id: folderId.value,
    page,
    pageSize,
  })
  return {
    rows: data.rows ?? [],
    count: data.count ?? 0,
  }
}

watch(
  () => folderId.value,
  async (id) => {
    if (!id) {
      info.value = null
      return
    }
    await loadDetail()
  },
  { immediate: true }
)

watch(info, () => {
  if (info.value?.favorite_name) {
    useHead({
      title: `${info.value.favorite_name} - 收藏夹`,
    })
  }
})

function handleCollectClick(data: { pk_id: number; collect_type: number }) {
  if (!userStore.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: 120,
    clientY: 120,
  })
  favoriteOptionsModalRef.value?.showModel(
    { pk_id: data.pk_id, collect_type: data.collect_type },
    clickEvent
  )
}

function handleCollectChange(result: boolean) {
  if (result) {
    toast.add({
      title: '收藏已更新',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } else {
    toast.add({
      title: '已调整收藏',
      icon: 'i-heroicons-information-circle',
      color: 'amber',
    })
  }
  waterList.value?.refresh()
}

async function confirmDeleteFolder() {
  const id = info.value?.id
  const uid = info.value?.user_id
  if (id == null || uid == null) return
  deletingFolder.value = true
  try {
    await deleteFavoriteFolder({ id })
    toast.add({
      title: '收藏夹已删除',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    showDeleteFolder.value = false
    await router.push('/favorite')
  } finally {
    deletingFolder.value = false
  }
}

function triggerLayout(debouncedApplyLayout: () => void) {
  nextTick(() => debouncedApplyLayout())
}
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 px-4 overflow-hidden max-w-[1600px]">
    <div v-if="detailLoading && !info" class="flex justify-center py-20 text-gray-500">
      加载中…
    </div>

    <div v-else-if="info" class="space-y-5">
      <!-- 头部：与全站 polaroid / 圆角卡片风格一致 -->
      <div
        class="polaroid-card flex flex-col sm:flex-row gap-4 p-4 sm:p-5 bg-white border border-gray-100 shadow-sm"
      >
        <div class="w-full sm:w-40 h-40 shrink-0 rounded-2xl overflow-hidden bg-gray-100">
          <img
            :src="coverSrc(info)"
            :alt="info.favorite_name"
            class="w-full h-full object-cover"
            loading="lazy"
          >
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center">
          <div class="flex flex-wrap items-center gap-2 gap-y-1">
            <h1 class="text-xl sm:text-2xl font-bold text-gray-900">
              {{ info.favorite_name }}
            </h1>
            <UBadge :color="info.is_private === 1 ? 'amber' : 'green'" variant="soft" size="xs">
              {{ info.is_private === 1 ? '私有' : '公开' }}
            </UBadge>
          </div>
          <div class="text-sm text-gray-600 mt-2">
            创建者 {{ info.user_name || '—' }}
          </div>
          <div class="text-sm text-gray-500 mt-1">
            <span class="tabular-nums">{{ totalCount }}</span> 条收藏 ·
            <span class="tabular-nums">{{ info.times_count ?? 0 }}</span> 次浏览
          </div>
          <p v-if="info.favorite_desc" class="text-sm text-gray-600 mt-3 line-clamp-3">
            {{ info.favorite_desc }}
          </p>
          <div class="text-xs text-gray-400 mt-2">
            创建于 {{ formatDateTime(info.create_time) }}
          </div>
          <div v-if="isOwner" class="flex flex-wrap gap-2 mt-4">
            <UButton
              v-if="canDeleteFolder"
              color="red"
              variant="soft"
              size="sm"
              @click="showDeleteFolder = true"
            >
              删除收藏夹
            </UButton>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 px-1">
        <span class="font-medium text-gray-700 dark:text-gray-300">收藏内容</span>
        <span v-if="layoutReady" class="whitespace-nowrap tabular-nums">共 {{ totalCount }} 条</span>
      </div>

      <QhxWaterList
        v-if="layoutReady && folderId && info"
        :key="folderId"
        ref="waterList"
        :fetch-data="fetchFavoriteCollects"
        :columns="4"
        :item-key="9"
        :columns_768="2"
        :page-size="20"
        :enable-waterfall="true"
        :enable-load-more="true"
      >
        <template #default="{ item: row, debouncedApplyLayout }">
          <!-- 图鉴 -->
          <div
            v-if="isLibraryInfo(row)"
            class="custom-item mx-1 mb-2"
          >
            <div
              class="polaroid-card overflow-hidden bg-white transition-shadow duration-300 hover:shadow-lg flex flex-col"
            >
              <NuxtLink
                :to="`/library/detail/${row.info.library_id}`"
                class="block flex-1 min-w-0"
              >
                <div class="w-full overflow-hidden bg-gray-100 aspect-[3/4] max-h-[420px]">
                  <img
                    :src="libraryCover(row.info)"
                    :alt="row.info.name"
                    class="w-full h-full object-cover block"
                    loading="lazy"
                    @load="debouncedApplyLayout"
                  >
                </div>
                <div class="p-3 space-y-1.5">
                  <div class="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                    {{ row.info.name }}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-if="row.info.library_pattern || row.info.pattern"
                      color="pink"
                      variant="soft"
                      size="xs"
                    >
                      {{ row.info.library_pattern || row.info.pattern }}
                    </UBadge>
                    <UBadge v-if="row.info.state" color="gray" variant="soft" size="xs">
                      {{ row.info.state }}
                    </UBadge>
                  </div>
                  <div
                    v-if="row.info.price"
                    class="text-pink-600 font-semibold text-sm tabular-nums"
                  >
                    {{ row.info.price }}
                    {{ row.info.shop_country === 0 ? '元' : '日元' }}
                  </div>
                  <div class="text-[11px] text-gray-400">
                    收藏于 {{ formatCollectedAgo(row.create_time) }}
                  </div>
                </div>
              </NuxtLink>

              <div
                v-if="isOwner"
                class="flex justify-end items-center border-t border-gray-100 dark:border-gray-800 px-2 py-2 bg-gray-50/90 dark:bg-gray-900/50"
                @click.stop
              >
                <button
                  type="button"
                  class="inline-flex shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-qhx-primary hover:bg-white dark:hover:bg-gray-800 shadow-sm ring-1 ring-gray-200/80 dark:ring-gray-700 transition-colors"
                  title="收藏管理"
                  aria-label="收藏管理"
                  @click="handleCollectClick({ pk_id: row.info.library_id, collect_type: 2 })"
                >
                  <UIcon name="i-heroicons-queue-list" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- 帖子 -->
          <div
            v-else-if="isCommunityInfo(row)"
            class="custom-item relative mx-1 mb-2"
          >
            <img
              :src="pixelGif"
              alt=""
              width="1"
              height="1"
              class="absolute opacity-0 pointer-events-none w-px h-px"
              @load="debouncedApplyLayout"
            >
            <div
              class="polaroid-card overflow-hidden bg-white transition-shadow duration-300 hover:shadow-lg flex flex-col min-h-[180px]"
            >
              <NuxtLink
                :to="`/community/detail/${row.info.community_id}`"
                class="block flex-1 min-h-0"
              >
                <div
                  v-if="communityFirstImage(row.info)"
                  class="w-full overflow-hidden bg-gray-100 aspect-[4/3] max-h-[220px]"
                >
                  <img
                    :src="communityFirstImage(row.info) ?? ''"
                    :alt="row.info.title || '帖子配图'"
                    class="w-full h-full object-cover block"
                    loading="lazy"
                    @load="debouncedApplyLayout"
                  >
                </div>
                <div class="p-3 pb-2">
                  <div class="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">
                    {{ row.info.title || '无标题帖子' }}
                  </div>
                  <p class="text-xs text-gray-600 mt-2 line-clamp-5 leading-relaxed">
                    {{ stripHtml(row.info.content) }}
                  </p>
                </div>
              </NuxtLink>
              <div class="px-3 pb-2 pt-0 mt-auto">
                <div class="text-[11px] text-gray-400 border-t border-gray-50 dark:border-gray-800 pt-2">
                  收藏于 {{ formatCollectedAgo(row.create_time) }}
                </div>
                <div
                  v-if="isOwner"
                  class="flex justify-end items-center pt-2"
                  @click.stop
                >
                  <button
                    type="button"
                    class="inline-flex shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-qhx-primary hover:bg-gray-50 dark:hover:bg-gray-800/90 shadow-sm ring-1 ring-gray-200/80 dark:ring-gray-700 transition-colors"
                    title="收藏管理"
                    aria-label="收藏管理"
                    @click="handleCollectClick({ pk_id: row.info.community_id, collect_type: 3 })"
                  >
                    <UIcon name="i-heroicons-queue-list" class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 无法预览 -->
          <div v-else class="custom-item mx-1 mb-2" :ref="() => triggerLayout(debouncedApplyLayout)">
            <div class="polaroid-card p-4 text-sm text-gray-500 min-h-[100px] flex items-center justify-center text-center">
              已失效
            </div>
          </div>
        </template>

        <template #empty>
          <div
            class="text-center py-16 text-gray-500 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80"
          >
            暂无收藏内容
          </div>
        </template>

        <template #finished>
          <span class="text-gray-400 text-sm">没有更多了</span>
        </template>
      </QhxWaterList>
    </div>

    <div v-else class="text-center py-20 text-gray-500">
      未找到该收藏夹
    </div>

    <UModal v-model="showDeleteFolder" title="删除收藏夹">
      <div class="p-4 space-y-4">
        <p class="text-sm text-gray-600">
          收藏夹将被永久删除，是否确认？
        </p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showDeleteFolder = false">
            取消
          </UButton>
          <UButton
            color="red"
            :loading="deletingFolder"
            @click="confirmDeleteFolder"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </UModal>

    <FavoriteOptionsModal ref="favoriteOptionsModalRef" @change="handleCollectChange" />
  </div>
</template>
