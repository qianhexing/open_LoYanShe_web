<script setup lang="ts">
definePageMeta({
  ssr: false,
})

import type { Wardrobe, WardrobeClothes, UserDeco } from '@/types/api';
import { getUserDecoBadges, getUserSpace } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import { getWardrobeList, getClothesList, sortClothee, changeWardrobeClothes, changeWardrobeClothesBatch, deleteClothesByIds, updateClothesIds, checkWadrobePassword, sortWardrobe, updateWardrobe, deleteWardrobe } from '@/api/wardrobe'
import { getPlanListWardrobe, planComplete } from '@/api/plan'
import type { ClothesParams } from '@/api/wardrobe'
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import { useCommunityDetailTheme } from '@/composables/useCommunityDetailTheme'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import { useMatchingDraftStore } from '@/stores/matchingDraft'
import { useFlyToButton } from '~/composables/useFlyToButton'
import { useWardrobeToolbar } from '~/composables/useWardrobeToolbar'
import { getWardrobeToolbarTool } from '~/utils/wardrobeToolbarConfig'
import { BASE_IMG } from '@/utils/ipConfig'
import { createReusableTemplate, useEventListener, useResizeObserver, useDebounceFn } from '@vueuse/core'
import type { WardrobeToolbarToolId } from '~/utils/wardrobeToolbarConfig'
import type QhxStepGuide from '@/components/Qhx/StepGuide.vue'
import type QrcodeListType from '@/components/qrcode/QrcodeList.vue'
import type ClothesAddType from '@/components/Clothes/ClothesAdd.vue'
import type ClothesBatchAddEntryType from '@/components/Clothes/ClothesBatchAddEntry.vue'
import type WardrobeAddEditType from '@/components/Wardrobe/WardrobeAddEdit.vue'
import type WardrobeSearchType from '@/components/Wardrobe/WardrobeSearch.vue'
import type WardrobeChooseType from '@/components/Wardrobe/WardrobeChoose.vue'
import type MatchingAddEditType from '@/components/matching/MatchingAddEdit.vue'
import dayjs from 'dayjs'
import {
  hasCompletedWardrobeSortGuide,
  WARDROBE_SORT_GUIDE_STEPS,
  WARDROBE_SORT_GUIDE_STORAGE_KEY,
} from '@/utils/wardrobeSortGuide'

const Draggable = defineAsyncComponent(() => import('vuedraggable'))
const WardrobeClothesLongShare = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeClothesLongShare.vue'),
)
const WardrobeClothesFavoriteShare = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeClothesFavoriteShare.vue'),
)
const ClothesAdd = defineAsyncComponent(() => import('@/components/Clothes/ClothesAdd.vue'))
const ClothesBatchAddEntry = defineAsyncComponent(
  () => import('@/components/Clothes/ClothesBatchAddEntry.vue'),
)
const WardrobeAddEdit = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeAddEdit.vue'),
)
const MatchingAddEdit = defineAsyncComponent(
  () => import('@/components/matching/MatchingAddEdit.vue'),
)
const WardrobeSimilarRecommend = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeSimilarRecommend.vue'),
)
const QrcodeList = defineAsyncComponent(() => import('@/components/qrcode/QrcodeList.vue'))
const WardrobeSearch = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeSearch.vue'),
)
const WardrobeChoose = defineAsyncComponent(
  () => import('@/components/Wardrobe/WardrobeChoose.vue'),
)

const wardrobeStore = useWardrobeStore()
const user = useUserStore()
const matchingDraftStore = useMatchingDraftStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
const ownerUserId = computed(() => Number.parseInt(id))
/** 当前登录用户是否为该衣柜页主人（路由 id 即主人 user_id） */
const isPageOwner = computed(() => {
  const uid = user.user?.user_id
  return uid != null && Number(uid) === ownerUserId.value
})

const wardrobePageOwner = ref<{ user_name?: string; user_face?: string } | null>(null)

async function loadWardrobePageOwner() {
  const uid = ownerUserId.value
  if (!Number.isFinite(uid)) {
    wardrobePageOwner.value = null
    return
  }
  if (isPageOwner.value && user.user) {
    wardrobePageOwner.value = {
      user_name: user.user.user_name,
      user_face: user.user.user_face,
    }
    return
  }
  try {
    const u = await getUserSpace({ user_id: uid })
    wardrobePageOwner.value = { user_name: u.user_name, user_face: u.user_face }
  } catch {
    wardrobePageOwner.value = null
  }
}

const wardrobeShareUserName = computed(
  () => (isPageOwner.value ? user.user?.user_name : wardrobePageOwner.value?.user_name) ?? ''
)
const wardrobeShareUserFace = computed(
  () => (isPageOwner.value ? user.user?.user_face : wardrobePageOwner.value?.user_face) ?? ''
)
const wardrobeList = ref<Wardrobe[]>([])
const wardrobeCount = ref<number>(0)
const currentWardrobe = ref<Wardrobe | null>(null)
const pageSize = 40
/** 时间轴模式：一次拉取近全量，便于统计与完整时间线 */
const TIMELINE_PAGE_SIZE = 999
const page = ref(1)
const list = ref<WardrobeClothes[]>([])
const total = ref(0)
const isLoading = ref(false)
/** 服饰列表请求序号：丢弃过期响应，避免并发 reload / 切换衣柜导致 loading 卡死 */
let clothesListFetchSeq = 0
const tagList = ref<Array<string>>([])
const sizeList = ref<Array<string>>([])
const isSorting = ref(false) // loading 状态
const show = ref(true)
const sortMode = ref(false)
const showSortGuide = ref(false)
const sortGuideRef = ref<InstanceType<typeof QhxStepGuide> | null>(null)
const wardrobeSortGuideSteps = WARDROBE_SORT_GUIDE_STEPS
// 搭配模式：与排序互斥，开启后服饰卡片右上角显示加号，可添加进搭配草稿
const matchingMode = ref(false)
// 多选模式：与排序、搭配、编辑互斥，开启后服饰卡片右上角显示选择框，可批量操作
const selectMode = ref(false)
// 编辑模式：与排序、搭配、多选互斥，开启后服饰卡片右上角显示编辑按钮，可快速修改
const editMode = ref(false)
/** 时间轴全屏视图：列表按加入衣柜时间排序 */
const timelineMode = ref(false)
const selectedClothesIds = ref<Set<number>>(new Set())
const showMatchingDrawer = ref(false)
const info = ref<Wardrobe | null>(null)
const {
  customStyle,
  customBtnStyle,
  hasCustomBtnBg,
  hasCustomBtnFont,
  hasAnyCustomBtnTheme,
  pageBackgroundStyle,
  pageContentStyle,
} = useCommunityDetailTheme(info)
const router = useRouter()
const showPassword = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const password = ref<string>('')
const qrcode = ref<string>('')
const showDeleteModal = ref(false)
const showBatchDeleteModal = ref(false)
const showMoreMenu = ref(false)
const moreMenuPosition = ref({ x: 0, y: 0 })
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
// 监听port变化
watch(port, (newVal) => {
  if (newVal) {
    newVal.onmessage = (e) => {
      const message = JSON.parse(e.data)
      if (message.type === 'reload') {
        reload()
      }
    }
  }
})

// 监听 UniApp iframe 传来的 postMessage 刷新
const handleUniRefreshMessage = (e: MessageEvent) => {
  try {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    if (data?.type === 'refresh' && data?.from === 'uni') {
      reload()
    }
  } catch {
    // 忽略解析错误
  }
}

const opearClothesId = ref<number | null>(null)
let oldList: { clothes_id: number; sort: number }[] = [];
const record = ref<Wardrobe | null>(null)
const addEditClothesRef = ref<InstanceType<typeof ClothesAddType> | null>(null)
const clothesBatchAddEntryRef = ref<InstanceType<typeof ClothesBatchAddEntryType> | null>(null)
const toast = useToast()

const showBatchStatusModal = ref(false)
const showBatchSortModal = ref(false)
/** 批量排序：目标序号（1 起，与封面蒙版一致） */
const batchSortTargetNo = ref('')
/** 仅自定义排序（sort_type=0）时可手动调整顺序 */
const isCustomSortMode = computed(() => (info.value?.sort_type ?? 0) === 0)
/** 当前列表服饰序号（clothes_id → 1-based） */
const clothesSortNoMap = computed(() => {
  if (!selectMode.value) return EMPTY_CLOTHES_SORT_MAP
  const map = new Map<number, number>()
  list.value.forEach((item, index) => {
    if (item.clothes_id != null) map.set(item.clothes_id, index + 1)
  })
  return map
})
const getClothesDisplaySortNo = (item: WardrobeClothes) => {
  const id = item.clothes_id
  if (id == null) return 0
  return clothesSortNoMap.value.get(id) ?? 0
}
/** 批量修改拥有状态：与 ClothesAdd 表单项 wardrobe_status 一致 */
const batchMultipleFormWardrobeStatus = ref<string | null>(null)
const batchStatusSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const wardrobe_status_defaults: optionsInterface[] = [
  { value: '已拥有', label: '已拥有' },
  { value: '待补款', label: '待补款' },
  { value: '已出', label: '已出' },
]
const batchWardrobeStatusOptions = ref<optionsInterface[]>([...wardrobe_status_defaults])
function refreshBatchWardrobeStatusOptions() {
  if (wardrobeStore.config?.wardrobe_status?.length) {
    const fromConfig = wardrobeStore.config.wardrobe_status.map((child) => ({
      value: child,
      label: child,
    }))
    batchWardrobeStatusOptions.value = [
      ...wardrobe_status_defaults,
      ...fromConfig.filter((o) => !wardrobe_status_defaults.some((d) => d.label === o.label)),
    ]
  } else {
    batchWardrobeStatusOptions.value = [...wardrobe_status_defaults]
  }
}
const openBatchStatusModal = () => {
  if (selectedClothesIds.value.size === 0) return
  refreshBatchWardrobeStatusOptions()
  batchMultipleFormWardrobeStatus.value = null
  showBatchStatusModal.value = true
}
const openBatchStatusPicker = (e: MouseEvent) => {
  batchStatusSelectRef.value?.showPicker(e)
}
const onBatchWardrobeStatusSelect = (select: optionsInterface) => {
  batchMultipleFormWardrobeStatus.value = select.label
}
const confirmBatchStatus = async () => {
  const ids = Array.from(selectedClothesIds.value)
  if (ids.length === 0) return
  const wardrobe_status = batchMultipleFormWardrobeStatus.value
  if (wardrobe_status == null || wardrobe_status === '') {
    toast.add({ title: '请先选择拥有状态', color: 'amber', icon: 'i-heroicons-information-circle' })
    return
  }
  try {
    await updateClothesIds({
      clothes_id: ids.join(','),
      wardrobe_status,
    })
    toast.add({ title: '状态已更新', icon: 'i-heroicons-check-circle', color: 'green' })
    for (const cid of ids) {
      const idx = list.value.findIndex((item) => item.clothes_id === cid)
      if (idx !== -1) {
        list.value[idx] = { ...list.value[idx], wardrobe_status }
      }
    }
    selectedClothesIds.value = new Set()
    showBatchStatusModal.value = false
  } catch {
    toast.add({ title: '更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}

const filter_list =  ref({
  tags: [] as string[],
  wardrobe_status: [] as string[],
  clothes_note: '' as string,
  size: [] as string[],
}) 
const showFilterDrawer = ref(false)

/** 当前衣柜攒钱计划时间线抽屉 */
interface PlanWardrobeTimelineRow {
  list_id: number
  create_time?: string | null
  /** 尾款 / 计划截止时间 */
  end_time?: string | Date | null
  clothes_note?: string | null
  clothes_img?: string | null
  need_money?: number
  have_money?: number
  is_complete?: number
  plan_note?: string | null
  clothes_id?: number | null
  parent_id?: number | null
  [key: string]: unknown
}

interface PlanRowBalanceUi {
  text: string
  urgent: boolean
  muted: boolean
}

/** 未完成时：距尾款（end_time）剩余或已超期文案 */
function planRowBalanceUi(row: PlanWardrobeTimelineRow): PlanRowBalanceUi | null {
  if (Number(row.is_complete) === 1) return null
  const raw = row.end_time
  if (raw == null || raw === '') {
    return { text: '未设置尾款截止日', urgent: false, muted: true }
  }
  const endD = dayjs(raw as string | Date)
  if (!endD.isValid()) {
    return { text: '尾款日期无效', urgent: false, muted: true }
  }
  const now = dayjs()
  if (!endD.isAfter(now)) {
    const days = now.diff(endD, 'day')
    if (days >= 1) {
      return { text: `尾款已开始 ${days} 天`, urgent: true, muted: false }
    }
    const hours = now.diff(endD, 'hour')
    if (hours >= 1) {
      return { text: `尾款已开始 ${hours} 小时`, urgent: true, muted: false }
    }
    const mins = now.diff(endD, 'minute')
    return {
      text: mins < 1 ? '已开始' : `已开始 ${mins} 分钟`,
      urgent: true,
      muted: false,
    }
  }
  const days = endD.diff(now, 'day')
  if (days >= 1) {
    return { text: `距尾款 ${days} 天`, urgent: days <= 3, muted: false }
  }
  const hours = endD.diff(now, 'hour')
  if (hours >= 1) {
    return { text: `距尾款 ${hours} 小时`, urgent: true, muted: false }
  }
  const mins = Math.max(1, endD.diff(now, 'minute'))
  return { text: `距尾款 ${mins} 分钟`, urgent: true, muted: false }
}

/** 与 PlanListItem 一致：子计划或已攒满方可点完成 */
function planRowCanShowComplete(row: PlanWardrobeTimelineRow): boolean {
  if (Number(row.is_complete) === 1) return false
  const pid = row.parent_id
  const isChildPlan = pid != null && Number(pid) > 0
  const have = Number(row.have_money ?? 0)
  const need = Number(row.need_money ?? 0)
  return isChildPlan || have >= need
}

/** 未完成且创建时间已到（或缺失）：视为计划已开始，用于红字强调 */
function planRowHasStarted(row: PlanWardrobeTimelineRow): boolean {
  if (Number(row.is_complete) === 1) return false
  const c = row.create_time
  if (c == null || c === '') return true
  const d = dayjs(c as string | Date)
  if (!d.isValid()) return true
  return !d.isAfter(dayjs())
}

interface PlanWardrobeTimelineSummary {
  have_money?: number
  need_money?: number
  is_complete?: string | number
  total_plan?: number
}
const showPlanTimelineDrawer = ref(false)
const planTimelineWardrobeId = ref<number | null>(null)
const planTimelineRows = ref<PlanWardrobeTimelineRow[]>([])
const planTimelineCount = ref(0)
const planTimelineSummary = ref<PlanWardrobeTimelineSummary | null>(null)
const planTimelinePage = ref(1)
const PLAN_TIMELINE_PAGE_SIZE = 20
const planTimelineLoading = ref(false)
const planTimelineHasMore = computed(
  () => planTimelineRows.value.length < planTimelineCount.value
)

const planTimelineRowsDisplay = computed(() =>
  [...planTimelineRows.value].sort(
    (a, b) => dayjs(b.create_time || 0).valueOf() - dayjs(a.create_time || 0).valueOf()
  )
)

const planTimelineEntries = computed(() =>
  planTimelineRowsDisplay.value.map((row, idx) => ({
    row,
    idx,
    balance: planRowBalanceUi(row),
    started: planRowHasStarted(row),
  }))
)

const loadPlanTimeline = async (reset: boolean) => {
  const wid = planTimelineWardrobeId.value
  if (wid == null) return
  if (reset) {
    planTimelinePage.value = 1
    planTimelineRows.value = []
  }
  planTimelineLoading.value = true
  try {
    const data = await getPlanListWardrobe({
      wardrobe_id: wid,
      page: planTimelinePage.value,
      pageSize: PLAN_TIMELINE_PAGE_SIZE,
    })
    const rows = (data?.rows ?? []) as PlanWardrobeTimelineRow[]
    planTimelineCount.value = data?.count ?? 0
    const statistics = data?.statistics
    planTimelineSummary.value = {
      have_money: statistics?.have_money,
      need_money: statistics?.need_money,
      is_complete: statistics?.is_complete,
      total_plan: statistics?.total_plan,
    }
    if (reset) {
      planTimelineRows.value = rows
    } else {
      planTimelineRows.value = [...planTimelineRows.value, ...rows]
    }
  } catch {
    /* toast 已在 http 层处理 */
  } finally {
    planTimelineLoading.value = false
  }
}

const openPlanTimelineDrawer = (wardrobeId: number) => {
  planTimelineWardrobeId.value = wardrobeId
  showPlanTimelineDrawer.value = true
  void loadPlanTimeline(true)
}

const closePlanTimelineDrawer = () => {
  showPlanTimelineDrawer.value = false
}

const loadMorePlanTimeline = () => {
  if (!planTimelineHasMore.value || planTimelineLoading.value) return
  planTimelinePage.value += 1
  void loadPlanTimeline(false)
}

const planCompleteModal = ref(false)
const planCompleteListId = ref<number | null>(null)
const planCompleteLoading = ref(false)

const confirmPlanTimelineComplete = (listId: number) => {
  planCompleteListId.value = listId
  planCompleteModal.value = true
}

const handlePlanTimelineComplete = async () => {
  if (planCompleteListId.value == null) return
  planCompleteLoading.value = true
  try {
    await planComplete({ list_id: planCompleteListId.value })
    toast.add({
      title: '计划完成',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    planCompleteModal.value = false
    planCompleteListId.value = null
    await loadPlanTimeline(true)
  } catch {
    toast.add({
      title: '完成失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  } finally {
    planCompleteLoading.value = false
  }
}

const addEditWardrobeRef = ref<InstanceType<typeof WardrobeAddEditType> | null>(null)
const wardrobeSearchRef = ref<InstanceType<typeof WardrobeSearchType> | null>(null)
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChooseType> | null>(null)
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEditType> | null>(null)
const matchingBtnRef = ref<HTMLElement | null>(null)
const { flyToTarget } = useFlyToButton()

// 判断是否为移动端
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

/** 搭配草稿悬浮按钮底部偏移：App Tab 栏约 5.5rem，移动端浏览器略抬高 */
const matchingFabBottomOffset = computed(() => {
  if (configStore.uniWebviewJs) return 88
  if (isMobile.value) return 20
  return 0
})

/** 旧机 / 触屏：弱化拟态 filter 等高开销效果（弹幕/徽章弱机判断已暂关） */
const preferLiteEffects = computed(() => {
  if (import.meta.server || typeof window === 'undefined') return false
  if (window.innerWidth >= 768) return false
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches
  const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4
  const lowMem =
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory != null &&
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4
  return coarse || lowCores || lowMem
})
// /** 弹幕 / 物理徽章：弱机降级（暂关闭，有配置即展示） */
// const allowHeavyWardrobeEffects = computed(() => !preferLiteEffects.value || isPageOwner.value)

/* ============================================================
 * 主服饰网格：浏览态行级虚拟滚动
 * - 浏览态（非排序、非时间轴）只渲染可视行附近的卡片，DOM 节点数从「全量」降到「视口行数」，
 *   大幅降低样式重算 / 合成 / 内存压力（iPhone 等弱机长列表卡顿主因之一）。
 * - 排序态用自研 QhxSortableList 全量渲染（拖拽排序需要完整 DOM），二者通过 createReusableTemplate
 *   复用同一套卡片模板，避免重复且保留 <style scoped> 样式。
 * - 复用现有滚动容器（头部信息与列表同滚动），不引入额外滚动区。
 * ============================================================ */
/** 可复用卡片模板：排序态(QhxSortableList) 与 浏览态(虚拟网格) 共用同一段卡片 DOM */
const [DefineClothesCard, ReuseClothesCard] = createReusableTemplate<{ element: WardrobeClothes }>()

/** 主滚动容器（.content-area-height） */
const scrollRootRef = ref<HTMLElement | null>(null)
/** 虚拟网格占位容器（撑满总高，保证滚动条正确） */
const virtualSpacerRef = ref<HTMLElement | null>(null)
/** 可视卡片所在的内层 wrapper */
const virtualWrapperRef = ref<HTMLElement | null>(null)

/**
 * 虚拟列表行高逻辑（按行取最高 item）：
 * 1. 列数 cols 与模板断点一致（手机 3 / md 4 / xl 6 / 1920+ 10）
 * 2. 每行 row 含 list[row*cols .. row*cols+cols-1] 共最多 cols 个 item
 * 3. 行高 rowHeight[row] = max( itemCellHeight[item] )，即该行最高卡片
 * 4. itemCellHeight 未实测前由封面宽 + 备注行数 + 价格区估算；滚动经过后 DOM 实测写入缓存覆盖
 * 5. 累计偏移 offsets[row+1] = offsets[row] + rowHeight[row]，总高 = offsets[rows]
 */
const CARD_VERTICAL_PADDING_PX = 20 // py-[10px] × 2
const CARD_META_MX_PX = 4 // wardrobe-card-meta mx-[2px] × 2
const META_TOP_GAP_PX = 8 // mt-2
const META_NOTE_LINE_PX = 20 // text-sm leading-5
const META_INNER_GAP_PX = 4 // mt-1
const META_PRICE_LINE_PX = 20

/** 单列宽度（px），由 spacer 宽度 / cols 得出 */
const virtualGridCellWidth = ref(120)
/** 行索引 → 实测行高（DOM）；仅覆盖对应行，不再与估算取 max */
const measuredRowHeights = ref<Record<number, number>>({})

function clearVirtualRowHeightCache() {
  measuredRowHeights.value = {}
}

function getCardHorizontalPaddingPx(): number {
  if (typeof window === 'undefined') return 10
  return window.innerWidth < 768 ? 10 : 30
}

function updateVirtualGridCellWidth() {
  const cols = virtualColumns.value
  if (cols <= 0) return
  const spacer = virtualSpacerRef.value
  if (spacer && spacer.clientWidth > 0) {
    virtualGridCellWidth.value = spacer.clientWidth / cols
  } else if (typeof window !== 'undefined') {
    virtualGridCellWidth.value = window.innerWidth / cols
  }
}

function estimateNoteLineCount(note: string | null | undefined, textWidth: number): number {
  const t = (note ?? '').trim()
  if (!t || textWidth <= 0) return 0
  // text-sm ≈ 14px，中文约 1em 字宽
  const charsPerLine = Math.max(4, Math.floor(textWidth / 14))
  return Math.min(2, Math.ceil(t.length / charsPerLine))
}

/** 单个服饰卡片整格高度（封面正方形 + 下方 meta） */
function estimateItemCellHeight(item: WardrobeClothes, cellWidth: number): number {
  const hPad = getCardHorizontalPaddingPx()
  const contentWidth = Math.max(0, cellWidth - hPad)
  let h = contentWidth + CARD_VERTICAL_PADDING_PX

  const hasNote = showClothesNote.value && hasClothesNote(item)
  const hasPrice = showClothesPrice.value && hasClothesPrice(item)
  if (!hasNote && !hasPrice) return h

  const metaWidth = Math.max(0, contentWidth - CARD_META_MX_PX)
  h += META_TOP_GAP_PX
  if (hasNote) {
    h += estimateNoteLineCount(item.clothes_note, metaWidth) * META_NOTE_LINE_PX
  }
  if (hasPrice) {
    if (hasNote) h += META_INNER_GAP_PX
    h += META_PRICE_LINE_PX
  }
  return h
}

/** 第 row 行高度 = 该行 cols 个 item 中的最大整格高度 */
function computeRowHeightFromItems(
  row: number,
  cols: number,
  items: WardrobeClothes[],
  cellWidth: number,
): number {
  let maxH = 0
  const start = row * cols
  const end = Math.min(start + cols, items.length)
  for (let i = start; i < end; i++) {
    const item = items[i]
    if (item) maxH = Math.max(maxH, estimateItemCellHeight(item, cellWidth))
  }
  return maxH
}

const hasClothesNote = (item: WardrobeClothes) => !!(item.clothes_note?.trim())
const hasClothesPrice = (item: WardrobeClothes) => !!item.price
const shouldShowClothesNote = (item: WardrobeClothes) => showClothesNote.value && hasClothesNote(item)
const shouldShowClothesPrice = (item: WardrobeClothes) => showClothesPrice.value && hasClothesPrice(item)
const shouldShowClothesCardMeta = (item: WardrobeClothes) =>
  shouldShowClothesNote(item) || shouldShowClothesPrice(item)

function findRowAtScrollOffset(scrollY: number, offsets: number[]): number {
  const rowCount = offsets.length - 1
  if (rowCount <= 0) return 0
  let lo = 0
  let hi = rowCount - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    const offset = offsets[mid] ?? 0
    if (offset <= scrollY) lo = mid
    else hi = mid - 1
  }
  return lo
}
/** 滚动容器 scrollTop（rAF 节流写入） */
const virtualScrollTop = ref(0)
/** 滚动容器可视高度 */
const virtualViewportH = ref(0)
/** 当前每行列数（与模板断点保持一致） */
const virtualColumns = ref(3)
/** 网格区块相对滚动内容顶部的偏移（头部高度变化时更新） */
const virtualListOffsetTop = ref(0)
/** 上下额外多渲染的行数：适当增大，回滚时近距离行不被卸载，避免图片重新加载 */
const VIRTUAL_OVERSCAN_ROWS = 6

/**
 * 已加载图片 URL 记录（普通 Set，不参与响应式，避免无谓 re-render）。
 * 卡片因虚拟滚动卸载后再次进入视口时，已加载过的图用 eager 立即从缓存出图，消除“回滚重新加载”的闪烁。
 */
const wardrobeLoadedImgKeys = new Set<string>()
const markWardrobeImgLoaded = (key?: string | null) => {
  if (key) wardrobeLoadedImgKeys.add(key)
}
function onClothesCardImgLoad(imgKey?: string | null) {
  markWardrobeImgLoaded(imgKey)
  if (isWaterfallLayout.value) {
    waterListRef.value?.debouncedApplyLayout()
  }
}

function scheduleWaterfallLayout() {
  if (!isWaterfallLayout.value) return
  nextTick(() => {
    waterListRef.value?.scheduleApplyLayout?.()
  })
}
const wardrobeImgLoadingMode = (key?: string | null): 'eager' | 'lazy' =>
  key && wardrobeLoadedImgKeys.has(key) ? 'eager' : 'lazy'

/** 列数与模板断点一致：<768→3，768–1279→4，1280–1919→6，≥1920→10 */
function computeVirtualColumns(): number {
  if (typeof window === 'undefined') return 3
  const w = window.innerWidth
  if (w >= 1920) return 10
  if (w >= 1280) return 6
  if (w >= 768) return 4
  return 3
}

/** 仅浏览态 + 网格布局启用虚拟滚动 */
const CLOTHES_LIST_LAYOUT_KEY = 'wardrobe-detail-clothes-list-layout'
type ClothesListLayout = 'grid' | 'waterfall'

function readClothesListLayoutPref(): ClothesListLayout {
  if (!import.meta.client || typeof localStorage === 'undefined') return 'grid'
  try {
    const v = localStorage.getItem(CLOTHES_LIST_LAYOUT_KEY)
    return v === 'waterfall' ? 'waterfall' : 'grid'
  } catch {
    return 'grid'
  }
}

/** 服饰列表布局：网格 / 瀑布流（localStorage 持久化，默认网格） */
const clothesListLayout = ref<ClothesListLayout>(readClothesListLayoutPref())
/** 瀑布流列表 ref（QhxWaterList 仅负责布局，数据来自 list） */
const waterListRef = ref<InstanceType<typeof QhxWaterList> | null>(null)
const isWaterfallLayout = computed(
  () => clothesListLayout.value === 'waterfall' && !sortMode.value && !timelineMode.value,
)
const virtualEnabled = computed(
  () => !sortMode.value && !timelineMode.value && clothesListLayout.value === 'grid',
)

/** 每行高度：DOM 实测优先，否则 max(该行各 item 估算高度) */
const virtualPerRowHeights = computed(() => {
  if (!virtualEnabled.value) return [] as number[]
  const cols = virtualColumns.value
  const items = list.value
  const rows = Math.ceil(items.length / cols) || 0
  const cellW = virtualGridCellWidth.value
  const measured = measuredRowHeights.value
  const heights: number[] = []
  for (let r = 0; r < rows; r++) {
    const domH = measured[r]
    heights.push(
      domH !== undefined && domH > 0
        ? domH
        : computeRowHeightFromItems(r, cols, items, cellW),
    )
  }
  return heights
})

const virtualRowOffsets = computed(() => {
  const offsets = [0]
  for (const h of virtualPerRowHeights.value) {
    const prev = offsets[offsets.length - 1] ?? 0
    offsets.push(prev + h)
  }
  return offsets
})

const virtualAvgRowHeight = computed(() => {
  const heights = virtualPerRowHeights.value
  if (!heights.length) {
    const first = list.value[0]
    return first
      ? estimateItemCellHeight(first, virtualGridCellWidth.value)
      : virtualGridCellWidth.value + CARD_VERTICAL_PADDING_PX
  }
  return heights.reduce((sum, h) => sum + h, 0) / heights.length
})

const virtualTotalHeight = computed(() => {
  const offsets = virtualRowOffsets.value
  return offsets.length > 0 ? (offsets[offsets.length - 1] ?? 0) : 0
})

/** 当前应渲染的行区间与纵向偏移 */
const virtualRange = computed(() => {
  const cols = virtualColumns.value
  const offsets = virtualRowOffsets.value
  const totalRows = virtualPerRowHeights.value.length
  if (totalRows === 0) {
    return { startRow: 0, endRow: 0, startIndex: 0, endIndex: 0, offsetY: 0 }
  }

  const relTop = Math.max(0, virtualScrollTop.value - virtualListOffsetTop.value)
  const startRow = Math.max(0, findRowAtScrollOffset(relTop, offsets) - VIRTUAL_OVERSCAN_ROWS)
  const bottomY = relTop + (virtualViewportH.value || 0) + VIRTUAL_OVERSCAN_ROWS * virtualAvgRowHeight.value
  const endRow = Math.min(totalRows, findRowAtScrollOffset(bottomY, offsets) + 1 + VIRTUAL_OVERSCAN_ROWS)
  return {
    startRow,
    endRow,
    startIndex: startRow * cols,
    endIndex: endRow * cols,
    offsetY: offsets[startRow] ?? 0,
  }
})

/** 可视行 → 每行最多 cols 个 item（与模板断点列数一致） */
const virtualVisibleRows = computed(() => {
  if (!virtualEnabled.value) return [] as WardrobeClothes[][]
  const { startRow, endRow } = virtualRange.value
  const cols = virtualColumns.value
  const items = list.value
  const rows: WardrobeClothes[][] = []
  for (let r = startRow; r < endRow; r++) {
    const start = r * cols
    if (start >= items.length) break
    rows.push(items.slice(start, Math.min(start + cols, items.length)))
  }
  return rows
})

const virtualOffsetY = computed(() => virtualRange.value.offsetY)

/** 测量滚动容器可视高度 */
function measureVirtualViewport() {
  const root = scrollRootRef.value
  if (root) virtualViewportH.value = root.clientHeight
}

/** 测量网格区块在滚动内容中的偏移（受头部折叠/内容高度影响） */
function measureVirtualOffset() {
  const root = scrollRootRef.value
  const spacer = virtualSpacerRef.value
  if (!root || !spacer) return
  const rootRect = root.getBoundingClientRect()
  const spacerRect = spacer.getBoundingClientRect()
  virtualListOffsetTop.value = spacerRect.top - rootRect.top + root.scrollTop
}

/** 可视区 DOM 实测：第 row 行高度 = 该行各格 offsetHeight 的最大值 */
function measureVirtualRowHeightsFromDom() {
  const wrapper = virtualWrapperRef.value
  if (!wrapper || !virtualEnabled.value) return

  const rowEls = wrapper.querySelectorAll('.wardrobe-virtual-row')
  if (!rowEls.length) return

  const prev = measuredRowHeights.value
  const next: Record<number, number> = { ...prev }
  let changed = false

  for (const node of rowEls) {
    const rowEl = node as HTMLElement
    const row = Number(rowEl.dataset.row)
    if (!Number.isFinite(row)) continue

    let maxH = 0
    for (const cell of rowEl.querySelectorAll('.wardrobe-clothes-cell--virtual')) {
      maxH = Math.max(maxH, (cell as HTMLElement).offsetHeight)
    }
    if (maxH <= 0) continue

    const existing = next[row]
    if (existing === undefined || Math.abs(existing - maxH) > 1) {
      next[row] = maxH
      changed = true
    }
  }

  if (changed) measuredRowHeights.value = next
}

function clampVirtualScrollAfterHeightChange() {
  const root = scrollRootRef.value
  if (!root) return
  const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight)
  if (root.scrollTop > maxScroll) {
    root.scrollTop = maxScroll
    virtualScrollTop.value = maxScroll
  }
}

let virtualMeasureRafId: number | null = null
function scheduleVirtualRowMeasure() {
  if (!virtualEnabled.value) return
  if (virtualMeasureRafId != null) return
  virtualMeasureRafId = requestAnimationFrame(() => {
    virtualMeasureRafId = null
    updateVirtualGridCellWidth()
    measureVirtualRowHeightsFromDom()
    measureVirtualOffset()
    clampVirtualScrollAfterHeightChange()
  })
}

/** 滚动监听（rAF 节流），更新 scrollTop 与偏移 */
let virtualRafId: number | null = null
function onVirtualScroll() {
  const root = scrollRootRef.value
  if (!root || virtualRafId != null) return
  virtualRafId = requestAnimationFrame(() => {
    virtualRafId = null
    virtualScrollTop.value = root.scrollTop
    measureVirtualOffset()
  })
}

/** 切换衣柜后回到主内容区顶部（同步 virtualScrollTop，避免虚拟列表仍按旧滚动位置切片） */
function scrollWardrobeContentToTop() {
  const root = scrollRootRef.value
  if (root) root.scrollTop = 0
  virtualScrollTop.value = 0
  nextTick(measureVirtualOffset)
}

/** 重新测量（列数 / 列宽 / 行高 / 偏移） */
function remeasureVirtual() {
  virtualColumns.value = computeVirtualColumns()
  clearVirtualRowHeightCache()
  measureVirtualViewport()
  virtualSpacerObservedWidth = 0
  nextTick(() => {
    updateVirtualGridCellWidth()
    const spacer = virtualSpacerRef.value
    if (spacer && spacer.clientWidth > 0) {
      virtualSpacerObservedWidth = spacer.clientWidth
    }
    scheduleVirtualRowMeasure()
  })
}
const remeasureVirtualDebounced = useDebounceFn(remeasureVirtual, 150)

const matchingDraftIdSet = computed(
  () =>
    new Set(
      matchingDraftStore.list
        .map((item) => item.clothes_id)
        .filter((id): id is number => id != null),
    ),
)
const isInMatchingDraft = (clothesId: number | null | undefined) =>
  clothesId != null && matchingDraftIdSet.value.has(clothesId)

const EMPTY_CLOTHES_SORT_MAP = new Map<number, number>()

const planTimelineDrawerDefaultSize = computed(() => {
  if (typeof window === 'undefined') return 400
  return isMobile.value ? Math.min(360, window.innerWidth - 24) : 400
})

/** 服饰状态角标配色（参考展馆 scene-link-detail-tag） */
const WARDROBE_STATUS_BADGE_MAP: Record<string, string> = {
  待补款: 'wardrobe-clothes-status-badge--amber',
  已拥有: 'wardrobe-clothes-status-badge--emerald',
}

function getWardrobeStatusBadgeClass(status: string | null | undefined): string {
  if (!status) return 'wardrobe-clothes-status-badge--violet'
  return WARDROBE_STATUS_BADGE_MAP[status] ?? 'wardrobe-clothes-status-badge--violet'
}

// 衣柜状态选项
const wardrobeStatusOptions = computed(() => {
  if (!wardrobeStore.config?.wardrobe_status) return []
  return wardrobeStore.config.wardrobe_status
    .filter((status: string) => status !== '自定义')
    .map((status: string) => ({
      label: status,
      value: status
    }))
})

/** `/clothes/config` 中含 `total_price` 时展示「全衣柜总价」，与当前衣柜「总价」同样受 `show_price` 控制 */
const hasConfigAllWardrobesTotalPrice = computed(() => {
  const v = wardrobeStore.config?.total_price
  if (v == null) return false
  return String(v).length > 0
})

// 筛选条件数量
const filterCount = computed(() => {
  let count = 0
  if (filter_list.value.wardrobe_status.length > 0) {
    count += filter_list.value.wardrobe_status.length
  }
  if (filter_list.value.clothes_note && filter_list.value.clothes_note.trim() !== '') {
    count += 1
  }
  if (filter_list.value.size.length > 0) {
    count += filter_list.value.size.length
  }
  return count
})

/** 尺码筛选项：接口 size_list + 已选尺码（避免选项被筛掉后无法取消） */
const sizeFilterOptions = computed(() => {
  const set = new Set<string>()
  for (const s of sizeList.value) {
    const t = s?.trim()
    if (t) set.add(t)
  }
  for (const s of filter_list.value.size) {
    const t = s?.trim()
    if (t) set.add(t)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const mergeSizeOptionsFromRows = (rows: WardrobeClothes[]) => {
  const set = new Set(sizeList.value)
  for (const item of rows) {
    const s = item.size?.trim()
    if (s) set.add(s)
  }
  sizeList.value = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

// 是否有激活的筛选
const hasActiveFilter = computed(() => {
  return filterCount.value > 0
})
const showAddWardrobe = (e?: MouseEvent) => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel(null, e)
  }
}
const openWardrobeSearch = () => {
  if (wardrobeSearchRef.value) {
    wardrobeSearchRef.value.showModel()
  }
}
const showEditWardrobe = (item: Wardrobe, e?: MouseEvent) => {
  if (addEditWardrobeRef.value) {
    addEditWardrobeRef.value.showModel(item, e)
  }
}
const fetchWardrobeList = async () => {
  const response = await getWardrobeList({
    user_id: Number.parseInt(id),
    pageSize: 999,
    qrcode: qrcode.value || undefined,
    password: password.value || undefined,
  })
  wardrobeList.value = response.rows
  wardrobeCount.value = response.count
}
const checkPassword = (wardrobe_id: number) => {
  const params = {
    wardrobe_id,
    password: password.value
  }
  checkWadrobePassword(params)
    .then((res) => {
      if (record.value) {
        currentWardrobe.value = record.value
        console.log(currentWardrobe.value, 'currentWardrobe.value')
        page.value = 1
        scrollWardrobeContentToTop()
        void fetchClothesList()
        router.replace({
          query: {
            ...route.query,
            password: params.password,
            wardrobe_id: currentWardrobe.value.wardrobe_id
          },
          force: true
        })
        showPassword.value = false
      }
    })
    .catch(() => {
      currentWardrobe.value = null
    })
}
const initFilter = () => {
  filter_list.value = {
    tags: [],
    wardrobe_status: [],
    clothes_note: '',
    size: [],
  }
}
/** 侧栏衣柜项：点的若是当前衣柜则打开攒钱计划抽屉，否则切换衣柜（与原「点我」同一大块热区） */
const onWardrobeListItemClick = (item: Wardrobe) => {
  if (currentWardrobe.value?.wardrobe_id === item.wardrobe_id) {
    openPlanTimelineDrawer(item.wardrobe_id)
    return
  }
  changeWardrobe(item)
}

const changeWardrobe = (item: Wardrobe) => {
  console.log(item, 'item')
  if (currentWardrobe.value?.wardrobe_id === item.wardrobe_id) return
  if (!isPageOwner.value && item.password && !qrcode.value) {
    record.value = item
    if (!password.value) {
      showPassword.value = true
    } else {
      void checkPassword(item.wardrobe_id)
    }
    return
  }
  currentWardrobe.value = item
  scrollWardrobeContentToTop()
  page.value = 1
  initFilter()
  sizeList.value = []
  selectMode.value = false
  editMode.value = false
  selectedClothesIds.value = new Set()
  void fetchClothesList()
  router.replace({
    query: {
      ...route.query,
      wardrobe_id: currentWardrobe.value.wardrobe_id
    },
    force: true
  })
}

/** 解析加入时间戳（毫秒），缺失或非法为 0 */
const clothesAddTimeMs = (item: WardrobeClothes): number => {
  const t = item.add_time
  if (t == null) return 0
  const d = t instanceof Date ? t : new Date(typeof t === 'string' || typeof t === 'number' ? t : String(t))
  const ms = d.getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * 时间轴单卡日均价：价格 / 自入柜日至今日（含首尾）自然日数，至少按 1 天计。
 * 无入柜时间或无有效价格时返回 null。
 */
const timelineItemDailyAvgPrice = (item: WardrobeClothes): number | null => {
  const ms = clothesAddTimeMs(item)
  if (ms <= 0) return null
  const p = Number(item.price)
  if (!Number.isFinite(p) || p <= 0) return null
  const days = Math.max(
    1,
    dayjs().startOf('day').diff(dayjs(ms).startOf('day'), 'day') + 1
  )
  return p / days
}

const formatTimelineItemDailyAvg = (item: WardrobeClothes): string | null => {
  const v = timelineItemDailyAvgPrice(item)
  return v === null ? null : v.toFixed(2)
}

/** 客户端兜底：与 `sort_list: add_time_asc` 一致（后端未实现时仍有序） */
const sortListByAddTimeAsc = (rows: WardrobeClothes[]) =>
  [...rows].sort((a, b) => clothesAddTimeMs(a) - clothesAddTimeMs(b))

const fetchClothesList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
  if (!currentWardrobe.value?.wardrobe_id) return

  const seq = ++clothesListFetchSeq
  isLoading.value = true
  const resolvedPageSize =
    IpageSize != null && IpageSize > 0
      ? IpageSize
      : timelineMode.value
        ? TIMELINE_PAGE_SIZE
        : pageSize
  const params: ClothesParams = {
    page: Ipage || page.value,
    pageSize: resolvedPageSize,
    wardrobe_id: currentWardrobe.value.wardrobe_id,
    filter_list: filter_list.value
  }
  if (timelineMode.value) {
    params.sort_list = 'add_time_asc'
  }
  if (password.value) {
    params.password = password.value
  }
  if (qrcode.value) {
    params.qrcode = qrcode.value
  }
  try {
    const response = await getClothesList(params)
    if (seq !== clothesListFetchSeq) return

    const rawRows = response.rows ?? []
    const merged =
      params.page === 1
        ? rawRows
        : [...list.value, ...rawRows]
    if (timelineMode.value) {
      list.value = sortListByAddTimeAsc(merged)
    } else if (params.page === 1) {
      list.value = rawRows
    } else {
      list.value = merged
    }
    if (params.page === 1) {
      if (response.tags_list) {
        tagList.value = response.tags_list
      } else {
        tagList.value = []
      }
    }
    if (response.size_list?.length) {
      sizeList.value = response.size_list
    } else {
      mergeSizeOptionsFromRows(rawRows)
    }
    total.value = response.count
    if (response.info) {
      info.value = response.info
    }
    console.log(response, '衣柜返回值')
  } catch (error) {
    console.log(error, 'error走了获取错误')
    isLoading.value = false
  } finally {
    isLoading.value = false
    if (seq === clothesListFetchSeq) {
      scheduleWaterfallLayout()
    }
  }
}
const copyUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl();
  try {
    await copyCurrentUrl()
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

const wardrobeSimilarRecommendRef = ref<{ open: () => void } | null>(null)
const qrcodeListRef = ref<InstanceType<typeof QrcodeListType> | null>(null)

const showQRCodeList = () => {
  const wid = currentWardrobe.value?.wardrobe_id
  if (wid == null) {
    toast.add({ title: '请先选择衣柜', color: 'amber', icon: 'i-heroicons-information-circle' })
    return
  }
  qrcodeListRef.value?.open({
    pk_id: wid,
    pk_type: 0,
    wardrobe: info.value ?? currentWardrobe.value ?? null,
    userName: user.user?.user_name,
    userFace: user.user?.user_face,
    previewClothes: list.value.slice(0, 3),
  })
}
const showAddClothes = () => {
  if (addEditClothesRef.value) {
    addEditClothesRef.value.showModel(currentWardrobe.value)
  }
}
const showBatchAddClothes = (event?: MouseEvent) => {
  clothesBatchAddEntryRef.value?.showModel(currentWardrobe.value, event)
}
const getWardrobeIdByPoint = (clientX: number, clientY: number): number | null => {
  if (typeof document === 'undefined') return null

  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!el) return null

  let current: HTMLElement | null = el
  while (current) {
    // 你的衣柜名称节点 class 是 wardrobe-name，并带有 data-wardrobe-id
    if (current.classList && current.classList.contains('wardrobe-name')) {
      const idStr = current.dataset.wardrobeId
      return idStr ? Number.parseInt(idStr) : null
    }
    current = current.parentElement
  }
  return null
}
const fetchWardrobeClothes = async (clothesId: number, wardrobeId: number) => {
  const response = await changeWardrobeClothes({
    clothes_id: clothesId,
    wardrobe_id: wardrobeId
  })
  if (response) {
    toast.add({
      title: '服饰已移动到其他衣柜',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  }
  const index = list.value.findIndex(item => item.clothes_id === clothesId)
  if (index !== -1) {
    list.value.splice(index, 1)
  }
  opearClothesId.value = null
  reload()
  isSorting.value = false
}
// 服饰拖拽部分(*^▽^*)
const onDragStart = () => {
  oldList = list.value.map((item, index) => ({ clothes_id: item.clothes_id, sort: item.sort || index }));
};
/** QhxSortableList 的 end 事件载荷：{ oldIndex, newIndex, key, clientX, clientY, originalEvent } */
const onDragEnd = async (payload?: { clientX?: number; clientY?: number }) => {
  if (isSorting.value) return; // 防止重复提交
  isSorting.value = true;
  try {
    // 落点命中左侧衣柜名 => 将服饰移动到该衣柜（鼠标 / 触摸统一用坐标命中）
    const clientX = payload?.clientX
    const clientY = payload?.clientY
    if (clientX != null && clientY != null) {
      const wardrobeId = getWardrobeIdByPoint(clientX, clientY)
      if (wardrobeId && wardrobeId !== currentWardrobe.value?.wardrobe_id && opearClothesId.value) {
        await fetchWardrobeClothes(opearClothesId.value, wardrobeId)
        return
      }
    }
    // 找出位置发生变化的元素并持久化排序
    const changed: { clothes_id: number; sort: number }[] = [];
    list.value.forEach((item, newIndex) => {
      const oldItem = oldList[newIndex];
      if (!oldItem || item.clothes_id !== oldItem.clothes_id) {
        changed.push({
          clothes_id: item.clothes_id,
          sort: oldItem?.sort ?? item.sort,
        });
      }
    });

    if (changed.length > 0 && currentWardrobe.value?.wardrobe_id) {
      const params = {
        wardrobe_id: currentWardrobe.value.wardrobe_id,
        sort: changed.map((item) => ({
          clothes_id: item.clothes_id,
          sort: item.sort,
        })),
      };
      await sortClothee(params);
    }
  } catch (error) {
    console.error("排序更新失败:", error);
  } finally {
    isSorting.value = false;
  }
};
const loadMore = () => {
  if (timelineMode.value || isLoading.value) return
  void handlePageChange(page.value + 1)
}
// 页码改变处理函数
const handlePageChange = async (current: number) => {
  const prevPage = page.value
  page.value = current
  try {
    await fetchClothesList()
  } catch {
    page.value = prevPage
  }
}
const reload = async () => {
  const loadedPages = page.value
  page.value = 1
  const sz = timelineMode.value ? TIMELINE_PAGE_SIZE : pageSize * loadedPages
  await fetchClothesList(1, sz)
}
const reloadWardrobe = () => {
  reload()
  wardrobeStore.getWardrobeConfig()
}

/** 编辑服饰成功后就地更新列表项，避免整表重载 */
const patchClothesInList = (payload: WardrobeClothes): boolean => {
  const clothesId = payload.clothes_id
  if (clothesId == null) return false

  const currentWardrobeId = currentWardrobe.value?.wardrobe_id
  if (
    payload.wardrobe_id != null
    && currentWardrobeId != null
    && payload.wardrobe_id !== currentWardrobeId
  ) {
    const movedIdx = list.value.findIndex((item) => item.clothes_id === clothesId)
    if (movedIdx !== -1) list.value.splice(movedIdx, 1)
    return true
  }

  const idx = list.value.findIndex((item) => item.clothes_id === clothesId)
  if (idx === -1) return false

  list.value[idx] = { ...list.value[idx], ...payload }
  if (timelineMode.value) {
    list.value = sortListByAddTimeAsc(list.value)
  }
  clearVirtualRowHeightCache()
  scheduleWaterfallLayout()
  return true
}

const onClothesAddSuccess = (payload?: WardrobeClothes) => {
  if (payload && patchClothesInList(payload)) return
  reloadWardrobe()
}
const onWardrobeEditSuccess = async () => {
  await fetchWardrobeList()
  if (currentWardrobe.value?.wardrobe_id) {
    await fetchClothesList(1, pageSize)
    // 用最新数据更新 currentWardrobe，避免再次编辑时显示旧数据
    const updated = wardrobeList.value.find(w => w.wardrobe_id === currentWardrobe.value?.wardrobe_id)
    if (updated) {
      currentWardrobe.value = updated
    }
    // 同时确保 info 与 currentWardrobe 一致（info 来自 getClothesList，可能包含更多字段）
    if (info.value && info.value.wardrobe_id === currentWardrobe.value?.wardrobe_id) {
      currentWardrobe.value = { ...currentWardrobe.value, ...info.value }
    }
  }
}
// 快速更新衣柜设置
const isUpdatingWardrobe = ref(false)
const loadingController = ref({
  is_private: false,
  show_price: false,
  sort_type: false
})
const updateWardrobeSetting = async (field: 'sort_type' | 'is_private' | 'show_price', value: number) => {
  if (!currentWardrobe.value?.wardrobe_id || !info.value) return
  if (loadingController.value[field]) return
  
  loadingController.value[field] = true
  try {
    const params: Wardrobe = {
      wardrobe_id: currentWardrobe.value.wardrobe_id,
      [field]: value
    }
    await updateWardrobe(params)
    // 更新本地数据
    if (info.value) {
      info.value[field] = value
    }
    if (currentWardrobe.value) {
      currentWardrobe.value[field] = value
    }
    // 如果是排序类型改变，重新加载列表
    if (field === 'sort_type') {
      page.value = 1
      await fetchClothesList(1, pageSize)
    }
    toast.add({
      title: '修改成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('更新失败:', error)
    toast.add({
      title: '修改失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    setTimeout(() => {
      loadingController.value[field] = false
    }, 300)
  }
}
// 格式化排序类型显示
const formatSortType = (index: number | undefined) => {
  if (index === undefined || index === null) return '自定义'
  const sortTypeMap: Record<number, string> = {
    0: '自定义',
    1: '购入倒叙',
    2: '购入正序',
    3: '价格倒叙',
    4: '价格正序',
    5: '穿着次数倒叙',
    7: '评分倒叙',
    8: '评分正序'
  }
  return sortTypeMap[index] || '自定义'
}
// 价格显示模式选项
const priceTypeOptions = [
  { label: '显示总价', value: 1 },
  { label: '隐藏总价', value: 0 },
  { label: '隐藏所有', value: 2 }
]
// 排序模式选项
const sortTypeOptions = [
  { label: '自定义', value: 0 },
  { label: '购入倒叙', value: 1 },
  { label: '购入正序', value: 2 },
  { label: '价格倒叙', value: 3 },
  { label: '价格正序', value: 4 },
  { label: '穿着次数倒叙', value: 5 },
  { label: '评分倒叙', value: 7 },
  { label: '评分正序', value: 8 }
]
// 选择价格显示模式
const showPriceSelect = ref(false)
const priceSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const showChoosePrice = (e: MouseEvent) => {
  if (priceSelectRef.value) {
    priceSelectRef.value.showPicker(e)
  }
}
const onPriceTypeChange = (option: { label: string; value: number }) => {
  updateWardrobeSetting('show_price', option.value)
}
// 选择排序模式
const sortSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const showChooseSort = (e: MouseEvent) => {
  if (sortSelectRef.value) {
    sortSelectRef.value.showPicker(e)
  }
}
const onSortTypeChange = (option: { label: string; value: number }) => {
  updateWardrobeSetting('sort_type', option.value)
}
// 判断是否是当前衣柜的拥有者
const isWardrobeOwner = computed(() => {
  return user.user?.user_id === Number.parseInt(id) && currentWardrobe.value?.user_id === user.user?.user_id
})

const isInUniAppShell = computed(
  () =>
    import.meta.client &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
)

/**
 * UniApp 衣柜详情「设为首页」：`message_config.home_page` **仅在为 `3` 时表示开启**。
 * `0`、`1`、未定义或其它任意数字均视为关闭（与功能导航页一致）。
 */
const WARDROBE_HOME_PAGE = 3
const WARDROBE_HOME_PAGE_OFF = 0

function isWardrobeHomeEnabled(homePage: unknown): boolean {
  if (typeof homePage === 'boolean') return false
  const n = Number(homePage)
  return Number.isFinite(n) && n === WARDROBE_HOME_PAGE
}

function getWardrobeMessageConfigBase(): Record<string, unknown> {
  const mc = user.user?.message_config
  if (!mc || typeof mc !== 'object') return {}
  return { ...(mc as Record<string, unknown>) }
}

function isWardrobeUserLoggedIn(): boolean {
  const uid = user.user?.user_id
  return !(uid == null || !Number.isFinite(Number(uid)))
}

const wardrobeAsHomeToggle = ref(false)
const savingWardrobeHome = ref(false)
const showWardrobeHomeUpdateModal = ref(false)

function syncWardrobeAsHomeToggleFromUser() {
  wardrobeAsHomeToggle.value = isWardrobeHomeEnabled(
    getWardrobeMessageConfigBase().home_page
  )
}

watch(
  () => user.user?.message_config?.home_page,
  () => {
    syncWardrobeAsHomeToggleFromUser()
  },
  { immediate: true },
)

async function handleWardrobeAsHomeChange(value: boolean) {
  if (!isWardrobeUserLoggedIn()) {
    wardrobeAsHomeToggle.value = false
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-information-circle',
      color: 'gray'
    })
    return
  }
  savingWardrobeHome.value = true
  try {
    const raw = getWardrobeMessageConfigBase()
    const merged: Record<string, unknown> = value
      ? { ...raw, home_page: WARDROBE_HOME_PAGE }
      : { ...raw, home_page: WARDROBE_HOME_PAGE_OFF }
    await user.updateUserInfo({
      message_config: merged
    })
    wardrobeAsHomeToggle.value = value
    if (value) {
      showWardrobeHomeUpdateModal.value = true
    } else {
      toast.add({
        title: '已取消设为首页',
        icon: 'i-heroicons-information-circle',
        color: 'gray'
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '保存失败'
    wardrobeAsHomeToggle.value = !value
    toast.add({
      title: '保存失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    savingWardrobeHome.value = false
    syncWardrobeAsHomeToggleFromUser()
  }
}

/** 衣柜主人已拥有徽章（用于解析 display_badge 展示物理徽章，与 userSpace 一致） */
function badgeToUserDeco(item: UserDecoBadgeItem): UserDeco {
  const cover = item.cover || item.url || 'static/plan_cover/default.jpg'
  const name = item.title ?? `徽章${item.deco_id}`
  return {
    deco_id: item.deco_id,
    pk_type: 1,
    pk_id: item.deco_id,
    foreign: { cover, name },
  }
}
const ownerBadges = ref<UserDecoBadgeItem[]>([])
const fetchOwnerBadges = async () => {
  const uid = Number.parseInt(id, 10)
  if (!uid || Number.isNaN(uid)) {
    ownerBadges.value = []
    return
  }
  // 未登录或非页面主人时不请求，避免触发强制登录跳转
  if (!user.token || !isPageOwner.value) {
    ownerBadges.value = []
    return
  }
  try {
    const res = await getUserDecoBadges({ user_id: uid })
    ownerBadges.value = res.rows ?? []
  } catch (e) {
    console.error('获取衣柜主人徽章失败:', e)
    ownerBadges.value = []
  }
}
const wardrobeDisplayBadgeStr = computed(
  () => info.value?.display_badge ?? currentWardrobe.value?.display_badge ?? ''
)
const wardrobeDisplayBadges = computed<UserDeco[]>(() => {
  const ids = wardrobeDisplayBadgeStr.value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
  if (!ids.length) return []
  const byId = new Map(ownerBadges.value.map((b) => [b.deco_id, b]))
  const out: UserDeco[] = []
  for (const decoId of ids) {
    const item = byId.get(decoId)
    if (item) out.push(badgeToUserDeco(item))
  }
  return out
})
const hasWardrobeDisplayBadges = computed(() => wardrobeDisplayBadges.value.length > 0)
const wardrobeDisplayBadgesKey = computed(
  () =>
    wardrobeDisplayBadgeStr.value ||
    (wardrobeDisplayBadges.value.length
      ? wardrobeDisplayBadges.value.map((b) => b.deco_id).join(',')
      : 'empty')
)
const wardrobeDecoModalOpen = ref(false)
const wardrobeDecoModalPosition = ref({ x: 0, y: 0 })
const wardrobeDecoInitialSelectedIds = computed(() =>
  wardrobeDisplayBadgeStr.value
    ? wardrobeDisplayBadgeStr.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : []
)
const openWardrobeDecoConfig = (e?: MouseEvent) => {
  if (e) wardrobeDecoModalPosition.value = { x: e.clientX, y: e.clientY }
  else if (typeof window !== 'undefined')
    wardrobeDecoModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  wardrobeDecoModalOpen.value = true
}
const onWardrobeDecoSaved = (payload?: { display_badge?: string }) => {
  const s = payload?.display_badge ?? ''
  if (info.value) info.value.display_badge = s
  if (currentWardrobe.value) currentWardrobe.value.display_badge = s
  const wid = currentWardrobe.value?.wardrobe_id
  if (wid != null) {
    const idx = wardrobeList.value.findIndex((w) => w.wardrobe_id === wid)
    if (idx !== -1 && wardrobeList.value[idx]) wardrobeList.value[idx].display_badge = s
  }
}

// 是否开放弹幕（config.open_danmu === 1 时显示弹幕组件）
const isDanmakuEnabled = computed(() => {
  // if (!allowHeavyWardrobeEffects.value) return false
  const cfg = info.value?.config ?? currentWardrobe.value?.config
  return cfg?.open_danmu === 1
})

// 删除衣柜
const confirmDeleteWardrobe = async () => {
  if (!currentWardrobe.value?.wardrobe_id) return
  try {
    await deleteWardrobe({
      wardrobe_id: currentWardrobe.value.wardrobe_id
    })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 从列表中移除已删除的衣柜
    const index = wardrobeList.value.findIndex(item => item.wardrobe_id === currentWardrobe.value?.wardrobe_id)
    if (index !== -1) {
      wardrobeList.value.splice(index, 1)
    }
    // 切换到其他衣柜或清空
    if (wardrobeList.value.length > 0) {
      changeWardrobe(wardrobeList.value[0])
    } else {
      currentWardrobe.value = null
      info.value = null
      list.value = []
      router.replace({
        query: {
          ...route.query,
          wardrobe_id: undefined
        },
        force: true
      })
    }
  } catch (error) {
    console.error('删除失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteModal.value = false
  }
}
// 衣柜列表拖拽排序
const isWardrobeSorting = ref(false)
const onWardrobeDragEnd = async () => {
  if (isWardrobeSorting.value) return; // 防止重复提交
  isWardrobeSorting.value = true;

  try {
    const params = {
      sort: wardrobeList.value.map((item, index) => ({
        wardrobe_id: item.wardrobe_id || 0,
        sort: index,
      })),
    };

    await sortWardrobe(params);
    toast.add({
      title: '排序已更新',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error("排序更新失败:", error);
    toast.add({
      title: '排序更新失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    isWardrobeSorting.value = false;
  }
};
const chooseTags = (tags: string) => {
  const index = filter_list.value.tags.findIndex((child) => {
    return tags === child
  })
  if (index === -1) {
    filter_list.value.tags.push(tags)
  } else {
    filter_list.value.tags.splice(index, 1)
  }
  reload()
}
// 选择状态
const chooseStatus = (label: string) => {
  const index = filter_list.value.wardrobe_status.findIndex((status) => {
    return status === label
  })
  if (index === -1) {
    filter_list.value.wardrobe_status.push(label)
  } else {
    filter_list.value.wardrobe_status.splice(index, 1)
  }
}
// 选择尺码
const chooseSize = (size: string) => {
  const index = filter_list.value.size.findIndex((item) => item === size)
  if (index === -1) {
    filter_list.value.size.push(size)
  } else {
    filter_list.value.size.splice(index, 1)
  }
}
// 重置筛选
const resetFilter = () => {
  filter_list.value.wardrobe_status = []
  filter_list.value.clothes_note = ''
  filter_list.value.size = []
  confirmFilter()
}
// 确认筛选
const confirmFilter = () => {
  showFilterDrawer.value = false
  page.value = 1
  fetchClothesList()
}
// 关闭筛选抽屉
const closeFilterDrawer = () => {
  showFilterDrawer.value = false
}

/** 喜爱级别 0–5（列表角标仅展示 1–5）；与 `is_favorite` 一致 */
const getClothesFavoriteLevel = (item: WardrobeClothes): number => {
  const v = item.is_favorite
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
}

const getClothesFavoriteLevelTitle = (item: WardrobeClothes) =>
  `喜爱评级 ${getClothesFavoriteLevel(item)} 星`

const buildClothesDetailQuery = (): Record<string, string> => {
  const query: Record<string, string> = {}
  if (qrcode.value) {
    query.qrcode = qrcode.value
  }
  return query
}

const buildClothesDetailUrl = (clothesId: number | undefined) => {
  const query = buildClothesDetailQuery()
  const search = new URLSearchParams(query).toString()
  const path = `/clothes/detail/${clothesId}`
  return search ? `${path}?${search}` : path
}

const jumpToClothes = (item: WardrobeClothes) => {
  if (sortMode.value) return
  if (matchingMode.value) return
  if (selectMode.value) return
  if (editMode.value) return
  const clothesDetailUrl = buildClothesDetailUrl(item.clothes_id)
  const clothesDetailAbsoluteUrl = `https://lolitalibrary.com${clothesDetailUrl}`
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/common/outerLink2?url=${clothesDetailAbsoluteUrl}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: clothesDetailAbsoluteUrl
        }
      }));
    } else {
      // 普通网页环境 不用新窗口
      navigateTo({
        path: `/clothes/detail/${item.clothes_id}`,
        query: buildClothesDetailQuery(),
      })
    }
	}
}

// 打开更多菜单
const openMoreMenu = (e: MouseEvent) => {
  moreMenuPosition.value = {
    x: e.clientX + 50,
    y: e.clientY
  }
  showMoreMenu.value = true
}

const {
  placements: toolbarPlacements,
  toolbarOrderRows,
  sidebarTools: sidebarToolbarTools,
  moreTools: moreToolbarTools,
  showMoreButton: showMoreToolbarButton,
  setPlacement: setToolbarPlacement,
  restorePrefs: restoreToolbarPrefs,
} = useWardrobeToolbar()

const runToolbarAction = (toolId: WardrobeToolbarToolId, e?: MouseEvent) => {
  switch (toolId) {
    case 'addWardrobe':
      showAddWardrobe(e)
      break
    case 'search':
      openWardrobeSearch()
      break
    case 'timeline':
      toggleTimelineMode()
      break
    case 'statistics':
      openWardrobeStatistics()
      break
    case 'galaxy':
      jumpToVisualization()
      break
    case 'matchingList':
      jumpToMatchingList()
      break
    case 'plan':
      jumpToPlan()
      break
  }
}

const isToolbarToolActive = (toolId: WardrobeToolbarToolId) =>
  toolId === 'timeline' && timelineMode.value

const toolbarSidebarOrbClass = (toolId: WardrobeToolbarToolId) => {
  if (isToolbarToolActive(toolId)) {
    return [
      !hasCustomBtnBg.value && 'bg-qhx-primary ring-2 ring-qhx-primary/40 ring-offset-1 ring-offset-transparent',
      !hasCustomBtnFont.value && 'text-white',
    ]
  }
  if (toolId === 'timeline') {
    return [!hasCustomBtnBg.value && 'bg-qhx-info', !hasCustomBtnFont.value && 'text-white']
  }
  return [!hasCustomBtnBg.value && 'bg-qhx-primary', !hasCustomBtnFont.value && 'text-white']
}

const toolbarSidebarOrbStyle = (toolId: WardrobeToolbarToolId) =>
  isToolbarToolActive(toolId) ? customBtnStyle.value : {}

const getToolbarPlacement = (id: WardrobeToolbarToolId) => toolbarPlacements.value[id]

// 跳转到星系可视化页面
const jumpToVisualization = () => {
  showMoreMenu.value = false
  const userId = user.user?.user_id || Number.parseInt(id)
  const visualizationUrl = `/visualization/wardrobe?user_id=${userId}`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${visualizationUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${visualizationUrl}`
        }
      }));
    } else {
      // 普通网页环境
      navigateTo(visualizationUrl)
    }
  }
}

// 跳转到搭配清单页面（我的所有搭配）
const jumpToMatchingList = () => {
  showMoreMenu.value = false
  const matchingUrl = `/matching/my`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${matchingUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${matchingUrl}`
        }
      }));
    } else {
      navigateTo(matchingUrl)
    }
  }
}

// 跳转到衣柜展馆（仅 PC 端展示入口）
const jumpToExhibition = () => {
  const ownerUserId = Number.parseInt(id, 10)
  if (!ownerUserId) return
  const query: Record<string, string> = {}
  if (currentWardrobe.value?.wardrobe_id) {
    query.wardrobe_id = String(currentWardrobe.value.wardrobe_id)
  }
  const pwd = route.query.password
  if (typeof pwd === 'string' && pwd) {
    query.password = pwd
  }
  navigateTo({ path: `/exhibition/wardrobe/${ownerUserId}`, query })
}

// 跳转到定制计划页面
const jumpToPlan = () => {
  showMoreMenu.value = false
  const planUrl = `/user/plan`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/common/outerLink?url=https://lolitalibrary.com${planUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${planUrl}`
        }
      }));
    } else {
      // 普通网页环境
      navigateTo(planUrl)
    }
  }
}
async function initWardrobePage() {
  await user.initialize()
  if (user.token && !user.user) {
    try {
      await user.fetchUserInfo()
    } catch {
      // 无法拉取用户信息时按访客流程处理
    }
  }
  if (route.query.password) {
    password.value = route.query.password as string
  }
  if (route.query.qrcode) {
    qrcode.value = route.query.qrcode as string
  }

  const initTasks: Promise<unknown>[] = [
    fetchWardrobeList(),
    loadWardrobePageOwner(),
    fetchOwnerBadges(),
  ]
  if (isPageOwner.value) {
    initTasks.push(wardrobeStore.getWardrobeConfig())
  }
  await Promise.all(initTasks)

  if (wardrobeList.value.length > 0) {
    let targetWardrobe: Wardrobe | null = null
    if (route.query.wardrobe_id) {
      const queryWardrobeId = Number.parseInt(route.query.wardrobe_id as string, 10)
      targetWardrobe = wardrobeList.value.find((item) => item.wardrobe_id === queryWardrobeId) ?? null
    }

    if (isPageOwner.value) {
      changeWardrobe(targetWardrobe || wardrobeList.value[0])
    } else if (qrcode.value) {
      // 二维码访问：列表接口已按 qrcode 过滤，直接选中指定或首个衣柜
      changeWardrobe(targetWardrobe || wardrobeList.value[0])
    } else {
      const accessibleIndex = wardrobeList.value.findIndex(
        (item) => item.is_private === 0 || item.password,
      )
      if (accessibleIndex !== -1) {
        if (targetWardrobe && targetWardrobe.is_private === 0) {
          changeWardrobe(targetWardrobe)
        } else {
          changeWardrobe(wardrobeList.value[accessibleIndex])
        }
      }
    }
  }
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleUniRefreshMessage)
  }
  matchingDraftStore.loadFromStorage()
  await Promise.all([
    import('@dcloudio/uni-webview-js')
      .then((mod) => { uni = mod })
      .catch((err) => {
        console.error('Failed to load uni-webview-js:', err)
      }),
    initWardrobePage(),
  ])
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleUniRefreshMessage)
  }
})

/* —— 虚拟滚动监听与重测（useEventListener 会在卸载时自动清理） —— */
useEventListener(scrollRootRef, 'scroll', onVirtualScroll, { passive: true })
useEventListener(() => (typeof window !== 'undefined' ? window : null), 'resize', remeasureVirtualDebounced, { passive: true })
let virtualSpacerObservedWidth = 0
useResizeObserver(virtualSpacerRef, (entries: readonly ResizeObserverEntry[]) => {
  const width = entries[0]?.contentRect.width ?? virtualSpacerRef.value?.clientWidth ?? 0
  if (width <= 0 || Math.abs(width - virtualSpacerObservedWidth) < 1) return
  virtualSpacerObservedWidth = width
  updateVirtualGridCellWidth()
  clearVirtualRowHeightCache()
  scheduleVirtualRowMeasure()
})
onMounted(() => {
  virtualColumns.value = computeVirtualColumns()
  measureVirtualViewport()
  nextTick(() => {
    updateVirtualGridCellWidth()
    scheduleVirtualRowMeasure()
  })
})
useHead({
  title: 'Lolita衣柜',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita合集,Lolita图书馆'
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    },
  ]

})
const enableDrag = () => {
  sortMode.value = true
  tryOpenSortGuide()
}

const SIDEBAR_COLLAPSED_KEY = 'wardrobe-detail-sidebar-collapsed'
const HEADER_COLLAPSED_KEY = 'wardrobe-detail-header-collapsed'
const SHOW_CLOTHES_NOTE_KEY = 'wardrobe-detail-show-clothes-note'
const SHOW_CLOTHES_PRICE_KEY = 'wardrobe-detail-show-clothes-price'
const SHOW_CLOTHES_STATUS_KEY = 'wardrobe-detail-show-clothes-status'
const SHOW_CLOTHES_FAVORITE_KEY = 'wardrobe-detail-show-clothes-favorite'

function readSidebarCollapsedPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') {
    return false
  }
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function readHeaderCollapsedPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return true
  try {
    const h = localStorage.getItem(HEADER_COLLAPSED_KEY)
    return h === null ? true : h === '1'
  } catch {
    return true
  }
}

function readShowClothesNotePref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return true
  try {
    const v = localStorage.getItem(SHOW_CLOTHES_NOTE_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function readShowClothesPricePref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return true
  try {
    const v = localStorage.getItem(SHOW_CLOTHES_PRICE_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function readShowClothesStatusPref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return true
  try {
    const v = localStorage.getItem(SHOW_CLOTHES_STATUS_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

function readShowClothesFavoritePref(): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return true
  try {
    const v = localStorage.getItem(SHOW_CLOTHES_FAVORITE_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

/** 左侧衣柜列表是否收起（localStorage 持久化） */
const sidebarCollapsed = ref(readSidebarCollapsedPref())
/** 中间衣柜详情头部是否收起（localStorage 持久化，默认收起） */
const headerCollapsed = ref(readHeaderCollapsedPref())
/** 网格卡片是否显示服饰备注（localStorage 持久化，默认显示） */
const showClothesNote = ref(readShowClothesNotePref())
/** 网格卡片是否显示服饰价格（localStorage 持久化，默认显示） */
const showClothesPrice = ref(readShowClothesPricePref())
/** 网格卡片是否显示服饰状态角标（localStorage 持久化，默认显示） */
const showClothesStatus = ref(readShowClothesStatusPref())
/** 网格卡片是否显示喜爱评级角标（localStorage 持久化，默认显示） */
const showClothesFavorite = ref(readShowClothesFavoritePref())

const shouldShowClothesStatusBadge = (item: WardrobeClothes) =>
  showClothesStatus.value && !!item.wardrobe_status?.trim()
const shouldShowClothesFavoriteBadge = (item: WardrobeClothes) =>
  showClothesFavorite.value
  && getClothesFavoriteLevel(item) > 0
  && !selectMode.value
  && !matchingMode.value
  && !editMode.value

/** 布局设置弹窗 */
const showLayoutModal = ref(false)
/** 左上角工具栏配置弹窗 */
const showToolbarConfigModal = ref(false)
/** 首屏恢复收起态时不播放宽度过渡，避免重进页面侧栏「半收半展」 */
const sidebarTransitionEnabled = ref(false)

function restoreLayoutPrefs() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const s = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (s !== null) sidebarCollapsed.value = s === '1'
    const h = localStorage.getItem(HEADER_COLLAPSED_KEY)
    if (h !== null) {
      headerCollapsed.value = h === '1'
    } else {
      headerCollapsed.value = true
      persistHeaderCollapsed(true)
    }
    const note = localStorage.getItem(SHOW_CLOTHES_NOTE_KEY)
    if (note !== null) showClothesNote.value = note === '1'
    const price = localStorage.getItem(SHOW_CLOTHES_PRICE_KEY)
    if (price !== null) showClothesPrice.value = price === '1'
    const status = localStorage.getItem(SHOW_CLOTHES_STATUS_KEY)
    if (status !== null) showClothesStatus.value = status === '1'
    const favorite = localStorage.getItem(SHOW_CLOTHES_FAVORITE_KEY)
    if (favorite !== null) showClothesFavorite.value = favorite === '1'
    const layout = localStorage.getItem(CLOTHES_LIST_LAYOUT_KEY)
    if (layout === 'grid' || layout === 'waterfall') clothesListLayout.value = layout
    restoreToolbarPrefs()
  } catch {
    /* 忽略读取失败 */
  }
}

function persistSidebarCollapsed(collapsed: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
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

function persistShowClothesNote(show: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHOW_CLOTHES_NOTE_KEY, show ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function persistShowClothesPrice(show: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHOW_CLOTHES_PRICE_KEY, show ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function persistShowClothesStatus(show: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHOW_CLOTHES_STATUS_KEY, show ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function persistShowClothesFavorite(show: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHOW_CLOTHES_FAVORITE_KEY, show ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function persistClothesListLayout(layout: ClothesListLayout) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CLOTHES_LIST_LAYOUT_KEY, layout)
  } catch {
    /* 忽略写入失败 */
  }
}

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleHeaderCollapsed = () => {
  headerCollapsed.value = !headerCollapsed.value
}

const openLayoutModal = () => {
  showLayoutModal.value = true
}

onMounted(() => {
  restoreLayoutPrefs()
  nextTick(() => {
    requestAnimationFrame(() => {
      sidebarTransitionEnabled.value = true
    })
  })
})

onActivated(() => {
  restoreLayoutPrefs()
  scheduleWaterfallLayout()
})

watch(sidebarCollapsed, persistSidebarCollapsed)
watch(headerCollapsed, persistHeaderCollapsed)
watch(showClothesNote, persistShowClothesNote)
watch(showClothesPrice, persistShowClothesPrice)
watch(showClothesStatus, persistShowClothesStatus)
watch(showClothesFavorite, persistShowClothesFavorite)
watch(clothesListLayout, persistClothesListLayout)

watch(
  () => [
    clothesListLayout.value,
    sidebarCollapsed.value,
    headerCollapsed.value,
    showClothesNote.value,
    showClothesPrice.value,
    showClothesStatus.value,
    showClothesFavorite.value,
    list.value.length,
  ] as const,
  () => {
    scheduleWaterfallLayout()
  },
)

watch(isWaterfallLayout, (enabled) => {
  if (enabled) scheduleWaterfallLayout()
})

// 列表 / 布局 / 列宽变化：清空实测缓存，估算立即按各行 max(item) 重算
watch(
  () => [
    list.value.length,
    sidebarCollapsed.value,
    headerCollapsed.value,
    showClothesNote.value,
    showClothesPrice.value,
    showClothesStatus.value,
    showClothesFavorite.value,
    clothesListLayout.value,
    virtualEnabled.value,
    virtualColumns.value,
    virtualGridCellWidth.value,
    info.value?.wardrobe_id,
  ] as const,
  () => {
    if (!virtualEnabled.value) return
    clearVirtualRowHeightCache()
    nextTick(() => {
      updateVirtualGridCellWidth()
      scheduleVirtualRowMeasure()
    })
  },
)

// 可视窗口切片变化后写入实测行高（rAF 合并，避免 ResizeObserver 反馈循环）
watch(
  () => [
    virtualRange.value.startRow,
    virtualRange.value.endRow,
    virtualVisibleRows.value.length,
  ] as const,
  () => {
    if (!virtualEnabled.value) return
    nextTick(() => {
      scheduleVirtualRowMeasure()
    })
  },
)

const toggleTimelineMode = async () => {
  const next = !timelineMode.value
  if (next) {
    sortMode.value = false
    matchingMode.value = false
    selectMode.value = false
    editMode.value = false
    selectedClothesIds.value = new Set()
  }
  timelineMode.value = next
  page.value = 1
  await fetchClothesList(1, TIMELINE_PAGE_SIZE)
}

/** 衣柜统计：App（UniApp WebView）走原生页；网页端进入 ECharts 统计页 */
const openWardrobeStatistics = () => {
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?url=https://lolitalibrary.com/wardrobe/statistics/${id}`,
      fail: () => {
        console.log('跳转衣柜统计失败')
      },
    })
    return
  }

  router.push(`/wardrobe/statistics/${id}`)
}

const exitTimelineMode = async () => {
  timelineExpandedDeckKey.value = null
  timelineMode.value = false
  page.value = 1
  await fetchClothesList(1, pageSize)
}

const TIMELINE_DECK_MAX = 3

function chunkTimelineItems<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/** 时间轴：按「日」为历史节点；同日多件按最多 3 张一组拆成多副扇形卡组 */
const timelineNodes = computed(() => {
  const sorted = sortListByAddTimeAsc(list.value)
  const map = new Map<string, WardrobeClothes[]>()
  for (const item of sorted) {
    const ms = clothesAddTimeMs(item)
    const key = ms ? dayjs(ms).format('YYYY-MM-DD') : '__unknown__'
    if (!map.has(key)) map.set(key, [])
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === '__unknown__') return 1
    if (b === '__unknown__') return -1
    return a.localeCompare(b)
  })
  return keys.map((key) => {
    const items = map.get(key) ?? []
    const dayTotal = items.reduce((s, it) => s + (Number(it.price) || 0), 0)
    let daysInCabinetText = ''
    if (key !== '__unknown__') {
      const d = dayjs().startOf('day').diff(dayjs(key).startOf('day'), 'day')
      daysInCabinetText = d <= 0 ? '今日入柜' : `已入柜 ${d} 天`
    }
    return {
      key,
      dateLabel: key === '__unknown__' ? '日期待完善' : dayjs(key).format('YY-MM-DD'),
      daysInCabinetText,
      dayTotal,
      items,
      /** 每组最多 3 张 */
      decks: chunkTimelineItems(items, TIMELINE_DECK_MAX),
    }
  })
})

/**
 * 时间轴顶部统计：总条数、总价、日均成本（仅含有效入柜时间的金额，按首末入柜日自然日跨度均摊）
 */
const timelineStats = computed(() => {
  const rows = list.value
  const count = rows.length
  let totalPrice = 0
  const dated: WardrobeClothes[] = []
  for (const r of rows) {
    totalPrice += Number(r.price) || 0
    if (clothesAddTimeMs(r) > 0) dated.push(r)
  }
  let sumDated = 0
  let minMs = Number.POSITIVE_INFINITY
  let maxMs = Number.NEGATIVE_INFINITY
  for (const r of dated) {
    sumDated += Number(r.price) || 0
    const ms = clothesAddTimeMs(r)
    if (ms < minMs) minMs = ms
    if (ms > maxMs) maxMs = ms
  }
  let daySpan = 1
  if (dated.length >= 2 && Number.isFinite(minMs) && Number.isFinite(maxMs)) {
    const a = dayjs(minMs).startOf('day')
    const b = dayjs(maxMs).startOf('day')
    daySpan = Math.max(1, b.diff(a, 'day') + 1)
  }
  const dailyAvg = dated.length === 0 ? null : sumDated / daySpan
  return {
    count,
    totalPrice,
    datedCount: dated.length,
    daySpan,
    dailyAvg,
  }
})

/**
 * 卡组：圆心为左下角（transform-origin），并叠加微量平移形成错落层次
 */
const timelineDeckCardStyle = (idx: number, total: number) => {
  const origin = 'left bottom'
  if (total <= 1) {
    return {
      zIndex: 32,
      transform: 'translate(0px, 0px) rotate(0deg)',
      transformOrigin: origin,
      transitionDelay: '0s',
    }
  }
  const stagger: [number, number][] =
    total === 2
      ? [
          [0, 0],
          [7, -8],
        ]
      : [
          [0, 0],
          [6, -7],
          [12, -14],
        ]
  const [tx, ty] = stagger[idx] ?? [0, 0]
  let deg = 0
  if (idx === 1) deg = total === 2 ? 12 : 10
  else if (idx === 2) deg = 19
  return {
    zIndex: 32 - idx,
    transform: `translate(${tx}px, ${ty}px) rotate(${deg}deg)`,
    transformOrigin: origin,
    transitionDelay: '0s',
  }
}

/**
 * 扇形展开（塔罗选牌）：自下沿左角枢轴甩开，幅度偏大、中间牌更突出
 */
const timelineDeckFanStyle = (idx: number, total: number) => {
  const origin = 'left bottom'
  const delay = `${idx * 0.05}s`
  if (total === 2) {
    const rows = [
      { z: 46, tf: 'translate(-12px, -18px) rotate(-24deg) scale(1.06)' },
      { z: 48, tf: 'translate(44px, -38px) rotate(26deg) scale(1.06)' },
    ]
    const r = rows[idx] ?? rows[0]
    return { zIndex: r.z, transform: r.tf, transformOrigin: origin, transitionDelay: delay }
  }
  const rows = [
    { z: 44, tf: 'translate(-16px, -18px) rotate(-24deg) scale(1.06)' },
    { z: 52, tf: 'translate(22px, -52px) rotate(0deg) scale(1.14)' },
    { z: 46, tf: 'translate(58px, -22px) rotate(30deg) scale(1.06)' },
  ]
  const r = rows[idx] ?? rows[0]
  return { zIndex: r.z, transform: r.tf, transformOrigin: origin, transitionDelay: delay }
}

/** 时间轴卡组扇形展开；@@ 避免与日期 key 中的下划线冲突 */
const timelineExpandedDeckKey = ref<string | null>(null)
const timelineDeckKey = (nodeKey: string, dIdx: number) => `${nodeKey}@@${dIdx}`

const isTimelineDeckExpanded = (nodeKey: string, dIdx: number) =>
  timelineExpandedDeckKey.value === timelineDeckKey(nodeKey, dIdx)

/** 该日期节点是否有卡组扇形展开：抬高整条 article，避免被后续节点/卡组盖住 */
const isTimelineNodeFanExpanded = (nodeKey: string) => {
  const k = timelineExpandedDeckKey.value
  if (!k) return false
  const i = k.indexOf('@@')
  if (i === -1) return false
  return k.slice(0, i) === nodeKey
}

const timelineDeckCardTransform = (
  nodeKey: string,
  dIdx: number,
  idx: number,
  total: number,
) => {
  if (isTimelineDeckExpanded(nodeKey, dIdx)) return timelineDeckFanStyle(idx, total)
  return timelineDeckCardStyle(idx, total)
}

const toggleTimelineDeckExpand = (nodeKey: string, dIdx: number) => {
  const k = timelineDeckKey(nodeKey, dIdx)
  timelineExpandedDeckKey.value = timelineExpandedDeckKey.value === k ? null : k
}

/** 扇形展开：用 fixed 浮层 + 占位，避免容器撑高导致整页重排卡顿 */
const timelineDeckOverlayRect = ref<{
  top: number
  left: number
  width: number
  height: number
} | null>(null)

/**
 * 相对 timeline-deck-wrap 定位（不用 fixed）：祖先含 transform（如 max-md:scale-[0.9]）时，
 * fixed 会相对该祖先解析，与 getBoundingClientRect 视口坐标不一致导致偏移；absolute + 差值与叠卡原位一致。
 * 始终用 #timeline-deck 测量（不用 spacer），避免占位与 deck 亚像素差导致二次 rect 更新、轻微抖动。
 */
function roundDeckOverlayRect(r: {
  top: number
  left: number
  width: number
  height: number
}) {
  return {
    top: Math.round(r.top),
    left: Math.round(r.left),
    width: Math.max(1, Math.round(r.width)),
    height: Math.max(1, Math.round(r.height)),
  }
}

function syncTimelineDeckFixedPosition() {
  if (typeof document === 'undefined') return
  const k = timelineExpandedDeckKey.value
  if (!k) return
  const wrap = document.getElementById(`timeline-deck-wrap-${k}`)
  const deck = document.getElementById(`timeline-deck-${k}`)
  if (!wrap || !deck) return
  const wr = wrap.getBoundingClientRect()
  const dr = deck.getBoundingClientRect()
  timelineDeckOverlayRect.value = roundDeckOverlayRect({
    top: dr.top - wr.top,
    left: dr.left - wr.left,
    width: dr.width,
    height: dr.height,
  })
}

let timelineDeckResizeTimer: ReturnType<typeof setTimeout> | null = null
function onTimelineDeckResizeDebounced() {
  if (!timelineExpandedDeckKey.value) return
  if (timelineDeckResizeTimer) clearTimeout(timelineDeckResizeTimer)
  timelineDeckResizeTimer = setTimeout(() => {
    timelineDeckResizeTimer = null
    requestAnimationFrame(() => {
      syncTimelineDeckFixedPosition()
    })
  }, 80)
}

function timelineDeckFixedStyle(nodeKey: string, dIdx: number): Record<string, string> {
  const k = timelineDeckKey(nodeKey, dIdx)
  if (timelineExpandedDeckKey.value !== k || !timelineDeckOverlayRect.value) return {}
  const r = timelineDeckOverlayRect.value
  return {
    position: 'absolute',
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: '0',
    zIndex: '500',
  }
}

watch(
  timelineExpandedDeckKey,
  async (k) => {
    if (!k) {
      timelineDeckOverlayRect.value = null
      return
    }
    await nextTick()
    // 双 rAF：等 ring / 缩放布局稳定后再量一次，避免连续两次 sync 造成 rect 跳变
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncTimelineDeckFixedPosition()
      })
    })
  },
  { flush: 'post' },
)

function onTimelineDeckEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && timelineExpandedDeckKey.value) {
    timelineExpandedDeckKey.value = null
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('keydown', onTimelineDeckEscape)
  window.addEventListener('resize', onTimelineDeckResizeDebounced, { passive: true })
})
onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onTimelineDeckEscape)
  window.removeEventListener('resize', onTimelineDeckResizeDebounced)
  if (timelineDeckResizeTimer) clearTimeout(timelineDeckResizeTimer)
})

watch(timelineMode, (on) => {
  if (!on) timelineExpandedDeckKey.value = null
})

// 搭配模式、排序、多选、编辑互斥
const toggleMatchingMode = () => {
  matchingMode.value = !matchingMode.value
  if (matchingMode.value) {
    sortMode.value = false
    selectMode.value = false
    editMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const toggleSortMode = () => {
  sortMode.value = !sortMode.value
  if (sortMode.value) {
    matchingMode.value = false
    selectMode.value = false
    editMode.value = false
    selectedClothesIds.value = new Set()
    tryOpenSortGuide()
  } else {
    showSortGuide.value = false
  }
}

function tryOpenSortGuide() {
  if (!import.meta.client || !isPageOwner.value) return
  if (timelineMode.value || hasCompletedWardrobeSortGuide()) return
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
  }
  nextTick(() => {
    requestAnimationFrame(() => {
      showSortGuide.value = true
    })
  })
}

function onSortGuideStepChange(index: number) {
  if (index === 0 && sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    nextTick(() => {
      requestAnimationFrame(() => sortGuideRef.value?.refreshLayout())
    })
    return
  }
  nextTick(() => sortGuideRef.value?.refreshLayout())
}
const toggleEditMode = () => {
  editMode.value = !editMode.value
  if (editMode.value) {
    sortMode.value = false
    matchingMode.value = false
    selectMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const openEditClothes = (item: WardrobeClothes, event?: MouseEvent) => {
  if (!addEditClothesRef.value || !item.clothes_id) return
  addEditClothesRef.value.showModel({
    ...item,
    wardrobe_name: currentWardrobe.value?.wardrobe_name ?? info.value?.wardrobe_name,
  }, false, event)
}
const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    sortMode.value = false
    matchingMode.value = false
    editMode.value = false
    selectedClothesIds.value = new Set()
  } else {
    selectedClothesIds.value = new Set()
  }
}
const toggleClothesSelection = (item: WardrobeClothes) => {
  const id = item.clothes_id
  if (id == null) return
  const next = new Set(selectedClothesIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedClothesIds.value = next
}
const isClothesSelected = (clothesId: number) => selectedClothesIds.value.has(clothesId)

// 添加服饰到搭配草稿
const addToMatchingDraft = (item: WardrobeClothes) => {
  if (matchingDraftStore.add(item)) {
    // toast.add({ title: '已加入搭配', icon: 'i-heroicons-check-circle', color: 'green' })
  } else {
    // toast.add({ title: '已在搭配中', icon: 'i-heroicons-information-circle', color: 'gray' })
  }
}

// 打开搭配新增弹窗
const openMatchingAddEdit = () => {
  showMatchingDrawer.value = false
  matchingAddEditRef.value?.showModel(matchingDraftStore.list)
}

// 搭配模式：点击加号添加、点击删除图标从缓存移除；添加时播放飞入悬浮按钮动画
// 多选模式底部栏：切换衣柜，弹出衣柜选择后调用 clothes/update/wardrobe
const onSelectModeSwitchWardrobe = () => {
  wardrobeChooseRef.value?.showModel()
}
const onWardrobeChooseForMove = async (wards: Wardrobe[]) => {
  const target = wards[0]
  if (!target?.wardrobe_id || selectedClothesIds.value.size === 0) return
  const ids = Array.from(selectedClothesIds.value)
  try {
    await changeWardrobeClothesBatch({ ids: ids.join(','), wardrobe_id: target.wardrobe_id })
    toast.add({ title: '已移动到目标衣柜', icon: 'i-heroicons-check-circle', color: 'green' })
    for (const id of ids) {
      const idx = list.value.findIndex((item) => item.clothes_id === id)
      if (idx !== -1) list.value.splice(idx, 1)
    }
    selectedClothesIds.value = new Set()
  } catch {
    toast.add({ title: '移动失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  }
}
// 多选模式底部栏：批量删除，调用 clothes/delete/ids
const onSelectModeBatchDelete = () => {
  if (selectedClothesIds.value.size === 0) return
  showBatchDeleteModal.value = true
}
const confirmBatchDelete = async () => {
  const ids = Array.from(selectedClothesIds.value)
  if (ids.length === 0) return
  try {
    await deleteClothesByIds({ ids: ids.join(',') })
    toast.add({ title: '删除成功', icon: 'i-heroicons-check-circle', color: 'green' })
    for (const id of ids) {
      const idx = list.value.findIndex((item) => item.clothes_id === id)
      if (idx !== -1) list.value.splice(idx, 1)
    }
    selectedClothesIds.value = new Set()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    showBatchDeleteModal.value = false
  }
}

const openBatchSortModal = () => {
  if (selectedClothesIds.value.size === 0) return
  if (!isCustomSortMode.value) {
    toast.add({
      title: '当前为自动排序',
      description: '请先在衣柜设置中将排序模式改为「自定义」',
      color: 'amber',
      icon: 'i-heroicons-information-circle',
    })
    return
  }
  const selectedNos = list.value
    .map((item) => (item.clothes_id != null && selectedClothesIds.value.has(item.clothes_id)
      ? getClothesDisplaySortNo(item)
      : 0))
    .filter((n) => n > 0)
  batchSortTargetNo.value = selectedNos.length > 0 ? String(Math.min(...selectedNos)) : '1'
  showBatchSortModal.value = true
}

/** 将选中项作为连续块移动到目标序号（1-based），块内保持当前相对顺序 */
function buildListWithBatchSortAtPosition(targetNo: number): WardrobeClothes[] {
  const selectedSet = selectedClothesIds.value
  const selected: WardrobeClothes[] = []
  const unselected: WardrobeClothes[] = []
  let selectedBeforeTarget = 0
  for (const item of list.value) {
    if (item.clothes_id != null && selectedSet.has(item.clothes_id)) {
      if (getClothesDisplaySortNo(item) < targetNo) selectedBeforeTarget++
      selected.push(item)
    } else {
      unselected.push(item)
    }
  }
  // 先抽出选中项后，插入下标 = 目标序号 - 1 - 目标序号之前已选中的件数
  const insertIndex = Math.min(
    Math.max(targetNo - 1 - selectedBeforeTarget, 0),
    unselected.length,
  )
  const result = [...unselected]
  result.splice(insertIndex, 0, ...selected)
  return result
}

/** 与拖拽 onDragEnd 一致：按新下标继承原位置的 sort 值后提交 */
async function applyListReorderAndSave(newList: WardrobeClothes[]): Promise<boolean> {
  const oldSnapshot = list.value.map((item, index) => ({
    clothes_id: item.clothes_id,
    sort: item.sort ?? index,
  }))
  list.value = newList
  const changed: { clothes_id: number; sort: number }[] = []
  list.value.forEach((item, newIndex) => {
    const cid = item.clothes_id
    if (cid == null) return
    const oldItem = oldSnapshot[newIndex]
    if (!oldItem || cid !== oldItem.clothes_id) {
      changed.push({
        clothes_id: cid,
        sort: oldItem?.sort ?? (item.sort ?? newIndex),
      })
    }
  })
  if (changed.length === 0 || !currentWardrobe.value?.wardrobe_id) return false
  await sortClothee({
    wardrobe_id: currentWardrobe.value.wardrobe_id,
    sort: changed.map((item) => ({
      clothes_id: item.clothes_id,
      sort: item.sort,
    })),
  })
  return true
}

function parseBatchSortTargetNo(raw: string | number | null | undefined): number {
  if (raw == null || raw === '') return Number.NaN
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : Number.NaN
  const s = String(raw).trim()
  if (!s) return Number.NaN
  return Number.parseInt(s, 10)
}

const confirmBatchSort = async () => {
  if (selectedClothesIds.value.size === 0 || !isCustomSortMode.value) return
  const max = list.value.length + 1
  const targetNo = parseBatchSortTargetNo(batchSortTargetNo.value)
  if (!Number.isFinite(targetNo) || targetNo < 1 || targetNo > max) {
    toast.add({
      title: `请输入 1～${max} 之间的序号`,
      color: 'amber',
      icon: 'i-heroicons-information-circle',
    })
    return
  }
  const newList = buildListWithBatchSortAtPosition(targetNo)
  const unchanged = list.value.every((item, i) => item.clothes_id === newList[i]?.clothes_id)
  if (unchanged) {
    toast.add({
      title: '位置未变化',
      color: 'gray',
      icon: 'i-heroicons-information-circle',
    })
    showBatchSortModal.value = false
    return
  }
  if (isSorting.value) return
  isSorting.value = true
  try {
    await applyListReorderAndSave(newList)
    toast.add({ title: '排序已更新', icon: 'i-heroicons-check-circle', color: 'green' })
    showBatchSortModal.value = false
  } catch (error) {
    console.error('批量排序失败:', error)
    toast.add({ title: '排序更新失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    await reload()
  } finally {
    isSorting.value = false
  }
}

const showShareModal = ref(false)
const shareImageType = ref<'long' | 'favorite'>('long')

function openShareModal(type: 'long' | 'favorite' = 'long') {
  if (!currentWardrobe.value?.wardrobe_id || !info.value) {
    toast.add({ title: '请先选择衣柜', color: 'amber', icon: 'i-heroicons-information-circle' })
    return
  }
  shareImageType.value = type
  showShareModal.value = true
}

const handleMatchingDraftToggle = (item: WardrobeClothes, e?: MouseEvent) => {
  const id = item.clothes_id
  if (id == null) return
  if (matchingDraftStore.hasClothes(id)) {
    matchingDraftStore.remove(id)
    // toast.add({ title: '已移除', icon: 'i-heroicons-check-circle', color: 'gray' })
  } else {
    const sourceEl = e?.currentTarget as HTMLElement | null
    const sourceRect = sourceEl?.parentElement?.getBoundingClientRect()
    const imgSrc = item.clothes_img ? `${BASE_IMG}${item.clothes_img}` : ''
    addToMatchingDraft(item)
    if (sourceRect && imgSrc) {
      nextTick(() => {
        flyToTarget(sourceRect, imgSrc, matchingBtnRef)
      })
    }
  }
}
</script>
<template>

  <div
    class="wardrobe-wrap wardrobe-page-neu text-qhx-text relative"
    :class="{ 'wardrobe-perf-lite': preferLiteEffects }"
    :style="pageContentStyle"
  >
    <div
      v-if="customStyle"
      class="pointer-events-none fixed inset-0 z-0"
      :style="pageBackgroundStyle"
      aria-hidden="true"
    />
    <div v-if="isSorting || isWardrobeSorting" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">正在保存排序……</span>
    </div>
    <div v-if="isLoading && page === 1" class="absolute inset-0 bg-white/50 flex z-10 items-center justify-center">
      <span class="text-gray-600">加载中……</span>
    </div>
    <!-- 弹幕组件：仅当开放弹幕时显示（时间轴空白模式下隐藏） -->
    <div
      v-if="isDanmakuEnabled && currentWardrobe?.wardrobe_id && !timelineMode"
      class="fixed inset-0 w-full h-full pointer-events-none z-40"
    >
      <CommentDanmakuComment
        :key="currentWardrobe.wardrobe_id"
        type="wardrobe"
        :id="currentWardrobe.wardrobe_id"
        width="100%"
        height="100%"
        :pageSize="50"
        :can-delete-all="isWardrobeOwner"
        class="pointer-events-none"
      />
    </div>
    <ClothesAdd ref="addEditClothesRef" @success="onClothesAddSuccess" />
    <ClothesBatchAddEntry ref="clothesBatchAddEntryRef" @success="reloadWardrobe" />
    <WardrobeAddEdit ref="addEditWardrobeRef" @success="onWardrobeEditSuccess" />
    <AchievementDecoConfigModal
      v-if="isWardrobeOwner && currentWardrobe?.wardrobe_id"
      v-model="wardrobeDecoModalOpen"
      :trigger-position="wardrobeDecoModalPosition"
      :initial-selected-ids="wardrobeDecoInitialSelectedIds"
      :wardrobe-id="currentWardrobe.wardrobe_id"
      @saved="onWardrobeDecoSaved"
    />
    <MatchingAddEdit ref="matchingAddEditRef" @success="matchingDraftStore.clear" />
    <QhxModal v-model="showShareModal">
      <div
        class="flex max-h-[90vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl bg-[#ebe3e8] shadow-2xl dark:bg-[#241d26]"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-pink-200/40 px-4 py-3 dark:border-pink-900/35"
        >
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">衣柜分享图</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showShareModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="shrink-0 border-b border-pink-200/30 px-3 py-2 dark:border-pink-900/30 sm:px-4">
          <div class="flex gap-2 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
            <button
              type="button"
              class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
              :class="shareImageType === 'long'
                ? 'bg-white text-[#5e3a4b] shadow-sm dark:bg-[#3d2f38] dark:text-pink-50'
                : 'text-[#8a6f7d] hover:text-[#5e3a4b] dark:text-pink-300/75 dark:hover:text-pink-50'"
              @click="shareImageType = 'long'"
            >
              长图
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
              :class="shareImageType === 'favorite'
                ? 'bg-white text-[#5e3a4b] shadow-sm dark:bg-[#3d2f38] dark:text-pink-50'
                : 'text-[#8a6f7d] hover:text-[#5e3a4b] dark:text-pink-300/75 dark:hover:text-pink-50'"
              @click="shareImageType = 'favorite'"
            >
              评级分享图
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <WardrobeClothesLongShare
            v-if="shareImageType === 'long' && currentWardrobe?.wardrobe_id && info"
            :wardrobe-id="currentWardrobe.wardrobe_id"
            :info="info"
            :filter-list="filter_list"
            :password="password"
            :timeline-mode="timelineMode"
          />
          <WardrobeClothesFavoriteShare
            v-else-if="shareImageType === 'favorite' && currentWardrobe?.wardrobe_id && info"
            :wardrobe-id="currentWardrobe.wardrobe_id"
            :info="info"
            :filter-list="filter_list"
            :password="password"
            :timeline-mode="timelineMode"
            :owner-user-id="ownerUserId"
            :user-name="wardrobeShareUserName"
            :user-face="wardrobeShareUserFace"
          />
        </div>
      </div>
    </QhxModal>

    <QhxModal @close="password = ''" v-model="showPassword" :trigger-position="clickPosition">
      <div class="p-6 w-[400px] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
        <UInput v-model="password" :placeholder="'请输入密码'" class="flex-1 focus:ring-0" :ui="{
          base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
          rounded: 'rounded-[10px]',
          padding: { xs: 'px-4 py-2' },
          color: {
            white: {
              outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
            }
          }
        }" />
        <UButton v-if="record && record.wardrobe_id" type="submit" block
          :class="[
            'mt-6',
            !customStyle?.btnColor && 'bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover',
            customStyle?.btnColor && 'hover:opacity-90',
          ]"
          :style="customBtnStyle"
          @click="checkPassword(record.wardrobe_id)">
          确定
        </UButton>
      </div>
    </QhxModal>
    <WardrobeSimilarRecommend
      ref="wardrobeSimilarRecommendRef"
      :wardrobe-id="currentWardrobe?.wardrobe_id"
    />
    <QrcodeList ref="qrcodeListRef" />
    <QhxModal v-model="showDeleteModal">
      <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">操作确认</h3>
        <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除这个衣柜吗？删除后将无法恢复。</p>
        <div class="flex justify-end gap-2">
          <UButton
            color="gray"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="showDeleteModal = false"
          >
            取消
          </UButton>
          <UButton
            color="red"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="confirmDeleteWardrobe"
          >
            确定删除
          </UButton>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showBatchDeleteModal">
      <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">批量删除确认</h3>
        <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除选中的 {{ selectedClothesIds.size }} 件服饰吗？删除后将无法恢复。</p>
        <div class="flex justify-end gap-2">
          <UButton
            color="gray"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="showBatchDeleteModal = false"
          >
            取消
          </UButton>
          <UButton
            color="red"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="confirmBatchDelete"
          >
            确定删除
          </UButton>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showBatchStatusModal">
      <div class="p-6 w-[min(94vw,420px)] max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">批量修改拥有状态</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          已选 {{ selectedClothesIds.size }} 件服饰，请选择要统一设置的拥有状态。
        </p>
        <UFormGroup label="拥有状态">
          <div v-if="batchMultipleFormWardrobeStatus">
            <QhxTag>
              <div class="flex">
                <QhxJellyButton
                  class="cursor-pointer flex items-center mr-[5px] text-white rounded-[50%] w-[18px] h-[18px] justify-center bg-qhx-primary"
                  @click="batchMultipleFormWardrobeStatus = null"
                >
                  <UIcon name="ant-design:close-outlined" class="text-[14px] text-[#ffffff]" />
                </QhxJellyButton>
                <div>{{ batchMultipleFormWardrobeStatus }}</div>
              </div>
            </QhxTag>
          </div>
          <UButton
            type="button"
            size="xs"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
            @click="(e: MouseEvent) => openBatchStatusPicker(e)"
          >
            选择状态
          </UButton>
          <QhxSelect
            ref="batchStatusSelectRef"
            :options="batchWardrobeStatusOptions"
            :default-value="batchWardrobeStatusOptions[0]"
            :canCustomize="true"
            @select="onBatchWardrobeStatusSelect"
          />
        </UFormGroup>
        <div class="flex justify-end gap-2 mt-6">
          <UButton
            color="gray"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="showBatchStatusModal = false"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="confirmBatchStatus"
          >
            确定
          </UButton>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showBatchSortModal">
      <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-2 text-gray-800 dark:text-gray-200">批量排序</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          已选 {{ selectedClothesIds.size }} 件，将作为整体移动到封面所示序号。
        </p>
        <UFormGroup label="移动到序号">
          <UInput
            v-model="batchSortTargetNo"
            type="number"
            inputmode="numeric"
            placeholder="请输入 1～列表总数"
            class="w-full"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary',
                },
              },
            }"
            @keyup.enter="confirmBatchSort"
          />
        </UFormGroup>
        <div class="flex justify-end gap-2 mt-6">
          <UButton
            color="gray"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="showBatchSortModal = false"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="confirmBatchSort"
          >
            确定
          </UButton>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="planCompleteModal">
      <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">操作确认</h3>
        <p class="text-gray-700 dark:text-gray-300 mb-4">确定要完成该计划吗？</p>
        <div class="flex justify-end gap-2">
          <UButton
            color="gray"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="planCompleteModal = false"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            :loading="planCompleteLoading"
            @click="handlePlanTimelineComplete"
          >
            确认完成
          </UButton>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showWardrobeHomeUpdateModal">
      <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-3 text-gray-800 dark:text-gray-200">设为首页</h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
          设置首页需要最新 1.6.5 版本 App，请复制下方链接到浏览器中打开并更新。
        </p>
        <p class="text-xs break-all rounded-lg bg-gray-50 dark:bg-gray-900/60 px-3 py-2 text-gray-600 dark:text-gray-400 mb-4">
          https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="showWardrobeHomeUpdateModal = false">知道了</UButton>
          <!-- <UButton
            color="primary"
            @click="async () => {
              await navigator.clipboard.writeText('https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita')
              toast.add({ title: '链接已复制', icon: 'i-heroicons-check-circle', color: 'green' })
            }"
          >
            复制链接
          </UButton> -->
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showMoreMenu" :trigger-position="moreMenuPosition">
      <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">更多选项</h3>

        <button
          v-for="(tool, index) in moreToolbarTools"
          :key="tool.id"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
          :class="index > 0 && 'mt-2'"
          @click="runToolbarAction(tool.id)"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
            :class="[
              !hasCustomBtnBg && tool.moreIconBgClass && `bg-gradient-to-br ${tool.moreIconBgClass}`,
              !hasCustomBtnBg && !tool.moreIconBgClass && 'bg-qhx-primary',
            ]"
            :style="customBtnStyle"
          >
            <UIcon :name="tool.icon" class="text-base" :class="!hasCustomBtnFont && 'text-white'" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ tool.label }}</div>
            <div v-if="tool.moreDescription" class="text-xs text-gray-500 dark:text-gray-400">{{ tool.moreDescription }}</div>
          </div>
        </button>
      </div>
    </QhxModal>
    <QhxModal v-model="showLayoutModal">
      <div class="p-5 w-[min(94vw,360px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">布局设置</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
          偏好将自动保存；侧栏、详情收起按钮仍可独立操作
        </p>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">收起衣柜详情</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">隐藏顶部衣柜详情信息区</div>
            </div>
            <UToggle v-model="headerCollapsed" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">收起左侧列表</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">隐藏左侧衣柜切换栏</div>
            </div>
            <UToggle v-model="sidebarCollapsed" />
          </div>
          <div class="h-px bg-gray-200 dark:bg-gray-700" />
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">左上角工具栏</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">自定义侧栏与「更多」菜单显示项</div>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-qhx-primary hover:text-qhx-primary dark:border-gray-600 dark:text-gray-300 dark:hover:border-qhx-primary"
              @click="showToolbarConfigModal = true"
            >
              配置
            </button>
          </div>
          <div class="h-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">服饰列表布局</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">网格等宽排列，瀑布流按图片高度错落展示</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-colors"
                :class="clothesListLayout === 'grid'
                  ? 'border-qhx-primary bg-qhx-primary/10 text-qhx-primary'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'"
                @click="clothesListLayout = 'grid'"
              >
                <UIcon name="i-heroicons-squares-2x2" class="text-xl" />
                <span class="text-xs font-medium">网格</span>
              </button>
              <button
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-colors"
                :class="clothesListLayout === 'waterfall'
                  ? 'border-qhx-primary bg-qhx-primary/10 text-qhx-primary'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'"
                @click="clothesListLayout = 'waterfall'"
              >
                <UIcon name="i-heroicons-view-columns" class="text-xl" />
                <span class="text-xs font-medium">瀑布流</span>
              </button>
            </div>
          </div>
          <div class="h-px bg-gray-200 dark:bg-gray-700" />
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">显示服饰备注</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">网格卡片下方展示服饰备注</div>
            </div>
            <UToggle v-model="showClothesNote" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">显示服饰价格</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">网格卡片下方展示单价</div>
            </div>
            <UToggle v-model="showClothesPrice" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">显示服饰状态</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">网格卡片左上角展示拥有状态</div>
            </div>
            <UToggle v-model="showClothesStatus" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">显示喜爱评级</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">网格卡片展示数字 + 星评级</div>
            </div>
            <UToggle v-model="showClothesFavorite" />
          </div>
        </div>
      </div>
    </QhxModal>
    <QhxModal v-model="showToolbarConfigModal">
      <div class="p-5 w-[min(94vw,360px)] max-h-[min(80dvh,560px)] flex flex-col bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">工具栏配置</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 shrink-0">
          长按拖动调整顺序；选择显示在侧栏或收入「更多」；偏好自动保存
        </p>
        <div class="mt-3 overflow-y-auto overscroll-contain min-h-0 flex-1 -mx-1 px-1">
          <ClientOnly>
            <Draggable
              v-model="toolbarOrderRows"
              item-key="id"
              handle=".toolbar-config-drag-handle"
              class="space-y-2"
              :force-fallback="true"
              :delay="150"
              :animation="250"
              ghost-class="toolbar-config-ghost"
              chosen-class="toolbar-config-chosen"
              drag-class="toolbar-config-dragging"
            >
              <template #item="{ element }">
                <div
                  v-if="getWardrobeToolbarTool(element.id)"
                  class="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-2"
                >
                  <button
                    type="button"
                    class="toolbar-config-drag-handle flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-gray-400 active:cursor-grabbing hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="拖动排序"
                  >
                    <UIcon name="i-heroicons-bars-3-20-solid" class="text-base" />
                  </button>
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      :class="!hasCustomBtnBg && 'bg-qhx-primary/15 text-qhx-primary'"
                      :style="hasCustomBtnBg ? customBtnStyle : undefined"
                    >
                      <UIcon :name="getWardrobeToolbarTool(element.id)!.icon" class="text-sm" />
                    </div>
                    <span class="truncate text-sm text-gray-800 dark:text-gray-200">
                      {{ getWardrobeToolbarTool(element.id)!.label }}
                    </span>
                  </div>
                  <div
                    v-if="!getWardrobeToolbarTool(element.id)!.placementLocked"
                    class="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700/80"
                  >
                    <button
                      type="button"
                      class="rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                      :class="getToolbarPlacement(element.id) === 'sidebar'
                        ? 'bg-white text-qhx-primary shadow-sm dark:bg-gray-600 dark:text-qhx-primary'
                        : 'text-gray-500 dark:text-gray-400'"
                      @click="setToolbarPlacement(element.id, 'sidebar')"
                    >
                      侧栏
                    </button>
                    <button
                      type="button"
                      class="rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                      :class="getToolbarPlacement(element.id) === 'more'
                        ? 'bg-white text-qhx-primary shadow-sm dark:bg-gray-600 dark:text-qhx-primary'
                        : 'text-gray-500 dark:text-gray-400'"
                      @click="setToolbarPlacement(element.id, 'more')"
                    >
                      更多
                    </button>
                  </div>
                  <span
                    v-else
                    class="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  >
                    固定侧栏
                  </span>
                </div>
              </template>
            </Draggable>
            <template #fallback>
              <div class="py-8 text-center text-xs text-gray-500 dark:text-gray-400">加载排序组件中…</div>
            </template>
          </ClientOnly>
        </div>
        <div class="mt-4 shrink-0 flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-qhx-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            @click="showToolbarConfigModal = false"
          >
            完成
          </button>
        </div>
      </div>
    </QhxModal>

    <Transition
      enter-active-class="transition duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      enter-from-class="opacity-0 -translate-x-3"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-3"
    >
      <button
        v-if="timelineMode && user.user?.user_id === Number.parseInt(id)"
        type="button"
        class="fixed left-3 z-[55] flex items-center gap-1.5 rounded-full px-3 py-2 text-sm shadow-lg backdrop-blur-md"
        :class="[
          !customStyle?.btnColor && 'bg-black/55 hover:bg-black/65 dark:bg-white/20 dark:hover:bg-white/30',
          !customStyle?.btnFontColor && 'text-white',
        ]"
        :style="{
          top: `${(configStore.statusBarHeight || 0) + 10}px`,
          ...customBtnStyle,
        }"
        @click="exitTimelineMode"
      >
        <UIcon name="material-symbols:close" class="text-[18px]" />
        退出时间轴
      </button>
    </Transition>

    <div class="relative w-full min-h-[100dvh]">
      <div
        class="grid w-full transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
        :style="{ gridTemplateRows: timelineMode ? '0fr' : '1fr' }"
      >
        <div class="min-h-0 overflow-visible">
    <div class="rounded-2xl flex relative overflow-visible">
      <div
        class="wardrobe-sidebar-wrap flex-shrink-0 relative"
        :class="[
          sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden' : 'w-[180px] max-md:w-[20vw]',
          sidebarTransitionEnabled && 'transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]',
        ]"
      >
        <div
          v-show="!sidebarCollapsed"
          id="wardrobe-guide-sidebar-list"
          class="wardrobe-list wardrobe-neu-sidebar wardrobe-list-height w-full overflow-y-auto"
        >
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        
        <div v-if="user.user?.user_id === Number.parseInt(id)" class="flex flex-col items-center py-2 gap-1.5">
          <QhxJellyButton v-for="tool in sidebarToolbarTools" :key="tool.id">
            <div
              class="h-[46px] text-center px-0.5 cursor-pointer"
              @click="runToolbarAction(tool.id, $event)"
            >
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center transition-colors duration-300"
                :class="toolbarSidebarOrbClass(tool.id)"
                :style="toolbarSidebarOrbStyle(tool.id)"
              >
                <UIcon :name="tool.icon" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">{{ tool.label }}</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton v-if="showMoreToolbarButton">
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="openMoreMenu($event)">
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                :style="customBtnStyle"
              >
                <UIcon name="material-symbols:more-horiz" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">更多</div>
            </div>
          </QhxJellyButton>
        </div>
        <QhxSortableList :disabled="!sortMode" v-model="wardrobeList" item-key="wardrobe_id" :animation="250" :delay="150"
          @end="onWardrobeDragEnd">
          <template #item="{ element }">
            <div>
              <div class="relative group-item">
                <div
                  @click="onWardrobeListItemClick(element)"
                  class="group w-[90%] mx-auto flex flex-col items-center transition-transform duration-300 ease-out rounded-[10px] cursor-pointer"
                  :class="[
                    currentWardrobe?.wardrobe_id === element.wardrobe_id && !customStyle?.btnColor ? 'bg-qhx-primary' : '',
                    currentWardrobe?.wardrobe_id === element.wardrobe_id && !customStyle?.btnFontColor ? 'text-qhx-inverted' : '',
                  ]"
                  :style="currentWardrobe?.wardrobe_id === element.wardrobe_id ? customBtnStyle : {}"
                >
                  <!-- <img :src="`https://lolitalibrary.com/ali/${element.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="element.wardrobe_name"
                    draggable="false"
                    class="object-cover w-[120px] h-[120px] max-md:w-[50px] max-md:h-[50px] rounded-xl border border-gray-200 shadow-md bg-white cursor-grab active:cursor-grabbing"
                    loading="lazy" /> -->
                  <div class="flex flex-col items-center w-full">
                    <div
                      class="wardrobe-name text-sm font-medium text-center w-[full] max-md:w-[auto] py-4"
                      :class="currentWardrobe?.wardrobe_id === element.wardrobe_id ? '!pb-1' : ''"
                      :data-wardrobe-id="element.wardrobe_id"
                    >
                      {{ element.wardrobe_name }}
                    </div>
                    <span
                      v-if="currentWardrobe?.wardrobe_id === element.wardrobe_id"
                      class="plan-timeline-hint mb-3 text-[11px] font-medium tracking-wide opacity-90 hover:opacity-100 transition-opacity underline-offset-2 hover:underline select-none"
                      aria-hidden="true"
                    >
                      点我
                    </span>
                  </div>
                </div>
                <!-- 编辑按钮（仅对当前用户显示） -->
                <!-- <div v-if="user.user?.user_id === Number.parseInt(id)" 
                  class="absolute top-2 right-2 opacity-0 group-item:hover:opacity-100 transition-opacity">
                  <UButton 
                    icon="i-heroicons-pencil-square" 
                    size="xs" 
                    color="gray" 
                    variant="solid"
                    @click.stop="showEditWardrobe(element)"
                    class="bg-white/90 hover:bg-white shadow-md"
                  />
                </div> -->
              </div>
            </div>
          </template>
        </QhxSortableList>
        </div>
      </div>
      <button
        v-if="!timelineMode"
        type="button"
        class="wardrobe-sidebar-toggle-hit fixed top-1/2 -translate-y-1/2 z-30"
        :class="[
          sidebarCollapsed ? 'is-collapsed' : 'is-expanded',
          !sidebarTransitionEnabled && 'is-no-transition',
        ]"
        :title="sidebarCollapsed ? '展开衣柜列表' : '收起衣柜列表'"
        :aria-label="sidebarCollapsed ? '展开衣柜列表' : '收起衣柜列表'"
        @click="toggleSidebarCollapsed"
      >
        <span class="wardrobe-collapse-toggle wardrobe-collapse-toggle--float-left pointer-events-none">
          <UIcon
            :name="sidebarCollapsed ? 'material-symbols:chevron-right' : 'material-symbols:chevron-left'"
            class="text-[14px]"
          />
        </span>
      </button>
      <div ref="scrollRootRef" class="flex-1 content-area-height overflow-y-auto overflow-x-hidden">
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        <div
          v-if="info"
          class="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
          :class="headerCollapsed ? 'mb-0' : 'mb-1'"
          :style="{ gridTemplateRows: headerCollapsed ? '0fr' : '1fr' }"
        >
        <div class="relative w-full rounded-2xl overflow-hidden min-h-0">
          <!-- 半透明遮罩层 -->
          <!-- :style="currentWardrobe?.wardrobe_cover? { backgroundImage: `url(${BASE_IMG + currentWardrobe?.wardrobe_cover})`} : {}" -->
          <div class="absolute inset-0 bg-cover bg-center"></div>
          <div class="relative z-10 p-6 text-left space-y-4 max-md:p-2 mt-2">
            <div class="flex flex-col gap-2">
              <!-- 功能按钮 -->
              <div class="flex items-center justify-end gap-1 flex-wrap">
                <QhxJellyButton v-if="!isMobile">
                  <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="jumpToExhibition">
                    <div
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-gradient-to-br from-amber-700 to-amber-900', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="material-symbols:museum-outline" class="text-[16px]" />
                    </div>
                    <div class="text-xs whitespace-nowrap">展馆</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isInUniAppShell">
                  <div class="h-[46px] text-center px-0.5">
                    <div class="flex items-center justify-center m-[3px] min-h-[24px]">
                      <UToggle
                        v-model="wardrobeAsHomeToggle"
                        color="primary"
                        :disabled="savingWardrobeHome"
                        @update:model-value="handleWardrobeAsHomeChange"
                      />
                    </div>
                    <div class="text-xs whitespace-nowrap">设为首页</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton>
                  <div class="h-[46px] text-center px-0.5 cursor-pointer">
                    <div
                      @click="wardrobeSimilarRecommendRef?.open()"
                      class="wardrobe-neu-tool-orb mx-auto al m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="i-heroicons-sparkles" class="text-[16px]" />
                    </div>
                    <div class="text-xs">根据衣柜推荐</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5 cursor-pointer">
                    <div
                      @click="openWardrobeDecoConfig"
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="i-heroicons-cog-6-tooth" class="text-[16px]" />
                    </div>
                    <div class="text-xs">徽章</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5 cursor-pointer">
                    <div
                      @click="showQRCodeList()"
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="material-symbols:qr-code-2" class="text-[16px]" />
                    </div>
                    <div class="text-xs">二维码</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton>
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="copyUrl()"
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="ic:round-share" class="text-[16px]" />
                    </div>
                    <div class="text-xs">分享</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="showEditWardrobe(info, $event)"
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                    </div>
                    <div class="text-xs">编辑</div>
                  </div>
                </QhxJellyButton>
                <QhxJellyButton v-if="isWardrobeOwner">
                  <div class="h-[46px] text-center px-0.5  cursor-pointer">
                    <div
                      @click="showDeleteModal = true"
                      class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                      :class="[!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white']"
                      :style="customBtnStyle"
                    >
                      <UIcon name="i-heroicons-trash" class="text-[16px]" />
                    </div>
                    <div class="text-xs">删除</div>
                  </div>
                </QhxJellyButton>
              </div>
              <!-- 衣柜标题 -->
              <h2 class="text-xl font-bold">
                {{ info.wardrobe_name }}
              </h2>
            </div>
            <p class="text-sm">
              {{ info.wardrobe_desc }}
            </p>
            <p class="text-sm">
              衣柜收纳: {{ info.total_count || 0 }} 条
            </p>
            <p class="text-sm flex items-center">
              <span>衣柜总价: ￥ </span>
              <span>{{ info.show_price !== 1 ? '***' : (info.total_price || 0) }}</span>
              <span v-if="isWardrobeOwner" class="flex items-center ml-2 cursor-pointer" @click="showChoosePrice">
                <QhxJellyButton v-if="isWardrobeOwner" @click="showChoosePrice">
                  <div
                    class="wardrobe-neu-tool-orb cursor-pointer m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                    :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                    :style="customBtnStyle"
                  >
                    <UIcon name="i-heroicons-cog-6-tooth" class="text-[16px]" />
                  </div>
                </QhxJellyButton>
                <span class="text-xs ml-1 text-qhx-text">
                  {{ info.show_price === 0 ? '隐藏总价' : info.show_price === 2 ? '隐藏所有' : '' }}
                </span>
              </span>
            </p>
            <p v-if="hasConfigAllWardrobesTotalPrice" class="text-sm flex items-center">
              <span>全衣柜总价: ￥ </span>
              <span>{{ info.show_price !== 1 ? '***' : (wardrobeStore.config?.total_price || '0.00') }}</span>
            </p>
            <p class="text-sm">
              穿着次数: {{ info.total_times }}
            </p>
            <p class="text-sm">
              共有 {{ info.total_community || 0 }} 条与小裙子间美好的回忆(*^▽^*)
            </p>
            
            <!-- 是否私密（仅拥有者可见） -->
            <div v-if="isWardrobeOwner" class="flex items-center justify-between text-sm">
              <span class="text-qhx-text">是否私密:</span>
              <div class="flex items-center">
                <UToggle 
                  :model-value="(info.is_private ?? 0) === 1" 
                  @update:model-value="(val: boolean) => updateWardrobeSetting('is_private', val ? 1 : 0)"
                  :loading="loadingController.is_private"
                  :disabled="loadingController.is_private"
                />
                <span class="text-xs ml-2 text-qhx-text">
                  {{ (info.is_private ?? 0) === 1 ? '私密' : '开放' }}
                </span>
              </div>
            </div>
            
            <!-- 排序模式（仅拥有者可见） -->
            <p class="text-sm flex items-center">
              <span>排序模式: {{ formatSortType(info.sort_type) }}</span>
              <QhxJellyButton v-if="isWardrobeOwner" @click="showChooseSort">
                <div
                  class="wardrobe-neu-tool-orb cursor-pointer m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                  :style="customBtnStyle"
                >
                  <UIcon name="i-heroicons-arrows-up-down" class="text-[16px]" />
                </div>
              </QhxJellyButton>
            </p>
            
            <!-- 隐藏的选择器组件 -->
            <QhxSelect 
              v-if="isWardrobeOwner && info"
              ref="priceSelectRef"
              :options="priceTypeOptions"
              :default-value="priceTypeOptions.find(opt => opt.value === (info?.show_price ?? 1)) || priceTypeOptions[0]"
              @select="onPriceTypeChange"
            />
            <QhxSelect 
              v-if="isWardrobeOwner && info"
              ref="sortSelectRef"
              :options="sortTypeOptions"
              :default-value="sortTypeOptions.find(opt => opt.value === (info?.sort_type ?? 0)) || sortTypeOptions[0]"
              @select="onSortTypeChange"
            />

            <div class="flex items-center space-x-3">
              <div>
                <p class="text-xs">创建于 {{ dayjs(info.create_date).format('YYYY-MM-DD') }}</p>
              </div>
            </div>
          </div>
        </div>
        </div>
        <div v-if="info && !timelineMode" class="flex justify-center items-center gap-2 mb-3 relative z-10">
          <button
            type="button"
            class="wardrobe-collapse-toggle"
            :title="headerCollapsed ? '展开衣柜详情' : '收起衣柜详情'"
            :aria-label="headerCollapsed ? '展开衣柜详情' : '收起衣柜详情'"
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
            title="根据衣柜推荐"
            aria-label="根据衣柜推荐"
            @click="wardrobeSimilarRecommendRef?.open()"
          >
            <UIcon name="i-heroicons-sparkles" class="text-[16px]" />
          </button>
          <button
            v-if="headerCollapsed"
            type="button"
            class="wardrobe-collapse-toggle"
            title="分享"
            aria-label="分享"
            @click="copyUrl()"
          >
            <UIcon name="ic:round-share" class="text-[16px]" />
          </button>
          <button
            type="button"
            class="wardrobe-collapse-toggle"
            title="布局设置"
            aria-label="布局设置"
            @click="openLayoutModal"
          >
            <UIcon name="material-symbols:dashboard-customize-outline" class="text-[16px]" />
          </button>
        </div>
        <div
          class="flex justify-between items-center sticky z-10 gap-1.5"
          :style="{ top: `${(configStore.statusBarHeight || 0) + 10}px` }"
          v-if="user.user?.user_id === Number.parseInt(id)"
        >
          <div class="flex flex-wrap gap-1">
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showAddClothes()">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                  :style="customBtnStyle"
                >
                  <UIcon name="material-symbols:add-2" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">添加</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div
                class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer"
                @click="showBatchAddClothes($event)"
              >
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                  :style="customBtnStyle"
                >
                  <UIcon name="i-heroicons-squares-plus" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">批量添加</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleSortMode">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="sortMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                  :style="sortMode ? customBtnStyle : {}"
                >
                  <UIcon name="icon-park-outline:sort-two" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">排序</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleEditMode">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="editMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                  :style="editMode ? customBtnStyle : {}"
                >
                  <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">编辑模式</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleMatchingMode">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="matchingMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                  :style="matchingMode ? customBtnStyle : {}"
                >
                  <UIcon name="material-symbols:add-shopping-cart-rounded" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">搭配模式</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleSelectMode">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="selectMode ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                  :style="selectMode ? customBtnStyle : {}"
                >
                  <UIcon name="material-symbols:checklist" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">多选</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="openShareModal('long')">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                >
                  <UIcon name="i-heroicons-photo-20-solid" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">分享图</div>
              </div>
            </QhxJellyButton>
          </div>
          <div class="flex flex-wrap gap-1">
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="openLayoutModal">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                >
                  <UIcon name="material-symbols:dashboard-customize-outline" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">布局</div>
              </div>
            </QhxJellyButton>
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="showFilterDrawer = true">
                <div
                  class="wardrobe-neu-tool-orb relative m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="hasActiveFilter ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                  :style="hasActiveFilter ? customBtnStyle : {}"
                >
                  <UIcon name="material-symbols:filter-list" class="text-[16px]" />
                  <span
                    v-if="filterCount > 0"
                    class="wardrobe-neu-tool-badge absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-bold rounded-full"
                    :class="[!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white']"
                    :style="customBtnStyle"
                  >
                    {{ filterCount > 99 ? '99+' : filterCount }}
                  </span>
                </div>
                <div class="text-xs text-qhx-text">筛选</div>
              </div>
            </QhxJellyButton>
          </div>
        </div>
        <div class="flex flex-wrap gap-2" v-if="tagList && tagList.length > 0">
          
          <QhxJellyButton  v-for="(tags, index) in tagList">
            <QhxTag @click="chooseTags(tags)" :active="filter_list.tags.findIndex((child) => { return child === tags}) !== -1" class=" cursor-pointer" :key="index">
              {{ tags }}
            </QhxTag>
          </QhxJellyButton>
        </div>
        <!-- 服饰卡片：网格/排序用原版；瀑布流用独立卡片样式 -->
        <DefineClothesCard v-slot="{ element }">
          <!-- 网格 / 排序（原版） -->
          <div
            v-if="!isWaterfallLayout"
            class="group drag-handle flex flex-col items-center py-[10px] px-[15px] max-md:px-[5px]"
            :class="preferLiteEffects ? '' : 'transition-transform duration-300 ease-out hover:scale-105'"
            @mousedown="opearClothesId = element.clothes_id"
            @touchstart.passive="opearClothesId = element.clothes_id"
            @click="selectMode ? toggleClothesSelection(element) : jumpToClothes(element)"
          >
            <div class="wardrobe-neu-item wardrobe-aspect-square w-full relative">
              <div
                v-if="shouldShowClothesStatusBadge(element) || shouldShowClothesFavoriteBadge(element)"
                class="wardrobe-clothes-badge-stack pointer-events-none absolute z-10 max-md:left-1 max-md:top-1 max-md:flex max-md:max-w-[calc(100%-2.25rem)] max-md:flex-col max-md:items-start max-md:gap-0.5 md:contents"
              >
                <div
                  v-if="shouldShowClothesStatusBadge(element)"
                  class="wardrobe-clothes-status-badge pointer-events-auto max-md:max-w-full max-md:truncate md:absolute md:left-1 md:top-1 md:max-w-[calc(100%-0.5rem)]"
                  :class="getWardrobeStatusBadgeClass(element.wardrobe_status)"
                >
                  {{ element.wardrobe_status }}
                </div>
                <div
                  v-if="shouldShowClothesFavoriteBadge(element)"
                  class="wardrobe-clothes-fav-badge pointer-events-auto flex max-w-full items-center gap-0.5 max-md:flex-wrap md:absolute md:right-1 md:top-1"
                  :title="getClothesFavoriteLevelTitle(element)"
                  @click.stop="jumpToClothes(element)"
                >
                  <span class="wardrobe-clothes-fav-badge__num">{{ getClothesFavoriteLevel(element) }}</span>
                  <UIcon
                    name="i-heroicons-star-solid"
                    class="wardrobe-clothes-fav-badge__star"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div
                v-if="selectMode && element.clothes_id"
                class="absolute top-0 right-0 z-10 h-[32px] w-[32px] flex items-center justify-center cursor-pointer transition-all duration-200"
                @click.stop="toggleClothesSelection(element)"
              >
                <div
                  class="wardrobe-neu-clothes-check w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                  :class="isClothesSelected(element.clothes_id) ? (hasCustomBtnBg ? 'border-transparent' : 'bg-qhx-primary border-qhx-primary') : 'border-gray-400 bg-white/80 dark:bg-gray-700/80'"
                  :style="isClothesSelected(element.clothes_id) && hasCustomBtnBg ? { ...customBtnStyle, borderColor: customStyle?.btnColor } : {}"
                >
                  <UIcon v-if="isClothesSelected(element.clothes_id)" name="i-heroicons-check" class="text-sm" :class="!hasCustomBtnFont && 'text-white'" />
                </div>
              </div>
              <div
                v-else-if="matchingMode && element.clothes_id"
                class="absolute top-0 right-0 z-10 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                @click.stop="handleMatchingDraftToggle(element, $event)"
              >
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="isInMatchingDraft(element.clothes_id) ? [!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                  :style="isInMatchingDraft(element.clothes_id) ? {} : customBtnStyle"
                >
                  <UIcon
                    :name="isInMatchingDraft(element.clothes_id) ? 'i-heroicons-trash' : 'material-symbols:add-2'"
                    class="text-[16px]"
                  />
                </div>
              </div>
              <div
                v-else-if="editMode && element.clothes_id"
                class="absolute top-0 right-0 z-10 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                @click.stop="openEditClothes(element, $event)"
              >
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                  :style="customBtnStyle"
                >
                  <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                </div>
              </div>
              <div
                v-if="element.color"
                class="absolute left-0 bottom-0 z-10 flex flex-wrap gap-0.5 p-1 rounded-bl-xl"
              >
                <div
                  v-for="(c, ci) in element.color.split(',')"
                  :key="ci"
                  class="w-3 h-3 rounded-full shadow-sm border border-white/50 dark:border-gray-700/50 shrink-0"
                  :style="{ backgroundColor: c.trim() }"
                />
              </div>
              <div class="wardrobe-neu-photo relative w-full overflow-hidden rounded-xl border border-gray-200">
                <img
                  :src="`${BASE_IMG}${element.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                  draggable="false"
                  class="wardrobe-detail-img block w-full cursor-grab object-cover active:cursor-grabbing"
                  :loading="wardrobeImgLoadingMode(element.clothes_img)"
                  decoding="async"
                  @load="markWardrobeImgLoaded(element.clothes_img)"
                  @contextmenu.prevent
                />
                <div
                  v-if="selectMode && getClothesDisplaySortNo(element)"
                  class="wardrobe-select-sort-mask absolute inset-0 z-[5] flex items-center justify-center pointer-events-none rounded-xl"
                  :class="isClothesSelected(element.clothes_id) ? 'wardrobe-select-sort-mask--selected' : ''"
                >
                  <span class="wardrobe-select-sort-no tabular-nums font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                    {{ getClothesDisplaySortNo(element) }}
                  </span>
                </div>
                <div
                  class="wardrobe-img-touch-shield"
                  :class="{ 'wardrobe-img-touch-shield--sorting': sortMode }"
                  aria-hidden="true"
                  @contextmenu.prevent
                />
              </div>
            </div>
            <div
              v-if="shouldShowClothesCardMeta(element)"
              class="wardrobe-card-meta mt-2 mx-[2px] w-full text-center"
            >
              <div
                v-if="shouldShowClothesNote(element)"
                class="line-clamp-2 overflow-hidden text-sm font-medium leading-5"
              >
                {{ element.clothes_note }}
              </div>
              <div
                v-if="shouldShowClothesPrice(element)"
                class="text-sm text-qhx-primary font-medium leading-5 overflow-hidden"
                :class="shouldShowClothesNote(element) ? 'mt-1' : ''"
              >
                ￥ {{ info?.show_price === 2 ? '***' : (element.price || 0) }}
              </div>
            </div>
          </div>
          <!-- 瀑布流（独立卡片样式） -->
          <div
            v-else
            class="group drag-handle pt-1 px-1 pb-0.5 max-md:pt-0.5 max-md:px-0.5 max-md:pb-0"
            :class="preferLiteEffects ? '' : 'transition-transform duration-300 ease-out hover:scale-[1.02]'"
            @mousedown="opearClothesId = element.clothes_id"
            @touchstart.passive="opearClothesId = element.clothes_id"
            @click="selectMode ? toggleClothesSelection(element) : jumpToClothes(element)"
          >
            <div
              class="wardrobe-clothes-card wardrobe-neu-item w-full overflow-hidden rounded-2xl border border-gray-200/50 dark:border-gray-600/45"
            >
              <div class="wardrobe-clothes-card-cover wardrobe-waterfall-item relative w-full">
                <div
                  v-if="shouldShowClothesStatusBadge(element) || shouldShowClothesFavoriteBadge(element)"
                  class="wardrobe-clothes-badge-stack pointer-events-none absolute z-10 max-md:left-1.5 max-md:top-1.5 max-md:flex max-md:max-w-[calc(100%-2.25rem)] max-md:flex-col max-md:items-start max-md:gap-0.5 md:contents"
                >
                  <div
                    v-if="shouldShowClothesStatusBadge(element)"
                    class="wardrobe-clothes-status-badge pointer-events-auto max-md:max-w-full max-md:truncate md:absolute md:left-1.5 md:top-1.5 md:max-w-[calc(100%-0.5rem)]"
                    :class="getWardrobeStatusBadgeClass(element.wardrobe_status)"
                  >
                    {{ element.wardrobe_status }}
                  </div>
                  <div
                    v-if="shouldShowClothesFavoriteBadge(element)"
                    class="wardrobe-clothes-fav-badge pointer-events-auto flex max-w-full items-center gap-0.5 max-md:flex-wrap md:absolute md:right-1.5 md:top-1.5"
                    :title="getClothesFavoriteLevelTitle(element)"
                    @click.stop="jumpToClothes(element)"
                  >
                    <span class="wardrobe-clothes-fav-badge__num">{{ getClothesFavoriteLevel(element) }}</span>
                    <UIcon
                      name="i-heroicons-star-solid"
                      class="wardrobe-clothes-fav-badge__star"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div
                  v-if="selectMode && element.clothes_id"
                  class="absolute top-1.5 right-1.5 z-10 h-[28px] w-[28px] flex items-center justify-center cursor-pointer transition-all duration-200"
                  @click.stop="toggleClothesSelection(element)"
                >
                  <div
                    class="wardrobe-neu-clothes-check w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                    :class="isClothesSelected(element.clothes_id) ? (hasCustomBtnBg ? 'border-transparent' : 'bg-qhx-primary border-qhx-primary') : 'border-gray-400 bg-white/80 dark:bg-gray-700/80'"
                    :style="isClothesSelected(element.clothes_id) && hasCustomBtnBg ? { ...customBtnStyle, borderColor: customStyle?.btnColor } : {}"
                  >
                    <UIcon v-if="isClothesSelected(element.clothes_id)" name="i-heroicons-check" class="text-xs" :class="!hasCustomBtnFont && 'text-white'" />
                  </div>
                </div>
                <div
                  v-else-if="matchingMode && element.clothes_id"
                  class="absolute top-1.5 right-1.5 z-10 h-[28px] w-[28px] flex items-center justify-center cursor-pointer"
                  @click.stop="handleMatchingDraftToggle(element, $event)"
                >
                  <div
                    class="wardrobe-neu-tool-orb rounded-[50%] h-[22px] w-[22px] flex items-center justify-center"
                    :class="isInMatchingDraft(element.clothes_id) ? [!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                    :style="isInMatchingDraft(element.clothes_id) ? {} : customBtnStyle"
                  >
                    <UIcon
                      :name="isInMatchingDraft(element.clothes_id) ? 'i-heroicons-trash' : 'material-symbols:add-2'"
                      class="text-[14px]"
                    />
                  </div>
                </div>
                <div
                  v-else-if="editMode && element.clothes_id"
                  class="absolute top-1.5 right-1.5 z-10 h-[28px] w-[28px] flex items-center justify-center cursor-pointer"
                  @click.stop="openEditClothes(element, $event)"
                >
                  <div
                    class="wardrobe-neu-tool-orb rounded-[50%] h-[22px] w-[22px] flex items-center justify-center"
                    :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                    :style="customBtnStyle"
                  >
                    <UIcon name="i-heroicons-pencil-square" class="text-[14px]" />
                  </div>
                </div>
                <div
                  v-if="element.color"
                  class="absolute left-1.5 bottom-1.5 z-10 flex flex-wrap gap-0.5"
                >
                  <div
                    v-for="(c, ci) in element.color.split(',')"
                    :key="ci"
                    class="w-2.5 h-2.5 rounded-full shadow-sm border border-white/50 dark:border-gray-700/50 shrink-0"
                    :style="{ backgroundColor: c.trim() }"
                  />
                </div>
                <div class="wardrobe-neu-photo wardrobe-waterfall-photo relative w-full h-full overflow-hidden">
                  <img
                    :src="`${BASE_IMG}${element.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                    draggable="false"
                    class="wardrobe-detail-img wardrobe-waterfall-img block w-full h-auto cursor-grab object-cover active:cursor-grabbing"
                    :loading="wardrobeImgLoadingMode(element.clothes_img)"
                    decoding="async"
                    @load="onClothesCardImgLoad(element.clothes_img)"
                    @contextmenu.prevent
                  />
                  <div
                    v-if="selectMode && getClothesDisplaySortNo(element)"
                    class="wardrobe-select-sort-mask absolute inset-0 z-[5] flex items-center justify-center pointer-events-none"
                    :class="isClothesSelected(element.clothes_id) ? 'wardrobe-select-sort-mask--selected' : ''"
                  >
                    <span class="wardrobe-select-sort-no tabular-nums font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                      {{ getClothesDisplaySortNo(element) }}
                    </span>
                  </div>
                  <div
                    class="wardrobe-img-touch-shield"
                    :class="{ 'wardrobe-img-touch-shield--sorting': sortMode }"
                    aria-hidden="true"
                    @contextmenu.prevent
                  />
                </div>
              </div>
              <div
                v-if="shouldShowClothesCardMeta(element)"
                class="wardrobe-clothes-card-body border-t border-gray-200/40 px-1.5 pt-1 pb-0.5 dark:border-gray-500/35 max-md:px-1 max-md:pt-0.5 max-md:pb-0.5"
              >
                <div
                  v-if="shouldShowClothesNote(element)"
                  class="line-clamp-2 overflow-hidden text-sm font-medium leading-5 text-gray-800 dark:text-gray-100 max-md:text-xs max-md:leading-4"
                >
                  {{ element.clothes_note }}
                </div>
                <div
                  v-if="shouldShowClothesPrice(element)"
                  class="text-sm text-qhx-primary font-semibold leading-5 max-md:text-xs max-md:leading-4"
                  :class="shouldShowClothesNote(element) ? 'mt-0.5' : ''"
                >
                  ￥{{ info?.show_price === 2 ? '***' : (element.price || 0) }}
                </div>
              </div>
            </div>
          </div>
        </DefineClothesCard>

        <div v-if="!timelineMode" class="w-full">
          <!-- 浏览态：行级虚拟滚动，仅渲染可视行附近卡片 -->
          <div
            v-if="virtualEnabled"
            ref="virtualSpacerRef"
            class="relative w-full"
            :style="{ height: `${virtualTotalHeight}px` }"
          >
            <div
              ref="virtualWrapperRef"
              class="absolute left-0 right-0 top-0"
              :style="{ transform: `translateY(${virtualOffsetY}px)` }"
            >
              <div
                v-for="(rowItems, rIdx) in virtualVisibleRows"
                :key="`vrow-${virtualRange.startRow + rIdx}`"
                class="wardrobe-virtual-row flex w-full"
                :data-row="virtualRange.startRow + rIdx"
              >
                <div
                  v-for="element in rowItems"
                  :key="element.clothes_id ?? `v-${virtualRange.startRow + rIdx}-${element.clothes_id}`"
                  class="wardrobe-clothes-cell wardrobe-clothes-cell--virtual [@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3"
                >
                  <ReuseClothesCard :element="element" />
                </div>
              </div>
            </div>
          </div>
          <!-- 浏览态：瀑布流（QhxWaterList 布局 + 外部 list 数据） -->
          <QhxWaterList
            v-else-if="isWaterfallLayout"
            ref="waterListRef"
            :items="list"
            :columns="6"
            :columns_768="3"
            :item-key="2"
            :enable-waterfall="true"
            :enable-load-more="false"
          >
            <template #default="{ item }">
              <div class="px-0.5 pb-0.5 max-md:px-0 max-md:pb-0">
                <ReuseClothesCard :element="item" />
              </div>
            </template>
          </QhxWaterList>
          <!-- 排序态：自研高性能拖拽排序（QhxSortableList，无 vuedraggable） -->
          <QhxSortableList
            v-else
            id="wardrobe-guide-clothes-grid"
            v-model="list"
            item-key="clothes_id"
            class="flex flex-wrap"
            item-class="wardrobe-clothes-cell [@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3"
            :animation="200"
            :delay="140"
            :get-scroll-container="() => scrollRootRef"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <ReuseClothesCard :element="element" />
            </template>
          </QhxSortableList>
        </div>
        <QhxLoading v-if="!timelineMode" :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore">
        </QhxLoading>
        <div class="pb-[40px]"></div>
      </div>
    </div>
        </div>
      </div>
      <!-- 时间轴：历史纵轴 + 塔罗牌风卡片；同日多件为扇形卡组 -->
      <!-- v-if：非时间轴时必须卸载整层。仅用 opacity-0 + 父级 pointer-events-none 时，子元素 .wardrobe-img-touch-shield 的 pointer-events:auto 仍会参与命中，导致误点 -->
      <div
        v-if="timelineMode"
        class="absolute inset-0 z-[25] flex min-h-[100dvh] flex-col overflow-x-hidden bg-gradient-to-b from-neutral-50/98 via-white/95 to-neutral-100/90 transition-opacity duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] dark:from-neutral-950 dark:via-neutral-950 dark:to-black/95"
        :class="preferLiteEffects ? '' : 'backdrop-blur-sm'"
      >
        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          :style="{ paddingTop: `${(configStore.statusBarHeight || 0) + 52}px` }"
        >
          <div
            class="timeline-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-8 pt-3 text-left md:px-5"
          >
            <Transition name="timeline-deck-backdrop">
              <div
                v-if="timelineExpandedDeckKey"
                class="pointer-events-auto absolute inset-x-0 top-0 bottom-0 z-[1] bg-black/16 backdrop-blur-[0.5px] dark:bg-black/42"
                aria-hidden="true"
                @click="timelineExpandedDeckKey = null"
              />
            </Transition>
            <div class="relative z-[2]">
            <!-- 时间轴汇总：总条数、总价、日均（有入柜时间的金额 / 首末入柜日天数） -->
            <div
              v-if="timelineMode"
              class="timeline-summary mb-4 max-w-3xl rounded-xl border border-neutral-200/85 bg-white/75 px-3 py-3 shadow-sm dark:border-neutral-700/85 dark:bg-neutral-900/55"
            >
              <div
                v-if="isLoading && list.length === 0"
                class="text-center text-sm text-neutral-500 dark:text-neutral-400"
              >
                统计与列表加载中…
              </div>
              <div
                v-else
                class="grid grid-cols-3 gap-2 text-center sm:gap-4 sm:text-left"
              >
                <div>
                  <p class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">总条数</p>
                  <p class="mt-0.5 font-mono text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {{ timelineStats.count }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">总价</p>
                  <p class="mt-0.5 font-mono text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    ￥ {{ info?.show_price === 1 ? Math.round(timelineStats.totalPrice) : '***' }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">日均成本</p>
                  <p
                    v-if="timelineStats.datedCount > 0"
                    class="mt-0.5 text-[9px] leading-tight text-neutral-500/90 dark:text-neutral-500"
                  >
                    有入柜 {{ timelineStats.datedCount }} 件 · {{ timelineStats.daySpan }} 天
                  </p>
                  <p class="mt-0.5 font-mono text-base font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    <template v-if="info?.show_price !== 1">***</template>
                    <template v-else-if="timelineStats.dailyAvg === null">—</template>
                    <template v-else>￥ {{ timelineStats.dailyAvg.toFixed(2) }}</template>
                  </p>
                </div>
              </div>
            </div>
            <div
              v-if="isLoading && list.length === 0"
              class="flex min-h-[40vh] items-center justify-center font-serif text-neutral-500"
            >
              <span class="text-sm">卷轴展开中…</span>
            </div>
            <div
              v-else-if="!isLoading && list.length === 0"
              class="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-neutral-500"
            >
              <UIcon name="material-symbols:auto-stories-outline" class="text-4xl opacity-40" />
              <p class="text-sm font-serif">暂无记录</p>
            </div>
            <template v-else>
              <div class="timeline-history relative w-full max-w-3xl pl-4 md:pl-5">
                <div
                  class="timeline-spine pointer-events-none absolute bottom-4 left-[7px] top-0 w-[0.5px] bg-gradient-to-b from-neutral-300/90 via-neutral-400/70 to-neutral-300/40 dark:from-neutral-600/50 dark:via-neutral-500/40 dark:to-neutral-700/30 md:left-[9px]"
                  aria-hidden="true"
                />
                <article
                  v-for="node in timelineNodes"
                  :key="node.key"
                  class="timeline-node relative pb-8 pl-3 md:pb-10 md:pl-5"
                  :class="isTimelineNodeFanExpanded(node.key) ? 'z-[90] isolate' : ''"
                >
                  <div
                    class="timeline-node-dot absolute left-[5px] top-1 z-[2] h-1.5 w-1.5 rounded-full border border-neutral-800 bg-white shadow-sm dark:border-neutral-300 dark:bg-neutral-800 md:left-[6px] md:h-2 md:w-2"
                    aria-hidden="true"
                  />
                  <div class="mb-3 flex flex-col gap-1 pr-0.5">
                    <header class="flex flex-row flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <time
                        class="font-mono text-xs font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-100 md:text-sm"
                        :datetime="node.key === '__unknown__' ? undefined : node.key"
                      >
                        {{ node.dateLabel }}
                      </time>
                      <span
                        v-if="node.daysInCabinetText"
                        class="shrink-0 text-[10px] leading-none text-neutral-500 dark:text-neutral-400"
                      >
                        {{ node.daysInCabinetText }}
                      </span>
                    </header>
                    <p class="text-[10px] leading-snug text-neutral-500 dark:text-neutral-500">
                      当日总价
                      <span class="ml-1 font-mono text-neutral-700 dark:text-neutral-300">
                        ￥ {{ info?.show_price === 1 ? (node.dayTotal || 0) : '***' }}
                      </span>
                    </p>
                  </div>

                  <!-- 单日仅 1 件：小塔罗单卡 -->
                  <div
                    v-if="node.items.length === 1 && node.items[0]"
                    class="inline-flex w-fit max-w-full justify-start pl-0 md:pl-2"
                  >
                    <div
                      class="timeline-tarot timeline-tarot--sm group text-left"
                    >
                      <div class="timeline-tarot-frame">
                        <div class="timeline-tarot-inner">
                          <div class="timeline-tarot-image-wrap">
                            <img
                              v-if="node.items[0].clothes_img"
                              :src="`${BASE_IMG}${node.items[0].clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                              class="timeline-tarot-img"
                              draggable="false"
                              loading="lazy"
                              alt=""
                              @contextmenu.prevent
                            />
                            <div v-else class="flex h-full w-full items-center justify-center bg-neutral-200/40 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-500">
                              <UIcon name="material-symbols:dresser-outline" class="text-2xl opacity-70" />
                            </div>
                            <div class="timeline-tarot-vignette" />
                            <div
                              class="wardrobe-img-touch-shield"
                              aria-hidden="true"
                              @contextmenu.prevent
                            />
                          </div>
                          <div class="timeline-tarot-caption">
                            <p class="line-clamp-2 font-serif text-[10px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
                              {{ node.items[0].clothes_note || '未命名' }}
                            </p>
                            <p
                              v-if="node.items[0].price"
                              class="mt-0.5 font-mono text-[9px] text-neutral-700 dark:text-neutral-300"
                            >
                              ￥ {{ info?.show_price === 2 ? '***' : (node.items[0].price || 0) }}
                            </p>
                            <p
                              v-if="formatTimelineItemDailyAvg(node.items[0]) !== null"
                              class="mt-0.5 font-mono text-[9px] leading-tight text-neutral-600 dark:text-neutral-400"
                            >
                              日均 ￥ {{ info?.show_price === 2 ? '***' : formatTimelineItemDailyAvg(node.items[0]) }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 同日多件：手机端每行 3 组；PC 横向 flex；多卡扇形展开见 timelineDeckFanStyle -->
                  <div
                    v-else
                    :id="`timeline-node-decks-${node.key}`"
                    class="timeline-node-decks relative w-full overflow-visible pl-0 md:pl-2"
                  >
                  <div
                    class="grid grid-cols-3 gap-x-1.5 gap-y-6 items-end justify-items-start pl-0 md:flex md:flex-row md:flex-wrap md:content-start md:items-end md:justify-start md:gap-x-5 md:gap-y-8 md:pl-0"
                  >
                    <template
                      v-for="(deck, dIdx) in node.decks"
                      :key="`${node.key}-deck-${dIdx}`"
                    >
                      <!-- 副内仅 1 张（如第 4 件单独成副） -->
                      <div
                        v-if="deck.length === 1 && deck[0]"
                        class="inline-flex w-fit max-w-full min-w-0 shrink-0 justify-start"
                      >
                        <div
                          class="timeline-tarot timeline-tarot--sm group text-left"
                        >
                          <div class="timeline-tarot-frame">
                            <div class="timeline-tarot-inner">
                              <div class="timeline-tarot-image-wrap">
                                <img
                                  v-if="deck[0].clothes_img"
                                  :src="`${BASE_IMG}${deck[0].clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                                  class="timeline-tarot-img"
                                  draggable="false"
                                  loading="lazy"
                                  alt=""
                                  @contextmenu.prevent
                                />
                                <div v-else class="flex h-full w-full items-center justify-center bg-neutral-200/40 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-500">
                                  <UIcon name="material-symbols:dresser-outline" class="text-2xl opacity-70" />
                                </div>
                                <div class="timeline-tarot-vignette" />
                                <div
                                  class="wardrobe-img-touch-shield"
                                  aria-hidden="true"
                                  @contextmenu.prevent
                                />
                              </div>
                              <div class="timeline-tarot-caption">
                                <p class="line-clamp-2 font-serif text-[10px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
                                  {{ deck[0].clothes_note || '未命名' }}
                                </p>
                                <p
                                  v-if="deck[0].price"
                                  class="mt-0.5 font-mono text-[9px] text-neutral-700 dark:text-neutral-300"
                                >
                                  ￥ {{ info?.show_price === 2 ? '***' : (deck[0].price || 0) }}
                                </p>
                                <p
                                  v-if="formatTimelineItemDailyAvg(deck[0]) !== null"
                                  class="mt-0.5 font-mono text-[9px] leading-tight text-neutral-600 dark:text-neutral-400"
                                >
                                  日均 ￥ {{ info?.show_price === 2 ? '***' : formatTimelineItemDailyAvg(deck[0]) }}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <!-- 副内 2～3 张：左下叠放；点击原地扇形展开（塔罗选牌） -->
                      <div
                        v-else
                        class="relative border-none min-w-0 shrink-0 origin-bottom-left py-1 max-md:scale-[0.9] md:w-auto md:scale-100"
                        :class="isTimelineDeckExpanded(node.key, dIdx) ? 'z-[120] isolate' : ''"
                      >
                        <div
                          class="timeline-deck-wrap relative"
                          :id="`timeline-deck-wrap-${timelineDeckKey(node.key, dIdx)}`"
                          :class="isTimelineDeckExpanded(node.key, dIdx) ? 'z-[130]' : 'z-10'"
                        >
                          <div
                            class="cursor-pointer rounded-lg outline-none transition-[transform,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-neutral-400/80 dark:focus-visible:ring-neutral-500"
                            :class="isTimelineDeckExpanded(node.key, dIdx) ? 'ring-2 ring-amber-400/35 ring-offset-2 ring-offset-neutral-50 dark:ring-amber-300/25 dark:ring-offset-neutral-950' : ''"
                            role="button"
                            tabindex="0"
                            @click="toggleTimelineDeckExpand(node.key, dIdx)"
                            @keydown.enter.prevent="toggleTimelineDeckExpand(node.key, dIdx)"
                          >
                            <div
                              v-if="isTimelineDeckExpanded(node.key, dIdx) && timelineDeckOverlayRect"
                              class="pointer-events-none shrink-0"
                              :id="`timeline-deck-spacer-${timelineDeckKey(node.key, dIdx)}`"
                              :style="{
                                width: `${timelineDeckOverlayRect.width}px`,
                                height: `${timelineDeckOverlayRect.height}px`,
                              }"
                              aria-hidden="true"
                            />
                            <div
                              class="timeline-deck relative overflow-visible pr-1"
                              :id="`timeline-deck-${timelineDeckKey(node.key, dIdx)}`"
                              :style="timelineDeckFixedStyle(node.key, dIdx)"
                              :class="[
                                deck.length >= 3 ? 'min-h-[158px] min-w-[118px]' : 'min-h-[182px] min-w-[108px]',
                                'max-md:min-w-0 max-md:w-full',
                                isTimelineDeckExpanded(node.key, dIdx) ? 'timeline-deck--fanning' : '',
                              ]"
                            >
                              <div
                                v-for="(item, idx) in deck"
                                :key="`${node.key}-d${dIdx}-${item.clothes_id ?? idx}`"
                                class="timeline-tarot timeline-tarot--sm timeline-deck-card absolute bottom-0 left-0 text-left"
                                :class="isTimelineDeckExpanded(node.key, dIdx) ? 'timeline-deck-card--fan' : 'transition-[transform,filter] duration-200 ease-out'"
                                :style="timelineDeckCardTransform(node.key, dIdx, idx, deck.length)"
                              >
                                <div class="timeline-tarot-frame timeline-tarot-frame--deck">
                                  <div class="timeline-tarot-inner">
                                    <div class="timeline-tarot-image-wrap">
                                      <img
                                        v-if="item.clothes_img"
                                        :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                                        class="timeline-tarot-img"
                                        draggable="false"
                                        loading="lazy"
                                        alt=""
                                        @contextmenu.prevent
                                      />
                                      <div v-else class="flex h-full w-full items-center justify-center bg-neutral-200/40 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-500">
                                        <UIcon name="material-symbols:dresser-outline" class="text-lg opacity-70" />
                                      </div>
                                      <div class="timeline-tarot-vignette" />
                                      <div
                                        class="wardrobe-img-touch-shield"
                                        aria-hidden="true"
                                        @contextmenu.prevent
                                      />
                                    </div>
                                    <div class="timeline-tarot-caption timeline-tarot-caption--deck">
                                      <p class="line-clamp-2 font-serif text-[10px] font-medium leading-snug text-neutral-900 dark:text-neutral-100">
                                        {{ item.clothes_note || '未命名' }}
                                      </p>
                                      <p
                                        v-if="item.price"
                                        class="mt-0.5 font-mono text-[9px] text-neutral-700 dark:text-neutral-300"
                                      >
                                        ￥ {{ info?.show_price === 2 ? '***' : (item.price || 0) }}
                                      </p>
                                      <p
                                        v-if="formatTimelineItemDailyAvg(item) !== null"
                                        class="mt-0.5 font-mono text-[9px] leading-tight text-neutral-600 dark:text-neutral-400"
                                      >
                                        日均 ￥ {{ info?.show_price === 2 ? '***' : formatTimelineItemDailyAvg(item) }}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                  </div>
                </article>
              </div>
            </template>
            <QhxLoading
              :loading="isLoading"
              :page="page"
              :total="total"
              :page-size="timelineMode ? TIMELINE_PAGE_SIZE : pageSize"
              @load-more="loadMore"
            />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 筛选抽屉 -->
    <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
      <QhxBottomDrawer v-if="showFilterDrawer" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 500 : 450">
      <div class="flex flex-col h-full">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between mb-2 px-4 pt-2 flex-shrink-0">
          <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">筛选</h3>
          <button
            type="button"
            @click="closeFilterDrawer"
            class="w-8 h-8 flex items-center justify-center rounded-full transition-colors group"
            :class="!hasCustomBtnBg && 'hover:bg-gray-100 dark:hover:bg-gray-700'"
            :style="customBtnStyle"
          >
            <UIcon
              name="i-heroicons-x-mark"
              class="transition-colors"
              :class="!hasCustomBtnFont && 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'"
            />
          </button>
        </div>
        
        <!-- 可滚动内容区域 -->
        <div class="flex-1 overflow-y-auto px-4">
          <div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">注意: 该筛选会影响总价等统计数据</p>
          </div>
          
          <div class="mb-4">
            <div class="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">服饰名字：</div>
            <UInput 
              v-model="filter_list.clothes_note" 
              placeholder="请输入服饰名字进行筛选"
              class="w-full"
              :ui="{
                base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                rounded: 'rounded-[10px]',
                padding: { xs: 'px-4 py-2' },
                color: {
                  white: {
                    outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                  }
                }
              }"
            />
          </div>
          
          <div class="mb-4">
            <div class="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">状态：</div>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(status, index) in wardrobeStatusOptions"
                :key="index"
                :active="filter_list.wardrobe_status.includes(status.label)"
                class="cursor-pointer"
                @click="chooseStatus(status.label)"
              >
                {{ status.label }}
              </QhxTag>
            </div>
          </div>

          <div v-if="sizeFilterOptions.length > 0" class="mb-2">
            <div class="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-200">尺码：</div>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(size, index) in sizeFilterOptions"
                :key="index"
                :active="filter_list.size.includes(size)"
                class="cursor-pointer"
                @click="chooseSize(size)"
              >
                {{ size }}
              </QhxTag>
            </div>
          </div>
        </div>
        
        <!-- 固定在底部的按钮 -->
        <div class="flex justify-end gap-2 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <UButton
            color="gray"
            variant="outline"
            :class="hasAnyCustomBtnTheme && hasCustomBtnBg ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="resetFilter"
          >
            重置
          </UButton>
          <UButton
            color="primary"
            :class="customStyle?.btnColor ? 'hover:opacity-90' : ''"
            :style="customBtnStyle"
            @click="confirmFilter"
          >
            确认筛选
          </UButton>
        </div>
      </div>
    </QhxBottomDrawer>
    </Transition>

    <!-- 攒钱计划时间线（拟态）：自左侧抽屉；仅客户端 Teleport，避免刷新时 SSR 报错 -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="showPlanTimelineDrawer"
            class="fixed inset-0 z-[45] bg-black/35 backdrop-blur-[1px]"
            aria-hidden="true"
            @click="closePlanTimelineDrawer"
          />
        </Transition>
      </Teleport>
    </ClientOnly>
    <Transition name="drawer-left">
      <QhxBottomDrawer
        v-if="showPlanTimelineDrawer"
        direction="left"
        :default-size="planTimelineDrawerDefaultSize"
        :min-size="220"
        :content-padding="false"
      >
        <div class="plan-neu-drawer flex flex-col h-full min-h-0 text-qhx-text">
          <div
            class="flex-shrink-0 w-full"
            aria-hidden="true"
            :style="{
              height: `calc(env(safe-area-inset-top, 0px))`,
            }"
          />
          <div class="plan-neu-header flex items-center justify-between gap-2 flex-shrink-0">
            <h3 class="text-sm font-bold plan-neu-title tracking-tight">攒钱计划</h3>
            <button
              type="button"
              class="plan-neu-icon-btn"
              aria-label="关闭"
              @click="closePlanTimelineDrawer"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>
          <div
            v-if="planTimelineSummary && (planTimelineSummary.total_plan != null || planTimelineSummary.need_money != null)"
            class="plan-neu-stats grid grid-cols-2 gap-1.5 mb-2 flex-shrink-0"
          >
            <div class="plan-neu-stat">
              <div class="plan-neu-stat-label">计划</div>
              <div class="plan-neu-stat-value">{{ planTimelineSummary.total_plan ?? '—' }}</div>
            </div>
            <div class="plan-neu-stat">
              <div class="plan-neu-stat-label">完成</div>
              <div class="plan-neu-stat-value">{{ planTimelineSummary.is_complete ?? '—' }}</div>
            </div>
            <div class="plan-neu-stat col-span-2">
              <div class="plan-neu-stat-label">尾款总计</div>
              <div class="plan-neu-stat-value plan-neu-stat-mono">
                ￥{{ (Number(planTimelineSummary.need_money || 0) - Number(planTimelineSummary.have_money || 0)) }}
              </div>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto min-h-0 plan-neu-scroll">
            <div v-if="planTimelineLoading && planTimelineRows.length === 0" class="text-center py-8 text-xs opacity-55">
              加载中…
            </div>
            <div v-else-if="planTimelineRowsDisplay.length === 0" class="text-center py-8 text-xs opacity-55">
              暂无计划记录
            </div>
            <div v-else class="relative plan-neu-timeline">
              <div class="plan-neu-rail" aria-hidden="true" />
              <div class="plan-neu-list flex flex-col gap-1.5">
                <div
                  v-for="{ row, idx, balance, started } in planTimelineEntries"
                  :key="`${row.list_id}-${idx}`"
                  class="plan-neu-row relative flex gap-0 min-w-0"
                >
                  <div class="plan-neu-node-col flex flex-col items-center flex-shrink-0">
                    <div
                      class="plan-neu-node"
                      :class="Number(row.is_complete) === 1 ? 'plan-neu-node--done' : ''"
                    />
                  </div>
                  <div class="flex-1 min-w-0 plan-neu-card">
                    <div class="flex-1 min-w-0 py-0.5">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <div
                            v-if="row.clothes_img"
                            class="plan-neu-thumb plan-neu-thumb--round flex-shrink-0 overflow-hidden w-7 h-7"
                          >
                            <img
                              :src="`${BASE_IMG}${row.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                              alt=""
                              class="w-full h-full object-cover"
                              draggable="false"
                              loading="lazy"
                            />
                          </div>
                          <span
                            class="text-xs font-semibold leading-tight line-clamp-1 flex-1 min-w-0"
                            :class="started ? 'plan-neu-started-text' : ''"
                          >
                            {{ row.clothes_note || row.plan_note || '计划项' }}
                          </span>
                          <span
                            v-if="Number(row.is_complete) === 1"
                            class="plan-neu-badge flex-shrink-0"
                          >达成</span>
                        </div>
                        <div
                          v-if="balance"
                          class="plan-neu-balance"
                          :class="{
                            'plan-neu-balance--urgent': balance.urgent,
                            'plan-neu-balance--muted': balance.muted,
                          }"
                        >
                          <UIcon name="i-heroicons-clock" class="plan-neu-balance-icon shrink-0" />
                          <span class="plan-neu-balance-text">{{ balance.text }}</span>
                          <span
                            v-if="row.end_time && !balance.muted"
                            class="plan-neu-balance-date shrink-0"
                            :class="started ? 'plan-neu-started-text' : ''"
                          >{{ dayjs(row.end_time).format('MM-DD') }}</span>
                        </div>
                        <div class="flex items-baseline justify-between gap-2 mt-0.5">
                          <p
                            class="text-[10px] font-mono tabular-nums leading-none"
                            :class="started ? 'plan-neu-started-text' : 'opacity-55'"
                          >
                            {{ row.end_time ? dayjs(row.end_time).format('MM-DD HH:mm') : '—' }}
                          </p>
                          <p class="text-[10px] font-mono tabular-nums opacity-75 leading-none whitespace-nowrap">
                            需 ￥{{ row.need_money ?? 0 }}
                          </p>
                        </div>
                        <div
                          v-if="planRowCanShowComplete(row)"
                          class="mt-1.5 flex justify-end"
                        >
                          <button
                            type="button"
                            class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-qhx-primary text-white hover:opacity-90 active:opacity-95 transition-opacity"
                            @click.stop="confirmPlanTimelineComplete(row.list_id)"
                          >
                            完成
                          </button>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="planTimelineHasMore" class="flex justify-center pt-2 pb-1">
              <button
                type="button"
                class="plan-neu-loadmore"
                :disabled="planTimelineLoading"
                @click="loadMorePlanTimeline"
              >
                {{ planTimelineLoading ? '加载中…' : '更多' }}
              </button>
            </div>
            <div v-else-if="planTimelineRowsDisplay.length > 0" class="text-center text-[10px] opacity-45 pt-1 pb-0.5">
              共 {{ planTimelineCount }} 条
            </div>
          </div>
        </div>
      </QhxBottomDrawer>
    </Transition>

    <!-- 搭配草稿悬浮按钮：需先打开搭配模式；matchingBtnRef 用于飞入动画目标定位 -->
    <QhxFloatingButton
      v-show="matchingMode && matchingDraftStore.count > 0 && !timelineMode"
      initial-position="bottom-left"
      :bottom-offset="matchingFabBottomOffset"
    >
      <div
        ref="matchingBtnRef"
        class="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
        :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
        :style="customBtnStyle"
        @click="showMatchingDrawer = true"
      >
        <UIcon name="material-symbols:add-shopping-cart-rounded" class="text-2xl" />
        <span
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full"
          :class="[!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white']"
          :style="customBtnStyle"
        >
          {{ matchingDraftStore.count > 99 ? '99+' : matchingDraftStore.count }}
        </span>
      </div>
    </QhxFloatingButton>
    <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
      <QhxBottomDrawer v-if="showMatchingDrawer" :direction="isMobile ? 'bottom' : 'right'" :default-size="isMobile ? 450 : 400">
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between mb-2 px-4 pt-2 flex-shrink-0">
            <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">搭配草稿 ({{ matchingDraftStore.count }})</h3>
            <button
              type="button"
              @click="showMatchingDrawer = false"
              class="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              :class="!hasCustomBtnBg && 'hover:bg-gray-100 dark:hover:bg-gray-700'"
              :style="customBtnStyle"
            >
              <UIcon name="i-heroicons-x-mark" :class="!hasCustomBtnFont && 'text-gray-500'" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <div v-if="matchingDraftStore.list.length === 0" class="text-center py-12 text-gray-500">
              暂无服饰，开启搭配模式添加
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in matchingDraftStore.list"
                :key="item.clothes_id"
                class="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div class="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
                  <img
                    :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300`"
                    class="wardrobe-detail-img h-full w-full object-cover"
                    draggable="false"
                    loading="lazy"
                    @contextmenu.prevent
                  />
                  <div
                    class="wardrobe-img-touch-shield"
                    aria-hidden="true"
                    @contextmenu.prevent
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{{ item.clothes_note || '未命名' }}</div>
                  <div v-if="item.price" class="text-xs text-qhx-primary mt-0.5">￥{{ item.price }}</div>
                </div>
                <button
                  type="button"
                  class="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center transition-colors"
                  :class="[!hasCustomBtnBg && 'bg-red-500/90 hover:bg-red-500', !hasCustomBtnFont && 'text-white']"
                  :style="customBtnStyle"
                  @click="matchingDraftStore.remove(item.clothes_id!)"
                >
                  <UIcon name="i-heroicons-trash" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
          <div class="flex justify-center px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <UButton
              block
              :class="[
                !customStyle?.btnColor && 'bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover',
                customStyle?.btnColor && 'hover:opacity-90',
              ]"
              :style="customBtnStyle"
              @click="openMatchingAddEdit"
            >
              创建搭配
            </UButton>
          </div>
        </div>
      </QhxBottomDrawer>
    </Transition>

    <!-- 全局搜索组件 -->
    <WardrobeSearch
      ref="wardrobeSearchRef"
      :wardrobe-list="wardrobeList"
      :can-choose="false"
    />
    <!-- 多选模式：切换衣柜选择 -->
    <WardrobeChoose
      v-if="user.user?.user_id === Number.parseInt(id)"
      ref="wardrobeChooseRef"
      :user_id="Number.parseInt(id)"
      :multiple="false"
      @choose="onWardrobeChooseForMove"
    />

    <!-- 多选模式底部悬浮功能栏 -->
    <Transition name="select-bar">
      <div
        v-if="selectMode && !timelineMode"
        class="wardrobe-neu-select-bar fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center justify-center gap-2 px-3 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md safe-area-pb"
      >
        <QhxJellyButton>
          <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="onSelectModeSwitchWardrobe">
            <div
              class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
              :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
            >
              <UIcon name="material-symbols:swap-horiz" class="text-[16px]" />
            </div>
            <div class="text-xs text-qhx-text">切换衣柜</div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div
            class="h-[46px] text-center px-0.5 cursor-pointer"
            :class="selectedClothesIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
            @click="selectedClothesIds.size > 0 && openBatchStatusModal()"
          >
            <div
              class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
              :class="selectedClothesIds.size > 0 ? [!hasCustomBtnBg && 'bg-amber-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
              :style="selectedClothesIds.size > 0 ? customBtnStyle : {}"
            >
              <UIcon name="i-heroicons-tag-20-solid" class="text-[16px]" />
            </div>
            <div class="text-xs text-qhx-text">
              批量状态
              <span v-if="selectedClothesIds.size > 0">({{ selectedClothesIds.size }})</span>
            </div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div
            class="h-[46px] text-center px-0.5 cursor-pointer"
            :class="selectedClothesIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
            @click="selectedClothesIds.size > 0 && openBatchSortModal()"
          >
            <div
              class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
              :class="selectedClothesIds.size > 0 ? [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
              :style="selectedClothesIds.size > 0 ? customBtnStyle : {}"
            >
              <UIcon name="icon-park-outline:sort-two" class="text-[16px]" />
            </div>
            <div class="text-xs text-qhx-text">
              批量排序
              <span v-if="selectedClothesIds.size > 0">({{ selectedClothesIds.size }})</span>
            </div>
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div
            class="h-[46px] text-center px-0.5 cursor-pointer"
            :class="selectedClothesIds.size === 0 ? 'cursor-not-allowed opacity-60' : ''"
            @click="selectedClothesIds.size > 0 && onSelectModeBatchDelete()"
          >
            <div
              class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center mx-auto"
              :class="selectedClothesIds.size > 0 ? [!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
              :style="selectedClothesIds.size > 0 ? customBtnStyle : {}"
            >
              <UIcon name="i-heroicons-trash" class="text-[16px]" />
            </div>
            <div class="text-xs text-qhx-text">
              批量删除
              <span v-if="selectedClothesIds.size > 0">({{ selectedClothesIds.size }})</span>
            </div>
          </div>
        </QhxJellyButton>
      </div>
    </Transition>

    <!-- 全屏徽章装饰：与 community/detail 一致，pointer-events-none 不拦截主页面点击 -->
    <div
      v-if="hasWardrobeDisplayBadges"
      class="pointer-events-none fixed inset-x-0 top-0 z-[110] overflow-hidden"
      :class="
        selectMode && !timelineMode
          ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+10px)]'
          : 'bottom-[10px]'
      "
      aria-hidden="true"
    >
      <ClientOnly>
        <AchievementBadgePhysics
          :key="wardrobeDisplayBadgesKey"
          class="h-full w-full"
          :badges="wardrobeDisplayBadges"
        />
      </ClientOnly>
    </div>

    <QhxStepGuide
      ref="sortGuideRef"
      v-model="showSortGuide"
      :steps="wardrobeSortGuideSteps"
      :storage-key="WARDROBE_SORT_GUIDE_STORAGE_KEY"
      skip-label="不再提示"
      :persist-on-finish="false"
      @step-change="onSortGuideStepChange"
    />
  </div>
</template>

<style scoped>
.drag-ghost {
  opacity: 0.4;
  transform: scale(0.95);
}

.drag-chosen {
  /* outline: 2px solid #ff9eb5; */
  border-radius: 12px;
}

.dragging {
  transform: scale(1.05);
}

/* 拖拽切换时的过渡动效 */
.list-move {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  /* 类似回弹效果 */
}

/* 衣柜侧栏列表：隐藏滚动条，仍可滚动 */
.wardrobe-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.wardrobe-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.wardrobe-wrap{
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* 拟态：左侧栏 / 服饰卡 / 工具圆钮；仅用阴影与高光，不改配色与布局 */

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

/* —— 左侧整栏：带右缘层次的软面板 —— */
.wardrobe-page-neu .wardrobe-neu-sidebar {
  box-shadow:
    4px 3px 10px rgba(0, 0, 0, 0.08),
    -2px -2px 8px rgba(255, 255, 255, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 1px 0 0 rgba(255, 255, 255, 0.12),
    inset -1px 0 2px rgba(0, 0, 0, 0.03);
}

.dark .wardrobe-page-neu .wardrobe-neu-sidebar {
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.28),
    -2px -2px 8px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 1px 0 0 rgba(255, 255, 255, 0.03),
    inset -1px 0 2px rgba(0, 0, 0, 0.18);
}

/* —— 区域收缩/展开小按钮 —— */
.wardrobe-page-neu .wardrobe-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--color-qhx-text, #666);
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    2px 2px 6px var(--ward-neu-deep),
    -1px -1px 4px var(--ward-neu-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  cursor: pointer;
}

.wardrobe-page-neu .wardrobe-collapse-toggle:hover {
  transform: scale(1.08);
}

.wardrobe-page-neu .wardrobe-collapse-toggle:active {
  transform: scale(0.95);
}

.wardrobe-page-neu .wardrobe-collapse-toggle--float-left {
  width: 20px;
  height: 20px;
}

.wardrobe-page-neu .wardrobe-collapse-toggle--float-left:hover,
.wardrobe-page-neu .wardrobe-collapse-toggle--float-left:active {
  transform: none;
}

/* 左侧悬浮：固定视口垂直居中，扩大点击热区，视觉尺寸不变 */
.wardrobe-page-neu .wardrobe-sidebar-toggle-hit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-collapsed {
  left: 0;
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-no-transition {
  transition: none;
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-expanded {
  left: calc(180px - 10px);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit:hover .wardrobe-collapse-toggle--float-left {
  transform: scale(1.08);
}

.wardrobe-page-neu .wardrobe-sidebar-toggle-hit:active .wardrobe-collapse-toggle--float-left {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .wardrobe-page-neu .wardrobe-sidebar-toggle-hit.is-expanded {
    left: calc(20vw - 10px);
  }
}

.dark .wardrobe-page-neu .wardrobe-collapse-toggle {
  background: rgba(40, 40, 44, 0.88);
  color: rgba(255, 255, 255, 0.75);
}

/* 列表格：滚动时跳过屏外绘制（旧 iOS 滚动卡顿主要优化之一）。
   用 :global 以便同时作用于「浏览态虚拟网格(页面渲染)」与「排序态 QhxSortableList(子组件渲染)」的格子。 */
:global(.wardrobe-clothes-cell) {
  content-visibility: auto;
  contain-intrinsic-size: auto 220px;
}

/* 虚拟滚动网格内的卡片已由 JS 窗口化，关闭 content-visibility：
   否则屏外 overscan 卡片会被塌缩成 intrinsic-size，导致行高测量错误。 */
:global(.wardrobe-clothes-cell--virtual) {
  content-visibility: visible;
  contain-intrinsic-size: none;
}

/* aspect-ratio 兜底：HarmonyOS 3 等旧 WebView 不支持时避免封面高度塌缩、虚拟列表滚动闪烁 */
.wardrobe-aspect-square {
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  overflow: hidden;
}
@supports (aspect-ratio: 1) {
  .wardrobe-aspect-square {
    height: auto;
    padding-bottom: 0;
    aspect-ratio: 1 / 1;
  }
}
.wardrobe-aspect-square > .wardrobe-neu-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.wardrobe-neu-photo .wardrobe-detail-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 瀑布流：统一半透明卡片（仅瀑布流使用，网格布局不受影响） */
.wardrobe-clothes-card.wardrobe-neu-item {
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.dark .wardrobe-clothes-card.wardrobe-neu-item {
  background: rgba(30, 35, 45, 0.55);
}
.wardrobe-clothes-card-cover .wardrobe-neu-photo {
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}
.wardrobe-clothes-card-body {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 瀑布流：封面按图片自然高度展示，不再强制 1:1 */
.wardrobe-clothes-card-cover.wardrobe-waterfall-item {
  height: auto;
}
.wardrobe-waterfall-photo.wardrobe-neu-photo {
  position: relative;
  height: auto;
}
.wardrobe-waterfall-photo .wardrobe-waterfall-img.wardrobe-detail-img {
  position: static;
  inset: auto;
  width: 100%;
  height: auto;
}

/* —— 服饰封面：相框内凹（网格）；瀑布流封面见 .wardrobe-clothes-card-cover —— */
.wardrobe-page-neu .wardrobe-neu-item:not(.wardrobe-clothes-card) {
  transition: transform 0.3s ease;
}

/* 移动端弱机：drop-shadow 每层卡片双次合成，iOS 上极易掉帧 */
.wardrobe-perf-lite .wardrobe-neu-item,
.wardrobe-perf-lite .wardrobe-clothes-card.wardrobe-neu-item {
  filter: none;
  transition: none;
}

.wardrobe-perf-lite .group:hover .wardrobe-neu-item,
.wardrobe-perf-lite .group:hover .wardrobe-clothes-card.wardrobe-neu-item {
  filter: none;
}

/* 弱机：服饰封面多层 inset 阴影在 content-visibility 滚动入屏时反复重绘，iOS 掉帧主因之一。
   降级为更轻的内凹阴影，去掉昂贵的 inset 重绘层数。
   注：用两个根类组合提升特异性，确保压过下方 .wardrobe-page-neu 的重阴影规则。 */
.wardrobe-perf-lite.wardrobe-page-neu .wardrobe-neu-photo,
.wardrobe-perf-lite.wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    inset 1px 1px 4px rgba(0, 0, 0, 0.08),
    inset -1px -1px 3px rgba(255, 255, 255, 0.2);
  transition: none;
}

.dark .wardrobe-perf-lite.wardrobe-page-neu .wardrobe-neu-photo,
.dark .wardrobe-perf-lite.wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    inset 1px 1px 4px rgba(0, 0, 0, 0.28),
    inset -1px -1px 3px rgba(255, 255, 255, 0.05);
}

.wardrobe-perf-lite .wardrobe-neu-tool-orb {
  transition: none;
}

.wardrobe-perf-lite .timeline-scroll,
.wardrobe-perf-lite .wardrobe-neu-select-bar {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 弱机：角标毛玻璃逐帧回读背景，滚动时易掉帧，降级为不透明底色 */
.wardrobe-perf-lite .wardrobe-clothes-status-badge,
.wardrobe-perf-lite .wardrobe-clothes-fav-badge {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.wardrobe-perf-lite .wardrobe-clothes-status-badge {
  background: rgba(255, 255, 255, 0.94);
}

.dark .wardrobe-perf-lite .wardrobe-clothes-status-badge {
  background: rgba(44, 46, 54, 0.94);
}

.wardrobe-perf-lite .wardrobe-clothes-fav-badge {
  background: rgba(255, 251, 235, 0.96);
}

.dark .wardrobe-perf-lite .wardrobe-clothes-fav-badge {
  background: rgba(69, 45, 12, 0.92);
}

/* 弱机：多选蒙版的 backdrop-blur 同样昂贵，去掉模糊仅保留半透明遮罩。 */
.wardrobe-perf-lite .wardrobe-select-sort-mask {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.wardrobe-page-neu .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.34);
  transition: box-shadow 0.28s ease;
}

.dark .wardrobe-page-neu .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 10px rgba(0, 0, 0, 0.4),
    inset -1px -1px 5px rgba(255, 255, 255, 0.06);
}

.wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.38);
}

.dark .wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    inset 2px 2px 11px rgba(0, 0, 0, 0.42),
    inset -1px -1px 5px rgba(255, 255, 255, 0.07);
}

/* —— 服饰状态 / 喜爱评级角标：参考展馆 scene-link-detail-tag —— */
.wardrobe-page-neu .wardrobe-clothes-status-badge {
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.18rem 0.45rem;
  border-radius: 9999px;
  backdrop-filter: blur(8px) saturate(1.08);
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  border: 1px solid transparent;
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.wardrobe-page-neu .wardrobe-clothes-status-badge--violet {
  color: rgb(91 33 182);
  background: color-mix(in srgb, #8b5cf6 14%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #8b5cf6 24%, transparent);
}

.dark .wardrobe-page-neu .wardrobe-clothes-status-badge--violet {
  color: rgb(216 180 254);
  background: color-mix(in srgb, #6d28d9 30%, rgba(44, 46, 54, 0.82));
  border-color: color-mix(in srgb, #8b5cf6 32%, transparent);
}

.wardrobe-page-neu .wardrobe-clothes-status-badge--amber {
  color: rgb(146 64 14);
  background: color-mix(in srgb, #f59e0b 16%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #f59e0b 30%, transparent);
}

.dark .wardrobe-page-neu .wardrobe-clothes-status-badge--amber {
  color: rgb(253 230 138);
  background: color-mix(in srgb, #d97706 28%, rgba(44, 46, 54, 0.82));
  border-color: color-mix(in srgb, #f59e0b 35%, transparent);
}

.wardrobe-page-neu .wardrobe-clothes-status-badge--emerald {
  color: rgb(6 95 70);
  background: color-mix(in srgb, #10b981 14%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #10b981 26%, transparent);
}

.dark .wardrobe-page-neu .wardrobe-clothes-status-badge--emerald {
  color: rgb(167 243 208);
  background: color-mix(in srgb, #059669 28%, rgba(44, 46, 54, 0.82));
  border-color: color-mix(in srgb, #10b981 32%, transparent);
}

.wardrobe-page-neu .wardrobe-clothes-fav-badge {
  padding: 0.16rem 0.38rem;
  border-radius: 9999px;
  background: color-mix(in srgb, #f59e0b 14%, rgba(255, 255, 255, 0.78));
  border: 1px solid color-mix(in srgb, #f59e0b 28%, transparent);
  backdrop-filter: blur(8px) saturate(1.08);
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.18s ease;
}

.dark .wardrobe-page-neu .wardrobe-clothes-fav-badge {
  background: color-mix(in srgb, #d97706 26%, rgba(44, 46, 54, 0.82));
  border-color: color-mix(in srgb, #f59e0b 34%, transparent);
}

.wardrobe-page-neu .group:hover .wardrobe-clothes-fav-badge {
  transform: scale(1.04);
  box-shadow:
    3px 3px 8px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.wardrobe-page-neu .wardrobe-clothes-fav-badge__num {
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: rgb(180 83 9);
}

.dark .wardrobe-page-neu .wardrobe-clothes-fav-badge__num {
  color: rgb(252 211 77);
}

.wardrobe-page-neu .wardrobe-clothes-fav-badge__star {
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
  color: rgb(217 119 6);
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.55));
}

@media (max-width: 767px) {
  .wardrobe-page-neu .wardrobe-clothes-fav-badge__num {
    font-size: 0.5625rem;
  }

  .wardrobe-page-neu .wardrobe-clothes-fav-badge__star {
    width: 0.5625rem;
    height: 0.5625rem;
  }

  .wardrobe-page-neu .wardrobe-clothes-status-badge {
    font-size: 0.5625rem;
    padding: 0.14rem 0.38rem;
  }

  .wardrobe-page-neu .wardrobe-clothes-fav-badge {
    padding: 0.12rem 0.32rem;
  }
}

.dark .wardrobe-page-neu .wardrobe-clothes-fav-badge__star {
  color: rgb(252 211 77);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.wardrobe-perf-lite .group:hover .wardrobe-clothes-fav-badge {
  transform: none;
}

/* 多选方块：凸起 / 选中略压实 */
.wardrobe-page-neu .wardrobe-neu-clothes-check {
  box-shadow:
    3px 3px 8px rgba(0, 0, 0, 0.12),
    -2px -2px 7px rgba(255, 255, 255, 0.88),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.dark .wardrobe-page-neu .wardrobe-neu-clothes-check {
  box-shadow:
    3px 4px 10px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.wardrobe-page-neu .wardrobe-neu-clothes-check.bg-qhx-primary {
  box-shadow:
    3px 4px 10px rgba(0, 0, 0, 0.2),
    -1px -1px 4px rgba(255, 255, 255, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

/* —— 工具条 / 标题区 / 卡片角标：圆形软钮 —— */
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

.wardrobe-page-neu .wardrobe-neu-tool-badge {
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.dark .wardrobe-page-neu .wardrobe-neu-tool-badge {
  box-shadow:
    2px 3px 8px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

/* 多选底栏：轻量顶高光即可 */
.wardrobe-page-neu .wardrobe-neu-select-bar {
  box-shadow:
    0 -8px 22px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.dark .wardrobe-page-neu .wardrobe-neu-select-bar {
  box-shadow:
    0 -10px 26px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

/* iOS 浏览器 100vh 滚动条修复：使用 dvh 和 -webkit-fill-available */
.wardrobe-list-height {
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
}

.content-area-height {
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.content-area-height::-webkit-scrollbar {
  display: none;
}

@supports (-webkit-touch-callout: none) {
  .wardrobe-list-height,
  .content-area-height {
    min-height: -webkit-fill-available;
  }
}

/* 多选模式底部栏：自下而上滑入/滑出 */
.select-bar-enter-active,
.select-bar-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
.select-bar-enter-from,
.select-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 安全区：底部栏预留 iPhone 刘海等 */
.safe-area-pb {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

/* —— 衣橱时间轴：黑白灰 + 左下叠卡 —— */
.timeline-scroll {
  background-image:
    radial-gradient(ellipse 100% 45% at 50% -8%, rgba(0, 0, 0, 0.04), transparent 52%),
    radial-gradient(ellipse 70% 35% at 85% 55%, rgba(0, 0, 0, 0.025), transparent 42%);
}

.dark .timeline-scroll {
  background-image:
    radial-gradient(ellipse 100% 45% at 50% -8%, rgba(255, 255, 255, 0.03), transparent 52%),
    radial-gradient(ellipse 70% 35% at 85% 55%, rgba(255, 255, 255, 0.02), transparent 42%);
}

/* 固定 3:4 画幅，整体略缩小更精致 */
.timeline-tarot--sm {
  width: 84px;
  max-width: min(23vw, 92px);
}

@media (min-width: 640px) {
  .timeline-tarot--sm {
    width: 92px;
    max-width: 92px;
  }
}

.timeline-tarot-frame {
  border-radius: 7px;
  border: 1.5px solid #000000;
  background: #ffffff;
  padding: 0;
  box-shadow:
    5px 6px 14px rgba(0, 0, 0, 0.12),
    -4px -4px 11px rgba(255, 255, 255, 0.65),
    0 3px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.dark .timeline-tarot-frame {
  border-color: #ffffff;
  border-width: 1.5px;
  background: #171717;
  box-shadow:
    5px 6px 16px rgba(0, 0, 0, 0.55),
    -3px -3px 10px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

/* 卡组：多层外阴影 + 轻微内缘高光，叠放时更有厚度 */
.timeline-tarot-frame--deck {
  transition: box-shadow 0.22s ease;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 4px 10px rgba(0, 0, 0, 0.1),
    0 10px 24px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.04) inset;
}

.dark .timeline-tarot-frame--deck {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.55),
    0 6px 18px rgba(0, 0, 0, 0.55),
    0 14px 36px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
}

.timeline-tarot-inner {
  overflow: hidden;
  border-radius: 5px;
  background: #ffffff;
}

.dark .timeline-tarot-inner {
  background: #171717;
}

.timeline-tarot-image-wrap {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 133.333%;
  overflow: hidden;
}
@supports (aspect-ratio: 1) {
  .timeline-tarot-image-wrap {
    height: auto;
    padding-bottom: 0;
    aspect-ratio: 3 / 4;
  }
}

/* 透明遮罩盖在图片上拦截触摸，避免长按命中 <img> 触发系统菜单；配合 CSS 与 @contextmenu.prevent */
.wardrobe-img-touch-shield {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(255, 255, 255, 0.001);
  pointer-events: auto;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}

/* 排序模式：遮罩穿透命中，便于 QhxSortableList 的指针拖拽与落点检测 */
.wardrobe-img-touch-shield--sorting {
  pointer-events: none !important;
  touch-action: auto;
}

/* 多选模式：封面排序序号蒙版 */
.wardrobe-select-sort-mask {
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(1px);
}

.wardrobe-select-sort-mask--selected {
  background: rgba(0, 0, 0, 0.55);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.85);
}

.wardrobe-select-sort-no {
  font-size: clamp(1.25rem, 8vw, 2rem);
  line-height: 1;
}

.wardrobe-detail-img {
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.timeline-tarot-image-wrap .timeline-tarot-img {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.timeline-tarot:hover .timeline-tarot-img {
  transform: scale(1.03);
}

.timeline-tarot-vignette {
  pointer-events: none;
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}

.dark .timeline-tarot-vignette {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.timeline-tarot-caption {
  border-top: 1px solid #000000;
  padding: 4px 5px 5px;
  background: #fafafa;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
}

.dark .timeline-tarot-caption {
  border-top-color: #ffffff;
  background: #262626;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.25);
}

.timeline-tarot-caption--deck {
  padding: 3px 4px 4px;
}

.timeline-deck-card {
  transform-origin: left bottom;
}

.timeline-deck-card:hover {
  z-index: 50 !important;
  filter: brightness(1.04);
}

.timeline-deck-card:hover .timeline-tarot-frame--deck {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.14),
    0 8px 18px rgba(0, 0, 0, 0.14),
    0 16px 36px rgba(0, 0, 0, 0.16),
    0 0 0 1px rgba(0, 0, 0, 0.05) inset;
}

.dark .timeline-deck-card:hover .timeline-tarot-frame--deck {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.65),
    0 10px 28px rgba(0, 0, 0, 0.65),
    0 22px 48px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
}

/* 扇形展开：尺寸固定，扇形由 transform 溢出；展开层用 fixed + 占位，不再在此处放大容器 */

.timeline-deck-card--fan {
  transition:
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.35s ease,
    box-shadow 0.35s ease;
}

/* 时间轴：扇形展开时卷轴内暗角遮罩 */
.timeline-deck-backdrop-enter-active,
.timeline-deck-backdrop-leave-active {
  transition: opacity 0.32s ease-out;
}

.timeline-deck-backdrop-enter-from,
.timeline-deck-backdrop-leave-to {
  opacity: 0;
}

/* 攒钱计划抽屉：遮罩淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.28s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 拟态时间线：贴边、紧凑、柔渐变 + 双阴影层次 */
.plan-neu-drawer {
  --plan-neu-bg: #e4e9f0;
  --plan-neu-bg-mid: #dde4ee;
  --plan-neu-bg-deep: #cbd4e2;
  --plan-neu-highlight: rgba(255, 255, 255, 0.72);
  --plan-neu-text: rgb(55 65 81);
  --plan-neu-accent: #10b981;
  padding: 0;
  margin: 0;
  border-radius: 0;
  background:
    linear-gradient(165deg, var(--plan-neu-bg) 0%, var(--plan-neu-bg-mid) 48%, var(--plan-neu-bg) 100%),
    var(--plan-neu-bg);
  box-shadow:
    inset 1px 0 0 var(--plan-neu-highlight),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  color: var(--plan-neu-text);
}

.dark .plan-neu-drawer {
  --plan-neu-bg: #262d3a;
  --plan-neu-bg-mid: #222933;
  --plan-neu-bg-deep: #181d26;
  --plan-neu-highlight: rgba(255, 255, 255, 0.06);
  --plan-neu-text: rgb(229 231 235);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: var(--plan-neu-text);
}

.plan-neu-header {
  padding: 6px 6px 4px;
  margin: 0;
  background: transparent;
}

.plan-neu-title {
  color: var(--plan-neu-text);
  letter-spacing: -0.02em;
}

.plan-neu-stats {
  padding: 0 4px;
}

.plan-neu-scroll {
  -webkit-overflow-scrolling: touch;
  padding: 0 4px 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.plan-neu-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.plan-neu-stat {
  background: linear-gradient(145deg, var(--plan-neu-bg), var(--plan-neu-bg-mid));
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow:
    3px 3px 8px rgba(163, 177, 198, 0.38),
    -2px -2px 7px rgba(255, 255, 255, 0.75),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .plan-neu-stat {
  background: linear-gradient(145deg, var(--plan-neu-bg), var(--plan-neu-bg-mid));
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.32),
    -2px -2px 6px rgba(255, 255, 255, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.plan-neu-stat-label {
  font-size: 9px;
  letter-spacing: 0.05em;
  opacity: 0.52;
  margin-bottom: 2px;
}

.plan-neu-stat-value {
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--plan-neu-text);
}

.plan-neu-stat-mono {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.plan-neu-stat-sep {
  opacity: 0.42;
  margin: 0 2px;
}

.plan-neu-timeline {
  padding: 2px 0 2px 0;
  min-height: 0;
}

.plan-neu-list {
  padding-left: 0;
}

.plan-neu-rail {
  position: absolute;
  left: 9px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 999px;
  background: var(--plan-neu-bg-deep);
  box-shadow:
    inset 1.5px 1.5px 4px rgba(0, 0, 0, 0.14),
    inset -1px -1px 3px rgba(255, 255, 255, 0.28);
}

.dark .plan-neu-rail {
  box-shadow:
    inset 1.5px 1.5px 5px rgba(0, 0, 0, 0.5),
    inset -1px -1px 3px rgba(255, 255, 255, 0.05);
}

.plan-neu-node-col {
  width: 20px;
  min-width: 20px;
  padding-top: 10px;
}

.plan-neu-node {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--plan-neu-highlight), var(--plan-neu-bg));
  box-shadow:
    2px 2px 5px rgba(163, 177, 198, 0.42),
    -1.5px -1.5px 4px rgba(255, 255, 255, 0.85);
  z-index: 1;
  flex-shrink: 0;
}

.dark .plan-neu-node {
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), var(--plan-neu-bg));
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.38),
    -1.5px -1.5px 4px rgba(255, 255, 255, 0.04);
}

.plan-neu-node--done {
  background: linear-gradient(145deg, #3ee8b3, var(--plan-neu-accent));
  box-shadow:
    2px 2px 5px rgba(16, 185, 129, 0.35),
    -1px -1px 3px rgba(255, 255, 255, 0.2);
}

.plan-neu-card {
  border-radius: 11px;
  padding: 6px 8px;
  background: linear-gradient(160deg, var(--plan-neu-bg) 0%, var(--plan-neu-bg-mid) 100%);
  box-shadow:
    3px 3px 9px rgba(163, 177, 198, 0.4),
    -2px -2px 8px rgba(255, 255, 255, 0.78),
    inset 0 1px 0 rgba(255, 255, 255, 0.48);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.plan-neu-card:hover {
  box-shadow:
    4px 4px 11px rgba(163, 177, 198, 0.45),
    -3px -3px 9px rgba(255, 255, 255, 0.82),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .plan-neu-card {
  box-shadow:
    3px 3px 11px rgba(0, 0, 0, 0.32),
    -2px -2px 7px rgba(255, 255, 255, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.dark .plan-neu-card:hover {
  box-shadow:
    4px 4px 14px rgba(0, 0, 0, 0.38),
    -2px -2px 8px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.plan-neu-thumb {
  border-radius: 8px;
  box-shadow:
    inset 1.5px 1.5px 4px rgba(0, 0, 0, 0.14),
    inset -1px -1px 3px rgba(255, 255, 255, 0.22);
}

.plan-neu-thumb--round {
  border-radius: 50%;
  flex-shrink: 0;
  aspect-ratio: 1;
}

/* 已开始（创建时间已到）：标题红字 */
/* 已开始：标题与时间（红字，与 planRowHasStarted 一致） */
.plan-neu-started-text {
  color: #dc2626 !important;
}

.dark .plan-neu-started-text {
  color: #f87171 !important;
}

/* 未完成：尾款倒计时条（拟态凹槽 + 紧迫色） */
.plan-neu-balance {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: #1d4ed8;
  background: linear-gradient(
    165deg,
    rgba(219, 234, 254, 0.65),
    rgba(191, 219, 254, 0.35)
  );
  box-shadow:
    inset 2px 2px 5px rgba(163, 177, 198, 0.45),
    inset -1px -1px 4px rgba(255, 255, 255, 0.65),
    0 1px 0 rgba(255, 255, 255, 0.35);
}

.plan-neu-balance-icon {
  width: 14px;
  height: 14px;
  opacity: 0.88;
}

.plan-neu-balance-text {
  flex: 1;
  min-width: 0;
}

.plan-neu-balance-date {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.45);
  box-shadow:
    inset 1px 1px 2px rgba(0, 0, 0, 0.06),
    0 1px 0 rgba(255, 255, 255, 0.5);
}

.plan-neu-balance--urgent {
  color: #b45309;
  background: linear-gradient(
    165deg,
    rgba(254, 243, 199, 0.85),
    rgba(253, 230, 138, 0.45)
  );
  box-shadow:
    inset 2px 2px 6px rgba(180, 83, 9, 0.12),
    inset -1px -1px 4px rgba(255, 255, 255, 0.55),
    0 0 0 1px rgba(245, 158, 11, 0.22);
}

.plan-neu-balance--urgent .plan-neu-balance-date {
  background: rgba(255, 247, 237, 0.7);
  color: #9a3412;
}

.plan-neu-balance--muted {
  font-weight: 600;
  color: var(--plan-neu-text);
  opacity: 0.72;
  background: var(--plan-neu-bg-deep);
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.08),
    inset -1px -1px 3px rgba(255, 255, 255, 0.25);
}

.dark .plan-neu-balance {
  color: #93c5fd;
  background: linear-gradient(
    165deg,
    rgba(30, 58, 138, 0.35),
    rgba(37, 99, 235, 0.15)
  );
  box-shadow:
    inset 2px 2px 8px rgba(0, 0, 0, 0.35),
    inset -1px -1px 3px rgba(255, 255, 255, 0.05);
}

.dark .plan-neu-balance--urgent {
  color: #fcd34d;
  background: linear-gradient(
    165deg,
    rgba(120, 53, 15, 0.45),
    rgba(180, 83, 9, 0.22)
  );
  box-shadow:
    inset 2px 2px 8px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(245, 158, 11, 0.18);
}

.dark .plan-neu-balance--muted {
  opacity: 0.65;
  color: var(--plan-neu-text);
}

.dark .plan-neu-balance-date {
  background: rgba(0, 0, 0, 0.2);
  box-shadow:
    inset 1px 1px 2px rgba(0, 0, 0, 0.25),
    0 1px 0 rgba(255, 255, 255, 0.05);
}

.plan-neu-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  line-height: 1.3;
  border-radius: 999px;
  color: #047857;
  background: linear-gradient(145deg, rgba(209, 250, 229, 0.55), var(--plan-neu-bg-deep));
  box-shadow:
    inset 1px 1px 2px rgba(0, 0, 0, 0.06),
    1px 1px 2px rgba(255, 255, 255, 0.2);
}

.dark .plan-neu-badge {
  color: #6ee7b7;
  background: linear-gradient(145deg, rgba(16, 185, 129, 0.2), var(--plan-neu-bg-deep));
}

.plan-neu-loadmore {
  font-size: 11px;
  font-weight: 700;
  padding: 7px 16px;
  border-radius: 999px;
  background: linear-gradient(145deg, var(--plan-neu-bg), var(--plan-neu-bg-mid));
  color: var(--plan-neu-text);
  box-shadow:
    3px 3px 8px rgba(163, 177, 198, 0.38),
    -2px -2px 7px rgba(255, 255, 255, 0.75);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.plan-neu-loadmore:active:not(:disabled) {
  box-shadow:
    inset 2px 2px 5px rgba(163, 177, 198, 0.45),
    inset -1px -1px 3px rgba(255, 255, 255, 0.5);
  transform: scale(0.98);
}

.plan-neu-loadmore:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dark .plan-neu-loadmore {
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.32),
    -2px -2px 6px rgba(255, 255, 255, 0.03);
}

.dark .plan-neu-loadmore:active:not(:disabled) {
  box-shadow:
    inset 2px 2px 6px rgba(0, 0, 0, 0.45),
    inset -1px -1px 3px rgba(255, 255, 255, 0.04);
}

.plan-neu-icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  flex-shrink: 0;
  background: linear-gradient(145deg, var(--plan-neu-bg), var(--plan-neu-bg-mid));
  color: var(--plan-neu-text);
  box-shadow:
    3px 3px 8px rgba(163, 177, 198, 0.38),
    -2px -2px 7px rgba(255, 255, 255, 0.78);
  transition: box-shadow 0.15s ease;
}

.plan-neu-icon-btn:active {
  box-shadow:
    inset 2px 2px 5px rgba(163, 177, 198, 0.42),
    inset -1px -1px 3px rgba(255, 255, 255, 0.45);
}

.dark .plan-neu-icon-btn {
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.32),
    -2px -2px 6px rgba(255, 255, 255, 0.03);
}

.dark .plan-neu-icon-btn:active {
  box-shadow:
    inset 2px 2px 6px rgba(0, 0, 0, 0.45),
    inset -1px -1px 3px rgba(255, 255, 255, 0.04);
}

:global(.toolbar-config-ghost) {
  opacity: 0.45;
}

:global(.toolbar-config-chosen) {
  border-radius: 0.5rem;
}

:global(.toolbar-config-dragging) {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

</style>
