<script setup lang="ts">
// 新增单条合集数据
import { getCompList  } from '@/api/compilations';
import type { PaginationResponse, Compilations } from '@/types/api'
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keywords = ref('')
const value = ref('')
// 使用`use$Post`请求函数
const fetchCompilationsList = async (): Promise<PaginationResponse<Compilations>> => {
  try {
    const response = await getCompList({
      page: page.value,
      pageSize: pageSize,
      keywords: keywords.value
    })
    return response.data
  } catch (error) {
    if (process.client) {
      console.error('获取合集列表失败:', error)
    }

    // 返回一个空的结构，防止前端 .rows 报错
    return {
      rows: [],
      count: 0
    }
  }
}


const { data } = await useAsyncData('compilations', fetchCompilationsList, {
  watch: [page, keywords]
})

const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)

const isLoading = computed(() => false)

// 监听总数变化
watchEffect(() => {
	console.log('当前总数:', total.value)
})

// SEO 配置
useHead({
	title: 'Lolita合集汇总',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,Lolita合集汇总,Lolita'
		},
		{
			name: 'description',
			content: 'Lolita合集'
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
// 统一处理搜索逻辑
const handleSearch = () => {
  keywords.value = value.value.trim()
  // 执行搜索操作（示例）
  
  if (keywords.value) {
    page.value = 1
  }
}
</script>
<template>
  <div class="container mx-auto p-4 pb-20">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4  pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索店铺 多条件空格分割."
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
    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-[200px]">
      <USkeleton class="h-32 w-full" />
    </div>

    <!-- 空状态 -->
    <!-- <div v-else-if="!list?.length" class="text-center text-gray-500 py-8">
      暂无数据
    </div> -->

    <!-- 店铺列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-3 gap-6">
      <div
        v-for="comp in list"
        :key="comp.comp_id"
        class="bg-white polaroid-card dark:bg-gray-900 rounded-[18px] shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center overflow-hidden border border-gray-100 dark:border-gray-800 group relative"
      >
        <CompilationsItem :item="comp" :size="'big'"></CompilationsItem>
      </div>
    </div>

    <!-- 分页组件 -->
    <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination
        v-model="page"
        :total="total / 2"
        :ui="{
          wrapper: 'flex items-center gap-1',
          base: 'flex items-center gap-1',
        }"
        @change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>

</style>


