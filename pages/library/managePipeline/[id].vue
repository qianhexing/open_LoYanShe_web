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
const router = useRouter()
const configStore = useConfigStore()
const { setLayoutStyle } = useLayoutStyle()
const config = computed(() => configStore.config)

const pkId = computed(() => Number.parseInt(route.params.id as string))
const loading = ref(false)
const library = ref<Library | null>(null)
const list = ref<LibraryPipe[]>([])
const pipelineEditRef = ref<InstanceType<typeof LibraryPipelineEdit> | null>(null)

const deleteModalOpen = ref(false)
const deleteLoading = ref(false)
const deleteItem = ref<LibraryPipe | null>(null)

const headerTop = computed(() => `${configStore.statusBarHeight || 0}px`)

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
  setLayoutStyle(1)
  await fetchLibrary()
  await fetchList()
})

onBeforeUnmount(() => {
  setLayoutStyle(0)
})

const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  if (pkId.value && !Number.isNaN(pkId.value)) {
    router.push(`/library/detail/${pkId.value}`)
  }
}

const openAdd = (e?: MouseEvent) => pipelineEditRef.value?.showModel()
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
  <div class="manage-page min-h-screen bg-[#fff8f8] dark:bg-[#141414] pb-28">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />
    <header
      class="manage-page__header sticky z-30 border-b border-pink-100/80 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md"
      :style="{ top: headerTop }"
    >
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200/80 bg-white text-gray-600 shadow-sm transition hover:bg-pink-50 hover:text-pink-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="返回"
          @click="goBack"
        >
          <UIcon name="i-heroicons-chevron-left" class="h-5 w-5" />
        </button>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            状态流水线
          </h1>
          <p v-if="library?.name" class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ library.name }}
          </p>
        </div>

        <span
          class="shrink-0 rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-600 dark:bg-pink-900/40 dark:text-pink-300"
        >
          共 {{ list.length }} 条
        </span>
      </div>
    </header>

    <div class="mx-auto max-w-6xl px-4 py-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <div class="h-9 w-9 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" />
        <p class="mt-3 text-sm">加载中…</p>
      </div>

      <div v-else-if="list.length === 0" class="manage-page__empty rounded-3xl border border-dashed border-pink-200/80 bg-white/70 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800/60">
        <div class="text-5xl">📋</div>
        <p class="mt-4 text-base font-medium text-gray-800 dark:text-gray-100">暂无状态流水线</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">点击下方按钮添加第一条记录</p>
        <button
          type="button"
          class="manage-page__add-btn mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25"
          @click="openAdd($event)"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          新增状态流水线
        </button>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="item in list"
          :key="item.pipe_id"
          class="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-md backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/85"
        >
          <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1 space-y-1.5 text-sm text-gray-700 dark:text-gray-200">
                <div v-if="item.start_time" class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">开始</span>
                  <span>{{ dayjs(item.start_time).format('YYYY-MM-DD') }}</span>
                </div>
                <div v-if="item.end_time" class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">结束</span>
                  <span>{{ dayjs(item.end_time).format('YYYY-MM-DD') }}</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="shrink-0 text-xs text-gray-400">状态</span>
                  <span class="font-medium text-pink-600 dark:text-pink-300">{{ formatPipeState(item.state) }}</span>
                </div>
                <div v-if="item.note" class="flex items-start gap-2">
                  <span class="shrink-0 text-xs text-gray-400">备注</span>
                  <span class="break-words">{{ item.note }}</span>
                </div>
                <div v-if="item.library_list?.length" class="flex flex-wrap items-center gap-1.5 pt-1">
                  <span class="text-xs text-gray-400">版型</span>
                  <QhxTag v-for="child in item.library_list" :key="child.library_id" :active="true">
                    {{ child.name }} {{ child.library_type }}
                  </QhxTag>
                </div>
              </div>

              <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  @click="openEdit(item)"
                >
                  <UIcon name="i-heroicons-pencil-square" class="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  @click="openDelete(item)"
                >
                  <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div
      v-if="!loading"
      class="manage-page__footer fixed inset-x-0 bottom-0 z-40 border-t border-pink-100/80 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95"
      :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }"
    >
      <div class="mx-auto max-w-6xl">
        <button
          type="button"
          class="manage-page__add-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition active:scale-[0.99]"
          @click="openAdd($event)"
        >
          <UIcon name="i-heroicons-plus-circle" class="h-5 w-5" />
          新增状态流水线
        </button>
      </div>
    </div>

    <QhxModal v-model="deleteModalOpen" :close-on-backdrop="false">
      <div class="w-[95vw] max-w-md overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-xl dark:border-gray-700/50 dark:bg-gray-800">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="text-base font-semibold text-gray-800 dark:text-gray-100">操作确认</div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="deleteModalOpen = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div class="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">确定要删除该状态流水线吗？</div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            class="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300"
            @click="deleteModalOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-full bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
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
</template>

<style scoped>
.manage-page__add-btn {
  background: linear-gradient(135deg, #ff9eb5 0%, #a855f7 100%);
}

.manage-page__add-btn:hover {
  filter: brightness(1.05);
}
</style>
