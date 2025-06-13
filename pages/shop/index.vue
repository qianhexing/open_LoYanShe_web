<script setup lang="ts">
import type { Shop, PaginationResponse } from '@/types/api';
import { getShopList } from '@/api/shop';
import { _ringColor } from '#tailwind-config/theme';
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
</script>
<template>
  <div class="container mx-auto p-4">
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
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
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <UCard
        v-for="shop in list"
        :key="shop.shop_id"
        class="group hover:-translate-y-1 transition-all duration-300 cursor-pointer relative"
        :ui="{
          base: 'overflow-hidden',
          body: {
            base: 'p-0',
          },
          header: {
            base: 'p-0',
          },
          footer: {
            base: 'p-3 bg-gray-50 dark:bg-gray-900/50',
          },
        }"
      >
        <template #header>
          <div class="relative aspect-[4/3] w-full bg-qhx-bg-card dark:bg-gray-800">
            <img
              :src="`https://lolitalibrary.com/ali/${shop.shop_logo}`"
              :alt="shop.shop_name"
              class="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
            <UBadge
              :color="shop.shop_country === 0 ? 'rose' : 'sky'"
              size="sm"
              class="absolute top-2 right-2"
              variant="solid"
            >
              {{ shop.shop_country === 0 ? '国牌' : '日牌' }}
            </UBadge>
          </div>
        </template>
        <div class="">
          <div v-if="shop.main_type && shop.main_type.includes('4')" class="badge-tip">山店</div>
          <h3
            class="text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-qhx-primary transition-colors">
            {{ shop.shop_name }}
          </h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            已收录：{{ shop.count_library || 0 }}
          </p>
        </div>

        <template #footer>
          <div class="flex items-center justify-between">
            <!-- <UButton
              size="xs"
              variant="ghost"
              icon="i-heroicons-heart"
              :ui="{ padding: { xs: 'px-1' } }"
            >
              {{ shop.count_library || 0 }}
            </UButton> -->
            <div></div>
            <UButton
              size="xs"
              class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              variant="soft"
              :ui="{ padding: { xs: 'px-2' } }"
            >
              查看详情
            </UButton>
          </div>
        </template>
      </UCard>
    </div>

    <!-- 分页组件 -->
    <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination
        v-model="page"
        :total="total"
        :page-size="pageSize"
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
</style>


