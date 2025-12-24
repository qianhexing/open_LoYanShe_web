<script setup lang="ts">
import type { Community, PaginationResponse } from '@/types/api';
import { getCommunityList } from '@/api/community';
import useScrollBottom from '@/composables/useScrollBottom'
const user = useUserStore()
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keywords = ref('')
const value = ref('')
const column = ref(3)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)

// 使用`use$Post`请求函数
const fetchCommunityList = async (): Promise<PaginationResponse<Community>> => {
  if (import.meta.server) {
    console.log('在服务端运行并且没有token', user.token)
    if (!user.token) {
      isServer.value = true
    }
  }
  try {
    const response = await getCommunityList({
      page: page.value,
      pageSize: pageSize,
      keywords: keywords.value
    })
    isLoading.value = false
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取店铺列表失败:', error)
    }
    return {
      rows: [],
      count: 0
    }
  }
}
const { data, refresh  } = await useAsyncData('communitys', fetchCommunityList, 
  {
    watch: [page, keywords]
  }
)
const list = ref<Community[]>([])
list.value = data.value?.rows ?? []
watch(data, () => {
  if (page.value === 1) {
    list.value = data.value?.rows ?? []
  } else {
    list.value = [...list.value, ...(data.value?.rows ?? [])]
  }
})
const total = computed(() => data.value?.count ?? 0)
const refreshCommunity = async () => {
  isLoading.value = true
  try {
    const response = await getCommunityList({
      page: 1,
      pageSize: pageSize * page.value,
      keywords: keywords.value
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) {}
  isLoading.value = false
}

// SEO 配置
useHead({
	title: 'Lo研社',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,洛丽塔图鉴,Lolita,Lolita图鉴,Lolita图书馆'
		},
		{
			name: 'description',
			content: '洛丽塔图书馆汇总,Lolita图书馆'
		}
	]
})
definePageMeta({
  name: 'community'
})
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
  // router.push({
  //   query: {
  //     ...route.query,
  //     page: current
  //   },
  //   force: true
  // })
}
// 统一处理搜索逻辑
const handleSearch = () => {
  keywords.value = value.value.trim()
  // 执行搜索操作（示例）
  
  if (keywords.value) {
    page.value = 1
  }
}
const waterCommunity = () => {
  if (!window) {
    return
  }
  if (window.innerWidth < 768) {
    return
  }
  const layout = useWaterfallLayout('.community-list', column.value)
    // biome-ignore lint/complexity/noForEach: <explanation>
    layout.forEach(({ index, top, left }) => {
      const el = document.querySelectorAll<HTMLElement>('.community-list')[index]
      // el.style.position = 'absolute'
      el.style.top = `${top}px`
      el.style.left = `${left}px`
      el.style.display = 'block'
    })
}
const debounceWater = debounce(waterCommunity, 100);
onMounted(() => {
  if (window.innerWidth < 768) {
    // column.value = 1
  } else {
    waterCommunity()
  }
  
  if (user.token) {
    console.log('是否服务端渲染', isServer.value)
    if (isServer.value) {
      isServer.value = false
      refreshCommunity()
    }
  }
})
const loadMore = () => {
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
  console.log('加载更多')
}

// 监听总数变化
watchEffect(() => {
	console.log('当前列表:', list.value.length)
  if (process.client) {
    setTimeout(() => {
      debounceWater()
    });
  }
})

const { isFinished, setFinished } = useScrollBottom(
  async () => {
    // 加载更多数据的逻辑
    if (page.value < Math.ceil(total.value / pageSize)) {
      console.log('触发加载更多')
      loadMore()
    }
  },
  {
    distance: 300, // 距离底部100px时触发
    immediate: false // 初始化时立即加载一次
  }
)

// 发帖相关
const showPostModal = ref(false)
const handlePostSuccess = () => {
  // 发帖成功后刷新列表
  page.value = 1
  refreshCommunity()
}
</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索 多条件空格分割."
          class="flex-1 focus:ring-0"
          :autofocus="false"
           @keyup.enter="handleSearch"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }"
        />
        <UButton
          icon="i-heroicons-magnifying-glass"
          variant="ghost"
          color="gray"
          @click="handleSearch"
        />
      </div>
    </div>
    <!-- 空状态 -->
    <div class="relative min-h-[600px]" v-if="total > 0">
      <div class="community-list absolute w-full md:w-1/3  max-md:static" v-for="community in list" :key="community.community_id">
        <CommunityItem :item="community" :size="'big'" @load="debounceWater"></CommunityItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>

    <!-- 左下角发帖按钮 -->
    <div class="fixed bottom-8 left-8 z-50 pointer-events-none">
      <button
        @click="showPostModal = true"
        class="pointer-events-auto bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <span class="text-xl group-hover:rotate-12 transition-transform">📝</span>
        <span class="font-bold tracking-wide">发帖</span>
      </button>
    </div>

    <!-- 发帖弹窗 -->
    <ClientOnly>
      <YearlySummaryPostModal
        v-model="showPostModal"
        :user-id="user?.user_id"
        :skip-summary-link="true"
        @success="handlePostSuccess"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
.community-list{
  transition: 0.3s;
}
</style>


