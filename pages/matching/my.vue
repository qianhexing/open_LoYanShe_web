<script setup lang="ts">
import {
  getMatchingListList,
  getMatchingDetail,
  deleteMatchingList,
  type MatchingListItem
} from '@/api/matching_list'
import type { WardrobeClothes } from '@/types/api'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import { BASE_IMG } from '@/utils/ipConfig'
// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any
const layoutReady = inject('layoutReady') as Ref<boolean>
const userStore = useUserStore()
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const toast = useToast()
const keyword = ref('')
const value = ref('')
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const pageSize = 10
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEdit> | null>(null)
const showDeleteModal = ref(false)
const deletingItem = ref<MatchingListItem | null>(null)

// SEO 配置
useHead({
  title: '我的搭配',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,搭配,Lolita搭配,我的搭配'
    },
    {
      name: 'description',
      content: '查看我的所有Lolita搭配'
    }
  ]
})

// 我的搭配筛选：仅当前用户
const filterList = computed(() => {
  const uid = userStore.user?.user_id
  if (!uid) return []
  return [{ field: 'user_id', op: 'eq', value: uid }]
})

onMounted(async () => {
  // @ts-ignore - uni-webview-js 类型声明缺失
  uni = await import('@dcloudio/uni-webview-js').catch((err: unknown) => {
    console.error('Failed to load uni-webview-js:', err)
  })
})

definePageMeta({
  name: 'matching-my',
  ssr: false
})

// 搜索
const handleSearch = () => {
  keyword.value = value.value.trim()
  waterList.value?.refresh()
}

// 获取服饰列表（合并 clothes_list 和 library_list）
const getClothesDisplayList = (item: MatchingListItem) => {
  const result: Array<{ clothes_img: string }> = []
  if (item.clothes_list?.length) {
    result.push(...item.clothes_list)
  }
  if (item.library_list?.length) {
    for (const lib of item.library_list) {
      const img = lib.cover ?? lib.square_cover
      if (img) result.push({ clothes_img: img })
    }
  }
  if (result.length === 0 && item.cover) {
    result.push({ clothes_img: item.cover })
  }
  return result
}

// 获取搭配数据（供 QhxWaterList 使用）
const fetchMatchingData = async (page: number, pageSize: number) => {
  if (!userStore.user?.user_id) {
    return { rows: [], count: 0 }
  }
  try {
    const params: Parameters<typeof getMatchingListList>[0] = {
      page,
      pageSize,
      keyword: keyword.value.trim() || '',
      filter_list: filterList.value.length ? (filterList.value as unknown as Record<string, unknown>) : undefined
    }
    const res = await getMatchingListList(params)
    return {
      rows: res.rows ?? [],
      count: res.count ?? 0
    }
  } catch {
    toast.add({ title: '加载失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return { rows: [], count: 0 }
  }
}

// 跳转到搭配详情
const jumpToMatchingDetail = (item: MatchingListItem) => {
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  if (!item.matching_id) return
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/wardrobe/matchingDetail?id=${item.matching_id}`
    })
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: `https://lolitalibrary.com/matching/detail/${item.matching_id}` }
      }))
    } else {
      window.open(`/matching/detail/${item.matching_id}`, '_blank')
    }
  }
}

// 编辑搭配：获取详情后打开编辑弹窗
const handleEdit = async (item: MatchingListItem) => {
  if (!item.matching_id) return
  try {
    const detail = await getMatchingDetail({ matching_id: item.matching_id })
    const clothesList: WardrobeClothes[] = []
    if (detail.clothes_list?.length) {
      for (const c of detail.clothes_list) {
        const wc = c as Record<string, unknown>
        const clothesId = wc.clothes_id
        if (typeof clothesId === 'number') {
          clothesList.push({
            clothes_id: clothesId,
            clothes_img: String(wc.clothes_img ?? ''),
            clothes_note: (wc.clothes_note as string) ?? undefined
          })
        }
      }
    }
    if (detail.library_list?.length) {
      for (const lib of detail.library_list) {
        const l = lib as Record<string, unknown>
        const libId = l.library_id
        if (typeof libId === 'number') {
          clothesList.push({
            library_id: libId,
            clothes_img: String(l.cover ?? l.square_cover ?? ''),
            clothes_note: (l.name as string) ?? undefined
          } as WardrobeClothes)
        }
      }
    }
    matchingAddEditRef.value?.showModel(clothesList, {
      matching_id: detail.matching_id,
      note: detail.note,
      cover: detail.cover,
      appointment_time: detail.appointment_time as string | undefined,
      is_private: (detail as Record<string, unknown>).is_private as number | undefined,
      open_community: (detail as Record<string, unknown>).open_community as number | undefined,
      open_tags: (detail as Record<string, unknown>).open_tags as number | undefined,
      main_style: detail.main_style
    })
  } catch {
    toast.add({ title: '获取搭配详情失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

// 打开删除确认
const openDeleteModal = (item: MatchingListItem) => {
  deletingItem.value = item
  showDeleteModal.value = true
}

// 确认删除
const confirmDelete = async () => {
  const item = deletingItem.value
  if (!item?.matching_id) {
    showDeleteModal.value = false
    return
  }
  try {
    await deleteMatchingList({ matching_id: item.matching_id })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    waterList.value?.refresh()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    showDeleteModal.value = false
    deletingItem.value = null
  }
}

// 编辑成功回调
const onEditSuccess = () => {
  waterList.value?.refresh()
}
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden px-4">
    <!-- 页面标题 -->
    <div class="pb-3">
      <h1 class="text-lg font-bold text-gray-800 dark:text-gray-200">我的搭配</h1>
    </div>

    <!-- 搜索框 -->
    <div class="pb-3">
      <div class="w-full flex items-center gap-2">
        <UInput
          v-model="value"
          placeholder="搜索搭配"
          class="flex-1 focus:ring-0"
          :autofocus="false"
          @keyup.enter="handleSearch"
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
        />
        <UButton
          icon="i-heroicons-magnifying-glass"
          variant="ghost"
          color="gray"
          @click="handleSearch"
        />
      </div>
    </div>

    <!-- 未登录提示 -->
    <div
      v-if="!userStore.user?.user_id"
      class="py-12 text-center text-gray-500 dark:text-gray-400"
    >
      <UIcon name="material-symbols:login" class="text-4xl mb-3" />
      <p>请先登录后查看我的搭配</p>
    </div>

    <!-- 瀑布流列表 -->
    <QhxWaterList
      v-else-if="layoutReady"
      ref="waterList"
      :fetch-data="fetchMatchingData"
      :page-size="pageSize"
      :columns="5"
      :item-key="2"
      :columns-768="2"
      :enable-waterfall="true"
      :enable-load-more="true"
    >
      <template #default="{ item, debouncedApplyLayout }">
        <div
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden mx-1 mb-2 cursor-pointer"
          @click="jumpToMatchingDetail(item)"
        >
          <!-- 封面图 -->
          <div
            class="w-full overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-700"
            style="aspect-ratio: 1 / 1"
          >
            <img
              v-if="item.cover"
              :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
              :alt="item.note || '搭配'"
              class="w-full h-full object-cover"
              loading="lazy"
              @load="debouncedApplyLayout"
            />
            <img
              v-else-if="getClothesDisplayList(item).length > 0"
              :src="`${BASE_IMG}${getClothesDisplayList(item)[0].clothes_img}?x-oss-process=image/quality,q_80/resize,w_200`"
              alt=""
              class="w-full h-full object-cover"
              loading="lazy"
              @load="debouncedApplyLayout"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <UIcon name="material-symbols:style" class="text-3xl" />
            </div>
          </div>
          <!-- 标题 + 风格 + 操作 -->
          <div class="p-2">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
              {{ item.note || '未命名搭配' }}
            </div>
            <div
              v-if="item.main_style"
              class="text-xs text-red-500 mt-0.5 line-clamp-1"
            >
              ★ {{ item.main_style }}
            </div>
            <div class="flex gap-2 mt-2">
              <UButton
                size="xs"
                color="gray"
                variant="soft"
                icon="i-heroicons-pencil-square"
                @click.stop="handleEdit(item)"
              >
                修改
              </UButton>
              <UButton
                size="xs"
                color="red"
                variant="soft"
                icon="i-heroicons-trash"
                @click.stop="openDeleteModal(item)"
              >
                删除
              </UButton>
            </div>
          </div>
        </div>
      </template>
      <template #empty>
        <div class="py-12 text-center text-gray-500 dark:text-gray-400">
          <UIcon name="material-symbols:style" class="text-4xl mb-3" />
          <p>暂无搭配，去衣柜创建吧</p>
        </div>
      </template>
    </QhxWaterList>
  </div>

  <!-- 编辑弹窗 -->
  <MatchingAddEdit ref="matchingAddEditRef" @success="onEditSuccess" />

  <!-- 删除确认弹窗 -->
  <UModal v-model="showDeleteModal" title="操作确认">
    <div class="p-6">
      <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除该搭配吗？删除后将无法恢复。</p>
      <div class="flex justify-end gap-2">
        <UButton color="gray" @click="showDeleteModal = false">取消</UButton>
        <UButton color="red" @click="confirmDelete">确定删除</UButton>
      </div>
    </div>
  </UModal>
</template>
