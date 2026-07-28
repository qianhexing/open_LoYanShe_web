<script setup lang="ts">
// 新增单条合集数据
import { getCompList, deleteComp } from '@/api/compilations';
import type { PaginationResponse, Compilations } from '@/types/api'
import CompilationsAdd from '@/components/compilations/CompilationsAdd.vue'
const router = useRouter()
const route = useRoute()
const user = useUserStore()
const configStore = useConfigStore()
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keywords = ref('')
const value = ref('')
const compilationsAddRef = ref<InstanceType<typeof CompilationsAdd> | null>(null)
const showDeleteModal = ref(false)
const deleteItem = ref<Compilations | null>(null)
const deleteLoading = ref(false)
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


const { data, refresh } = await useAsyncData('compilations', fetchCompilationsList, {
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

// 创建合集成功回调
const handleCreateSuccess = async () => {
  // 刷新列表
  page.value = 1
  await refresh()
}

// 编辑合集
const handleEdit = (item: Compilations, event: MouseEvent) => {
  event.stopPropagation()
  if (compilationsAddRef.value) {
    compilationsAddRef.value.showModel(item, event)
  }
}

// 删除合集
const handleDelete = (item: Compilations, event: MouseEvent) => {
  event.stopPropagation()
  deleteItem.value = item
  showDeleteModal.value = true
}

// 确认删除合集
const confirmDelete = async () => {
  if (!deleteItem.value) return
  
  deleteLoading.value = true
  const toast = useToast()
  
  try {
    await deleteComp({ comp_id: deleteItem.value.comp_id })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 刷新列表
    page.value = 1
    await refresh()
    showDeleteModal.value = false
    deleteItem.value = null
  } catch (error) {
    console.error('删除失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    deleteLoading.value = false
  }
}
</script>
<template>
  <div class="min-h-screen">
    <!-- WebView 状态栏占位：layouts/default 中 ?statusbar= -->
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

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
        <CompilationsItem 
          :item="comp" 
          :size="'big'"
          :show-edit="user.user?.user_id === comp.create_user"
          @edit="(e: MouseEvent) => handleEdit(comp, e)"
          @delete="(e: MouseEvent) => handleDelete(comp, e)"
        ></CompilationsItem>
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

    <!-- 左下角创建合集按钮 -->
    <div class="fixed bottom-8 left-8 z-50 pointer-events-none">
      <button
        @click="compilationsAddRef?.showModel()"
        class="pointer-events-auto bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <span class="text-xl group-hover:rotate-12 transition-transform">📚</span>
        <span class="font-bold tracking-wide">创建合集</span>
      </button>
    </div>

    <!-- 创建/编辑合集弹窗 -->
    <ClientOnly>
      <CompilationsAdd 
        ref="compilationsAddRef" 
        @success="handleCreateSuccess" 
      />
    </ClientOnly>

    <!-- 删除确认弹窗 -->
    <UModal v-model="showDeleteModal" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              操作确认
            </h3>
          </div>
        </template>
        <div class="py-4">
          <p class="text-gray-700 dark:text-gray-300 mb-2">
            确定要删除合集 <span class="font-semibold text-gray-900 dark:text-gray-100">"{{ deleteItem?.comp_name }}"</span> 吗？
          </p>
          <p class="text-sm text-red-600 dark:text-red-400">
            ⚠️ 删除后将无法恢复，请谨慎操作
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton 
              color="gray" 
              variant="ghost" 
              @click="showDeleteModal = false"
              :disabled="deleteLoading"
            >
              取消
            </UButton>
            <UButton 
              color="red" 
              :loading="deleteLoading"
              @click="confirmDelete"
            >
              确认删除
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
    </div>
  </div>
</template>

<style scoped>

</style>


