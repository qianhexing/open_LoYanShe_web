<script setup lang="ts">
import type { Shop } from '@/types/api';
import { getShopList } from '@/api/shop';
// 分页参数
const page = ref(1)
const pageSize = 20
const total = ref(0)
const list = ref<Shop[]>([])
// 使用`use$Post`请求函数
const fetchShopList = async () => {
	try {
		const response = await getShopList({
      page: page.value,
      pageSize: pageSize
		})
    const { rows, count } = response
		total.value = count || 0 // 设置总数
    list.value = rows
    console.log('获取到的数据', list.value, rows)
	} catch (error) {
		console.error('数据获取错误:', error)
		return []
	}
}

// 调用fetchShopList请求函数
await useAsyncData('shops', fetchShopList, {
	watch: [page] // 监听页码变化自动重新获取数据
})
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
</script>
<template>
  <div class="container mx-auto p-4">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-[200px]">
      <USkeleton class="h-32 w-full" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!list?.length" class="text-center text-gray-500 py-8">
      暂无数据
    </div>

    <!-- 店铺列表 -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <UCard
        v-for="shop in list"
        :key="shop.shop_id"
        class="group hover:-translate-y-1 transition-all duration-300"
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
          <div class="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800">
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
          <h3
            class="text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
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
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-right"
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
</style>


