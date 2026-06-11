<script setup lang="ts">
import type { Library, LibraryPipe } from '@/types/api'
import { deleteLibraryPipe, getLibraryDetail, getLibraryPipeListAll } from '@/api/library'
import type LibraryPipelineEdit from '@/components/library/LibraryPipelineEdit.vue'
import dayjs from 'dayjs'

definePageMeta({
  name: 'library-manage-pipeline',
  ssr: false
})

const toast = useToast()
const route = useRoute()
const configStore = useConfigStore()
const config = computed(() => configStore.config)

const pkId = computed(() => Number.parseInt(route.params.id as string))
const loading = ref(false)
const library = ref<Library | null>(null)
const list = ref<LibraryPipe[]>([])
const pipelineEditRef = ref<InstanceType<typeof LibraryPipelineEdit> | null>(null)

const deleteModalOpen = ref(false)
const deleteLoading = ref(false)
const deleteItem = ref<LibraryPipe | null>(null)

const formatPipeState = (state?: number) => {
  if (state == null) return '暂无状态'
  return config.value?.pipe_state.find((item) => item.value === state)?.label ?? '暂无状态'
}

const fetchLibrary = async () => {
  if (!pkId.value || Number.isNaN(pkId.value)) return
  library.value = (await getLibraryDetail({ library_id: pkId.value })).library ?? null
}

const fetchList = async () => {
  if (!pkId.value || Number.isNaN(pkId.value)) {
    toast.add({ title: '参数错误', description: '缺少图鉴 id', color: 'red' })
    return
  }
  loading.value = true
  try {
    list.value = await getLibraryPipeListAll({ pk_id: pkId.value, pk_type: 0 })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchLibrary()
  await fetchList()
})

const openAdd = () => pipelineEditRef.value?.showModel()
const openEdit = (item: LibraryPipe) => pipelineEditRef.value?.editModel(item)

const openDelete = (item: LibraryPipe) => {
  deleteItem.value = item
  deleteModalOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteItem.value?.pipe_id || deleteLoading.value) return
  deleteLoading.value = true
  try {
    await deleteLibraryPipe({ pipe_id: deleteItem.value.pipe_id })
    toast.add({ title: '删除成功', color: 'green' })
    deleteModalOpen.value = false
    deleteItem.value = null
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

const onSuccess = async () => {
  await fetchList()
}
</script>

<template>
  <div>
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />
    <div class="container mx-auto max-w-6xl px-4 py-4">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-lg font-semibold">状态流水线</div>
          <div v-if="library" class="text-sm text-gray-500 mt-0.5">{{ library.name }}</div>
        </div>
        <QhxJellyButton>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600"
            @click="openAdd"
          >
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            管理状态流水线
          </button>
        </QhxJellyButton>
      </div>

      <div v-if="loading" class="py-10 text-center text-gray-500">加载中...</div>

      <div v-else class="space-y-4">
        <div
          v-for="item in list"
          :key="item.pipe_id"
          class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
        >
          <div class="flex items-start justify-between gap-3 px-4 py-3 bg-gray-50/60 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
            <div class="min-w-0 flex-1 space-y-1 text-sm">
              <div v-if="item.start_time">开始时间：{{ dayjs(item.start_time).format('YYYY-MM-DD') }}</div>
              <div v-if="item.end_time">结束时间：{{ dayjs(item.end_time).format('YYYY-MM-DD') }}</div>
              <div>备注：{{ item.note || '暂无备注' }}</div>
              <div>状态：{{ formatPipeState(item.state) }}</div>
              <div v-if="item.library_list?.length" class="flex flex-wrap gap-1 pt-1">
                <span class="text-gray-500">包含版型：</span>
                <QhxTag v-for="child in item.library_list" :key="child.library_id" :active="true">
                  {{ child.name }} {{ child.library_type }}
                </QhxTag>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-gray-500 text-white hover:bg-gray-600"
                @click="openEdit(item)"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
                编辑
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
                @click="openDelete(item)"
              >
                <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                删除
              </button>
            </div>
          </div>
        </div>

        <div v-if="list.length === 0" class="py-16 text-center text-gray-500">
          暂无状态流水线，点击上方按钮添加
        </div>
      </div>

      <QhxModal v-model="deleteModalOpen" :close-on-backdrop="false">
        <div class="w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="text-base font-semibold text-gray-800 dark:text-gray-100">操作确认</div>
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="deleteModalOpen = false"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div class="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">确定要删除该状态流水线吗？</div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
              @click="deleteModalOpen = false"
            >
              取消
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              :disabled="deleteLoading"
              @click="confirmDelete"
            >
              {{ deleteLoading ? '删除中…' : '确定删除' }}
            </button>
          </div>
        </div>
      </QhxModal>

      <LibraryPipelineEdit ref="pipelineEditRef" :library="library" @success="onSuccess" />
    </div>
  </div>
</template>
