<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LibraryVideo } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { deleteLibraryVideo, getLibraryVideo, sortLibraryVideo } from '@/api/library'
import type LibraryVideoAddEdit from '@/components/library/LibraryVideoAddEdit.vue'

definePageMeta({
  name: 'library-manage',
  ssr: false
})

const toast = useToast()
const route = useRoute()
const router = useRouter()

const pkId = computed(() => Number.parseInt(route.params.id as string))

const loading = ref(false)
const list = ref<LibraryVideo[]>([])

const addEditRef = ref<InstanceType<typeof LibraryVideoAddEdit> | null>(null)

const deleteModalOpen = ref(false)
const deleteLoading = ref(false)
const deleteItem = ref<LibraryVideo | null>(null)

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

onMounted(() => {
  fetchList()
})

const openAdd = (e?: MouseEvent) => {
  addEditRef.value?.showModel(e)
}
const openEdit = (item: LibraryVideo, e?: MouseEvent) => {
  addEditRef.value?.editModel(item, e)
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

  // 生成新的 sort 列表（后端一般需要全量）
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
  <div class="container mx-auto max-w-6xl px-4 py-4">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2">
        <div class="text-lg font-semibold">管理人台图</div>
      </div>

      <UButton
        class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
        icon="i-heroicons-plus"
        @click="openAdd($event)"
      >
        添加人台图组
      </UButton>
    </div>

    <div v-if="loading" class="py-10 text-center text-gray-500">加载中...</div>

    <div v-else class="space-y-4">
      <div
        v-for="(item, index) in list"
        :key="item.video_id || index"
        class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
      >
        <!-- 标题 & 操作 -->
        <div class="flex items-start justify-between gap-3 px-4 py-3 bg-gray-50/60 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
          <div class="min-w-0 flex-1">
            <div class="font-semibold truncate">
              {{ item.title || '暂无标题' }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              共 {{ imagesOf(item).length }} 张
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UButton
              size="xs"
              color="blue"
              variant="solid"
              icon="i-heroicons-arrow-up"
              :disabled="!canMoveUp(index)"
              @click="changeSort(index, -1)"
            />
            <UButton
              size="xs"
              color="blue"
              variant="solid"
              icon="i-heroicons-arrow-down"
              :disabled="!canMoveDown(index)"
              @click="changeSort(index, 1)"
            />
            <UButton
              size="xs"
              color="gray"
              variant="solid"
              icon="i-heroicons-pencil-square"
              @click="openEdit(item, $event)"
            >
              编辑
            </UButton>
            <UButton
              size="xs"
              color="red"
              variant="solid"
              icon="i-heroicons-trash"
              @click="openDelete(item)"
            >
              删除
            </UButton>
          </div>
        </div>

        <!-- 内容 -->
        <div class="p-4">
          <div v-if="(item.pk_type ?? 0) === 0">
            <div class="overflow-x-auto">
              <div class="flex gap-3 w-max">
                <div
                  v-for="(image, imgIndex) in imagesOf(item)"
                  :key="`${item.video_id || index}_${imgIndex}`"
                  class="w-[110px] h-[110px] rounded-xl border-2 border-qhx-primary/60 overflow-hidden bg-gray-100 dark:bg-gray-700/30"
                >
                  <img
                    class="w-full h-full object-cover pointer-events-none select-none"
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
      </div>

      <div v-if="list.length === 0" class="py-16 text-center text-gray-500">
        暂无数据，先添加一个人台图组吧
      </div>
    </div>

    <!-- 删除确认 -->
    <UModal v-model="deleteModalOpen" :ui="{ width: 'max-w-md' }" prevent-close>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="text-base font-semibold">操作确认</div>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="deleteModalOpen = false" />
          </div>
        </template>
        <div class="text-sm text-gray-700 dark:text-gray-200">
          确定要删除该人台图组吗？
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="deleteModalOpen = false">取消</UButton>
            <UButton color="red" :loading="deleteLoading" @click="confirmDelete">确定删除</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <LibraryVideoAddEdit ref="addEditRef" :pk-id="pkId" :pk-type="0" @success="fetchList" />
  </div>
</template>


