<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { getMatchingDetail, updateMatchingClothesLastDress, type MatchingListDetail } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import QhxTabs from '@/components/Qhx/Tabs.vue'
import QhxTabPanel from '@/components/Qhx/TabPanel.vue'
import UserInfo from '@/components/user/UserInfo.vue'
import UserGoodBtn from '@/components/user/GoodBtn.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'
import type { MatchingSharePayload } from '@/components/matching/MatchingShareImage.vue'
import type { Library, Shop, User } from '~/types/api'
import {
  openLibraryDetailTab,
  openUserSpaceTab,
} from '@/composables/useLibraryDetailNavigation'
import { navigateBackInShell } from '@/utils/nativeShell'

const LibraryList = defineAsyncComponent(
  () => import('@/components/library/LibraryList.vue'),
)
const CommentSection = defineAsyncComponent(
  () => import('@/components/comment/CommentSection.vue'),
)
const CommunityForeignList = defineAsyncComponent(
  () => import('@/components/community/CommunityForeignList.vue'),
)
const MatchingShareImage = defineAsyncComponent(
  () => import('@/components/matching/MatchingShareImage.vue'),
)

let uni: any
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const port = computed(() => configStore.getPort())
const isMobile = computed(() => configStore.isMobile)
const matchingBackBtnStyle = computed(() => ({
  top:
    configStore.statusBarHeight > 0
      ? `${configStore.statusBarHeight + 10}px`
      : 'calc(0.5rem + env(safe-area-inset-top, 0px))',
  left: isMobile.value ? '8px' : '12px',
}))

/** 返回：UniApp navigateBack / 鸿蒙·iOS port / 浏览器 history，无历史时回搭配列表 */
function goBack() {
  if (navigateBackInShell()) return

  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }

  void navigateTo('/matching')
}

// 禁用 SSR
definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const id = route.params.id as string
const matchingId = Number.parseInt(id, 10)

// 衣服项类型
interface ClothesItem {
  clothes_img: string
  color?: string
  price?: string
  clothes_note?: string
  library?: Library
  origin_shop?: Shop
  origin?: string
}

// 扩展的详情数据类型
interface ExtendedMatchingDetail extends MatchingListDetail {
  main_clothes_item?: ClothesItem
  list?: ClothesItem[]
  clothes_list?: ClothesItem[]
  clothes_id?: string | number | null
  user?: User
  appointment_time?: string | Date
  is_private?: number
  open_tags?: number
  open_community?: number
  user_id?: number
  activity_list?: Array<{ activity_id: number; activity?: { activity_title: string; activity_cover?: string } }>
  file?: {
    width: number
    height: number
  }
  is_good?: boolean
  is_collect?: boolean
  good_count?: number
  collect_count?: number
}

// 详情数据
const detail = ref<ExtendedMatchingDetail | null>(null)
const isLoading = ref(true)

/** 与服饰详情一致：主图右侧全部为方形小图（list + clothes_list 合并展示，不再按高度拆分） */
const matchingSideItems = computed((): ClothesItem[] => {
  const d = detail.value
  if (!d) return []
  return [...(d.list ?? []), ...(d.clothes_list ?? [])]
})

function sideItemCaption(item: ClothesItem): string {
  return item.clothes_note || (item.library ? item.library.name : '') || ''
}

function sideItemShopLine(item: ClothesItem): string {
  if (item.library) {
    return item.library.shop ? item.library.shop.shop_name : item.library.name
  }
  if (item.origin_shop) return item.origin_shop.shop_name
  if (item.origin) return `来源：${item.origin}`
  return ''
}

/** 隐藏备注、价格、店铺、状态与颜色；标题保留。同时作用于页面和分享图 */
const hideShareText = ref(false)

const matchingSharePayload = computed((): MatchingSharePayload | null => {
  const d = detail.value
  if (!d) return null
  const side = matchingSideItems.value
  let mainPath = ''
  if (d.cover) mainPath = d.cover
  else if (d.main_clothes_item?.clothes_img) mainPath = d.main_clothes_item.clothes_img
  else if (side.length > 0) mainPath = side[0].clothes_img
  if (!mainPath) return null

  const sideForShare =
    !d.cover && !d.main_clothes_item && side.length > 0 ? side.slice(1) : side

  return {
    note: d.note?.trim() || '',
    matchingId: d.matching_id,
    userName: d.user?.user_name || d.user_name || '',
    mainStyle: d.main_style,
    mainImagePath: mainPath,
    /** 与图区 HTML 一致：有封面/主单品 → 左 2/3 主图 + 右 1/3 方附图；否则全宽 3 列方格 */
    shareLayout: d.cover || d.main_clothes_item ? 'floatMain' : 'gridOnly',
    tags:
      d.tags_list?.flatMap((t) =>
        typeof t === 'object' && t !== null && 'tags_name' in t
          ? [String((t as { tags_name: string }).tags_name)]
          : [],
      ) ?? [],
    mainItemPrice: d.main_clothes_item?.price,
    mainItemCaption: d.main_clothes_item
      ? sideItemCaption(d.main_clothes_item)
      : undefined,
    mainItemShopLine: d.main_clothes_item
      ? sideItemShopLine(d.main_clothes_item)
      : undefined,
    mainItemColors: d.main_clothes_item?.color,
    hideText: hideShareText.value,
    sideItems: sideForShare.map((it) => ({
      clothes_img: it.clothes_img,
      caption: sideItemCaption(it),
      price: it.price,
      color: it.color,
      shopLine: sideItemShopLine(it),
      libraryState:
        it.library?.state !== undefined && it.library?.state !== null
          ? String(it.library.state)
          : undefined,
    })),
  }
})

const { t } = useI18n()

// 标签页
const currentTab = ref(0)
const tabs = computed(() => ['搭配详情', t('comment.section'), '搭配返图'])

// 弹窗状态
const showActivityModal = ref(false)
const showAddCommunity = ref(false)
const showChooseCommunity = ref(false)
interface CommunityItem {
  community_id: number
  [key: string]: unknown
}

const chooseCommunity = ref<CommunityItem | null>(null)
const loading = ref(false)
const toast = useToast()

const isMatchingOwner = computed(() => {
  const uid = user.user?.user_id
  const ownerId = detail.value?.user_id ?? detail.value?.user?.user_id
  return uid != null && ownerId != null && Number(uid) === Number(ownerId)
})

const hasMatchingClothes = computed(() => {
  const raw = detail.value?.clothes_id
  if (!raw) return false
  return String(raw).split(',').some((id) => Number(String(id).trim()) > 0)
})

const showLastDressModal = ref(false)
const matchingLastDressValue = ref<string | null>(null)
const matchingLastDressSaving = ref(false)

function pad2Matching(n: number) {
  return String(n).padStart(2, '0')
}
function nowAsMatchingPickerDateTime() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2Matching(d.getMonth() + 1)}-${pad2Matching(d.getDate())} ${pad2Matching(d.getHours())}:${pad2Matching(d.getMinutes())}:${pad2Matching(d.getSeconds())}`
}
function openMatchingLastDressModal() {
  if (!isMatchingOwner.value || !hasMatchingClothes.value) return
  matchingLastDressValue.value = nowAsMatchingPickerDateTime()
  showLastDressModal.value = true
}
async function confirmMatchingLastDress() {
  if (!detail.value?.matching_id || matchingLastDressSaving.value) return
  const last_dress = matchingLastDressValue.value && String(matchingLastDressValue.value).trim()
    ? String(matchingLastDressValue.value).trim()
    : null
  matchingLastDressSaving.value = true
  try {
    const res = await updateMatchingClothesLastDress({
      matching_id: detail.value.matching_id,
      last_dress,
    })
    toast.add({
      title: `已更新 ${res.updated} 件关联服饰穿着时间`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    showLastDressModal.value = false
  } catch (error) {
    console.error('更新搭配穿着时间失败:', error)
    toast.add({ title: '更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    matchingLastDressSaving.value = false
  }
}
async function updateMatchingLastDressNow() {
  if (!detail.value?.matching_id || !isMatchingOwner.value || !hasMatchingClothes.value) return
  matchingLastDressSaving.value = true
  try {
    const res = await updateMatchingClothesLastDress({
      matching_id: detail.value.matching_id,
    })
    toast.add({
      title: `已更新 ${res.updated} 件关联服饰穿着时间`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } catch (error) {
    console.error('更新搭配穿着时间失败:', error)
    toast.add({ title: '更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    matchingLastDressSaving.value = false
  }
}

// 点赞和收藏状态（由组件内部管理，这里保留用于初始化）

// 获取详情数据
const fetchDetail = async () => {
  try {
    isLoading.value = true
    const response = await getMatchingDetail({
      matching_id: matchingId
    })
    
    const data = response
    
    // 处理 library_list
    if (data.library_list && data.library_list.length > 0) {
      if (!data.clothes_list) {
        data.clothes_list = []
      }
      for (const child of data.library_list) {
        const clothesItem: ClothesItem = {
          clothes_img: (child as Record<string, unknown>).cover as string,
          library: child as Library
        }
        data.clothes_list.push(clothesItem)
      }
      data.library_list = undefined
    }
    
    // 处理主衣服
    if (!data.cover && !data.mian_clothes) {
      if (data.clothes_list && data.clothes_list.length > 0) {
        data.main_clothes_item = data.clothes_list[0]
        data.clothes_list.splice(0, 1)
      }
    }
    
    detail.value = data as ExtendedMatchingDetail
  } catch (error) {
    console.error('获取搭配详情失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 预览图片
const previewImage = (urls: string[], index = 0) => {
  // 这里可以实现图片预览功能
  console.log('预览图片', urls, index)
}

// 跳转到用户空间（与 components/user/UserInfo.vue 路径一致）
const jumpToUserSpace = (userId: number) => {
  openUserSpaceTab(userId)
}

function goMatchingAuthorSpace() {
  const uid = detail.value?.user?.user_id
  if (uid != null) jumpToUserSpace(uid)
}

// 跳转到图鉴详情
const jumpToLibraryDetail = (libraryId: number) => {
  openLibraryDetailTab(libraryId)
}

// 跳转到店铺详情
const jumpToShopDetail = (shopId: number) => {
  navigateTo(`/shop/detail/${shopId}`)
}

// 跳转到活动详情
const jumpToActivity = (activityId: number) => {
  navigateTo(`/activity/detail?id=${activityId}`)
}

// 点赞和收藏功能由 UserGoodBtn 和 UserCollectBtn 组件处理

// 生成搭配图
const handleGenerateImage = () => {
  // TODO: 实现生成搭配图功能
  console.log('生成搭配图')
}

// 添加标签
const handleAddTag = () => {
  // TODO: 实现添加标签功能
  console.log('添加标签')
}

// 关联帖子
const handleAddCommunity = () => {
  showAddCommunity.value = true
}

// 确认添加帖子类型
const confirmAddType = (type: number) => {
  if (type === 0) {
    // 关联帖子
    showChooseCommunity.value = true
  } else {
    // 新增帖子
    navigateTo(`/community/send?pk_id=${matchingId}&pk_type=4`)
  }
}

// 选择帖子
const chooseCommunityItem = (item: CommunityItem) => {
  chooseCommunity.value = item
  showChooseCommunity.value = true
}

// 确认关联帖子
const confirmCommunity = async () => {
  if (loading.value) return
  
  if (!chooseCommunity.value) return
  
  try {
    loading.value = true
    // TODO: 调用关联帖子API
    // await insertCommunityForeign({
    //   pk_type: 4,
    //   community_id: chooseCommunity.value.community_id,
    //   pk_id: matchingId
    // })
    
    console.log('关联成功')
    showChooseCommunity.value = false
    // 刷新返图列表
  } catch (error) {
    console.error('关联失败', error)
  } finally {
    loading.value = false
  }
}

// 发送评论
const handleShowComment = () => {
  navigateTo(`/comment/send?id=${matchingId}&type=match`)
}

// 初始化
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  setTimeout(async () => {
    await fetchDetail()
  })
})

// SEO
useHead({
  title: computed(() => detail.value?.note || '搭配详情'),
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,搭配,Lolita搭配'
    },
    {
      name: 'description',
      content: computed(() => detail.value?.note || 'Lolita搭配详情')
    }
  ]
})
</script>

<template>
  <div class="matching-detail relative min-h-screen w-full overflow-x-hidden pb-28 md:pb-32">
    <button
      type="button"
      class="matching-back-btn fixed z-[55] flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-md transition-opacity hover:bg-black/65 hover:opacity-90 active:scale-95 dark:bg-white/20 dark:hover:bg-white/30"
      :style="matchingBackBtnStyle"
      aria-label="返回"
      @click="goBack"
    >
      <UIcon name="i-heroicons-arrow-left" class="text-[18px]" />
    </button>
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

    <!-- 加载状态 -->
    <div v-if="isLoading" class="mx-auto max-w-4xl px-3 pt-8 sm:px-4 sm:pt-10">
      <div class="matching-empty flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-[1.35rem] py-16">
        <span class="matching-empty-icon flex h-14 w-14 items-center justify-center rounded-full">
          <UIcon name="i-heroicons-arrow-path" class="h-7 w-7 animate-spin text-qhx-primary" />
        </span>
        <p class="text-sm text-[#9a858a]">
          加载中…
        </p>
      </div>
    </div>

    <!-- 详情内容 -->
    <main v-else-if="detail" class="mx-auto max-w-4xl px-3 pt-5 sm:px-4 sm:pt-8">
      <!-- 搭配主卡片 -->
      <article class="matching-main-card overflow-hidden rounded-[1.35rem]">
        <div id="matchingBox" class="p-3 sm:p-4">
          <!-- 主图区域：与服饰一致 — float 排布；文案一律放在下方「搭配信息」 -->
          <div
            v-if="detail.cover || detail.main_clothes_item || matchingSideItems.length > 0"
            class="mb-3 w-full flow-root md:mb-4"
          >
            <!-- 有主图（封面或主单品） -->
            <div
              v-if="detail.cover || detail.main_clothes_item"
              class="w-full overflow-hidden"
            >
              <!-- 主图 float 左，占 2/3，比例 2:3 -->
              <div class="float-left w-2/3 aspect-[2/3] p-1">
                <div
                  v-if="detail.cover"
                  class="matching-photo relative h-full cursor-pointer overflow-hidden rounded-xl transition-all duration-200 hover:ring-2 hover:ring-qhx-primary/30"
                  @click="previewImage([BASE_IMG + detail.cover], 0)"
                >
                  <img
                    :src="`${BASE_IMG}${detail.cover}?x-oss-process=image/quality,q_100/resize,w_800`"
                    :alt="detail.note || '搭配图片'"
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else-if="detail.main_clothes_item"
                  class="matching-photo relative h-full cursor-pointer overflow-hidden rounded-xl transition-all duration-200 hover:ring-2 hover:ring-qhx-primary/30"
                  @click="previewImage([BASE_IMG + detail.main_clothes_item.clothes_img], 0)"
                >
                  <div
                    v-if="!hideShareText && detail.main_clothes_item.color"
                    class="absolute left-2 top-2 z-10 flex flex-wrap gap-1"
                  >
                    <div
                      v-for="color in detail.main_clothes_item.color.split(',')"
                      :key="color"
                      class="h-4 w-4 rounded-full border border-white/40 shadow-md"
                      :style="{ backgroundColor: color }"
                    />
                  </div>
                  <img
                    :src="`${BASE_IMG}${detail.main_clothes_item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_800`"
                    alt="主衣服"
                    class="h-full w-full object-cover"
                  />
                </div>
              </div>
              <!-- 附图 float 右，占 1/3 宽，锁定 1:1，多图自上而下流式排列 -->
              <div
                v-for="(item, index) in matchingSideItems"
                :key="`${item.clothes_img}-${index}`"
                class="float-left w-1/3 aspect-[1/1] p-1"
              >
                <div
                  class="matching-photo relative h-full w-full overflow-hidden rounded-xl transition-all duration-200 hover:ring-2 hover:ring-qhx-primary/35"
                >
                  <div
                    v-if="!hideShareText && item.library"
                    class="absolute right-1 top-1 z-10 rounded-md bg-qhx-primary px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                  >
                    {{ item.library.state }}
                  </div>
                  <div
                    v-if="!hideShareText && item.color"
                    class="absolute left-1 top-1 z-10 flex flex-wrap gap-1"
                  >
                    <div
                      v-for="color in item.color.split(',')"
                      :key="color"
                      class="h-3 w-3 rounded-full border border-white/50 shadow-sm"
                      :style="{ backgroundColor: color }"
                    />
                  </div>
                  <img
                    :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300,h_300`"
                    alt=""
                    class="h-full w-full cursor-pointer object-cover transition-transform duration-200 hover:scale-105"
                    @click="previewImage([BASE_IMG + item.clothes_img], 0)"
                  />
                  <div
                    v-if="!hideShareText"
                    class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 py-2 text-left text-[11px] text-white"
                  >
                    <p
                      class="line-clamp-2 cursor-pointer drop-shadow-sm"
                      @click="previewImage([BASE_IMG + item.clothes_img], 0)"
                    >
                      <span v-if="item.price" class="mr-1 font-semibold text-amber-200">￥{{ item.price }}</span>
                      {{ sideItemCaption(item) }}
                    </p>
                    <p v-if="sideItemShopLine(item)" class="mt-0.5 truncate text-[10px] text-white/85">
                      <a
                        v-if="item.library"
                        class="text-sky-200 hover:text-white hover:underline"
                        @click.stop="jumpToLibraryDetail(item.library.library_id)"
                      >
                        {{ sideItemShopLine(item) }}
                      </a>
                      <a
                        v-else-if="item.origin_shop"
                        class="text-sky-200 hover:text-white hover:underline"
                        @click.stop="jumpToShopDetail(item.origin_shop.shop_id)"
                      >
                        {{ sideItemShopLine(item) }}
                      </a>
                      <span v-else>{{ sideItemShopLine(item) }}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div class="clear-both" />
            </div>

            <!-- 无主图时：仅方形 float 栅格（与服饰附图同一规则 w-1/3 + 1:1） -->
            <div
              v-else
              class="w-full overflow-hidden"
            >
              <div
                v-for="(item, index) in matchingSideItems"
                :key="`only-${item.clothes_img}-${index}`"
                class="float-left w-1/3 aspect-[1/1] p-1"
              >
                <div
                  class="matching-photo relative h-full w-full overflow-hidden rounded-xl"
                >
                  <div
                    v-if="!hideShareText && item.library"
                    class="absolute right-1 top-1 z-10 rounded-md bg-qhx-primary px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                  >
                    {{ item.library.state }}
                  </div>
                  <div
                    v-if="!hideShareText && item.color"
                    class="absolute left-1 top-1 z-10 flex flex-wrap gap-1"
                  >
                    <div
                      v-for="color in item.color.split(',')"
                      :key="color"
                      class="h-3 w-3 rounded-full border border-white/50 shadow-sm"
                      :style="{ backgroundColor: color }"
                    />
                  </div>
                  <img
                    :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300,h_300`"
                    alt=""
                    class="h-full w-full cursor-pointer object-cover"
                    @click="previewImage([BASE_IMG + item.clothes_img], 0)"
                  />
                  <div
                    v-if="!hideShareText"
                    class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 py-2 text-left text-[11px] text-white"
                  >
                    <p class="line-clamp-2 drop-shadow-sm">
                      <span v-if="item.price" class="mr-1 font-semibold text-amber-200">￥{{ item.price }}</span>
                      {{ sideItemCaption(item) }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="clear-both" />
            </div>
          </div>

          <!-- 搭配信息：整段排在图区下方（与服饰页信息区同属「图下」逻辑） -->
          <div class="matching-meta clear-both mt-4 w-full rounded-2xl p-3 sm:p-4">
            <div class="mb-3 border-b border-qhx-primary/15 pb-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-[#9a858a]">
                搭配信息
              </p>
              <div class="mt-1 flex items-start gap-2">
                <h2 class="matching-detail-title min-w-0 flex-1 leading-snug">
                  {{ detail.note || `搭配 #${detail.matching_id}` }}
                </h2>
                <button
                  type="button"
                  class="matching-hide-text-btn ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium outline-none transition active:scale-[0.98]"
                  :aria-pressed="hideShareText"
                  :aria-label="hideShareText ? '显示备注、价格、店铺、状态和颜色' : '隐藏备注、价格、店铺、状态和颜色'"
                  @click="hideShareText = !hideShareText"
                >
                  <UIcon
                    :name="hideShareText ? 'i-heroicons-eye-slash' : 'i-heroicons-language'"
                    class="h-3.5 w-3.5 shrink-0"
                    :class="hideShareText ? 'text-qhx-primary' : ''"
                  />
                  {{ hideShareText ? '显示文本' : '隐藏文本' }}
                </button>
              </div>
              <div
                v-if="!hideShareText && detail.main_clothes_item && (detail.main_clothes_item.price || detail.main_clothes_item.library || detail.main_clothes_item.origin_shop || detail.main_clothes_item.origin)"
                class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#4f3f43]"
              >
                <span
                  v-if="detail.main_clothes_item.price"
                  class="font-semibold text-qhx-primary"
                >
                  主单品 ￥{{ detail.main_clothes_item.price }}
                </span>
                <a
                  v-if="detail.main_clothes_item.library"
                  class="text-qhx-primary underline-offset-2 hover:underline"
                  @click.stop="jumpToLibraryDetail(detail.main_clothes_item.library.library_id)"
                >
                  {{ detail.main_clothes_item.library.name }}
                </a>
                <a
                  v-else-if="detail.main_clothes_item.origin_shop"
                  class="text-qhx-primary underline-offset-2 hover:underline"
                  @click.stop="jumpToShopDetail(detail.main_clothes_item.origin_shop.shop_id)"
                >
                  {{ detail.main_clothes_item.origin_shop.shop_name }}
                </a>
                <span v-else-if="detail.main_clothes_item.origin" class="text-[#9a858a]">
                  {{ detail.main_clothes_item.origin }}
                </span>
              </div>
            </div>

            <div v-if="detail.tags_list && detail.tags_list.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="tag in detail.tags_list"
                :key="tag.tags_id"
                class="matching-chip rounded-full px-2.5 py-1 text-xs font-medium text-[#4f3f43]"
              >
                #{{ tag.tags_name }}
              </span>
            </div>

            <div v-if="detail.main_style" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="(style, index) in detail.main_style.split(',')"
                :key="index"
                class="text-sm font-medium text-qhx-primary"
              >
                ★{{ style }}
              </span>
            </div>

            <div v-if="detail.season" class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-sm text-[#9a858a]">季节：</span>
              <span
                v-for="(seasonItem, index) in detail.season.split(',')"
                :key="index"
                class="matching-chip rounded-full px-2.5 py-1 text-xs font-medium text-[#4f3f43]"
              >
                {{ seasonItem }}
              </span>
            </div>

          </div>
        </div>

        <!-- 预定时间和隐私设置 -->
        <div
          class="matching-footer-strip flex flex-wrap items-center justify-between gap-2 border-t border-qhx-primary/12 px-3 py-3 text-sm sm:px-4"
        >
          <span v-if="detail.appointment_time" class="text-[#4f3f43]">
            预定时间：{{ dayjs(detail.appointment_time).format('YYYY-MM-DD') }}
          </span>
          <span
            class="rounded-lg px-2 py-0.5 text-xs font-medium"
            :class="
              detail.is_private === 0
                ? 'bg-emerald-500/15 text-emerald-800'
                : 'bg-amber-500/15 text-amber-900'
            "
          >
            {{ detail.is_private === 0 ? '公开' : '私有' }}
          </span>
        </div>

        <!-- 主人：更新关联衣柜服饰的最后穿着时间 -->
        <div
          v-if="isMatchingOwner && hasMatchingClothes"
          class="mx-3 mb-3 flex flex-wrap items-center gap-2 sm:mx-4"
        >
          <UButton
            size="sm"
            color="primary"
            :loading="matchingLastDressSaving"
            class="rounded-xl"
            @click="updateMatchingLastDressNow"
          >
            记为今日穿着
          </UButton>
          <UButton
            size="sm"
            color="gray"
            variant="soft"
            class="rounded-xl"
            :disabled="matchingLastDressSaving"
            @click="openMatchingLastDressModal"
          >
            自定义穿着时间
          </UButton>
        </div>

        <!-- 用户信息 -->
        <div
          v-if="detail.user"
          class="matching-user-row mx-3 mb-3 flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition active:scale-[0.99] sm:mx-4"
          @click="goMatchingAuthorSpace"
        >
          <UserInfo :user="detail.user" />
        </div>

        <!-- 活动列表 -->
        <div
          v-if="detail.activity_list && detail.activity_list.length > 0"
          class="matching-action-btn mx-3 mb-4 cursor-pointer rounded-xl px-4 py-3 text-center text-sm font-medium text-[#4f3f43] outline-none transition active:scale-[0.99] sm:mx-4"
          role="button"
          tabindex="0"
          @click="showActivityModal = true"
          @keydown.enter="showActivityModal = true"
        >
          参与 {{ detail.activity_list.length }} 个活动
        </div>
      </article>
    </main>

    <div
      v-if="detail"
      class="matching-detail-action-dock pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3"
      role="toolbar"
      aria-label="搭配互动"
    >
      <div
        class="matching-detail-action-capsule pointer-events-auto flex max-w-full items-stretch gap-0.5 overflow-x-auto"
      >
        <UserGoodBtn
          :pk_type="4"
          :pk_id="detail.matching_id"
          :good_count="detail.good_count || 0"
          :is_good="detail.is_good ? true : false"
          :need_judge="true"
        >
          <template #default="{ childData }">
            <div class="matching-detail-action-item" role="button" aria-label="点赞">
              <UIcon
                name="weui:like-filled"
                class="matching-detail-action-item__icon"
                :class="childData.is_good ? 'text-[#409EFF]' : ''"
              />
              <span class="matching-detail-action-item__label tabular-nums">
                {{ childData.good_count }}
              </span>
            </div>
          </template>
        </UserGoodBtn>

        <UserCollectBtn
          :pk_type="4"
          :pk_id="detail.matching_id"
          :collect_count="detail.collect_count || 0"
          :is_collect="detail.is_collect ? true : false"
          :need_judge="true"
        >
          <template #default="collectSlot">
            <div class="matching-detail-action-item" role="button" aria-label="收藏">
              <UIcon
                name="ant-design:star-filled"
                class="matching-detail-action-item__icon"
                :class="collectSlot.childData?.is_collect ? 'text-[#FFD166]' : ''"
              />
              <span class="matching-detail-action-item__label tabular-nums">
                {{ collectSlot.childData?.collect_count ?? detail.collect_count ?? 0 }}
              </span>
            </div>
          </template>
        </UserCollectBtn>

        <MatchingShareImage :payload="matchingSharePayload" variant="capsule" />
      </div>
    </div>

    <!-- 活动列表弹窗 -->
    <UModal v-model="showActivityModal" title="参与的活动">
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="(item, index) in detail?.activity_list || []"
          :key="index"
          class="flex items-center gap-3 p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          @click="jumpToActivity(item.activity_id)"
        >
          <div class="w-15 h-15 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
            <img
              :src="item.activity?.activity_cover ? `${BASE_IMG}${item.activity.activity_cover}` : `${BASE_IMG}/static/plan_cover/default.jpg`"
              alt="活动封面"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-base font-semibold text-orange-400 line-clamp-1">
              {{ item.activity?.activity_title || '暂无标题' }}
            </div>
          </div>
        </div>
      </div>
    </UModal>

    <!-- 添加帖子类型选择 -->
    <UModal v-model="showAddCommunity" title="选择操作">
      <div class="space-y-2">
        <UButton
          @click="confirmAddType(0)"
          class="w-full"
          color="primary"
        >
          关联帖子
        </UButton>
        <UButton
          @click="confirmAddType(1)"
          class="w-full"
          color="primary"
          variant="outline"
        >
          新增帖子
        </UButton>
      </div>
    </UModal>

    <!-- 确认关联帖子 -->
    <UModal v-model="showChooseCommunity" title="操作确认">
      <div class="space-y-4">
        <p>确定要添加该帖子吗？</p>
        <div class="flex gap-2 justify-end">
          <UButton @click="showChooseCommunity = false" variant="outline">
            取消
          </UButton>
          <UButton @click="confirmCommunity" :loading="loading" color="primary">
            确定
          </UButton>
        </div>
      </div>
    </UModal>

    <UModal v-model="showLastDressModal" title="更新穿着时间">
      <div class="space-y-4 p-1">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          将同步更新本搭配关联的全部衣柜服饰「最后穿着时间」。
        </p>
        <QhxDateTimePicker
          v-model="matchingLastDressValue"
          mode="date"
          :enable-time-picker="true"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择穿着时间"
        />
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="outline" @click="showLastDressModal = false">
            取消
          </UButton>
          <UButton color="primary" :loading="matchingLastDressSaving" @click="confirmMatchingLastDress">
            确定
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.matching-detail {
  color: #4f3f43;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, color-mix(in srgb, var(--primary-color) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 70% 40% at 100% 0%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 50%),
    linear-gradient(180deg, #fff9fb 0%, #fff5f8 45%, #fff2f6 100%);
}

.matching-main-card {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.matching-photo {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.matching-meta {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.matching-detail-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.45rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
}

.matching-hide-text-btn {
  margin-top: 0.35rem;
  color: #9a858a;
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
}

.matching-hide-text-btn[aria-pressed='true'] {
  color: var(--primary-color, #ff9eb5);
  background: color-mix(in srgb, var(--primary-color) 12%, white);
}

.matching-chip {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-footer-strip {
  background: transparent;
}

.matching-user-row {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-user-row:hover {
  border-color: color-mix(in srgb, var(--primary-color) 32%, transparent);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.matching-action-btn {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-action-btn:hover {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
}

.matching-detail-action-dock {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}

.matching-detail-action-capsule {
  height: 3.2rem;
  min-height: 3.2rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--border-color, #e5e7eb) 55%, transparent);
  background: color-mix(in srgb, var(--background-color-card, #fff) 62%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  padding: 0.28rem 0.4rem;
  scrollbar-width: none;
}

.matching-detail-action-capsule::-webkit-scrollbar {
  display: none;
}

.dark .matching-detail-action-capsule {
  border-color: color-mix(in srgb, #fff 12%, transparent);
  background: color-mix(in srgb, #111827 58%, transparent);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.matching-detail-action-item {
  box-sizing: border-box;
  display: inline-flex;
  width: 3.25rem;
  height: 2.625rem;
  min-width: 3.25rem;
  min-height: 2.625rem;
  flex: 0 0 3.25rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.28rem 0.35rem;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--text-color, #374151) 88%, transparent);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
  user-select: none;
  overflow: hidden;
}

.matching-detail-action-item:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

.matching-detail-action-item:active {
  transform: scale(0.96);
}

.matching-detail-action-item__icon {
  display: block;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  line-height: 0;
}

.matching-detail-action-item__icon :deep(svg) {
  width: 18px !important;
  height: 18px !important;
}

.matching-detail-action-item__label {
  display: block;
  width: 100%;
  height: 10px;
  font-size: 10px;
  line-height: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.matching-detail-action-dock :deep(.share-inline-btn) {
  box-sizing: border-box;
  width: 3.25rem;
  height: 2.625rem;
  min-width: 3.25rem;
  min-height: 2.625rem;
  flex: 0 0 3.25rem;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--text-color, #374151) 88%, transparent);
  transition: background 0.15s ease, transform 0.12s ease;
  overflow: hidden;
}

.matching-detail-action-dock :deep(.share-inline-btn:hover) {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, transparent);
}

.matching-detail-action-dock :deep(.share-inline-btn:active) {
  transform: scale(0.96);
}

.matching-detail-action-dock :deep(.cursor-pointer.inline-block) {
  display: inline-flex;
  align-items: stretch;
  width: 3.25rem;
  height: 2.625rem;
  flex: 0 0 3.25rem;
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
