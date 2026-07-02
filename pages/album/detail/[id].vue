<script setup lang="ts">
import { getAlbumList, getAlbumDetail } from '@/api/album'
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import type { RichNode } from '@/utils/public'
import type AlbumForeignAddEdit from '@/components/Album/AlbumForeignAddEdit.vue'
import AlbumDialCarousel from '@/components/Album/AlbumDialCarousel.vue'
import AlbumForeignAchieveDisplay from '@/components/Album/AlbumForeignAchieveDisplay.vue'
import AlbumCoverShareImage from '@/components/Album/AlbumCoverShareImage.vue'
import type { AlbumDialSlide } from '@/components/Album/AlbumDialCarousel.vue'
import type { Album, AblumForeign } from '@/types/api'
import type { AlbumCoverSharePayload } from '@/utils/albumShareCanvas'

definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const toast = useToast()

const id = route.params.id as string
const user_id = route.query.user_id ? Number.parseInt(route.query.user_id as string) : null

interface ExtendedAlbum extends Omit<Album, 'album_foreign'> {
  album_desc?: string
  count?: number
  count_achieve?: number
  conclusion?: string
  pk_type?: number
  album_foreign?: AblumForeign | null
}

const info = ref<ExtendedAlbum | null>(null)
const albumItems = ref<ExtendedAlbum[]>([])
const listLoading = ref(true)
const dialIndex = ref(0)
const addEditAlbumRef = ref<InstanceType<typeof AlbumForeignAddEdit> | null>(null)
const albumShareRef = ref<{ generateAndUpload: () => Promise<void> } | null>(null)
const albumShareGenerating = ref(false)

const parentCover = computed(() =>
  BASE_IMG + (info.value?.album_cover || 'static/plan_cover/default.jpg')
)

const dialSlides = computed<AlbumDialSlide[]>(() => {
  if (!info.value) return []

  const coverSlide: AlbumDialSlide = {
    id: 'cover',
    title: info.value.album_title,
    image: parentCover.value,
    isCover: true
  }

  const itemSlides: AlbumDialSlide[] = albumItems.value.map((item) => ({
    id: item.album_id,
    title: item.album_title,
    image: getCoverImage(item),
    locked: !item.album_foreign
  }))

  return [coverSlide, ...itemSlides]
})

const activeAlbumItem = computed(() => {
  if (dialIndex.value <= 0) return null
  return albumItems.value[dialIndex.value - 1] ?? null
})

const activeSlide = computed(() => dialSlides.value[dialIndex.value] ?? null)

const isCurrentUser = computed(() => {
  if (!user.user?.user_id) return false
  if (user_id) return user.user.user_id === user_id
  return true
})

const canReCheckIn = computed(
  () =>
    isCurrentUser.value &&
    !!activeAlbumItem.value?.album_foreign &&
    activeAlbumItem.value.pk_type === 0
)

const showActionBar = computed(
  () => (dialIndex.value === 0 && !!info.value) || canReCheckIn.value
)

const albumSharePayload = computed((): AlbumCoverSharePayload | null => {
  if (!info.value) return null
  return {
    albumTitle: info.value.album_title || '成就相册',
    coverUrl: info.value.album_cover || 'static/plan_cover/default.jpg',
    count: info.value.count || 0,
    countAchieve: info.value.count_achieve || 0,
    progress: achieveProgress.value,
    userName: user.user?.user_name || undefined,
    items: albumItems.value.slice(0, 12).map((item) => ({
      title: item.album_title || '',
      coverUrl: getCoverImagePath(item),
      achieved: !!item.album_foreign
    }))
  }
})

const achieveProgress = computed(() => {
  const total = info.value?.count || 0
  const achieved = info.value?.count_achieve || 0
  if (!total) return 0
  return Math.min(100, Math.round((achieved / total) * 100))
})

const conclusionNodes = computed<RichNode[]>(() => {
  if (!info.value?.conclusion) return []
  try {
    return parseRichText(info.value.conclusion)
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
})

const showConclusion = computed(() => {
  const total = info.value?.count || 0
  const hasAllItems = albumItems.value.length >= total && total > 0
  const hasConclusion = !!(info.value?.conclusion && info.value.conclusion !== '')
  const allAchieved = !albumItems.value.some((child) => !child.album_foreign)
  return hasAllItems && hasConclusion && allAchieved
})

const fetchAlbumDetail = async () => {
  try {
    const params: { album_id: number; user_id?: number } = {
      album_id: Number.parseInt(id)
    }
    if (user_id) {
      params.user_id = user_id
    }
    const response = await getAlbumDetail(params)
    info.value = response as unknown as ExtendedAlbum
  } catch (error) {
    console.error('获取相册详情失败:', error)
    toast.add({
      title: '获取详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

const fetchAllAlbumItems = async () => {
  listLoading.value = true
  try {
    const params: {
      parent_id: number
      page: number
      pageSize: number
      user_id?: number
    } = {
      parent_id: Number.parseInt(id),
      page: 1,
      pageSize: 200
    }
    if (user_id) {
      params.user_id = user_id
    }
    const response = await getAlbumList(params)
    albumItems.value = response.rows as ExtendedAlbum[]
  } catch (error) {
    console.error('获取相册列表失败:', error)
    toast.add({
      title: '获取列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    listLoading.value = false
  }
}

const refreshData = async () => {
  await Promise.all([fetchAlbumDetail(), fetchAllAlbumItems()])
}

const getCoverImagePath = (item: ExtendedAlbum): string => {
  const cover = item.album_foreign?.cover
  if (cover) {
    if (Array.isArray(cover) && cover.length > 0) {
      return cover[0]
    }
    if (typeof cover === 'string') {
      return cover.split(',')[0] || ''
    }
  }
  return item.album_cover || 'static/plan_cover/default.jpg'
}

const getCoverImage = (item: ExtendedAlbum): string => {
  return BASE_IMG + getCoverImagePath(item)
}

const clockInSuccess = () => {
  refreshData()
}

const clockIn = (item: ExtendedAlbum) => {
  if (item.album_foreign) return

  if (user_id && user.user?.user_id !== user_id) {
    return
  }

  addEditAlbumRef.value?.showModel({ album_id: item.album_id })
}

const reCheckIn = (item: ExtendedAlbum) => {
  addEditAlbumRef.value?.editModel({ album_id: item.album_id })
}

async function generateAlbumShare() {
  if (albumShareGenerating.value) return
  if (dialIndex.value !== 0) {
    toast.add({
      title: '请切换到相册封面后生成分享图',
      icon: 'i-heroicons-information-circle',
      color: 'amber'
    })
    return
  }
  albumShareGenerating.value = true
  try {
    await nextTick()
    await albumShareRef.value?.generateAndUpload()
  } finally {
    albumShareGenerating.value = false
  }
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  setTimeout(() => {
    refreshData()
  })
})

useHead({
  title: computed(() => info.value?.album_title || '相册详情'),
  meta: [
    { name: 'keywords', content: 'Lo研社,成就相册,Lolita相册' },
    { name: 'description', content: computed(() => info.value?.album_title || 'Lolita成就相册详情') }
  ]
})
</script>

<template>
  <div class="album-detail-page flex h-dvh flex-col overflow-hidden bg-qhx-bg safe-area-top">
    <!-- 标题栏 -->
    <header class="album-header shrink-0 border-b border-gray-100/80 bg-qhx-bg px-4 pb-2 pt-3 md:px-6 md:pt-4">
      <div class="album-title-bar flex min-h-9 items-center gap-2">
        <h1 v-if="info" class="min-w-0 flex-1 truncate text-lg font-bold text-gray-900 md:text-xl">
          {{ info.album_title }}
        </h1>
        <h1 v-else class="min-w-0 flex-1 text-lg font-bold text-gray-400 md:text-xl">相册详情</h1>
      </div>
    </header>

    <!-- 可滚动内容区 -->
    <section class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-3 md:px-6">
      <div
        v-if="activeSlide"
        class="album-hero-cover relative mx-auto mb-2 w-full max-w-xs shrink-0 overflow-hidden rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] ring-1 ring-black/5"
        style="aspect-ratio: 3/4"
        @click="activeAlbumItem && !activeAlbumItem.album_foreign && clockIn(activeAlbumItem)"
      >
        <img
          :src="activeSlide.image"
          :alt="activeSlide.title"
          class="h-full w-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
        <div class="absolute inset-x-0 bottom-0 px-4 pb-3 pt-10">
          <p class="text-lg font-bold text-white drop-shadow">{{ activeSlide.title }}</p>
          <p v-if="activeSlide.isCover" class="mt-1 text-xs text-white/80">相册封面</p>
          <p v-else-if="activeSlide.locked" class="mt-1 flex items-center gap-1 text-xs text-white/85">
            <UIcon name="i-heroicons-lock-closed" class="h-3.5 w-3.5" />
            未打卡 · 点击解锁
          </p>
          <p v-else class="mt-1 text-xs text-white/85">已打卡</p>
        </div>
        <div
          v-if="activeSlide.locked && !activeSlide.isCover"
          class="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white"
        >
          未解锁
        </div>
        <div
          v-else-if="!activeSlide.isCover"
          class="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-medium text-white shadow"
        >
          <UIcon name="i-heroicons-check-circle" class="h-3.5 w-3.5" />
          已打卡
        </div>
      </div>

      <!-- 功能栏：封面大图下方 -->
      <div
        v-if="showActionBar"
        class="album-action-bar mx-auto mb-2 flex w-full max-w-xs flex-wrap items-center justify-start gap-1 rounded-xl bg-white/90 px-2 py-2 shadow-sm ring-1 ring-gray-100"
      >
        <QhxJellyButton v-if="dialIndex === 0 && info">
          <div
            class="flex h-[46px] cursor-pointer flex-col items-center justify-center px-1"
            @click="generateAlbumShare"
          >
            <div
              class="m-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-qhx-primary text-white"
            >
              <UIcon
                :name="albumShareGenerating ? 'i-heroicons-arrow-path' : 'i-heroicons-photo-20-solid'"
                class="text-base"
                :class="{ 'animate-spin': albumShareGenerating }"
              />
            </div>
            <div class="text-[10px] text-gray-600">
              {{ albumShareGenerating ? '生成中' : '分享图' }}
            </div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton v-if="canReCheckIn && activeAlbumItem">
          <div
            class="flex h-[46px] cursor-pointer flex-col items-center justify-center px-1"
            @click="reCheckIn(activeAlbumItem)"
          >
            <div
              class="m-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700"
            >
              <UIcon name="i-heroicons-arrow-path" class="text-base" />
            </div>
            <div class="text-[10px] text-gray-600">重新打卡</div>
          </div>
        </QhxJellyButton>
      </div>

      <!-- 占位 / 详情 -->
      <div
        class="album-top-placeholder flex flex-col items-center rounded-xl border border-dashed border-gray-200/80 bg-white/50 px-4 py-4 text-center"
        :class="{ '!border-solid !border-gray-100 !bg-white': activeAlbumItem?.album_foreign }"
      >
        <Transition name="album-detail" mode="out-in">
          <div v-if="info && dialIndex === 0" key="cover-stats" class="w-full max-w-md space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
                <p class="text-[11px] text-gray-400">目标总数</p>
                <p class="text-xl font-bold tabular-nums text-gray-900">{{ info.count || 0 }}</p>
              </div>
              <div class="rounded-xl bg-qhx-primary px-4 py-3 text-white shadow-sm">
                <p class="text-[11px] text-white/80">已打卡</p>
                <p class="text-xl font-bold tabular-nums">{{ info.count_achieve || 0 }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div class="album-progress h-full rounded-full bg-qhx-primary" :style="{ width: achieveProgress + '%' }" />
              </div>
              <span class="text-xs font-medium text-gray-500">{{ achieveProgress }}%</span>
            </div>
          </div>

          <div v-else-if="activeAlbumItem?.album_foreign" key="item-achieved" class="w-full">
            <AlbumForeignAchieveDisplay
              :title="activeAlbumItem.album_title"
              :desc="activeAlbumItem.album_desc"
              :foreign="activeAlbumItem.album_foreign"
            />
          </div>

          <div v-else-if="activeAlbumItem" key="item-detail" class="w-full max-w-md text-left">
            <h2 class="text-base font-semibold text-gray-900">{{ activeAlbumItem.album_title }}</h2>
            <p v-if="activeAlbumItem.album_desc" class="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600">
              {{ activeAlbumItem.album_desc }}
            </p>
            <p class="mt-3 text-xs text-gray-400">点击上方图片解锁此目标</p>
          </div>

          <div v-else key="placeholder" class="py-2 text-xs text-gray-400">
            在下方拨盘左右拖拽，切换不同打卡目标
          </div>
        </Transition>
      </div>

      <!-- 卷末结语 -->
      <div v-if="showConclusion" class="mt-3 shrink-0">
        <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-md md:p-6">
          <div class="mb-3 flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-book-open" class="h-5 w-5 text-qhx-primary" />
            <span class="text-base font-bold text-gray-900">卷末结语</span>
          </div>
          <div class="conclusion-content text-center text-sm leading-relaxed text-gray-700">
            <SafeRichText :nodes="conclusionNodes" />
          </div>
        </div>
      </div>
    </section>

    <!-- 底部固定：仪表盘拨盘 -->
    <section
      class="album-dial-section z-10 shrink-0 rounded-t-2xl border-t border-white/50 bg-white/55 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl md:px-6"
    >
      <div v-if="listLoading || !info" class="flex items-center justify-center py-4">
        <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-gray-400" />
      </div>

      <AlbumDialCarousel
        v-else-if="dialSlides.length"
        v-model="dialIndex"
        :slides="dialSlides"
      />

      <div v-else class="py-4 text-center text-sm text-gray-400">暂无内容</div>
    </section>

    <AlbumForeignAddEdit ref="addEditAlbumRef" @success="clockInSuccess" />

    <AlbumCoverShareImage ref="albumShareRef" :payload="albumSharePayload" panelless />
  </div>
</template>

<style scoped>
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

.album-detail-page {
  height: 100dvh;
  height: 100vh;
}

.album-dial-section {
  min-height: 0;
}

.album-detail-enter-active,
.album-detail-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.album-detail-enter-from,
.album-detail-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.album-progress {
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.conclusion-content :deep(p) {
  margin-bottom: 12px;
}
</style>
