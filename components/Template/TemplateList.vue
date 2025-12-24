<script setup lang="ts">
import type { TemplateInterface, PaginationResponse } from '@/types/api';
import { getTemplateList } from '@/api/temeplate'
const router = useRouter()
const route = useRoute()
// 分页参数
const pageSize = 20
// const total = ref(0)
const list = ref<TemplateInterface[]>([])
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')
const total = ref(0)
const isLoading = ref(true)
const getList = async () => {
  isLoading.value = true
  try {
    const response = await getTemplateList({
      page: page.value,
      pageSize: pageSize
    })
    if (page.value === 1) {
      list.value = response.rows ?? []
    } else {
      list.value = [...list.value, ...(response.rows ?? [])]
    }
    total.value = response.count
  } catch (error) {
    if (process.client) {
      console.error('获取失败:', error)
    }
  }
  isLoading.value = false
}
const loadMore = () => {
  console.log('是否在加载', isLoading.value)
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}
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
const handlePageChange = async (current: number) => {
  page.value = current
  try {
    await getList()
  } catch (error) {
    page.value -= 1
  }
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
interface Props {
  compact?: boolean // 紧凑模式
}
const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const emit = defineEmits(['choose'])
const choose = (item: TemplateInterface) => {
  emit('choose', item)
}
// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  // 执行搜索操作（示例）
  
  if (keyword.value) {
    page.value = 1
  }
}
onMounted(() => {
  getList()
})
</script>
<template>
  <div :class="compact ? 'p-1 pb-4' : 'container mx-auto p-4 pb-20'">
    <div :class="compact ? 'space-y-1' : 'grid grid-cols-3'" v-if="total > 0">
      <div v-for="list in list">
        <TemplateItem @choose="choose" :item="list" :compact="compact"></TemplateItem>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-4 text-xs">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>
  </div>
</template>

<style scoped>
</style>


