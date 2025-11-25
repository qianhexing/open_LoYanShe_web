<script setup lang="ts">
import type { Library, PaginationResponse } from '@/types/api';
import useScrollBottom from '@/composables/useScrollBottom'
import { getLibraryList } from '@/api/library';
import authGlobal from '@/middleware/auth.global'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const user = useUserStore()
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
const isServer = useState('isServer', () => false)
const isCheck = ref(true)
const parent_id = ref(true)
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
definePageMeta({
  name: 'library',
  middleware: [authGlobal]
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
  keyword.value = value.value.trim()
  waterList.value?.refresh()
}

const handleChange = (e: boolean) => {
  parent_id.value = e
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
    <QhxWaterList ref="waterList"
    :fetch-data="async (page, pageSize) => {
      
      const response = await getLibraryList({
        page: page,
        pageSize: pageSize,
        keyword: keyword,
        need_Statistics: true,
        parent_id: parent_id
      })
      isLoading = false
      isCheck = parent_id
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="4" :itemKey="0"  :columns_768="2" :enableWaterfall="true" :enableLoadMore="true">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item" :key="item.library_id">
          <LibraryItem :item="item" @image-load="debouncedApplyLayout"></LibraryItem>
        </div>
      </template>
    </QhxWaterList>
    <!-- <div class="relative min-h-[600px]" v-if="total > 0">
      <div class="library-list w-1/2 md:w-1/4" v-for="library in list" :key="library.library_id">
        <LibraryItem :item="library" @image-load="debounceWater"></LibraryItem>
      </div>
    </div> -->
    <!-- <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div> -->
    <!-- <QhxLoading :loading="isLoading"></QhxLoading> -->
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
</style>


