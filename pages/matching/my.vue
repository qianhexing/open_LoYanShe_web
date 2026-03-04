<script setup lang="ts">
import {
  getMatchingListList,
  getMatchingDetail,
  deleteMatchingList,
  type MatchingListItem
} from '@/api/matching_list'
import type { WardrobeClothes } from '@/types/api'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import { BASE_IMG } from '@/utils/ipConfig'
// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any
const userStore = useUserStore()
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const toast = useToast()
const keyword = ref('')
const value = ref('')
const list = ref<MatchingListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
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
  fetchData()
})

definePageMeta({
  name: 'matching-my',
  ssr: false
})

// 搜索
const handleSearch = () => {
  page.value = 1
  fetchData()
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

// 获取数据
const fetchData = async () => {
  if (!userStore.user?.user_id) return
  loading.value = true
  try {
    const params: Parameters<typeof getMatchingListList>[0] = {
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || '',
      filter_list: filterList.value.length ? (filterList.value as unknown as Record<string, unknown>) : undefined
    }
    const res = await getMatchingListList(params)
    if (page.value === 1) {
      list.value = res.rows ?? []
    } else {
      list.value = [...list.value, ...(res.rows ?? [])]
    }
    total.value = res.count ?? 0
  } catch {
    toast.add({ title: '加载失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  if (loading.value || page.value >= Math.ceil(total.value / pageSize)) return
  page.value += 1
  fetchData()
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
    const idx = list.value.findIndex((t) => t.matching_id === item.matching_id)
    if (idx >= 0) list.value.splice(idx, 1)
    total.value = Math.max(0, total.value - 1)
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    showDeleteModal.value = false
    deletingItem.value = null
  }
}

// 编辑成功回调
const onEditSuccess = () => {
  page.value = 1
  fetchData()
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

    <!-- 列表：一排一个搭配 -->
    <div v-else class="space-y-4">
      <div
        v-for="item in list"
        :key="item.matching_id"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"
      >
        <!-- 搭配头部：封面 + 标题 + 操作按钮 -->
        <div class="flex gap-4 p-4">
          <!-- 封面缩略图 -->
          <div
            class="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
            @click="jumpToMatchingDetail(item)"
          >
            <img
              v-if="item.cover"
              :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_160`"
              :alt="item.note || '搭配'"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <div
              v-else-if="getClothesDisplayList(item).length > 0"
              class="w-full h-full flex items-center justify-center"
            >
              <img
                :src="`${BASE_IMG}${getClothesDisplayList(item)[0].clothes_img}?x-oss-process=image/quality,q_80/resize,w_160`"
                alt=""
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <UIcon name="material-symbols:style" class="text-3xl" />
            </div>
          </div>

          <!-- 标题 + 风格 + 操作 -->
          <div class="flex-1 min-w-0">
            <div
              class="text-base font-medium text-gray-800 dark:text-gray-200 cursor-pointer hover:text-qhx-primary"
              @click="jumpToMatchingDetail(item)"
            >
              {{ item.note || '未命名搭配' }}
            </div>
            <div
              v-if="item.main_style"
              class="text-xs text-red-500 mt-1 line-clamp-1"
            >
              ★ {{ item.main_style }}
            </div>
            <div class="flex gap-2 mt-3">
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

        <!-- 服饰列表：flex 一排 5 个 -->
        <div
          v-if="getClothesDisplayList(item).length > 0"
          class="px-4 pb-4"
        >
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="(c, idx) in getClothesDisplayList(item)"
              :key="idx"
              class="relative w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer"
              style="aspect-ratio: 1 / 1"
              @click="jumpToMatchingDetail(item)"
            >
              <img
                :src="`${BASE_IMG}${c.clothes_img}?x-oss-process=image/quality,q_80/resize,w_200`"
                alt=""
                class="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <QhxLoading
        :loading="loading"
        :page="page"
        :total="total"
        :page-size="pageSize"
        @load-more="loadMore"
      />
    </div>

    <!-- 空状态 -->
    <div
      v-if="!loading && list.length === 0 && userStore.user?.user_id"
      class="py-12 text-center text-gray-500 dark:text-gray-400"
    >
      <UIcon name="material-symbols:style" class="text-4xl mb-3" />
      <p>暂无搭配，去衣柜创建吧</p>
    </div>
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
