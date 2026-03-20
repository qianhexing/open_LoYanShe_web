<!-- 选择搭配组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          选择搭配
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
              placeholder="搜索搭配..."
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

          <!-- 确认选择 -->
          <div v-if="choose_item" class="flex justify-between items-center p-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl border-2 border-qhx-primary">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-600">
                <img
                  v-if="choose_item.cover"
                  :src="`${BASE_IMG}${choose_item.cover}${getImageParams()}`"
                  :alt="choose_item.note || '搭配'"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <UIcon name="material-symbols:style-rounded" class="text-lg text-gray-400" />
                </div>
              </div>
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ choose_item.note || '未命名搭配' }}</span>
            </div>
            <UButton
              class="bg-qhx-primary text-white"
              @click="confirmChoose"
            >
              确认选择
            </UButton>
          </div>
        </div>

        <!-- 列表区域 -->
        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div
            v-for="item in listData"
            :key="item.matching_id"
            @click="chooseMatching(item)"
            class="bg-white dark:bg-gray-700/50 rounded-xl p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] min-w-0 overflow-hidden border-2 border-transparent"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': choose_item?.matching_id === item.matching_id }"
          >
            <div class="flex gap-3">
              <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-600">
                <img
                  v-if="item.cover"
                  :src="`${BASE_IMG}${item.cover}${getImageParams()}`"
                  :alt="item.note || '搭配'"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <UIcon name="material-symbols:style-rounded" class="text-2xl text-gray-400" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {{ item.note || '未命名搭配' }}
                </div>
                <div v-if="item.user_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ item.user_name }}
                </div>
                <div v-if="item.main_style" class="text-xs text-gray-500 dark:text-gray-400">
                  风格：{{ item.main_style }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="material-symbols:style-rounded" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500">暂无搭配数据</p>
            </div>
          </div>

          <!-- 加载更多 -->
          <div class="py-3">
            <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore" />
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getMatchingListList } from '@/api/matching_list'
import type { MatchingListItem } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'

const props = defineProps({
  needStatus: { type: Boolean, default: true },
  filter_list: { type: Array as () => unknown[], default: () => [] },
  needExamin: { type: Boolean, default: true }
})

const emit = defineEmits<{
  choose: [item: MatchingListItem]
}>()

const configStore = useConfigStore()
const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<MatchingListItem[]>([])
const choose_item = ref<MatchingListItem | null>(null)
const clickPosition = ref({ x: 0, y: 0 })

const getImageParams = () => configStore.config?.image_params || ''

const closeModel = () => {
  show.value = false
  init()
}

const handleClose = () => {
  closeModel()
}

const showModel = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  show.value = true
}

const loadMore = async () => {
  if (loading.value || page.value >= Math.ceil(total.value / pageSize.value)) return
  page.value += 1
  try {
    await getMatchingList()
  } catch {
    page.value -= 1
  }
}

const search = () => {
  page.value = 1
  getMatchingList()
}

function chooseMatching(item: MatchingListItem) {
  choose_item.value = item
}

function confirmChoose() {
  if (!choose_item.value) return
  emit('choose', choose_item.value)
  closeModel()
}

function init() {
  keywords.value = ''
  choose_item.value = null
  page.value = 1
  listData.value = []
}

const getMatchingList = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getMatchingListList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keywords.value,
      filter_list: props.filter_list.length ? (props.filter_list as Array<{ field: string; op: string; value: string | number }>) : undefined
    })
    total.value = res.count
    if (page.value === 1) {
      listData.value = res.rows
    } else {
      listData.value.push(...res.rows)
    }
  } catch (error) {
    console.error('获取搭配列表失败:', error)
  } finally {
    loading.value = false
  }
}

watch(show, (val) => {
  if (val) {
    init()
    getMatchingList()
  }
})

defineExpose({
  showModel
})
</script>

<style scoped></style>

