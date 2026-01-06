<!-- 选择场景组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>
          选择场景
        </div>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="p-6 space-y-4 flex-shrink-0">
          <!-- 搜索框 -->
          <div class="relative">
            <UInput
              v-model="keywords"
              placeholder="搜索场景 多条件空格分割..."
              class="flex-1 focus:ring-0"
              :autofocus="false"
              @keyup.enter="search"
              :ui="{
                base: 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-500'
                  }
                }
              }"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
              </template>
            </UInput>
          </div>

          <!-- 筛选栏 -->
          <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <div v-show="choose_list.length !== 0" class="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              <UIcon name="material-symbols:check-circle-rounded" class="text-base" />
              已选择 {{ choose_list.length }}
            </div>
            <UButton 
              class="bg-qhx-primary text-qhx-inverted shadow-lg shadow-blue-500/30 transition-all duration-200"
              @click="multipleChoose"
            >
              确认选择
            </UButton>
          </div>
        </div>

        <!-- 列表区域 -->
        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <!-- 已选列表 -->
          <div v-if="choose_list.length" class="space-y-2">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <UIcon name="material-symbols:bookmark-rounded" class="text-blue-500" />
              已选场景
            </div>
            <div 
              v-for="item in choose_list" 
              :key="item.sence_id"
              class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center p-2 transition-all duration-200 hover:shadow-md min-w-0"
            >
              <div class="flex-1 min-w-0 overflow-hidden">
                <SceneItem :needJump="false" :size="'mini-list'" :item="item" />
              </div>
              <QhxJellyButton>
                <button
                  @click.stop="deleteList(item.sence_id)"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white transition-all duration-200 hover:scale-110 ml-2 flex-shrink-0 shadow-md shadow-red-500/30"
                >
                  <UIcon name="ant-design:close-outlined" class="text-sm" />
                </button>
              </QhxJellyButton>
            </div>
          </div>

          <!-- 可选列表 -->
          <div v-if="listData.length" class="space-y-2">
            <div v-if="choose_list.length" class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 mt-4">
              <UIcon name="material-symbols:scatter-plot-rounded" class="text-indigo-500" />
              可选场景
            </div>
            <div 
              v-for="item in listData" 
              :key="item.sence_id"
              v-show="choose_list.findIndex((child) => child.sence_id === item.sence_id) === -1"
              class="group"
            >
              <div 
                @click="chooseScene(item)"
                class="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 hover:scale-[1.01] min-w-0 overflow-hidden"
              >
                <SceneItem 
                  :needJump="false" 
                  :size="'mini-list'" 
                  :item="item" 
                />
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="material-symbols:scatter-plot-outline" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500 text-lg">暂无数据</p>
            </div>
          </div>
          
          <!-- 加载更多 -->
          <div class="py-3">
            <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getSenceList } from '@/api/scene'
import type { Scene } from '~/types/api'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  multiple: { type: Boolean, default: false }
})

const emit = defineEmits(['choose'])

const userStore = useUserStore()
const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Scene[]>([])
const choose_list = ref<Scene[]>([])
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

const user_id = computed(() => userStore.user?.user_id || 0)

const closeModel = () => {
  show.value = false
  init()
}

const handleClose = () => {
  closeModel()
}

const showModel = (event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  show.value = true
}

const loadMore = async () => {
  if (loading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getSceneList()
    } catch (error) {
      page.value -= 1
    }
  }
}

const search = () => {
  page.value = 1
  getSceneList()
}

function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.sence_id !== id)
}

function chooseScene(item: Scene) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择场景',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  emit('choose', choose_list.value)
  closeModel()
}

function init() {
  keywords.value = ''
  choose_list.value = []
  page.value = 1
}

const getSceneList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  
  const params = {
    page: initPage || page.value,
    visitor_id: parseInt(user_id.value.toString()),
    pageSize: initPageSize || pageSize.value,
  }
  
  // 如果有搜索关键词，可以添加到参数中
  if (keywords.value) {
    // 根据实际API需求添加搜索参数
    // params.keyword = keywords.value
  }

  try {
    const res = await getSenceList(params)
    const data = res.rows
    total.value = res.count
    if (page.value === 1) listData.value = data
    else listData.value.push(...data)
  } finally {
    loading.value = false
  }
}

// 监听 user_id 变化，当有用户ID时加载数据
watch(user_id, (newId) => {
  if (newId && show.value) {
    page.value = 1
    listData.value = []
    getSceneList()
  }
}, { immediate: true })

onMounted(() => {
  if (user_id.value) {
    getSceneList()
  }
})

defineExpose({
  showModel
})
</script>

