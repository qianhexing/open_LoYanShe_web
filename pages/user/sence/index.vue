<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 头部操作栏 -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          @click="insertSence"
          :disabled="loading"
          class="flex items-center justify-center gap-2 px-6 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mx-auto max-md:w-full"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          <span class="font-medium">新建场景</span>
        </button>
      </div>
    </div>

    <!-- 场景列表 -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- 空状态 -->
      <div v-if="!loading && list.length === 0" class="text-center py-20">
        <UIcon name="i-heroicons-photo" class="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p class="text-gray-500 text-lg">暂无场景</p>
        <p class="text-gray-400 text-sm mt-2">点击上方按钮创建你的第一个场景</p>
      </div>

      <!-- 场景卡片网格 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="item in list"
          :key="item.sence_id"
          class="group relative bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <!-- 操作按钮 -->
          <div class="absolute top-3 right-3 z-20 flex gap-2 duration-200">
            <button
              @click.stop="editSence(item.sence_id)"
              class="w-8 h-8 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
              title="编辑"
            >
              <UIcon name="i-heroicons-pencil" class="w-4 h-4" />
            </button>
            <button
              @click.stop="deleteSence(item.sence_id)"
              class="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
              title="删除"
            >
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
          </div>

          <!-- 场景图片 -->
          <div
            @click="jumpToScene(item.sence_id)"
            class="block relative w-full overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
          >
            <img
              :src="getImageUrl(item.sence_cover)"
              :alt="item.sence_desc || '场景封面'"
              class="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>

          <!-- 场景信息 -->
          <div class="p-4">
            <div
              @click="jumpToScene(item.sence_id)"
              class="block cursor-pointer"
            >
            </div>

            <!-- 创建时间 -->
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
              <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
              <span>创建时间 {{ formatDate(item.create_time) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div class="mt-8">
        <QhxLoading
          :loading="loading"
          :page="page"
          :total="count"
          :page-size="pageSize"
          @load-more="loadMore"
        />
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <QhxModal v-model="deleteModal" :trigger-position="clickPosition">
      <div class="p-6 w-[400px] max-md:w-[90vw] bg-white dark:bg-gray-800 rounded-xl">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">操作确认</h3>
        <p class="text-gray-600 dark:text-gray-300 mb-6">确定要删除该场景吗？此操作不可恢复。</p>
        <div class="flex gap-3 justify-end">
          <UButton
            color="gray"
            variant="ghost"
            @click="deleteModal = false"
            class="px-4"
          >
            取消
          </UButton>
          <UButton
            color="red"
            @click="confirmDelete"
            :loading="loading"
            class="px-4"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getSenceList, deleteScene, insertScene } from '@/api/scene'
import type { Scene } from '@/types/api'
import type { SceneJSON } from '@/utils/threeCore'
import { BASE_IMG } from '@/utils/ipConfig'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import { useToast } from '#imports'

// uni-webview-js 没有类型声明，使用 unknown 类型
let uni: { navigateTo?: (options: { url: string; fail?: () => void }) => void } | null = null

// 用户信息和配置
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()
const port = computed(() => configStore.getPort())

// 数据状态
const list = ref<Scene[]>([])
const page = ref(1)
const pageSize = ref(10)
const count = ref(0)
const loading = ref(false)

// 删除相关状态
const deleteModal = ref(false)
const deleteId = ref<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })

// 获取图片URL
const getImageUrl = (cover?: string | null) => {
  if (cover && cover !== null) {
    return `${BASE_IMG}${cover}`
  }
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取场景列表
const getSceneList = async (pageNum?: number, pageSizeNum?: number) => {
  if (loading.value) return
  console.log('获取数据', pageNum, pageSizeNum)
  loading.value = true
  try {
    const params = {
      page: pageNum || page.value,
      pageSize: pageSizeNum || pageSize.value,
      visitor_id: userStore.user?.user_id || 0
    }
    
    const response = await getSenceList(params)
    count.value = response.count
    
    if (params.page === 1) {
      list.value = response.rows
    } else {
      list.value = [...list.value, ...response.rows]
    }
  } catch (error) {
    console.error('获取场景列表失败:', error)
    toast.add({
      title: '获取场景列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 新建场景
const insertSence = async () => {
  window.open('https://lolitalibrary.com/scene/detail/0?add=1', '_blank')
  return
  if (loading.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }
  
  loading.value = true
  try {
    // 创建一个空的场景数据
    const emptySceneData: SceneJSON = {
      objects: []
    }
    const response = await insertScene({
      json_data: emptySceneData,
      sence_cover: undefined
    })
    
    toast.add({
      title: '创建成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 重新加载列表
    await reload()
    
    // 跳转到编辑页面
    jumpToScene(response.sence_id, true)
  } catch (error) {
    console.error('创建场景失败:', error)
    toast.add({
      title: '创建场景失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 跳转到场景详情
const jumpToScene = (id: number, edit = false) => {
  const sceneUrl = `/scene/detail/${id}${edit ? '?edit=1' : ''}`
  const fullUrl = `https://lolitalibrary.com${sceneUrl}`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  
  if (isInUniApp && uni && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/common/outerLink2?fullScreen=true&url=${fullUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
  } else if (port.value) {
    // 鸿蒙系统
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: {
        url: fullUrl
      }
    }))
  } else {
    // 普通浏览器环境
    window.open(sceneUrl, '_blank')
  }
}

// 编辑场景
const editSence = (id: number) => {
  jumpToScene(id, true)
}

// 删除场景（显示确认弹窗）
const deleteSence = (id: number) => {
  deleteId.value = id
  clickPosition.value = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  }
  deleteModal.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (deleteId.value === null || loading.value) return
  
  loading.value = true
  try {
    await deleteScene({ sence_id: deleteId.value })
    reload()
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 重新加载列表
    
    deleteModal.value = false
    deleteId.value = null
    
    
  } catch (error) {
    reload()
    console.error('删除场景失败:', error)
    toast.add({
      title: '删除场景失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    
  } finally {
    loading.value = false
  }
}

// 重新加载
const reload = async () => {
  console.log('重新加载', page.value, pageSize.value)
  const size = page.value * pageSize.value
  loading.value = false
  await getSceneList(1, size)
}

// 加载更多
const loadMore = async () => {
  if (loading.value) {
    toast.add({
      title: '正在加载',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }
  
  const maxPage = Math.ceil(count.value / pageSize.value)
  if (page.value < maxPage) {
    page.value += 1
    await getSceneList()
  } else {
    toast.add({
      title: '没有更多了',
      icon: 'i-heroicons-information-circle',
      color: 'gray'
    })
  }
}

// 初始化
onMounted(async () => {
  // @ts-ignore - uni-webview-js 没有类型声明
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
    return null
  })
  getSceneList()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

