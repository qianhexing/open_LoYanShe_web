<script setup lang="ts">
import { getAlbumList, getAlbumDetail } from '@/api/album'
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import type { RichNode } from '@/utils/public'
import type AlbumForeignAddEdit from '@/components/Album/AlbumForeignAddEdit.vue'
import type { Album, AblumForeign, PaginationResponse } from '@/types/api'

// 禁用 SSR
definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const toast = useToast()

const id = route.params.id as string
const user_id = route.query.user_id ? Number.parseInt(route.query.user_id as string) : null

// 扩展 Album 类型
interface ExtendedAlbum extends Album {
  album_desc?: string
  count?: number
  count_achieve?: number
  conclusion?: string
  pk_type?: number
  album_foreign?: AblumForeign | null
}

const info = ref<ExtendedAlbum | null>(null)
const current = ref(0)
const swiperCurrent = ref(0)
const showActionSheet = ref(false)
const operateItem = ref<ExtendedAlbum | null>(null)

// 组件引用
const addEditAlbumRef = ref<InstanceType<typeof AlbumForeignAddEdit> | null>(null)
const waterListRef = ref<{ refresh: () => void } | null>(null)

// 标签页列表
const tabs_list = [
  {
    name: '打卡相册',
    count: 0
  }
]

// 操作选项
const actionOptions = [
  { text: '重新打卡', value: 0 }
]

// 获取相册详情
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

// 获取相册列表（用于瀑布流）
const fetchAlbumList = async (pageNum: number, pageSizeNum: number) => {
  try {
    const params: {
      parent_id: number
      page: number
      pageSize: number
      user_id?: number
    } = {
      parent_id: Number.parseInt(id),
      page: pageNum,
      pageSize: pageSizeNum
    }
    if (user_id) {
      params.user_id = user_id
    }
    const response = await getAlbumList(params)
    
    return {
      rows: response.rows as ExtendedAlbum[],
      count: response.count
    }
  } catch (error) {
    console.error('获取相册列表失败:', error)
    toast.add({
      title: '获取列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    throw error
  }
}

// 打卡成功回调
const clockInSuccess = () => {
  // 重新获取详情和列表
  fetchAlbumDetail()
  if (waterListRef.value) {
    waterListRef.value.refresh()
  }
}

// 打卡
const clockIn = (item: ExtendedAlbum) => {
  const params: { album_id: number; user_id?: number } = {
    album_id: item.album_id
  }
  
  if (!item.album_foreign) {
    // 未打卡，需要判断权限
    if (user_id && user.user?.user_id !== user_id) {
      return
    }
    if (addEditAlbumRef.value) {
      addEditAlbumRef.value.showModel(params)
    }
  } else {
    // 已打卡，显示成就
    if (user_id) {
      params.user_id = user_id
    }
    if (addEditAlbumRef.value) {
      addEditAlbumRef.value.showAchieve(params)
    }
  }
}

// 长按处理
const handleLongPress = (item: ExtendedAlbum) => {
  if (item.album_foreign && item.pk_type === 0) {
    operateItem.value = item
    showActionSheet.value = true
  }
}

// 操作菜单选择
const handleActionSelect = (index: number) => {
	console.log(index, '触发了')
  if (index === 0 && operateItem.value) {
    const params = {
      album_id: operateItem.value.album_id
    }
    if (addEditAlbumRef.value) {
      addEditAlbumRef.value.editModel(params)
    }
  }
  showActionSheet.value = false
}

// 标签页切换
const tabsChange = (index: number) => {
  swiperCurrent.value = index
  current.value = index
}

// 返回
const goBack = () => {
  router.back()
}

// 解析结语为富文本节点
const conclusionNodes = computed<RichNode[]>(() => {
  if (!info.value?.conclusion) return []
  try {
    return parseRichText(info.value.conclusion)
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
})

// 打卡进度百分比
const achieveProgress = computed(() => {
  const total = info.value?.count || 0
  const achieved = info.value?.count_achieve || 0
  if (!total) return 0
  return Math.min(100, Math.round((achieved / total) * 100))
})

// 判断是否显示结语（需要从瀑布流组件获取数据）
const showConclusion = ref(false)
const checkConclusion = (list: ExtendedAlbum[], total: number) => {
  const hasAllItems = list.length >= total
  const hasConclusion = !!(info.value?.conclusion && info.value.conclusion !== '')
  const allAchieved = !list.some((child) => child.album_foreign === null)
  showConclusion.value = hasAllItems && hasConclusion && allAchieved
}

// 获取封面图片
const getCoverImage = (item: ExtendedAlbum): string => {
  const cover = item.album_foreign?.cover
  if (cover) {
    if (Array.isArray(cover) && cover.length > 0) {
      return BASE_IMG + cover[0]
    }
    if (typeof cover === 'string') {
      const covers = cover.split(',')
      return BASE_IMG + covers[0]
    }
  }
  return BASE_IMG + (item.album_cover || 'static/plan_cover/default.jpg')
}

onMounted(async () => {
  setTimeout(async () => {
    await fetchAlbumDetail()
  })
})

useHead({
  title: info.value?.album_title || '相册详情',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,成就相册,Lolita相册'
    },
    {
      name: 'description',
      content: info.value?.album_title || 'Lolita成就相册详情'
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-qhx-bg safe-area-top">
    <!-- 内容区域 -->
    <div class="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <Transition name="album-detail" mode="out-in">
        <div v-if="info" key="album-info" class="mb-6 space-y-5">
          <!-- 封面区域 -->
          <div
            class="album-block group overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-lg shadow-gray-200/60 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div class="relative w-full overflow-hidden pb-[56.25%] lg:pb-[40%]">
              <img
                :src="BASE_IMG + (info.album_cover || 'static/plan_cover/default.jpg')"
                :alt="info.album_title"
                class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div class="absolute inset-x-0 bottom-0 px-6 pb-5 pt-14 md:px-8 md:pb-6 md:pt-16">
                <h1 class="text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] md:text-4xl">
                  {{ info.album_title }}
                </h1>
              </div>
            </div>
          </div>

          <!-- 统计信息 -->
          <div class="album-block grid gap-4 md:grid-cols-[1.2fr,1.8fr] md:gap-5">
            <div
              class="album-stat flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100/80 transition-all duration-300 ease-out hover:shadow-md md:px-6 md:py-5"
            >
              <div>
                <div class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">目标总数</div>
                <div class="text-2xl font-bold tabular-nums text-gray-900 md:text-3xl">
                  {{ info.count || 0 }}
                </div>
              </div>
              <span class="rounded-full bg-gradient-to-br from-qhx-primary/10 to-qhx-primary/5 px-3 py-1.5 text-xs font-medium text-qhx-primary">
                全部待打卡
              </span>
            </div>
            <div
              class="album-stat flex flex-col justify-between rounded-2xl bg-qhx-primary px-5 py-4 text-qhx-inverted shadow-md transition-all duration-300 ease-out hover:shadow-lg md:px-6 md:py-5"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/80">已打卡</div>
                  <div class="text-2xl font-bold tabular-nums md:text-3xl">
                    {{ info.count_achieve || 0 }}
                  </div>
                </div>
                <UIcon name="i-heroicons-sparkles" class="h-8 w-8 text-white/90 transition-transform duration-300 hover:scale-110" />
              </div>
              <div class="mt-3 flex items-center gap-2">
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    class="album-progress h-full rounded-full bg-white"
                    :style="{ width: achieveProgress + '%' }"
                  />
                </div>
                <span class="w-9 shrink-0 text-right text-xs font-medium text-white/90">{{ achieveProgress }}%</span>
              </div>
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            class="album-block flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3.5 shadow-sm transition-all duration-300 ease-out hover:border-amber-200"
          >
            <div class="mt-0.5 rounded-lg bg-amber-200/50 p-1.5">
              <UIcon name="i-heroicons-information-circle" class="h-5 w-5 text-amber-600" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-amber-900">小提示</p>
              <p class="mt-1 text-xs leading-relaxed text-amber-800/90">长按已打卡项目可以重新打卡，继续完善你的成就相册。</p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 相册列表 - 瀑布流布局 -->
      <QhxWaterList
        v-if="info"
        ref="waterListRef"
        :fetch-data="fetchAlbumList"
        :columns="3"
        :itemKey="1"
        :columns_768="2"
        :enableWaterfall="true"
        :enableLoadMore="true"
        :pageSize="10"
        class="mt-6"
      >
        <template #default="{ item, debouncedApplyLayout }">
          <div
            class="group mb-1 cursor-pointer overflow-hidden rounded-2xl bg-white/95 shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-qhx-primary/40"
            @click="clockIn(item)"
            v-longpress="() => handleLongPress(item)"
            @image-load="debouncedApplyLayout"
          >
            <div class="relative overflow-hidden">
              <img 
                :src="getCoverImage(item)" 
                :alt="item.album_title"
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                @load="debouncedApplyLayout"
              />
              <!-- 未打卡遮罩 -->
              <div
                v-show="!item.album_foreign || item.album_foreign === null"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-black/60 via-black/40 to-black/60"
              >
                <UIcon name="i-heroicons-lock-closed" class="h-8 w-8 text-white" />
                <span class="text-sm font-medium text-white">未打卡</span>
              </div>
              <!-- 已打卡徽章 -->
              <div
                v-if="item.album_foreign"
                class="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-medium text-white shadow-lg shadow-emerald-500/30"
              >
                <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                <span>已打卡</span>
              </div>
            </div>
            <div class="space-y-2 p-3.5 md:p-4">
              <h3 class="line-clamp-2 text-[13px] font-semibold leading-snug text-gray-900 md:text-sm">
                {{ item.album_title }}
              </h3>
              <p
                v-if="item.album_desc"
                class="line-clamp-2 text-xs leading-relaxed text-gray-600 md:text-sm"
              >
                {{ item.album_desc }}
              </p>
              <div class="flex items-center justify-between pt-1 text-[11px] text-gray-400 md:text-xs">
                <span v-if="item.album_foreign">再次长按可重新打卡</span>
                <span v-else>点击解锁此目标</span>
              </div>
            </div>
          </div>
        </template>
        <template #loading>
          <div class="mt-6 flex items-center justify-center border-t border-gray-100 py-8 px-2">
            <div class="text-gray-500">加载中...</div>
          </div>
        </template>
        <template #empty>
          <div class="mt-6 flex flex-col items-center justify-center border-t border-gray-100 py-12 px-2 space-y-3">
            <UIcon name="i-heroicons-photo" class="mb-4 text-6xl text-gray-300" />
            <div class="text-gray-500">暂无相册</div>
          </div>
        </template>
        <template #finished>
          <div class="mt-6 flex items-center justify-center border-t border-gray-100 py-6 px-2">
            <div class="text-sm text-gray-400">没有更多了</div>
          </div>
        </template>
      </QhxWaterList>

      <!-- 卷末结语 -->
      <div v-if="showConclusion" class="mt-8 px-0 md:px-4">
        <div class="rounded-2xl bg-white p-8 shadow-md border border-gray-100 md:p-12">
          <div class="mb-5 flex items-center justify-center gap-3 text-center">
            <UIcon name="i-heroicons-book-open" class="h-7 w-7 text-qhx-primary" />
            <span class="text-2xl font-bold text-gray-900 md:text-3xl">卷末结语</span>
          </div>
          <div class="conclusion-content text-center text-base leading-relaxed text-gray-700 md:text-lg">
            <SafeRichText :nodes="conclusionNodes" />
          </div>
        </div>
      </div>
    </div>

    <!-- 操作菜单 -->
		 <!-- 点遮罩不关闭 -->
    <UModal  v-model="showActionSheet" :ui="{ width: 'max-w-md' }" prevent-close>
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">操作</h3>
        </template>
        <div class="space-y-2">
          <div
            v-for="(option, index) in actionOptions"
            :key="index"
            class="cursor-pointer rounded-lg p-3 transition-colors hover:bg-gray-100"
            @click="handleActionSelect(index)"
          >
            {{ option.text }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end">
            <UButton color="gray" @click="showActionSheet = false">取消</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- 打卡/编辑组件 -->
    <AlbumForeignAddEdit ref="addEditAlbumRef" @success="clockInSuccess" />
  </div>
</template>

<style scoped>
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* 入场动画：自上而下渐入 */
.album-detail-enter-active {
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}
.album-detail-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.album-detail-leave-active {
  transition: opacity 0.25s ease-in;
}
.album-detail-leave-to {
  opacity: 0;
}

/* 各区块 stagger 动画 */
.album-block {
  animation: album-fade-in 0.5s ease-out backwards;
}
.album-block:nth-child(1) {
  animation-delay: 0.06s;
}
.album-block:nth-child(2) {
  animation-delay: 0.14s;
}
.album-block:nth-child(3) {
  animation-delay: 0.22s;
}
@keyframes album-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 进度条宽度过渡 */
.album-progress {
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 为富文本内容添加样式 */
.conclusion-content :deep(p) {
  margin-bottom: 12px;
}
</style>