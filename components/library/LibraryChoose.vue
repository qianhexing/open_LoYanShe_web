<!-- 选择图鉴组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>
          选择图鉴
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
              placeholder="搜索图鉴 多条件空格分割..."
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
            <UCheckbox 
              v-if="need_parent" 
              v-model="parent_id" 
              label="不显示子图鉴" 
              @change="checkboxParentId"
              class="text-sm"
            />
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
              已选图鉴
            </div>
            <div 
              v-for="item in choose_list" 
              :key="item.library_id"
              class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center p-2 transition-all duration-200 hover:shadow-md min-w-0"
            >
              <div class="flex-1 min-w-0 overflow-hidden">
                <LibraryItem :needJump="false" :size="'mini-list'" :item="item" />
              </div>
              <QhxJellyButton>
                <button
                  @click.stop="deleteList(item.library_id)"
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
              <UIcon name="material-symbols:library-books-rounded" class="text-indigo-500" />
              可选图鉴
            </div>
            <div 
              v-for="item in listData" 
              :key="item.library_id"
              v-show="choose_list.findIndex((child) => { return child.library_id === item.library_id}) === -1"
              class="group"
            >
              <div 
                v-if="!props.needExamin" 
                class="flex items-center justify-center mb-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                  审核状态：{{ formateExaminState(item.examin) }}
                </span>
              </div>
              <div 
                @click="chooseLibrary(item)"
                class="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 hover:scale-[1.01] min-w-0 overflow-hidden"
              >
                <LibraryItem :needJump="false" :size="'mini-list'" :item="item" />
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="material-symbols:book-outline" class="text-6xl text-gray-300 dark:text-gray-600" />
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
import { ref } from 'vue'
import { getLibraryList as apiGetLibraryList } from '@/api/library'
import type { Library } from '~/types/api'

const props = defineProps({
  needStatus: { type: Boolean, default: true },
  needHiddenTabbar: { type: Boolean, default: false },
  filter_list: { type: Array as () => any[], default: () => [] },
  multiple: { type: Boolean, default: false },
  need_parent: { type: Boolean, default: true },
  keywordMode: { type: Boolean, default: false },
  needExamin: { type: Boolean, default: true }
})
const emit = defineEmits(['choose'])

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Library[]>([])
const parent_id = ref(true)
const choose_list = ref<Library[]>([])
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

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

const loadMore =async () => {
  
  if (loading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getLibraryList()
    } catch (error) {
      page.value -= 1
    }
  }
}
const search = () => {
  page.value = 1
  getLibraryList()
}
const formateExaminState = (state: number | undefined) => {
  // 审核 0 通过 1待审核 2拒绝
  if (state === undefined) return '未知'
  switch (state) {
    case 0:
      return '通过'
    case 1:
      return '待审核'
    case 2:
      return '拒绝'
    case 3:
      return '永久拒绝'
    default:
      return '未知'
  }
}
function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.library_id !== id)
}

function checkboxParentId() {
  page.value = 1
  getLibraryList()
}

function chooseLibrary(item: Library) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择图鉴',
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

const getLibraryList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  let params: any = {
    page: initPage || page.value,
    pageSize: initPageSize || pageSize.value,
    filter_list: [
      { field: 'name', value: keywords.value, op: 'and' },
      ...props.filter_list
    ]
  }
  if (!props.needExamin) {
    params.examin = [0,1,2]
  }
  console.log(parent_id.value, '是否需要', props.need_parent)
  if (parent_id.value && props.need_parent) {
    params.filter_list.push({ field: 'parent_id', op: 'and', value: 0 })
  }

  if (props.keywordMode) {
    params = {
      page: page.value,
      pageSize: pageSize.value,
      parent_id: parent_id.value,
      keyword: keywords.value,
      need_Statistics: false
    }
  }

  try {
    const res = await apiGetLibraryList(params)
    const data = res.rows
    total.value = res.count
    if (page.value === 1) listData.value = data
    else listData.value.push(...data)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  getLibraryList()
})
defineExpose({
  showModel
})
</script>
