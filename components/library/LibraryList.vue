<script setup lang="ts">
import type { Library, PaginationResponse, FilterList } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getLibraryList } from '@/api/library';
interface Props {
  className?: string,
  needShop?: boolean,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  filter_list?: FilterList[]
  need_water?: boolean // 是否需要瀑布流
}
const props = withDefaults(defineProps<Props>(), {
  needShop: true,
  size: 'mid',
  needJump: true,
  filter_list: () => [] as FilterList[],
  need_water: true
})
const { needShop, size, needJump, filter_list, need_water } = props
const user = useUserStore()
// 分页参数
const pageSize = 20
const page = ref(1)
const keyword = ref('')
const value = ref('')
const column = ref(4)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
const isCheck = ref(true)
const parent_id = ref(true)
const formatFilterList = () => {
  const filter: FilterList[] = [...filter_list]
  if (parent_id.value) {
    filter.push({
      field: "parent_id",
      op: "and",
      value: 0
    })
  }
  if (keyword.value && keyword.value!== '') {
    filter.push({
      field: "name",
      op: "and",
      value: keyword.value
    })
  }
  return filter
}
// 使用`use$Post`请求函数
const fetchLibraryList = async (): Promise<PaginationResponse<Library>> => {
  if (import.meta.server) {
    console.log('在服务端运行并且没有token', user.token)
    if (!user.token) {
      isServer.value = true
    }
  }
  try {
    const response = await getLibraryList({
      page: page.value,
      pageSize: pageSize,
      // keyword: keyword.value,
      need_Statistics: true,
      filter_list: formatFilterList()
    })
    isLoading.value = false
    isCheck.value = parent_id.value
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
const { data, refresh  } = await useAsyncData('librarys', fetchLibraryList, 
  {
    watch: [page, keyword, parent_id]
  }
)
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
// watch(
//   () => user.token,
//   (newToken, oldToken) => {
//     if (newToken && newToken !== oldToken) {
//       console.log('token变化')
//       debounce(() => {
//         console.log('token变化111' )
//         refresh()
//       }, 3000)
//     }
//   }
// )
// const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)
const refreshLibrary = async () => {
  isLoading.value = true
  try {
    const response = await getLibraryList({
      page: page.value,
      pageSize: pageSize,
      // keyword: keyword.value,
      need_Statistics: true,
      filter_list: formatFilterList()
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) {}
  isLoading.value = false
}
// 监听总数变化
watchEffect(() => {
	console.log('当前总数:', total.value)
})
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
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
  console.log('触发了')
  if (keyword.value) {
    page.value = 1
  }
}
const handleChange = (e: boolean) => {
  if ( isLoading.value) {
    return
  }
  isLoading.value = true
  page.value = 1
  parent_id.value = e
  console.log('测试', e)
  
}
const waterLibrary = () => {
  if (!need_water) {
    return
  }
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
watchEffect(() => {
	console.log('当前列表:', list.value.length)
  if (process.client) {
    setTimeout(() => {
      debounceWater()
    });
  }
})
const debounceWater = debounce(waterLibrary, 100);
onMounted(() => {
  if (window.innerWidth < 768) {
    column.value = 2
  }
  waterLibrary()

  if (user.token) {
    console.log('是否服务端渲染', isServer.value)
    if (isServer.value) {
      isServer.value = false
      refreshLibrary()
    }
  } else {
    isLoading.value = false
  }
})
const loadMore = () => {
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}

// 监听总数变化
watchEffect(() => {
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
</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索图鉴 多条件空格分割."
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
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="flex items-center justify-between">
          <UCheckbox 
          v-model="isCheck"
          :ui="{ 
            rounded: 'text-qhx-primary',
            color: 'qhx-primary',
            wrapper: 'cursor-pointer',
            base: 'cursor-pointer'
          }"
            @change="handleChange"
            class=" cursor-pointer"
            label="不显示子图鉴"
            name="remember"

          />
        </div>
    </div>
    <!-- 空状态 -->
    <div class="relative min-h-[600px] flex" v-if="total > 0">
      <div class="library-list w-1/2 md:w-1/4" :class="need_water ? 'absolute' : ''" v-for="library in list" :key="library.library_id">
        <LibraryItem :item="library" :size="size" :need-shop="needShop"></LibraryItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading"></QhxLoading>
  </div>
</template>

<style scoped>
</style>


