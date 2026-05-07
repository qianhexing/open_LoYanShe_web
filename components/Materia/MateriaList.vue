<script setup lang="ts">
import type { Material, PaginationResponse } from '@/types/api';
import { deleteMaterial, getMaterialctList } from '@/api/material'
const router = useRouter()
const route = useRoute()
const toast = useToast()
// 分页参数
const pageSize = 20
// const total = ref(0)
const list = ref<Material[]>([])
const page = ref(Number(route.query.page) || 1)
const keyword = ref('')
const value = ref('')
const total = ref(0)
const isLoading = ref(true)
const getList = async () => {
  isLoading.value = true
  try {
    const params: { page: number; pageSize: number; pk_type?: number | number[] } = {
      page: page.value,
      pageSize: pageSize
    }
    // 如果传入了 pk_type，则添加到参数中
    if (props.pkType !== undefined) {
      params.pk_type = props.pkType
    }
    const response = await getMaterialctList(params)
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

interface Props {
  compact?: boolean // 紧凑模式
  pkType?: number | number[] // pk_type 参数，可以是单个数字或数组
  /** 列表项不显示标题；但 GLB/GLTF 模型仍会显示标题 */
  hideItemTitle?: boolean
  allowDelete?: boolean // 列表项显示删除（会调接口并刷新）
  /** GLB/GLTF 显示修改（仅标题/封面），需由父级接 @edit-gltf 打开弹窗 */
  allowGltfEdit?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  compact: false,
  pkType: undefined,
  hideItemTitle: false,
  allowDelete: false,
  allowGltfEdit: false
})

const emit = defineEmits<{
  choose: [item: Material]
  'edit-gltf': [item: Material]
}>()
const choose = (item: Material) => {
  emit('choose', item)
}

const handleItemDelete = async (item: Material) => {
  if (!props.allowDelete) return
  if (typeof window !== 'undefined' && !window.confirm('确定删除该素材？')) return
  try {
    await deleteMaterial(item.materia_id)
    toast.add({
      title: '已删除',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    page.value = 1
    await getList()
  } catch (error) {
    console.error('删除素材失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
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
        <MateriaItem
          @choose="choose"
          @delete="handleItemDelete"
          @edit-gltf="emit('edit-gltf', $event)"
          :item="list"
          :compact="compact"
          :hide-title="hideItemTitle"
          :deletable="allowDelete"
          :allow-gltf-edit="allowGltfEdit"
        />
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-4 text-xs">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" style="transform: scale(0.6);" @load-more="loadMore"></QhxLoading>
  </div>
</template>

<style scoped>
</style>


