<script setup lang="ts">
import {
  getWardrobeStatistics,
  type WardrobeStatisticsData,
} from '@/api/wardrobe'
import { getUserSpace } from '@/api/user'
import type { User } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import WardrobeCompareShareImage from '@/components/Wardrobe/WardrobeCompareShareImage.vue'
import QhxModal from '@/components/Qhx/Modal.vue'

const props = defineProps<{
  ownerUserId: number
}>()

const show = defineModel<boolean>({ default: false })

const configStore = useConfigStore()
const userStore = useUserStore()
const toast = useToast()

const compareLoading = ref(false)
const compareMineRaw = ref<WardrobeStatisticsData | null>(null)
const compareOwnerFullRaw = ref<WardrobeStatisticsData | null>(null)
const compareOwnerProfile = ref<User | null>(null)

function userFaceSrc(face: string | null | undefined): string {
  const path = face?.trim() ? face.trim() : 'static/plan_cover/default.jpg'
  if (/^https?:\/\//i.test(path)) return path
  return `${BASE_IMG}${path.replace(/^\//, '')}`
}

async function loadCompareData() {
  const myId = userStore.user?.user_id
  if (myId == null) {
    toast.add({ title: '请先登录后再对比', color: 'amber' })
    show.value = false
    return
  }
  compareLoading.value = true
  compareMineRaw.value = null
  compareOwnerFullRaw.value = null
  try {
    if (!configStore.config) {
      await configStore.getConfig()
    }
    const [mine, ownerFull, ownerInfo] = await Promise.all([
      getWardrobeStatistics({ user_id: myId }),
      getWardrobeStatistics({ user_id: props.ownerUserId }),
      getUserSpace({ user_id: props.ownerUserId }),
    ])
    compareMineRaw.value = mine
    compareOwnerFullRaw.value = ownerFull
    compareOwnerProfile.value = ownerInfo
  } catch (e) {
    console.error(e)
    toast.add({ title: '加载对比数据失败', color: 'red' })
    show.value = false
  } finally {
    compareLoading.value = false
  }
}

watch(show, (open) => {
  if (open) {
    loadCompareData()
  } else {
    compareMineRaw.value = null
    compareOwnerFullRaw.value = null
  }
})

function splitCsv(str: string | null | undefined): string[] {
  if (!str) return []
  return str.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

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
  kind?: 'tags' | 'metrics' | 'overlap'
  evalText?: string
  mineSlots: MainStyleCompareSlot[]
  ownerSlots: MainStyleCompareSlot[]
  mineMetrics?: { label: string; value: string }[]
  ownerMetrics?: { label: string; value: string }[]
  overlapCount?: number
  mineUniqueCount?: number
  ownerUniqueCount?: number
  hasData: boolean
  emptyLabel: string
}

function extractLibraryIdSet(raw: WardrobeStatisticsData | null): Set<number> {
  const library = raw?.library && Array.isArray(raw.library) ? raw.library : []
  const set = new Set<number>()
  for (const el of library) {
    const id = el.library_id
    if (id == null) continue
    const n = Number(id)
    if (!Number.isNaN(n) && n > 0) set.add(n)
  }
  return set
}

function compareLibraryIdOverlapStats(
  mine: WardrobeStatisticsData | null,
  owner: WardrobeStatisticsData | null,
): { overlapCount: number; mineUniqueCount: number; ownerUniqueCount: number } {
  const mineSet = extractLibraryIdSet(mine)
  const ownerSet = extractLibraryIdSet(owner)
  let overlapCount = 0
  for (const id of mineSet) {
    if (ownerSet.has(id)) overlapCount++
  }
  return {
    overlapCount,
    mineUniqueCount: mineSet.size,
    ownerUniqueCount: ownerSet.size,
  }
}

const compareOverlapLibraryStats = computed(() =>
  compareLibraryIdOverlapStats(compareMineRaw.value, compareOwnerFullRaw.value),
)

const compareOverlapEvalText = computed(() => {
  const { overlapCount, mineUniqueCount, ownerUniqueCount } = compareOverlapLibraryStats.value
  if (mineUniqueCount === 0 && ownerUniqueCount === 0) {
    return '双方衣柜中暂无可统计的图鉴 ID，无法计算重合。'
  }
  if (overlapCount === 0) {
    return '按服饰关联图鉴统计，目前没有共同收录的款式。'
  }
  const minePct = mineUniqueCount > 0 ? (overlapCount / mineUniqueCount) * 100 : 0
  const ownerPct = ownerUniqueCount > 0 ? (overlapCount / ownerUniqueCount) * 100 : 0
  return `共同拥有 ${overlapCount} 款图鉴；约占你 ${formatComparePct(minePct)} 的收录、对方 ${formatComparePct(ownerPct)} 的收录。`
})

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
      id: 'library_overlap',
      kind: 'overlap',
      title: '图鉴重合',
      evalText: compareOverlapEvalText.value,
      overlapCount: compareOverlapLibraryStats.value.overlapCount,
      mineUniqueCount: compareOverlapLibraryStats.value.mineUniqueCount,
      ownerUniqueCount: compareOverlapLibraryStats.value.ownerUniqueCount,
      mineSlots: [],
      ownerSlots: [],
      hasData: true,
      emptyLabel: '',
    },
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
  ownerName: compareOwnerProfile.value?.user_name || `用户${props.ownerUserId}`,
  mineFace: userStore.user?.user_face || 'static/plan_cover/default.jpg',
  ownerFace: compareOwnerProfile.value?.user_face || 'static/plan_cover/default.jpg',
  hint: '对比范围为双方全部衣柜（与页面「统计范围」筛选无关）',
  sections: compareModalSections.value.map((sec) => {
    if (sec.kind === 'overlap') {
      return {
        title: sec.title,
        kind: 'overlap' as const,
        evalText: sec.evalText,
        hasData: sec.hasData,
        overlapCount: sec.overlapCount,
        mineUniqueCount: sec.mineUniqueCount,
        ownerUniqueCount: sec.ownerUniqueCount,
        mineRows: [],
        ownerRows: [],
      }
    }
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
</script>

<template>
  <QhxModal v-model="show">
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
          @click="show = false"
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

              <template v-else-if="sec.kind === 'overlap' && sec.hasData">
                <div class="compare-overlap-stat mt-3 rounded-2xl px-4 py-5 text-center">
                  <p class="compare-overlap-stat__value tabular-nums text-[#9d4080] dark:text-pink-300">
                    {{ sec.overlapCount ?? 0 }}
                  </p>
                  <p class="mt-1 text-xs text-[#8a6f7d] dark:text-pink-300/80">
                    重合服饰
                  </p>
                  <p class="mt-2 text-[11px] text-[#6b4f5f] dark:text-pink-300/85">
                    你 {{ sec.mineUniqueCount ?? 0 }} 款 · 对方 {{ sec.ownerUniqueCount ?? 0 }} 款
                  </p>
                </div>
              </template>

              <template v-else-if="sec.hasData && sec.kind !== 'overlap'">
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
                v-else-if="sec.kind !== 'metrics' && sec.kind !== 'overlap'"
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
</template>

<style scoped>
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

.compare-overlap-stat {
  background: var(--neu-raised);
  box-shadow:
    3px 3px 8px var(--neu-shadow-d),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.dark .compare-overlap-stat {
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -2px -2px 8px var(--neu-shadow-l),
    inset 0 1px 0 var(--neu-inset-hi);
}

.compare-overlap-stat__value {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.1;
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
</style>
