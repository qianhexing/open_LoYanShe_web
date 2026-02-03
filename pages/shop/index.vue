<script setup lang="ts">
import type { Shop, PaginationResponse } from '@/types/api';
import { getShopList } from '@/api/shop';
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')


// 使用`use$Post`请求函数
const fetchShopList = async (): Promise<PaginationResponse<Shop>> => {
  try {
    const response = await getShopList({
      page: page.value,
      pageSize: pageSize,
      keyword: keyword.value
    })
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取店铺列表失败:', error)
    }

    // 返回一个空的结构，防止前端 .rows 报错
    return {
      rows: [],
      count: 0
    }
  }
}


const { data } = await useAsyncData('shops', fetchShopList, {
  watch: [page, keyword]
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
	title: 'Lolita店铺',
	meta: [
		{
			name: 'keywords',
			content: 'Lo研社,洛丽塔店铺,Lolita,Lolita店铺,Lolita店铺汇总'
		},
		{
			name: 'description',
			content: '洛丽塔店铺汇总'
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

const userStore = useUserStore()
const user = computed(() => userStore.user)

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

// 跳转到添加店铺页面
const jumpToAddShop = () => {
  router.push('/addShop')
}
</script>
<template>
  <div class="container mx-auto p-4 pb-20">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4  pb-3">
      <div class="w-full flex items-center gap-2">
        <UInput
          v-model="value"
          :autofocus="false"
          placeholder="搜索店铺 多条件空格分割."
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
        <UButton
          v-if="user"
          icon="i-heroicons-plus"
          color="primary"
          @click="jumpToAddShop"
          class="whitespace-nowrap"
        >
          补充店铺
        </UButton>
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
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      <div
        v-for="shop in list"
        :key="shop.shop_id"
        class="bg-white polaroid-card dark:bg-gray-900 rounded-[18px] shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center overflow-hidden border border-gray-100 dark:border-gray-800 group relative hover:bg-qhx-primary hover:text-white"
      >
        <ShopItem size="big" :item="shop"></ShopItem>
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
*{
  font-family: 'Menlo', sans-serif;
}
</style>


