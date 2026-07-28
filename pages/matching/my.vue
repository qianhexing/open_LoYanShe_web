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
/** WebView 经 layouts/default 的 ?statusbar= 注入，与 wardrobe/detail、statistics 主栏一致 */
const statusBarPx = computed(() => (configStore.statusBarHeight > 0 ? `${configStore.statusBarHeight}px` : '0px'))
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
      url: `/pages/common/outerLink2?url=https://lolitalibrary.com/matching/detail/${item.matching_id}`
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
      main_style: detail.main_style,
      season: detail.season
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
  <div class="matching-my matching-my-safe relative min-h-[100dvh] w-full overflow-x-hidden">
    <!-- WebView 状态栏占位：layouts/default 中 ?statusbar= -->
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

    <header
      class="matching-header sticky z-20"
      :style="{ top: statusBarPx }"
    >
      <div class="relative mx-auto flex max-w-4xl flex-col gap-1 px-3 py-4 sm:px-4">
        <h1 class="matching-hero-title">我的搭配</h1>
        <p class="text-xs leading-relaxed text-[#9a858a]">
          管理你在衣柜中保存的 Lolita 搭配
        </p>
        <div class="matching-search mt-3 w-full rounded-xl px-2 py-1.5">
          <div class="flex min-h-[2.5rem] items-center gap-2">
            <UInput
              v-model="value"
              placeholder="搜索搭配名称或备注…"
              class="min-w-0 flex-1"
              :autofocus="false"
              @keyup.enter="handleSearch"
              :ui="{
                base: 'bg-transparent ring-0 focus:ring-0 border-0 shadow-none text-[#4f3f43] placeholder:text-[#9a858a]',
                rounded: 'rounded-lg',
                padding: { xs: 'px-2 py-2' },
                color: {
                  white: {
                    outline: 'bg-transparent'
                  }
                }
              }"
            />
            <button
              type="button"
              class="matching-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-qhx-primary outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-qhx-primary/45"
              aria-label="搜索"
              @click="handleSearch"
            >
              <UIcon name="i-heroicons-magnifying-glass-20-solid" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="relative mx-auto max-w-4xl px-3 pt-5 sm:px-4">
      <!-- 未登录提示 -->
      <div
        v-if="!userStore.user?.user_id"
        class="matching-empty flex flex-col items-center justify-center gap-3 rounded-[1.35rem] py-14 text-center"
      >
        <span class="matching-empty-icon flex h-14 w-14 items-center justify-center rounded-2xl text-qhx-primary">
          <UIcon name="material-symbols:login" class="text-3xl" />
        </span>
        <p class="px-4 text-sm text-[#9a858a]">
          请先登录后查看我的搭配
        </p>
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
            class="matching-card group mx-1 mb-3 cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
            @click="jumpToMatchingDetail(item)"
          >
            <div
              class="matching-thumb m-2 overflow-hidden rounded-2xl"
              style="aspect-ratio: 1 / 1"
            >
              <img
                v-if="item.cover"
                :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200`"
                :alt="item.note || '搭配'"
                class="h-full w-full object-cover"
                loading="lazy"
                @load="debouncedApplyLayout"
              />
              <img
                v-else-if="getClothesDisplayList(item).length > 0"
                :src="`${BASE_IMG}${getClothesDisplayList(item)[0].clothes_img}?x-oss-process=image/quality,q_80/resize,w_200`"
                alt=""
                class="h-full w-full object-cover"
                loading="lazy"
                @load="debouncedApplyLayout"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-[#9a858a]"
              >
                <UIcon name="material-symbols:style" class="text-3xl" />
              </div>
            </div>
            <div class="px-3 pb-3 pt-0.5">
              <div class="line-clamp-1 text-sm font-medium text-[#4f3f43]">
                {{ item.note || '未命名搭配' }}
              </div>
              <div
                v-if="item.main_style"
                class="mt-0.5 line-clamp-1 text-xs text-qhx-primary"
              >
                ★ {{ item.main_style }}
              </div>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="matching-action inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#4f3f43] outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-qhx-primary/45"
                  @click.stop="handleEdit(item)"
                >
                  <UIcon name="i-heroicons-pencil-square-20-solid" class="h-3.5 w-3.5" />
                  修改
                </button>
                <button
                  type="button"
                  class="matching-action matching-action--danger inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#e05353] outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-400/50"
                  @click.stop="openDeleteModal(item)"
                >
                  <UIcon name="i-heroicons-trash-20-solid" class="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          </div>
        </template>
        <template #empty>
          <div class="matching-empty flex flex-col items-center justify-center gap-3 rounded-[1.35rem] py-14 text-center">
            <span class="matching-empty-icon flex h-14 w-14 items-center justify-center rounded-2xl text-qhx-primary">
              <UIcon name="material-symbols:style" class="text-3xl" />
            </span>
            <p class="px-4 text-sm text-[#9a858a]">
              暂无搭配，去衣柜创建吧
            </p>
          </div>
        </template>
      </QhxWaterList>
    </main>
  </div>

  <!-- 编辑弹窗 -->
  <MatchingAddEdit ref="matchingAddEditRef" @success="onEditSuccess" />

  <!-- 删除确认弹窗 -->
  <UModal v-model="showDeleteModal" title="操作确认" :ui="{ width: 'max-w-md' }">
    <div class="matching-delete-modal rounded-2xl p-6">
      <p class="mb-5 text-sm leading-relaxed text-[#4f3f43]">
        确定要删除该搭配吗？删除后将无法恢复。
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="matching-action rounded-xl px-4 py-2 text-sm font-medium text-[#4f3f43] outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-qhx-primary/45"
          @click="showDeleteModal = false"
        >
          取消
        </button>
        <button
          type="button"
          class="matching-action matching-action--danger rounded-xl px-4 py-2 text-sm font-medium text-[#e05353] outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-red-400/45"
          @click="confirmDelete"
        >
          确定删除
        </button>
      </div>
    </div>
  </UModal>
</template>

<style scoped>
.matching-my {
  color: #4f3f43;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, color-mix(in srgb, var(--primary-color) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 70% 40% at 100% 0%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 50%),
    linear-gradient(180deg, #fff9fb 0%, #fff5f8 45%, #fff2f6 100%);
}

.matching-my-safe {
  padding-bottom: max(6rem, calc(6rem + env(safe-area-inset-bottom, 0px)));
}

.matching-header {
  background: color-mix(in srgb, #fff9fb 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.matching-hero-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.7rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.matching-search {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-icon-btn {
  background: color-mix(in srgb, var(--primary-color) 14%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.matching-card {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 1.35rem;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.matching-card:hover {
  border-color: color-mix(in srgb, var(--primary-color) 36%, transparent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.matching-thumb {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.matching-action {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-action:hover {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
}

.matching-action--danger {
  border-color: color-mix(in srgb, #e05353 28%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, #e05353 10%, transparent);
}

.matching-action--danger:hover {
  background: color-mix(in srgb, #e05353 8%, white);
}

.matching-empty {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.matching-empty-icon {
  background: color-mix(in srgb, var(--primary-color) 14%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.matching-delete-modal {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
