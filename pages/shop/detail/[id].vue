<script setup lang="ts">
import type { Shop, PaginationResponse, LibraryPipe, Library } from '@/types/api';
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import { getShopDetail } from '@/api/shop';
import { getLibraryList, getLibraryPipeListAll } from '@/api/library';
import { getEventRedblackList } from '@/api/event_redblack';
import type { UserBlackBtn, UserGoodBtn } from '#components';
import type LibraryPipeManage from '@/components/library/LibraryPipeManage.vue'
import type PhysicalShopModal from '@/components/shop/PhysicalShopModal.vue'
import type { PhysicalShop } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { isHtml5PlusWebview, openLibraryWebPath } from '@/composables/useLibraryDetailNavigation'

interface ShopLinkEntry {
  href: string
  title: string
  clickable: boolean
}

const user = useUserStore()
const toast = useToast()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const canManagePhysicalShop = computed(() => {
  const currentUser = user.user
  const accessLevel = currentUser?.access_level ?? 0
  return !!currentUser && accessLevel >= (config.value?.min_add_library || 0)
})
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('shopDeatil', () => {
  return getShopDetail({ shop_id: Number.parseInt(id) })
}, {})
const detail = ref<Shop | null>(null)
const shop = ref<Shop | null>(null)
const goodBtn = ref<InstanceType<typeof UserGoodBtn> | null>(null)
const blackBtn = ref<InstanceType<typeof UserBlackBtn> | null>(null)
const library_pipe = ref<LibraryPipe[]>([])
import dayjs from 'dayjs'
detail.value = data.value ?? null
const router = useRouter()
const selectLibraryPipe = (item: LibraryPipe) => {
  console.log(item)
  // router.push(`/library/detail/${item.library?.library_id}`)
}
const fetchLibraryPipe = () => {
  getLibraryPipeListAll({ shop_id: Number.parseInt(id), end_time: dayjs().format('YYYY-MM-DD'), pk_type: 0 })
    .then((res) => {
      library_pipe.value = res
    })
}
const formateState = (state: number) => {
  const item = config.value?.pipe_state.find(item => item.value === state)
  return item?.label
}

onMounted(async () => {
  if (!detail.value) {
    try {
      detail.value = await getShopDetail({ shop_id: Number.parseInt(id) })
    } catch {
      // useAsyncData 未带回详情时客户端补拉失败则保持空状态
    }
  }
  fetchLibraryPipe()
  void prefetchShopEventCount()
  layoutReady.value = true
})

async function prefetchShopEventCount() {
  const shopId = detail.value?.shop_id
  if (shopId == null) return
  try {
    const res = await getEventRedblackList({
      page: 1,
      pageSize: 1,
      pk_id: shopId,
      pk_type: 0
    })
    shopEventTabCount.value = res.count ?? 0
  } catch {
    // 角标预取失败时保持不显示
  }
}
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: detail.value ? detail.value.shop_name : 'Lolita店铺汇总',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.shop_name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
const libraryPipeManageRef = ref<InstanceType<typeof LibraryPipeManage> | null>(null)
const physicalShopModalRef = ref<InstanceType<typeof PhysicalShopModal> | null>(null)

const showLibraryPipeManage = () => {
  libraryPipeManageRef.value?.showModel({ shop_id: Number.parseInt(id) })
}

function formatPhysicalShopAddress(shop: PhysicalShop) {
  return [shop.province, shop.city, shop.area, shop.address].filter(Boolean).join('')
}

function physicalShopLogo(shop: PhysicalShop) {
  const logo = shop.physical_logo
  if (logo) return `${BASE_IMG}${logo}`
  if (detail.value?.shop_logo) return `${BASE_IMG}${detail.value.shop_logo}`
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

function buildPhysicalShopMapLink(shop: PhysicalShop) {
  const address = formatPhysicalShopAddress(shop)
  const { latitude, longitude } = shop
  if (latitude != null && latitude !== '' && longitude != null && longitude !== '') {
    const title = encodeURIComponent(shop.physical_name || '实体店')
    const content = encodeURIComponent(address)
    return `https://api.map.baidu.com/marker?location=${latitude},${longitude}&title=${title}&content=${content}&output=html`
  }
  if (address) {
    return `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(address)}&output=html`
  }
  return ''
}

function showPhysicalShop(item: PhysicalShop) {
  physicalShopModalRef.value?.showModel(item)
}

function openPhysicalShopMap(shop: PhysicalShop) {
  const link = buildPhysicalShopMapLink(shop)
  if (link) window.open(link, '_blank')
}

function jumpToEditShop() {
  router.push(`/addShop?shop_id=${id}`)
}

function jumpToAddLibrary() {
  if (!user.token) {
    toast.add({ title: '请先登录', color: 'red' })
    return
  }
  const params = new URLSearchParams({ shop_id: id })
  const shopName = detail.value?.shop_name?.trim()
  if (shopName) params.set('shop_name', shopName)
  openLibraryWebPath(`/addLibrary?${params.toString()}`)
}

function jumpToAddPhysicalShop() {
  router.push(`/addPhysicalShop?shop_id=${id}`)
}

function jumpToEditPhysicalShop(physicalShop: PhysicalShop) {
  if (!physicalShop.physical_id) return
  router.push(`/addPhysicalShop?physical_id=${physicalShop.physical_id}&shop_id=${id}`)
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isTaobaoLikeUrl(url: string): boolean {
  return /taobao\.com|tmall\.com/i.test(url)
}

function isWeiboUrl(url: string): boolean {
  return /weibo\.com|weibo\.cn/i.test(url)
}

function isXhsUrl(url: string): boolean {
  return /xiaohongshu\.com|xhslink\.com/i.test(url)
}

function resolveShopOfficialLabel(url: string): string {
  return isTaobaoLikeUrl(url) ? '淘宝店铺' : '官方网站'
}

function resolveSocialLabel(url: string): string {
  if (isWeiboUrl(url)) return '微博'
  if (isXhsUrl(url)) return '小红书'
  return '社交主页'
}

const shopOfficialEntry = computed((): ShopLinkEntry | null => {
  const raw = detail.value?.shop_url?.trim()
  if (!raw) return null
  return {
    href: normalizeExternalUrl(raw),
    title: resolveShopOfficialLabel(raw),
    clickable: true
  }
})

const socialMediaEntry = computed((): ShopLinkEntry | null => {
  const rawUrl = detail.value?.wb_url?.trim() || ''
  const name = detail.value?.wb_name?.trim() || ''
  if (!rawUrl && !name) return null

  const href = rawUrl ? normalizeExternalUrl(rawUrl) : ''
  const title = rawUrl
    ? resolveSocialLabel(rawUrl)
    : '微博/小红书'

  return {
    href,
    title,
    clickable: !!href
  }
})

function openExternalShopLink(url: string) {
  if (!url || !import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/common/outerLink?url=${url}`,
      fail: () => {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    })
    return
  }

  const port = configStore.getPort()
  if (port) {
    try {
      port.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: { url }
        })
      )
      return
    } catch {
      /* 桥接失败则回退浏览器打开 */
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

const shopPipeTabCounts = computed(() => [
  library_pipe.value.length > 0 ? library_pipe.value.length : undefined,
  undefined
])

const shopLibraryTabCount = ref<number | undefined>(
  detail.value?.count_library != null ? detail.value.count_library : undefined
)
const layoutReady = ref(false)

/** 0=瀑布流列表，1=初贩时间轴（与旧版 shopLibrary 一致，sort=5） */
type LibrarySortMode = 0 | 1
const librarySortMode = ref<LibrarySortMode>(0)
const waterListRef = ref<InstanceType<typeof QhxWaterList> | null>(null)

const timelineLibraryList = ref<Library[]>([])
const timelinePage = ref(1)
const timelineLoading = ref(false)
const timelineFinished = ref(false)
const TIMELINE_PAGE_SIZE = 20

const shopLibraryFilterList = [
  { field: 'shop_id', op: 'and', value: id },
  { field: 'parent_id', op: 'and', value: 0 },
] as const

async function fetchShopLibraryList(page: number, pageSize: number) {
  try {
    const response = await getLibraryList({
      page,
      pageSize,
      need_Statistics: true,
      filter_list: [...shopLibraryFilterList],
    })
    shopLibraryTabCount.value = response.count ?? 0
    return {
      rows: response.rows ?? [],
      count: response.count ?? 0,
    }
  } catch {
    return { rows: [], count: 0 }
  }
}

function resetTimelineList() {
  timelinePage.value = 1
  timelineLibraryList.value = []
  timelineFinished.value = false
}

async function loadTimelineLibraries() {
  if (timelineLoading.value || timelineFinished.value) return
  timelineLoading.value = true
  try {
    const response = await getLibraryList({
      page: timelinePage.value,
      pageSize: TIMELINE_PAGE_SIZE,
      need_Statistics: true,
      filter_list: [...shopLibraryFilterList],
      sort: 5,
    })
    const rows = response.rows ?? []
    timelineLibraryList.value = timelinePage.value === 1
      ? rows
      : [...timelineLibraryList.value, ...rows]
    shopLibraryTabCount.value = response.count ?? 0
    timelineFinished.value = timelinePage.value * TIMELINE_PAGE_SIZE >= (response.count ?? 0)
  } catch {
    if (timelinePage.value === 1) timelineLibraryList.value = []
  } finally {
    timelineLoading.value = false
  }
}

function loadMoreTimeline() {
  if (timelineLoading.value || timelineFinished.value) return
  timelinePage.value += 1
  void loadTimelineLibraries()
}

function onLibrarySortModeChange(mode: LibrarySortMode) {
  if (librarySortMode.value === mode) return
  librarySortMode.value = mode
  if (mode === 0) {
    nextTick(() => waterListRef.value?.refresh())
    return
  }
  resetTimelineList()
  void loadTimelineLibraries()
}

const shopEventTabCount = ref<number | undefined>(undefined)
const showEventModal = ref(false)

const FAB_ACTIONS_STORAGE_KEY = 'shop-detail-fab-actions-expanded'
const fabActionsExpanded = ref(true)
const fabTotalBadgeCount = computed(() => shopEventTabCount.value ?? 0)

function restoreFabActionsExpanded() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const v = localStorage.getItem(FAB_ACTIONS_STORAGE_KEY)
    if (v !== null) fabActionsExpanded.value = v === '1'
  } catch {
    /* 忽略读取失败 */
  }
}

function persistFabActionsExpanded(expanded: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FAB_ACTIONS_STORAGE_KEY, expanded ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function toggleFabActions() {
  fabActionsExpanded.value = !fabActionsExpanded.value
}

restoreFabActionsExpanded()

watch(fabActionsExpanded, (expanded) => {
  persistFabActionsExpanded(expanded)
})

watch(
  () => detail.value?.count_library,
  (count) => {
    if (count != null) shopLibraryTabCount.value = count
  }
)
</script>
<template>
  <div class="container mx-auto p-4 max-md:p-2">
    <div
      v-if="detail"
      class="shop-fab-anchor fixed top-20 max-md:top-16 inset-x-0 z-[60] pointer-events-none"
    >
      <div class="container mx-auto px-4 max-md:px-0">
        <div class="shop-fab-stack flex flex-col items-end gap-1 pointer-events-auto ml-auto max-md:fixed max-md:top-16 max-md:right-2 max-md:ml-0">
      <button
        type="button"
        class="shop-fab-btn shop-fab-btn--toggle"
        :aria-expanded="fabActionsExpanded"
        :aria-label="fabActionsExpanded ? '收起大事记' : '展开大事记'"
        @click="toggleFabActions"
      >
        <UIcon
          name="i-heroicons-chevron-down-20-solid"
          class="shop-fab-toggle-icon h-3 w-3 shrink-0"
          :class="{ 'shop-fab-toggle-icon--expanded': fabActionsExpanded }"
        />
        <span
          v-if="!fabActionsExpanded && fabTotalBadgeCount > 0"
          class="shop-fab-badge"
        >{{ fabTotalBadgeCount > 99 ? '99+' : fabTotalBadgeCount }}</span>
      </button>
      <Transition name="shop-fab-panel">
        <div
          v-if="fabActionsExpanded"
          class="shop-fab-actions-panel flex flex-col items-end gap-1"
        >
          <button
            type="button"
            class="shop-fab-btn shop-fab-btn--action"
            @click="showEventModal = true"
          >
            <span class="shop-fab-btn__inner">
              <UIcon name="i-heroicons-clipboard-document-list" class="shop-fab-btn__icon" />
              <span class="shop-fab-btn__label">大事记</span>
              <span
                v-if="shopEventTabCount != null && shopEventTabCount > 0"
                class="shop-fab-badge shop-fab-badge--corner"
              >{{ shopEventTabCount > 99 ? '99+' : shopEventTabCount }}</span>
            </span>
          </button>
        </div>
      </Transition>
        </div>
      </div>
    </div>

    <QhxModal v-model="showEventModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-rose-50/90 to-orange-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">大事记</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showEventModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="overflow-y-auto flex-1 min-h-0">
          <EventRedblack
            v-if="showEventModal && detail"
            :pk_id="detail.shop_id"
            :pk_type="0"
            :can_load="showEventModal"
            @load="shopEventTabCount = $event"
          />
        </div>
      </div>
    </QhxModal>

    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="detail.shop_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full relative">
          <QhxPreviewImage :key="detail.shop_id" :list="[{ src: detail.shop_logo, alt: detail.shop_name }]" :className="'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
        </div>
        <div class="m-2 flex-1">
          <div>
            <h1 class="mb-3 text-lg font-semibold">{{ detail?.shop_name }}</h1>
          </div>
          <h3 class="text-sm m-1" v-html="detail.shop_describe" v-if="detail.shop_describe"></h3>
          <!-- 淘宝/官网 & 微博/小红书入口 -->
          <div
            v-if="shopOfficialEntry || socialMediaEntry"
            class="mb-2 px-1"
          >
            <div class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/40 p-3 flex flex-row flex-wrap items-start gap-3 max-md:gap-2">
              <div v-if="shopOfficialEntry" class="flex-1 min-w-[8.5rem]">
                <h3 class="text-xs font-medium text-gray-800 dark:text-gray-100 mb-1.5">淘宝/官网入口</h3>
                <QhxJellyButton>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5 max-w-full"
                    @click="openExternalShopLink(shopOfficialEntry.href)"
                  >
                    <UIcon name="i-heroicons-shopping-bag" class="w-4 h-4 shrink-0" />
                    <span class="truncate">{{ shopOfficialEntry.title }}</span>
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3.5 h-3.5 shrink-0 opacity-70" />
                  </button>
                </QhxJellyButton>
              </div>
              <div v-if="socialMediaEntry" class="flex-1 min-w-[8.5rem]">
                <h3 class="text-xs font-medium text-gray-800 dark:text-gray-100 mb-1.5">微博/小红书入口</h3>
                <div class="flex flex-wrap items-center gap-2">
                  <QhxJellyButton v-if="socialMediaEntry.clickable">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5 max-w-full"
                      @click="openExternalShopLink(socialMediaEntry.href)"
                    >
                      <UIcon
                        :name="socialMediaEntry.title === '小红书' ? 'i-heroicons-book-open' : 'i-heroicons-chat-bubble-left-ellipsis'"
                        class="w-4 h-4 shrink-0"
                      />
                      <span class="truncate">{{ socialMediaEntry.title }}</span>
                      <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </button>
                  </QhxJellyButton>
                  <QhxTag v-if="detail.wb_name?.trim()" :active="true">
                    {{ detail.wb_name }}
                  </QhxTag>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-center p-3 flex-wrap gap-2">
            <QhxJellyButton v-if="canManagePhysicalShop">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                @click="jumpToEditShop"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                编辑店铺
              </button>
            </QhxJellyButton>
            <QhxJellyButton v-if="canManagePhysicalShop">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                @click="jumpToAddLibrary"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                添加图鉴
              </button>
            </QhxJellyButton>
            <QhxJellyButton>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                @click="showLibraryPipeManage"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                管理店铺状态流
              </button>
            </QhxJellyButton>
          </div>
          <div class="flex justify-center p-3 flex-wrap gap-y-2">
            <div class=" flex-1 text-center min-w-[88px]">
              <UserGoodBtn ref="goodBtn" :pk_type="1" :pk_id="detail.shop_id" :good_count="detail.good_count || 0" :need_judge="true">
              </UserGoodBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]">
              <UserCollectBtn :collect_count="detail.collect_count ?? 0" :pk_type="1" :pk_id="detail.shop_id" :need_judge="true">
              </UserCollectBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]">
              <UserBlackBtn ref="blackBtn" :pk_type="1" :pk_id="detail.shop_id" :black_count="detail.black_count || 0" :need_judge="true">
              </UserBlackBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]" v-if="goodBtn && blackBtn">
              赞黑比 {{ blackBtn.blackCount ? (goodBtn.goodCount / blackBtn.blackCount).toFixed(2) : goodBtn.goodCount ? goodBtn.goodCount : '--' }}
            </div>
          </div>
          <!-- 主营风格 -->
          <div v-if="detail.style_list  && detail.style_list?.length" class="mb-1">
            <h3 class="text-sm m-1">主营风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主营类型 -->
          <div v-if="detail.type_list && detail.type_list?.length > 0" class="mb-1">
            <h3 class="text-sm m-1">主营类型</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.type_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主体 -->
          <div v-if="detail.main_type" class="mb-1">
            <h3 class="text-sm m-1">主体</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in formatShopMainType(detail.main_type)" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>
          <!-- 实体店 -->
          <div class="mb-3">
            <div class="flex items-center justify-between mb-2 px-1">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">实体店</h3>
              <QhxJellyButton v-if="canManagePhysicalShop">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                  @click="jumpToAddPhysicalShop"
                >
                  <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                  收录实体店
                </button>
              </QhxJellyButton>
            </div>
            <div v-if="detail.physical_shop && detail.physical_shop.length > 0" class="space-y-2">
              <div
                v-for="physicalShop in detail.physical_shop"
                :key="physicalShop.physical_id"
                class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gradient-to-r from-white to-gray-50/60 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
              >
                <div class="flex items-center gap-3 p-3">
                  <img
                    :src="physicalShopLogo(physicalShop)"
                    :alt="physicalShop.physical_name || '实体店'"
                    class="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0 cursor-pointer shadow-sm"
                    loading="lazy"
                    @click="showPhysicalShop(physicalShop)"
                  />
                  <div
                    class="flex-1 min-w-0 cursor-pointer"
                    @click="showPhysicalShop(physicalShop)"
                  >
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {{ physicalShop.physical_name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {{ formatPhysicalShopAddress(physicalShop) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <QhxJellyButton v-if="canManagePhysicalShop">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        @click.stop="jumpToEditPhysicalShop(physicalShop)"
                      >
                        编辑
                      </button>
                    </QhxJellyButton>
                    <QhxJellyButton v-if="buildPhysicalShopMapLink(physicalShop)">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                        @click.stop="openPhysicalShopMap(physicalShop)"
                      >
                        <UIcon name="i-heroicons-map-pin" class="w-3.5 h-3.5" />
                        去导航
                      </button>
                    </QhxJellyButton>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-gray-500 dark:text-gray-400 px-1">
              暂无实体店信息
            </div>
          </div>
          <!-- 代表作 -->
          <div v-if="detail.masterpiece_list && detail.masterpiece_list.length > 0" class="mb-1">
            <h3 class="text-sm m-1">代表作</h3>
            <div class="flex flex-wrap gap-2">
              <div v-for="library in detail.masterpiece_list">
                <LibraryItem :item="library" size="mini" :className="' w-[100px] cursor-pointer'"></LibraryItem>
              </div>
            </div>
          </div>
          <!-- 关联的店铺 -->
          <div v-if="detail.related_shop_list && detail.related_shop_list.length > 0" class="mb-3">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 px-1">关联的店铺</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div
                v-for="relatedShop in detail.related_shop_list"
                :key="relatedShop.shop_id"
                class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/50 p-2 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <ShopItem
                  :item="relatedShop"
                  size="small"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="detail && library_pipe.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs
        sticky
        panel-min-height="min(50vh, 480px)"
        :tabs="['近期工作流', '图表版']"
        :tab-counts="shopPipeTabCounts"
      >
        <QhxTabPanel :index="0">
          <div class=" bg-white">
            <div v-if="library_pipe.length > 0">
              <div v-for="value in library_pipe" :key="value.pipe_id">
                <div v-if="value.library">
                  <LibraryItem :need-jump="false" :item="value.library" size="mini-list" class="w-full">
                    <template #extra>
                      <div class="p-2 flex items-center">
                        <QhxTag :active="true"> {{ formateState(value.state || 0) }} </QhxTag>
                        <h3 class="p-2">起止时间</h3>
                        <QhxTag :active="true">{{ dayjs(value.start_time).format('YY-MM-DD') }}</QhxTag> - 
                        <QhxTag :active="true">{{ dayjs(value.end_time).format('YY-MM-DD') }}</QhxTag>
                      </div>
                    </template>
                  </LibraryItem>
                </div>
              </div>
            </div>
          </div>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <div class=" bg-white" v-if="isActive">
              <div v-if="library_pipe.length > 0" class="p-3">
                <h3 class="text-sm m-1">近期工作流</h3>
                <div class="flex flex-wrap gap-2">
                  <QhxTimePipe :timePipe="[...library_pipe]" @select="selectLibraryPipe"></QhxTimePipe>
                </div>
              </div>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
        <div class="flex items-center gap-2">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">图鉴</h3>
          <span
            v-if="shopLibraryTabCount != null && shopLibraryTabCount > 0"
            class="text-xs text-gray-500 dark:text-gray-400"
          >共 {{ shopLibraryTabCount }} 条</span>
        </div>
        <div
          class="inline-flex rounded-full border border-gray-200 dark:border-gray-600 p-0.5 text-xs"
          role="radiogroup"
          aria-label="图鉴展示模式"
        >
          <button
            type="button"
            class="rounded-full px-3 py-1 transition-colors"
            :class="librarySortMode === 0
              ? 'bg-qhx-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'"
            :aria-checked="librarySortMode === 0"
            role="radio"
            @click="onLibrarySortModeChange(0)"
          >
            列表
          </button>
          <button
            type="button"
            class="rounded-full px-3 py-1 transition-colors"
            :class="librarySortMode === 1
              ? 'bg-qhx-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'"
            :aria-checked="librarySortMode === 1"
            role="radio"
            @click="onLibrarySortModeChange(1)"
          >
            初贩时间轴
          </button>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-900 min-h-[min(50vh,480px)]">
        <ClientOnly>
          <QhxWaterList
            v-if="layoutReady && librarySortMode === 0"
            ref="waterListRef"
            :fetch-data="fetchShopLibraryList"
            :columns="5"
            :item-key="0"
            :columns_768="2"
            :enable-waterfall="true"
            :enable-load-more="true"
            class-name="px-2 pb-8"
          >
            <template #default="{ item, debouncedApplyLayout }">
              <div class="custom-item" :key="item.library_id">
                <LibraryItem
                  :item="item"
                  size="big"
                  @image-load="debouncedApplyLayout"
                />
              </div>
            </template>
          </QhxWaterList>
          <div v-else-if="layoutReady && librarySortMode === 1" class="px-1 pb-[max(2rem,env(safe-area-inset-bottom))] max-md:px-0 md:px-2">
            <div
              v-if="timelineLoading && timelineLibraryList.length === 0"
              class="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400"
            >
              加载中...
            </div>
            <template v-else>
              <LibraryTimeline :list="timelineLibraryList" />
              <div v-if="timelineLibraryList.length > 0 && !timelineFinished" class="flex justify-center py-4">
                <QhxJellyButton>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5 disabled:opacity-50"
                    :disabled="timelineLoading"
                    @click="loadMoreTimeline"
                  >
                    {{ timelineLoading ? '加载中...' : '加载更多' }}
                  </button>
                </QhxJellyButton>
              </div>
              <div
                v-else-if="!timelineLoading && timelineLibraryList.length === 0"
                class="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                暂无图鉴数据
              </div>
            </template>
          </div>
        </ClientOnly>
      </div>
    </div>
    <LibraryPipeManage ref="libraryPipeManageRef" />
    <PhysicalShopModal
      ref="physicalShopModalRef"
      :fallback-logo="detail?.shop_logo"
    />
  </div>
</template>

<style scoped>
.shop-fab-stack {
  transform-origin: top right;
}

.shop-fab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 2px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 5%, #fff);
  color: var(--primary-color, #ff9eb5);
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.07em;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 2px 8px rgba(0, 0, 0, 0.06);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.16s ease;
}

.shop-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 9%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, transparent);
}

.shop-fab-btn:active {
  transform: scale(0.97);
}

.dark .shop-fab-btn {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, rgba(17, 24, 39, 0.72));
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, rgba(255, 255, 255, 0.12));
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 78%, #fce7f3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.28);
}

.dark .shop-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, rgba(17, 24, 39, 0.78));
}

.shop-fab-btn--toggle {
  padding: 0.22rem 0.38rem;
}

.shop-fab-btn--action {
  padding: 0.24rem 0.48rem 0.24rem 0.42rem;
}

.shop-fab-btn__inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.shop-fab-btn__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.shop-fab-btn__label {
  line-height: 1.2;
}

.shop-fab-badge {
  position: absolute;
  top: -0.45rem;
  right: -0.55rem;
  z-index: 10;
  display: flex;
  min-height: 1rem;
  min-width: 1rem;
  align-items: center;
  justify-content: center;
  padding: 0 0.2rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: #ef4444;
  color: #fff;
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.shop-fab-badge--corner {
  top: -0.45rem;
  right: -0.55rem;
}

.shop-fab-panel-enter-active,
.shop-fab-panel-leave-active {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  transform-origin: top right;
}

.shop-fab-panel-enter-from,
.shop-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.94);
  max-height: 0;
}

.shop-fab-panel-enter-to,
.shop-fab-panel-leave-from {
  max-height: 4rem;
}

.shop-fab-panel-enter-active .shop-fab-btn--action {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.shop-fab-panel-leave-active .shop-fab-btn--action {
  transition:
    opacity 0.18s ease,
    transform 0.2s ease;
}

.shop-fab-panel-enter-from .shop-fab-btn--action,
.shop-fab-panel-leave-to .shop-fab-btn--action {
  opacity: 0;
  transform: translateY(-6px);
}

.shop-fab-toggle-icon {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.shop-fab-toggle-icon--expanded {
  transform: rotate(180deg);
}
</style>


