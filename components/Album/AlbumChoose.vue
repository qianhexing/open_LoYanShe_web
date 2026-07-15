<!-- 选择成就簿（站内链接等场景，交互参考 ShopChoose） -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>选择成就簿</div>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="p-6 space-y-4 flex-shrink-0">
          <div class="relative">
            <UInput
              v-model="keywords"
              placeholder="搜索成就簿标题…"
              class="flex-1 focus:ring-0"
              :autofocus="false"
              :ui="{
                base: 'focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
                rounded: 'rounded-full',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-amber-500'
                  }
                }
              }"
              @keyup.enter="search"
            >
              <template #leading>
                <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
              </template>
            </UInput>
          </div>

          <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <div v-show="choose_list.length !== 0" class="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium">
              <UIcon name="material-symbols:check-circle-rounded" class="text-base" />
              已选择 {{ choose_list.length }}
            </div>
            <UButton
              class="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/30 transition-all duration-200"
              @click="multipleChoose"
            >
              确认选择
            </UButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div v-if="choose_list.length" class="space-y-2">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <UIcon name="material-symbols:trophy-rounded" class="text-amber-600" />
              已选成就簿
            </div>
            <div
              v-for="item in choose_list"
              :key="item.album_id"
              class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center p-2 transition-all duration-200 hover:shadow-md min-w-0"
            >
              <div class="flex-1 min-w-0 overflow-hidden">
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    :src="albumCover(item)"
                    :alt="item.album_title"
                    class="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-600"
                    loading="lazy"
                  >
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {{ item.album_title || '未命名成就簿' }}
                    </div>
                    <div v-if="item.album_desc" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {{ item.album_desc }}
                    </div>
                    <div v-if="item.count" class="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {{ item.count_achieve ?? 0 }}/{{ item.count }} · {{ getAlbumItemProgress(item) }}%
                    </div>
                  </div>
                </div>
              </div>
              <QhxJellyButton>
                <button
                  type="button"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white transition-all duration-200 hover:scale-110 ml-2 flex-shrink-0 shadow-md shadow-red-500/30"
                  @click.stop="deleteList(item.album_id)"
                >
                  <UIcon name="ant-design:close-outlined" class="text-sm" />
                </button>
              </QhxJellyButton>
            </div>
          </div>

          <div v-if="filteredList.length" class="space-y-2">
            <div v-if="choose_list.length" class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 mt-4">
              <UIcon name="material-symbols:menu-book-rounded" class="text-orange-600" />
              可选成就簿
            </div>
            <div
              v-for="item in filteredList"
              :key="item.album_id"
              v-show="choose_list.findIndex((child) => child.album_id === item.album_id) === -1"
              class="group"
            >
              <div
                class="bg-white dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-600 hover:scale-[1.01] min-w-0 overflow-hidden"
                @click="chooseAlbum(item)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    :src="albumCover(item)"
                    :alt="item.album_title"
                    class="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-600"
                    loading="lazy"
                  >
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {{ item.album_title || '未命名成就簿' }}
                    </div>
                    <div v-if="item.album_desc" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {{ item.album_desc }}
                    </div>
                    <div v-if="item.count" class="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {{ item.count_achieve ?? 0 }}/{{ item.count }} · {{ getAlbumItemProgress(item) }}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!filteredList.length && !loading" class="text-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="material-symbols:trophy-outline" class="text-6xl text-gray-300 dark:text-gray-600" />
              <p class="text-gray-400 dark:text-gray-500 text-lg">暂无数据</p>
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
import { computed, onMounted, shallowRef, ref } from 'vue'
import { getAlbumList } from '@/api/album'
import { BASE_IMG } from '@/utils/ipConfig'
import { getAlbumItemProgress } from '@/composables/useAlbumIndexPage'
import type { Album } from '@/types/api'

const props = defineProps({
  multiple: { type: Boolean, default: false },
})

const emit = defineEmits<{
  choose: [list: Album[]]
}>()

const show = shallowRef(false)
const keywords = ref('')
const page = shallowRef(1)
const pageSize = shallowRef(10)
const loading = shallowRef(false)
const total = shallowRef(0)
const listData = ref<Album[]>([])
const choose_list = ref<Album[]>([])
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

const filteredList = computed(() => {
  const q = keywords.value.trim().toLowerCase()
  if (!q) return listData.value
  return listData.value.filter((item) => {
    const title = (item.album_title ?? '').toLowerCase()
    const desc = (item.album_desc ?? '').toLowerCase()
    return title.includes(q) || desc.includes(q)
  })
})

function albumCover(item: Album) {
  return `${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`
}

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
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  } else {
    clickPosition.value = { x: 0, y: 0 }
  }
  show.value = true
  if (!listData.value.length) {
    getAlbumListData()
  }
}

const loadMore = async () => {
  if (loading.value) return
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getAlbumListData()
    } catch {
      page.value -= 1
    }
  }
}

const search = () => {
  if (!listData.value.length) {
    page.value = 1
    getAlbumListData()
  }
}

function deleteList(id: number) {
  choose_list.value = choose_list.value.filter((i) => i.album_id !== id)
}

function chooseAlbum(item: Album) {
  if (props.multiple) {
    choose_list.value.push(item)
  } else {
    choose_list.value = [item]
  }
}

function multipleChoose() {
  if (!choose_list.value.length) {
    toast.add({
      title: '请选择成就簿',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
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

const getAlbumListData = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getAlbumList({
      page: page.value,
      pageSize: pageSize.value,
      parent_id: 0,
    })
    total.value = res.count
    if (page.value === 1) listData.value = res.rows
    else listData.value.push(...res.rows)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  getAlbumListData()
})

defineExpose({
  showModel,
})
</script>
