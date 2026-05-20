<script setup lang="ts">
import type { Wardrobe, PaginationResponse, WardrobeClothes, UserDeco } from '@/types/api';
import { getUserDecoBadges } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import { getWardrobeList, getClothesList, sortClothee, changeWardrobeClothes, changeWardrobeClothesBatch, deleteClothesByIds, updateClothesIds, checkWadrobePassword, sortWardrobe, updateWardrobe, deleteWardrobe } from '@/api/wardrobe'
import { getPlanListWardrobe, planComplete } from '@/api/plan'
import type { ClothesParams } from '@/api/wardrobe'
import Draggable from "vuedraggable"
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import { useMatchingDraftStore } from '@/stores/matchingDraft'
import { useFlyToButton } from '~/composables/useFlyToButton'
import { BASE_IMG } from '@/utils/ipConfig'

const wardrobeStore = useWardrobeStore()
const user = useUserStore()
const matchingDraftStore = useMatchingDraftStore()
const config = useConfigStore()
const route = useRoute()
const id = route.params.id as string
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
const tagList = ref<Array<string>>([])
const isSorting = ref(false) // loading 状态
const show = ref(true)
const sortMode = ref(false)
// 搭配模式：与排序互斥，开启后服饰卡片右上角显示加号，可添加进搭配草稿
const matchingMode = ref(false)
// 多选模式：与排序、搭配互斥，开启后服饰卡片右上角显示选择框，可批量操作
const selectMode = ref(false)
/** 时间轴全屏视图：列表按加入衣柜时间排序 */
const timelineMode = ref(false)
const selectedClothesIds = ref<Set<number>>(new Set())
const showMatchingDrawer = ref(false)
const info = ref<Wardrobe | null>(null)
const router = useRouter()
const showPassword = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const password = ref<string>('')
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

// 传入颜色（十六进制）和透明度转换为十六进制颜色
const hexColor = (color: string, opacity: number) => {
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  console.log(`rgba(${r}, ${g}, ${b}, ${opacity})`, '返回的颜色')
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
const opearClothesId = ref<number | null>(null)
let oldList: { clothes_id: number; sort: number }[] = [];
const record = ref<Wardrobe | null>(null)
import WardrobeClothesLongShare from '@/components/Wardrobe/WardrobeClothesLongShare.vue'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import type WardrobeAddEdit from '@/components/Wardrobe/WardrobeAddEdit.vue'
import type WardrobeSearch from '@/components/Wardrobe/WardrobeSearch.vue'
import type WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import type MatchingAddEdit from '@/components/matching/MatchingAddEdit.vue'
import dayjs from 'dayjs'
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const toast = useToast()

const showBatchStatusModal = ref(false)
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
  clothes_note: '' as string
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

const addEditWardrobeRef = ref<InstanceType<typeof WardrobeAddEdit> | null>(null)
const wardrobeSearchRef = ref<InstanceType<typeof WardrobeSearch> | null>(null)
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEdit> | null>(null)
const matchingBtnRef = ref<HTMLElement | null>(null)
const { flyToTarget } = useFlyToButton()

// 判断是否为移动端
const isMobile = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})

const planTimelineDrawerDefaultSize = computed(() => {
  if (typeof window === 'undefined') return 400
  return isMobile.value ? Math.min(360, window.innerWidth - 24) : 400
})

// 衣柜状态标签背景颜色映射，便于扩展新状态
const WARDROBE_STATUS_BG_MAP: Record<string, string> = {
  待补款: 'bg-amber-500',
  已拥有: 'bg-emerald-500',
  // 可在此扩展: 已出: 'bg-gray-500', 等等
}

function getWardrobeStatusBgClass(status: string | null | undefined): string {
  if (!status) return 'bg-qhx-primary'
  return WARDROBE_STATUS_BG_MAP[status] ?? 'bg-qhx-primary'
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
  return count
})

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
    pageSize: 999
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
        isLoading.value = true
        page.value = 1
        fetchClothesList()
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
    clothes_note: ''
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
  if (isLoading.value) return
  if (Number.parseInt(id) !== user.user?.user_id && item.password) {
    if (password.value || password.value === '') {
      showPassword.value = true
    }
    record.value = item
    return
  }
  currentWardrobe.value = item
  isLoading.value = true
  page.value = 1
  initFilter()
  selectMode.value = false
  selectedClothesIds.value = new Set()
  fetchClothesList()
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
  if (!currentWardrobe.value || !currentWardrobe.value.wardrobe_id) return
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
  try {
    const response = await getClothesList(params)
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
    total.value = response.count
    if (response.info) {
      info.value = response.info
    }
    console.log(response, '衣柜返回值')
  } catch (error) {

  }
  isLoading.value = false

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
const showAddClothes = () => {
  if (addEditClothesRef.value) {
    addEditClothesRef.value.showModel(currentWardrobe.value)
  }
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
const onDragStart = (e) => {
  oldList = list.value.map((item, index) => ({ clothes_id: item.clothes_id, sort: item.sort || index }));
};
const onDragEnd = async (e: any) => {
  if (isSorting.value) return; // 防止重复提交
  isSorting.value = true;
  console.log('拖拽结束', opearClothesId.value)
  // 获取正在拖拽的服饰ID
  const clothesId = e.originalEvent.target.dataset.clothesId
  if (e.originalEvent.type === 'touchend' && e.originalEvent.changedTouches.length > 0) {
    const touch = e.originalEvent.changedTouches[0];
    console.log('touch', touch)
    const clientX = touch.clientX
    const clientY = touch.clientY
    const wardrobeId = getWardrobeIdByPoint(clientX, clientY)
    if (wardrobeId && wardrobeId !== currentWardrobe.value?.wardrobe_id && opearClothesId.value) {
      console.log('是衣柜', wardrobeId)
      await fetchWardrobeClothes(opearClothesId.value, wardrobeId)
      return
    }
  } else {
    const isWardrobe = e.originalEvent.target.className.includes('wardrobe-name')
    if (isWardrobe) {
      const wardrobeId = e.originalEvent.target.dataset.wardrobeId
      console.log('是衣柜', wardrobeId)
      if (wardrobeId !== currentWardrobe.value?.wardrobe_id && opearClothesId.value) {
        await fetchWardrobeClothes(opearClothesId.value, wardrobeId)
        return
      }
    }
  }
  try {
    // 找出变化的元素
    const changed: { clothes_id: number; sort: number }[] = [];

    list.value.forEach((item, newIndex) => {
      const oldItem = oldList[newIndex];

      // 如果当前位置的 id 不一样，说明发生了位置变化
      if (!oldItem || item.clothes_id !== oldItem.clothes_id) {
        changed.push({
          clothes_id: item.clothes_id,
          // 取 "变化前同一位置的 sort"
          sort: oldItem?.sort ?? item.sort,
        });
      }
    });

    if (changed.length > 0 && currentWardrobe.value) {
      if (!currentWardrobe.value.wardrobe_id) return
      const params = {
        wardrobe_id: currentWardrobe.value?.wardrobe_id,
        sort: changed.map((item) => ({
          clothes_id: item.clothes_id,
          sort: item.sort,
        })),
      };

      await sortClothee(params);
      // useToast().success("排序已更新")
    }
  } catch (error) {
    console.error("排序更新失败:", error);
    // useToast().error("排序更新失败")
  } finally {
    isSorting.value = false;
  }
};
const loadMore = () => {
  if (timelineMode.value) return
  console.log('是否在加载', isLoading.value)
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}
// 页码改变处理函数
const handlePageChange = async (current: number) => {
  page.value = current
  try {
    await fetchClothesList()
  } catch (error) {
    page.value -= 1
  }
}
const reload = async () => {
  const sz = timelineMode.value ? TIMELINE_PAGE_SIZE : pageSize * page.value
  fetchClothesList(1, sz)
}
const reloadWardrobe = () => {
  reload()
  wardrobeStore.getWardrobeConfig()
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
    5: '穿着次数倒叙'
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
  { label: '穿着次数倒叙', value: 5 }
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
  () => user.user?.message_config,
  () => {
    syncWardrobeAsHomeToggleFromUser()
  },
  { immediate: true, deep: true }
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
  const cfg = info.value?.config ?? currentWardrobe.value?.config
  return cfg?.open_danmu === 1
})

// 自定义主题样式
const customStyle = computed(() => {
  if (!info.value?.custom_style) return null
  const style = info.value.custom_style

  return {
    background: `${info.value?.background
      ? `linear-gradient(
          ${hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)},
          ${hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)}
        ),
        url(${BASE_IMG + info.value.background}) ${style.back_mode ? 'center/cover no-repeat' : 'repeat'}
      `
      : hexColor(style.backColor || '#ffffff', style.back_opacity ?? 1)
    }`,
    btnColor: style.btnColor || undefined,
    backColor: style.backColor || undefined,
    back_mode: style.back_mode ?? undefined,
    fontColor: style.fontColor || undefined,
    back_opacity: style.back_opacity ?? undefined,
    btnFontColor: style.btnFontColor || undefined
  }
})

// 是否有自定义主题
const hasCustomStyle = computed(() => {
  return customStyle.value !== null
})

// 背景样式
const backgroundStyle = computed(() => {
  if (!hasCustomStyle.value || !customStyle.value) return {}
  const style = customStyle.value
  const opacity = style.back_opacity ?? 1
  // 解析十六进制颜色值
  const hexColor = style.backColor.replace('#', '')
  const r = parseInt(hexColor.slice(0, 2), 16)
  const g = parseInt(hexColor.slice(2, 4), 16)
  const b = parseInt(hexColor.slice(4, 6), 16)
  
  if (style.back_mode) {
    // 背景模式：直接使用背景颜色作为背景
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  } else {
    // 非背景模式：使用背景颜色作为遮罩层（覆盖在背景图片上）
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  }
})

// 文本样式
const textStyle = computed(() => {
  if (!hasCustomStyle.value || !customStyle.value) return {}
  return {
    color: customStyle.value.fontColor
  }
})

// 自定义主题按钮：有 btnColor / btnFontColor 时用内联样式覆盖默认主色
const customBtnStyle = computed(() => {
  if (!customStyle.value) return {}
  const s: Record<string, string> = {}
  if (customStyle.value.btnColor) s.backgroundColor = customStyle.value.btnColor
  if (customStyle.value.btnFontColor) s.color = customStyle.value.btnFontColor
  return s
})
const hasCustomBtnBg = computed(() => Boolean(customStyle.value?.btnColor))
const hasCustomBtnFont = computed(() => Boolean(customStyle.value?.btnFontColor))
/** 弹窗等 UButton 在存在自定义色时套用样式；切换类按钮仅激活态用 customBtnStyle */
const hasAnyCustomBtnTheme = computed(() => hasCustomBtnBg.value || hasCustomBtnFont.value)
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
// 重置筛选
const resetFilter = () => {
  filter_list.value.wardrobe_status = []
  filter_list.value.clothes_note = ''
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

const jumpToClothes = (item: WardrobeClothes) => {
  if (sortMode.value) return
  if (matchingMode.value) return
  if (selectMode.value) return
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/common/outerLink2?url=https://lolitalibrary.com/clothes/detail/${item.clothes_id}`,
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
          url: `https://lolitalibrary.com/clothes/detail/${item.clothes_id}`
        }
      }));
    } else {
      // 普通网页环境 不用新窗口
      navigateTo(`/clothes/detail/${item.clothes_id}`)
      // window.location.href = `/clothes/detail/${item.clothes_id}`
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
onMounted(async () => {
  void fetchOwnerBadges()
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleUniRefreshMessage)
  }
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  matchingDraftStore.loadFromStorage()
  setTimeout(async () => {
    await fetchWardrobeList()
    let wardrobe = null
    console.log(route.query.wardrobe_id, 'route.query')
    if (wardrobeList.value && wardrobeList.value.length > 0) {
      if (route.query.wardrobe_id) {
        const index = wardrobeList.value.findIndex((item) => { return item.wardrobe_id === Number.parseInt(route.query.wardrobe_id as string) })
        if (index !== -1) {
          wardrobe = wardrobeList.value[index]
        }
      }
      if (route.query.password) {
        password.value = route.query.password as string
        
      }
      console.log( password.value, 'password')
      if (user.user?.user_id === Number.parseInt(id)) {
        changeWardrobe(wardrobe || wardrobeList.value[0])
      } else {
        const index = wardrobeList.value.findIndex((item) => {
          return item.is_private === 0 || item.password
        })
        if (index !== -1) {
          if (wardrobe && wardrobe.is_private === 0) {
            changeWardrobe(wardrobe)
          } else {
            changeWardrobe(wardrobeList.value[index])
          }
        }
      }

    }

    if (user.user?.user_id === Number.parseInt(id)) {
      wardrobeStore.getWardrobeConfig()
    }
  });
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleUniRefreshMessage)
  }
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
}

// 收缩展开状态: 0=全部展开, 1=左侧收起, 2=左侧+上方收起
const collapseState = ref(0)
const toggleCollapse = () => {
  collapseState.value = (collapseState.value + 1) % 3
}

const toggleTimelineMode = async () => {
  const next = !timelineMode.value
  if (next) {
    sortMode.value = false
    matchingMode.value = false
    selectMode.value = false
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

// 搭配模式、排序、多选互斥
const toggleMatchingMode = () => {
  matchingMode.value = !matchingMode.value
  if (matchingMode.value) {
    sortMode.value = false
    selectMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const toggleSortMode = () => {
  sortMode.value = !sortMode.value
  if (sortMode.value) {
    matchingMode.value = false
    selectMode.value = false
    selectedClothesIds.value = new Set()
  }
}
const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    sortMode.value = false
    matchingMode.value = false
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

const showLongShareModal = ref(false)

function openLongShareModal() {
  if (!currentWardrobe.value?.wardrobe_id || !info.value) {
    toast.add({ title: '请先选择衣柜', color: 'amber', icon: 'i-heroicons-information-circle' })
    return
  }
  showLongShareModal.value = true
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

  <div class="wardrobe-wrap wardrobe-page-neu text-qhx-text" :style="{ 
    background: customStyle?.background,
    backgroundPosition: 'center',
    color: customStyle?.fontColor || 'inherit',
    }">
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
    <clothes-add ref="addEditClothesRef" @success="reloadWardrobe"></clothes-add>
    <wardrobe-add-edit ref="addEditWardrobeRef" @success="onWardrobeEditSuccess"></wardrobe-add-edit>
    <AchievementDecoConfigModal
      v-if="isWardrobeOwner && currentWardrobe?.wardrobe_id"
      v-model="wardrobeDecoModalOpen"
      :trigger-position="wardrobeDecoModalPosition"
      :initial-selected-ids="wardrobeDecoInitialSelectedIds"
      :wardrobe-id="currentWardrobe.wardrobe_id"
      @saved="onWardrobeDecoSaved"
    />
    <matching-add-edit ref="matchingAddEditRef" @success="matchingDraftStore.clear" />
    <QhxModal v-model="showLongShareModal">
      <div
        class="flex max-h-[90vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl bg-[#ebe3e8] shadow-2xl dark:bg-[#241d26]"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-pink-200/40 px-4 py-3 dark:border-pink-900/35"
        >
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">衣柜长图分享</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showLongShareModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <WardrobeClothesLongShare
            v-if="currentWardrobe?.wardrobe_id && info"
            :wardrobe-id="currentWardrobe.wardrobe_id"
            :info="info"
            :filter-list="filter_list"
            :password="password"
            :timeline-mode="timelineMode"
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

        <!-- 星系选项 -->
        <button @click="jumpToVisualization"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
            :class="!hasCustomBtnBg && 'bg-gradient-to-br from-purple-500 to-pink-500'"
            :style="customBtnStyle"
          >
            <UIcon name="material-symbols:auto-awesome" class="text-base" :class="!hasCustomBtnFont && 'text-white'" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">星系</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看衣柜可视化</div>
          </div>
        </button>

        <!-- 搭配清单选项 -->
        <button @click="jumpToMatchingList"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
            :class="!hasCustomBtnBg && 'bg-gradient-to-br from-amber-500 to-orange-500'"
            :style="customBtnStyle"
          >
            <UIcon name="material-symbols:style" class="text-base" :class="!hasCustomBtnFont && 'text-white'" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">搭配清单</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看我的所有搭配</div>
          </div>
        </button>

        <!-- 定制计划选项 -->
        <button @click="jumpToPlan"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
            :class="!hasCustomBtnBg && 'bg-gradient-to-br from-blue-500 to-cyan-500'"
            :style="customBtnStyle"
          >
            <UIcon name="material-symbols:calendar-month" class="text-base" :class="!hasCustomBtnFont && 'text-white'" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">定制计划</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">查看攒钱计划列表</div>
          </div>
        </button>
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
        <div class="min-h-0 overflow-hidden">
    <div class="rounded-2xl flex">
      <div
        class="wardrobe-list wardrobe-neu-sidebar wardrobe-list-height rounded-[10px] flex-shrink-0 transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="collapseState >= 1 ? 'w-0 min-w-0 overflow-hidden' : 'w-[180px] max-md:w-[20vw] overflow-y-auto'">
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        
        <div v-if="user.user?.user_id === Number.parseInt(id)" class="flex flex-col items-center py-2 gap-1.5">
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5  cursor-pointer" @click="showAddWardrobe($event)">
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                :style="customBtnStyle"
              >
                <UIcon name="material-symbols:add-2" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">新建衣柜</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="openWardrobeSearch()">
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                :style="customBtnStyle"
              >
                <UIcon name="i-heroicons-magnifying-glass" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">搜索</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
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
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="toggleTimelineMode">
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center transition-colors duration-300"
                :class="[
                  timelineMode
                    ? [
                        !hasCustomBtnBg && 'bg-qhx-primary ring-2 ring-qhx-primary/40 ring-offset-1 ring-offset-transparent',
                        !hasCustomBtnFont && 'text-white',
                      ]
                    : [!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white'],
                ]"
                :style="timelineMode ? customBtnStyle : {}"
              >
                <UIcon name="material-symbols:view-timeline" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">时间轴</div>
            </div>
          </QhxJellyButton>
          <QhxJellyButton>
            <div class="h-[46px] text-center px-0.5 cursor-pointer" @click="openWardrobeStatistics">
              <div
                class="wardrobe-neu-tool-orb my-[3px] mx-auto rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                :class="[!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                :style="customBtnStyle"
              >
                <UIcon name="material-symbols:bar-chart-4-bars" class="text-[16px]" />
              </div>
              <div class="text-xs text-qhx-text">统计</div>
            </div>
          </QhxJellyButton>
        </div>
        <Draggable :forceFallback="true" :delay="150" :disabled="!sortMode" v-model="wardrobeList" item-key="wardrobe_id" animation="250" ghost-class="drag-ghost"
          chosen-class="drag-chosen" drag-class="dragging" @end="onWardrobeDragEnd">
          <template #item="{ element }">
            <transition-group tag="div" name="list">
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
            </transition-group>
          </template>
        </Draggable>
      </div>
      <div class="flex-1 content-area-height overflow-y-auto overflow-x-hidden">
        <!-- 状态栏高度占位 -->
        <div v-if="configStore.statusBarHeight > 0" :style="{ height: `${configStore.statusBarHeight}px` }"></div>
        <div
          v-if="info"
          class="grid transition-[grid-template-rows] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] mb-3 overflow-hidden"
          :style="{ gridTemplateRows: collapseState >= 2 ? '0fr' : '1fr' }"
        >
        <div class="relative w-full rounded-2xl overflow-hidden min-h-0">
          <!-- 半透明遮罩层 -->
          <!-- :style="currentWardrobe?.wardrobe_cover? { backgroundImage: `url(${BASE_IMG + currentWardrobe?.wardrobe_cover})`} : {}" -->
          <div class="absolute inset-0 bg-cover bg-center"></div>
          <div class="relative z-10 p-6 text-left space-y-4 max-md:p-2 mt-2">
            <div class="flex flex-col gap-2">
              <!-- 功能按钮 -->
              <div class="flex items-center justify-end gap-1 flex-wrap">
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
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="openLongShareModal">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                >
                  <UIcon name="i-heroicons-photo-20-solid" class="text-[16px]" />
                </div>
                <div class="text-xs text-qhx-text">截长图</div>
              </div>
            </QhxJellyButton>
          </div>
          <div class="flex flex-wrap gap-1">
            <QhxJellyButton>
              <div class="h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer" @click="toggleCollapse">
                <div
                  class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                  :class="[!hasCustomBtnBg && 'bg-qhx-info', !hasCustomBtnFont && 'text-white']"
                >
                  <UIcon :name="collapseState === 2 ? 'material-symbols:open-in-full' : 'material-symbols:collapse-content'" class="text-[16px] transition-transform duration-300" />
                </div>
                <div class="text-xs text-qhx-text">{{ collapseState === 2 ? '展开' : '收起' }}</div>
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
        <div class="w-full">
          <Draggable 
          :scroll="true"
          :scroll-sensitivity="150"
          :scroll-speed="15"
          :fallback-tolerance="0"
          :forceFallback="true" :delay="150" :disabled="!sortMode" @start="onDragStart" :move="() => { console.log('移动') }" @end="onDragEnd" v-model="list" item-key="id"
            animation="300" ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging"
            class=" flex flex-wrap">
            <template #item="{ element }">
              <transition-group tag="div"
                class="[@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/6 md:w-1/4 max-md:w-1/3" name="list">
                <div
                  class="group drag-handle flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]"
                  @mousedown="opearClothesId = element.clothes_id"
                  @touchstart="opearClothesId = element.clothes_id"
                  @click="selectMode ? toggleClothesSelection(element) : jumpToClothes(element)">
                  <div class="wardrobe-neu-item w-full aspect-[1/1] relative">
                    <div
                      class="absolute left-0 top-0 z-10 rounded-tl-[6px] rounded-br-[6px] px-1 py-[1px] text-[10px] leading-none text-white flex items-center"
                      :class="getWardrobeStatusBgClass(element.wardrobe_status)"
                      v-if="element.wardrobe_status">
                      {{ element.wardrobe_status }}
                    </div>
                    <!-- 多选模式：右上角选择框，点击选择/取消选择 -->
                    <div
                      v-if="selectMode && element.clothes_id"
                      class="absolute top-0 right-0 z-10  h-[32px] w-[32px] flex items-center justify-center cursor-pointer transition-all duration-200"
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
                    <!-- 搭配模式：加号添加/删除图标；非搭配模式：喜爱级别 1–5 显示角标（0 不显示） -->
                    <div
                      v-else-if="matchingMode && element.clothes_id"
                      class="absolute top-0 right-0 z-10 h-[32px] w-[32px] flex items-center justify-center cursor-pointer"
                      @click.stop="handleMatchingDraftToggle(element, $event)"
                    >
                      <div
                        class="wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center"
                        :class="matchingDraftStore.hasClothes(element.clothes_id) ? [!hasCustomBtnBg && 'bg-red-500', !hasCustomBtnFont && 'text-white'] : [!hasCustomBtnBg && 'bg-qhx-primary', !hasCustomBtnFont && 'text-white']"
                        :style="matchingDraftStore.hasClothes(element.clothes_id) ? {} : customBtnStyle"
                      >
                        <UIcon
                          :name="matchingDraftStore.hasClothes(element.clothes_id) ? 'i-heroicons-trash' : 'material-symbols:add-2'"
                          class="text-[16px]"
                        />
                      </div>
                    </div>
                    <div
                      v-else-if="getClothesFavoriteLevel(element) > 0"
                      class="absolute right-0 top-0 z-10 flex items-center gap-px rounded-tr-[6px] rounded-bl-[6px] bg-white/75 px-1 py-[1px] text-[10px] leading-none backdrop-blur-[2px] ring-1 ring-black/10 dark:bg-white/65 dark:ring-white/20"
                      @click.stop="jumpToClothes(element)"
                    >
                      <span class="tabular-nums text-amber-600 dark:text-amber-600">
                        {{ getClothesFavoriteLevel(element) }}
                      </span>
                      <UIcon
                        name="i-heroicons-star-solid"
                        class="h-[1em] w-[1em] shrink-0 text-amber-600 dark:text-amber-600"
                        aria-hidden="true"
                      />
                    </div>
                    <!-- 颜色列表圆点：封面左下角 -->
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
                        :src="`${BASE_IMG}${element.clothes_img}`"
                        draggable="false"
                        class="wardrobe-detail-img block w-full cursor-grab object-cover aspect-[1/1.5] max-md:aspect-[1/1] active:cursor-grabbing"
                        loading="lazy"
                        @contextmenu.prevent
                      />
                      <div
                        class="wardrobe-img-touch-shield"
                        :class="{ 'wardrobe-img-touch-shield--sorting': sortMode }"
                        aria-hidden="true"
                        @contextmenu.prevent
                      />
                    </div>
                  </div>
                  <div class="mt-2 mx-[2px] line-clamp-2 overflow-hidden text-sm font-medium text-center">
                    {{ element.clothes_note }}
                  </div>
                  <div v-if="element.price"
                    class="mt-2 text-sm text-qhx-primary font-medium text-center w-[120px] line-clamp-2 overflow-hidden">
                    ￥ {{ info?.show_price === 2 ? '***' : (element.price || 0) }}
                  </div>
                </div>
              </transition-group>
            </template>
          </Draggable>
        </div>
        <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore">
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
        class="absolute inset-0 z-[25] flex min-h-[100dvh] flex-col overflow-x-hidden bg-gradient-to-b from-neutral-50/98 via-white/95 to-neutral-100/90 backdrop-blur-sm transition-opacity duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] dark:from-neutral-950 dark:via-neutral-950 dark:to-black/95"
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
                              :src="`${BASE_IMG}${node.items[0].clothes_img}`"
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
                                  :src="`${BASE_IMG}${deck[0].clothes_img}`"
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
                                        :src="`${BASE_IMG}${item.clothes_img}`"
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
          
          <div class="mb-2">
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
              height: `calc(${(configStore.statusBarHeight || 0)}px + env(safe-area-inset-top, 0px))`,
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
                              :src="`${BASE_IMG}${row.clothes_img}`"
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
                    :src="`${BASE_IMG}${item.clothes_img}`"
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
        class="wardrobe-neu-select-bar fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md safe-area-pb"
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
  </div>
</template>

<style scoped>
.drag-ghost {
  opacity: 0.4;
  transform: scale(0.95);
}

.drag-chosen {
  /* outline: 2px solid #ec4899; */
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
    8px 6px 20px var(--ward-neu-deep),
    -5px -4px 14px var(--ward-neu-soft),
    inset 0 1px 0 var(--ward-neu-inset),
    inset 1px 0 0 rgba(255, 255, 255, 0.28),
    inset -2px 0 4px rgba(0, 0, 0, 0.05);
}

.dark .wardrobe-page-neu .wardrobe-neu-sidebar {
  box-shadow:
    8px 8px 24px var(--ward-neu-deep),
    -4px -3px 12px var(--ward-neu-soft),
    inset 0 1px 0 var(--ward-neu-inset),
    inset 1px 0 0 rgba(255, 255, 255, 0.04),
    inset -2px 0 4px rgba(0, 0, 0, 0.38);
}

/* —— 服饰封面：整体浮起 + 相框内凹 —— */
.wardrobe-page-neu .wardrobe-neu-item {
  filter:
    drop-shadow(8px 11px 22px var(--ward-neu-deep)) drop-shadow(-6px -7px 18px var(--ward-neu-soft));
  transition: filter 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s ease;
}

.wardrobe-page-neu .group:hover .wardrobe-neu-item {
  filter:
    drop-shadow(11px 14px 28px var(--ward-neu-deep)) drop-shadow(-7px -8px 20px var(--ward-neu-soft));
}

.wardrobe-page-neu .wardrobe-neu-photo {
  box-shadow:
    6px 7px 18px rgba(0, 0, 0, 0.13),
    -4px -5px 14px rgba(255, 255, 255, 0.58),
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.34);
  transition: box-shadow 0.28s ease;
}

.dark .wardrobe-page-neu .wardrobe-neu-photo {
  box-shadow:
    6px 8px 22px rgba(0, 0, 0, 0.55),
    -3px -4px 12px rgba(255, 255, 255, 0.04),
    inset 2px 2px 10px rgba(0, 0, 0, 0.4),
    inset -1px -1px 5px rgba(255, 255, 255, 0.06);
}

.wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    7px 9px 22px rgba(0, 0, 0, 0.15),
    -5px -6px 16px rgba(255, 255, 255, 0.62),
    inset 2px 2px 9px rgba(0, 0, 0, 0.09),
    inset -2px -2px 8px rgba(255, 255, 255, 0.38);
}

.dark .wardrobe-page-neu .group:hover .wardrobe-neu-photo {
  box-shadow:
    7px 10px 26px rgba(0, 0, 0, 0.58),
    -4px -4px 14px rgba(255, 255, 255, 0.05),
    inset 2px 2px 11px rgba(0, 0, 0, 0.42),
    inset -1px -1px 5px rgba(255, 255, 255, 0.07);
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
  aspect-ratio: 3 / 4;
  overflow: hidden;
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

/* 排序模式：遮罩参与命中会导致 vuedraggable(forceFallback) 拖拽错位，改为穿透到下层由 .drag-handle 承接 */
.wardrobe-img-touch-shield--sorting {
  pointer-events: none !important;
  touch-action: auto;
}

.wardrobe-detail-img {
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
  -webkit-user-select: none;
  user-select: none;
}

.timeline-tarot-img {
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

</style>
