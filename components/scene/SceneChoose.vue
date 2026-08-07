<!-- 选择场景组件 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-md max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50/90 to-purple-50/80 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <div>
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">选择场景</h3>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">点击封面选中，再次点击可取消</p>
        </div>
        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          aria-label="关闭"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 工具栏 -->
      <div class="flex-shrink-0 px-4 pt-3 pb-2 space-y-3">
        <div class="relative">
          <UInput
            v-model="keywords"
            placeholder="搜索场景…"
            class="flex-1 focus:ring-0"
            :autofocus="false"
            @keyup.enter="search"
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
          >
            <template #leading>
              <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
            </template>
          </UInput>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            :class="choose_list.length
              ? 'bg-qhx-primary/10 text-qhx-primary'
              : 'bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'"
          >
            <UIcon name="material-symbols:check-circle-rounded" class="text-sm" />
            已选 {{ choose_list.length }}
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover shadow-sm transition-colors disabled:opacity-50"
            :disabled="!choose_list.length"
            @click="multipleChoose"
          >
            确认选择
          </button>
        </div>
      </div>

      <!-- 列表：3:4 一行 2 个 -->
      <div class="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div
          v-if="listData.length"
          class="grid grid-cols-2 gap-3"
        >
          <button
            v-for="item in listData"
            :key="item.sence_id"
            type="button"
            class="group relative rounded-[12px] overflow-hidden border bg-gray-100 dark:bg-gray-900/40 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary"
            :class="isSelected(item.sence_id)
              ? 'border-qhx-primary ring-2 ring-qhx-primary/40 shadow-md'
              : 'border-gray-200 dark:border-gray-700 hover:border-qhx-primary/50 hover:shadow-md'"
            @click="toggleScene(item)"
          >
            <div class="relative aspect-[3/4] w-full">
              <img
                :src="coverSrc(item)"
                :alt="item.sence_desc || '场景封面'"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div
                class="absolute inset-0 transition-colors"
                :class="isSelected(item.sence_id)
                  ? 'bg-qhx-primary/15'
                  : 'bg-black/0 group-hover:bg-black/5'"
              />
              <div
                v-if="isSelected(item.sence_id)"
                class="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-qhx-primary text-qhx-inverted shadow-md"
              >
                <UIcon name="i-heroicons-check-20-solid" class="h-4 w-4" />
              </div>
            </div>
          </button>
        </div>

        <div v-else-if="!loading" class="text-center py-14">
          <div class="flex flex-col items-center gap-3">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50">
              <UIcon name="material-symbols:view-in-ar-rounded" class="text-3xl text-gray-300 dark:text-gray-500" />
            </div>
            <p class="text-gray-400 dark:text-gray-500 text-sm">暂无场景</p>
          </div>
        </div>

        <div class="py-3">
          <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore" />
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getSenceList } from '@/api/scene'
import type { Scene } from '~/types/api'
import { useUserStore } from '@/stores/user'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps({
  multiple: { type: Boolean, default: false }
})

const emit = defineEmits<{
  choose: [list: Scene[]]
}>()

const userStore = useUserStore()
const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const total = ref(0)
const listData = ref<Scene[]>([])
const choose_list = ref<Scene[]>([])
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

const user_id = computed(() => userStore.user?.user_id || 0)

function coverSrc(item: Scene) {
  return `${BASE_IMG}${item.sence_cover || 'static/plan_cover/default.jpg'}?x-oss-process=image/quality,q_80/resize,w_400,h_533`
}

function isSelected(senceId: number) {
  return choose_list.value.some((i) => i.sence_id === senceId)
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
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  show.value = true
  if (user_id.value && !listData.value.length) {
    page.value = 1
    void getSceneList()
  }
}

const loadMore = async () => {
  if (loading.value) return
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getSceneList()
    } catch {
      page.value -= 1
    }
  }
}

const search = () => {
  page.value = 1
  void getSceneList()
}

function toggleScene(item: Scene) {
  const idx = choose_list.value.findIndex((i) => i.sence_id === item.sence_id)
  if (idx !== -1) {
    choose_list.value.splice(idx, 1)
    return
  }
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
  emit('choose', [...choose_list.value])
  closeModel()
}

function init() {
  keywords.value = ''
  choose_list.value = []
  page.value = 1
}

const getSceneList = async () => {
  if (loading.value) return
  loading.value = true

  const params: {
    page: number
    visitor_id: number
    pageSize: number
  } = {
    page: page.value,
    visitor_id: parseInt(user_id.value.toString()),
    pageSize: pageSize.value,
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

watch(user_id, (newId) => {
  if (newId && show.value) {
    page.value = 1
    listData.value = []
    void getSceneList()
  }
}, { immediate: true })

onMounted(() => {
  if (user_id.value) {
    void getSceneList()
  }
})

defineExpose({
  showModel
})
</script>
