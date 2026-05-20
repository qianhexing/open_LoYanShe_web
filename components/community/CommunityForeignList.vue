<script setup lang="ts">
import type { CommunityForeign, PaginationResponse, FilterList } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getCommunityForeignList, deleteCommunityForeign } from '@/api/community';
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  need_water?: boolean // 是否需要瀑布流
  water_class?: string
  /** 关联业务实体 id（与 pk_type 一起筛选 foreign） */
  pk_id: number
  /** 关联类型：0店铺 1实体店 2衣柜服饰 3搭配场景 4搭配清单 5合集考据 6茶会返图 7图鉴返图（详见 types/api CommunityForeign） */
  pk_type: number
  can_load?: boolean // 是否允许加载
  /** 单列纵向排列（PC 与移动端均为一行一个帖子，适用于窄容器/弹窗） */
  singleColumn?: boolean
  /** 是否允许删除关联（仅当帖子作者为当前登录用户时显示删除） */
  allowDeleteForeign?: boolean
  /**
   * PC 端（≥md）瀑布流列数；移动端始终 1 列。
   * `singleColumn` 为 true 时强制 1 列，忽略本项。
   */
  pcColumns?: number
}
const props = withDefaults(defineProps<Props>(), {
  size: 'big',
  needJump: true,
  need_water: true,
  water_class: '',
  can_load: true,
  singleColumn: false,
  allowDeleteForeign: false,
  pcColumns: 3
})
const emit = defineEmits<{ 'count-change': [count: number] }>()
const { can_load, pk_type, pk_id, water_class, size, needJump, need_water } = props
const user = useUserStore()
const toast = useToast()
// 分页参数
const pageSize = 20
const page = ref(1)
const keyword = ref('')
const value = ref('')
const column = ref(3)

/** PC 端有效列数（1–12），供瀑布流与卡片宽度共用 */
const resolvedPcColumns = computed(() =>
  Math.min(Math.max(Math.round(props.pcColumns ?? 3), 1), 12)
)

/** 每项上的 CSS 变量，供 PC 列宽计算（singleColumn 时不设置） */
const foreignItemCssVars = computed((): Record<string, string> | undefined =>
  props.singleColumn
    ? undefined
    : { '--foreign-pc-cols': String(resolvedPcColumns.value) }
)

function syncColumnCount() {
  if (props.singleColumn) {
    column.value = 1
    return
  }
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    column.value = 1
    return
  }
  column.value = resolvedPcColumns.value
}

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
const { data, refresh } = await useAsyncData('community_foreign', fetchList, 
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
watch(
  total,
  (c) => {
    emit('count-change', c)
  },
  { immediate: true }
)
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
  if (!need_water || props.singleColumn) {
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
const debounceWater = debounce(waterList, 100)

watchEffect(() => {
	console.log('当前列表:', list.value.length)
  if (process.client) {
    if (props.singleColumn || !need_water) return
    setTimeout(() => {
      debounceWater()
    });
  }
})

watch([() => props.singleColumn, resolvedPcColumns], () => {
  if (!import.meta.client) return
  syncColumnCount()
  nextTick(() => debounceWater())
})

onMounted(() => {
  syncColumnCount()
  nextTick(() => {
    if (!props.singleColumn && typeof window !== 'undefined' && window.innerWidth >= 768) {
      debounceWater()
    }
  })

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

const deletingForeignId = ref<number | null>(null)

function isOwnCommunityPost(row: CommunityForeign): boolean {
  const myId = user.user?.user_id
  if (myId == null) return false
  const authorId = row.community?.user_id ?? row.community?.user?.user_id
  return authorId === myId
}

async function handleDeleteForeign(row: CommunityForeign) {
  if (!props.allowDeleteForeign || !isOwnCommunityPost(row)) return
  const communityId = row.community?.community_id
  if (communityId == null) return
  if (typeof window !== 'undefined' && !window.confirm('确定解除该帖子与本页的关联？')) {
    return
  }
  deletingForeignId.value = row.community_fireign_id
  try {
    await deleteCommunityForeign({
      community_id: communityId,
      pk_type,
      pk_id
    })
    toast.add({
      title: '已解除关联',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    page.value = 1
    await refresh()
  } catch (error: unknown) {
    console.error('解除关联失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '解除失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    deletingForeignId.value = null
  }
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
    <div
      v-if="total > 0"
      class="relative overflow-hidden"
      :class="
        singleColumn
          ? 'min-h-0 flex flex-col gap-1 pt-2 pb-16'
          : 'min-h-[600px] flex max-md:block'
      "
    >
      <div
        v-for="item in list"
        :key="item.community_fireign_id"
        :class="[
          water_class ? water_class : 'community-list',
          singleColumn
            ? 'w-full relative'
            : [
                'w-full max-md:static foreign-list-pc-col-item',
                need_water ? 'absolute max-md:static' : ''
              ].filter(Boolean).join(' ')
        ]"
        :style="foreignItemCssVars"
      >
        <button
          v-if="allowDeleteForeign && isOwnCommunityPost(item)"
          type="button"
          class="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-md ring-1 ring-gray-200/80 hover:bg-red-50 dark:bg-gray-800/95 dark:ring-gray-600 dark:hover:bg-red-950/40"
          :disabled="deletingForeignId === item.community_fireign_id"
          aria-label="解除关联"
          @click.stop="handleDeleteForeign(item)"
        >
          <UIcon
            :name="deletingForeignId === item.community_fireign_id ? 'i-heroicons-arrow-path' : 'i-heroicons-trash'"
            class="h-4 w-4"
            :class="{ 'animate-spin': deletingForeignId === item.community_fireign_id }"
          />
        </button>
        <CommunityItem :item="item.community" :size="size" :className="'bg-qhx-bg-card polaroid-card cursor-pointer p-1 m-1 rounded'"></CommunityItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading"></QhxLoading>
  </div>
</template>

<style scoped>
/* PC 端列宽：与 waterfall columnCount、resolvedPcColumns 一致（假定列间距约 8px） */
.foreign-list-pc-col-item {
  width: 100%;
}
@media (min-width: 768px) {
  .foreign-list-pc-col-item {
    width: calc(
      (100% - (var(--foreign-pc-cols, 3) - 1) * 8px) / var(--foreign-pc-cols, 3)
    );
  }
}
</style>


