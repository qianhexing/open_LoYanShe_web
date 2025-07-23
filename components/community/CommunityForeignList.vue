<script setup lang="ts">
import type { CommunityForeign, PaginationResponse, FilterList } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getCommunityForeignList } from '@/api/community';
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  need_water?: boolean // 是否需要瀑布流
  water_class?: string
  pk_id: number
  pk_type: number
  can_load?: boolean // 是否允许加载
}
const props = withDefaults(defineProps<Props>(), {
  size: 'big',
  needJump: true,
  need_water: true,
  can_load: true
})
const { can_load, pk_type, pk_id, water_class, size, needJump, need_water } = props
const user = useUserStore()
// 分页参数
const pageSize = 20
const page = ref(1)
const keyword = ref('')
const value = ref('')
const column = ref(3)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
const isCheck = ref(true)
// const formatFilterList = () => {
//   const filter: FilterList[] = [...filter_list]
//   if (parent_id.value) {
//     filter.push({
//       field: "parent_id",
//       op: "and",
//       value: 0
//     })
//   }
//   if (keyword.value && keyword.value!== '') {
//     filter.push({
//       field: "name",
//       op: "and",
//       value: keyword.value
//     })
//   }
//   return filter
// }
// 使用`use$Post`请求函数
const fetchList = async (): Promise<PaginationResponse<CommunityForeign>> => {
  if (import.meta.server) {
    console.log('在服务端运行并且没有token', user.token)
    if (!user.token) {
      isServer.value = true
    }
  }
  try {
    const response = await getCommunityForeignList({
      page: page.value,
      pageSize: pageSize,
      pk_id: pk_id,
      pk_type: pk_type
    })
    isLoading.value = false
    return response
  } catch (error) {
    if (process.client) {
    }
    return {
      rows: [],
      count: 0
    }
  }
}
const { data, refresh  } = await useAsyncData('librarys', fetchList, 
  {
    watch: [page, keyword]
  }
)
const list = ref<CommunityForeign[]>([])
list.value = data.value?.rows ?? []
watch(data, () => {
  console.log('设置为false')
  if (page.value === 1) {
    list.value = data.value?.rows ?? []
  } else {
    list.value = [...list.value, ...(data.value?.rows ?? [])]
  }
})
const total = computed(() => data.value?.count ?? 0)
const refreshList = async () => {
  isLoading.value = true
  try {
    const response = await getCommunityForeignList({
      page: page.value,
      pageSize: pageSize,
      pk_id: pk_id,
      pk_type: pk_type
      // keyword: keyword.value,
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) {}
  isLoading.value = false
}
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
}
// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  console.log('触发了')
  if (keyword.value) {
    page.value = 1
  }
}
const waterList = () => {
  if (!need_water) {
    return
  }
  if (!window) {
    return
  }
  const layout = useWaterfallLayout(water_class? `.${water_class}` : '.community-list', column.value)
    // biome-ignore lint/complexity/noForEach: <explanation>
    layout.forEach(({ index, top, left }) => {
      const el = document.querySelectorAll<HTMLElement>(water_class? `.${water_class}` : '.community-list')[index]
      // el.style.position = 'absolute'
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
const debounceWater = debounce(waterList, 100);
onMounted(() => {
  if (window.innerWidth < 768) {
    column.value = 1
  } else {
    waterList()
  }
  

  if (user.token) {
    console.log('是否服务端渲染', isServer.value)
    if (isServer.value) {
      isServer.value = false
      refreshList()
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

const { isFinished, setFinished } = useScrollBottom(
  async () => {
    // 加载更多数据的逻辑
    if (page.value < Math.ceil(total.value / pageSize)) {
      console.log('触发加载更多')
      if (can_load) {
        loadMore()
      }
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
    <!-- <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
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
    </div> -->
    <!-- 空状态 -->
    <div class="relative min-h-[600px] flex max-md:block" v-if="total > 0">
      <div class="w-full md:w-1/3  max-md:static" :class="(need_water ? 'absolute max-md:static' : '') + (water_class ? water_class : ' community-list' )" v-for="item in list" :key="item.community_fireign_id">
        <CommunityItem :item="item.community" :size="size"></CommunityItem>
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


