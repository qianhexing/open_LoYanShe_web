<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Library, LibraryVideo } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { deleteLibraryVideo, getLibraryDetail, getLibraryVideo, sortLibraryVideo } from '@/api/library'
import type LibraryVideoAddEdit from '@/components/library/LibraryVideoAddEdit.vue'
import type LibraryVideoLaxianEditor from '@/components/library/LibraryVideoLaxianEditor.vue'

definePageMeta({
  name: 'library-manage',
  ssr: false
})

const toast = useToast()
const route = useRoute()
const router = useRouter()
const configStore = useConfigStore()
const { setLayoutStyle } = useLayoutStyle()

const isMobile = computed(() => configStore.isMobile)

const pkId = computed(() => Number.parseInt(route.params.id as string))

const loading = ref(false)
const library = ref<Library | null>(null)
const list = ref<LibraryVideo[]>([])

const addEditRef = ref<InstanceType<typeof LibraryVideoAddEdit> | null>(null)
const laxianEditorRef = ref<InstanceType<typeof LibraryVideoLaxianEditor> | null>(null)

const deleteModalOpen = ref(false)
const deleteLoading = ref(false)
const deleteItem = ref<LibraryVideo | null>(null)

const headerTop = computed(() => `${configStore.statusBarHeight || 0}px`)

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
    list.value = await getLibraryVideo({ pk_id: pkId.value })
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

const openAdd = (e?: MouseEvent) => {
  addEditRef.value?.showModel(e)
}
const openEdit = (item: LibraryVideo, e?: MouseEvent) => {
  addEditRef.value?.editModel(item, e)
}

const openLaxianEditor = (item: LibraryVideo, e?: MouseEvent) => {
  laxianEditorRef.value?.openEditor(item, e)
}

const laxianCountOf = (item: LibraryVideo) => {
  const list = item.json_data?.laxian_list
  return Array.isArray(list) ? list.length : 0
}

const openDelete = (item: LibraryVideo) => {
  deleteItem.value = item
  deleteModalOpen.value = true
}

const confirmDelete = async () => {
  if (!deleteItem.value?.video_id) return
  if (deleteLoading.value) return
  deleteLoading.value = true
  try {
    await deleteLibraryVideo({ video_id: deleteItem.value.video_id })
    toast.add({ title: '删除成功', color: 'green' })
    deleteModalOpen.value = false
    deleteItem.value = null
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

const canMoveUp = (index: number) => index > 0
const canMoveDown = (index: number) => index < list.value.length - 1

const changeSort = async (index: number, delta: -1 | 1) => {
  if (!pkId.value || Number.isNaN(pkId.value)) return
  if (delta === -1 && !canMoveUp(index)) return
  if (delta === 1 && !canMoveDown(index)) return

  const sort = list.value.map((item, i) => {
    let nextSort = i
    if (i === index) nextSort = i + delta
    if (i === index + delta) nextSort = i - delta
    return { video_id: item.video_id as number, sort: nextSort }
  })

  loading.value = true
  try {
    await sortLibraryVideo({ pk_id: pkId.value, sort })
    await fetchList()
  } finally {
    loading.value = false
  }
}

const imagesOf = (item: LibraryVideo) => {
  return (item.addr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
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
            管理人台图
          </h1>
          <p v-if="library?.name" class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ library.name }}
          </p>
        </div>

        <span
          class="shrink-0 rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-600 dark:bg-pink-900/40 dark:text-pink-300"
        >
          共 {{ list.length }} 组
        </span>
      </div>
    </header>

    <div class="mx-auto max-w-6xl px-4 py-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <div class="h-9 w-9 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" />
        <p class="mt-3 text-sm">加载中…</p>
      </div>

      <div v-else-if="list.length === 0" class="manage-page__empty rounded-3xl border border-dashed border-pink-200/80 bg-white/70 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800/60">
        <div class="text-5xl">👗</div>
        <p class="mt-4 text-base font-medium text-gray-800 dark:text-gray-100">暂无人台图组</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">点击下方按钮添加第一组人台图</p>
        <button
          type="button"
          class="manage-page__add-btn mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25"
          @click="openAdd($event)"
        >
          <UIcon name="i-heroicons-plus" class="h-4 w-4" />
          添加人台图组
        </button>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="(item, index) in list"
          :key="item.video_id || index"
          class="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-md backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/85"
        >
          <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="truncate font-semibold text-gray-900 dark:text-gray-100">
                  {{ item.title || '暂无标题' }}
                </div>
                <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  共 {{ imagesOf(item).length }} 张 · 排序 {{ index + 1 }}
                  <span v-if="laxianCountOf(item) > 0"> · {{ laxianCountOf(item) }} 个标点</span>
                </div>
              </div>

              <div v-if="!isMobile" class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:opacity-40"
                  :disabled="!canMoveUp(index)"
                  aria-label="上移"
                  @click="changeSort(index, -1)"
                >
                  <UIcon name="i-heroicons-arrow-up" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:opacity-40"
                  :disabled="!canMoveDown(index)"
                  aria-label="下移"
                  @click="changeSort(index, 1)"
                >
                  <UIcon name="i-heroicons-arrow-down" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                  @click="openLaxianEditor(item, $event)"
                >
                  <UIcon name="i-heroicons-map-pin" class="h-3.5 w-3.5" />
                  标点
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  @click="openEdit(item, $event)"
                >
                  <UIcon name="i-heroicons-pencil-square" class="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  @click="openDelete(item)"
                >
                  <UIcon name="i-heroicons-trash" class="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>

            <!-- 手机端：排序 + 主操作分行，更大触控区域 -->
            <div v-if="isMobile" class="mt-3 flex flex-col gap-2">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition active:scale-[0.99] dark:bg-purple-700"
                @click="openLaxianEditor(item, $event)"
              >
                <UIcon name="i-heroicons-map-pin" class="h-4 w-4" />
                编辑标点
                <span v-if="laxianCountOf(item) > 0" class="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {{ laxianCountOf(item) }}
                </span>
              </button>
              <div class="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  class="inline-flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-50 py-2.5 text-blue-700 transition active:scale-[0.98] disabled:opacity-40 dark:bg-blue-900/25 dark:text-blue-300"
                  :disabled="!canMoveUp(index)"
                  aria-label="上移"
                  @click="changeSort(index, -1)"
                >
                  <UIcon name="i-heroicons-arrow-up" class="h-4 w-4" />
                  <span class="text-[10px]">上移</span>
                </button>
                <button
                  type="button"
                  class="inline-flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-50 py-2.5 text-blue-700 transition active:scale-[0.98] disabled:opacity-40 dark:bg-blue-900/25 dark:text-blue-300"
                  :disabled="!canMoveDown(index)"
                  aria-label="下移"
                  @click="changeSort(index, 1)"
                >
                  <UIcon name="i-heroicons-arrow-down" class="h-4 w-4" />
                  <span class="text-[10px]">下移</span>
                </button>
                <button
                  type="button"
                  class="inline-flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-100 py-2.5 text-gray-700 transition active:scale-[0.98] dark:bg-gray-700 dark:text-gray-100"
                  @click="openEdit(item, $event)"
                >
                  <UIcon name="i-heroicons-pencil-square" class="h-4 w-4" />
                  <span class="text-[10px]">编辑</span>
                </button>
                <button
                  type="button"
                  class="inline-flex flex-col items-center justify-center gap-0.5 rounded-xl bg-red-50 py-2.5 text-red-600 transition active:scale-[0.98] dark:bg-red-900/25 dark:text-red-300"
                  @click="openDelete(item)"
                >
                  <UIcon name="i-heroicons-trash" class="h-4 w-4" />
                  <span class="text-[10px]">删除</span>
                </button>
              </div>
            </div>
          </div>

          <div class="p-4">
            <div v-if="(item.pk_type ?? 0) === 0">
              <div class="overflow-x-auto pb-1">
                <div class="flex w-max gap-3">
                  <div
                    v-for="(image, imgIndex) in imagesOf(item)"
                    :key="`${item.video_id || index}_${imgIndex}`"
                    class="h-[110px] w-[110px] overflow-hidden rounded-xl border-2 border-pink-200/70 bg-gray-100 dark:border-pink-800/50 dark:bg-gray-700/30"
                  >
                    <img
                      class="pointer-events-none h-full w-full select-none object-cover"
                      :src="`${BASE_IMG}${image}?x-oss-process=image/quality,q_80/resize,w_200,h_200`"
                      loading="lazy"
                      alt=""
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500 dark:text-gray-400">
              视频暂时不支持网页端编辑
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
          添加人台图组
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
        <div class="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">
          确定要删除该人台图组吗？
        </div>
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

    <LibraryVideoAddEdit ref="addEditRef" :pk-id="pkId" :pk-type="0" @success="fetchList" />
    <LibraryVideoLaxianEditor ref="laxianEditorRef" @saved="fetchList" />
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
