<script setup lang="ts">
import { nextTick } from 'vue'
import type { WardrobeClothes, Library, Shop, Wardrobe, Scene, Community } from '@/types/api'

// 扩展 WardrobeClothes 类型以包含关联数据
interface ExtendedWardrobeClothes extends WardrobeClothes {
  library?: Library
  wardrobe?: Wardrobe
  origin_shop?: Shop
  sence_id?: number
  image_list?: string[]
}
import { getClothesDetail, getClothesListAllFallback, parseClothesIdsFromRows, updateClothes, deteleClothes, addClothesCitation } from '@/api/wardrobe'
import { getCommunityForeignList, insertCommunityForeign } from '@/api/community'
import { getMatchingListListVisitor, deleteMatchingList, type MatchingListItem } from '@/api/matching_list'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import { planComplete, deletePlanList } from '@/api/plan'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import type SceneChoose from '@/components/scene/SceneChoose.vue'
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import ClothesFavoriteCoverOverlay from '@/components/Clothes/ClothesFavoriteCoverOverlay.vue'
import ClothesDetailCoverFrame from '@/components/Clothes/ClothesDetailCoverFrame.vue'
import CommunityPostModal from '@/components/community/CommunityPostModal.vue'
import ClothesShareImage from '@/components/Clothes/ClothesShareImage.vue'
import type { CommunityPostForeignContext } from '@/utils/communityPost'
import type { ClothesShareSource } from '@/utils/clothesShareCanvas'
import { BASE_IMG } from '@/utils/ipConfig'
import PhysicsDrop from '@/components/PhysicsDrop.client.vue'
import type { MaterialForeign, Material } from '@/types/api'
import { getLibraryVideo } from '@/api/library'
import { buildHumanPlatformNav } from '@/utils/humanPlatformNav'
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const isMobile = computed(() => configStore.isMobile)
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const route = useRoute()
const router = useRouter()
const config = useConfigStore()
const wardrobeStore = useWardrobeStore()
const user = useUserStore()
const toast = useToast()
const clothesRouteId = computed(() => String(route.params.id ?? ''))

const buildAccessQueryParams = (): { qrcode?: string; password?: string } => {
  const params: { qrcode?: string; password?: string } = {}
  const qr = route.query.qrcode
  if (typeof qr === 'string' && qr) params.qrcode = qr
  const pwd = route.query.password
  if (typeof pwd === 'string' && pwd) params.password = pwd
  return params
}

const detail = ref<ExtendedWardrobeClothes | null>(null)

const COVER_3D_STORAGE_KEY = 'clothes-detail-cover-3d-pref'

function readCover3dPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(COVER_3D_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistCover3dPref(active: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COVER_3D_STORAGE_KEY, active ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

const cover3dActive = ref(false)

const libraryHas3d = computed(() => {
  const v = detail.value?.library?.has_3d
  return v === true || v === 1
})

const humanPlatformIframeSrc = ref('')

async function resolveHumanPlatformIframeSrc() {
  const lid = detail.value?.library?.library_id
  if (lid == null || !libraryHas3d.value) {
    humanPlatformIframeSrc.value = ''
    return
  }
  try {
    const list = await getLibraryVideo({ pk_id: lid })
    const first = list.find((v) => v.pk_type === 2 && v.addr && v.video_id != null)
    if (first?.video_id == null) {
      humanPlatformIframeSrc.value = ''
      return
    }
    const { fullUrl } = buildHumanPlatformNav({
      videoId: first.video_id,
      libraryId: lid,
      addr: first.addr,
      query: { from_iframe: true, hide_ui: true },
    })
    humanPlatformIframeSrc.value = fullUrl
  } catch (err) {
    console.error('解析人台 iframe 地址失败:', err)
    humanPlatformIframeSrc.value = ''
  }
}

watch(
  [() => detail.value?.library?.library_id, libraryHas3d],
  () => {
    void resolveHumanPlatformIframeSrc()
  },
  { immediate: true },
)

function syncCover3dFromPref() {
  cover3dActive.value = libraryHas3d.value && readCover3dPref()
}

watch(cover3dActive, (active) => {
  if (libraryHas3d.value) persistCover3dPref(active)
})

watch([libraryHas3d, clothesRouteId], () => {
  syncCover3dFromPref()
})
/** 当前衣柜内服饰 id 顺序（来自 `/clothes/all` 或 list 分页兜底） */
const wardrobeSiblingIds = ref<number[]>([])
const siblingsWardrobeId = ref<number | null>(null)
/** 最近一次详情期望拉取的衣柜（用于丢弃慢请求覆盖新衣柜） */
const latestSiblingWardrobeTarget = ref<number | null>(null)
const siblingIdsInflight = new Map<number, Promise<void>>()
const slideTransitionName = ref<'clothes-slide-forward' | 'clothes-slide-back'>('clothes-slide-forward')
const showMemoryListModal = ref(false)
/** 关联成功后强制刷新记忆列表（CommunityForeignList 无对外 refresh） */
const memoryListRefreshKey = ref(0)
const memoryForeignLinkLoading = ref(false)
const memoryCommunityChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const clothesMemoryPostModalRef = ref<InstanceType<typeof CommunityPostModal> | null>(null)
const showClothesMemoryPostModal = ref(false)
const sortMode = ref(false)
const showDeleteModal = ref(false)
const showDeleteLinkModal = ref(false)
const showAddClothesModal = ref(false)
const showDeleteCommunityModal = ref(false)
const showSceneChooseModal = ref(false)
const showRemoveSceneModal = ref(false)
const showRemovePlanModal = ref(false)
const showCompletePlanModal = ref(false)
const completePlanListId = ref<number | null>(null)
const showDeletePlanModal = ref(false)
const planAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
/** 从详情页打开计划弹窗时预填当前服饰 */
const planAddEditLinkedClothes = computed((): WardrobeClothes | null => {
  const d = detail.value
  if (!d?.clothes_id) return null
  return {
    clothes_id: d.clothes_id,
    clothes_note: d.clothes_note,
    clothes_img: d.clothes_img
  }
})
const planRemoveLoading = ref(false)
const planCompleteLoading = ref(false)
const planDeleteLoading = ref(false)
const sceneChooseClickPosition = ref({ x: 0, y: 0 })
const selectedClothes = ref<WardrobeClothes | null>(null)
const memoryCount = ref(0)
const matchingCount = ref(0)
const showMatchingListModal = ref(false)
const matchingListRefreshKey = ref(0)
const matchingListLoading = ref(false)
const matchingListItems = ref<MatchingListItem[]>([])
const matchingListPage = ref(1)
const matchingListTotal = ref(0)
const MATCHING_LIST_PAGE_SIZE = 20
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEdit> | null>(null)
const showDeleteMatchingModal = ref(false)
const deletingMatchingItem = ref<MatchingListItem | null>(null)
const matchingDeleteLoading = ref(false)
const FAB_ACTIONS_STORAGE_KEY = 'clothes-detail-fab-actions-expanded'
/** 记忆/搭配悬浮按钮组是否展开（localStorage 持久化） */
const fabActionsExpanded = ref(true)
const fabTotalBadgeCount = computed(() => memoryCount.value + matchingCount.value)

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

const HEADER_COLLAPSED_KEY = 'clothes-detail-header-collapsed'

function readHeaderCollapsedPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return false
  try {
    const h = localStorage.getItem(HEADER_COLLAPSED_KEY)
    return h === null ? false : h === '1'
  } catch {
    return false
  }
}

/** 功能栏是否收起（localStorage 持久化，无缓存时默认展开） */
const headerCollapsed = ref(readHeaderCollapsedPref())

function restoreHeaderCollapsedPref() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const h = localStorage.getItem(HEADER_COLLAPSED_KEY)
    if (h !== null) {
      headerCollapsed.value = h === '1'
    } else {
      headerCollapsed.value = false
    }
  } catch {
    /* 忽略读取失败 */
  }
}

function persistHeaderCollapsed(collapsed: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(HEADER_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

const toggleHeaderCollapsed = () => {
  headerCollapsed.value = !headerCollapsed.value
}

const clothesShareImageRef = ref<InstanceType<typeof ClothesShareImage> | null>(null)

function openClothesShareFromCollapse() {
  clothesShareImageRef.value?.openShare()
}

watch(headerCollapsed, persistHeaderCollapsed)

// 组件引用
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const wardrobeStatusSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const SceneChooseRef = ref<InstanceType<typeof SceneChoose> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)
const linkClothesLoading = ref(false)
const sharedLoading = ref(false)

/** 关联服饰剩余可添加数量（上限 10） */
const linkClothesRemainingSlots = computed(() => {
  const count = detail.value?.include_clothes
    ? detail.value.include_clothes.split(',').filter(Boolean).length
    : 0
  return Math.max(0, 10 - count)
})

// 数字选择器选项
const numOptions = Array.from({ length: 100 }, (_, i) => ({
  label: `${i + 1}`,
  value: i + 1
}))

const timesOptions = Array.from({ length: 1000 }, (_, i) => ({
  label: `${i}`,
  value: i
}))

const fetchSiblingClothesIds = async (wardrobeId: number | string | undefined | null) => {
  const wid = typeof wardrobeId === 'number' ? wardrobeId : Number(wardrobeId)
  if (!Number.isFinite(wid) || wid <= 0) return
  latestSiblingWardrobeTarget.value = wid
  // 已成功缓存过该衣柜（即使解析 id 为空也不再重复打 /clothes/all）
  if (siblingsWardrobeId.value === wid) return

  let pending = siblingIdsInflight.get(wid)
  if (!pending) {
    pending = (async () => {
      try {
        const rows = await getClothesListAllFallback({
          wardrobe_id: wid,
          ...buildAccessQueryParams(),
        })
        if (latestSiblingWardrobeTarget.value !== wid) return
        wardrobeSiblingIds.value = parseClothesIdsFromRows(rows)
        siblingsWardrobeId.value = wid
      } catch {
        if (latestSiblingWardrobeTarget.value !== wid) return
        wardrobeSiblingIds.value = []
      } finally {
        siblingIdsInflight.delete(wid)
      }
    })()
    siblingIdsInflight.set(wid, pending)
  }
  await pending
}

const currentSiblingIndex = computed(() => {
  const cid = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(cid)) return -1
  return wardrobeSiblingIds.value.findIndex((id) => Number(id) === cid)
})

const canGoSiblingPrev = computed(() => {
  const i = currentSiblingIndex.value
  return i > 0
})

const canGoSiblingNext = computed(() => {
  const i = currentSiblingIndex.value
  return i >= 0 && i < wardrobeSiblingIds.value.length - 1
})

const showSiblingNav = computed(
  () => wardrobeSiblingIds.value.length > 1 && currentSiblingIndex.value >= 0
)

/** 手机端：横向滑动切相邻件；电脑端不用滑动（见悬浮按钮） */
const swipeMobileActive = computed(() => showSiblingNav.value && isMobile.value)

const goToSibling = (delta: -1 | 1) => {
  const i = currentSiblingIndex.value
  const nextId = wardrobeSiblingIds.value[i + delta]
  if (nextId == null) return
  slideTransitionName.value = delta < 0 ? 'clothes-slide-back' : 'clothes-slide-forward'
  router.replace({ path: `/clothes/detail/${nextId}`, query: route.query })
}

const swipeStartX = ref(0)
const swipeStartY = ref(0)
const swipeTrackingPointerId = ref<number | null>(null)

const SWIPE_MIN_DISTANCE = 48

const isSwipeIgnoredTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el?.closest) return false
  return !!el.closest(
    'button, a, input, textarea, select, label, [role="button"], iframe'
  )
}

const swipePointerDown = (e: PointerEvent) => {
  if (!swipeMobileActive.value) return
  if (isSwipeIgnoredTarget(e.target)) return
  if (swipeTrackingPointerId.value !== null) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  swipeTrackingPointerId.value = e.pointerId
  swipeStartX.value = e.clientX
  swipeStartY.value = e.clientY
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
}

const swipePointerUp = (e: PointerEvent) => {
  if (!swipeMobileActive.value) return
  if (swipeTrackingPointerId.value !== e.pointerId) return
  ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
  swipeTrackingPointerId.value = null

  const dx = e.clientX - swipeStartX.value
  const dy = e.clientY - swipeStartY.value
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.15) return

  if (dx < 0 && canGoSiblingNext.value) goToSibling(1)
  else if (dx > 0 && canGoSiblingPrev.value) goToSibling(-1)
}

const swipePointerCancel = (e: PointerEvent) => {
  if (swipeTrackingPointerId.value !== e.pointerId) return
  try {
    ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
  } catch {
    /* capture 可能已释放 */
  }
  swipeTrackingPointerId.value = null
}

/** 手机端：进入详情约 2s 后提示可横向滑动切换（不占点击，穿透到底层） */
const showSwipeGuide = ref(false)
const swipeGuideTimers: ReturnType<typeof setTimeout>[] = []

const SWIPE_GUIDE_STORAGE_KEY = 'clothes-detail-swipe-guide-v1'

const clearSwipeGuideTimers = () => {
  for (const t of swipeGuideTimers) clearTimeout(t)
  swipeGuideTimers.length = 0
}

const scheduleMobileSwipeGuide = () => {
  clearSwipeGuideTimers()
  showSwipeGuide.value = false
  if (!import.meta.client) return
  try {
    if (localStorage.getItem(SWIPE_GUIDE_STORAGE_KEY) === '1') return
  } catch {
    /* 无痕模式等 */
  }
  if (!isMobile.value || !showSiblingNav.value || !detail.value) return

  const tShow = setTimeout(() => {
    if (!isMobile.value || !showSiblingNav.value || !detail.value) return
    // 弹出即写入 localStorage，避免切换 sibling 时 cancel 掉 hide 定时器导致从未写入，从而反复弹出
    try {
      localStorage.setItem(SWIPE_GUIDE_STORAGE_KEY, '1')
    } catch {
      /* */
    }
    showSwipeGuide.value = true
    const tHide = setTimeout(() => {
      showSwipeGuide.value = false
    }, 3000)
    swipeGuideTimers.push(tHide)
  }, 2000)
  swipeGuideTimers.push(tShow)
}

watch(
  () => [isMobile.value, showSiblingNav.value, !!detail.value] as const,
  () => {
    scheduleMobileSwipeGuide()
  }
)

onUnmounted(() => {
  clearSwipeGuideTimers()
})

const fetchClothesDetail = async () => {
  const pid = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(pid)) return
  try {
    const response = await getClothesDetail({
      clothes_id: pid,
      ...buildAccessQueryParams(),
    })
    const data = response
    if (data) {
      if (data.detail_image) {
        data.detail_image_list = data.detail_image.split(',')
      } else {
        data.detail_image_list = []
      }
      if (data.main_style && data.main_style !== '' && config.config?.main_style) {
        const mian_style_option = config.config?.main_style
        const main_style_list: { label: string; value: number }[] = []
        data.main_style.split(',').map((item) => {
          const index = mian_style_option.findIndex((element) => {
            return element.value === Number.parseInt(item)
          })
          if (index !== -1 && mian_style_option[index]) {
            main_style_list.push(mian_style_option[index] as { label: string; value: number })
          }
        })
        data.main_style_list = main_style_list
      } else {
        data.main_style_list = []
      }
      if (data.include_clothes && data.include_clothes !== '' && data.include && data.include.length > 0) {
        const include: WardrobeClothes[] = []
        for (const idStr of data.include_clothes.split(',')) {
          if (!data.include) continue
          const index = data.include.findIndex((child) => {
            return child.clothes_id === Number.parseInt(idStr)
          })
          if (index !== -1) {
            include.push(data.include[index])
          }
        }
        data.include = include
      }
    }
    detail.value = data
    void fetchSiblingClothesIds(
      data.wardrobe_id ?? (data as ExtendedWardrobeClothes).wardrobe?.wardrobe_id ?? null
    )
  } catch (error) {
    console.error('获取服饰详情失败:', error)
    toast.add({
      title: '获取详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 判断是否是当前用户拥有的服饰
const isOwner = computed(() => {
  return detail.value?.wardrobe && detail.value.wardrobe.user_id === user.user?.user_id
})

const OWNER_LARGE_IMAGE_PARAMS = '?x-oss-process=image/quality,q_100/resize,w_1920'

/** 当前用户服饰大图 OSS 参数 */
function appendOwnerLargeImageParams(path?: string | null): string {
  const p = path?.trim() || ''
  if (!p || !isOwner.value) return p
  if (p.includes('x-oss-process')) return p
  return `${p}${OWNER_LARGE_IMAGE_PARAMS}`
}

function mapOwnerLargeImageParams(paths?: Array<string | null | undefined>): string[] {
  if (!paths?.length) return []
  return paths.map((p) => appendOwnerLargeImageParams(p)).filter(Boolean)
}

function clothesPreviewItem(src: string | null | undefined, alt = '') {
  return [{ src: appendOwnerLargeImageParams(src), alt }]
}

// 是否共享（兼容 undefined/null/0）
const isShared = computed(() => (detail.value?.is_shared ?? 0) === 1)

// 共享时的赞数与引用数（确保为数字）
const displayGoodCount = computed(() => Number(detail.value?.good_count) || 0)
const displayCitationCount = computed(() => Number(detail.value?.citation_count) || 0)

/** 有关联服饰即展示。缺价格不参与相加（数值等同于 +0）；分解式里只写出有有效价格的项。 */
const includeOutfitPriceBreakdown = computed(() => {
  const d = detail.value
  if (!d?.include_clothes?.trim() || !d.include?.length) return null

  const segmentPrices: number[] = []
  const pushIfNumeric = (raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return
    const n = Number(raw)
    if (!Number.isNaN(n)) segmentPrices.push(n)
  }

  pushIfNumeric(d.price)
  for (const item of d.include) {
    pushIfNumeric(item.price)
  }

  const total = segmentPrices.reduce((a, b) => a + b, 0)
  return { segmentPrices, total }
})

/** 定尾计划金额：多阶段展示分解式，单阶段展示总额 */
const planPriceDisplay = computed(() => {
  const plan = detail.value?.plan
  if (!plan) return null

  const pushIfNumeric = (raw: unknown, arr: number[]) => {
    if (raw === undefined || raw === null || raw === '') return
    const n = Number(raw)
    if (!Number.isNaN(n)) arr.push(n)
  }

  const stages = plan.plan_list ?? []
  if (stages.length > 1) {
    const segmentPrices: number[] = []
    for (const stage of stages) {
      pushIfNumeric(stage.need_money, segmentPrices)
    }
    if (!segmentPrices.length) return null
    const total = plan.need_money != null && !Number.isNaN(Number(plan.need_money))
      ? Number(plan.need_money)
      : segmentPrices.reduce((a, b) => a + b, 0)
    return { kind: 'breakdown' as const, segmentPrices, total }
  }

  let amount: number | null = null
  if (plan.need_money != null) {
    const n = Number(plan.need_money)
    if (!Number.isNaN(n)) amount = n
  }
  if (amount == null && stages.length === 1) {
    const n = Number(stages[0].need_money)
    if (!Number.isNaN(n)) amount = n
  }
  if (amount == null) return null
  return { kind: 'single' as const, amount }
})

const includeCoverPrimary = computed(() => detail.value?.include?.slice(0, 3) ?? [])
const includeCoverOverflow = computed(() => detail.value?.include?.slice(3) ?? [])

// 编辑服饰
const editClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item)
  }
}

// 复制服饰
const copyClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item, true)
  }
}

// 删除服饰
const confirmDelete = async () => {
  if (!detail.value) return
  if (!detail.value.clothes_id) return
  try {
    await deteleClothes({
      clothes_id: detail.value.clothes_id
    })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus');
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateBack) {
      // 发送刷新通知，让上一页在返回时刷新列表
      if (typeof uni.postMessage === 'function') {
        uni.postMessage({ data: { type: 'BackAndReload' } })
      }
      uni.navigateBack()
    } else {
      if (port.value) {
        port.value.postMessage(JSON.stringify({
          type: 'BackAndReload'
        }))
      } else {
        router.back()
      }
    }
  } catch (error) {
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteModal.value = false
  }
}

/** 喜爱级别 0–5，与接口字段 `is_favorite` 对应 */
const favoriteLevelDisplay = computed(() => {
  const v = detail.value?.is_favorite
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
})

/** 详情区喜爱星级：新拟态容器 */
const favoriteNeuPanel =
  'inline-flex items-center gap-0.5 rounded-2xl border border-white/55 bg-[#e8eaf0] px-2 py-1 shadow-[4px_4px_10px_rgb(163_177_198/0.45),-3px_-3px_10px_rgb(255_255_255/0.9),inset_0_1px_1px_rgb(255_255_255/0.8)] dark:border-white/[0.08] dark:bg-[#3d4354] dark:shadow-[5px_5px_12px_rgb(0_0_0/0.45),-4px_-4px_12px_rgb(255_255_255/0.05),inset_0_1px_1px_rgb(255_255_255/0.06)]'

const favoriteNeuMiniBtn =
  'rounded-xl border border-white/50 bg-[#e8eaf0] px-2.5 py-1 text-xs font-medium text-gray-600 shadow-[3px_3px_8px_rgb(163_177_198/0.4),-2px_-2px_8px_rgb(255_255_255/0.85)] transition-all hover:text-gray-800 active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.45)] dark:border-white/[0.08] dark:bg-[#3d4354] dark:text-gray-300 dark:shadow-[4px_4px_10px_rgb(0_0_0/0.4),-3px_-3px_10px_rgb(255_255_255/0.04)] dark:hover:text-gray-100 dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]'

/** 铭牌排版（参考数字展馆）：仅字体/字距/行高，不改布局与配色 */
const clothesPlateTitle = 'font-serif tracking-wide leading-snug'
const clothesPlateLabelMuted = 'text-sm shrink-0 font-serif tracking-wider text-gray-600 dark:text-gray-400'
const clothesPlateLabel = 'text-sm shrink-0 font-serif tracking-wider'
const clothesPlateRow = 'text-sm leading-relaxed'
const clothesPlateSectionSm = 'text-sm font-semibold font-serif tracking-wide text-gray-700 dark:text-gray-300'
const clothesPlateSectionLg = 'text-lg font-semibold font-serif tracking-wide mb-3'
const clothesPlateName = 'font-semibold font-serif leading-snug'

const setFavoriteLevel = async (level: number) => {
  if (!detail.value || !isOwner.value) return
  const next = Math.min(5, Math.max(0, Math.round(level)))
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      is_favorite: next
    })
    if (detail.value) {
      detail.value.is_favorite = next
    }
    toast.add({
      title: next === 0 ? '已设为无星级' : `已设为 ${next} 星`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 设置是否共享（实时修改）
const setShared = async (is_shared: number) => {
  if (!detail.value || !isOwner.value || sharedLoading.value) return
  sharedLoading.value = true
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      is_shared
    })
    if (detail.value) {
      detail.value.is_shared = is_shared
    }
    // 刷新详情以获取最新的 good_count、citation_count
    await fetchClothesDetail()
  } catch (error) {
  } finally {
    sharedLoading.value = false
  }
}

// 更新数量
const updateNum = async (num: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      num
    })
    if (detail.value) {
      detail.value.num = num
    }
  } catch (error) {
    console.error('更新数量失败:', error)
  }
}

// 更新穿着次数
const updateTimes = async (times: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      times
    })
    if (detail.value) {
      detail.value.times = times
    }
  } catch (error) {
    console.error('更新穿着次数失败:', error)
  }
}

/** 拥有状态：与 ClothesAdd / 衣柜批量改状态一致 */
const wardrobe_status_defaults: optionsInterface[] = [
  { value: '已拥有', label: '已拥有' },
  { value: '待补款', label: '待补款' },
  { value: '已出', label: '已出' },
]
const wardrobe_status_options = ref<optionsInterface[]>([...wardrobe_status_defaults])

function refreshWardrobeStatusOptions() {
  if (wardrobeStore.config?.wardrobe_status?.length) {
    const fromConfig = wardrobeStore.config.wardrobe_status.map((child) => ({
      value: child,
      label: child,
    }))
    wardrobe_status_options.value = [
      ...wardrobe_status_defaults,
      ...fromConfig.filter((o) => !wardrobe_status_defaults.some((d) => d.label === o.label)),
    ]
  } else {
    wardrobe_status_options.value = [...wardrobe_status_defaults]
  }
}

const updateWardrobeStatus = async (wardrobe_status: string | null) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      wardrobe_status: wardrobe_status ?? undefined,
    })
    if (detail.value) {
      detail.value.wardrobe_status = wardrobe_status ?? undefined
    }
  } catch (error) {
    console.error('更新拥有状态失败:', error)
  }
}

const onWardrobeStatusSelect = (select: optionsInterface) => {
  void updateWardrobeStatus(select.label)
}

const openWardrobeStatusPicker = (e: MouseEvent) => {
  refreshWardrobeStatusOptions()
  wardrobeStatusSelectRef.value?.showPicker(e)
}

const clearWardrobeStatus = () => {
  void updateWardrobeStatus(null)
}

// 跳转到图鉴详情
const jumpToLibrary = (library: Library) => {
  router.push(`/library/detail/${library.library_id}`)
}

// 跳转到店铺详情
const jumpToShop = (shop_id: number) => {
  router.push(`/shop/detail/${shop_id}`)
}

// 跳转到关联服饰详情
const jumpToClothes = (item: WardrobeClothes) => {
  router.push({
    path: `/clothes/detail/${item.clothes_id}`,
    query: buildAccessQueryParams(),
  })
}

// 跳转到衣柜
const jumpToWardrobe = () => {
  if (detail.value?.wardrobe_id && detail.value.wardrobe?.user_id) {
    router.push({
      path: `/wardrobe/detail/${detail.value.wardrobe.user_id}`,
      query: {
        wardrobe_id: String(detail.value.wardrobe_id),
        ...buildAccessQueryParams(),
      },
    })
  }
}

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN')
}

// 格式化货币标签
type MoneyType = { value: number; label: string; exchange_rate?: string }
const formatLabel = (shop_country: number | undefined, money_type: MoneyType[]) => {
  if (!shop_country || !money_type) return ''
  const item = money_type.find((m) => m.value === shop_country)
  return item ? item.label : ''
}

// 汇率换算
const exchangeRate = (shop_country: number | undefined, price: number | undefined): string | false => {
  if (!shop_country || !price || !config.config) return false
  const index = config.config.money_type.findIndex((item) => {
    return item.value === shop_country
  })
  if (index !== -1 && config.config.money_type[index]?.exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (Number.parseFloat(String(price)) / Number.parseFloat(String(config.config.exchange_rate[exchange_rate]))).toFixed(2)
  }
  return false
}

const clothesShareSource = computed((): ClothesShareSource | null => {
  const d = detail.value
  if (!d?.clothes_img) return null

  const sections: ClothesShareSource['infoSections'] = []

  if (d.note?.trim()) sections.push({ key: 'note', title: '笔记', lines: [d.note.trim()] })
  if (d.num !== undefined && d.num !== null) {
    sections.push({ key: 'num', title: '拥有数量', text: String(d.num) })
  }
  if (d.main_style_list?.length) {
    sections.push({
      key: 'main_style',
      title: '风格',
      tags: d.main_style_list.map((s) => s.label).filter(Boolean),
    })
  }
  if (d.price) sections.push({ key: 'price', title: '价格', text: `￥${d.price}` })
  if (d.size?.trim()) sections.push({ key: 'size', title: '尺码', text: d.size.trim() })
  if (d.times !== undefined && d.times !== null) {
    sections.push({ key: 'times', title: '穿着次数', text: String(d.times) })
  }
  if (d.times && d.times > 0 && d.price) {
    sections.push({
      key: 'cost_per_wear',
      title: '次均价格',
      text: `￥${(d.price / d.times).toFixed(2)}`,
    })
  }
  if (d.color?.trim()) {
    sections.push({
      key: 'color',
      title: '颜色',
      tags: d.color.split(',').map((c) => c.trim()).filter(Boolean),
    })
  }
  if (d.clothes_part?.trim()) {
    sections.push({
      key: 'clothes_part',
      title: '部位',
      tags: d.clothes_part.split(',').map((p) => p.trim()).filter(Boolean),
    })
  }
  if (d.tags?.trim()) {
    sections.push({
      key: 'tags',
      title: '标签',
      tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
  }
  if (d.position?.trim()) sections.push({ key: 'position', title: '收纳', text: d.position.trim() })
  if (d.season?.trim()) {
    sections.push({
      key: 'season',
      title: '季节',
      tags: d.season.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }
  if (d.add_time) sections.push({ key: 'add_time', title: '购入时间', text: formatDate(d.add_time) })
  if (!d.origin_shop && d.origin?.trim()) {
    sections.push({ key: 'origin', title: '来源', text: d.origin.trim() })
  }

  let libraryBlock: ClothesShareSource['libraryBlock'] | undefined
  if (d.library) {
    const lib = d.library
    const tagGroups: { label: string; tags: string[] }[] = []
    if (lib.pattern_elements) {
      tagGroups.push({
        label: '柄图',
        tags: lib.pattern_elements.split(',').map((s) => s.trim()).filter(Boolean),
      })
    }
    if (lib.design_elements) {
      tagGroups.push({
        label: '设计',
        tags: lib.design_elements.split(',').map((s) => s.trim()).filter(Boolean),
      })
    }
    let priceText = ''
    if (lib.library_price) {
      const currency = formatLabel(lib.shop_country || 0, config.config?.money_type || [])
      priceText = `￥${lib.library_price} ${currency}`
      const rmb = exchangeRate(lib.shop_country ?? 0, lib.library_price)
      if (rmb) priceText += ` ≈${rmb}元`
    }
    libraryBlock = {
      name: lib.name,
      cover: lib.cover,
      libraryType: lib.library_type,
      state: lib.state,
      priceText: priceText || undefined,
      tagGroups: tagGroups.length ? tagGroups : undefined,
    }
  }

  let planLines: string[] | undefined
  if (d.plan) {
    const lines: string[] = []
    if (d.plan.plan_note) lines.push(d.plan.plan_note)
    if (d.plan.need_money != null) lines.push(`待补：￥${d.plan.need_money}`)
    if (d.plan.plan_list?.length) {
      for (const child of d.plan.plan_list) {
        lines.push(
          `${child.plan_note || '阶段'}：￥${child.need_money ?? 0}${child.is_complete === 1 ? '（已完成）' : ''}`,
        )
      }
    }
    if (lines.length) planLines = lines
  }

  let includeList: ClothesShareSource['includeList'] | undefined
  if (d.include?.length) {
    includeList = d.include
      .map((item) => {
        const ext = item as ExtendedWardrobeClothes
        return {
          name: item.clothes_note || ext.library?.name || '未命名',
          cover: item.clothes_img || '',
          priceText: item.price != null ? `￥${item.price}` : undefined,
        }
      })
      .filter((item) => item.cover)
  }

  let outfitTotalText: string | undefined
  const breakdown = includeOutfitPriceBreakdown.value
  if (breakdown && includeList?.length) {
    if (breakdown.segmentPrices.length) {
      outfitTotalText = `总价：${breakdown.segmentPrices.map((p) => `￥${p}`).join(' + ')} = ￥${breakdown.total}`
    } else {
      outfitTotalText = '总价：￥0'
    }
  }

  return {
    name: d.clothes_note || '暂无名称',
    cover: d.clothes_img,
    clothesId: d.clothes_id,
    wardrobeName: d.wardrobe?.wardrobe_name?.trim() || undefined,
    favoriteStars: d.is_favorite !== undefined ? favoriteLevelDisplay.value : undefined,
    wardrobeStatus: d.wardrobe_status?.trim() || undefined,
    infoSections: sections,
    includeList,
    libraryBlock,
    planLines,
    outfitTotalText,
    shopName: d.origin_shop?.shop_name?.trim() || undefined,
    shopLogo: d.origin_shop?.shop_logo?.trim() || undefined,
    detailImageList: d.detail_image_list?.filter(Boolean).length
      ? d.detail_image_list.filter(Boolean)
      : undefined,
  }
})

// 预览图片（由 QhxPreviewImage 组件处理）

// 打开关联服饰选择
const openLinkClothesChoose = (e?: MouseEvent) => {
  if (linkClothesRemainingSlots.value <= 0) {
    toast.add({ title: '最多关联10条', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  wardrobeClothesChooseRef.value?.showModel(e)
}

// 多选服饰后批量关联
const handleLinkClothesChoose = async (clothesList: WardrobeClothes[]) => {
  if (!detail.value?.clothes_id || !clothesList.length || linkClothesLoading.value) return
  const selfId = detail.value.clothes_id
  const currentInclude = detail.value.include_clothes
    ? detail.value.include_clothes.split(',').filter(Boolean)
    : []
  if (currentInclude.length >= 10) {
    toast.add({ title: '最多关联10条', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  const remainingSlots = 10 - currentInclude.length
  const toLink = clothesList.filter((c) => {
    if (!c?.clothes_id) return false
    if (c.clothes_id === selfId) return false
    if (currentInclude.includes(String(c.clothes_id))) return false
    return true
  })
  if (!toLink.length) {
    toast.add({ title: '没有可关联的服饰', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    return
  }
  const actualLink = toLink.slice(0, remainingSlots)
  if (actualLink.length < toLink.length) {
    toast.add({
      title: `最多再关联 ${remainingSlots} 条，已选取前 ${actualLink.length} 条`,
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber'
    })
  }
  linkClothesLoading.value = true
  try {
    const newIds = actualLink.map((c) => String(c.clothes_id))
    const selfIncludeClothes = [...currentInclude, ...newIds].join(',')
    await updateClothes({
      clothes_id: selfId,
      include_clothes: selfIncludeClothes
    })
    for (const clothes of actualLink) {
      const otherIncludeClothes = [
        ...new Set([
          ...(clothes.include_clothes?.split(',').filter(Boolean) ?? []),
          String(selfId)
        ])
      ].join(',')
      await updateClothes({
        clothes_id: clothes.clothes_id,
        include_clothes: otherIncludeClothes
      })
      // await addClothesCitation({ clothes_id: clothes.clothes_id }).catch(() => {})
    }
    await fetchClothesDetail()
    toast.add({
      title: actualLink.length > 1 ? `成功关联 ${actualLink.length} 件服饰` : '关联成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch {
    toast.add({ title: '关联失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    linkClothesLoading.value = false
  }
}

// 删除关联服饰
const deleteLinkClothes = async () => {
  if (!detail.value || !selectedClothes.value) return
  try {
    let include_clothes: string[] = []
    if (detail.value.include_clothes) {
      include_clothes = detail.value.include_clothes.split(',')
    }
    if (!selectedClothes.value) return
    const index = include_clothes.findIndex((item) => {
      return Number.parseInt(item, 10) === selectedClothes.value.clothes_id
    })
    if (index !== -1) {
      include_clothes.splice(index, 1)
      await updateClothes({
        clothes_id: detail.value.clothes_id,
        include_clothes: include_clothes.length === 0 ? null : include_clothes.join(',')
      })
      await fetchClothesDetail()
      toast.add({
        title: '取消关联成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteLinkModal.value = false
    selectedClothes.value = null
  }
}

// 上移关联服饰
const upItem = async (index: number) => {
  if (index === 0 || !detail.value || !detail.value.include_clothes) return
  try {
    const include_clothes = detail.value.include_clothes.split(',')
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index - 1]
    include_clothes[index - 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('上移失败:', error)
  }
}

// 下移关联服饰
const downItem = async (index: number) => {
  if (!detail.value || !detail.value.include || index >= detail.value.include.length - 1) return
  try {
    const include_clothes = detail.value.include_clothes?.split(',') || []
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index + 1]
    include_clothes[index + 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('下移失败:', error)
  }
}

// 编辑成功回调
const onEditSuccess = () => {
  fetchClothesDetail()
}

// 记忆数量更新（弹窗内列表加载时同步）
const onMemoryCountChange = (count: number) => {
  memoryCount.value = count
}

const MEMORY_PK_TYPE = 2 as const

const clothesMemoryPkId = computed(() => {
  const n = Number.parseInt(clothesRouteId.value, 10)
  return Number.isFinite(n) ? n : null
})

/** 记忆发帖弹窗 foreign 上下文（pk_type=服饰） */
const memoryPostForeignForModal = computed((): CommunityPostForeignContext | null => {
  const id = clothesMemoryPkId.value
  if (id == null) return null
  return { pk_id: id, pk_type: MEMORY_PK_TYPE }
})

function openMemoryChooseCommunity(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (clothesMemoryPkId.value == null) return
  memoryCommunityChooseRef.value?.showModel(e)
}

async function onMemoryCommunityChosen(item: Community) {
  const pkId = clothesMemoryPkId.value
  if (pkId == null) return
  memoryForeignLinkLoading.value = true
  try {
    await insertCommunityForeign({
      pk_type: MEMORY_PK_TYPE,
      community_id: item.community_id,
      pk_id: pkId
    })
    toast.add({
      title: '已关联到本条裙子记忆',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    memoryListRefreshKey.value += 1
    void fetchMemoryListCount()
  } catch (error: unknown) {
    console.error('关联记忆帖子失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '关联失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    memoryForeignLinkLoading.value = false
  }
}

function goNewMemoryPost(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const pkId = clothesMemoryPkId.value
  if (pkId == null) return
  showMemoryListModal.value = false
  clothesMemoryPostModalRef.value?.open(e)
}

function onClothesMemoryPostSuccess() {
  memoryListRefreshKey.value += 1
  void fetchMemoryListCount()
}

/** 直接请求记忆列表总数（用于角标，不依赖弹窗是否打开） */
const fetchMemoryListCount = async () => {
  const clothesId = Number.parseInt(clothesRouteId.value, 10)
  if (Number.isNaN(clothesId)) return
  try {
    const res = await getCommunityForeignList({
      page: 1,
      pageSize: 1,
      pk_id: clothesId,
      pk_type: MEMORY_PK_TYPE
    })
    memoryCount.value = res.count ?? 0
  } catch {
    /* 保持原数量 */
  }
}

// 搭配数量更新
const onMatchingCountChange = (count: number) => {
  matchingCount.value = count
}

const clothesMatchingFilterList = computed(() => {
  const id = clothesMemoryPkId.value
  if (id == null) return undefined
  return [{ field: 'clothes_id', value: id }]
})

function getMatchingCover(item: MatchingListItem): string {
  if (item.cover) return item.cover
  if (item.clothes_list?.length && item.clothes_list[0].clothes_img) {
    return item.clothes_list[0].clothes_img
  }
  if (item.library_list?.length) {
    const lib = item.library_list[0]
    return lib.cover ?? lib.square_cover ?? ''
  }
  return ''
}

function parseMatchingSeasons(season?: string | null): string[] {
  if (!season) return []
  return season.split(',').map((s) => s.trim()).filter(Boolean)
}

const MATCHING_SEASON_THEME_CLASS: Record<string, string> = {
  春: 'matching-season-capsule--spring',
  夏: 'matching-season-capsule--summer',
  秋: 'matching-season-capsule--autumn',
  冬: 'matching-season-capsule--winter'
}

function getMatchingSeasonThemeClass(season: string): string {
  return MATCHING_SEASON_THEME_CLASS[season] ?? 'matching-season-capsule--default'
}

function getMatchingSeasonCapsuleClass(season: string): string {
  return `matching-season-capsule ${getMatchingSeasonThemeClass(season)}`
}

const fetchMatchingListCount = async () => {
  const clothesId = clothesMemoryPkId.value
  if (clothesId == null) return
  try {
    const res = await getMatchingListListVisitor({
      page: 1,
      pageSize: 1,
      keyword: '',
      filter_list: clothesMatchingFilterList.value as unknown as Record<string, unknown>
    })
    matchingCount.value = res.count ?? 0
    onMatchingCountChange(matchingCount.value)
  } catch {
    /* 保持原数量 */
  }
}

const fetchMatchingList = async (reset = false) => {
  const clothesId = clothesMemoryPkId.value
  if (clothesId == null || matchingListLoading.value) return
  if (reset) {
    matchingListPage.value = 1
    matchingListItems.value = []
  }
  matchingListLoading.value = true
  try {
    const res = await getMatchingListListVisitor({
      page: matchingListPage.value,
      pageSize: MATCHING_LIST_PAGE_SIZE,
      keyword: '',
      filter_list: clothesMatchingFilterList.value as unknown as Record<string, unknown>
    })
    matchingListTotal.value = res.count ?? 0
    onMatchingCountChange(matchingListTotal.value)
    const rows = res.rows ?? []
    if (reset || matchingListPage.value === 1) {
      matchingListItems.value = rows
    } else {
      matchingListItems.value.push(...rows)
    }
  } catch {
    toast.add({
      title: '加载搭配列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    matchingListLoading.value = false
  }
}

const loadMoreMatchingList = () => {
  if (matchingListLoading.value) return
  if (matchingListItems.value.length >= matchingListTotal.value) return
  matchingListPage.value += 1
  void fetchMatchingList()
}

const jumpToMatchingDetail = (item: MatchingListItem) => {
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  if (!item.matching_id) return
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?url=https://lolitalibrary.com/matching/detail/${item.matching_id}`
    })
  } else if (port.value) {
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: { url: `https://lolitalibrary.com/matching/detail/${item.matching_id}` }
    }))
  } else {
    window.open(`/matching/detail/${item.matching_id}`, '_blank')
  }
}

function openNewMatching(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const d = detail.value
  if (!d?.clothes_id) return
  showMatchingListModal.value = false
  matchingAddEditRef.value?.showModel([{
    clothes_id: d.clothes_id,
    clothes_img: d.clothes_img,
    clothes_note: d.clothes_note,
    library_id: d.library_id
  }])
}

function onMatchingAddSuccess() {
  matchingListRefreshKey.value += 1
  void fetchMatchingListCount()
  if (showMatchingListModal.value) {
    void fetchMatchingList(true)
  }
}

function isMyMatchingItem(item: MatchingListItem): boolean {
  const myId = user.user?.user_id
  if (myId == null) return false
  return item.user_id === myId
}

function openDeleteMatchingConfirm(item: MatchingListItem) {
  deletingMatchingItem.value = item
  showDeleteMatchingModal.value = true
}

async function confirmDeleteMatching() {
  const item = deletingMatchingItem.value
  if (!item?.matching_id) {
    showDeleteMatchingModal.value = false
    return
  }
  matchingDeleteLoading.value = true
  try {
    await deleteMatchingList({ matching_id: item.matching_id })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    matchingListItems.value = matchingListItems.value.filter(
      (i) => i.matching_id !== item.matching_id
    )
    matchingListTotal.value = Math.max(0, matchingListTotal.value - 1)
    onMatchingCountChange(matchingListTotal.value)
    matchingListRefreshKey.value += 1
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    matchingDeleteLoading.value = false
    showDeleteMatchingModal.value = false
    deletingMatchingItem.value = null
  }
}

onMounted(async () => {
  restoreHeaderCollapsedPref()
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  if (isInUniApp || port.value) {
    void wardrobeStore.getWardrobeConfig()
  }
  void fetchMemoryListCount()
  void fetchMatchingListCount()
  setTimeout(async () => {
    await fetchClothesDetail()
  })
})

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId === oldId) return
    memoryCount.value = 0
    matchingCount.value = 0
    void fetchMemoryListCount()
    void fetchMatchingListCount()
    detail.value = null
    void fetchClothesDetail()
  }
)

watch(showMemoryListModal, (open) => {
  if (!open) void fetchMemoryListCount()
})

watch(showMatchingListModal, (open) => {
  if (open) {
    void fetchMatchingList(true)
  } else {
    void fetchMatchingListCount()
  }
})

useHead({
  title: detail.value?.clothes_note || '服饰详情',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.clothes_note || ''} Lo研社,Lolita服饰,Lolita衣柜`
    },
    {
      name: 'description',
      content: detail.value?.clothes_note || 'Lolita服饰详情'
    }
  ]
})
const jumpToScene = (sence_id: number) => {
  const sceneUrl = `/scene/detail/${sence_id}?edit=1`
  const fullUrl = `https://lolitalibrary.com${sceneUrl}`

  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境 - 使用 outerlink
    uni.navigateTo({
      url: `/pages/common/outerLink?url=${fullUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else if (port.value) {
    // 鸿蒙系统 - 使用 outerlink
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: {
        url: fullUrl
      }
    }))
  } else {
    // 普通浏览器环境
    window.open(sceneUrl, '_blank')
  }
}

// 移除场景
const removeScene = async () => {
  await updateClothes({
    clothes_id: detail.value?.clothes_id,
    sence_id: null
  })
  await fetchClothesDetail()
  showRemoveSceneModal.value = false
}

// 显示场景选择对话框
const showChooseScene = (event?: MouseEvent) => {
  // 记录触发位置
  if (event) {
    sceneChooseClickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    sceneChooseClickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }
  // 显示选择对话框
  showSceneChooseModal.value = true
}

// 关闭场景选择对话框
const handleSceneChooseClose = () => {
  showSceneChooseModal.value = false
}

// 套用模版
const chooseTemplate = () => {
  // 套用模版 - 先空实现
  showSceneChooseModal.value = false
  // TODO: 实现套用模版功能
}

// 选择现有场景
const chooseExistingScene = () => {
  // 选择现有场景
  showSceneChooseModal.value = false
  // 使用 nextTick 确保模态框关闭后再打开场景选择器
  nextTick(() => {
    if (SceneChooseRef.value) {
      // 创建一个模拟的 MouseEvent，使用之前记录的点击位置
      const mockEvent = {
        clientX: sceneChooseClickPosition.value.x,
        clientY: sceneChooseClickPosition.value.y
      } as MouseEvent
      SceneChooseRef.value.showModel(mockEvent)
    }
  })
}

// 选择场景后的回调
const chooseScene = async (list: Scene[]) => {
  if (list.length > 0 && detail.value) {
    const selectedScene = list[0]
    try {
      await updateClothes({
        clothes_id: detail.value.clothes_id,
        sence_id: selectedScene.sence_id
      })
      // 更新本地数据
      if (detail.value) {
        detail.value.plan_id = selectedScene.sence_id
        detail.value.sence_id = selectedScene.sence_id
      }
      toast.add({
        title: '关联场景成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
      // 刷新详情数据
      await fetchClothesDetail()
    } catch (error) {
      toast.add({
        title: '关联场景失败',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
    }
  }
}

// PhysicsDrop 组件相关 - 从接口返回的 model_list 动态生成
const physicsDropModels = computed(() => {
  // 没有服饰详情或没有模型列表时不展示
  const modelList = detail.value?.model_list
  if (!detail.value || !Array.isArray(modelList)) {
    return []
  }

  return modelList
    // 只取启用并且有 material_box 的数据
    .filter((item): item is MaterialForeign & { material_box: NonNullable<Material> } => {
      return !!item && item.is_enable === 0 && !!item.material_box && !!item.material_box.materia_url
    })
    // 格式化成 PhysicsDrop 组件需要的结构
    .map((item) => ({
      url: item.material_box.materia_url,
      id: item.materia_id ?? item.material_box.materia_id,
      name: item.material_box.materia_title || '未命名',
      options: item.material_box.options || { useDracoLoader: true }
    }))
})

const handleObjectClick = (data: { url: string; name: string; id: string | number }) => {
  console.log('点击了物体:', data)
  // toast.add({
  //   title: `点击了: ${data.name}`,
  //   description: `ID: ${data.id}`,
  //   icon: 'i-heroicons-information-circle',
  //   color: 'blue'
  // })
}

// PhysicsDrop 显示/隐藏控制 - 与 library detail 共用缓存
const PHYSICS_DROP_VISIBLE_KEY = 'physicsDropVisible'
// 从 localStorage 读取初始状态，默认显示
const getInitialVisibility = (): boolean => {
  if (import.meta.client) {
    const savedState = localStorage.getItem(PHYSICS_DROP_VISIBLE_KEY)
    return savedState !== null ? savedState === 'true' : true
  }
  return true
}
const isPhysicsDropVisible = ref(getInitialVisibility())

// 切换显示/隐藏状态
const togglePhysicsDrop = () => {
  isPhysicsDropVisible.value = !isPhysicsDropVisible.value
  if (import.meta.client) {
    localStorage.setItem(PHYSICS_DROP_VISIBLE_KEY, String(isPhysicsDropVisible.value))
  }
}

// ---------- 计划相关逻辑（参考计划页面） ----------
const getPlanListId = () => detail.value?.plan?.list_id ?? detail.value?.plan_id

// 完成计划（主计划）
const confirmCompletePlan = () => {
  completePlanListId.value = getPlanListId() ?? null
  showCompletePlanModal.value = true
}

// 完成子计划
const confirmCompleteChildPlan = (child: { list_id?: number }) => {
  if (!child?.list_id) return
  completePlanListId.value = child.list_id
  showCompletePlanModal.value = true
}

const handleCompletePlan = async () => {
  const listId = completePlanListId.value ?? getPlanListId()
  if (!listId) return
  planCompleteLoading.value = true
  try {
    await planComplete({ list_id: listId })
    toast.add({ title: '计划已完成', icon: 'i-heroicons-check-circle', color: 'green' })
    showCompletePlanModal.value = false
    completePlanListId.value = null
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '完成失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planCompleteLoading.value = false
  }
}

// 移除计划（取消服饰与计划的关联）
const confirmRemovePlan = () => {
  showRemovePlanModal.value = true
}

const handleRemovePlan = async () => {
  if (!detail.value?.clothes_id) return
  planRemoveLoading.value = true
  try {
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: null })
    toast.add({ title: '已移除计划', icon: 'i-heroicons-check-circle', color: 'green' })
    showRemovePlanModal.value = false
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '移除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planRemoveLoading.value = false
  }
}

// 删除计划（彻底删除计划，参考计划页面）
const confirmDeletePlan = () => {
  showDeletePlanModal.value = true
}

const handleDeletePlan = async () => {
  const listId = getPlanListId()
  if (!listId || !detail.value?.clothes_id) return
  planDeleteLoading.value = true
  try {
    await deletePlanList({ list_id: listId })
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: null })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    showDeletePlanModal.value = false
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    planDeleteLoading.value = false
  }
}

// 添加计划
const showAddPlan = (e?: MouseEvent) => {
  planAddEditRef.value?.showModel(e)
}

const onPlanAddSuccess = async (data: { list_id?: number }) => {
  if (!detail.value?.clothes_id || !data?.list_id) return
  try {
    await updateClothes({ clothes_id: detail.value.clothes_id, plan_id: data.list_id })
    toast.add({ title: '关联计划成功', icon: 'i-heroicons-check-circle', color: 'green' })
    await fetchClothesDetail()
  } catch (error) {
    toast.add({ title: '关联失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

// 编辑计划
const showEditPlan = (e?: MouseEvent) => {
  if (!detail.value?.plan) return
  planAddEditRef.value?.showModel(e)
}
</script>

<template>
  <div class="wardrobe-page-neu">
    <div
      v-if="detail"
      class="clothes-fab-stack fixed top-20 right-3 max-md:top-16 max-md:right-2 z-[60] flex flex-col items-end gap-1"
    >
      <button
        type="button"
        class="clothes-fab-btn clothes-fab-btn--toggle"
        :aria-expanded="fabActionsExpanded"
        :aria-label="fabActionsExpanded ? '收起记忆与搭配' : '展开记忆与搭配'"
        @click="toggleFabActions"
      >
        <UIcon
          name="i-heroicons-chevron-down-20-solid"
          class="clothes-fab-toggle-icon h-3 w-3 shrink-0"
          :class="{ 'clothes-fab-toggle-icon--expanded': fabActionsExpanded }"
        />
        <span
          v-if="!fabActionsExpanded && fabTotalBadgeCount > 0"
          class="clothes-fab-badge"
        >{{ fabTotalBadgeCount > 99 ? '99+' : fabTotalBadgeCount }}</span>
      </button>
      <Transition name="clothes-fab-panel">
        <div
          v-if="fabActionsExpanded"
          class="clothes-fab-actions-panel flex flex-col items-end gap-1"
        >
          <button
            type="button"
            class="clothes-fab-btn clothes-fab-btn--action"
            @click="showMemoryListModal = true"
          >
            <span class="clothes-fab-btn__inner">
              <UIcon name="i-heroicons-sparkles" class="clothes-fab-btn__icon" />
              <span class="clothes-fab-btn__label">记忆</span>
              <span
                v-if="memoryCount > 0"
                class="clothes-fab-badge clothes-fab-badge--corner"
              >{{ memoryCount > 99 ? '99+' : memoryCount }}</span>
            </span>
          </button>
          <button
            type="button"
            class="clothes-fab-btn clothes-fab-btn--action"
            @click="showMatchingListModal = true"
          >
            <span class="clothes-fab-btn__inner">
              <UIcon name="material-symbols:style" class="clothes-fab-btn__icon" />
              <span class="clothes-fab-btn__label">搭配</span>
              <span
                v-if="matchingCount > 0"
                class="clothes-fab-badge clothes-fab-badge--corner"
              >{{ matchingCount > 99 ? '99+' : matchingCount }}</span>
            </span>
          </button>
        </div>
      </Transition>
    </div>

    <Transition name="clothes-swipe-guide">
      <div
        v-if="showSwipeGuide"
        class="clothes-swipe-guide-root pointer-events-none fixed inset-0 z-[61] flex items-center justify-center px-6"
        aria-hidden="true"
      >
        <div class="clothes-swipe-guide-backdrop" />
        <div class="clothes-swipe-guide-content pointer-events-none relative z-[1] max-w-[18rem] text-center">
          <div class="clothes-swipe-guide-hint-row mb-2.5 flex items-center justify-center">
            <UIcon
              name="material-symbols:swipe-outline-rounded"
              class="clothes-swipe-guide-hand-icon h-16 w-16 text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.4)]"
            />
          </div>
          <p class="text-[13px] leading-snug text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
            左右滑动可切换服饰
          </p>
        </div>
      </div>
    </Transition>

    <QhxModal v-model="showMemoryListModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-pink-50/90 to-purple-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">记忆</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showMemoryListModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-2 md:p-6 overflow-y-auto flex-1 min-h-0">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
            发帖记录你与小裙子之间的美好记忆
          </p>
          <div class="flex flex-wrap gap-2 justify-center mb-4">
            <button
              type="button"
              class="modal-capsule-btn"
              :disabled="memoryForeignLinkLoading || clothesMemoryPkId == null"
              @click="openMemoryChooseCommunity($event)"
            >
              <UIcon
                :name="memoryForeignLinkLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-link'"
                :class="['w-4 h-4 shrink-0', memoryForeignLinkLoading && 'animate-spin']"
              />
              <span>关联已有帖子</span>
            </button>
            <button
              type="button"
              class="modal-capsule-btn"
              :disabled="clothesMemoryPkId == null"
              @click="goNewMemoryPost($event)"
            >
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 shrink-0" />
              <span>写新记忆</span>
            </button>
          </div>
          <CommunityForeignList
            v-if="showMemoryListModal && clothesMemoryPkId != null"
            :key="memoryListRefreshKey"
            :pk_type="MEMORY_PK_TYPE"
            :pk_id="clothesMemoryPkId"
            single-column
            allow-delete-foreign
            @count-change="onMemoryCountChange"
          />
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showMatchingListModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-purple-50/90 to-pink-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">搭配</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showMatchingListModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-2 md:p-6 overflow-y-auto flex-1 min-h-0">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
            包含本条裙子的搭配清单
          </p>
          <div class="flex flex-wrap gap-2 justify-center mb-4">
            <button
              type="button"
              class="modal-capsule-btn"
              :disabled="clothesMemoryPkId == null"
              @click="openNewMatching($event)"
            >
              <UIcon name="i-heroicons-plus" class="w-4 h-4 shrink-0" />
              <span>新建搭配</span>
            </button>
          </div>
          <div
            v-if="matchingListLoading && matchingListItems.length === 0"
            class="flex flex-col items-center justify-center gap-3 py-16 text-gray-500"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin" />
            <span class="text-sm">加载中…</span>
          </div>
          <div
            v-else-if="matchingListItems.length === 0"
            class="text-center py-12 text-sm text-gray-500 dark:text-gray-400"
          >
            暂无包含本条裙子的搭配
          </div>
          <div v-else :key="matchingListRefreshKey" class="space-y-2.5">
            <div
              v-for="item in matchingListItems"
              :key="item.matching_id"
              class="group flex items-stretch gap-3 p-3 rounded-2xl bg-white/80 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700/60 cursor-pointer transition-all duration-200 hover:border-qhx-primary/35 hover:shadow-md hover:shadow-qhx-primary/10 dark:hover:border-pink-400/30"
              @click="jumpToMatchingDetail(item)"
            >
              <div class="relative w-[4.5rem] h-[4.5rem] shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 ring-1 ring-black/5 dark:ring-white/10">
                <img
                  v-if="getMatchingCover(item)"
                  :src="`${BASE_IMG}${getMatchingCover(item)}?x-oss-process=image/quality,q_80/resize,w_200`"
                  :alt="item.note || '搭配'"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-gray-400"
                >
                  <UIcon name="material-symbols:style" class="text-2xl" />
                </div>
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                <div class="font-medium text-[15px] text-gray-900 dark:text-gray-100 line-clamp-1">
                  {{ item.note || '未命名搭配' }}
                </div>
                <div v-if="item.main_style" class="text-xs text-qhx-primary/90 dark:text-pink-300/90 line-clamp-1">
                  {{ item.main_style.split(',').map((s) => `★${s}`).join(' ') }}
                </div>
                <div v-if="item.user_name" class="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                  {{ item.user_name }}
                </div>
                <div
                  v-if="parseMatchingSeasons(item.season).length > 0"
                  class="flex flex-wrap gap-1 mt-0.5"
                >
                  <span
                    v-for="(seasonItem, seasonIndex) in parseMatchingSeasons(item.season)"
                    :key="`${item.matching_id}-season-${seasonIndex}`"
                    :class="getMatchingSeasonCapsuleClass(seasonItem)"
                  >
                    {{ seasonItem }}
                  </span>
                </div>
              </div>
              <button
                v-if="isMyMatchingItem(item)"
                type="button"
                class="shrink-0 self-center w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="删除搭配"
                @click.stop="openDeleteMatchingConfirm(item)"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
            </div>
            <div v-if="matchingListItems.length < matchingListTotal" class="flex justify-center pt-2">
              <button
                type="button"
                class="modal-capsule-btn modal-capsule-btn--soft"
                :disabled="matchingListLoading"
                @click="loadMoreMatchingList"
              >
                <UIcon
                  v-if="matchingListLoading"
                  name="i-heroicons-arrow-path"
                  class="w-4 h-4 shrink-0 animate-spin"
                />
                <span>加载更多</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </QhxModal>

    <CommunityChoose
      ref="memoryCommunityChooseRef"
      :only-mine="true"
      title="选择要关联的帖子"
      placeholder="搜索我的帖子..."
      @choose="onMemoryCommunityChosen"
    />

    <MatchingAddEdit ref="matchingAddEditRef" @success="onMatchingAddSuccess" />

    <QhxModal
      v-model="showDeleteMatchingModal"
      :close-on-backdrop="!matchingDeleteLoading"
    >
      <div class="capsule-confirm-card">
        <h3 class="capsule-confirm-card__title">操作确认</h3>
        <p class="capsule-confirm-card__desc">
          确定要删除该搭配吗？删除后将无法恢复。
        </p>
        <div class="capsule-confirm-card__actions">
          <button
            type="button"
            class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1"
            :disabled="matchingDeleteLoading"
            @click="showDeleteMatchingModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="modal-capsule-btn modal-capsule-btn--danger w-full min-w-0 sm:flex-1"
            :disabled="matchingDeleteLoading"
            @click="confirmDeleteMatching"
          >
            <UIcon
              v-if="matchingDeleteLoading"
              name="i-heroicons-arrow-path"
              class="w-4 h-4 shrink-0 animate-spin"
            />
            <span>确定删除</span>
          </button>
        </div>
      </div>
    </QhxModal>

    <CommunityPostModal
      ref="clothesMemoryPostModalRef"
      v-model="showClothesMemoryPostModal"
      :foreign-pk="memoryPostForeignForModal"
      modal-title="写新记忆"
      :skip-summary-link="true"
      :success-redirect="false"
      @success="onClothesMemoryPostSuccess"
    />

    <clothes-add ref="addEditClothesRef" @success="onEditSuccess"></clothes-add>
    <PlanAddEdit
      ref="planAddEditRef"
      :plan-list="detail?.plan ?? null"
      :initial-need-money="detail?.price ?? 0"
      enable-link-clothes
      :linked-clothes="planAddEditLinkedClothes"
      @insert="onPlanAddSuccess"
      @updated="() => fetchClothesDetail()"
    />
    <WardrobeClothesChoose
      ref="wardrobeClothesChooseRef"
      multiple
      :max-count="linkClothesRemainingSlots"
      @choose-multiple="handleLinkClothesChoose"
    />
    <QhxSelect
      ref="wardrobeStatusSelectRef"
      :options="wardrobe_status_options"
      :can-customize="true"
      @select="onWardrobeStatusSelect"
    />

    <Transition :name="slideTransitionName" mode="out-in">
    <div
      v-if="detail && detail.sence_id"
      :key="`scene-${clothesRouteId}`"
      class="relative min-h-[100dvh]"
      :class="{ 'touch-pan-y': isMobile }"
      @pointerdown="swipePointerDown"
      @pointerup="swipePointerUp"
      @pointercancel="swipePointerCancel"
    >
      <!-- 全屏场景背景 -->
      <div class="fixed inset-0 w-screen h-screen z-0">
        <iframe :src="`https://lolitalibrary.com/scene/detail/${detail.sence_id}?from_iframe=true`" class="w-full h-full border-0"
          frameborder="0"></iframe>
      </div>

      <!-- 可拖拽的半模态框 -->
      <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
        <QhxBottomDrawer v-if="detail" glass :direction="isMobile ? 'bottom' : 'right'">
        <div v-if="detail">
          <div class="pt-3 pb-2">
                  <div
                    class="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
                    :class="headerCollapsed ? 'mb-0' : 'mb-1'"
                    :style="{ gridTemplateRows: headerCollapsed ? '0fr' : '1fr' }"
                  >
                    <div class="relative w-full min-h-0 overflow-hidden">
                      <!-- 功能栏 -->
                      <div class="flex items-center justify-end gap-1 flex-wrap">
                        <ClothesShareImage ref="clothesShareImageRef" variant="toolbar" :source="clothesShareSource" />
                        <div v-if="isOwner" class="flex justify-end gap-1 flex-wrap">
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showRemoveSceneModal = true">
                          <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-red-500 text-white">
                            <UIcon name="i-heroicons-trash" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">移除场景</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="jumpToScene(detail.sence_id)">
                          <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                            <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">编辑场景</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="copyClothes">
                          <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                            <UIcon name="i-heroicons-document-duplicate" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">复制</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="editClothes">
                          <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                            <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">修改</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="openLinkClothesChoose">
                          <div
                            class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white"
                            :class="linkClothesLoading ? 'opacity-70' : ''"
                          >
                            <UIcon name="i-heroicons-link" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">关联服饰</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showDeleteModal = true">
                          <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-red-500 text-white">
                            <UIcon name="i-heroicons-trash" class="text-[16px]" />
                          </div>
                          <div class="text-xs text-qhx-text">删除</div>
                        </div>
                      </QhxJellyButton>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 展开/收起功能栏 -->
                  <div class="flex justify-center items-center gap-2 mb-3 relative z-10">
                    <button
                      type="button"
                      class="wardrobe-collapse-toggle"
                      :title="headerCollapsed ? '展开功能栏' : '收起功能栏'"
                      :aria-label="headerCollapsed ? '展开功能栏' : '收起功能栏'"
                      @click="toggleHeaderCollapsed"
                    >
                      <UIcon
                        :name="headerCollapsed ? 'material-symbols:expand-more' : 'material-symbols:expand-less'"
                        class="text-[16px]"
                      />
                    </button>
                    <button
                      v-if="headerCollapsed"
                      type="button"
                      class="wardrobe-collapse-toggle"
                      title="分享图"
                      aria-label="分享图"
                      @click="openClothesShareFromCollapse"
                    >
                      <UIcon name="i-heroicons-photo-20-solid" class="text-[16px]" />
                    </button>
                  </div>
                  <div class="space-y-3">
                    <h2 :class="['text-xl font-bold min-w-0 max-md:pt-0', clothesPlateTitle]">
                      {{ detail.clothes_note || '暂无名称' }}
                    </h2>

                  <!-- 信息内容 -->
                  <div class="clothes-detail-plate space-y-3">
                    <!-- 笔记 -->
                    <div v-if="detail.note" :class="[clothesPlateRow, 'text-gray-600 dark:text-gray-400']">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 喜爱级别（0–5 星） -->
                    <div v-if="detail.is_favorite !== undefined" class="flex flex-wrap items-center gap-2">
                      <span :class="clothesPlateLabelMuted">喜爱级别：</span>
                      <div v-if="isOwner" class="flex flex-wrap items-center gap-2">
                        <div :class="favoriteNeuPanel">
                          <button v-for="s in 5" :key="s" type="button"
                            class="text-2xl leading-none rounded-lg p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.5)] dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]"
                            :aria-label="`设为 ${s} 星`" @click="setFavoriteLevel(s)">
                            <UIcon
                              :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                              :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                          </button>
                        </div>
                        <button v-if="favoriteLevelDisplay > 0" type="button" :class="favoriteNeuMiniBtn"
                          @click="setFavoriteLevel(0)">
                          清空
                        </button>
                      </div>
                      <div v-else :class="['inline-flex items-center gap-2', favoriteNeuPanel]">
                        <UIcon v-for="s in 5" :key="s"
                          :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                          class="text-xl"
                          :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                        <span class="text-sm text-gray-700 dark:text-gray-200">（{{ favoriteLevelDisplay }} 星）</span>
                      </div>
                    </div>

                    <!-- 拥有状态 -->
                    <div v-if="isOwner || detail.wardrobe_status" class="flex flex-wrap items-center gap-2">
                      <span :class="clothesPlateLabelMuted">拥有状态：</span>
                      <template v-if="isOwner">
                        <button
                          v-if="detail.wardrobe_status"
                          type="button"
                          class="cursor-pointer rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary"
                          @click="openWardrobeStatusPicker($event)"
                        >
                          <QhxTag :active="true">{{ detail.wardrobe_status }}</QhxTag>
                        </button>
                        <button v-else type="button" :class="favoriteNeuMiniBtn" @click="openWardrobeStatusPicker($event)">
                          选择状态
                        </button>
                        <button
                          v-if="detail.wardrobe_status"
                          type="button"
                          :class="favoriteNeuMiniBtn"
                          @click="clearWardrobeStatus"
                        >
                          清空
                        </button>
                      </template>
                      <span v-else class="text-sm">{{ detail.wardrobe_status }}</span>
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span :class="clothesPlateLabel">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <QhxNumberStepper v-model="detail.num" :min="1" @change="updateNum" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price || planPriceDisplay" :class="clothesPlateRow">
                      <template v-if="detail.price">价格：￥{{ detail.price }}</template>
                      <div
                        v-if="planPriceDisplay"
                        class="text-gray-500 dark:text-gray-400"
                        :class="{ 'mt-0.5': detail.price }"
                      >
                        <template v-if="planPriceDisplay.kind === 'breakdown'">
                          定尾：<template v-for="(p, i) in planPriceDisplay.segmentPrices" :key="i">
                            <template v-if="i > 0"> + </template>￥{{ p }}
                          </template>
                          <span> = ￥{{ planPriceDisplay.total }}</span>
                        </template>
                        <template v-else>定尾：￥{{ planPriceDisplay.amount }}</template>
                      </div>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" :class="clothesPlateRow">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" :class="clothesPlateRow">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span :class="clothesPlateLabel">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <QhxNumberStepper v-model="detail.times" :min="0" @change="updateTimes" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" :class="clothesPlateRow">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" :class="clothesPlateRow">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>
                    <!-- 关联服饰 -->
                    <div v-if="detail.include && detail.include.length > 0" class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between mb-2">
                        <h3 :class="clothesPlateSectionSm">关联服饰</h3>
                        <button
                          v-if="isOwner"
                          type="button"
                          class="clothes-detail-sort-toggle text-xs px-2 py-1 rounded transition-colors"
                          :class="sortMode ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
                          @click="sortMode = !sortMode">
                          {{ sortMode ? '退出排序' : '排序模式' }}
                        </button>
                      </div>
                      <ul class="space-y-2">
                        <li
                          v-for="(item, index) in detail.include"
                          :key="item.clothes_id"
                          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                          :class="{ 'cursor-pointer': !sortMode }"
                          @click="!sortMode && jumpToClothes(item)">
                          <img
                            :src="`${BASE_IMG}${item.clothes_img || ''}${config.config?.image_params || ''}`"
                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            :alt="item.clothes_note" />
                          <div class="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                            <span class="text-sm font-serif leading-snug truncate">{{ item.clothes_note || item.library?.name || '未命名' }}</span>
                            <span
                              v-if="item.price !== undefined && item.price !== null && item.price !== ''"
                              class="text-xs font-semibold tabular-nums text-qhx-primary"
                            >￥{{ item.price }}</span>
                          </div>
                          <template v-if="isOwner && sortMode">
                            <div class="flex items-center gap-1 flex-shrink-0">
                              <button
                                v-if="index !== 0"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="upItem(index)">
                                <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" />
                              </button>
                              <button
                                v-if="index < detail.include.length - 1"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="downItem(index)">
                                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                              </button>
                            </div>
                          </template>
                          <UIcon v-else name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </li>
                      </ul>
                    </div>
                    <div
                      v-if="includeOutfitPriceBreakdown"
                      class="rounded-lg bg-gradient-to-r from-qhx-primary/20 via-orange-50 to-amber-50 py-1 text-sm font-semibold font-serif leading-snug text-gray-900 dark:from-qhx-primary/35 dark:via-amber-950/50 dark:to-orange-950/40 dark:text-gray-50"
                    >
                      <template v-if="includeOutfitPriceBreakdown.segmentPrices.length">
                        总价：<template v-for="(p, i) in includeOutfitPriceBreakdown.segmentPrices" :key="i">
                          <template v-if="i > 0"> + </template>
                          <span class="text-qhx-primary dark:text-qhx-primary">￥{{ p }}</span>
                        </template>
                        <span class="text-qhx-primary dark:text-qhx-primary"> = ￥{{ includeOutfitPriceBreakdown.total }}</span>
                      </template>
                      <template v-else><span class="text-qhx-primary dark:text-qhx-primary">总价：￥0</span></template>
                    </div>
                    <!-- 来源 -->
                    <div v-if="!detail.library && !detail.origin_shop && detail.origin" :class="clothesPlateRow">
                      来源：{{ detail.origin }}
                    </div>

                    <!-- 尾款计划 -->
                    <div v-if="detail.plan_id || detail.plan" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold font-serif tracking-wide text-amber-700 dark:text-amber-300">尾款计划</span>
                        <!-- 计划操作按钮（仅所有者） -->
                        <div v-if="isOwner" class="flex items-center gap-1 ml-auto">
                          <template v-if="detail.plan?.is_complete !== 1">
                            <button
                              type="button"
                              class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded"
                              @click="confirmCompletePlan"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                              title="编辑"
                              @click="showEditPlan"
                            >
                              <UIcon name="i-heroicons-pencil" class="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="移除"
                              @click="confirmRemovePlan"
                            >
                              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                            </button>
                          </template>
                          <button
                            type="button"
                            class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="删除计划"
                            @click="confirmDeletePlan"
                          >
                            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div class="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/50 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-gray-600 dark:text-gray-400">{{ detail.plan?.plan_name || '尾款计划' }}</span>
                          <span class="text-base font-bold text-amber-600 dark:text-amber-400">￥{{ detail.plan?.need_money ?? 0 }}</span>
                        </div>
                        <div v-if="detail.plan?.have_money != null" class="text-xs text-gray-500 dark:text-gray-400">
                          已攒：￥{{ detail.plan.have_money }}
                        </div>
                        <div v-if="detail.plan?.end_time" class="text-xs text-gray-500 dark:text-gray-400">
                          尾款时间：{{ formatDate(detail.plan.end_time) }}
                        </div>
                        <!-- 子计划列表 -->
                        <div
                          v-if="detail.plan?.plan_list && detail.plan.plan_list.length > 0"
                          class="ml-2 pl-2 border-l-2 border-amber-200/60 dark:border-amber-600/40 space-y-1 mt-2"
                        >
                          <div
                            v-for="(child, idx) in detail.plan.plan_list"
                            :key="child.list_id ?? idx"
                            class="flex items-center justify-between gap-2 text-xs"
                          >
                            <span class="text-gray-600 dark:text-gray-400 flex-1 truncate">{{ child.plan_note || `阶段 ${idx + 1}` }}</span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">￥{{ child.need_money ?? 0 }}</span>
                            <button
                              v-if="isOwner && child.is_complete !== 1"
                              type="button"
                              class="px-2 py-0.5 text-[10px] bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded flex-shrink-0"
                              @click="confirmCompleteChildPlan(child)"
                            >
                              完成
                            </button>
                            <span v-else-if="child.is_complete === 1" class="text-gray-400 text-[10px] flex-shrink-0">已完成</span>
                          </div>
                        </div>
                        <!-- <NuxtLink
                          v-if="detail.plan?.list_id"
                          :to="`/user/plan`"
                          class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          查看计划详情
                          <UIcon name="i-heroicons-arrow-right" class="text-xs" />
                        </NuxtLink> -->
                      </div>
                    </div>
                    <!-- 无计划时显示添加按钮 -->
                    <div v-else-if="isOwner" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold font-serif tracking-wide text-amber-700 dark:text-amber-300">尾款计划</span>
                      </div>
                      <button
                        type="button"
                        class="modal-capsule-btn modal-capsule-btn--amber"
                        @click="showAddPlan"
                      >
                        <UIcon name="i-heroicons-plus" class="w-4 h-4 shrink-0" />
                        <span>添加尾款计划</span>
                      </button>
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div :class="clothesPlateName">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" :class="[clothesPlateRow, 'mb-2']">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" :class="[clothesPlateRow, 'mb-2']">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        :class="[clothesPlateRow, 'mb-2 flex items-center gap-2 flex-wrap']">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" :class="[clothesPlateRow, 'mb-2 flex items-center gap-2 flex-wrap']">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 来源店铺 -->
                    <div v-if="detail.origin_shop" class="border-t pt-3 mt-3">
                      <h3 :class="clothesPlateSectionLg">来源店铺</h3>
                      <div class="clothes-scene-glass-panel flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-colors hover:bg-white/30 dark:hover:bg-white/10"
                        @click="jumpToShop(detail.origin_shop!.shop_id)">
                        <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.origin_shop.shop_name" />
                        <div :class="clothesPlateName">{{ detail.origin_shop.shop_name }}</div>
                      </div>
                    </div>

                    <!-- 详情图片列表 -->
                    <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                      <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                        :list="clothesPreviewItem(img, detail.clothes_note || '')"
                        :preview="mapOwnerLargeImageParams(detail.detail_image_list)"
                        className="w-full rounded-lg" />
                    </div>

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <button type="button" class="modal-capsule-btn" @click="jumpToWardrobe">
                        查看该衣柜
                      </button>
                    </div>

                    <!-- 是否共享 -->
                    <div class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between gap-3">
                        <span :class="clothesPlateLabelMuted">是否共享</span>
                        <UToggle
                          v-if="isOwner"
                          :model-value="isShared"
                          :disabled="sharedLoading"
                          @update:model-value="setShared($event ? 1 : 0)"
                        />
                        <span v-else class="text-sm font-medium" :class="isShared ? 'text-qhx-primary' : 'text-gray-500'">
                          {{ isShared ? '已共享' : '未共享' }}
                        </span>
                      </div>
                      <p v-if="isShared" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        当前为共享状态，服饰数据公开，其他用户可以直接导入
                      </p>
                      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        开启后可以向其他用户共享该服饰数据！
                      </p>
                      <div v-if="isShared" class="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <UIcon name="i-heroicons-heart" class="text-red-500" />
                          赞数 {{ displayGoodCount }}
                        </span>
                        <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <UIcon name="i-heroicons-link" class="text-qhx-primary" />
                          引用数 {{ displayCitationCount }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
          </div>
        </div>
      </QhxBottomDrawer>
      </Transition>
    </div>
    <div
      v-else-if="detail && !detail.sence_id"
      :key="`plain-${clothesRouteId}`"
      class="container mx-auto px-4 pb-4 max-md:px-0 max-md:pb-2 pt-[calc(1rem+env(safe-area-inset-top,0px))] max-md:pt-[calc(0.5rem+env(safe-area-inset-top,0px))] min-h-[100dvh]"
      :class="{ 'touch-pan-y': isMobile }"
      @pointerdown="swipePointerDown"
      @pointerup="swipePointerUp"
      @pointercancel="swipePointerCancel"
    >
      <!-- <div
        v-if="configStore.statusBarHeight > 0"
        :style="{ height: `${configStore.statusBarHeight}px` }"
      /> -->
      <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg">
        <div class="p-4 max-md:p-2">
                <!-- 图片区域 -->
                <div class="flex max-md:block gap-4 mb-4">
                  <!-- 主图 -->
                  <div class="flex-1 min-w-0">
                    <div v-if="detail.include && detail.include.length > 0"
                      class="mb-4 overflow-hidden w-full">
                      <div class="flex w-full">
                        <div class="w-2/3 aspect-[2/3] p-1">
                          <div class="relative h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-qhx-primary/20">
                            <ClothesDetailCoverFrame
                              v-model:show3d="cover3dActive"
                              root-class="h-full"
                              :show3d-toggle="libraryHas3d"
                              :iframe-src="humanPlatformIframeSrc"
                            >
                              <QhxPreviewImage
                                :list="clothesPreviewItem(detail.clothes_img, detail.clothes_note || '')"
                                :preview="mapOwnerLargeImageParams([detail.clothes_img])"
                                className="w-full h-full object-cover" />
                              <ClothesFavoriteCoverOverlay
                                v-if="detail.is_favorite !== undefined"
                                :level="favoriteLevelDisplay"
                              />
                            </ClothesDetailCoverFrame>
                          </div>
                        </div>
                        <div class="w-1/3">
                          <div
                            v-for="(item, index) in includeCoverPrimary"
                            :key="item.clothes_id"
                            class="w-full aspect-[1/1] p-1">
                            <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/40 group">
                              <QhxPreviewImage
                                :list="clothesPreviewItem(item.clothes_img, item.clothes_note || '')"
                                :preview="mapOwnerLargeImageParams([item.clothes_img])"
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                              <div v-if="isOwner && sortMode"
                                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center cursor-pointer z-10 shadow-lg transition-all hover:scale-110 hover:bg-red-500"
                                @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                                <UIcon name="i-heroicons-x-mark" class="text-xs font-bold" />
                              </div>
                              <div v-if="isOwner && sortMode && index < detail.include.length - 1"
                                class="absolute top-1/2 -right-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                                @click.stop="downItem(index)">
                                <UIcon name="i-heroicons-chevron-right" class="text-sm font-bold" />
                              </div>
                              <div v-if="isOwner && sortMode && index !== 0"
                                class="absolute top-1/2 -left-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                                @click.stop="upItem(index)">
                                <UIcon name="i-heroicons-chevron-left" class="text-sm font-bold" />
                              </div>
                              <div
                                class="absolute bottom-0 left-0 right-0 py-2 px-2 text-xs text-white text-center truncate cursor-pointer bg-gradient-to-t from-black/80 via-black/50 to-transparent backdrop-blur-[1px] transition-opacity hover:from-black/90"
                                @click="jumpToClothes(item)">
                                {{ item.clothes_note || item.library?.name || '' }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <template v-if="includeCoverOverflow.length > 0">
                        <div
                          v-for="(item, index) in includeCoverOverflow"
                          :key="item.clothes_id"
                          class="w-1/3 aspect-[1/1] float-left p-1">
                          <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/40 group">
                            <QhxPreviewImage
                              :list="clothesPreviewItem(item.clothes_img, item.clothes_note || '')"
                              :preview="mapOwnerLargeImageParams([item.clothes_img])"
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                            <div v-if="isOwner && sortMode"
                              class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center cursor-pointer z-10 shadow-lg transition-all hover:scale-110 hover:bg-red-500"
                              @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                              <UIcon name="i-heroicons-x-mark" class="text-xs font-bold" />
                            </div>
                            <div v-if="isOwner && sortMode && index + 3 < detail.include.length - 1"
                              class="absolute top-1/2 -right-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                              @click.stop="downItem(index + 3)">
                              <UIcon name="i-heroicons-chevron-right" class="text-sm font-bold" />
                            </div>
                            <div v-if="isOwner && sortMode"
                              class="absolute top-1/2 -left-0.5 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm text-qhx-primary flex items-center justify-center cursor-pointer z-10 shadow-md ring-1 ring-black/5 transition-all hover:scale-110 hover:shadow-lg"
                              @click.stop="upItem(index + 3)">
                              <UIcon name="i-heroicons-chevron-left" class="text-sm font-bold" />
                            </div>
                            <div
                              class="absolute bottom-0 left-0 right-0 py-2 px-2 text-xs text-white text-center truncate cursor-pointer bg-gradient-to-t from-black/80 via-black/50 to-transparent backdrop-blur-[1px] transition-opacity hover:from-black/90"
                              @click="jumpToClothes(item)">
                              {{ item.clothes_note || item.library?.name || '' }}
                            </div>
                          </div>
                        </div>
                        <div class="clear-both"></div>
                      </template>
                    </div>
                    <div
                      v-else-if="detail.clothes_part && detail.clothes_part.split(',').length > 1 && detail.detail_image_list && detail.detail_image_list.length > 0"
                      class="mb-4 overflow-hidden w-full">
                      <div class="flex w-full">
                        <div class="w-2/3 aspect-[2/3] p-1">
                          <div class="relative h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-lg">
                            <ClothesDetailCoverFrame
                              v-model:show3d="cover3dActive"
                              root-class="h-full"
                              :show3d-toggle="libraryHas3d"
                              :iframe-src="humanPlatformIframeSrc"
                            >
                              <QhxPreviewImage
                                :list="clothesPreviewItem(detail.clothes_img, detail.clothes_note || '')"
                                :preview="mapOwnerLargeImageParams([detail.clothes_img])"
                                className="w-full h-full object-cover" />
                              <ClothesFavoriteCoverOverlay
                                v-if="detail.is_favorite !== undefined"
                                :level="favoriteLevelDisplay"
                              />
                            </ClothesDetailCoverFrame>
                          </div>
                        </div>
                        <div class="w-1/3">
                          <div
                            v-for="(img, index) in detail.detail_image_list.slice(0, 3)"
                            :key="index"
                            class="w-full aspect-[1/1] p-1">
                            <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/30">
                              <QhxPreviewImage
                                :list="clothesPreviewItem(img, detail.clothes_note || '')"
                                :preview="mapOwnerLargeImageParams(detail.detail_image_list)"
                                className="w-full h-full object-cover transition-transform duration-200 hover:scale-105" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <template v-if="detail.detail_image_list.length > 3">
                        <div
                          v-for="(img, index) in detail.detail_image_list.slice(3)"
                          :key="`detail-img-${index + 3}`"
                          class="w-1/3 aspect-[1/1] float-left p-1">
                          <div class="relative w-full h-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-qhx-primary/30">
                            <QhxPreviewImage
                              :list="clothesPreviewItem(img, detail.clothes_note || '')"
                              :preview="mapOwnerLargeImageParams(detail.detail_image_list)"
                              className="w-full h-full object-cover transition-transform duration-200 hover:scale-105" />
                          </div>
                        </div>
                        <div class="clear-both"></div>
                      </template>
                    </div>
                    <div v-else class="relative w-full rounded-xl overflow-hidden shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-lg">
                      <ClothesDetailCoverFrame
                        v-model:show3d="cover3dActive"
                        root-class="w-full aspect-[3/4]"
                        :show3d-toggle="libraryHas3d"
                        :iframe-src="humanPlatformIframeSrc"
                      >
                        <QhxPreviewImage
                          :list="clothesPreviewItem(detail.clothes_img, detail.clothes_note || '')"
                          :preview="mapOwnerLargeImageParams([detail.clothes_img])"
                          className="w-full h-full object-cover" />
                        <ClothesFavoriteCoverOverlay
                          v-if="detail.is_favorite !== undefined"
                          :level="favoriteLevelDisplay"
                        />
                      </ClothesDetailCoverFrame>
                    </div>
                  </div>

                  <!-- 信息区域 -->
                  <div class="clothes-detail-plate flex-1 pt-2 max-md:pt-3">
                    <div
                      class="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
                      :class="headerCollapsed ? 'mb-0' : 'mb-1'"
                      :style="{ gridTemplateRows: headerCollapsed ? '0fr' : '1fr' }"
                    >
                      <div class="relative w-full min-h-0 overflow-hidden">
                        <!-- 功能栏 -->
                        <div class="flex items-center justify-end gap-1 flex-wrap">
                          <ClothesShareImage ref="clothesShareImageRef" variant="toolbar" :source="clothesShareSource" />
                          <div v-if="isOwner" class="flex justify-end gap-1 flex-wrap">
                            <QhxJellyButton v-if="detail.include && detail.include.length > 0">
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="sortMode = !sortMode">
                                <div
                                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center text-white"
                                  :class="sortMode ? 'bg-qhx-primary' : 'bg-qhx-info'"
                                >
                                  <UIcon name="icon-park-outline:sort-two" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">{{ sortMode ? '退出排序' : '排序模式' }}</div>
                              </div>
                            </QhxJellyButton>
                            <QhxJellyButton>
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="(e: MouseEvent) => showChooseScene(e)">
                                <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                                  <UIcon name="garden:box-3d-fill-12" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">关联3D</div>
                              </div>
                            </QhxJellyButton>
                            <QhxJellyButton>
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="copyClothes">
                                <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                                  <UIcon name="i-heroicons-document-duplicate" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">复制</div>
                              </div>
                            </QhxJellyButton>
                            <QhxJellyButton>
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="editClothes">
                                <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white">
                                  <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">编辑</div>
                              </div>
                            </QhxJellyButton>
                            <QhxJellyButton>
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="openLinkClothesChoose">
                                <div
                                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-primary text-white"
                                  :class="linkClothesLoading ? 'opacity-70' : ''"
                                >
                                  <UIcon name="i-heroicons-link" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">关联服饰</div>
                              </div>
                            </QhxJellyButton>
                            <QhxJellyButton>
                              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showDeleteModal = true">
                                <div class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-red-500 text-white">
                                  <UIcon name="i-heroicons-trash" class="text-[16px]" />
                                </div>
                                <div class="text-xs text-qhx-text">删除</div>
                              </div>
                            </QhxJellyButton>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- 展开/收起功能栏 -->
                    <div class="flex justify-center items-center gap-2 mb-3 relative z-10">
                      <button
                        type="button"
                        class="wardrobe-collapse-toggle"
                        :title="headerCollapsed ? '展开功能栏' : '收起功能栏'"
                        :aria-label="headerCollapsed ? '展开功能栏' : '收起功能栏'"
                        @click="toggleHeaderCollapsed"
                      >
                        <UIcon
                          :name="headerCollapsed ? 'material-symbols:expand-more' : 'material-symbols:expand-less'"
                          class="text-[16px]"
                        />
                      </button>
                      <button
                        v-if="headerCollapsed"
                        type="button"
                        class="wardrobe-collapse-toggle"
                        title="分享图"
                        aria-label="分享图"
                        @click="openClothesShareFromCollapse"
                      >
                        <UIcon name="i-heroicons-photo-20-solid" class="text-[16px]" />
                      </button>
                    </div>
                    <div class="space-y-3">
                      <h2 :class="['text-xl font-bold min-w-0', clothesPlateTitle]">
                        {{ detail.clothes_note || '暂无名称' }}
                      </h2>

                    <!-- 笔记 -->
                    <div v-if="detail.note" :class="[clothesPlateRow, 'text-gray-600 dark:text-gray-400']">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 喜爱级别（0–5 星） -->
                    <div v-if="detail.is_favorite !== undefined" class="flex flex-wrap items-center gap-2">
                      <span :class="clothesPlateLabelMuted">喜爱级别：</span>
                      <div v-if="isOwner" class="flex flex-wrap items-center gap-2">
                        <div :class="favoriteNeuPanel">
                          <button v-for="s in 5" :key="s" type="button"
                            class="text-2xl leading-none rounded-lg p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary active:shadow-[inset_2px_2px_6px_rgb(163_177_198/0.5)] dark:active:shadow-[inset_2px_2px_8px_rgb(0_0_0/0.35)]"
                            :aria-label="`设为 ${s} 星`" @click="setFavoriteLevel(s)">
                            <UIcon
                              :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                              :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                          </button>
                        </div>
                        <button v-if="favoriteLevelDisplay > 0" type="button" :class="favoriteNeuMiniBtn"
                          @click="setFavoriteLevel(0)">
                          清空
                        </button>
                      </div>
                      <div v-else :class="['inline-flex items-center gap-2', favoriteNeuPanel]">
                        <UIcon v-for="s in 5" :key="s"
                          :name="favoriteLevelDisplay >= s ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                          class="text-xl"
                          :class="favoriteLevelDisplay >= s ? 'text-amber-500 dark:text-amber-400' : 'text-[#a3adbd] dark:text-gray-500'" />
                        <span class="text-sm text-gray-700 dark:text-gray-200">（{{ favoriteLevelDisplay }} 星）</span>
                      </div>
                    </div>

                    <!-- 拥有状态 -->
                    <div v-if="isOwner || detail.wardrobe_status" class="flex flex-wrap items-center gap-2">
                      <span :class="clothesPlateLabelMuted">拥有状态：</span>
                      <template v-if="isOwner">
                        <button
                          v-if="detail.wardrobe_status"
                          type="button"
                          class="cursor-pointer rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary"
                          @click="openWardrobeStatusPicker($event)"
                        >
                          <QhxTag :active="true">{{ detail.wardrobe_status }}</QhxTag>
                        </button>
                        <button v-else type="button" :class="favoriteNeuMiniBtn" @click="openWardrobeStatusPicker($event)">
                          选择状态
                        </button>
                        <button
                          v-if="detail.wardrobe_status"
                          type="button"
                          :class="favoriteNeuMiniBtn"
                          @click="clearWardrobeStatus"
                        >
                          清空
                        </button>
                      </template>
                      <span v-else class="text-sm">{{ detail.wardrobe_status }}</span>
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span :class="clothesPlateLabel">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <QhxNumberStepper v-model="detail.num" :min="1" @change="updateNum" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price || planPriceDisplay" :class="clothesPlateRow">
                      <template v-if="detail.price">价格：￥{{ detail.price }}</template>
                      <div
                        v-if="planPriceDisplay"
                        class="text-gray-500 dark:text-gray-400"
                        :class="{ 'mt-0.5': detail.price }"
                      >
                        <template v-if="planPriceDisplay.kind === 'breakdown'">
                          定尾：<template v-for="(p, i) in planPriceDisplay.segmentPrices" :key="i">
                            <template v-if="i > 0"> + </template>￥{{ p }}
                          </template>
                          <span> = ￥{{ planPriceDisplay.total }}</span>
                        </template>
                        <template v-else>定尾：￥{{ planPriceDisplay.amount }}</template>
                      </div>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" :class="clothesPlateRow">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" :class="clothesPlateRow">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span :class="clothesPlateLabel">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <QhxNumberStepper v-model="detail.times" :min="0" @change="updateTimes" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" :class="clothesPlateRow">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span :class="clothesPlateLabel">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" :class="clothesPlateRow">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>
                    <!-- 来源 -->
                    <div v-if="!detail.origin_shop && detail.origin" :class="clothesPlateRow">
                      来源：{{ detail.origin }}
                    </div>
                    <!-- 关联服饰 -->
                    <div v-if="detail.include && detail.include.length > 0" class="border-t pt-3 mt-3">
                      <div class="flex items-center justify-between mb-2">
                        <h3 :class="clothesPlateSectionSm">关联服饰</h3>
                        <button
                          v-if="isOwner"
                          type="button"
                          class="clothes-detail-sort-toggle text-xs px-2 py-1 rounded transition-colors"
                          :class="sortMode ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
                          @click="sortMode = !sortMode">
                          {{ sortMode ? '退出排序' : '排序模式' }}
                        </button>
                      </div>
                      <ul class="space-y-2">
                        <li
                          v-for="(item, index) in detail.include"
                          :key="item.clothes_id"
                          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                          :class="{ 'cursor-pointer': !sortMode }"
                          @click="!sortMode && jumpToClothes(item)">
                          <img
                            :src="`${BASE_IMG}${item.clothes_img || ''}${config.config?.image_params || ''}`"
                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            :alt="item.clothes_note" />
                          <div class="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                            <span class="text-sm font-serif leading-snug truncate">{{ item.clothes_note || item.library?.name || '未命名' }}</span>
                            <span
                              v-if="item.price !== undefined && item.price !== null && item.price !== ''"
                              class="text-xs font-semibold tabular-nums text-qhx-primary"
                            >￥{{ item.price }}</span>
                          </div>
                          <template v-if="isOwner && sortMode">
                            <div class="flex items-center gap-1 flex-shrink-0">
                              <button
                                v-if="index !== 0"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="upItem(index)">
                                <UIcon name="i-heroicons-chevron-up" class="w-4 h-4" />
                              </button>
                              <button
                                v-if="index < detail.include.length - 1"
                                type="button"
                                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                @click.stop="downItem(index)">
                                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                              </button>
                            </div>
                          </template>
                          <UIcon v-else name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </li>
                      </ul>
                    </div>
                    <div
                      v-if="includeOutfitPriceBreakdown"
                      class="rounded-lg bg-gradient-to-r from-qhx-primary/20 via-orange-50 to-amber-50 py-1 text-sm font-semibold font-serif leading-snug text-gray-900 dark:from-qhx-primary/35 dark:via-amber-950/50 dark:to-orange-950/40 dark:text-gray-50"
                    >
                      <template v-if="includeOutfitPriceBreakdown.segmentPrices.length">
                        总价：<template v-for="(p, i) in includeOutfitPriceBreakdown.segmentPrices" :key="i">
                          <template v-if="i > 0"> + </template>
                          <span class="text-qhx-primary dark:text-qhx-primary">￥{{ p }}</span>
                        </template>
                        <span class="text-qhx-primary dark:text-qhx-primary"> = ￥{{ includeOutfitPriceBreakdown.total }}</span>
                      </template>
                      <template v-else><span class="text-qhx-primary dark:text-qhx-primary">总价：￥0</span></template>
                    </div>
                    <!-- 尾款计划 -->
                    <div v-if="detail.plan_id || detail.plan" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold font-serif tracking-wide text-amber-700 dark:text-amber-300">尾款计划</span>
                        <!-- 计划操作按钮（仅所有者） -->
                        <div v-if="isOwner" class="flex items-center gap-1 ml-auto">
                          <template v-if="detail.plan?.is_complete !== 1">
                            <button
                              type="button"
                              class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded"
                              @click="confirmCompletePlan"
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                              title="编辑"
                              @click="showEditPlan"
                            >
                              <UIcon name="i-heroicons-pencil" class="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="移除"
                              @click="confirmRemovePlan"
                            >
                              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                            </button>
                          </template>
                          <button
                            type="button"
                            class="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="删除计划"
                            @click="confirmDeletePlan"
                          >
                            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div class="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/50 space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-gray-600 dark:text-gray-400">{{ detail.plan?.plan_name || '尾款计划' }}</span>
                          <span class="text-base font-bold text-amber-600 dark:text-amber-400">￥{{ detail.plan?.need_money ?? 0 }}</span>
                        </div>
                        <div v-if="detail.plan?.have_money != null" class="text-xs text-gray-500 dark:text-gray-400">
                          已攒：￥{{ detail.plan.have_money }}
                        </div>
                        <div v-if="detail.plan?.end_time" class="text-xs text-gray-500 dark:text-gray-400">
                          尾款时间：{{ formatDate(detail.plan.end_time) }}
                        </div>
                        <!-- 子计划列表 -->
                        <div
                          v-if="detail.plan?.plan_list && detail.plan.plan_list.length > 0"
                          class="ml-2 pl-2 border-l-2 border-amber-200/60 dark:border-amber-600/40 space-y-1 mt-2"
                        >
                          <div
                            v-for="(child, idx) in detail.plan.plan_list"
                            :key="child.list_id ?? idx"
                            class="flex items-center justify-between gap-2 text-xs"
                          >
                            <span class="text-gray-600 dark:text-gray-400 flex-1 truncate">{{ child.plan_note || child.plan_name || `阶段 ${idx + 1}` }}</span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">￥{{ child.need_money ?? 0 }}</span>
                            <button
                              v-if="isOwner && child.is_complete !== 1"
                              type="button"
                              class="px-2 py-0.5 text-[10px] bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded flex-shrink-0"
                              @click="confirmCompleteChildPlan(child)"
                            >
                              完成
                            </button>
                            <span v-else-if="child.is_complete === 1" class="text-gray-400 text-[10px] flex-shrink-0">已完成</span>
                          </div>
                        </div>
                        <!-- <NuxtLink
                          v-if="detail.plan?.list_id"
                          :to="`/user/plan`"
                          class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          查看计划详情
                          <UIcon name="i-heroicons-arrow-right" class="text-xs" />
                        </NuxtLink> -->
                      </div>
                    </div>
                    <!-- 无计划时显示添加按钮 -->
                    <div v-else-if="isOwner" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-2 mb-2">
                        <UIcon name="material-symbols:savings-rounded" class="text-amber-500 dark:text-amber-400 text-lg" />
                        <span class="text-sm font-semibold font-serif tracking-wide text-amber-700 dark:text-amber-300">尾款计划</span>
                      </div>
                      <button
                        type="button"
                        class="modal-capsule-btn modal-capsule-btn--amber"
                        @click="showAddPlan"
                      >
                        <UIcon name="i-heroicons-plus" class="w-4 h-4 shrink-0" />
                        <span>添加尾款计划</span>
                      </button>
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div :class="clothesPlateName">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" :class="[clothesPlateRow, 'mb-2']">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" :class="[clothesPlateRow, 'mb-2']">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        :class="[clothesPlateRow, 'mb-2 flex items-center gap-2 flex-wrap']">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" :class="[clothesPlateRow, 'mb-2 flex items-center gap-2 flex-wrap']">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 关联服饰 -->
                    <!-- <div v-if="isOwner && detail.include && detail.include.length < 10" class="mt-4">
                    <button type="button" class="modal-capsule-btn" @click="showAddClothesModal = true">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4 shrink-0" />
                      <span>关联服饰</span>
                    </button>
                  </div>
                  <div v-else-if="isOwner && detail.include && detail.include.length >= 10"
                    class="text-sm text-center text-gray-500 mt-4">
                    最多关联10条
                  </div> -->

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <button type="button" class="modal-capsule-btn" @click="jumpToWardrobe">
                        查看该衣柜
                      </button>
                    </div>
                    </div>
                  </div>
                </div>

                <!-- 来源店铺 -->
                <div v-if="detail.origin_shop" class="border-t pt-4 mt-4">
                  <h3 :class="clothesPlateSectionLg">来源店铺</h3>
                  <div class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    @click="jumpToShop(detail.origin_shop!.shop_id)">
                    <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                      :alt="detail.origin_shop.shop_name" />
                    <div :class="clothesPlateName">{{ detail.origin_shop.shop_name }}</div>
                  </div>
                </div>

                <!-- 详情图片列表 -->
                <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                  <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                    :list="clothesPreviewItem(img, detail.clothes_note || '')"
                    :preview="mapOwnerLargeImageParams(detail.detail_image_list)"
                    className="w-full rounded-lg" />
                </div>

                <!-- 是否共享 -->
                <div class="border-t pt-3 mt-3">
                  <div class="flex items-center justify-between gap-3">
                    <span :class="clothesPlateLabelMuted">是否共享</span>
                    <UToggle
                      v-if="isOwner"
                      :model-value="isShared"
                      :disabled="sharedLoading"
                      @update:model-value="setShared($event ? 1 : 0)"
                    />
                        <span v-else class="text-sm font-medium" :class="isShared ? 'text-qhx-primary' : 'text-gray-500'">
                          {{ isShared ? '已共享' : '未共享' }}
                        </span>
                      </div>
                      <p v-if="isShared" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        当前为共享状态，服饰数据公开，其他用户可以直接导入衣柜
                      </p>
                      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        开启可以与其他用户共享数据
                      </p>
                      <div v-if="isShared" class="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="i-heroicons-heart" class="text-red-500" />
                      赞数 {{ displayGoodCount }}
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <UIcon name="i-heroicons-link" class="text-qhx-primary" />
                      引用数 {{ displayCitationCount }}
                    </span>
                  </div>
                </div>
              </div>
        </div>
      <!-- 场景选择组件 -->
      <SceneChoose ref="SceneChooseRef" @choose="chooseScene"></SceneChoose>
      
      <!-- 场景选择对话框 -->
      <QhxModal v-model="showSceneChooseModal" :trigger-position="sceneChooseClickPosition" @close="handleSceneChooseClose">
        <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">选择场景方式</h3>
            <button
              @click="handleSceneChooseClose"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="p-6 space-y-4">
            <!-- 套用模版 -->
            <!-- <div
              @click="chooseTemplate"
              class="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md group"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UIcon name="material-symbols:auto-awesome-rounded" class="text-2xl text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  套用模版
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  从预设模版中选择场景
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div> -->

            <!-- 现有场景 -->
            <div
              @click="chooseExistingScene"
              class="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md group"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UIcon name="material-symbols:scatter-plot-rounded" class="text-2xl text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  现有场景
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  从已创建的场景中选择
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      </QhxModal>
    </div>
    <div
      v-else
      key="clothes-detail-loading"
      class="min-h-0"
      aria-hidden="true"
    />
    </Transition>

    <div
      v-if="!isMobile && showSiblingNav"
      class="pointer-events-none fixed inset-y-0 left-0 right-0 z-[58] flex items-end justify-between px-2 sm:px-5 pb-6 sm:pb-8"
    >
      <div class="pointer-events-auto flex min-w-[2rem] justify-start">
        <button
          v-if="canGoSiblingPrev"
          type="button"
          class="clothes-sibling-neu-btn h-8 w-8 shrink-0"
          aria-label="上一件服饰"
          @click="goToSibling(-1)"
        >
          <UIcon name="i-heroicons-chevron-left" class="h-4 w-4" />
        </button>
      </div>
      <div class="pointer-events-auto flex min-w-[2rem] justify-end">
        <button
          v-if="canGoSiblingNext"
          type="button"
          class="clothes-sibling-neu-btn h-8 w-8 shrink-0"
          aria-label="下一件服饰"
          @click="goToSibling(1)"
        >
          <UIcon name="i-heroicons-chevron-right" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <QhxModal v-model="showDeleteModal">
      <div class="capsule-confirm-card">
        <h3 class="capsule-confirm-card__title">操作确认</h3>
        <p class="capsule-confirm-card__desc">确定要删除吗？</p>
        <div class="capsule-confirm-card__actions">
          <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showDeleteModal = false">
            取消
          </button>
          <button type="button" class="modal-capsule-btn modal-capsule-btn--danger w-full min-w-0 sm:flex-1" @click="confirmDelete">
            确定
          </button>
        </div>
      </div>
    </QhxModal>

      <!-- 移除场景确认弹窗 -->
      <QhxModal v-model="showRemoveSceneModal">
        <div class="capsule-confirm-card">
          <h3 class="capsule-confirm-card__title">操作确认</h3>
          <p class="capsule-confirm-card__desc">确定要移除当前关联的场景吗？</p>
          <div class="capsule-confirm-card__actions">
            <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showRemoveSceneModal = false">
              取消
            </button>
            <button type="button" class="modal-capsule-btn modal-capsule-btn--danger w-full min-w-0 sm:flex-1" @click="removeScene">
              确定
            </button>
          </div>
        </div>
      </QhxModal>

      <!-- 完成计划确认弹窗 -->
      <QhxModal v-model="showCompletePlanModal">
        <div class="capsule-confirm-card">
          <h3 class="capsule-confirm-card__title">操作确认</h3>
          <p class="capsule-confirm-card__desc">确定要完成该计划吗？</p>
          <div class="capsule-confirm-card__actions">
            <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showCompletePlanModal = false; completePlanListId = null">
              取消
            </button>
            <button
              type="button"
              class="modal-capsule-btn w-full min-w-0 sm:flex-1"
              :disabled="planCompleteLoading"
              @click="handleCompletePlan"
            >
              <UIcon v-if="planCompleteLoading" name="i-heroicons-arrow-path" class="w-4 h-4 shrink-0 animate-spin" />
              <span>确认完成</span>
            </button>
          </div>
        </div>
      </QhxModal>

      <!-- 移除计划确认弹窗 -->
      <QhxModal v-model="showRemovePlanModal">
        <div class="capsule-confirm-card">
          <h3 class="capsule-confirm-card__title">操作确认</h3>
          <p class="capsule-confirm-card__desc">确定要移除该计划与服饰的关联吗？计划仍将保留在计划列表中。</p>
          <div class="capsule-confirm-card__actions">
            <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showRemovePlanModal = false">
              取消
            </button>
            <button
              type="button"
              class="modal-capsule-btn w-full min-w-0 sm:flex-1"
              :disabled="planRemoveLoading"
              @click="handleRemovePlan"
            >
              <UIcon v-if="planRemoveLoading" name="i-heroicons-arrow-path" class="w-4 h-4 shrink-0 animate-spin" />
              <span>确认移除</span>
            </button>
          </div>
        </div>
      </QhxModal>

      <!-- 删除计划确认弹窗 -->
      <QhxModal v-model="showDeletePlanModal">
        <div class="capsule-confirm-card">
          <h3 class="capsule-confirm-card__title">操作确认</h3>
          <p class="capsule-confirm-card__desc">确定要删除该计划吗？删除后将无法恢复。</p>
          <div class="capsule-confirm-card__actions">
            <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showDeletePlanModal = false">
              取消
            </button>
            <button
              type="button"
              class="modal-capsule-btn modal-capsule-btn--danger w-full min-w-0 sm:flex-1"
              :disabled="planDeleteLoading"
              @click="handleDeletePlan"
            >
              <UIcon v-if="planDeleteLoading" name="i-heroicons-arrow-path" class="w-4 h-4 shrink-0 animate-spin" />
              <span>确认删除</span>
            </button>
          </div>
        </div>
      </QhxModal>

      <!-- 删除关联确认弹窗 -->
      <QhxModal v-model="showDeleteLinkModal">
        <div class="capsule-confirm-card">
          <h3 class="capsule-confirm-card__title">操作确认</h3>
          <p class="capsule-confirm-card__desc">确定要取消关联吗？</p>
          <div class="capsule-confirm-card__actions">
            <button type="button" class="modal-capsule-btn modal-capsule-btn--ghost w-full min-w-0 sm:flex-1" @click="showDeleteLinkModal = false">
              取消
            </button>
            <button type="button" class="modal-capsule-btn modal-capsule-btn--danger w-full min-w-0 sm:flex-1" @click="deleteLinkClothes">
              确定
            </button>
          </div>
        </div>
      </QhxModal>
    
    <!-- 物理掉落组件 - 只在没有 sence_id 时显示 -->
    <!-- <ClientOnly>
      <PhysicsDrop 
        v-if="!detail?.sence_id && isPhysicsDropVisible && physicsDropModels.length > 0"
        :models="physicsDropModels"
        @object-click="handleObjectClick"
      />
    </ClientOnly> -->
    
    <!-- 悬浮开关按钮 - 只在没有 sence_id 且有模型时显示 -->
    <!-- <div 
      class="fixed bottom-8 left-8 z-50 pointer-events-none" 
      v-if="!detail?.sence_id && detail && physicsDropModels.length > 0"
    >
      <button
        @click="togglePhysicsDrop"
        class="pointer-events-auto bg-gray-900/80 dark:bg-white/80 backdrop-blur-md text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <UIcon
          :name="isPhysicsDropVisible ? 'weui:eyes-on-filled' : 'weui:eyes-off-filled'"
          class="text-[16px] group-hover:rotate-12 transition-transform"
        />
        <span class="text-sm font-semibold">{{ isPhysicsDropVisible ? '关闭掉落' : '开启掉落' }}</span>
      </button>
    </div> -->
  </div>
</template>

<style scoped>
/* 字体排版参考数字展馆铭牌，不改变布局与配色 */
.clothes-detail-action-label,
.clothes-detail-sort-toggle {
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 11px;
  letter-spacing: 0.06em;
  line-height: 1.25;
}

/* 关联场景 iframe：抽屉内子块毛玻璃材质（与社区详情 scene 模式一致） */
.clothes-scene-glass-panel {
  background-color: rgba(255, 255, 255, 0.22);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

:root.dark .clothes-scene-glass-panel,
.dark .clothes-scene-glass-panel {
  background-color: rgba(38, 38, 38, 0.38);
}

.clothes-slide-forward-enter-active,
.clothes-slide-forward-leave-active,
.clothes-slide-back-enter-active,
.clothes-slide-back-leave-active {
  transition:
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.26s ease;
}

.clothes-slide-forward-enter-from {
  transform: translateX(22px);
  opacity: 0;
}
.clothes-slide-forward-leave-to {
  transform: translateX(-22px);
  opacity: 0;
}

.clothes-slide-back-enter-from {
  transform: translateX(-22px);
  opacity: 0;
}
.clothes-slide-back-leave-to {
  transform: translateX(22px);
  opacity: 0;
}

/* 电脑端相邻服饰切换：拟态圆形按钮（与衣柜/搭配页色系接近） */
.clothes-sibling-neu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  color: #6b5563;
  background: #ebe3e8;
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -4px -4px 10px rgba(255, 252, 254, 0.95),
    inset 0 1px 1px rgba(255, 255, 255, 0.55);
  transition:
    box-shadow 0.2s ease,
    transform 0.15s ease,
    color 0.2s ease;
}

.clothes-sibling-neu-btn:hover {
  color: #5b4660;
  box-shadow:
    5px 5px 12px rgba(150, 110, 130, 0.26),
    -5px -5px 12px rgba(255, 252, 254, 0.98),
    inset 0 1px 1px rgba(255, 255, 255, 0.6);
}

.clothes-sibling-neu-btn:active {
  transform: scale(0.94);
  color: #524459;
  box-shadow:
    inset 3px 3px 8px rgba(150, 110, 130, 0.28),
    inset -2px -2px 6px rgba(255, 252, 254, 0.65);
}

.dark .clothes-sibling-neu-btn {
  color: rgba(251, 207, 232, 0.82);
  background: #241d26;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.45),
    -3px -3px 10px rgba(120, 80, 100, 0.08),
    inset 0 1px 0 rgba(255, 210, 230, 0.06);
}

.dark .clothes-sibling-neu-btn:hover {
  color: rgba(252, 220, 236, 0.92);
  box-shadow:
    5px 5px 14px rgba(0, 0, 0, 0.5),
    -4px -4px 11px rgba(130, 90, 110, 0.1),
    inset 0 1px 0 rgba(255, 210, 230, 0.08);
}

.dark .clothes-sibling-neu-btn:active {
  box-shadow:
    inset 3px 3px 10px rgba(0, 0, 0, 0.55),
    inset -2px -2px 8px rgba(140, 100, 120, 0.06);
}

/* 手机端滑动引导：轻遮罩、无卡片无模糊，低存在感 */
.clothes-swipe-guide-root {
  isolation: isolate;
}

.clothes-swipe-guide-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(0, 0, 0, 0.38);
}

.dark .clothes-swipe-guide-backdrop {
  background: rgba(0, 0, 0, 0.42);
}

.clothes-swipe-guide-enter-active {
  transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-swipe-guide-leave-active {
  transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.clothes-swipe-guide-enter-active .clothes-swipe-guide-content,
.clothes-swipe-guide-leave-active .clothes-swipe-guide-content {
  transition:
    opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-swipe-guide-enter-from,
.clothes-swipe-guide-leave-to {
  opacity: 0;
}

.clothes-swipe-guide-enter-from .clothes-swipe-guide-content,
.clothes-swipe-guide-leave-to .clothes-swipe-guide-content {
  opacity: 0;
  transform: translateY(8px);
}

.clothes-swipe-guide-hint-row {
  animation: clothes-swipe-guide-hand 2.2s ease-in-out infinite;
  transform-origin: 50% 65%;
  will-change: transform;
}

@keyframes clothes-swipe-guide-hand {
  0%,
  100% {
    transform: translateX(-14px) rotate(-8deg);
  }
  50% {
    transform: translateX(14px) rotate(8deg);
  }
}

/* 记忆/搭配悬浮按钮：淡底 + 主色边框（参考展馆胶囊） */
.clothes-fab-stack {
  transform-origin: top right;
}

.clothes-fab-btn {
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

.clothes-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 9%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, transparent);
}

.clothes-fab-btn:active {
  transform: scale(0.97);
}

.dark .clothes-fab-btn {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, rgba(17, 24, 39, 0.72));
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, rgba(255, 255, 255, 0.12));
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 78%, #fce7f3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.28);
}

.dark .clothes-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, rgba(17, 24, 39, 0.78));
}

.clothes-fab-btn--toggle {
  padding: 0.22rem 0.38rem;
}

.clothes-fab-btn--action {
  padding: 0.24rem 0.48rem 0.24rem 0.42rem;
}

.clothes-fab-btn__inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.clothes-fab-btn__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.clothes-fab-btn__label {
  line-height: 1.2;
}

.clothes-fab-badge {
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

.clothes-fab-badge--corner {
  top: -0.45rem;
  right: -0.55rem;
}

.clothes-fab-panel-enter-active,
.clothes-fab-panel-leave-active {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  transform-origin: top right;
}

.clothes-fab-panel-enter-from,
.clothes-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.94);
  max-height: 0;
}

.clothes-fab-panel-enter-to,
.clothes-fab-panel-leave-from {
  max-height: 7rem;
}

.clothes-fab-panel-enter-active .clothes-fab-btn--action {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-fab-panel-leave-active .clothes-fab-btn--action {
  transition:
    opacity 0.18s ease,
    transform 0.2s ease;
}

.clothes-fab-panel-enter-from .clothes-fab-btn--action,
.clothes-fab-panel-leave-to .clothes-fab-btn--action {
  opacity: 0;
  transform: translateY(-6px);
}

.clothes-fab-panel-enter-active .clothes-fab-btn--action:nth-child(1) {
  transition-delay: 0.05s;
}

.clothes-fab-panel-enter-active .clothes-fab-btn--action:nth-child(2) {
  transition-delay: 0.11s;
}

.clothes-fab-panel-leave-active .clothes-fab-btn--action:nth-child(2) {
  transition-delay: 0s;
}

.clothes-fab-panel-leave-active .clothes-fab-btn--action:nth-child(1) {
  transition-delay: 0.04s;
}

.clothes-fab-toggle-icon {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.clothes-fab-toggle-icon--expanded {
  transform: rotate(180deg);
}

/* 记忆/搭配弹窗胶囊按钮 */
.modal-capsule-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1.35rem;
  border-radius: 9999px;
  border: 1.5px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, transparent);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 90%, #fff) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, #f472b6) 100%
  );
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.38),
    0 2px 8px color-mix(in srgb, var(--primary-color, #ff9eb5) 22%, transparent);
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease,
    border-color 0.2s ease;
}

.modal-capsule-btn:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    0 4px 14px color-mix(in srgb, var(--primary-color, #ff9eb5) 34%, transparent);
}

.modal-capsule-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.modal-capsule-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.dark .modal-capsule-btn {
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, rgb(255 255 255 / 0.15));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 75%, #831843) 0%,
    color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, #4c0519) 100%
  );
  color: #fce7f3;
}

.modal-capsule-btn--ghost {
  border-color: rgb(209 213 219 / 0.95);
  background: rgb(249 250 251 / 0.95);
  color: #4b5563;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.8),
    0 1px 4px rgb(0 0 0 / 0.05);
}

.modal-capsule-btn--ghost:hover:not(:disabled) {
  filter: none;
  background: rgb(243 244 246 / 0.98);
  border-color: rgb(156 163 175 / 0.55);
}

.modal-capsule-btn--danger {
  border-color: color-mix(in srgb, #ef4444 62%, transparent);
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.28),
    0 2px 10px rgb(239 68 68 / 0.28);
}

.modal-capsule-btn--danger:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.32),
    0 4px 14px rgb(239 68 68 / 0.34);
}

.dark .modal-capsule-btn--ghost {
  border-color: rgb(75 85 99 / 0.75);
  background: rgb(31 41 55 / 0.82);
  color: #d1d5db;
}

.dark .modal-capsule-btn--ghost:hover:not(:disabled) {
  background: rgb(55 65 81 / 0.88);
  border-color: rgb(107 114 128 / 0.75);
}

.dark .modal-capsule-btn--danger {
  border-color: color-mix(in srgb, #f87171 55%, rgb(255 255 255 / 0.12));
  background: linear-gradient(135deg, rgb(185 28 28 / 0.92) 0%, rgb(127 29 29 / 0.95) 100%);
  color: #fecaca;
}

.modal-capsule-btn--soft {
  border-color: rgb(229 231 235 / 0.95);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.98) 0%, rgb(249 250 251 / 0.96) 100%);
  color: #6b7280;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 1px 4px rgb(0 0 0 / 0.04);
}

.modal-capsule-btn--soft:hover:not(:disabled) {
  filter: none;
  color: #4b5563;
  border-color: rgb(209 213 219 / 0.95);
  background: linear-gradient(180deg, rgb(255 255 255) 0%, rgb(243 244 246) 100%);
}

.modal-capsule-btn--amber {
  border-color: color-mix(in srgb, #f59e0b 58%, transparent);
  background: linear-gradient(145deg, #fcd34d 0%, #f97316 100%);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    0 2px 10px rgb(245 158 11 / 0.28);
}

.modal-capsule-btn--amber:hover:not(:disabled) {
  filter: brightness(1.03);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    0 4px 14px rgb(245 158 11 / 0.32);
}

.dark .modal-capsule-btn--soft {
  border-color: rgb(75 85 99 / 0.7);
  background: linear-gradient(180deg, rgb(55 65 81 / 0.72) 0%, rgb(31 41 55 / 0.82) 100%);
  color: #d1d5db;
}

.dark .modal-capsule-btn--soft:hover:not(:disabled) {
  background: linear-gradient(180deg, rgb(75 85 99 / 0.78) 0%, rgb(55 65 81 / 0.88) 100%);
  color: #f3f4f6;
}

.dark .modal-capsule-btn--amber {
  border-color: color-mix(in srgb, #fbbf24 50%, rgb(255 255 255 / 0.1));
  background: linear-gradient(145deg, rgb(180 83 9 / 0.92) 0%, rgb(154 52 18 / 0.95) 100%);
  color: #fef3c7;
}

/* 确认弹窗卡片 */
.capsule-confirm-card {
  width: min(calc(100vw - 2rem), 360px);
  padding: 1.25rem 1.25rem 1.125rem;
  border-radius: 1.25rem;
  border: 1px solid rgb(255 255 255 / 0.65);
  background: linear-gradient(165deg, rgb(255 255 255 / 0.98) 0%, rgb(253 242 248 / 0.94) 100%);
  box-shadow:
    0 16px 40px rgb(0 0 0 / 0.1),
    inset 0 1px 0 rgb(255 255 255 / 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.dark .capsule-confirm-card {
  border-color: rgb(255 255 255 / 0.08);
  background: linear-gradient(165deg, rgb(31 41 55 / 0.96) 0%, rgb(17 24 39 / 0.98) 100%);
  box-shadow:
    0 16px 40px rgb(0 0 0 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
}

.capsule-confirm-card__title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #111827;
}

.dark .capsule-confirm-card__title {
  color: #f9fafb;
}

.capsule-confirm-card__desc {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #6b7280;
}

.dark .capsule-confirm-card__desc {
  color: #9ca3af;
}

.capsule-confirm-card__actions {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.625rem;
  margin-top: 1.125rem;
}

.capsule-confirm-card__actions .modal-capsule-btn {
  flex: 1 1 0;
  min-width: 0;
  padding-left: 0.875rem;
  padding-right: 0.875rem;
}

/* 搭配列表季节胶囊 */
.matching-season-capsule {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border: 1px solid transparent;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}

.matching-season-capsule--spring {
  background: linear-gradient(135deg, #ecfdf5 0%, #fce7f3 100%);
  color: #047857;
  border-color: rgb(16 185 129 / 0.22);
}

.matching-season-capsule--summer {
  background: linear-gradient(135deg, #fef9c3 0%, #ffedd5 100%);
  color: #b45309;
  border-color: rgb(245 158 11 / 0.28);
}

.matching-season-capsule--autumn {
  background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
  color: #c2410c;
  border-color: rgb(249 115 22 / 0.28);
}

.matching-season-capsule--winter {
  background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
  color: #1d4ed8;
  border-color: rgb(59 130 246 / 0.24);
}

.matching-season-capsule--default {
  background: rgb(249 250 251 / 0.95);
  color: #6b7280;
  border-color: rgb(209 213 219 / 0.8);
}

.dark .matching-season-capsule--spring {
  background: linear-gradient(135deg, rgb(6 78 59 / 0.55) 0%, rgb(131 24 67 / 0.45) 100%);
  color: #a7f3d0;
  border-color: rgb(52 211 153 / 0.35);
}

.dark .matching-season-capsule--summer {
  background: linear-gradient(135deg, rgb(120 53 15 / 0.55) 0%, rgb(154 52 18 / 0.5) 100%);
  color: #fde68a;
  border-color: rgb(251 191 36 / 0.35);
}

.dark .matching-season-capsule--autumn {
  background: linear-gradient(135deg, rgb(124 45 18 / 0.55) 0%, rgb(154 52 18 / 0.5) 100%);
  color: #fdba74;
  border-color: rgb(251 146 60 / 0.35);
}

.dark .matching-season-capsule--winter {
  background: linear-gradient(135deg, rgb(30 58 138 / 0.55) 0%, rgb(49 46 129 / 0.5) 100%);
  color: #bfdbfe;
  border-color: rgb(96 165 250 / 0.35);
}

.dark .matching-season-capsule--default {
  background: rgb(31 41 55 / 0.75);
  color: #d1d5db;
  border-color: rgb(75 85 99 / 0.65);
}
</style>

<style>
/* 与衣柜详情页一致的拟态工具钮 / 折叠钮（非 scoped，供子组件 ClothesShareImage 复用） */
.wardrobe-page-neu {
  --ward-neu-soft: rgba(255, 255, 255, 0.62);
  --ward-neu-deep: rgba(0, 0, 0, 0.14);
  --ward-neu-inset: rgba(255, 255, 255, 0.4);
}

.dark .wardrobe-page-neu {
  --ward-neu-soft: rgba(255, 255, 255, 0.07);
  --ward-neu-deep: rgba(0, 0, 0, 0.5);
  --ward-neu-inset: rgba(255, 255, 255, 0.06);
}

.wardrobe-page-neu .wardrobe-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--color-qhx-text, #666);
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    2px 2px 6px var(--ward-neu-deep),
    -1px -1px 4px var(--ward-neu-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.wardrobe-page-neu .wardrobe-collapse-toggle:hover {
  transform: scale(1.08);
}

.wardrobe-page-neu .wardrobe-collapse-toggle:active {
  transform: scale(0.95);
}

.dark .wardrobe-page-neu .wardrobe-collapse-toggle {
  background: rgba(40, 40, 44, 0.88);
  color: rgba(255, 255, 255, 0.75);
}

.wardrobe-page-neu .wardrobe-neu-tool-orb {
  box-shadow:
    4px 5px 11px rgba(0, 0, 0, 0.2),
    -2px -3px 9px rgba(255, 255, 255, 0.42),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.38),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s ease, transform 0.18s ease;
}

.dark .wardrobe-page-neu .wardrobe-neu-tool-orb {
  box-shadow:
    4px 5px 14px rgba(0, 0, 0, 0.52),
    -2px -2px 7px rgba(255, 255, 255, 0.06),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.wardrobe-page-neu .wardrobe-neu-tool-orb:active {
  box-shadow:
    inset 3px 3px 9px rgba(0, 0, 0, 0.24),
    inset -2px -2px 7px rgba(255, 255, 255, 0.12);
  transform: scale(0.94);
}

.dark .wardrobe-page-neu .wardrobe-neu-tool-orb:active {
  box-shadow:
    inset 3px 3px 11px rgba(0, 0, 0, 0.48),
    inset -1px -1px 4px rgba(255, 255, 255, 0.06);
}
</style>
