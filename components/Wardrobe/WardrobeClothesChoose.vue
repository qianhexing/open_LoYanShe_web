<!-- 选择衣柜服饰组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          选择衣柜服饰
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
              placeholder="搜索服饰名称..."
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
              <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  :src="`${BASE_IMG}${choose_item.clothes_img || ''}${getImageParams()}`"
                  :alt="choose_item.clothes_note"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ choose_item.clothes_note || '未命名' }}</span>
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
            :key="item.clothes_id"
            @click="chooseClothes(item)"
            class="bg-white dark:bg-gray-700/50 rounded-xl p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] min-w-0 overflow-hidden border-2 border-transparent"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': choose_item?.clothes_id === item.clothes_id }"
          >
            <div class="flex gap-3">
              <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  :src="`${BASE_IMG}${item.clothes_img || ''}${getImageParams()}`"
                  :alt="item.clothes_note || '服饰'"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {{ item.clothes_note || '暂无笔记' }}
                </div>
                <div v-if="item.wardrobe_status" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  状态：{{ item.wardrobe_status }}
                </div>
                <div v-if="item.clothes_part" class="text-xs text-gray-500 dark:text-gray-400">
                  部位：{{ item.clothes_part }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="i-heroicons-shirt" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500">暂无衣柜服饰，请先添加服饰到衣柜</p>
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
import { getClothesSearch } from '@/api/wardrobe'
import type { WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'

const emit = defineEmits<{
  choose: [item: WardrobeClothes]
}>()

const configStore = useConfigStore()
const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<WardrobeClothes[]>([])
const choose_item = ref<WardrobeClothes | null>(null)
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
    await getClothesList()
  } catch {
    page.value -= 1
  }
}

const search = () => {
  page.value = 1
  getClothesList()
}

const chooseClothes = (item: WardrobeClothes) => {
  choose_item.value = item
}

const confirmChoose = () => {
  if (!choose_item.value) return
  emit('choose', choose_item.value)
  closeModel()
}

const getClothesList = async () => {
  if (loading.value) return
  loading.value = true
  const filter_list: Array<{ field: string; op: string; value: string | number }> = []
  if (keywords.value.trim()) {
    filter_list.push({ field: 'clothes_note', op: 'and', value: keywords.value.trim() })
  }
  try {
    const res = await getClothesSearch({
      filter_list: filter_list.length ? filter_list : undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    total.value = res.count
    if (page.value === 1) {
      listData.value = res.rows
    } else {
      listData.value.push(...res.rows)
    }
  } finally {
    loading.value = false
  }
}

const init = () => {
  keywords.value = ''
  choose_item.value = null
  page.value = 1
  listData.value = []
}

watch(show, (val) => {
  if (val) {
    init()
    getClothesList()
  }
})

defineExpose({
  showModel
})
</script>
