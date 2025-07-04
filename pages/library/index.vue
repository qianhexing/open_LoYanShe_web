<script setup lang="ts">
import type { Library, PaginationResponse } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getLibraryList } from '@/api/library';
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')
const column = ref(4)
const isLoading = ref(true)
// 使用`use$Post`请求函数
const fetchLibraryList = async (): Promise<PaginationResponse<Library>> => {
  try {
    const response = await getLibraryList({
      page: page.value,
      pageSize: pageSize,
      keyword: keyword.value
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


const { data } = await useAsyncData('librarys', fetchLibraryList, {
  watch: [page, keyword]
})
isLoading.value = false
const list = ref<Library[]>([])
list.value = data.value?.rows ?? []
watch(data, () => {
  console.log('设置为false')
  if (page.value === 1) {
    list.value = data.value?.rows ?? []
  } else {
    list.value = [...list.value, ...(data.value?.rows ?? [])]
  }
})
// const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)

// 监听总数变化
watchEffect(() => {
	console.log('当前总数:', total.value)
})

// SEO 配置
useHead({
	title: 'Lolita图鉴',
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
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
  router.push({
    query: {
      ...route.query,
      page: current
    },
    force: true
  })
}

const showToast = () => {
  const user = useUserStore()
  console.log(user.token, '获取到的token')
  const toast = useToast()

  toast.add({
    title: '成功',
    description: '操作已成功完成',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
}
// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  // 执行搜索操作（示例）
  
  if (keyword.value) {
    page.value = 1
  }
}
const waterLibrary = () => {
  if (!window) {
    return
  }
  const layout = useWaterfallLayout('.library-list', column.value)
    // biome-ignore lint/complexity/noForEach: <explanation>
    layout.forEach(({ index, top, left }) => {
      const el = document.querySelectorAll<HTMLElement>('.library-list')[index]
      el.style.position = 'absolute'
      el.style.top = `${top}px`
      el.style.left = `${left}px`
      el.style.display = 'block'
    })
}
const debounceWater = debounce(waterLibrary, 100);
onMounted(() => {
  if (window.innerWidth < 768) {
    column.value = 2
  }
  waterLibrary()
})
const loadMore = () => {
  console.log('是否在加载', isLoading.value)
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
    console.log('触发加载更多')
    loadMore()
  },
  {
    distance: 300, // 距离底部100px时触发
    immediate: false // 初始化时立即加载一次
  }
)
</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索图鉴 多条件空格分割."
          class="flex-1 focus:ring-0"
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
      <div class="library-list w-1/2 md:w-1/4" v-for="library in list" :key="library.library_id">
        <LibraryItem :item="library" @image-load="debounceWater"></LibraryItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>
    <!-- 分页组件 -->
    <!-- <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination
        v-model="page"
        :total="total / 2"
        :ui="{
          wrapper: 'flex items-center gap-1',
          base: 'flex items-center gap-1',
        }"
        @change="handlePageChange"
      />
    </div> -->
  </div>
</template>

<style scoped>
.library-list{
  position: absolute;
  transition: 0.3s;
}
.grid {
  container-type: inline-size;
}

@container (min-width: 200px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

/* 添加卡片阴影效果 */
.u-card {
  @apply shadow-sm hover:shadow-md dark:shadow-gray-800;
}

/* 优化图片容器 */
.aspect-\[4\/3\] {
  aspect-ratio: 4/3;
}

/* 适配暗色主题的过渡效果 */
.group:hover .group-hover\:scale-110 {
  @apply transform scale-110 transition-transform duration-300;
}
.badge-tip{
  position: absolute;
    left: calc(50% - 49px);
    top: calc(50% - 45px);
    font-size: 40px;
    z-index: 10;
    width: 80px;
    text-align: center;
    transform: rotate(-45deg);
    color: var(--error-color);
}
/* 拍立得风格卡片样式 */
.polaroid-card {
  box-shadow: 0 6px 24px 0 rgba(0,0,0,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.08);
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #f3f3f3;
}
</style>


