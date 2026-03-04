<!-- 选择帖子组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {{ title }}
        </div>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="p-6 space-y-4 flex-shrink-0">
          <UInput
            v-model="keywords"
            :placeholder="placeholder"
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

          <div v-if="choose_item" class="flex justify-between items-center p-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl border-2 border-qhx-primary">
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
              {{ choose_item.title || '未命名' }}
            </span>
            <UButton class="bg-qhx-primary text-white" @click="confirmChoose">
              确认选择
            </UButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div
            v-for="item in listData"
            :key="item.community_id"
            @click="chooseCommunity(item)"
            class="bg-white dark:bg-gray-700/50 rounded-xl p-2 cursor-pointer transition-all duration-200 hover:shadow-lg min-w-0 overflow-hidden border-2 border-transparent"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': choose_item?.community_id === item.community_id }"
          >
            <div class="flex gap-3">
              <div v-if="getFirstImg(item)" class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  :src="getFirstImg(item)"
                  :alt="item.title ?? ''"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {{ item.title || '暂无标题' }}
                </div>
                <div v-if="item.user?.user_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ item.user.user_name }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="!listData.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="i-heroicons-document-text" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500">暂无帖子</p>
            </div>
          </div>

          <div class="py-3">
            <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore" />
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { getCommunityList } from '@/api/community'
import type { Community } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { useUserStore } from '@/stores/user'

const props = withDefaults(
  defineProps<{
    /** 仅显示该用户的帖子，传入 user_id 时优先用 user_id */
    user_id?: number | null
    /** 是否只筛选自己的帖子（使用当前登录用户 ID） */
    onlyMine?: boolean
    /** 弹窗标题 */
    title?: string
    /** 搜索框占位文案 */
    placeholder?: string
    /** API 额外筛选条件 */
    filterList?: Array<{ field: string; op: string; value: string | number }>
  }>(),
  {
    user_id: null,
    onlyMine: false,
    title: '选择帖子',
    placeholder: '搜索帖子...',
    filterList: undefined
  }
)

const userStore = useUserStore()
/** 实际请求用的 user_id：onlyMine 时用当前用户，否则用传入的 user_id */
const effectiveUserId = computed(() => {
  if (props.onlyMine && userStore.user?.user_id != null) {
    return userStore.user.user_id
  }
  return props.user_id ?? undefined
})

const emit = defineEmits<{
  choose: [item: Community]
}>()

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<Community[]>([])
const choose_item = ref<Community | null>(null)
const clickPosition = ref({ x: 0, y: 0 })

function getFirstImg(item: Community): string {
  if (item.img_list) {
    const imgs = item.img_list.split(',').filter(Boolean)
    if (imgs[0]) return `${BASE_IMG}${imgs[0]}`
  }
  if (item.small_img_list) {
    const imgs = (typeof item.small_img_list === 'string' ? item.small_img_list.split(',') : item.small_img_list).filter(Boolean)
    if (imgs[0]) return `${BASE_IMG}${imgs[0]}`
  }
  return ''
}

function closeModel() {
  show.value = false
  init()
}

function handleClose() {
  closeModel()
}

function showModel(event?: MouseEvent) {
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
    await getList()
  } catch {
    page.value -= 1
  }
}

function search() {
  page.value = 1
  getList()
}

function chooseCommunity(item: Community) {
  choose_item.value = item
}

function confirmChoose() {
  if (!choose_item.value) return
  emit('choose', choose_item.value)
  closeModel()
}

async function getList() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getCommunityList({
      user_id: effectiveUserId.value,
      page: page.value,
      pageSize: pageSize.value,
      keywords: keywords.value.trim() || undefined,
      filter_list: props.filterList
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

function init() {
  keywords.value = ''
  choose_item.value = null
  page.value = 1
  listData.value = []
}

watch(show, (val) => {
  if (val) {
    init()
    getList()
  }
})

defineExpose({
  showModel
})
</script>
