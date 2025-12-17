<script setup lang="ts">
import { getAlbumList, getAlbumDetail } from '@/api/album'
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import type { RichNode } from '@/utils/public'
import type AlbumForeignAddEdit from '@/components/Album/AlbumForeignAddEdit.vue'
import type { Album, PaginationResponse } from '@/types/api'

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
  album_foreign?: {
    cover?: string | string[]
    note?: string
    create_time?: string | Date
  } | null
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
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
    <!-- 顶部导航栏 -->
    <div class="sticky top-0 z-10 flex items-center bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div class="flex-1">
        <div class="flex">
          <button
            v-for="(tab, i) in tabs_list"
            :key="i"
            @click="tabsChange(i)"
            class="flex-1 whitespace-nowrap px-4 py-2 text-center transition-all duration-200"
            :class="{
              'border-b-2 border-qhx-primary font-semibold text-qhx-primary': current === i,
              'text-gray-500 hover:text-gray-700': current !== i
            }"
          >
            {{ tab.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <div v-if="info" class="mb-6">
        <!-- 封面区域 -->
        <div class="mb-6 overflow-hidden rounded-2xl shadow-lg transition-shadow hover:shadow-xl">
          <div class="relative w-full overflow-hidden pb-[56.25%] lg:pb-[40%]">
            <img 
              :src="BASE_IMG + (info.album_cover || 'static/plan_cover/default.jpg')" 
              :alt="info.album_title"
              class="absolute inset-0 object-cover w-full h-full "
            />
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-6 pb-6 pt-10 md:px-8 md:pt-12">
              <h1 class="text-2xl font-bold text-white drop-shadow-lg md:text-4xl">
                {{ info.album_title }}
              </h1>
            </div>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="mb-4 flex items-center justify-around rounded-xl bg-white p-5 shadow-sm md:p-8">
          <div class="flex-1 text-center">
            <div class="mb-2 text-sm text-gray-600">目标总数</div>
            <div class="text-2xl font-bold text-gray-900 md:text-3xl">
              {{ info.count || 0 }}
            </div>
          </div>
          <div class="h-10 w-px bg-gray-200 mx-5"></div>
          <div class="flex-1 text-center">
            <div class="mb-2 text-sm text-gray-600">已打卡</div>
            <div class="text-2xl font-bold text-red-500 md:text-3xl">
              {{ info.count_achieve || 0 }}
            </div>
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <UIcon name="i-heroicons-information-circle" class="h-5 w-5 flex-shrink-0" />
          <span>长按已打卡项目可以重新打卡</span>
        </div>
      </div>

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
            class="group mb-4 cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            @click="clockIn(item)"
            v-longpress="() => handleLongPress(item)"
            @image-load="debouncedApplyLayout"
          >
            <div class="relative p-1 overflow-hidden">
              <img 
                :src="getCoverImage(item)" 
                :alt="item.album_title"
                loading="lazy"
                class="w-full rounded-t-xl object-cover transition-transform duration-300 group-hover:scale-105"
                @load="debouncedApplyLayout"
              />
              <!-- 未打卡遮罩 -->
              <div
                v-show="!item.album_foreign || item.album_foreign === null"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 rounded-t-xl"
              >
                <UIcon name="i-heroicons-lock-closed" class="h-8 w-8 text-white" />
                <span class="text-sm font-medium text-white">未打卡</span>
              </div>
              <!-- 已打卡徽章 -->
              <div
                v-if="item.album_foreign"
                class="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"
              >
                <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-white" />
              </div>
            </div>
            <div class="p-4">
              <h3 class="mb-2 line-clamp-2 text-base font-semibold text-gray-900 leading-snug">
                {{ item.album_title }}
              </h3>
              <p
                v-if="item.album_desc"
                class="line-clamp-2 text-sm text-gray-600 leading-relaxed"
              >
                {{ item.album_desc }}
              </p>
            </div>
          </div>
        </template>
        <template #loading>
          <div class="flex items-center justify-center py-8">
            <div class="text-gray-500">加载中...</div>
          </div>
        </template>
        <template #empty>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon name="i-heroicons-photo" class="mb-4 text-6xl text-gray-300" />
            <div class="text-gray-500">暂无相册</div>
          </div>
        </template>
        <template #finished>
          <div class="flex items-center justify-center py-4">
            <div class="text-sm text-gray-400">没有更多了</div>
          </div>
        </template>
      </QhxWaterList>

      <!-- 卷末结语 -->
      <div v-if="showConclusion" class="mt-8 px-0 md:px-4">
        <div class="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white shadow-xl shadow-purple-500/30 md:p-12">
          <div class="mb-5 flex items-center justify-center gap-3 text-center">
            <UIcon name="i-heroicons-book-open" class="h-7 w-7" />
            <span class="text-2xl font-bold md:text-3xl">卷末结语</span>
          </div>
          <div class="text-center text-base leading-relaxed md:text-lg">
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
/* 为富文本内容添加样式 */
.conclusion-content :deep(p) {
  margin-bottom: 12px;
}
</style>