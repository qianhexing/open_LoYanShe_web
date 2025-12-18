<script setup lang="ts">
import type { Wiki, WikiType } from '@/types/api';
import { getWikiWikiList, getWikiTypeOptions, sortWikiList, type SortParams } from '@/api/wiki';
import authGlobal from '@/middleware/auth.global'
import Draggable from "vuedraggable"

interface WikiSearchParams {
  type_id?: number
  wiki_name?: string
  parent_id?: number | null
  where?: Record<string, unknown>
  keywords?: string
  page?: number
  pageSize?: number
  need_child?: boolean
}

interface WikiWithSort extends Wiki {
  sort?: number
}

const user = useUserStore()
const route = useRoute()
const type_id = computed(() => Number.parseInt(route.params.id as string))
const pageSize = 20
const page = ref(1)
const keyword = ref('')
const value = ref('')
const column = ref(4)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
const wikiTypeInfo = ref<WikiType | null>(null)
const list = ref<Wiki[]>([])
const total = ref(0)
const sortMode = ref(false)
const isSorting = ref(false) // 排序保存状态
let oldList: { wiki_id: number | string; sort: number }[] = []

// 获取 wiki 类型信息（可选，失败不影响列表显示）
const fetchWikiTypeInfo = async () => {
  try {
    const response = await getWikiTypeOptions({ type_id: type_id.value })
    if (response) {
      wikiTypeInfo.value = response
    }
  } catch (error) {
    console.error('获取wiki类型信息失败:', error)
    // 类型信息获取失败不影响页面显示
  }
}

useHead({
	title: computed(() => wikiTypeInfo.value?.wiki_type_name || 'Lolita百科类型'),
	meta: [
		{
			name: 'keywords',
			content: computed(() => `${wikiTypeInfo.value?.wiki_type_name || ''},Lo研社,洛丽塔百科,Lolita,Lolita百科`)
		},
		{
			name: 'description',
			content: computed(() => `${wikiTypeInfo.value?.wiki_type_name || ''}相关的洛丽塔百科汇总`)
		}
	]
})

definePageMeta({
  name: 'wikiTypeDetail',
  middleware: [authGlobal]
})

// 获取 wiki 列表
const fetchWikiList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
  isLoading.value = true
  const params: WikiSearchParams = {
    page: Ipage || page.value,
    pageSize: IpageSize || pageSize,
    where: {
      type_id: type_id.value
    },
    need_child: true
  }
  if (keyword.value) {
    params.keywords = keyword.value
  }
  try {
    const response = await getWikiWikiList(params)
    const rows = response.rows ?? []
    // 按 sort 值降序排序，sort 大的显示在前面
    
    if (params.page === 1) {
      list.value = rows
    } else {
      list.value = [...list.value, ...rows]
    }
    total.value = response.count
  } catch (error) {
    console.error('获取wiki列表失败:', error)
  }
  isLoading.value = false
}

// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  page.value = 1
  fetchWikiList()
}

// 拖拽排序相关
const onDragStart = () => {
  // 保存拖拽前的列表状态，记录每个项目的 sort 值
  oldList = list.value.map((item, index) => {
    const currentSort = (item as WikiWithSort).sort
    // 如果没有 sort 值，根据位置计算（位置越靠前，sort 值越大）
    const defaultSort = list.value.length - index
    return { 
      wiki_id: item.wiki_id, 
      sort: currentSort ?? defaultSort
    }
  })
}

const onDragEnd = async () => {
  if (isSorting.value) return // 防止重复提交
  isSorting.value = true

  try {
    // 计算新的 sort 值：位置越靠前（index 越小），sort 值越大
    // 第一个位置（index 0）应该有最大的 sort 值
    const changed: { wiki_id: number | string; sort: number }[] = []

    list.value.forEach((item, newIndex) => {
      const oldItem = oldList.find(old => old.wiki_id === item.wiki_id)
      // 计算新位置的 sort 值：位置越靠前，sort 值越大
      const newSort = total.value - newIndex + 1
      
      // 如果位置发生了变化，或者 sort 值需要更新
      if (!oldItem || oldItem.sort !== newSort) {
        changed.push({
          wiki_id: item.wiki_id,
          sort: newSort, // 新位置的 sort 值
        })
      }
    })

    if (changed.length > 0) {
      // 准备排序接口参数（暂时不真正调用）
      const params: SortParams = {
        type_id: type_id.value,
        sort: changed.map((item) => ({
          wiki_id: Number(item.wiki_id),
          sort: item.sort,
        })),
      }
      
      console.log('排序参数:', params)
      // TODO: 调用排序接口
      await sortWikiList(params)
      // eslint-disable-next-line foreach
      for (const item of params.sort) {
        const index = list.value.findIndex(listItem => listItem.wiki_id === item.wiki_id)
        if (index !== -1) {
          list.value[index].sort = Number(item.sort)
        }
      }
    }
  } catch (error) {
    console.error('排序更新失败:', error)
  } finally {
    isSorting.value = false
  }
}

// 加载更多
const loadMore = () => {
  if (isLoading.value) return
  page.value += 1
  fetchWikiList()
}

onMounted(async () => {
  
  if (window.innerWidth < 768) {
    column.value = 2
  }
  setTimeout(async () => {
    await fetchWikiTypeInfo()
      console.log('是否服务端渲染', isServer.value)
      if (isServer.value) {
        isServer.value = false
        await fetchWikiList()
      } else {
        await fetchWikiList()
      }
  })
})


</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 类型信息标题 -->
    <div class="px-4 mb-4" v-if="wikiTypeInfo">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {{ wikiTypeInfo.wiki_type_name }}
      </h1>
      <QhxTag v-if="wikiTypeInfo.wiki_secondary_type" class="mt-2">
        {{ wikiTypeInfo.wiki_secondary_type }}
      </QhxTag>
    </div>
    
    <!-- 搜索框和排序按钮 -->
    <div class="px-4 pb-3">
      <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-3">
        <div class="w-full flex items-center">
          <UInput
            v-model="value"
            placeholder="搜索百科 多条件空格分割."
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
      
      <!-- 排序按钮 -->
      <div class="flex items-center gap-2" v-if="user.token && (user.user?.user_id === 1 || user.user?.user_id === 2018)">
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1 cursor-pointer" @click="sortMode = !sortMode">
            <div
              class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center"
              :class="sortMode ? 'bg-qhx-primary' : 'bg-qhx-info'">
              <UIcon name="icon-park-outline:sort-two" class="text-[22px] text-[#ffffff]" />
            </div>
            <div class="text-sm text-qhx-text">排序</div>
          </div>
        </QhxJellyButton>
      </div>
    </div>
    
    <!-- 排序保存提示 -->
    <div v-if="isSorting" class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex z-10 items-center justify-center">
      <span class="text-gray-600 dark:text-gray-300">正在保存排序……</span>
    </div>
    
    <!-- Wiki列表 -->
    <div class="px-4">
      <Draggable 
        :delay="50"
        :disabled="!sortMode"
        @start="onDragStart" 
        @end="onDragEnd" 
        v-model="list" 
        item-key="wiki_id"
        animation="300" 
        ghost-class="drag-ghost" 
        chosen-class="drag-chosen" 
        drag-class="dragging"
        :scroll="true"
        :scroll-sensitivity="200"
        :scroll-speed="15"
        :force-fallback="true"
        :fallback-tolerance="0"
        class="flex flex-wrap"
      >
        <template #item="{ element }">
          <transition-group 
            tag="div"
            class="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5"
            name="list"
          >
            <div class="custom-item cursor-grab active:cursor-grabbing">
              <WikiItem :item="element" :need-jump="!sortMode"></WikiItem>
            </div>
          </transition-group>
        </template>
      </Draggable>
      
      <!-- 加载更多 -->
      <div v-if="list.length < total && !isLoading" class="text-center py-4">
        <UButton
          variant="ghost"
          color="gray"
          @click="loadMore"
          :loading="isLoading"
        >
          加载更多
        </UButton>
      </div>
      
      <!-- 加载中 -->
      <div v-if="isLoading && page === 1" class="text-center py-8">
        <span class="text-gray-600 dark:text-gray-300">加载中……</span>
      </div>
      
      <!-- 空状态 -->
      <div v-if="!isLoading && list.length === 0" class="text-center py-8">
        <span class="text-gray-600 dark:text-gray-300">暂无数据</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  container-type: inline-size;
}

@container (min-width: 200px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

/* 拖拽相关样式 */
.drag-ghost {
  opacity: 0.4;
  transform: scale(0.95);
}

.drag-chosen {
  border-radius: 12px;
}

.dragging {
  transform: scale(1.05);
}

/* 拖拽切换时的过渡动效 */
.list-move {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
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
</style>

