<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import {
  getWardrobeStatistics,
  type WardrobeStatisticsData,
  type WardrobeStatisticsShopRow,
} from '@/api/wardrobe'
import { getUserSpace } from '@/api/user'
import type { User } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import WardrobeStatsEchart from '@/components/Wardrobe/WardrobeStatsEchart.vue'
import WardrobeCompareShareImage from '@/components/Wardrobe/WardrobeCompareShareImage.vue'
import WardrobeStatisticsShareImage from '@/components/Wardrobe/WardrobeStatisticsShareImage.vue'
import type { StatisticsSharePayload } from '@/components/Wardrobe/WardrobeStatisticsShareImage.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import { isHtml5PlusWebView } from '@/composables/useSaveNetworkImageToAlbum'

type WardrobeScopeOption = { label: string; value: number }

const route = useRoute()
const router = useRouter()
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const userStore = useUserStore()
const toast = useToast()

// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any

const ownerUserId = computed(() => Number.parseInt(String(route.params.id), 10))

const isViewingOtherUser = computed(() => {
  const me = userStore.user?.user_id
  if (me == null || Number.isNaN(ownerUserId.value)) return false
  return me !== ownerUserId.value
})

/** 仅衣柜主人可复制统计页分享链接 */
const isStatisticsWardrobeOwner = computed(() => {
  const me = userStore.user?.user_id
  if (me == null || Number.isNaN(ownerUserId.value)) return false
  return me === ownerUserId.value
})

/** 对比弹窗：对方资料、本人统计接口数据 */
const showCompareModal = ref(false)
const compareLoading = ref(false)
const compareMineRaw = ref<WardrobeStatisticsData | null>(null)
/** 对比用：对方「全部衣柜」统计（与页面筛选无关） */
const compareOwnerFullRaw = ref<WardrobeStatisticsData | null>(null)
const compareOwnerProfile = ref<User | null>(null)

function userFaceSrc(face: string | null | undefined): string {
  const path = face?.trim() ? face.trim() : 'static/plan_cover/default.jpg'
  if (/^https?:\/\//i.test(path)) return path
  return `${BASE_IMG}${path.replace(/^\//, '')}`
}

async function openCompareModal() {
  const myId = userStore.user?.user_id
  if (myId == null) {
    toast.add({ title: '请先登录后再对比', color: 'amber' })
    return
  }
  showCompareModal.value = true
  compareLoading.value = true
  compareMineRaw.value = null
  compareOwnerFullRaw.value = null
  try {
    if (!configStore.config) {
      await configStore.getConfig()
    }
    const [mine, ownerFull, ownerInfo] = await Promise.all([
      getWardrobeStatistics({ user_id: myId }),
      getWardrobeStatistics({ user_id: ownerUserId.value }),
      getUserSpace({ user_id: ownerUserId.value }),
    ])
    compareMineRaw.value = mine
    compareOwnerFullRaw.value = ownerFull
    compareOwnerProfile.value = ownerInfo
  } catch (e) {
    console.error(e)
    toast.add({ title: '加载对比数据失败', color: 'red' })
    showCompareModal.value = false
  } finally {
    compareLoading.value = false
  }
}

watch(showCompareModal, (open) => {
  if (!open) {
    compareMineRaw.value = null
    compareOwnerFullRaw.value = null
  }
})

/** 空数组表示统计全部衣柜（与原 value 0「所有衣柜」一致） */
const selectedWardrobeIds = ref<number[]>([])
const loading = ref(false)
/** 缓存最近一次接口数据，便于主题切换时只重算图表配色 */
const lastStatisticsRaw = ref<WardrobeStatisticsData | null>(null)

const clothesPartData = ref<{ name: string; value: number }[]>([])
const wardrobeStatusData = ref<{ name: string; value: number }[]>([])
/** 店铺来源列表（已按 clothes_count 降序、shop_name 升序） */
const statsShopsList = ref<WardrobeStatisticsShopRow[]>([])
/** 店铺网格默认只展示 2 行，与 grid-cols-2 sm:3 lg:4 对齐 */
const shopsWindowWidth = ref(1024)
const shopsExpanded = ref(false)

const shopsGridColCount = computed(() => {
  const w = shopsWindowWidth.value
  if (w >= 1024) return 4
  if (w >= 640) return 3
  return 2
})

const shopsCollapsedVisibleCount = computed(() => shopsGridColCount.value * 2)

const displayedStatsShops = computed(() => {
  const list = statsShopsList.value
  const lim = shopsCollapsedVisibleCount.value
  if (shopsExpanded.value || list.length <= lim) return list
  return list.slice(0, lim)
})

const shopsShowExpandToggle = computed(
  () => statsShopsList.value.length > shopsCollapsedVisibleCount.value
)

function toggleShopsExpanded() {
  shopsExpanded.value = !shopsExpanded.value
}

const wardrobeSelectOptions = ref<WardrobeScopeOption[]>([{ label: '所有衣柜', value: 0 }])

const showWardrobeScopeModal = ref(false)
const wardrobeScopeClickPosition = ref({ x: 0, y: 0 })
const wardrobeScopeDraftIds = ref<number[]>([])

const wardrobeScopeSummaryLabel = computed(() => {
  const ids = selectedWardrobeIds.value
  const opts = wardrobeSelectOptions.value
  if (!ids.length) return opts.find((o) => o.value === 0)?.label ?? '所有衣柜'
  if (ids.length === 1) {
    return opts.find((o) => o.value === ids[0])?.label ?? `衣柜 ${ids[0]}`
  }
  return `已选 ${ids.length} 个衣柜`
})

/** 弹窗内可选：未选中的具体衣柜（不含「所有」占位项） */
const wardrobeScopePicksExcludingDraft = computed(() => {
  const draft = new Set(wardrobeScopeDraftIds.value)
  return wardrobeSelectOptions.value.filter((o) => o.value !== 0 && !draft.has(o.value))
})

function openWardrobeScope(e: MouseEvent) {
  if (loading.value) return
  wardrobeScopeClickPosition.value = { x: e.clientX, y: e.clientY }
  wardrobeScopeDraftIds.value = [...selectedWardrobeIds.value]
  showWardrobeScopeModal.value = true
}

function toggleWardrobeScopePick(opt: WardrobeScopeOption) {
  if (opt.value === 0) {
    wardrobeScopeDraftIds.value = []
    return
  }
  const arr = wardrobeScopeDraftIds.value
  const i = arr.indexOf(opt.value)
  if (i !== -1) {
    arr.splice(i, 1)
  } else {
    arr.push(opt.value)
  }
}

function removeWardrobeScopeDraft(id: number) {
  const i = wardrobeScopeDraftIds.value.indexOf(id)
  if (i !== -1) wardrobeScopeDraftIds.value.splice(i, 1)
}

function sameWardrobeIdSelection(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x - y)
  const sb = [...b].sort((x, y) => x - y)
  return sa.every((v, i) => v === sb[i])
}

function confirmWardrobeScopeSelection() {
  const next = wardrobeScopeDraftIds.value
  if (!sameWardrobeIdSelection(next, selectedWardrobeIds.value)) {
    selectedWardrobeIds.value = [...next]
  }
  showWardrobeScopeModal.value = false
}

const statisticsScopeLabelForShare = computed(() => {
  const ids = selectedWardrobeIds.value
  const opts = wardrobeSelectOptions.value
  if (!ids.length) return opts.find((o) => o.value === 0)?.label ?? '所有衣柜'
  if (ids.length === 1) {
    return opts.find((o) => o.value === ids[0])?.label ?? '所有衣柜'
  }
  return `已选 ${ids.length} 个衣柜`
})

const librarySummary = ref<{
  count_clothes: number
  count_price: number
  count_times: number
  design_elements_option: EChartsOption | null
  main_style_options: EChartsOption | null
  pattern_elements_option: EChartsOption | null
  theme_option: EChartsOption | null
} | null>(null)

const colorMode = useColorMode()

/** 亮色拟态：与页面 --neu-base / raised / dent 同系的低饱和藕灰粉 */
const PIE_COLORS_LIGHT = [
  '#d4c6ce',
  '#c5b4c0',
  '#b6a2b2',
  '#a891a4',
  '#9d8096',
  '#8f6f87',
  '#c9bcc4',
  '#b0a0ad',
  '#e0d6dc',
  '#a18fa0',
  '#887688',
  '#7a6678',
]

/** 暗色拟态：在凹槽底上清晰可辨的柔粉灰 */
const PIE_COLORS_DARK = [
  '#cbb8c4',
  '#bdaab6',
  '#af9ca8',
  '#a18e9a',
  '#9d8094',
  '#b9aab4',
  '#d4c6cf',
  '#8f7d8a',
  '#e2d6de',
  '#a8929e',
  '#7f6d78',
  '#6e5f6a',
]

function truncateLegend(name: string, maxLen = 24) {
  return name.length > maxLen ? `${name.slice(0, maxLen)}…` : name
}

/** 与页面拟态一致的玫瑰饼图：图例在底部横排；配色随明暗模式与 UI 变量对齐 */
function buildRosePieOption(seriesName: string, seriesData: { name: string; value: number }[]): EChartsOption {
  const isDark = colorMode.value === 'dark'
  const palette = isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT
  const legendData = seriesData.map((c) => c.name)
  const tooltipCss = isDark
    ? 'border-radius:12px; box-shadow:4px 4px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,220,235,0.07);'
    : 'border-radius:12px; box-shadow:4px 4px 14px rgba(150,110,130,0.18), -2px -2px 10px rgba(255,255,255,0.85);'
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? 'rgba(36, 29, 38, 0.96)' : 'rgba(235, 227, 232, 0.96)',
      borderColor: isDark ? 'rgba(130, 100, 120, 0.5)' : 'rgba(200, 160, 180, 0.55)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: isDark ? '#f0e4ea' : '#4a2f3d',
        fontSize: 13,
      },
      extraCssText: tooltipCss,
      formatter: '{a} <br/>{b}：{c}（{d}%）',
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      width: '92%',
      itemGap: 14,
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      pageButtonItemGap: 8,
      pageIconColor: isDark ? '#d4b8c8' : '#9d6080',
      pageTextStyle: {
        color: isDark ? '#c4aab8' : '#8a6f7d',
      },
      inactiveColor: isDark ? '#5c4a55' : '#c4b8c0',
      textStyle: {
        color: isDark ? '#dcc8d2' : '#6b4f5f',
        fontSize: 12,
      },
      data: legendData,
      formatter: (name: string) => truncateLegend(name, 20),
    },
    series: [
      {
        name: seriesName,
        type: 'pie',
        radius: ['14%', '52%'],
        center: ['50%', '46%'],
        roseType: 'radius',
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: isDark ? 'rgba(28, 24, 30, 0.88)' : 'rgba(255, 252, 254, 0.92)',
          borderWidth: 2,
          shadowBlur: isDark ? 8 : 6,
          shadowColor: isDark ? 'rgba(0, 0, 0, 0.38)' : 'rgba(150, 110, 130, 0.14)',
        },
        label: {
          color: isDark ? '#f0e4ea' : '#4a2f3d',
          fontSize: 11,
          formatter: '{b}  {c}（{d}%）',
        },
        labelLine: {
          smooth: 0.35,
          length: 12,
          length2: 14,
          maxSurfaceAngle: 80,
          lineStyle: {
            color: isDark ? 'rgba(200, 170, 188, 0.42)' : 'rgba(120, 85, 105, 0.4)',
            width: 1,
          },
        },
        data: seriesData,
        emphasis: {
          itemStyle: {
            shadowBlur: 18,
            shadowOffsetY: 4,
            shadowColor: isDark ? 'rgba(210, 170, 195, 0.28)' : 'rgba(140, 105, 125, 0.32)',
          },
          scale: true,
          scaleSize: 4,
        },
      },
    ],
    color: palette,
  }
}

const clothesPartOption = computed(() =>
  clothesPartData.value.length ? buildRosePieOption('版型/部位统计', clothesPartData.value) : null
)
const wardrobeStatusOption = computed(() =>
  wardrobeStatusData.value.length ? buildRosePieOption('状态', wardrobeStatusData.value) : null
)

function countStringsToPieOption(items: string[], config: { name: string }): EChartsOption | null {
  const filtered = items.map((s) => s.trim()).filter(Boolean)
  if (!filtered.length) return null
  const map = filtered.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] || 0) + 1
    return acc
  }, {})
  const seriesData = Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  return buildRosePieOption(config.name, seriesData)
}

function splitCsv(str: string | null | undefined): string[] {
  if (!str) return []
  return str.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

/** 与页面统计一致：按图鉴条目的主要风格标签计数（多标签则本条各占一次） */
function countMainStyleRowsFromRaw(raw: WardrobeStatisticsData | null): { name: string; count: number }[] {
  if (!raw) return []
  const mainStyleConfig = configStore.config?.main_style || []
  const styleList: Record<string, string> = {}
  for (const style of mainStyleConfig) {
    styleList[String(style.value)] = style.label
  }
  const library = raw.library && Array.isArray(raw.library) ? raw.library : []
  const map = new Map<string, number>()
  for (const el of library) {
    const ex = el as { clothes_main_style?: string }
    let keys: string[] = []
    if (el.main_style) keys.push(...splitCsv(el.main_style as string))
    if (ex.clothes_main_style) keys.push(...splitCsv(ex.clothes_main_style))
    keys = [...new Set(keys)]
    const labels = keys.map((k) => styleList[k] || k).filter(Boolean)
    for (const label of labels) {
      map.set(label, (map.get(label) || 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

const MAIN_STYLE_COMPARE_TOP = 4

/** 占比行：前 N 名 + 分母为各标签计数总和（与饼图一致） */
function tagTopPctFromCountRows(
  rows: { name: string; count: number }[],
  topN = MAIN_STYLE_COMPARE_TOP
): { name: string; pct: number }[] {
  const total = rows.reduce((s, r) => s + r.count, 0)
  if (total <= 0) return []
  return rows.slice(0, topN).map((r) => ({
    name: r.name,
    pct: (r.count / total) * 100,
  }))
}

/** 设计 / 柄图 / 主题：与 `normalizeStatisticsPayload` 一致，字段拆分后平铺计数 */
function countPlanarTagRowsFromRaw(
  raw: WardrobeStatisticsData | null,
  field: 'design_elements' | 'pattern_elements' | 'theme'
): { name: string; count: number }[] {
  if (!raw) return []
  const library = raw.library && Array.isArray(raw.library) ? raw.library : []
  const map = new Map<string, number>()
  for (const el of library) {
    const rawStr =
      field === 'design_elements'
        ? (el.design_elements as string | undefined)
        : field === 'pattern_elements'
          ? (el.pattern_elements as string | undefined)
          : (el.theme as string | undefined)
    for (const v of splitCsv(rawStr)) {
      map.set(v, (map.get(v) || 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

function mainStyleTopPctFromRaw(
  raw: WardrobeStatisticsData | null,
  topN = MAIN_STYLE_COMPARE_TOP
): { name: string; pct: number }[] {
  return tagTopPctFromCountRows(countMainStyleRowsFromRaw(raw), topN)
}

const compareMainStyleMineTop4 = computed(() => mainStyleTopPctFromRaw(compareMineRaw.value))
const compareMainStyleOwnerTop4 = computed(() => mainStyleTopPctFromRaw(compareOwnerFullRaw.value))

type MainStyleCompareSlot = { name: string; pct: number } | null

/** 不足 MAIN_STYLE_COMPARE_TOP 条时用占位槽对齐行高，占位视觉弱化 */
function padMainStyleCompareSlots(
  rows: { name: string; pct: number }[],
  topN = MAIN_STYLE_COMPARE_TOP
): MainStyleCompareSlot[] {
  const slots: MainStyleCompareSlot[] = rows.slice(0, topN).map((r) => r)
  while (slots.length < topN) slots.push(null)
  return slots
}

const compareMainStyleMineSlots4 = computed(() => padMainStyleCompareSlots(compareMainStyleMineTop4.value))
const compareMainStyleOwnerSlots4 = computed(() => padMainStyleCompareSlots(compareMainStyleOwnerTop4.value))

const compareDesignMineTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareMineRaw.value, 'design_elements'))
)
const compareDesignOwnerTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareOwnerFullRaw.value, 'design_elements'))
)
const compareDesignMineSlots4 = computed(() => padMainStyleCompareSlots(compareDesignMineTop4.value))
const compareDesignOwnerSlots4 = computed(() => padMainStyleCompareSlots(compareDesignOwnerTop4.value))

const comparePatternMineTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareMineRaw.value, 'pattern_elements'))
)
const comparePatternOwnerTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareOwnerFullRaw.value, 'pattern_elements'))
)
const comparePatternMineSlots4 = computed(() => padMainStyleCompareSlots(comparePatternMineTop4.value))
const comparePatternOwnerSlots4 = computed(() => padMainStyleCompareSlots(comparePatternOwnerTop4.value))

const compareThemeMineTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareMineRaw.value, 'theme'))
)
const compareThemeOwnerTop4 = computed(() =>
  tagTopPctFromCountRows(countPlanarTagRowsFromRaw(compareOwnerFullRaw.value, 'theme'))
)
const compareThemeMineSlots4 = computed(() => padMainStyleCompareSlots(compareThemeMineTop4.value))
const compareThemeOwnerSlots4 = computed(() => padMainStyleCompareSlots(compareThemeOwnerTop4.value))

function formatComparePct(pct: number): string {
  const n = Math.round(pct * 10) / 10
  return `${Number.isInteger(n) ? String(n) : n.toFixed(1)}%`
}

/** 根据双方「主要风格」前四名占比生成简短对比评语 */
const compareMainStyleEvalText = computed(() => {
  const mine = compareMainStyleMineTop4.value
  const owner = compareMainStyleOwnerTop4.value

  if (mine.length === 0 && owner.length === 0) {
    return '暂无足够的主要风格数据，无法生成对比评价。'
  }
  if (mine.length === 0 || owner.length === 0) {
    return '目前只有一侧能统计到主要风格，下面的评语仅供参考；标签越完整，对比会越有意义。'
  }

  const mineSet = new Set(mine.map((r) => r.name))
  const ownerSet = new Set(owner.map((r) => r.name))
  const overlapCount = [...mineSet].filter((n) => ownerSet.has(n)).length

  const mineTop = mine[0]
  const ownerTop = owner[0]
  const sameFirst = mineTop.name === ownerTop.name
  const firstPctDiff = Math.abs(mineTop.pct - ownerTop.pct)

  const parts: string[] = []

  if (sameFirst) {
    if (firstPctDiff <= 8) {
      parts.push(
        `你们排名第一的风格一致，都是「${mineTop.name}」，且占比接近（差额约 ${formatComparePct(firstPctDiff)}）——衣橱主轴很合拍。`
      )
    } else {
      parts.push(
        `你们都把「${mineTop.name}」放在第一位，但该风格占比差距较大（约 ${formatComparePct(firstPctDiff)}），相似之余各有侧重。`
      )
    }
  } else {
    parts.push(
      `第一风格不同：一侧以「${mineTop.name}」为主（${formatComparePct(mineTop.pct)}），另一侧以「${ownerTop.name}」为主（${formatComparePct(ownerTop.pct)}）。`
    )
  }

  if (overlapCount >= 3) {
    parts.push('前四名里的风格名重叠较多，整体风格比较接近。')
  } else if (overlapCount === 2) {
    parts.push('有一部分共同偏好的风格，重合度中等。')
  } else {
    parts.push('重合的主要风格较少。')
  }

  return parts.join('')
})

interface CompareModalSection {
  id: string
  title: string
  /** 标签 Top4 或条数/金额总览 */
  kind?: 'tags' | 'metrics'
  evalText?: string
  mineSlots: MainStyleCompareSlot[]
  ownerSlots: MainStyleCompareSlot[]
  mineMetrics?: { label: string; value: string }[]
  ownerMetrics?: { label: string; value: string }[]
  hasData: boolean
  emptyLabel: string
}

/** 与主页面统计一致：library 件数与参考总价（price 累加） */
function compareLibraryCountPrice(raw: WardrobeStatisticsData | null): { count: number; price: number } {
  const library = raw?.library && Array.isArray(raw.library) ? raw.library : []
  let count_price = 0
  for (const el of library) {
    if (el.price) count_price += Number(el.price) || 0
  }
  return { count: library.length, price: count_price }
}

const compareModalSections = computed((): CompareModalSection[] => {
  const mineSum = compareLibraryCountPrice(compareMineRaw.value)
  const ownerSum = compareLibraryCountPrice(compareOwnerFullRaw.value)

  const overview: CompareModalSection = {
    id: 'overview',
    kind: 'metrics',
    title: '条数与金额',
    mineSlots: [],
    ownerSlots: [],
    mineMetrics: [
      { label: '总条数', value: String(mineSum.count) },
      { label: '参考总价', value: `￥${mineSum.price.toFixed(2)}` },
    ],
    ownerMetrics: [
      { label: '总条数', value: String(ownerSum.count) },
      { label: '参考总价', value: `￥${ownerSum.price.toFixed(2)}` },
    ],
    hasData: true,
    emptyLabel: '',
  }

  return [
    overview,
    {
      id: 'main_style',
      title: '主要风格',
      evalText: compareMainStyleEvalText.value,
      mineSlots: compareMainStyleMineSlots4.value,
      ownerSlots: compareMainStyleOwnerSlots4.value,
      hasData: compareMainStyleMineTop4.value.length > 0 || compareMainStyleOwnerTop4.value.length > 0,
      emptyLabel: '暂无主要风格数据',
    },
    {
      id: 'design_elements',
      title: '设计元素',
      mineSlots: compareDesignMineSlots4.value,
      ownerSlots: compareDesignOwnerSlots4.value,
      hasData: compareDesignMineTop4.value.length > 0 || compareDesignOwnerTop4.value.length > 0,
      emptyLabel: '暂无设计元素数据',
    },
    {
      id: 'pattern_elements',
      title: '柄图元素',
      mineSlots: comparePatternMineSlots4.value,
      ownerSlots: comparePatternOwnerSlots4.value,
      hasData: comparePatternMineTop4.value.length > 0 || comparePatternOwnerTop4.value.length > 0,
      emptyLabel: '暂无柄图元素数据',
    },
    {
      id: 'theme',
      title: '主题',
      mineSlots: compareThemeMineSlots4.value,
      ownerSlots: compareThemeOwnerSlots4.value,
      hasData: compareThemeMineTop4.value.length > 0 || compareThemeOwnerTop4.value.length > 0,
      emptyLabel: '暂无主题数据',
    },
  ]
})

function compareSlotToShareRow(slot: MainStyleCompareSlot | null): { name: string; pct: string } {
  if (!slot) return { name: '', pct: '' }
  return { name: slot.name, pct: formatComparePct(slot.pct) }
}

const compareSharePayload = computed(() => ({
  mineName: userStore.user?.user_name || '我',
  ownerName: compareOwnerProfile.value?.user_name || `用户${ownerUserId.value}`,
  hint: '对比范围为双方全部衣柜（与页面「统计范围」筛选无关）',
  sections: compareModalSections.value.map((sec) => {
    if (sec.kind === 'metrics' && sec.mineMetrics?.length && sec.ownerMetrics?.length) {
      return {
        title: sec.title,
        hasData: sec.hasData,
        shareRowCount: sec.mineMetrics.length,
        mineRows: sec.mineMetrics.map((m) => ({ name: m.label, pct: m.value })),
        ownerRows: sec.ownerMetrics.map((m) => ({ name: m.label, pct: m.value })),
      }
    }
    return {
      title: sec.title,
      evalText: sec.evalText,
      hasData: sec.hasData,
      mineRows: sec.mineSlots.map(compareSlotToShareRow),
      ownerRows: sec.ownerSlots.map(compareSlotToShareRow),
    }
  }),
}))

function shopStatLogoSrc(logo: string | null | undefined): string {
  const fallback = `${BASE_IMG}static/plan_cover/default.jpg`
  if (logo == null || !String(logo).trim()) return fallback
  const s = String(logo).trim()
  if (/^https?:\/\//i.test(s)) return s
  return `${BASE_IMG}${s.replace(/^\//, '')}`
}

function openShopStatDetail(shop: WardrobeStatisticsShopRow) {
  if (shop.shop_id == null || import.meta.server) return
  const id = shop.shop_id
  if (isHtml5PlusWebView() && typeof uni !== 'undefined' && uni?.navigateTo) {
    uni.navigateTo({
      url: `/pages/shop/shopDetail/shopDetail?id=${id}`,
      fail: () => {
        console.log('跳转错误')
      },
    })
    return
  }
  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'ShopDetail',
        params: { id },
      })
    )
    return
  }
  window.open(`/shop/detail/${id}`, '_blank', 'noopener,noreferrer')
}

/** 衣柜内件数大于待收录图鉴总数时视为已「全收集」 */
function shopStatFullCollection(shop: WardrobeStatisticsShopRow): boolean {
  const t = shop.total_library_count
  if (t == null) return false
  return shop.clothes_count >= t
}

/**
 * @param refreshWardrobeScopeOptions 为 true 时，在接口未返回 wardrobe 列表的情况下才重置为「仅所有衣柜」。
 * 选中具体衣柜后请求往往不带全量 wardrobe，此时应保留已有选项，否则会丢选项且当前选中 id 对不上。
 */
function normalizeStatisticsPayload(
  raw: WardrobeStatisticsData,
  options?: { refreshWardrobeScopeOptions?: boolean }
) {
  const refreshScope = options?.refreshWardrobeScopeOptions ?? false

  const clothesPart = [...(raw.clothes_part ?? [])]
  if (clothesPart.length > 0) {
    clothesPartData.value = clothesPart.map((item) => ({
      value: item.type_count,
      name: item.clothes_part || '未分类',
    }))
  } else {
    clothesPartData.value = []
  }

  if (raw.wardrobe?.length) {
    wardrobeSelectOptions.value = [
      { label: '所有衣柜', value: 0 },
      ...raw.wardrobe
        .map((child) => {
          const wid = child.wardrobe_id
          if (wid == null) return null
          return { value: wid, label: child.wardrobe_name || `衣柜 ${wid}` }
        })
        .filter((x): x is { value: number; label: string } => x != null),
    ]
  } else if (refreshScope) {
    wardrobeSelectOptions.value = [{ label: '所有衣柜', value: 0 }]
  }

  const statusRows = [...(raw.wardrobe_status ?? [])]
  if (statusRows.length > 0) {
    wardrobeStatusData.value = statusRows.map((item) => ({
      value: item.total,
      name: item.title || '未分类',
    }))
  } else {
    wardrobeStatusData.value = []
  }

  const library = raw.library && Array.isArray(raw.library) ? raw.library : []
  const mainStyleConfig = configStore.config?.main_style || []
  const styleList: Record<string, string> = {}
  for (const style of mainStyleConfig) {
    styleList[String(style.value)] = style.label
  }

  const design_elements: string[] = []
  const pattern_elements: string[] = []
  const main_style: string[] = []
  const theme: string[] = []
  let count_price = 0
  let count_times = 0

  for (const el of library) {
    if (el.price) count_price += Number(el.price) || 0
    if (el.times) count_times += Number(el.times) || 0
    design_elements.push(...splitCsv(el.design_elements as string | undefined))
    pattern_elements.push(...splitCsv(el.pattern_elements as string | undefined))
    const ex = el as { clothes_main_style?: string }
    let clothes_main_style: string[] = []
    if (el.main_style) clothes_main_style.push(...splitCsv(el.main_style))
    if (ex.clothes_main_style) clothes_main_style.push(...splitCsv(ex.clothes_main_style))
    clothes_main_style = [...new Set(clothes_main_style)]
    if (clothes_main_style.length) {
      main_style.push(
        ...clothes_main_style.map((key) => styleList[key] || key).filter(Boolean)
      )
    }
    theme.push(...splitCsv(el.theme as string | undefined))
  }

  librarySummary.value = {
    count_clothes: library.length,
    count_price,
    count_times,
    design_elements_option: countStringsToPieOption(design_elements, { name: '设计' }),
    main_style_options: countStringsToPieOption(main_style, { name: '主要风格' }),
    pattern_elements_option: countStringsToPieOption(pattern_elements, { name: '柄图' }),
    theme_option: countStringsToPieOption(theme, { name: '主题' }),
  }

  const shopsRaw = [...(raw.shops ?? [])]
  statsShopsList.value = shopsRaw.sort((a, b) => {
    if (b.clothes_count !== a.clothes_count) return b.clothes_count - a.clothes_count
    return (a.shop_name || '').localeCompare(b.shop_name || '', 'zh-CN')
  })
}

async function load() {
  if (Number.isNaN(ownerUserId.value)) {
    toast.add({ title: '无效的用户 ID', color: 'red' })
    return
  }
  loading.value = true
  try {
    await configStore.getConfig()
    const params: { user_id: number; wardrobe_id?: number[] } = { user_id: ownerUserId.value }
    if (selectedWardrobeIds.value.length > 0) {
      params.wardrobe_id = [...selectedWardrobeIds.value]
    }
    const data = await getWardrobeStatistics(params)
    lastStatisticsRaw.value = data
    normalizeStatisticsPayload(data, {
      refreshWardrobeScopeOptions: selectedWardrobeIds.value.length === 0,
    })
    selectedChartIndex.value = 0
    shopsExpanded.value = false
  } catch (e) {
    console.error(e)
    toast.add({ title: '加载统计失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

watch(
  () => colorMode.value,
  () => {
    if (lastStatisticsRaw.value) {
      normalizeStatisticsPayload(lastStatisticsRaw.value, { refreshWardrobeScopeOptions: false })
    }
  }
)

watch(
  selectedWardrobeIds,
  () => {
    load()
  },
  { deep: true }
)

function shopsOnResize() {
  shopsWindowWidth.value = window.innerWidth
}

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
  if (import.meta.client) {
    shopsWindowWidth.value = window.innerWidth
    window.addEventListener('resize', shopsOnResize, { passive: true })
  }
  load()
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', shopsOnResize)
  }
})

function goBack() {
  router.push(`/wardrobe/detail/${ownerUserId.value}`)
}

async function shareStatisticsLink() {
  const { copyCurrentUrl } = useCopyCurrentUrl()
  const result = await copyCurrentUrl()
  if (result?.success) {
    toast.add({
      title: '分享链接已复制',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    })
  } else {
    toast.add({
      title: result?.message ?? '复制失败，请手动复制地址栏链接',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle',
    })
  }
}

const chartPanels = computed(() => {
  const panels: { title: string; option: EChartsOption }[] = []
  const lib = librarySummary.value
  if (lib?.main_style_options) {
    panels.push({ title: '主要风格统计', option: lib.main_style_options as EChartsOption })
  }
  if (lib?.design_elements_option) {
    panels.push({ title: '设计元素统计', option: lib.design_elements_option as EChartsOption })
  }
  if (lib?.pattern_elements_option) {
    panels.push({ title: '柄图元素统计', option: lib.pattern_elements_option as EChartsOption })
  }
  if (lib?.theme_option) {
    panels.push({ title: '主题统计', option: lib.theme_option as EChartsOption })
  }
  if (clothesPartOption.value) {
    panels.push({ title: '版型/部位统计', option: clothesPartOption.value })
  }
  if (wardrobeStatusOption.value) {
    panels.push({ title: '状态统计', option: wardrobeStatusOption.value })
  }
  
  return panels
})

const selectedChartIndex = ref(0)

watch(
  () => chartPanels.value.length,
  (len) => {
    if (len === 0) return
    if (selectedChartIndex.value >= len) {
      selectedChartIndex.value = len - 1
    }
  }
)

const activeChart = computed(() => {
  const panels = chartPanels.value
  const i = selectedChartIndex.value
  if (!panels.length || i < 0 || i >= panels.length) return null
  return panels[i]
})

const showSoloShareModal = ref(false)

/** 当前页统计范围与汇总，用于单人统计分享图（与对比衣柜相同的上传 + 预览弹窗流程） */
const statisticsSoloSharePayload = computed((): StatisticsSharePayload | null => {
  const lib = librarySummary.value
  if (!lib) return null
  const raw = lastStatisticsRaw.value
  const scopeLabel = statisticsScopeLabelForShare.value

  const makeSection = (title: string, rows: { name: string; pct: number }[]) => ({
    title,
    hasData: rows.length > 0,
    rows: rows.slice(0, 4).map((r) => ({ name: r.name, pct: formatComparePct(r.pct) })),
  })

  return {
    userName: userStore.user?.user_name || '我',
    scopeLabel,
    metrics: [
      { label: '总条数', value: String(lib.count_clothes) },
      { label: '参考总价', value: `￥${lib.count_price.toFixed(2)}` },
      { label: '穿着总次数', value: String(lib.count_times) },
    ],
    sections: [
      makeSection('主要风格', mainStyleTopPctFromRaw(raw)),
      makeSection('设计元素', tagTopPctFromCountRows(countPlanarTagRowsFromRaw(raw, 'design_elements'))),
      makeSection('柄图元素', tagTopPctFromCountRows(countPlanarTagRowsFromRaw(raw, 'pattern_elements'))),
      makeSection('主题', tagTopPctFromCountRows(countPlanarTagRowsFromRaw(raw, 'theme'))),
    ],
  }
})
</script>

<template>
  <div class="wardrobe-statistics neu-page relative min-h-screen w-full overflow-x-hidden pb-12">
    <!-- WebView 经 layouts/default 注入的 statusbar 高度，与 wardrobe/detail 等页一致 -->
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />
    <header
      class="neu-header sticky z-20"
      :style="{
        top: configStore.statusBarHeight > 0 ? `${configStore.statusBarHeight}px` : '0px',
      }"
    >
      <div
        class="relative mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
          <!-- <button
            type="button"
            class="neu-back-btn group flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[#5e3a4b] transition active:scale-[0.98] dark:text-pink-100"
            @click="goBack"
          >
            <UIcon
              name="i-heroicons-arrow-left-20-solid"
              class="h-5 w-5 transition group-hover:-translate-x-0.5"
            />
            返回衣柜
          </button> -->
          <h1 class="text-lg font-semibold tracking-tight text-[#4a2f3d] dark:text-pink-50 sm:text-xl">
            衣柜统计
          </h1>
          <p class="text-xs text-[#8a6f7d] dark:text-pink-200/75">
            按当前筛选范围汇总服饰与标签分布
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
              v-if="isStatisticsWardrobeOwner"
              type="button"
              class="compare-wardrobe-btn flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-qhx-primary/45 dark:text-pink-100"
              @click="shareStatisticsLink"
            >
              <UIcon name="i-heroicons-link-20-solid" class="h-5 w-5 shrink-0" />
              分享链接
            </button>
            <button
              v-if="isStatisticsWardrobeOwner"
              type="button"
              class="compare-wardrobe-btn flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] enabled:hover:opacity-95 focus-visible:ring-2 focus-visible:ring-qhx-primary/45 disabled:cursor-not-allowed disabled:opacity-50 dark:text-pink-100"
              :disabled="loading || !statisticsSoloSharePayload"
              @click="showSoloShareModal = true"
            >
              <UIcon name="i-heroicons-photo-20-solid" class="h-5 w-5 shrink-0" />
              统计分享图
            </button>
            <button
              v-if="isViewingOtherUser"
              type="button"
              class="compare-wardrobe-btn flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-qhx-primary/45 dark:text-pink-100"
              @click="openCompareModal"
            >
              <UIcon name="i-heroicons-arrows-right-left-20-solid" class="h-5 w-5 shrink-0" />
              对比衣柜
            </button>
          </div>
        </div>
        <div
          class="flex w-full shrink-0 flex-col gap-1.5 sm:w-64 sm:max-w-xs"
        >
          <span class="text-[11px] font-medium tracking-wide text-[#8a6f7d] dark:text-pink-300/85">
            统计范围
          </span>
          <div class="neu-inset-select w-full rounded-xl px-2 py-1">
            <button
              type="button"
              class="wardrobe-scope-trigger flex w-full min-h-[2.5rem] items-center justify-between gap-2 rounded-lg py-2 pl-2 pr-1 text-left text-sm outline-none transition enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-qhx-primary/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--neu-dent)]"
              :disabled="loading"
              @click="openWardrobeScope"
            >
              <span class="min-w-0 flex-1 truncate text-[#4a2f3d] dark:text-[#fce7f0]">
                {{ wardrobeScopeSummaryLabel }}
              </span>
              <UIcon
                name="i-heroicons-chevron-down-20-solid"
                class="h-5 w-5 shrink-0 text-[#8a6f7d] opacity-70 dark:text-pink-300/80"
              />
            </button>
          </div>
        </div>
      </div>
    </header>

    <QhxModal
      v-model="showWardrobeScopeModal"
      :trigger-position="wardrobeScopeClickPosition"
      @close="showWardrobeScopeModal = false"
    >
      <div
        class="flex max-h-[70vh] w-[95vw] max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-800"
      >
        <div
          class="flex-shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-5 sm:py-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-[#4a2f3d] dark:text-pink-50">
              选择统计范围
            </h2>
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="showWardrobeScopeModal = false"
            >
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div class="mt-3 flex justify-end">
            <UButton color="primary" size="sm" @click="confirmWardrobeScopeSelection">
              确认选择
            </UButton>
          </div>
        </div>
        <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div v-if="wardrobeScopeDraftIds.length" class="mb-4 flex flex-wrap gap-2">
            <QhxTag v-for="id in wardrobeScopeDraftIds" :key="id" :active="true">
              <div class="flex items-center">
                <UIcon
                  name="ant-design:close-outlined"
                  class="cursor-pointer text-[16px]"
                  @click="removeWardrobeScopeDraft(id)"
                />
                <div class="ml-1">
                  {{ wardrobeSelectOptions.find((o) => o.value === id)?.label ?? id }}
                </div>
              </div>
            </QhxTag>
          </div>
          <p
            v-else
            class="mb-4 text-sm text-[#8a6f7d] dark:text-pink-200/80"
          >
            当前：统计全部衣柜
          </p>
          <div class="flex flex-wrap gap-2">
            <QhxTag
              v-if="wardrobeScopeDraftIds.length"
              class="cursor-pointer"
              @click="toggleWardrobeScopePick({ label: '所有衣柜', value: 0 })"
            >
              所有衣柜
            </QhxTag>
            <QhxTag
              v-for="opt in wardrobeScopePicksExcludingDraft"
              :key="opt.value"
              class="cursor-pointer"
              @click="toggleWardrobeScopePick(opt)"
            >
              {{ opt.label }}
            </QhxTag>
          </div>
        </div>
      </div>
    </QhxModal>

    <main class="relative mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
      <div
        v-if="loading"
        class="neu-well-in flex flex-col items-center justify-center gap-4 rounded-3xl py-16"
      >
        <span class="neu-spin-icon flex h-14 w-14 items-center justify-center rounded-full">
          <UIcon name="i-heroicons-arrow-path" class="h-7 w-7 animate-spin text-[#9d6080] dark:text-pink-300" />
        </span>
        <p class="text-sm text-[#7a5f6f] dark:text-pink-300/85">
          正在加载统计数据…
        </p>
      </div>

      <template v-else>
        <div
          v-if="librarySummary"
          class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5"
        >
          <div
            class="stat-card neu-stat-card group flex items-center gap-4 rounded-3xl p-4 sm:p-5"
          >
            <div
              class="neu-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#9d6080] dark:text-pink-300"
            >
              <UIcon name="i-heroicons-rectangle-stack-20-solid" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-[#8a6f7d] dark:text-pink-300/90">
                总条数
              </p>
              <p class="mt-0.5 truncate text-2xl font-semibold tabular-nums text-[#4a2f3d] dark:text-pink-50">
                {{ librarySummary.count_clothes }}
              </p>
            </div>
          </div>
          <div
            class="stat-card neu-stat-card group flex items-center gap-4 rounded-3xl p-4 sm:p-5"
          >
            <div
              class="neu-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#9d6080] dark:text-pink-300"
            >
              <UIcon name="i-heroicons-currency-yen-20-solid" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-[#8a6f7d] dark:text-pink-300/90">
                参考总价
              </p>
              <p class="mt-0.5 truncate text-xl font-semibold tabular-nums text-[#4a2f3d] dark:text-pink-50 sm:text-2xl">
                ￥{{ librarySummary.count_price.toFixed(2) }}
              </p>
            </div>
          </div>
          <div
            class="stat-card neu-stat-card group flex items-center gap-4 rounded-3xl p-4 sm:p-5"
          >
            <div
              class="neu-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#9d6080] dark:text-pink-300"
            >
              <UIcon name="i-heroicons-sparkles-20-solid" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-[#8a6f7d] dark:text-pink-300/90">
                穿着总次数
              </p>
              <p class="mt-0.5 truncate text-2xl font-semibold tabular-nums text-[#4a2f3d] dark:text-pink-50">
                {{ librarySummary.count_times }}
              </p>
            </div>
          </div>
        </div>

        <section
          v-if="chartPanels.length && activeChart"
          class="chart-switcher neu-chart-card flex flex-col overflow-hidden rounded-3xl"
        >
          <div class="chart-tabs-bar px-3 py-3 sm:px-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span
                  class="chart-tab-icon-neu flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                >
                  <UIcon
                    name="i-heroicons-chart-pie-20-solid"
                    class="h-5 w-5 text-[#9d6080] dark:text-pink-300"
                  />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold tracking-tight text-[#4a2f3d] dark:text-pink-50">
                    分布图表
                  </p>
                  <p class="text-[11px] text-[#a08092] dark:text-pink-300/75">
                    各风格、元素、主题等统计
                  </p>
                </div>
              </div>
            </div>

            <div class="chart-tab-rail rounded-2xl p-1.5">
              <div
                class="chart-tab-list flex -snapx snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-0.5 py-1"
                role="tablist"
                aria-label="切换统计图表"
              >
                <button
                  v-for="(panel, idx) in chartPanels"
                  :key="`${panel.title}-${idx}`"
                  type="button"
                  role="tab"
                  :aria-selected="selectedChartIndex === idx"
                  class="chart-tab-btn shrink-0 snap-start rounded-xl px-3 py-2.5 text-left text-xs outline-none transition-[box-shadow,transform,color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-qhx-primary/50 sm:px-4 sm:text-[13px]"
                  :class="
                    selectedChartIndex === idx
                      ? 'chart-tab-btn--active text-[#3d2833] dark:text-pink-50'
                      : 'chart-tab-btn--idle text-[#6b4f5f] hover:text-[#4a2f3d] active:scale-[0.98] dark:text-pink-200/80 dark:hover:text-pink-50'
                  "
                  @click="selectedChartIndex = idx"
                >
                  <span class="block max-w-[9.5rem] truncate font-medium sm:max-w-[11rem]">
                    {{ panel.title.replace(/统计$/, '') }}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div class="chart-body-neu px-2 pb-4 pt-1 sm:px-4">
            <div class="neu-chart-well rounded-2xl p-2 sm:p-3">
              <h2 class="sr-only">
                {{ activeChart.title }}
              </h2>
              <ClientOnly>
                <WardrobeStatsEchart
                  :key="`${selectedChartIndex}-${activeChart.title}`"
                  :option="activeChart.option"
                  height="400px"
                />
                <template #fallback>
                  <div
                    class="flex h-[400px] w-full items-center justify-center rounded-xl text-sm text-[#8a6f7d] dark:text-pink-300/80"
                  >
                    图表加载中…
                  </div>
                </template>
              </ClientOnly>
            </div>
          </div>
        </section>

        <section
          v-if="statsShopsList.length"
          class="mb-8 mt-6"
        >
          <div class="mb-4 flex items-center gap-2.5 px-0.5">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl neu-stat-icon text-[#9d6080] dark:text-pink-300"
            >
              <UIcon name="i-heroicons-building-storefront-20-solid" class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <h2 class="text-sm font-semibold tracking-tight text-[#4a2f3d] dark:text-pink-50 sm:text-base">
                店铺来源
              </h2>
              <p class="text-[11px] text-[#8a6f7d] dark:text-pink-300/75">
                你最喜欢的店铺是哪家呢！
              </p>
            </div>
          </div>
          <div
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4"
          >
            <article
              v-for="(shop, idx) in displayedStatsShops"
              :key="`${shop.shop_id ?? 'x'}-${shop.shop_name}-${idx}`"
              class="shop-stat-polaroid flex flex-col overflow-visible rounded-[18px] p-0 transition hover:-translate-y-0.5"
            >
              <div
                class="w-full cursor-pointer bg-[var(--neu-raised)] p-3 dark:bg-[var(--neu-raised)]"
                :class="shop.shop_id != null ? '' : 'cursor-default'"
                role="button"
                :tabindex="shop.shop_id != null ? 0 : -1"
                @click="openShopStatDetail(shop)"
                @keydown.enter="openShopStatDetail(shop)"
              >
                <div
                  class="shop-logo-codex relative w-full overflow-visible rounded-[10px] border border-pink-100/60 shadow-sm dark:border-pink-900/40"
                >
                  <!-- h-0 + pb-[100%]：不依赖子节点参与高度计算，避免仅 absolute 子节点时 aspect-square 在部分环境高度为 0 -->
                  <div class="pointer-events-none h-0 w-full pb-[100%]" aria-hidden="true" />
                  <div class="absolute inset-0 overflow-hidden rounded-[10px]">
                    <img
                      :src="shopStatLogoSrc(shop.shop_logo)"
                      :alt="shop.shop_name"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <!-- 图鉴数据常驻：服饰=衣柜内件数，总数=待收录图鉴（无则 —） -->
                    <div
                      class="shop-logo-codex-overlay pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center px-2"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-t from-[#1a0f14]/85 via-[#2d1820]/45 to-transparent"
                        aria-hidden="true"
                      />
                      <div
                        class="relative mt-1 flex flex-col items-center gap-0.5 rounded-md border border-amber-200/35 bg-black/30 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,220,180,0.12)] backdrop-blur-[2px]"
                      >
                        <span class="text-[10px] font-semibold tracking-[0.2em] text-amber-100/95">服饰</span>
                        <span class="text-xl font-bold tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
                          {{ shop.clothes_count }}
                        </span>
                        <span
                          class="my-0.5 h-px w-10 bg-gradient-to-r from-transparent via-amber-200/55 to-transparent"
                          aria-hidden="true"
                        />
                        <span class="text-[10px] font-semibold tracking-[0.2em] text-amber-100/95">总数</span>
                        <span
                          class="text-xl font-bold tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
                        >
                          {{ shop.total_library_count != null ? shop.total_library_count : '—' }}
                        </span>
                      </div>
                    </div>
                    <div
                      class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 pb-2 pt-6 text-center"
                    >
                      <p
                        class="min-w-0 w-full truncate text-[11px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                        :title="shop.shop_name || undefined"
                      >
                        {{ shop.shop_name }}
                      </p>
                    </div>
                  </div>
                  <span
                    v-if="shopStatFullCollection(shop)"
                    class="pointer-events-none absolute left-4 top-4 z-10 -translate-x-1/2 -translate-y-1/2 -rotate-45 whitespace-nowrap text-sm font-black tracking-wide text-black drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]"
                  >
                    全收集！
                  </span>
                  <span
                    v-if="shop.is_custom"
                    class="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-[2px]"
                  >
                    自定义
                  </span>
                </div>
              </div>
            </article>
          </div>
          <div
            v-if="shopsShowExpandToggle"
            class="mt-4 flex justify-center"
          >
            <button
              type="button"
              class="neu-expand-shops-btn rounded-xl px-4 py-2 text-xs font-medium text-[#6b4f5f] outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-qhx-primary/45 dark:text-pink-200/85"
              @click="toggleShopsExpanded"
            >
              <span v-if="!shopsExpanded">展开全部（共 {{ statsShopsList.length }} 家）</span>
              <span v-else>收起</span>
            </button>
          </div>
        </section>

        <div
          v-else-if="librarySummary"
          class="neu-well-in flex flex-col items-center justify-center rounded-3xl py-14 text-center"
        >
          <span class="neu-empty-icon mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[#b888a0] dark:text-pink-400/70">
            <UIcon name="i-heroicons-chart-pie-20-solid" class="h-8 w-8" />
          </span>
          <p class="text-sm text-[#7a5f6f] dark:text-pink-300/85">
            当前范围下暂无足够数据生成图表
          </p>
        </div>

        <p
          class="neu-foot-note mt-10 text-center text-xs text-[#927084] dark:text-pink-400/55"
        >
          更多维度统计持续完善中
        </p>
      </template>
    </main>

    <QhxModal v-model="showSoloShareModal">
      <div
        class="wardrobe-compare-modal flex max-h-[88vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-3xl shadow-2xl"
      >
        <div class="compare-modal-toolbar flex shrink-0 items-center justify-between gap-2 px-3 py-2">
          <span class="pl-2 text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">统计分享图</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showSoloShareModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="compare-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2 sm:px-4">
          <p class="mb-3 text-center text-[11px] leading-relaxed text-[#6b4f5f] dark:text-pink-300/90">
            按当前「统计范围」汇总生成长图，上传成功后可预览保存（流程与对比衣柜分享图一致）
          </p>
          <WardrobeStatisticsShareImage
            v-if="statisticsSoloSharePayload"
            :payload="statisticsSoloSharePayload"
          />
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showCompareModal">
      <div
        class="wardrobe-compare-modal flex max-h-[86vh] w-[min(94vw,880px)] flex-col overflow-hidden rounded-3xl shadow-2xl"
      >
        <div
          class="compare-modal-toolbar flex shrink-0 items-center justify-between gap-2 px-3 py-2"
        >
          <span class="pl-2 text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">衣柜对比</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showCompareModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>

        <div
          class="compare-vs-header flex shrink-0 items-center gap-2 px-3 py-4 sm:gap-4 sm:px-5"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img
              :src="userFaceSrc(userStore.user?.user_face)"
              alt=""
              class="h-10 w-10 shrink-0 rounded-full object-cover sm:h-12 sm:w-12"
            />
            <span class="truncate text-sm font-semibold text-[#4a2f3d] dark:text-pink-50 sm:text-base">
              {{ userStore.user?.user_name || '我' }}
            </span>
          </div>
          <span
            class="compare-vs-badge shrink-0 rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 px-2.5 py-1 text-xs font-black tracking-widest text-[#9d4080] dark:from-pink-950 dark:to-purple-950 dark:text-pink-300 sm:px-3 sm:text-sm"
          >
            VS
          </span>
          <div class="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 sm:gap-3">
            <img
              :src="userFaceSrc(compareOwnerProfile?.user_face)"
              alt=""
              class="h-10 w-10 shrink-0 rounded-full object-cover sm:h-12 sm:w-12"
            />
            <span class="truncate text-right text-sm font-semibold text-[#4a2f3d] dark:text-pink-50 sm:text-base">
              {{ compareOwnerProfile?.user_name || `用户${ownerUserId}` }}
            </span>
          </div>
        </div>

        <p
          class="compare-modal-hint shrink-0 px-4 py-2 text-center text-[11px] text-[#6b4f5f] dark:text-pink-300"
        >
          对比范围为你们的全部衣柜（与页面「统计范围」筛选无关）
        </p>

        <div
          class="compare-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-1 sm:px-4"
        >
          <template v-if="compareLoading">
            <div class="flex flex-col items-center justify-center gap-3 py-20">
              <UIcon
                name="i-heroicons-arrow-path"
                class="h-10 w-10 animate-spin text-[#9d6080] dark:text-pink-300"
              />
              <p class="text-sm text-[#7a5f6f] dark:text-pink-300/85">
                正在加载对比数据…
              </p>
            </div>
          </template>
          <template v-else>
            <div class="compare-modal-sections space-y-4">
              <section
                v-for="sec in compareModalSections"
                :key="sec.id"
                class="compare-block"
              >
                <h3 class="compare-block-title">
                  {{ sec.title }}
                </h3>
                <p
                  v-if="sec.evalText"
                  class="compare-block-desc text-[11px] leading-relaxed text-[#6b4f5f] dark:text-pink-300/90"
                >
                  {{ sec.evalText }}
                </p>

                <template v-if="sec.kind === 'metrics' && sec.hasData">
                  <div
                    class="compare-main-style-grid mt-3 grid grid-cols-2 gap-2 sm:gap-3"
                  >
                    <div class="compare-main-style-column compare-main-style-column--mine min-w-0">
                      <p
                        class="compare-main-style-col-label mb-2 truncate text-center text-[11px] font-semibold text-[#6b4f5f] sm:text-xs dark:text-pink-200"
                        :title="userStore.user?.user_name || '我'"
                      >
                        {{ userStore.user?.user_name || '我' }}
                      </p>
                      <ul class="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <li
                          v-for="(row, idx) in sec.mineMetrics ?? []"
                          :key="`${sec.id}-m-${idx}`"
                          class="compare-main-style-pill flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2"
                        >
                          <span class="min-w-0 truncate text-[#5e3a4b] dark:text-pink-100">{{ row.label }}</span>
                          <span class="shrink-0 tabular-nums font-semibold text-[#4a2f3d] dark:text-pink-50">
                            {{ row.value }}
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div class="compare-main-style-column compare-main-style-column--owner min-w-0">
                      <p
                        class="compare-main-style-col-label mb-2 truncate text-center text-[11px] font-semibold text-[#6b4f5f] sm:text-xs dark:text-pink-200"
                        :title="compareOwnerProfile?.user_name || `用户${ownerUserId}`"
                      >
                        {{ compareOwnerProfile?.user_name || `用户${ownerUserId}` }}
                      </p>
                      <ul class="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <li
                          v-for="(row, idx) in sec.ownerMetrics ?? []"
                          :key="`${sec.id}-o-${idx}`"
                          class="compare-main-style-pill flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2"
                        >
                          <span class="min-w-0 truncate text-[#5e3a4b] dark:text-pink-100">{{ row.label }}</span>
                          <span class="shrink-0 tabular-nums font-semibold text-[#4a2f3d] dark:text-pink-50">
                            {{ row.value }}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>

                <template v-else-if="sec.hasData">
                  <div
                    class="compare-main-style-grid mt-3 grid grid-cols-2 gap-2 sm:gap-3"
                  >
                    <div class="compare-main-style-column compare-main-style-column--mine min-w-0">
                      <p
                        class="compare-main-style-col-label mb-2 truncate text-center text-[11px] font-semibold text-[#6b4f5f] sm:text-xs dark:text-pink-200"
                        :title="userStore.user?.user_name || '我'"
                      >
                        {{ userStore.user?.user_name || '我' }}
                      </p>
                      <ul class="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <li
                          v-for="(row, idx) in sec.mineSlots"
                          :key="`${sec.id}-m-${idx}`"
                          :class="[
                            'compare-main-style-pill flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2',
                            row ? '' : 'compare-main-style-pill--placeholder',
                          ]"
                          :aria-hidden="row === null"
                        >
                          <template v-if="row">
                            <span class="min-w-0 truncate text-[#5e3a4b] dark:text-pink-100">{{ row.name }}</span>
                            <span class="shrink-0 tabular-nums font-semibold text-[#4a2f3d] dark:text-pink-50">
                              {{ formatComparePct(row.pct) }}
                            </span>
                          </template>
                          <template v-else>
                            <span class="compare-main-style-ph"><span class="compare-main-style-ph__inner">—</span></span>
                            <span class="compare-main-style-ph"><span class="compare-main-style-ph__inner">—</span></span>
                          </template>
                        </li>
                      </ul>
                    </div>
                    <div class="compare-main-style-column compare-main-style-column--owner min-w-0">
                      <p
                        class="compare-main-style-col-label mb-2 truncate text-center text-[11px] font-semibold text-[#6b4f5f] sm:text-xs dark:text-pink-200"
                        :title="compareOwnerProfile?.user_name || `用户${ownerUserId}`"
                      >
                        {{ compareOwnerProfile?.user_name || `用户${ownerUserId}` }}
                      </p>
                      <ul class="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <li
                          v-for="(row, idx) in sec.ownerSlots"
                          :key="`${sec.id}-o-${idx}`"
                          :class="[
                            'compare-main-style-pill flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2',
                            row ? '' : 'compare-main-style-pill--placeholder',
                          ]"
                          :aria-hidden="row === null"
                        >
                          <template v-if="row">
                            <span class="min-w-0 truncate text-[#5e3a4b] dark:text-pink-100">{{ row.name }}</span>
                            <span class="shrink-0 tabular-nums font-semibold text-[#4a2f3d] dark:text-pink-50">
                              {{ formatComparePct(row.pct) }}
                            </span>
                          </template>
                          <template v-else>
                            <span class="compare-main-style-ph"><span class="compare-main-style-ph__inner">—</span></span>
                            <span class="compare-main-style-ph"><span class="compare-main-style-ph__inner">—</span></span>
                          </template>
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
                <p
                  v-else-if="sec.kind !== 'metrics'"
                  class="compare-block-empty mt-4 py-8 text-center text-sm text-[#8a6f7d] dark:text-pink-300/80"
                >
                  {{ sec.emptyLabel }}
                </p>
              </section>
            </div>
          </template>
        </div>

        <div
          v-if="!compareLoading"
          class="compare-modal-share-footer shrink-0 border-t border-pink-200/35 px-3 py-3 dark:border-pink-900/30 sm:px-4"
        >
          <WardrobeCompareShareImage :payload="compareSharePayload" />
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<style scoped>
.wardrobe-statistics.neu-page {
  --neu-base: #e5dce2;
  --neu-raised: #ebe3e8;
  --neu-dent: #e4d9e0;
  --neu-shadow-d: rgba(150, 110, 130, 0.24);
  --neu-shadow-l: rgba(255, 252, 254, 0.94);
  --neu-inset-hi: rgba(255, 255, 255, 0.62);
  background: var(--neu-base);
}

.dark .wardrobe-statistics.neu-page {
  --neu-base: #19141a;
  --neu-raised: #241d26;
  --neu-dent: #18141a;
  --neu-shadow-d: rgba(0, 0, 0, 0.5);
  --neu-shadow-l: rgba(100, 70, 90, 0.1);
  --neu-inset-hi: rgba(255, 210, 230, 0.05);
}

.neu-header {
  background: var(--neu-base);
  box-shadow:
    0 10px 22px -10px var(--neu-shadow-d),
    inset 0 1px 0 var(--neu-inset-hi);
}

.compare-wardrobe-btn {
  background: var(--neu-raised);
  box-shadow:
    4px 4px 10px var(--neu-shadow-d),
    -3px -3px 10px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .compare-wardrobe-btn {
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.45),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 var(--neu-inset-hi);
}

.compare-wardrobe-btn:active {
  box-shadow:
    inset 3px 3px 8px var(--neu-shadow-d),
    inset -2px -2px 6px var(--neu-shadow-l);
}

/**
 * 弹窗 Teleport 到 body，不继承 `.wardrobe-statistics` 上的 CSS 变量，需自带不透明底色。
 */
.wardrobe-compare-modal {
  --neu-base: #e5dce2;
  --neu-raised: #ebe3e8;
  --neu-dent: #e4d9e0;
  --neu-shadow-d: rgba(150, 110, 130, 0.24);
  --neu-shadow-l: rgba(255, 252, 254, 0.94);
  --neu-inset-hi: rgba(255, 255, 255, 0.62);
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px var(--neu-shadow-d),
    -8px -8px 22px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .wardrobe-compare-modal {
  --neu-base: #19141a;
  --neu-raised: #241d26;
  --neu-dent: #18141a;
  --neu-shadow-d: rgba(0, 0, 0, 0.5);
  --neu-shadow-l: rgba(100, 70, 90, 0.1);
  --neu-inset-hi: rgba(255, 210, 230, 0.05);
  background-color: #241d26;
  box-shadow:
    8px 8px 22px var(--neu-shadow-d),
    -6px -6px 18px var(--neu-shadow-l),
    inset 1px 1px 0 var(--neu-inset-hi);
}

.compare-modal-toolbar,
.compare-vs-header,
.compare-modal-hint,
.compare-modal-share-footer {
  background-color: var(--neu-raised);
}

.compare-modal-scroll {
  background-color: var(--neu-raised);
}

.compare-block {
  margin-top: 0.25rem;
  border-radius: 1.25rem;
  padding: 1rem 0.875rem 1.125rem;
  background: var(--neu-dent);
  box-shadow:
    inset 4px 4px 10px var(--neu-shadow-d),
    inset -3px -3px 9px var(--neu-inset-hi);
}

.compare-block-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #4a2f3d;
}

.dark .compare-block-title {
  color: #fce7f0;
}

.compare-main-style-pill {
  background: var(--neu-raised);
  box-shadow:
    3px 3px 8px var(--neu-shadow-d),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.dark .compare-main-style-pill {
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 var(--neu-inset-hi);
}

.wardrobe-compare-modal .compare-main-style-pill--placeholder {
  pointer-events: none;
}

.wardrobe-compare-modal .compare-main-style-pill--placeholder .compare-main-style-ph__inner {
  opacity: 0;
}

.wardrobe-compare-modal .compare-main-style-ph {
  min-height: 1.15em;
}

.neu-back-btn {
  background: var(--neu-raised);
  box-shadow:
    4px 4px 10px var(--neu-shadow-d),
    -3px -3px 10px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.dark .neu-back-btn {
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.45),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 var(--neu-inset-hi);
}

.neu-back-btn:active {
  box-shadow:
    inset 3px 3px 8px var(--neu-shadow-d),
    inset -2px -2px 6px var(--neu-shadow-l);
}

.neu-expand-shops-btn {
  background: var(--neu-raised);
  box-shadow:
    3px 3px 8px var(--neu-shadow-d),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .neu-expand-shops-btn {
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 var(--neu-inset-hi);
}

.neu-expand-shops-btn:active {
  box-shadow:
    inset 2px 2px 6px var(--neu-shadow-d),
    inset -1px -1px 4px var(--neu-shadow-l);
}

.neu-inset-select {
  background: var(--neu-dent);
  box-shadow:
    inset 4px 4px 10px var(--neu-shadow-d),
    inset -3px -3px 9px var(--neu-inset-hi);
}

.wardrobe-scope-trigger {
  border: none;
  background: transparent;
  width: 100%;
  font-size: 0.875rem;
  line-height: 1.5rem;
}

.neu-well-in {
  background: var(--neu-dent);
  box-shadow:
    inset 6px 6px 14px var(--neu-shadow-d),
    inset -4px -4px 12px var(--neu-inset-hi);
}

.neu-spin-icon {
  background: var(--neu-raised);
  box-shadow:
    5px 5px 12px var(--neu-shadow-d),
    -4px -4px 12px var(--neu-shadow-l);
}

.neu-stat-card {
  background: var(--neu-raised);
  box-shadow:
    9px 9px 20px var(--neu-shadow-d),
    -8px -8px 20px var(--neu-shadow-l),
    inset 1px 1px 1px rgba(255, 255, 255, 0.55);
}

.dark .neu-stat-card {
  box-shadow:
    8px 8px 18px var(--neu-shadow-d),
    -6px -6px 16px var(--neu-shadow-l),
    inset 1px 1px 0 var(--neu-inset-hi);
}

.neu-stat-icon {
  background: var(--neu-raised);
  box-shadow:
    4px 4px 10px var(--neu-shadow-d),
    -3px -3px 10px var(--neu-shadow-l);
}

.neu-empty-icon {
  background: var(--neu-raised);
  box-shadow:
    5px 5px 12px var(--neu-shadow-d),
    -4px -4px 12px var(--neu-shadow-l);
}

/* 图鉴店铺页 polaroid + 拟态浅色阴影 */
.shop-stat-polaroid {
  background: var(--neu-raised);
  box-shadow:
    0 6px 22px rgba(130, 95, 115, 0.12),
    7px 7px 18px var(--neu-shadow-d),
    -6px -6px 18px var(--neu-shadow-l),
    inset 1px 1px 1px rgba(255, 255, 255, 0.52);
}

.dark .shop-stat-polaroid {
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.35),
    6px 6px 16px var(--neu-shadow-d),
    -5px -5px 14px var(--neu-shadow-l),
    inset 1px 1px 0 var(--neu-inset-hi);
}

.chart-body-neu {
  background: var(--neu-raised);
}

.neu-chart-well {
  background: var(--neu-dent);
  box-shadow:
    inset 5px 5px 12px var(--neu-shadow-d),
    inset -4px -4px 10px var(--neu-inset-hi);
}

.dark .neu-chart-well {
  box-shadow:
    inset 4px 4px 11px var(--neu-shadow-d),
    inset -3px -3px 8px var(--neu-inset-hi);
}

.stat-card {
  animation: stat-in 0.45s ease-out backwards;
}

.stat-card:nth-child(1) {
  animation-delay: 0.05s;
}

.stat-card:nth-child(2) {
  animation-delay: 0.1s;
}

.stat-card:nth-child(3) {
  animation-delay: 0.15s;
}

.chart-switcher {
  animation: panel-in 0.5s ease-out 0.08s backwards;
}

.neu-chart-card {
  background: var(--neu-raised);
  box-shadow:
    10px 10px 22px var(--neu-shadow-d),
    -10px -10px 22px var(--neu-shadow-l),
    inset 1px 1px 1px rgba(255, 255, 255, 0.55);
}

.dark .neu-chart-card {
  box-shadow:
    8px 8px 20px var(--neu-shadow-d),
    -6px -6px 18px var(--neu-shadow-l),
    inset 1px 1px 0 var(--neu-inset-hi);
}

.chart-tabs-bar {
  background: var(--neu-raised);
  box-shadow: inset 0 -3px 5px var(--neu-inset-hi);
}

.dark .chart-tabs-bar {
  box-shadow: inset 0 -1px 0 var(--neu-inset-hi);
}

.chart-tab-icon-neu {
  background: var(--neu-raised);
  box-shadow:
    5px 5px 12px var(--neu-shadow-d),
    -4px -4px 12px var(--neu-shadow-l);
}

.dark .chart-tab-icon-neu {
  background: #2a2228;
  box-shadow:
    4px 4px 10px rgba(0, 0, 0, 0.4),
    -3px -3px 10px var(--neu-shadow-l);
}

.chart-tab-rail {
  background: var(--neu-dent);
  box-shadow:
    inset 5px 5px 12px var(--neu-shadow-d),
    inset -4px -4px 10px var(--neu-inset-hi);
}

.dark .chart-tab-rail {
  background: var(--neu-dent);
  box-shadow:
    inset 4px 4px 10px var(--neu-shadow-d),
    inset -2px -2px 8px rgba(120, 80, 100, 0.06);
}

.chart-tab-btn {
  border: none;
  background: transparent;
}

.chart-tab-btn--idle {
  box-shadow: none;
}

.dark .chart-tab-btn--idle:hover {
  text-shadow: 0 0 12px rgba(250, 200, 220, 0.15);
}

.chart-tab-btn--active {
  font-weight: 600;
  background: var(--neu-raised);
  box-shadow:
    4px 4px 10px var(--neu-shadow-d),
    -3px -3px 10px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.dark .chart-tab-btn--active {
  background: #2e252c;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.5),
    -2px -2px 8px rgba(130, 90, 110, 0.08),
    inset 0 1px 0 var(--neu-inset-hi);
}

.chart-tab-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chart-tab-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

@keyframes stat-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
