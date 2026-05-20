<script setup lang="ts">
import type { LibrarySimilarItem, Library } from '@/types/api'
import { getWardrobeClothesLibraryIds } from '@/api/wardrobe'
import { getLibrarySimilarBatch } from '@/api/library'
import { insertGood } from '@/api/good'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'

const props = defineProps<{
  /** 当前衣柜 ID；未选衣柜时不要调 open */
  wardrobeId?: number | null
}>()

const user = useUserStore()
const toast = useToast()

const showModal = ref(false)
const loading = ref(false)
const rows = ref<LibrarySimilarItem[]>([])

const favoriteModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)
const libraryTypeColorRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const wardrobeAddRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const collectLibraryId = ref<number | null>(null)

const formatSimilarScore = (score: number) => {
  if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

const open = async () => {
  if (!user.token) {
    toast.add({ title: '请先登录', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  const wid = props.wardrobeId ?? null
  if (wid == null) return
  showModal.value = true
  loading.value = true
  rows.value = []
  try {
    const ids = await getWardrobeClothesLibraryIds({ wardrobe_id: wid })
    if (ids.length === 0) return
    const res = await getLibrarySimilarBatch({ ids, pageSize: 20, need_Statistics: true })
    rows.value = res.rows ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

const onGoodClick = async (data: {
  pk_id: number
  pk_type: number
  type: number
  library_id: number
}) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  try {
    const result = await insertGood({ pk_id: data.pk_id, pk_type: data.pk_type, type: data.type })
    const idx = rows.value.findIndex((r) => r.library_id === data.library_id)
    if (idx !== -1) {
      const cur = rows.value[idx]
      rows.value[idx] = {
        ...cur,
        is_good: result ? 1 : 0,
        good_count: result ? (cur.good_count || 0) + 1 : Math.max((cur.good_count || 0) - 1, 0),
      }
    }
    toast.add({
      title: result ? '点赞成功' : '已取消点赞',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } catch {
    toast.add({ title: '操作失败', icon: 'i-heroicons-x-circle', color: 'red' })
  }
}

const onCollectClick = (
  data: { pk_id: number; collect_type: number; library_id: number },
  event?: MouseEvent,
) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  collectLibraryId.value = data.library_id
  const clickEvent =
    event ?? new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 })
  favoriteModalRef.value?.showModel({ pk_id: data.pk_id, collect_type: data.collect_type }, clickEvent)
}

const onCollectChange = (result: boolean) => {
  const lid = collectLibraryId.value
  collectLibraryId.value = null
  if (lid == null) return
  const idx = rows.value.findIndex((r) => r.library_id === lid)
  if (idx === -1) return
  const cur = rows.value[idx]
  if (result) {
    toast.add({ title: '收藏成功', icon: 'i-heroicons-check-circle', color: 'green' })
    rows.value[idx] = {
      ...cur,
      is_collect: 1,
      collect_count: (cur.collect_count || 0) + 1,
    }
  } else {
    toast.add({ title: '取消收藏', icon: 'i-heroicons-x-circle', color: 'red' })
    rows.value[idx] = {
      ...cur,
      is_collect: 0,
      collect_count: Math.max((cur.collect_count || 0) - 1, 0),
    }
  }
}

const onWardrobeClick = (data: { library: Library }) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  if (!data.library) {
    toast.add({ title: '图鉴信息不存在', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  libraryTypeColorRef.value?.showModel(data.library)
}

const onLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddRef.value?.showModel(data)
}

const onWardrobeAdded = (data?: { library_id?: number }) => {
  toast.add({ title: '加入衣柜成功', icon: 'i-heroicons-check-circle', color: 'green' })
  const lid = data?.library_id
  if (lid == null) return
  const idx = rows.value.findIndex((r) => r.library_id === lid)
  if (idx === -1) return
  const cur = rows.value[idx]
  rows.value[idx] = {
    ...cur,
    is_wardrobe: 1,
    wardrobe_count: (cur.wardrobe_count || 0) + 1,
  }
}

defineExpose({ open })
</script>

<template>
  <QhxModal v-model="showModal">
    <div class="p-6 w-[min(94vw,520px)] max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
      <h3 class="text-base font-bold mb-3 text-gray-800 dark:text-gray-200 shrink-0">根据本衣柜推荐</h3>
      <div v-if="loading" class="text-sm text-gray-500 py-6 text-center">加载中…</div>
      <template v-else>
        <p v-if="rows.length === 0" class="text-sm text-gray-500 py-6 text-center">暂无图鉴或暂无推荐</p>
        <div v-else class="max-h-[58vh] overflow-y-auto space-y-3 pr-1 -mr-0.5">
          <LibraryItem
            v-for="sim in rows"
            :key="sim.library_id"
            :item="sim"
            size="wardrobe-similar"
            :show-actions="true"
            class-name="bg-qhx-bg-card polaroid-card shadow-md p-2 m-0 rounded-xl border border-gray-100 dark:border-gray-700"
            @good-click="onGoodClick"
            @collect-click="onCollectClick"
            @wardrobe-click="onWardrobeClick"
          >
            <template #tagInfo>
              <span
                v-if="sim.similarity_score != null && !Number.isNaN(Number(sim.similarity_score))"
                class="text-[11px] text-qhx-primary font-medium"
              >
                相似 {{ formatSimilarScore(Number(sim.similarity_score)) }}
              </span>
            </template>
          </LibraryItem>
        </div>
      </template>
      <div class="flex justify-end mt-4 shrink-0">
        <UButton color="gray" @click="showModal = false">关闭</UButton>
      </div>
    </div>
  </QhxModal>
  <LibraryTypeColorChoose ref="libraryTypeColorRef" @choose="onLibraryTypeColorChoose" />
  <WardrobeAddLibrary ref="wardrobeAddRef" @change="onWardrobeAdded" />
  <FavoriteOptionsModal ref="favoriteModalRef" @change="onCollectChange" />
</template>
