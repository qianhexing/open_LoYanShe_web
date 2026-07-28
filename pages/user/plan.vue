<template>
  <div class="plan-page relative min-h-screen w-full overflow-x-hidden">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
      aria-hidden="true"
    />
    <div class="container mx-auto p-2 pb-20 max-w-4xl">
    <!-- 功能栏 -->
    <div
      v-if="pageReady && !authBootstrapping && userStore.user"
      class="flex justify-between items-center sticky z-10 mb-4"
      :style="{ top: `${10 + (configStore.statusBarHeight || 0)}px` }"
    >
      <div class="flex flex-wrap items-center gap-2">
        <QhxJellyButton>
          <!-- h-[40px] -->
          <div class=" text-center px-1 cursor-pointer" @click="(e: MouseEvent) => openAddPlan(e)">
            <div class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary shadow-[0_4px_10px_rgba(255,158,181,0.35)]">
              <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
            </div>
            <!-- <div class="text-sm text-qhx-text">新建</div> -->
          </div>
        </QhxJellyButton>
        <!-- 按月/按日/统计切换 -->
        <div class="flex rounded-lg border border-qhx-primary/20 overflow-hidden bg-[#fffbfc]">
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'month' ? 'bg-qhx-primary text-white' : 'bg-transparent text-[#9a858a] hover:bg-qhx-primary/10'"
            @click="switchViewMode('month')"
          >
            按月
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'day' ? 'bg-qhx-primary text-white' : 'bg-transparent text-[#9a858a] hover:bg-qhx-primary/10'"
            @click="switchViewMode('day')"
          >
            按日
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'all' ? 'bg-qhx-primary text-white' : 'bg-transparent text-[#9a858a] hover:bg-qhx-primary/10'"
            @click="switchViewMode('all')"
          >
            统计
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UToggle
          v-model="emailNotice"
          color="primary"
          @update:model-value="handleEmailNoticeChange"
        />
        <span class="text-xs text-[#9a858a]">订阅邮件通知</span>
      </div>
      <!-- <div class="flex flex-wrap">
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1 cursor-pointer" @click="scrollToStatistics">
            <div class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-info">
              <UIcon name="i-heroicons-chart-bar" class="text-[22px] text-[#ffffff]" />
            </div>
            <div class="text-sm text-qhx-text">统计</div>
          </div>
        </QhxJellyButton>
      </div> -->
    </div>

    <!-- 统计卡片区域 -->
    <div ref="statisticsRef" v-if="pageReady && !authBootstrapping && userStore.user && viewMode === 'all'" class="mb-4 space-y-3">
      <h2 class="plan-stats-section-title px-1">概览</h2>
      <div v-if="isLoading && planList.length === 0" class="text-center py-6 text-[#9a858a] text-xs">加载中...</div>
      <template v-else>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="plan-stats-metric">
          <div class="plan-stats-metric-icon">
            <UIcon name="i-heroicons-heart" class="w-4 h-4" />
          </div>
          <div class="plan-stats-metric-title">完成</div>
          <div class="plan-stats-metric-sub">计划进度</div>
          <div class="plan-stats-metric-value">{{ displayStatistics.is_complete || 0 }} / {{ displayStatistics.total_plan || 0 }}</div>
        </div>
        <div class="plan-stats-metric">
          <div class="plan-stats-metric-icon">
            <UIcon name="i-heroicons-moon" class="w-4 h-4" />
          </div>
          <div class="plan-stats-metric-title">攒钱</div>
          <div class="plan-stats-metric-sub">资金进度</div>
          <div class="plan-stats-metric-value">￥{{ formatMoney(displayStatistics.have_money || 0) }}</div>
        </div>
      </div>

      <div class="plan-stats-pulse">
        <div class="flex items-start gap-3 mb-4">
          <div class="plan-stats-metric-icon">
            <UIcon name="material-symbols:ecg-heart" class="w-4 h-4" />
          </div>
          <div>
            <div class="plan-stats-metric-title leading-none">Pulse</div>
            <div class="plan-stats-metric-sub mt-1">攒钱状态</div>
          </div>
        </div>
        <div class="space-y-3.5">
          <div v-for="row in pulseRows" :key="row.label" class="plan-stats-pulse-row">
            <div class="plan-stats-pulse-label">{{ row.label }}</div>
            <div class="plan-stats-pulse-track">
              <div class="plan-stats-pulse-fill" :style="{ width: `${row.percent}%` }" />
            </div>
            <div class="plan-stats-pulse-value">{{ row.display }}</div>
          </div>
        </div>
        <div v-if="remainMoney > 0" class="plan-stats-pulse-foot">
          <span class="plan-stats-pulse-cross" aria-hidden="true">+</span>
          <span>注意尾款 · 还需 ￥{{ formatMoney(remainMoney) }}</span>
          <span class="plan-stats-pulse-cross" aria-hidden="true">+</span>
        </div>
      </div>

      <!-- 年统计 -->
      <div class="plan-stats-years">
        <div class="flex items-center justify-between gap-2 mb-3 px-0.5">
          <div>
            <div class="plan-stats-metric-title leading-none">年统计</div>
            <div class="plan-stats-metric-sub mt-1">Year archive</div>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-md bg-white/80 border border-qhx-primary/20 hover:bg-qhx-primary/10"
              @click="yearRangeStart = yearRangeStart - 6; fetchYearsTotal()"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5 text-[#9a858a]" />
            </button>
            <span class="text-[11px] font-semibold text-[#4f3f43] min-w-[72px] text-center">{{ yearRangeStart }}-{{ yearRangeStart + 5 }}</span>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-md bg-white/80 border border-qhx-primary/20 hover:bg-qhx-primary/10"
              @click="yearRangeStart = yearRangeStart + 6; fetchYearsTotal()"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-[#9a858a]" />
            </button>
          </div>
        </div>
        <div v-if="yearsTotalLoading" class="text-center py-6 text-[#9a858a] text-xs">加载中...</div>
        <div v-else class="grid grid-cols-3 gap-2">
          <div
            v-for="y in yearRangeBlocks"
            :key="y.year"
            class="plan-stats-year-cell"
          >
            <span class="text-xs text-[#9a858a]">{{ y.year }}</span>
            <span class="plan-stats-year-have" :class="{ 'has-value': y.have_money > 0 }">已补￥{{ formatMoney(y.have_money) }}</span>
            <span class="plan-stats-year-unpaid" :class="{ 'has-value': y.unpaid_money > 0 }">未补￥{{ formatMoney(y.unpaid_money) }}</span>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- 按月视图 -->
    <div v-if="pageReady && !authBootstrapping && userStore.user && viewMode === 'month'" class="space-y-1">
      <!-- 年份切换 -->
      <div class="flex items-center gap-1.5 mb-1.5 px-1">
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10"
          @click="yearSelect = yearSelect - 1; fetchYearTotal()"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5 text-[#9a858a]" />
        </button>
        <span class="text-xs font-semibold text-[#4f3f43] min-w-[52px] text-center">{{ yearSelect }}年</span>
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10"
          @click="yearSelect = yearSelect + 1; fetchYearTotal()"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-[#9a858a]" />
        </button>
      </div>
      <!-- 月度汇总：12个月按块分布，无数据补0 -->
      <div v-if="monthTotalLoading" class="text-center py-6 text-[#9a858a] text-xs">加载中...</div>
      <div v-else class="space-y-1">
        <div
          v-for="(row, rowIndex) in monthRowChunks"
          :key="rowIndex"
          class="grid grid-cols-4 gap-1"
        >
          <button
            v-for="m in row"
            :key="m.month"
            type="button"
            class="px-1.5 py-1.5 flex flex-col items-center gap-0.5 rounded-md border border-qhx-primary/20 bg-[#fffbfc] hover:bg-qhx-primary/5 active:scale-[0.98] transition-all text-center min-w-0"
            :class="{ 'ring-1 ring-qhx-primary border-qhx-primary': expandedMonth === m.month }"
            @click="toggleMonthExpand(m.month)"
          >
            <span class="text-xs leading-tight text-[#9a858a]">{{ m.month }}月</span>
            <span class="text-[10px] leading-tight tabular-nums truncate w-full" :class="m.have_money > 0 ? 'text-[#6f9474]' : 'text-[#c4b4b7]'">已补￥{{ formatMoney(m.have_money) }}</span>
            <span class="text-[10px] leading-tight tabular-nums truncate w-full" :class="m.unpaid_money > 0 ? 'text-[#e05353]' : 'text-[#c4b4b7]'">未补￥{{ formatMoney(m.unpaid_money) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 按日视图 -->
    <div v-if="pageReady && !authBootstrapping && userStore.user && viewMode === 'day'" class="space-y-1">
      <!-- 年月切换 -->
      <div class="flex items-center gap-1.5 mb-1.5 px-1 flex-wrap">
        <div class="flex items-center gap-0.5">
          <button type="button" class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10" @click="yearSelect = yearSelect - 1; fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5 text-[#9a858a]" />
          </button>
          <span class="text-xs font-semibold text-[#4f3f43] min-w-[44px] text-center">{{ yearSelect }}年</span>
          <button type="button" class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10" @click="yearSelect = yearSelect + 1; fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-[#9a858a]" />
          </button>
        </div>
        <div class="flex items-center gap-0.5">
          <button type="button" class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10" @click="dayMonthSelect = Math.max(1, dayMonthSelect - 1); fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5 text-[#9a858a]" />
          </button>
          <span class="text-xs font-semibold text-[#4f3f43] min-w-[32px] text-center">{{ dayMonthSelect }}月</span>
          <button type="button" class="w-7 h-7 flex items-center justify-center rounded-md bg-[#fffbfc] border border-qhx-primary/20 hover:bg-qhx-primary/10" @click="dayMonthSelect = Math.min(12, dayMonthSelect + 1); fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-[#9a858a]" />
          </button>
        </div>
      </div>
      <!-- 日块：7 列网格 -->
      <div v-if="dayTotalLoading" class="text-center py-6 text-[#9a858a] text-xs">加载中...</div>
      <div v-else>
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="d in allDaysInMonth"
            :key="d.day"
            type="button"
            class="px-1 py-1.5 flex flex-col items-center gap-0.5 rounded-md border border-qhx-primary/20 bg-[#fffbfc] hover:bg-qhx-primary/5 active:scale-[0.98] transition-all text-center min-w-0"
            :class="{ 'ring-1 ring-qhx-primary border-qhx-primary': expandedDay === d.day }"
            @click="toggleDayExpand(d.day)"
          >
            <span class="text-[10px] leading-tight text-[#9a858a]">{{ d.day }}日</span>
            <span class="text-[9px] leading-tight tabular-nums truncate w-full" :class="d.have_money > 0 ? 'text-[#6f9474]' : 'text-[#c4b4b7]'">已补￥{{ formatMoney(d.have_money) }}</span>
            <span class="text-[9px] leading-tight tabular-nums truncate w-full" :class="d.unpaid_money > 0 ? 'text-[#e05353]' : 'text-[#c4b4b7]'">未补￥{{ formatMoney(d.unpaid_money) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 计划列表（完整列表与筛选列表互斥） -->
    <div
      v-if="pageReady && !authBootstrapping && userStore.user && viewMode !== 'all'"
      class="mt-4"
      :class="hasCalendarSelection
        ? 'bg-[#fffbfc] rounded-lg border border-qhx-primary/20'
        : 'space-y-2'"
    >
      <div
        v-if="hasCalendarSelection"
        class="px-3 py-2 border-b border-qhx-primary/20"
      >
        <div class="text-xs font-medium text-[#4f3f43]">{{ filteredListTitle }}</div>
        <div
          v-if="selectedPeriodMoneySummary"
          class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
        >
          <span :class="selectedPeriodMoneySummary.have_money > 0 ? 'text-[#6f9474]' : 'text-[#9a858a]'">
            已补总数 ￥{{ formatMoney(selectedPeriodMoneySummary.have_money) }}
          </span>
          <span :class="selectedPeriodMoneySummary.unpaid_money > 0 ? 'text-[#e05353]' : 'text-[#9a858a]'">
            需补总数 ￥{{ formatMoney(selectedPeriodMoneySummary.unpaid_money) }}
          </span>
        </div>
      </div>
      <div :class="hasCalendarSelection ? 'px-2 py-2' : ''">
        <div v-if="isListLoading" class="text-center py-6 text-[#9a858a] text-xs">加载中...</div>
        <div v-else-if="activeDisplayPlans.length === 0" class="text-center py-12 text-[#9a858a] text-xs">暂无计划</div>
        <div v-else class="space-y-2">
          <div v-for="item in activeDisplayPlans" :key="item.list_id" class="px-1">
            <PlanListItem
              :item="item"
              :variant="hasCalendarSelection ? 'compact' : 'full'"
              :add-loading="addLoading"
              :has-children="hasChildren(item)"
              :is-expanded="isExpanded(item.list_id)"
              :wardrobe-clothes="getWardrobeClothes(item)"
              :image-params="imageParams"
              @cover="showCover"
              @edit="editPlan"
              @delete="confirmDeletePlan"
              @complete="confirmCompletePlan"
              @toggle-expand="toggleExpand"
              @click="handlePlanClick"
              @add-money="addHaveMoney(item.list_id, $event)"
              @link-clothes="openClothesChoose(item)"
              @unlink-clothes="handleUnlinkClothes(item)"
              @jump-clothes="jumpToClothes"
            />
          </div>
        </div>
        <div v-if="!hasCalendarSelection && hasMore && !isLoading" class="text-center py-4">
          <UButton
            @click="loadMore"
            color="gray"
            variant="outline"
            :loading="isLoadingMore"
          >
            加载更多
          </UButton>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!pageReady || authBootstrapping" class="text-center py-12">
      <div class="text-[#9a858a]">加载中...</div>
    </div>
    <div v-else-if="!userStore.user" class="text-center py-12">
      <div class="text-[#9a858a]">请先登录后查看定尾计划</div>
    </div>
  </div>

  <!-- 添加/编辑计划弹窗 -->
  <PlanAddEdit
    ref="planAddEditRef"
    :plan-list="editPlanData"
    @success="handlePlanSuccess"
    @insert="handlePlanSuccess"
    @updated="handlePlanSuccess"
  />
  
  <!-- 删除确认弹窗 -->
  <UModal v-model="deleteModal" :ui="{ width: 'max-w-md' }">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">操作确认</h3>
      </template>
      <div class="py-4">
        <p class="text-gray-600 dark:text-gray-400">确定要删除该计划吗？</p>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton color="gray" variant="outline" @click="deleteModal = false">取消</UButton>
          <UButton color="red" @click="handleDelete" :loading="deleteLoading">确认删除</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
  
  <!-- 完成确认弹窗 -->
  <UModal v-model="completeModal" :ui="{ width: 'max-w-md' }">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">操作确认</h3>
      </template>
      <div class="py-4">
        <p class="text-gray-600 dark:text-gray-400">确定要完成该计划吗？</p>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton color="gray" variant="outline" @click="completeModal = false">取消</UButton>
          <UButton color="primary" @click="handleComplete" :loading="completeLoading">确认完成</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
  
  <!-- 封面预览 -->
  <QhxPreviewImage
    v-if="coverPreview.length > 0"
    :list="coverPreview.map(img => ({ src: img.replace(BASE_IMG, ''), alt: '计划封面' }))"
    :preview="coverPreview.map(img => img.replace(BASE_IMG, ''))"
    className="hidden"
  />

  <!-- 邮箱绑定弹窗 -->
  <EmailBindModal
    v-model="showEmailModal"
    :user="userStore.user"
    @success="handleEmailBindSuccess"
  />

  <!-- 选择衣柜服饰弹框 -->
  <WardrobeClothesChoose ref="wardrobeClothesChooseRef" @choose="handleClothesChoose" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, watch, nextTick } from 'vue'
import { getPlanList, getPlanListByMonth, getPlanTotalByYear, getPlanTotalByYears, getPlanTotalByDay, deletePlanList, updatePlanMoney, planComplete, planListRelate, type PlanPeriodMoneyTotal } from '@/api/plan'
import type { PlanList, PaginationResponse, WardrobeClothes, ParentPlanSummary } from '@/types/api'
import type PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import EmailBindModal from '@/components/user/EmailBindModal.vue'
// biome-ignore lint/style/useImportType: 组件在 template 中使用
import WardrobeClothesChoose from '@/components/Wardrobe/WardrobeClothesChoose.vue'
import PlanListItem from '@/components/Plan/PlanListItem.vue'

/**
 * 本地就绪态，不依赖 layout 的 layoutReady。
 * 注意：不要再用 ssr:false——刷新时 ClientOnly 空壳 + Nuxt 进度条会一直转，页面完全白屏。
 */
const pageReady = ref(true)
/** 挂载后补登录态期间的过渡，避免闪「请先登录」 */
const authBootstrapping = ref(true)
const planAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()
const port = computed(() => configStore.getPort())

// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any

// 视图模式：统计 | 按月 | 按日
const viewMode = ref<'all' | 'month' | 'day'>('month')

type PeriodMoneySummary = Required<Pick<PlanPeriodMoneyTotal, 'total_money' | 'have_money' | 'unpaid_money'>> & {
  month?: number
  day?: number
  year?: number
}

// 统计页年汇总
const currentYear = new Date().getFullYear()
const yearRangeStart = ref(currentYear - 2)
const yearsTotalsMap = ref<Record<number, PeriodMoneySummary>>({})
const yearsTotalLoading = ref(false)

const yearRangeBlocks = computed(() => {
  return Array.from({ length: 6 }, (_, i) => {
    const year = yearRangeStart.value + i
    const item = yearsTotalsMap.value[year]
    return {
      year,
      total_money: item?.total_money ?? 0,
      have_money: item?.have_money ?? 0,
      unpaid_money: item?.unpaid_money ?? 0
    }
  })
})

// 按月视图相关
const yearSelect = ref(new Date().getFullYear())

const monthTotals = ref<PeriodMoneySummary[]>([])
const monthTotalLoading = ref(false)
const expandedMonth = ref<number | null>(null)
const monthPlanList = ref<Record<number, PlanList[]>>({})
const monthPlanLoading = ref<Record<number, boolean>>({})

// 12个月块分布，无数据补0
const all12Months = computed(() => {
  const map = Object.fromEntries(monthTotals.value.map((m) => [m.month, m]))
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const item = map[month]
    return {
      month,
      total_money: item?.total_money ?? 0,
      have_money: item?.have_money ?? 0,
      unpaid_money: item?.unpaid_money ?? 0
    }
  })
})

const monthRowChunks = computed(() => {
  const months = all12Months.value
  return [months.slice(0, 4), months.slice(4, 8), months.slice(8, 12)]
})

// 按日视图相关
const dayMonthSelect = ref(new Date().getMonth() + 1)
const dayTotals = ref<PeriodMoneySummary[]>([])
const dayTotalLoading = ref(false)
const expandedDay = ref<number | null>(null)

const daysInCurrentMonth = computed(() => new Date(yearSelect.value, dayMonthSelect.value, 0).getDate())

const allDaysInMonth = computed(() => {
  const map = Object.fromEntries(dayTotals.value.map((d) => [d.day, d]))
  return Array.from({ length: daysInCurrentMonth.value }, (_, i) => {
    const day = i + 1
    const item = map[day]
    return {
      day,
      total_money: item?.total_money ?? 0,
      have_money: item?.have_money ?? 0,
      unpaid_money: item?.unpaid_money ?? 0
    }
  })
})

const plansForExpandedDay = computed(() => {
  const day = expandedDay.value
  const month = dayMonthSelect.value
  if (day === null || !monthPlanList.value[month]) return []
  return monthPlanList.value[month].filter((p) => {
    if (!p.end_time) return false
    return dayjs(p.end_time).date() === day
  })
})

const hasCalendarSelection = computed(() => {
  if (viewMode.value === 'month') return expandedMonth.value !== null
  if (viewMode.value === 'day') return expandedDay.value !== null
  return false
})

const filteredListTitle = computed(() => {
  if (viewMode.value === 'month' && expandedMonth.value !== null) {
    return `${yearSelect.value}年${expandedMonth.value}月 计划列表`
  }
  if (viewMode.value === 'day' && expandedDay.value !== null) {
    return `${yearSelect.value}年${dayMonthSelect.value}月${expandedDay.value}日 计划列表`
  }
  return ''
})

const displayedFilteredPlans = computed(() => {
  if (viewMode.value === 'month' && expandedMonth.value !== null) {
    return monthPlanList.value[expandedMonth.value] ?? []
  }
  if (viewMode.value === 'day' && expandedDay.value !== null) {
    return plansForExpandedDay.value
  }
  return []
})

const isFilteredListLoading = computed(() => {
  if (viewMode.value === 'month' && expandedMonth.value !== null) {
    return monthPlanLoading.value[expandedMonth.value] ?? false
  }
  if (viewMode.value === 'day' && expandedDay.value !== null) {
    return monthPlanLoading.value[dayMonthSelect.value] ?? false
  }
  return false
})

const activeDisplayPlans = computed(() => {
  if (hasCalendarSelection.value) return displayedFilteredPlans.value
  return planList.value
})

const isListLoading = computed(() => {
  if (hasCalendarSelection.value) return isFilteredListLoading.value
  return isLoading.value
})

const imageParams = computed(() => configStore.config?.image_params || '')

// 计划列表数据
const planList = ref<PlanList[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const expandedPlans = ref<Set<number>>(new Set())
const statistics = ref<{
  total_plan?: number
  is_complete?: number
  have_money?: number
  need_money?: number
} | null>(null)

/** 接口未返回 statistics 时用列表汇总兜底，避免切到「统计」白屏 */
const buildStatisticsFromPlans = (plans: PlanList[]) => {
  let have_money = 0
  let need_money = 0
  let is_complete = 0
  for (const plan of plans) {
    have_money += Number(plan.have_money) || 0
    need_money += Number(plan.need_money) || 0
    if (Number(plan.is_complete) === 1) is_complete += 1
  }
  return {
    total_plan: total.value || plans.length,
    is_complete,
    have_money,
    need_money
  }
}

const displayStatistics = computed(() => {
  if (statistics.value) return statistics.value
  if (planList.value.length > 0 || total.value > 0) {
    return buildStatisticsFromPlans(planList.value)
  }
  return {
    total_plan: 0,
    is_complete: 0,
    have_money: 0,
    need_money: 0
  }
})

const remainMoney = computed(() => {
  const need = displayStatistics.value?.need_money || 0
  const have = displayStatistics.value?.have_money || 0
  return Math.max(0, need - have)
})

const pulseRows = computed(() => {
  const totalPlan = displayStatistics.value?.total_plan || 0
  const complete = displayStatistics.value?.is_complete || 0
  const have = displayStatistics.value?.have_money || 0
  const need = displayStatistics.value?.need_money || 0
  const remain = Math.max(0, need - have)
  const completeRate = totalPlan > 0 ? Math.min(100, Math.round((complete / totalPlan) * 100)) : 0
  const moneyRate = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 0
  const remainRate = need > 0 ? Math.min(100, Math.round((remain / need) * 100)) : 0
  const pending = Math.max(0, totalPlan - complete)
  const pendingRate = totalPlan > 0 ? Math.min(100, Math.round((pending / totalPlan) * 100)) : 0
  const toDec = (n: number) => `.${String(Math.min(99, Math.round(n))).padStart(2, '0')}`

  return [
    { label: '完成率', percent: completeRate, display: toDec(completeRate) },
    { label: '攒钱进度', percent: moneyRate, display: toDec(moneyRate) },
    { label: '待完成', percent: pendingRate, display: toDec(pendingRate) },
    { label: '剩余占比', percent: remainRate, display: toDec(remainRate) }
  ]
})

// 编辑相关
const editPlanData = ref<PlanList | null>(null)

// 删除相关
const deleteModal = ref(false)
const deleteId = ref<number | null>(null)
const deleteLoading = ref(false)

// 完成相关
const completeModal = ref(false)
const completeId = ref<number | null>(null)
const completeLoading = ref(false)

// 添加金额相关
const addLoading = ref(false)

// 关联服饰相关
const planForClothes = ref<PlanList | null>(null)
const linkClothesLoading = ref(false)

// 封面预览
const coverPreview = ref<string[]>([])

// 订阅邮件通知
const getEmailNoticeInitialValue = () => {
  if (userStore.user?.message_config && typeof userStore.user.message_config === 'object') {
    return (userStore.user.message_config as Record<string, boolean>).email_notice === true
  }
  return false
}
const emailNotice = ref(getEmailNoticeInitialValue())
const showEmailModal = ref(false)

// 处理订阅邮件通知状态变化
const handleEmailNoticeChange = async (value: boolean) => {
  if (value) {
    const currentUser = userStore.user
    if (!currentUser?.email) {
      emailNotice.value = false
      showEmailModal.value = true
      return
    }
    try {
      await userStore.updateUserInfo({
        message_config: {
          ...(currentUser.message_config as Record<string, unknown> || {}),
          email_notice: value
        }
      })
      emailNotice.value = value
      toast.add({
        title: '已开启订阅邮件通知',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } catch (error) {
      console.error('保存订阅状态失败:', error)
      emailNotice.value = false
      toast.add({
        title: '保存订阅状态失败',
        description: error instanceof Error ? error.message : '未知错误',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
    }
  } else {
    try {
      const currentUser = userStore.user
      await userStore.updateUserInfo({
        message_config: {
          ...(currentUser?.message_config as Record<string, unknown> || {}),
          email_notice: false
        }
      })
      emailNotice.value = value
      toast.add({
        title: '已关闭订阅邮件通知',
        icon: 'i-heroicons-information-circle',
        color: 'gray'
      })
    } catch (error) {
      console.error('保存订阅状态失败:', error)
      emailNotice.value = !value
      toast.add({
        title: '保存订阅状态失败',
        description: error instanceof Error ? error.message : '未知错误',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
    }
  }
}

// 邮箱绑定成功回调
const handleEmailBindSuccess = async () => {
  try {
    const currentUser = userStore.user
    if (currentUser?.email && !emailNotice.value) {
      await userStore.updateUserInfo({
        message_config: {
          ...(currentUser.message_config as Record<string, unknown> || {}),
          email_notice: true
        }
      })
      emailNotice.value = true
      toast.add({
        title: '已开启订阅邮件通知',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    console.error('保存订阅状态失败:', error)
  }
}

// 是否有更多数据
const hasMore = computed(() => {
  return planList.value.length < total.value
})

// 检查是否有子计划
const hasChildren = (item: PlanList): boolean => {
  return !!(item.plan_list && item.plan_list.length > 0)
}

// 检查是否展开
const isExpanded = (planId: number | undefined): boolean => {
  if (!planId) return false
  return expandedPlans.value.has(planId)
}

// 格式化日期
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return ''
  try {
    return dayjs(date).format('YYYY-MM-DD')
  } catch {
    return String(date)
  }
}

// 格式化金额
const formatMoney = (money: number | undefined): string => {
  if (money === undefined || money === null) return '0'
  return Number(money).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

// 计算进度百分比
const getProgress = (item: PlanList): number => {
  const needMoney = item.need_money || 0
  const haveMoney = item.have_money || 0
  if (needMoney === 0) return 0
  const progress = (haveMoney / needMoney) * 100
  return Math.min(Math.max(Math.round(progress), 0), 100)
}

// 获取计划列表
const fetchPlanList = async (isLoadMore = false, force = false) => {
  if (!force && (isLoading.value || isLoadingMore.value)) return
  
  if (isLoadMore) {
    isLoadingMore.value = true
  } else {
    isLoading.value = true
    page.value = 1
  }
  
  try {
    const response = await getPlanList({
      page: page.value,
      pageSize: pageSize.value
    })
    
    // 只显示顶级计划（parent_id 为空或0的计划）
    const topLevelPlans = response.rows.filter((plan: PlanList) => !plan.parent_id || plan.parent_id === 0)

    const nextExpanded = isLoadMore ? new Set(expandedPlans.value) : new Set<number>()
    for (const plan of topLevelPlans) {
      if (plan.list_id && hasChildren(plan)) {
        nextExpanded.add(plan.list_id)
      }
    }
    expandedPlans.value = nextExpanded

    if (isLoadMore) {
      planList.value = [...planList.value, ...topLevelPlans]
    } else {
      planList.value = topLevelPlans
    }
    
    total.value = response.count
    page.value += 1
    
    // 尝试从响应中获取统计数据；没有则用列表兜底，保证「统计」tab 可渲染
    const responseWithStats = response as PaginationResponse<PlanList> & { statistics?: typeof statistics.value }
    if (responseWithStats.statistics) {
      statistics.value = responseWithStats.statistics
    } else if (!isLoadMore) {
      statistics.value = buildStatisticsFromPlans(topLevelPlans)
    }
  } catch (error) {
    console.error('获取计划列表失败:', error)
    toast.add({
      title: '获取计划列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

// 加载更多
const loadMore = () => {
  if (hasMore.value && !isLoading.value && !isLoadingMore.value) {
    fetchPlanList(true)
  }
}

const emptyPeriodMoney = (): PeriodMoneySummary => ({
  total_money: 0,
  have_money: 0,
  unpaid_money: 0
})

const aggregatePlansMoney = (plans: PlanList[]): PeriodMoneySummary => {
  const summary = emptyPeriodMoney()
  for (const plan of plans) {
    const need = Number(plan.need_money) || 0
    const have = Number(plan.have_money) || 0
    summary.total_money += need
    summary.have_money += have
    if (plan.is_complete !== 1) {
      summary.unpaid_money += Math.max(need - have, 0)
    }
  }
  return summary
}

const selectedPeriodMoneySummary = computed((): PeriodMoneySummary | null => {
  if (!hasCalendarSelection.value) return null

  if (!isFilteredListLoading.value) {
    return aggregatePlansMoney(displayedFilteredPlans.value)
  }

  if (viewMode.value === 'month' && expandedMonth.value !== null) {
    const item = all12Months.value.find((m) => m.month === expandedMonth.value)
    if (item) {
      return {
        total_money: item.total_money,
        have_money: item.have_money,
        unpaid_money: item.unpaid_money
      }
    }
  }

  if (viewMode.value === 'day' && expandedDay.value !== null) {
    const item = allDaysInMonth.value.find((d) => d.day === expandedDay.value)
    if (item) {
      return {
        total_money: item.total_money,
        have_money: item.have_money,
        unpaid_money: item.unpaid_money
      }
    }
  }

  return emptyPeriodMoney()
})

const hasApiMoneyBreakdown = (items: PlanPeriodMoneyTotal[] | null | undefined) =>
  Array.isArray(items) && items.some((item) => item.have_money != null || item.unpaid_money != null)

const buildMonthTotals = (apiTotals: PlanPeriodMoneyTotal[] | null | undefined): PeriodMoneySummary[] => {
  const safeTotals = Array.isArray(apiTotals) ? apiTotals : []
  const apiMap = Object.fromEntries(safeTotals.map((item) => [item.month, item]))
  const useApiBreakdown = hasApiMoneyBreakdown(safeTotals)

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const api = apiMap[month]
    const aggregated = aggregatePlansMoney(monthPlanList.value[month] || [])

    return {
      month,
      total_money: api?.total_money ?? aggregated.total_money,
      have_money: useApiBreakdown && api?.have_money != null ? api.have_money : aggregated.have_money,
      unpaid_money: useApiBreakdown && api?.unpaid_money != null ? api.unpaid_money : aggregated.unpaid_money
    }
  })
}

const buildDayTotals = (
  apiTotals: PlanPeriodMoneyTotal[] | null | undefined,
  month: number,
  year: number
): PeriodMoneySummary[] => {
  const safeTotals = Array.isArray(apiTotals) ? apiTotals : []
  const apiMap = Object.fromEntries(safeTotals.map((item) => [item.day, item]))
  const useApiBreakdown = hasApiMoneyBreakdown(safeTotals)
  const dayMap: Record<number, PeriodMoneySummary> = {}

  for (const plan of monthPlanList.value[month] || []) {
    if (!plan.end_time) continue
    const end = dayjs(plan.end_time)
    if (end.year() !== year || end.month() + 1 !== month) continue

    const day = end.date()
    if (!dayMap[day]) dayMap[day] = emptyPeriodMoney()

    const need = Number(plan.need_money) || 0
    const have = Number(plan.have_money) || 0
    dayMap[day].total_money += need
    dayMap[day].have_money += have
    if (plan.is_complete !== 1) {
      dayMap[day].unpaid_money += Math.max(need - have, 0)
    }
  }

  const daysCount = new Date(year, month, 0).getDate()
  return Array.from({ length: daysCount }, (_, index) => {
    const day = index + 1
    const api = apiMap[day]
    const aggregated = dayMap[day] || emptyPeriodMoney()

    return {
      day,
      total_money: api?.total_money ?? aggregated.total_money,
      have_money: useApiBreakdown && api?.have_money != null ? api.have_money : aggregated.have_money,
      unpaid_money: useApiBreakdown && api?.unpaid_money != null ? api.unpaid_money : aggregated.unpaid_money
    }
  })
}

/** 将全年计划按 end_time 月份分组（缺月补空数组） */
const groupPlansByMonth = (list: PlanList[], year: number): Record<number, PlanList[]> => {
  const grouped: Record<number, PlanList[]> = {}
  for (let month = 1; month <= 12; month++) {
    grouped[month] = []
  }
  for (const plan of list) {
    if (!plan.end_time) continue
    const end = dayjs(plan.end_time)
    if (end.year() !== year) continue
    const month = end.month() + 1
    if (month < 1 || month > 12) continue
    grouped[month].push(plan)
  }
  return grouped
}

/** 一次按年拉取 12 个月计划，避免 byMonth 打 12 次 */
const ensureYearMonthPlansLoaded = async (force = false) => {
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  const allLoaded = months.every((month) => !!monthPlanList.value[month])
  if (!force && allLoaded) return

  for (const month of months) {
    if (force || !monthPlanList.value[month]) {
      monthPlanLoading.value[month] = true
    }
  }

  try {
    const list = await getPlanListByMonth({ year: yearSelect.value })
    const grouped = groupPlansByMonth(list, yearSelect.value)
    for (const month of months) {
      if (force || !monthPlanList.value[month]) {
        monthPlanList.value[month] = grouped[month] || []
      }
    }
  } catch (error) {
    console.error('获取年度计划失败:', error)
    for (const month of months) {
      if (force || !monthPlanList.value[month]) {
        monthPlanList.value[month] = []
      }
    }
    toast.add({ title: '获取年度计划失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    for (const month of months) {
      monthPlanLoading.value[month] = false
    }
  }
}

// 按年汇总（多年度，统一接口 totalByYears）
const fetchYearsTotal = async () => {
  yearsTotalLoading.value = true
  try {
    const startYear = yearRangeStart.value
    const endYear = yearRangeStart.value + 5
    const apiTotals = await getPlanTotalByYears({
      start_year: startYear,
      end_year: endYear
    })
    const map: Record<number, PeriodMoneySummary> = {}
    for (let year = startYear; year <= endYear; year++) {
      map[year] = emptyPeriodMoney()
    }
    for (const item of apiTotals || []) {
      const year = Number(item.year)
      if (!Number.isFinite(year)) continue
      map[year] = {
        year,
        total_money: Number(item.total_money) || 0,
        have_money: Number(item.have_money) || 0,
        unpaid_money: Number(item.unpaid_money) || 0
      }
      if (
        map[year].total_money > 0
        && map[year].have_money === 0
        && map[year].unpaid_money === 0
      ) {
        map[year].unpaid_money = map[year].total_money
      }
    }
    yearsTotalsMap.value = map
  } catch (error) {
    console.error('获取年统计失败:', error)
    toast.add({
      title: '获取年统计失败',
      description: '请确认后端已提供 /plan/list/totalByYears 接口',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    yearsTotalsMap.value = {}
  } finally {
    yearsTotalLoading.value = false
  }
}

// 按年汇总（月度）
const fetchYearTotal = async (options?: { preserveSelection?: boolean; forcePlans?: boolean }) => {
  monthTotalLoading.value = true
  try {
    if (!options?.preserveSelection) {
      expandedMonth.value = null
      monthPlanList.value = {}
    }

    const apiTotals = await getPlanTotalByYear({ year: yearSelect.value })
    const shouldReloadPlans = options?.forcePlans || !hasApiMoneyBreakdown(apiTotals)
    if (shouldReloadPlans) {
      await ensureYearMonthPlansLoaded(options?.forcePlans ?? !options?.preserveSelection)
    }
    monthTotals.value = buildMonthTotals(apiTotals)
  } catch (error) {
    console.error('获取年度汇总失败:', error)
    toast.add({ title: '获取年度汇总失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    monthTotalLoading.value = false
  }
}

// 加载某月计划列表（日视图 / 展开单月仍按月请求）
const loadMonthPlans = async (month: number, force = false) => {
  if (!force && monthPlanList.value[month]) return
  monthPlanLoading.value[month] = true
  try {
    const list = await getPlanListByMonth({ year: yearSelect.value, month })
    monthPlanList.value[month] = list
  } catch (error) {
    console.error('获取月度计划失败:', error)
    monthPlanList.value[month] = []
    toast.add({ title: '获取月度计划失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    monthPlanLoading.value[month] = false
  }
}

// 切换月份选中
const toggleMonthExpand = async (month: number) => {
  if (expandedMonth.value === month) {
    expandedMonth.value = null
    return
  }
  expandedMonth.value = month
  dayMonthSelect.value = month
  if (!monthPlanList.value[month]) {
    await loadMonthPlans(month)
  }
}

// 按日视图
const fetchDayTotal = async (options?: { preserveSelection?: boolean; forcePlans?: boolean }) => {
  dayTotalLoading.value = true
  try {
    const month = dayMonthSelect.value
    if (!options?.preserveSelection) {
      expandedDay.value = null
      delete monthPlanList.value[month]
    }

    const apiTotals = await getPlanTotalByDay({ year: yearSelect.value, month })
    const shouldReloadPlans = options?.forcePlans || !hasApiMoneyBreakdown(apiTotals)
    if (shouldReloadPlans) {
      await loadMonthPlans(month, options?.forcePlans ?? !options?.preserveSelection)
    }
    dayTotals.value = buildDayTotals(apiTotals, month, yearSelect.value)
  } catch (error) {
    console.error('获取日度汇总失败:', error)
    toast.add({ title: '获取日度汇总失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    dayTotalLoading.value = false
  }
}

const toggleDayExpand = async (day: number) => {
  if (expandedDay.value === day) {
    expandedDay.value = null
    return
  }
  expandedDay.value = day
  const month = dayMonthSelect.value
  if (!monthPlanList.value[month]) {
    await loadMonthPlans(month)
  }
}

// 刷新当前选中的月份/日期计划列表
const refreshFilteredPlans = async () => {
  if (viewMode.value === 'month' && expandedMonth.value) {
    await loadMonthPlans(expandedMonth.value, true)
  } else if (viewMode.value === 'day' && expandedDay.value !== null) {
    await loadMonthPlans(dayMonthSelect.value, true)
  }
}

const mergePlanUpdate = (existing: PlanList, updated: PlanList): PlanList => ({
  ...existing,
  ...updated,
  plan_list: updated.plan_list ?? existing.plan_list,
  parent_plan: updated.parent_plan
    ? { ...existing.parent_plan, ...updated.parent_plan }
    : existing.parent_plan
})

const findPlanById = (plans: PlanList[], listId: number): PlanList | undefined => {
  for (const plan of plans) {
    if (plan.list_id === listId) return plan
    if (plan.plan_list?.length) {
      const found = findPlanById(plan.plan_list, listId)
      if (found) return found
    }
  }
  return undefined
}

const findPlanByIdInAll = (listId: number): PlanList | undefined => {
  const inMain = findPlanById(planList.value, listId)
  if (inMain) return inMain
  for (const plans of Object.values(monthPlanList.value)) {
    const found = plans.find((plan) => plan.list_id === listId)
    if (found) return found
  }
  return undefined
}

const findParentIdByChildId = (listId: number): number | undefined => {
  for (const plan of planList.value) {
    if (plan.plan_list?.some((child) => child.list_id === listId)) {
      return plan.list_id
    }
  }
  return undefined
}

const resolveParentId = (listId: number, updated?: PlanList): number | undefined => {
  if (updated?.parent_id && Number(updated.parent_id) > 0) return updated.parent_id
  if (updated?.parent_plan?.list_id) return updated.parent_plan.list_id

  const local = findPlanByIdInAll(listId)
  if (local?.parent_id && Number(local.parent_id) > 0) return local.parent_id
  if (local?.parent_plan?.list_id) return local.parent_plan.list_id

  return findParentIdByChildId(listId)
}

const isPlanComplete = (plan: PlanList) => Number(plan.is_complete) === 1

const getChildMoneyContribution = (child: PlanList) => {
  const need = Number(child.need_money) || 0
  const have = Number(child.have_money) || 0
  if (isPlanComplete(child)) {
    return { have: need > 0 ? need : have, need }
  }
  return { have, need }
}

const collectSiblingPlans = (parentId: number): PlanList[] => {
  const parent = findPlanById(planList.value, parentId)
  if (parent?.plan_list?.length) {
    return parent.plan_list
  }

  const siblings: PlanList[] = []
  for (const plans of Object.values(monthPlanList.value)) {
    for (const plan of plans) {
      if (plan.parent_id === parentId || plan.parent_plan?.list_id === parentId) {
        siblings.push(plan)
      }
    }
  }
  return siblings
}

const deriveParentSummary = (
  parent: PlanList,
  apiSummary?: ParentPlanSummary
): ParentPlanSummary & { is_complete?: number } => {
  const children = parent.plan_list?.length
    ? parent.plan_list
    : (parent.list_id ? collectSiblingPlans(parent.list_id) : [])
  let aggregatedHave = 0
  let aggregatedNeed = 0
  for (const child of children) {
    const contribution = getChildMoneyContribution(child)
    aggregatedHave += contribution.have
    aggregatedNeed += contribution.need
  }
  const allComplete = children.length > 0 && children.every(isPlanComplete)

  return {
    list_id: parent.list_id,
    plan_name: apiSummary?.plan_name ?? parent.plan_name ?? children[0]?.parent_plan?.plan_name,
    plan_cover: apiSummary?.plan_cover ?? parent.plan_cover ?? children[0]?.parent_plan?.plan_cover,
    end_time: apiSummary?.end_time ?? parent.end_time ?? children[0]?.parent_plan?.end_time,
    have_money: apiSummary?.have_money ?? aggregatedHave,
    need_money: apiSummary?.need_money ?? aggregatedNeed,
    is_complete: allComplete ? 1 : 0
  }
}

const deriveParentSummaryFromSiblings = (
  parentId: number,
  apiSummary?: ParentPlanSummary
): ParentPlanSummary & { is_complete?: number } => {
  const siblings = collectSiblingPlans(parentId)
  let aggregatedHave = 0
  let aggregatedNeed = 0
  for (const child of siblings) {
    const contribution = getChildMoneyContribution(child)
    aggregatedHave += contribution.have
    aggregatedNeed += contribution.need
  }
  const allComplete = siblings.length > 0 && siblings.every(isPlanComplete)
  const sampleParentPlan = siblings[0]?.parent_plan

  return {
    list_id: parentId,
    plan_name: apiSummary?.plan_name ?? sampleParentPlan?.plan_name,
    plan_cover: apiSummary?.plan_cover ?? sampleParentPlan?.plan_cover,
    end_time: apiSummary?.end_time ?? sampleParentPlan?.end_time,
    have_money: apiSummary?.have_money ?? aggregatedHave,
    need_money: apiSummary?.need_money ?? aggregatedNeed,
    is_complete: allComplete ? 1 : 0
  }
}

const applyParentSummaryToMonthLists = (
  parentId: number,
  summary: ParentPlanSummary & { is_complete?: number }
) => {
  const nextMonthPlanList: Record<number, PlanList[]> = {}
  for (const [monthKey, plans] of Object.entries(monthPlanList.value)) {
    nextMonthPlanList[Number(monthKey)] = plans.map((plan) => {
      if (plan.parent_id !== parentId && plan.parent_plan?.list_id !== parentId) return plan
      return {
        ...plan,
        parent_plan: {
          ...plan.parent_plan,
          ...summary,
          list_id: parentId
        }
      }
    })
  }
  monthPlanList.value = nextMonthPlanList
}

/** 子计划变更后，同步母计划金额与完成状态 */
const syncParentPlanState = (parentId: number, apiSummary?: ParentPlanSummary) => {
  const parentInList = findPlanById(planList.value, parentId)
  const summary = parentInList
    ? deriveParentSummary(parentInList, apiSummary)
    : deriveParentSummaryFromSiblings(parentId, apiSummary)

  if (parentInList) {
    applyPlanPatch(parentId, (parent) => ({
      ...parent,
      have_money: summary.have_money,
      need_money: summary.need_money,
      is_complete: summary.is_complete,
      plan_list: parent.plan_list
    }))
  }

  applyParentSummaryToMonthLists(parentId, summary)
}

const syncParentAfterChildMutation = (childId: number, updated?: PlanList) => {
  const parentId = resolveParentId(childId, updated)
  if (!parentId) return
  syncParentPlanState(parentId, updated?.parent_plan)
}

const patchPlanById = (
  plans: PlanList[],
  listId: number,
  updater: (plan: PlanList) => PlanList
): PlanList[] => {
  let changed = false
  const next = plans.map((plan) => {
    if (plan.list_id === listId) {
      changed = true
      return updater(plan)
    }
    if (plan.plan_list?.length) {
      const nextChildren = patchPlanById(plan.plan_list, listId, updater)
      if (nextChildren !== plan.plan_list) {
        changed = true
        return { ...plan, plan_list: nextChildren }
      }
    }
    return plan
  })
  return changed ? next : plans
}

const removePlanById = (plans: PlanList[], listId: number): PlanList[] => {
  const filtered = plans.filter((plan) => plan.list_id !== listId)
  if (filtered.length !== plans.length) return filtered

  let changed = false
  const next = plans.map((plan) => {
    if (!plan.plan_list?.length) return plan
    const nextChildren = removePlanById(plan.plan_list, listId)
    if (nextChildren !== plan.plan_list) {
      changed = true
      return { ...plan, plan_list: nextChildren }
    }
    return plan
  })
  return changed ? next : plans
}

/** 就地更新各列表中的计划项，避免整页重载 */
const applyPlanPatch = (listId: number, updater: (plan: PlanList) => PlanList) => {
  planList.value = patchPlanById(planList.value, listId, updater)

  const nextMonthPlanList: Record<number, PlanList[]> = { ...monthPlanList.value }
  for (const [monthKey, plans] of Object.entries(monthPlanList.value)) {
    nextMonthPlanList[Number(monthKey)] = patchPlanById(plans, listId, updater)
  }
  monthPlanList.value = nextMonthPlanList
}

/** 就地移除计划项 */
const applyPlanRemoval = (listId: number) => {
  const wasTopLevel = planList.value.some((plan) => plan.list_id === listId)
  planList.value = removePlanById(planList.value, listId)

  const nextMonthPlanList: Record<number, PlanList[]> = { ...monthPlanList.value }
  for (const [monthKey, plans] of Object.entries(monthPlanList.value)) {
    nextMonthPlanList[Number(monthKey)] = removePlanById(plans, listId)
  }
  monthPlanList.value = nextMonthPlanList

  if (wasTopLevel && total.value > 0) total.value -= 1
}

/** 静默刷新日历汇总，不触发 loading 态 */
const syncCalendarTotalsSilently = async () => {
  if (viewMode.value === 'all') return

  try {
    if (viewMode.value === 'month') {
      const apiTotals = await getPlanTotalByYear({ year: yearSelect.value })
      monthTotals.value = buildMonthTotals(apiTotals)
    } else if (viewMode.value === 'day') {
      const month = dayMonthSelect.value
      const apiTotals = await getPlanTotalByDay({ year: yearSelect.value, month })
      dayTotals.value = buildDayTotals(apiTotals, month, yearSelect.value)
    }
  } catch (error) {
    console.error('同步日历汇总失败:', error)
  }
}

const bumpStatistics = (patch: Partial<{ total_plan: number; is_complete: number; have_money: number; need_money: number }>) => {
  const base = statistics.value ?? displayStatistics.value
  statistics.value = {
    total_plan: patch.total_plan ?? base.total_plan,
    is_complete: patch.is_complete ?? base.is_complete,
    have_money: patch.have_money ?? base.have_money,
    need_money: patch.need_money ?? base.need_money
  }
}

// 操作后刷新日历汇总与列表（先汇总后列表，避免读到旧缓存）
const refreshAfterMutation = async () => {
  const preserveSelection = hasCalendarSelection.value

  if (viewMode.value === 'all') {
    await Promise.all([
      fetchPlanList(false, true),
      fetchYearsTotal()
    ])
    return
  }

  if (viewMode.value === 'month') {
    await fetchYearTotal({ preserveSelection, forcePlans: true })
  } else if (viewMode.value === 'day') {
    await fetchDayTotal({ preserveSelection, forcePlans: true })
  }

  if (!hasCalendarSelection.value) {
    await fetchPlanList(false, true)
  } else {
    await refreshFilteredPlans()
  }
}

// 切换视图，避免重复请求
const switchViewMode = (mode: 'all' | 'month' | 'day') => {
  if (viewMode.value === mode) return
  viewMode.value = mode

  const tasks: Promise<unknown>[] = []
  if (mode === 'month') {
    tasks.push(fetchYearTotal())
    if (!hasCalendarSelection.value && planList.value.length === 0) {
      tasks.push(fetchPlanList())
    }
  } else if (mode === 'day') {
    tasks.push(fetchDayTotal())
    if (!hasCalendarSelection.value && planList.value.length === 0) {
      tasks.push(fetchPlanList())
    }
  } else {
    tasks.push(fetchYearsTotal())
    // 统计页依赖列表汇总；强制拉一次，避免第一次切入白屏
    tasks.push(fetchPlanList(false, true))
  }

  if (tasks.length) void Promise.all(tasks)
}

// 切换展开/折叠
const toggleExpand = (planId: number | undefined) => {
  if (!planId) return
  const next = new Set(expandedPlans.value)
  if (next.has(planId)) next.delete(planId)
  else next.add(planId)
  expandedPlans.value = next
}

// 滚动到统计区域
const statisticsRef = ref<HTMLElement | null>(null)
const scrollToStatistics = () => {
  statisticsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 打开添加计划弹窗
const openAddPlan = (event?: MouseEvent) => {
  editPlanData.value = null
  if (planAddEditRef.value) {
    planAddEditRef.value.showModel(event)
  }
}

// 编辑计划
const editPlan = (item: PlanList) => {
  editPlanData.value = item
  if (planAddEditRef.value) {
    planAddEditRef.value.showModel()
  }
}

// 处理计划点击
const handlePlanClick = (item: PlanList) => {
  // 可以在这里添加跳转到计划详情页的逻辑
  console.log('点击计划:', item)
}

// 确认删除计划
const confirmDeletePlan = (id: number | undefined) => {
  if (!id) return
  deleteId.value = id
  deleteModal.value = true
}

// 执行删除
const handleDelete = async () => {
  if (!deleteId.value) return
  
  deleteLoading.value = true
  try {
    await deletePlanList({ list_id: deleteId.value })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    const removedId = deleteId.value
    deleteModal.value = false
    deleteId.value = null
    applyPlanRemoval(removedId)
    bumpStatistics({ total_plan: Math.max(0, (statistics.value?.total_plan || 1) - 1) })
    void syncCalendarTotalsSilently()
  } catch (error) {
    console.error('删除计划失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    deleteLoading.value = false
  }
}

// 确认完成计划
const confirmCompletePlan = (id: number | undefined) => {
  if (!id) return
  completeId.value = id
  completeModal.value = true
}

// 执行完成
const handleComplete = async () => {
  if (!completeId.value) return
  
  completeLoading.value = true
  try {
    const updated = await planComplete({ list_id: completeId.value })
    toast.add({
      title: '计划完成',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    const completedId = completeId.value
    completeModal.value = false
    completeId.value = null
    applyPlanPatch(completedId, (plan) => mergePlanUpdate(plan, { ...updated, is_complete: 1 }))
    syncParentAfterChildMutation(completedId, updated)
    bumpStatistics({ is_complete: (statistics.value?.is_complete || 0) + 1 })
    void syncCalendarTotalsSilently()
  } catch (error) {
    console.error('完成计划失败:', error)
    toast.add({
      title: '完成失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    completeLoading.value = false
  }
}

// 添加/减少金额（money 为正加、为负减）
const addHaveMoney = async (id: number | undefined, money: number) => {
  if (!id || addLoading.value) return
  if (!money || money === 0) {
    toast.add({
      title: '请输入有效金额',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  addLoading.value = true
  try {
    const updated = await updatePlanMoney({ list_id: id, add_money: money })
    toast.add({
      title: money > 0 ? '添加成功' : '减少成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    applyPlanPatch(id, (plan) => mergePlanUpdate(plan, updated))
    syncParentAfterChildMutation(id, updated)
    void syncCalendarTotalsSilently()
  } catch (error) {
    console.error('添加金额失败:', error)
    toast.add({
      title: '添加失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    addLoading.value = false
  }
}

// 显示封面预览（cover 为完整 URL）
const showCover = (cover: string | undefined) => {
  if (cover) {
    coverPreview.value = [cover]
    // 触发预览（需要根据 QhxPreviewImage 组件的实际实现调整）
    nextTick(() => {
      // 这里可能需要调用预览组件的显示方法
    })
  }
}

// 跳转到衣物详情（Uni outerLink2 / 鸿蒙 Outlink / 浏览器新开）
const jumpToClothes = (clothes: WardrobeClothes | WardrobeClothes[] | undefined) => {
  const clothesItem = Array.isArray(clothes) ? clothes[0] : clothes
  if (!clothesItem?.clothes_id) return

  const path = `/clothes/detail/${clothesItem.clothes_id}`
  const fullUrl = `https://lolitalibrary.com${path}`
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni?.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?url=${fullUrl}`,
      fail: () => console.warn('[plan] uni outer 服饰跳转失败', fullUrl),
    })
    return
  }
  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: fullUrl },
      })
    )
    return
  }
  window.open(path, '_blank', 'noopener,noreferrer')
}

// 获取图片参数
const getImageParams = () => {
  return configStore.config?.image_params || ''
}

// 打开选择服饰弹框
const openClothesChoose = (item: PlanList) => {
  planForClothes.value = item
  wardrobeClothesChooseRef.value?.showModel()
}

// 选择服饰后关联
const handleClothesChoose = async (clothes: WardrobeClothes) => {
  const plan = planForClothes.value
  if (!plan?.list_id || !clothes?.clothes_id || linkClothesLoading.value) return
  linkClothesLoading.value = true
  try {
    await planListRelate({ list_id: plan.list_id, clothes_id: clothes.clothes_id })
    toast.add({
      title: '关联成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    planForClothes.value = null
    await refreshAfterMutation()
  } catch (error) {
    console.error('关联失败:', error)
    toast.add({
      title: '关联失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    linkClothesLoading.value = false
  }
}

// 取消关联服饰
const handleUnlinkClothes = async (item: PlanList) => {
  if (!item.list_id || linkClothesLoading.value) return
  linkClothesLoading.value = true
  try {
    const updated = await planListRelate({ list_id: item.list_id, clothes_id: null })
    toast.add({
      title: '已取消关联',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    applyPlanPatch(item.list_id, (plan) => ({
      ...mergePlanUpdate(plan, updated),
      wardrobe_clothes: undefined,
      clothes_id: undefined
    }))
  } catch (error) {
    console.error('取消关联失败:', error)
    toast.add({
      title: '取消关联失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    linkClothesLoading.value = false
  }
}

// 获取关联衣物（处理类型）
const getWardrobeClothes = (item: PlanList & { wardrobe_clothes?: WardrobeClothes | WardrobeClothes[] }): WardrobeClothes | undefined => {
  if (item.wardrobe_clothes) {
    const clothes = Array.isArray(item.wardrobe_clothes) ? item.wardrobe_clothes[0] : item.wardrobe_clothes
    if (clothes?.clothes_id) return clothes
  }
  return undefined
}

// 计划封面图：优先 plan_cover，其次关联衣物图，最后默认图
const getPlanCoverSrc = (item: PlanList & { wardrobe_clothes?: WardrobeClothes | WardrobeClothes[] }) => {
  if (item.plan_cover) return `${BASE_IMG}${item.plan_cover}`
  const clothes = getWardrobeClothes(item)
  if (clothes?.clothes_img) return `${BASE_IMG}${clothes.clothes_img}${getImageParams()}`
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

// 计算时间差文本
const getTimeDifferenceText = (endTime: Date | string | undefined): string => {
  if (!endTime) return ''
  try {
    const end = dayjs(endTime)
    const now = dayjs()
    const diffDays = end.diff(now, 'day', true)
    
    if (diffDays > 0) {
      return `${diffDays.toFixed(1)} 天`
    }
    return '已经开始'
  } catch {
    return ''
  }
}

// 合并 edit + insert 连续触发，避免重复刷新
let planSuccessTimer: ReturnType<typeof setTimeout> | null = null
let pendingPlanAfterMutation: PlanList | null = null

const applyPlanContextAfterMutation = (plan?: PlanList | null) => {
  if (!plan?.end_time || viewMode.value === 'all') return

  const end = dayjs(plan.end_time)
  yearSelect.value = end.year()

  if (viewMode.value === 'month') {
    const month = end.month() + 1
    expandedMonth.value = month
    dayMonthSelect.value = month
  } else if (viewMode.value === 'day') {
    dayMonthSelect.value = end.month() + 1
    expandedDay.value = end.date()
  }
}

// 计划添加/编辑成功后的回调
const handlePlanSuccess = (plan?: PlanList) => {
  editPlanData.value = null
  if (plan?.list_id) {
    pendingPlanAfterMutation = plan
  }

  if (planSuccessTimer) clearTimeout(planSuccessTimer)
  planSuccessTimer = setTimeout(async () => {
    planSuccessTimer = null
    const latestPlan = pendingPlanAfterMutation
    pendingPlanAfterMutation = null
    applyPlanContextAfterMutation(latestPlan)
    await refreshAfterMutation()
  }, 0)
}

// 监听 user.message_config 变化，同步订阅邮件通知状态
watch(
  () => userStore.user?.message_config,
  (messageConfig) => {
    if (messageConfig && typeof messageConfig === 'object') {
      emailNotice.value = (messageConfig as Record<string, boolean>).email_notice === true
    } else {
      emailNotice.value = false
    }
  },
  { immediate: true, deep: true }
)

// 与收藏夹一致：跟 user_id 拉数；不在 setup 同步阶段打接口，避免刷新卡住进度条
let initInFlight = false
let hasMounted = false
const initPageData = async () => {
  if (!import.meta.client || initInFlight) return
  initInFlight = true
  try {
    await Promise.all([fetchYearTotal(), fetchPlanList(false, true)])
  } finally {
    initInFlight = false
  }
}

const tryInitPageData = (force = false) => {
  if (!import.meta.client || !hasMounted) return
  if (!userStore.user?.user_id) return
  const hasData = monthTotals.value.length > 0 || planList.value.length > 0
  if (!force && hasData) return
  void initPageData()
}

onMounted(() => {
  hasMounted = true
  void (async () => {
    // @ts-ignore - uni-webview-js 类型声明缺失
    uni = await import('@dcloudio/uni-webview-js').catch((err: unknown) => {
      console.error('Failed to load uni-webview-js:', err)
    })

    // 刷新时 layout 的 useAsyncData 常直接复用 SSR 的 null，不会再走 initialize
    if (!userStore.user?.user_id) {
      try {
        await userStore.initialize()
        if (userStore.token && !userStore.user?.user_id) {
          await userStore.fetchUserInfo()
        }
      } catch (error) {
        console.error('计划页初始化用户失败:', error)
      }
    }
    authBootstrapping.value = false
    await nextTick()
    tryInitPageData(true)
  })()
})

onActivated(() => {
  tryInitPageData(false)
})

/**
 * outerLink 打开时 token/用户信息可能晚于挂载；
 * 不用 immediate，避免 setup 阶段就发起重请求把刷新进度条卡死。
 */
watch(
  () => userStore.user?.user_id,
  (uid, prev) => {
    if (!hasMounted || !uid) return
    if (uid !== prev) void initPageData()
  }
)

// SEO 配置
useHead({
  title: '我的计划',
  meta: [
    {
      name: 'keywords',
      content: '攒钱计划,Lo研社,计划列表'
    },
    {
      name: 'description',
      content: '管理您的攒钱计划列表'
    }
  ]
})
</script>

<style scoped>
.plan-page {
  color: #4f3f43;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, color-mix(in srgb, var(--primary-color) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 70% 40% at 100% 0%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 50%),
    linear-gradient(180deg, #fff9fb 0%, #fff5f8 45%, #fff2f6 100%);
}

.plan-stats-section-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.55rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
}

.plan-stats-metric,
.plan-stats-pulse,
.plan-stats-years {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 1.35rem;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.plan-stats-metric {
  padding: 1rem 0.95rem 1.05rem;
  min-height: 8.2rem;
  display: flex;
  flex-direction: column;
}

.plan-stats-metric-icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 16%, white);
  margin-bottom: 0.65rem;
}

.plan-stats-metric-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: #4f3f43;
}

.plan-stats-metric-sub {
  font-size: 11px;
  color: #9a858a;
  margin-top: 0.15rem;
}

.plan-stats-metric-value {
  margin-top: auto;
  padding-top: 0.7rem;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--primary-color);
}

.plan-stats-pulse {
  padding: 1.1rem 1.15rem 1rem;
}

.plan-stats-pulse-row {
  display: grid;
  grid-template-columns: 4.5rem 1fr 2rem;
  align-items: center;
  gap: 0.65rem;
}

.plan-stats-pulse-label {
  font-size: 12px;
  color: #9a858a;
}

.plan-stats-pulse-track {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  overflow: hidden;
}

.plan-stats-pulse-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary-color);
  transition: width 0.35s ease;
}

.plan-stats-pulse-value {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 13px;
  text-align: right;
  color: #4f3f43;
}

.plan-stats-pulse-foot {
  margin-top: 1.05rem;
  padding-top: 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--primary-color) 16%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  font-size: 11px;
  color: #9a858a;
}

.plan-stats-pulse-cross {
  font-size: 10px;
  opacity: 0.55;
  transform: rotate(45deg);
}

.plan-stats-years {
  padding: 1.05rem 1rem 1rem;
}

.plan-stats-year-cell {
  padding: 0.55rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  text-align: center;
  min-width: 0;
  border-radius: 0.95rem;
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
  background: rgba(255, 255, 255, 0.72);
}

.plan-stats-year-have,
.plan-stats-year-unpaid {
  font-size: 9px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #c4b4b7;
}

.plan-stats-year-have.has-value {
  color: #6f9474;
}

.plan-stats-year-unpaid.has-value {
  color: #e05353;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 月度列表 slot：grid-template-rows 实现高度动画，收起时下方块平滑上移 */
</style>
