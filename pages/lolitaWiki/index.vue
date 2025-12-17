<script setup lang="ts">
import type { Wiki, PaginationResponse } from '@/types/api';
import { getWikiList } from '@/api/wiki';
import authGlobal from '@/middleware/auth.global'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const user = useUserStore()
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')
const column = ref(4)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
const type_id = ref<number | undefined>(undefined)

useHead({
	title: 'Lolita百科',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,洛丽塔百科,Lolita,Lolita百科,Lolita知识库'
		},
		{
			name: 'description',
			content: '洛丽塔百科汇总,Lolita知识库'
		}
	]
})
definePageMeta({
  name: 'lolitaWiki',
  middleware: [authGlobal]
})
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
}

// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  waterList.value?.refresh()
}

onMounted(() => {
  if (window.innerWidth < 768) {
    column.value = 2
  }
  if (user.token) {
    console.log('是否服务端渲染', isServer.value)
    if (isServer.value) {
      isServer.value = false
      waterList.value?.refresh()
    }
  } else {
    isLoading.value = false
  }
})

</script>
<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
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
    <!-- 空状态 -->
    <QhxWaterList ref="waterList"
    :fetch-data="async (page, pageSize) => {
      const params: any = {
        page: page,
        pageSize: pageSize
      }
      if (keyword) {
        params.keywords = keyword
      }
      if (type_id) {
        params.type_id = type_id
      }
      const response = await getWikiList(params)
      isLoading = false
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="4" :itemKey="0"  :columns_768="2" :enableWaterfall="true" :enableLoadMore="true">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item" :key="item.wiki_id">
          <WikiTypeItem :item="item" @image-load="debouncedApplyLayout"></WikiTypeItem>
        </div>
      </template>
    </QhxWaterList>
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

