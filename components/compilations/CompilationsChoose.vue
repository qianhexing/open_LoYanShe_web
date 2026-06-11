<!-- 选择合集组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>选择合集</div>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="p-6 space-y-4 flex-shrink-0">
          <div class="relative">
            <input
              v-model="keywords"
              type="search"
              placeholder="搜索合集..."
              class="w-full rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-qhx-primary/40"
              @keyup.enter="search"
            />
            <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <div v-show="chooseList.length !== 0" class="flex items-center gap-2 px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm font-medium">
              <UIcon name="material-symbols:check-circle-rounded" class="text-base" />
              已选择 {{ chooseList.length }}
            </div>
            <button
              type="button"
              class="ml-auto px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              @click="multipleChoose"
            >
              确认选择
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <div v-if="chooseList.length" class="space-y-2">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">已选合集</div>
            <div
              v-for="item in chooseList"
              :key="item.comp_id"
              class="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl border border-pink-200 dark:border-pink-800 flex items-center p-2 min-w-0"
            >
              <CompilationsItem :need-jump="false" size="mini" :item="item" class="flex-1 min-w-0" />
              <QhxJellyButton>
                <button
                  @click.stop="deleteList(item.comp_id)"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-red-700 to-red-800 text-white ml-2 flex-shrink-0"
                >
                  <UIcon name="ant-design:close-outlined" class="text-sm" />
                </button>
              </QhxJellyButton>
            </div>
          </div>

          <div v-if="listData.length" class="space-y-2">
            <div
              v-for="item in listData"
              :key="item.comp_id"
              v-show="chooseList.findIndex((child) => child.comp_id === item.comp_id) === -1"
              @click="chooseComp(item)"
              class="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-pink-300 dark:hover:border-pink-600 min-w-0 overflow-hidden"
            >
              <CompilationsItem :need-jump="false" size="mini" :item="item" />
            </div>
          </div>

          <div v-if="!listData.length && !loading" class="text-center py-12 text-gray-400">暂无数据</div>

          <div class="py-3">
            <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore" />
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import type { Compilations } from '@/types/api'
import { getCompList } from '@/api/compilations'
import CompilationsItem from '@/components/compilations/CompilationsItem.vue'

const emit = defineEmits<{ choose: [items: Compilations[]] }>()

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Compilations[]>([])
const chooseList = ref<Compilations[]>([])
const clickPosition = ref({ x: 0, y: 0 })

const init = () => {
  keywords.value = ''
  page.value = 1
  listData.value = []
  chooseList.value = []
  total.value = 0
}

const closeModel = () => {
  show.value = false
  init()
}

const handleClose = () => closeModel()

const showModel = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  show.value = true
  void fetchList()
}

const fetchList = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getCompList({
      page: page.value,
      pageSize: pageSize.value,
      keywords: keywords.value || undefined
    })
    const rows = res.data?.rows ?? []
    total.value = res.data?.count ?? 0
    listData.value = page.value > 1 ? [...listData.value, ...rows] : rows
  } finally {
    loading.value = false
  }
}

const search = () => {
  page.value = 1
  listData.value = []
  void fetchList()
}

const loadMore = async () => {
  if (loading.value || listData.value.length >= total.value) return
  page.value += 1
  await fetchList()
}

const chooseComp = (item: Compilations) => {
  if (chooseList.value.findIndex((child) => child.comp_id === item.comp_id) === -1) {
    chooseList.value.push(item)
  }
}

const deleteList = (compId: number) => {
  chooseList.value = chooseList.value.filter((item) => item.comp_id !== compId)
}

const multipleChoose = () => {
  emit('choose', [...chooseList.value])
  closeModel()
}

defineExpose({ showModel })
</script>
