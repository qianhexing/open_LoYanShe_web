<template>
  <div class="relative min-h-screen w-full overflow-x-hidden">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
      aria-hidden="true"
    />
    <div class="container mx-auto p-2 pb-20 max-w-4xl">
    <!-- 统计卡片区域 -->
    <div ref="statisticsRef" v-if="layoutReady && statistics" class="mb-4">
      <div class="bg-gray-900 dark:bg-gray-800 rounded-lg p-2.5 border border-gray-800 dark:border-gray-700">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5">
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white">{{ statistics.total_plan || 0 }}</div>
              <div class="text-[10px] text-gray-500">总计划</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white">{{ statistics.is_complete || 0 }}</div>
              <div class="text-[10px] text-gray-500">已完成</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-currency-dollar" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white truncate">￥{{ formatMoney(statistics.have_money || 0) }}</div>
              <div class="text-[10px] text-gray-500">已攒</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white truncate">￥{{ formatMoney((statistics.need_money || 0) - (statistics.have_money || 0)) }}</div>
              <div class="text-[10px] text-gray-500">还需</div>
            </div>
          </div>
        </div>
        <div
          v-if="(statistics.need_money || 0) - (statistics.have_money || 0) > 0"
          class="mt-2 pt-2 flex items-center gap-1.5 border-t border-gray-700"
        >
          <span class="text-sm">⚠️</span>
          <span class="text-xs text-amber-400">注意尾款！</span>
        </div>
      </div>
    </div>

    <!-- 功能栏 -->
    <div
      v-if="layoutReady && userStore.user"
      class="flex justify-between items-center sticky z-10 mb-4"
      :style="{ top: `${10 + (configStore.statusBarHeight || 0)}px` }"
    >
      <div class="flex flex-wrap items-center gap-2">
        <QhxJellyButton>
          <!-- h-[40px] -->
          <div class=" text-center px-1 cursor-pointer" @click="(e: MouseEvent) => openAddPlan(e)">
            <div class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary">
              <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
            </div>
            <!-- <div class="text-sm text-qhx-text">新建</div> -->
          </div>
        </QhxJellyButton>
        <!-- 全部/按月/按日切换 -->
        <div class="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'all' ? 'bg-qhx-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="viewMode = 'all'; fetchPlanList()"
          >
            全部
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'month' ? 'bg-qhx-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="viewMode = 'month'; fetchYearTotal()"
          >
            按月
          </button>
          <button
            type="button"
            class="px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="viewMode === 'day' ? 'bg-qhx-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="viewMode = 'day'; fetchDayTotal()"
          >
            按日
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UToggle
          v-model="emailNotice"
          color="primary"
          @update:model-value="handleEmailNoticeChange"
        />
        <span class="text-xs text-gray-600 dark:text-gray-400">订阅邮件通知</span>
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

    <!-- 计划列表（全部视图） -->
    <div v-if="layoutReady && viewMode === 'all'" class="space-y-2">
      <div v-for="item in planList" :key="item.list_id" class="px-1">
        <PlanListItem
          :item="item"
          variant="full"
          :add-loading="addLoading"
          :has-children="hasChildren(item)"
          :is-expanded="isExpanded(item.list_id)"
          :wardrobe-clothes="getWardrobeClothes(item)"
          :image-params="getImageParams()"
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
      
      <!-- 加载更多 -->
      <div v-if="hasMore && !isLoading" class="text-center py-4">
        <UButton
          @click="loadMore"
          color="gray"
          variant="outline"
          :loading="isLoadingMore"
        >
          加载更多
        </UButton>
      </div>
      
      <!-- 加载中 -->
      <div v-if="isLoading" class="text-center py-4">
        <div class="text-gray-400 dark:text-gray-500">加载中...</div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="!isLoading && planList.length === 0" class="text-center py-12">
        <div class="text-gray-400 dark:text-gray-500">暂无计划</div>
      </div>
    </div>

    <!-- 按月视图 -->
    <div v-if="layoutReady && viewMode === 'month'" class="space-y-2">
      <!-- 年份切换 -->
      <div class="flex items-center gap-2 mb-3 px-1">
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          @click="yearSelect = yearSelect - 1; fetchYearTotal()"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[60px] text-center">{{ yearSelect }}年</span>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
          @click="yearSelect = yearSelect + 1; fetchYearTotal()"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      <!-- 月度汇总：12个月按块分布，无数据补0 -->
      <div v-if="monthTotalLoading" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">加载中...</div>
      <div v-else class="space-y-2">
        <!-- 第一行 1-4 月 -->
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="m in all12Months.slice(0, 4)"
            :key="m.month"
            type="button"
            class="px-2 py-2.5 flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': expandedMonth === m.month }"
            @click="toggleMonthExpand(m.month)"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ m.month }}月</span>
            <span class="text-sm font-semibold tabular-nums" :class="m.total_money > 0 ? 'text-qhx-primary' : 'text-gray-400 dark:text-gray-500'">￥{{ formatMoney(m.total_money) }}</span>
            <UIcon :name="expandedMonth === m.month ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="w-3.5 h-3.5 text-gray-400 mt-0.5" />
          </button>
        </div>
        <!-- 第一行与第二行之间：1-4 月 -->
        <div
          class="month-slot grid overflow-hidden"
          :style="{ gridTemplateRows: slot1Expanded ? '1fr' : '0fr' }"
          @transitionend.self="onSlotTransitionEnd(1)"
        >
          <div class="min-h-0 overflow-hidden">
            <div v-if="displayMonthSlot1 !== null" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200">{{ yearSelect }}年{{ displayMonthSlot1 }}月 计划列表</div>
              <div class="px-3 py-2">
                <div v-if="monthPlanLoading[displayMonthSlot1]" class="text-center py-6 text-gray-400 text-xs">加载中...</div>
                <div v-else-if="monthPlanList[displayMonthSlot1]?.length === 0" class="text-center py-6 text-gray-400 text-xs">暂无计划</div>
                <div v-else class="space-y-1.5">
                  <PlanListItem
                    v-for="item in monthPlanList[displayMonthSlot1]"
                    :key="item.list_id"
                    :item="item"
                    variant="compact"
                    :add-loading="addLoading"
                    :wardrobe-clothes="getWardrobeClothes(item)"
                    :image-params="getImageParams()"
                    @cover="showCover"
                    @delete="confirmDeletePlan"
                    @complete="confirmCompletePlan"
                    @add-money="addHaveMoney(item.list_id, $event)"
                    @jump-clothes="jumpToClothes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 第二行 5-8 月 -->
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="m in all12Months.slice(4, 8)"
            :key="m.month"
            type="button"
            class="px-2 py-2.5 flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': expandedMonth === m.month }"
            @click="toggleMonthExpand(m.month)"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ m.month }}月</span>
            <span class="text-sm font-semibold tabular-nums" :class="m.total_money > 0 ? 'text-qhx-primary' : 'text-gray-400 dark:text-gray-500'">￥{{ formatMoney(m.total_money) }}</span>
            <UIcon :name="expandedMonth === m.month ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="w-3.5 h-3.5 text-gray-400 mt-0.5" />
          </button>
        </div>
        <!-- 第二行与第三行之间：5-8 月 -->
        <div
          class="month-slot grid overflow-hidden"
          :style="{ gridTemplateRows: slot2Expanded ? '1fr' : '0fr' }"
          @transitionend.self="onSlotTransitionEnd(2)"
        >
          <div class="min-h-0 overflow-hidden">
            <div v-if="displayMonthSlot2 !== null" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200">{{ yearSelect }}年{{ displayMonthSlot2 }}月 计划列表</div>
              <div class="px-3 py-2">
                <div v-if="monthPlanLoading[displayMonthSlot2]" class="text-center py-6 text-gray-400 text-xs">加载中...</div>
                <div v-else-if="monthPlanList[displayMonthSlot2]?.length === 0" class="text-center py-6 text-gray-400 text-xs">暂无计划</div>
                <div v-else class="space-y-1.5">
                  <PlanListItem
                    v-for="item in monthPlanList[displayMonthSlot2]"
                    :key="item.list_id"
                    :item="item"
                    variant="compact"
                    :add-loading="addLoading"
                    :wardrobe-clothes="getWardrobeClothes(item)"
                    :image-params="getImageParams()"
                    @cover="showCover"
                    @delete="confirmDeletePlan"
                    @complete="confirmCompletePlan"
                    @add-money="addHaveMoney(item.list_id, $event)"
                    @jump-clothes="jumpToClothes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 第三行 9-12 月 -->
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="m in all12Months.slice(8, 12)"
            :key="m.month"
            type="button"
            class="px-2 py-2.5 flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': expandedMonth === m.month }"
            @click="toggleMonthExpand(m.month)"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ m.month }}月</span>
            <span class="text-sm font-semibold tabular-nums" :class="m.total_money > 0 ? 'text-qhx-primary' : 'text-gray-400 dark:text-gray-500'">￥{{ formatMoney(m.total_money) }}</span>
            <UIcon :name="expandedMonth === m.month ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="w-3.5 h-3.5 text-gray-400 mt-0.5" />
          </button>
        </div>
        <!-- 第三行下方：9-12 月 -->
        <div
          class="month-slot grid overflow-hidden"
          :style="{ gridTemplateRows: slot3Expanded ? '1fr' : '0fr' }"
          @transitionend.self="onSlotTransitionEnd(3)"
        >
          <div class="min-h-0 overflow-hidden">
            <div v-if="displayMonthSlot3 !== null" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200">{{ yearSelect }}年{{ displayMonthSlot3 }}月 计划列表</div>
              <div class="px-3 py-2">
                <div v-if="monthPlanLoading[displayMonthSlot3]" class="text-center py-6 text-gray-400 text-xs">加载中...</div>
                <div v-else-if="monthPlanList[displayMonthSlot3]?.length === 0" class="text-center py-6 text-gray-400 text-xs">暂无计划</div>
                <div v-else class="space-y-1.5">
                  <PlanListItem
                    v-for="item in monthPlanList[displayMonthSlot3]"
                    :key="item.list_id"
                    :item="item"
                    variant="compact"
                    :add-loading="addLoading"
                    :wardrobe-clothes="getWardrobeClothes(item)"
                    :image-params="getImageParams()"
                    @cover="showCover"
                    @delete="confirmDeletePlan"
                    @complete="confirmCompletePlan"
                    @add-money="addHaveMoney(item.list_id, $event)"
                    @jump-clothes="jumpToClothes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 按日视图 -->
    <div v-if="layoutReady && viewMode === 'day'" class="space-y-2">
      <!-- 年月切换 -->
      <div class="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <div class="flex items-center gap-1">
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" @click="yearSelect = yearSelect - 1; fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[50px] text-center">{{ yearSelect }}年</span>
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" @click="yearSelect = yearSelect + 1; fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" @click="dayMonthSelect = Math.max(1, dayMonthSelect - 1); fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[40px] text-center">{{ dayMonthSelect }}月</span>
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600" @click="dayMonthSelect = Math.min(12, dayMonthSelect + 1); fetchDayTotal()">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      <!-- 日块：7 列网格 -->
      <div v-if="dayTotalLoading" class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">加载中...</div>
      <div v-else class="space-y-2">
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="d in allDaysInMonth"
            :key="d.day"
            type="button"
            class="px-1 py-2 flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all text-center min-w-0"
            :class="{ 'ring-2 ring-qhx-primary border-qhx-primary': expandedDay === d.day || collapsingDay === d.day }"
            @click="toggleDayExpand(d.day)"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ d.day }}日</span>
            <span class="text-xs font-semibold tabular-nums truncate w-full" :class="d.total_money > 0 ? 'text-qhx-primary' : 'text-gray-400 dark:text-gray-500'">￥{{ formatMoney(d.total_money) }}</span>
          </button>
        </div>
        <!-- 占满整行的日计划列表 -->
        <div
          class="month-slot grid overflow-hidden"
          :style="{ gridTemplateRows: daySlotExpanded ? '1fr' : '0fr' }"
          @transitionend.self="onDaySlotTransitionEnd"
        >
          <div class="min-h-0 overflow-hidden">
            <div v-if="displayDay !== null" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200">{{ yearSelect }}年{{ dayMonthSelect }}月{{ displayDay }}日 计划列表</div>
              <div class="px-3 py-2">
                <div v-if="monthPlanLoading[dayMonthSelect]" class="text-center py-6 text-gray-400 text-xs">加载中...</div>
                <div v-else-if="plansForExpandedDay.length === 0" class="text-center py-6 text-gray-400 text-xs">暂无计划</div>
                <div v-else class="space-y-1.5">
                  <PlanListItem
                    v-for="item in plansForExpandedDay"
                    :key="item.list_id"
                    :item="item"
                    variant="compact"
                    :add-loading="addLoading"
                    :wardrobe-clothes="getWardrobeClothes(item)"
                    :image-params="getImageParams()"
                    @cover="showCover"
                    @delete="confirmDeletePlan"
                    @complete="confirmCompletePlan"
                    @add-money="addHaveMoney(item.list_id, $event)"
                    @jump-clothes="jumpToClothes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!layoutReady" class="text-center py-12">
      <div class="text-gray-400 dark:text-gray-500">加载中...</div>
    </div>
  </div>

  <!-- 添加/编辑计划弹窗 -->
  <PlanAddEdit
    ref="planAddEditRef"
    :plan-list="editPlanData"
    @success="handlePlanSuccess"
    @insert="handlePlanSuccess"
    @edit="handlePlanSuccess"
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
import { ref, inject, computed, onMounted, watch, nextTick } from 'vue'
import { getPlanList, getPlanListByMonth, getPlanTotalByYear, getPlanTotalByDay, deletePlanList, updatePlanMoney, planComplete, planListRelate } from '@/api/plan'
import type { PlanList, PaginationResponse, WardrobeClothes } from '@/types/api'
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

// 禁用 SSR
definePageMeta({
  ssr: false
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const planAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
const wardrobeClothesChooseRef = ref<InstanceType<typeof WardrobeClothesChoose> | null>(null)
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

// 视图模式：全部 | 按月 | 按日
const viewMode = ref<'all' | 'month' | 'day'>('all')

// 按月视图相关
const yearSelect = ref(new Date().getFullYear())
const monthTotals = ref<{ month: number; total_money: number }[]>([])
const monthTotalLoading = ref(false)
const expandedMonth = ref<number | null>(null)
const collapsingMonth = ref<number | null>(null) // 收起动画进行中时保留的月份
const slotCollapsing = ref<number | null>(null) // 1|2|3 表示哪个 slot 正在收起
const monthPlanList = ref<Record<number, PlanList[]>>({})
const monthPlanLoading = ref<Record<number, boolean>>({})
// 12个月块分布，无数据补0
const all12Months = computed(() => {
  const map = Object.fromEntries(monthTotals.value.map((m) => [m.month, m.total_money]))
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total_money: map[i + 1] ?? 0
  }))
})

// 各 slot 要显示的月份（展开优先，收起动画时用 collapsingMonth）
const displayMonthSlot1 = computed(() => {
  if (expandedMonth.value !== null && expandedMonth.value <= 4) return expandedMonth.value
  if (collapsingMonth.value !== null && collapsingMonth.value <= 4) return collapsingMonth.value
  return null
})
const displayMonthSlot2 = computed(() => {
  if (expandedMonth.value !== null && expandedMonth.value >= 5 && expandedMonth.value <= 8) return expandedMonth.value
  if (collapsingMonth.value !== null && collapsingMonth.value >= 5 && collapsingMonth.value <= 8) return collapsingMonth.value
  return null
})
const displayMonthSlot3 = computed(() => {
  if (expandedMonth.value !== null && expandedMonth.value >= 9) return expandedMonth.value
  if (collapsingMonth.value !== null && collapsingMonth.value >= 9) return collapsingMonth.value
  return null
})

// 各 slot 的 grid 是否展开（1=展开 0=收起）
const slot1Expanded = computed(() => {
  const inRange = expandedMonth.value !== null && expandedMonth.value <= 4
  const collapsingInRange = collapsingMonth.value !== null && collapsingMonth.value <= 4 && slotCollapsing.value !== 1
  return inRange || collapsingInRange
})
const slot2Expanded = computed(() => {
  const inRange = expandedMonth.value !== null && expandedMonth.value >= 5 && expandedMonth.value <= 8
  const collapsingInRange = collapsingMonth.value !== null && collapsingMonth.value >= 5 && collapsingMonth.value <= 8 && slotCollapsing.value !== 2
  return inRange || collapsingInRange
})
const slot3Expanded = computed(() => {
  const inRange = expandedMonth.value !== null && expandedMonth.value >= 9
  const collapsingInRange = collapsingMonth.value !== null && collapsingMonth.value >= 9 && slotCollapsing.value !== 3
  return inRange || collapsingInRange
})

// 按日视图相关
const dayMonthSelect = ref(new Date().getMonth() + 1)
const dayTotals = ref<{ day: number; total_money: number }[]>([])
const dayTotalLoading = ref(false)
const expandedDay = ref<number | null>(null)
const collapsingDay = ref<number | null>(null)
const daySlotForceCollapse = ref(false)

const daysInCurrentMonth = computed(() => new Date(yearSelect.value, dayMonthSelect.value, 0).getDate())

const allDaysInMonth = computed(() => {
  const map = Object.fromEntries(dayTotals.value.map((d) => [d.day, d.total_money]))
  return Array.from({ length: daysInCurrentMonth.value }, (_, i) => ({
    day: i + 1,
    total_money: map[i + 1] ?? 0
  }))
})

const displayDay = computed(() => expandedDay.value ?? collapsingDay.value)
const daySlotExpanded = computed(
  () => (expandedDay.value !== null) || (collapsingDay.value !== null && !daySlotForceCollapse.value)
)

const plansForExpandedDay = computed(() => {
  const day = displayDay.value
  const month = dayMonthSelect.value
  if (day === null || !monthPlanList.value[month]) return []
  return monthPlanList.value[month].filter((p) => {
    if (!p.end_time) return false
    return dayjs(p.end_time).date() === day
  })
})

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
const fetchPlanList = async (isLoadMore = false) => {
  if (isLoading.value || isLoadingMore.value) return
  
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
    
    // 如果有子计划，默认展开
    for (const plan of topLevelPlans) {
      if (plan.list_id && hasChildren(plan)) {
        expandedPlans.value.add(plan.list_id)
      }
    }
    
    if (isLoadMore) {
      planList.value = [...planList.value, ...topLevelPlans]
    } else {
      planList.value = topLevelPlans
    }
    
    total.value = response.count
    page.value += 1
    
    // 尝试从响应中获取统计数据（如果 API 返回了 statistics 字段）
    const responseWithStats = response as PaginationResponse<PlanList> & { statistics?: typeof statistics.value }
    if (responseWithStats.statistics) {
      statistics.value = responseWithStats.statistics
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

// 按年汇总（月度）
const fetchYearTotal = async () => {
  monthTotalLoading.value = true
  try {
    monthTotals.value = await getPlanTotalByYear({ year: yearSelect.value })
    expandedMonth.value = null
    monthPlanList.value = {}
  } catch (error) {
    console.error('获取年度汇总失败:', error)
    toast.add({ title: '获取年度汇总失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    monthTotalLoading.value = false
  }
}

// 切换月份展开
const getSlotForMonth = (m: number) => (m <= 4 ? 1 : m <= 8 ? 2 : 3)

const onSlotTransitionEnd = (slot: number) => {
  if (slotCollapsing.value === slot) {
    collapsingMonth.value = null
    slotCollapsing.value = null
  }
}

const toggleMonthExpand = async (month: number) => {
  if (expandedMonth.value === month) {
    collapsingMonth.value = month
    expandedMonth.value = null
    await nextTick()
    slotCollapsing.value = getSlotForMonth(month)
    return
  }
  if (expandedMonth.value !== null) {
    collapsingMonth.value = expandedMonth.value
    await nextTick()
    slotCollapsing.value = collapsingMonth.value !== null ? getSlotForMonth(collapsingMonth.value) : null
  }
  expandedMonth.value = month
  dayMonthSelect.value = month
  if (!monthPlanList.value[month]) {
    monthPlanLoading.value = { ...monthPlanLoading.value, [month]: true }
    try {
      const list = await getPlanListByMonth({ year: yearSelect.value, month })
      monthPlanList.value = { ...monthPlanList.value, [month]: list }
    } catch (error) {
      console.error('获取月度计划失败:', error)
      toast.add({ title: '获取月度计划失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    } finally {
      monthPlanLoading.value = { ...monthPlanLoading.value, [month]: false }
    }
  }
}

// 按日视图
const fetchDayTotal = async () => {
  dayTotalLoading.value = true
  try {
    dayTotals.value = await getPlanTotalByDay({ year: yearSelect.value, month: dayMonthSelect.value })
    expandedDay.value = null
    collapsingDay.value = null
  } catch (error) {
    console.error('获取日度汇总失败:', error)
    toast.add({ title: '获取日度汇总失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
  } finally {
    dayTotalLoading.value = false
  }
}

const toggleDayExpand = async (day: number) => {
  if (expandedDay.value === day) {
    collapsingDay.value = day
    expandedDay.value = null
    await nextTick()
    daySlotForceCollapse.value = true
    return
  }
  collapsingDay.value = null
  daySlotForceCollapse.value = false
  expandedDay.value = day
  const month = dayMonthSelect.value
  if (!monthPlanList.value[month]) {
    monthPlanLoading.value = { ...monthPlanLoading.value, [month]: true }
    try {
      const list = await getPlanListByMonth({ year: yearSelect.value, month })
      monthPlanList.value = { ...monthPlanList.value, [month]: list }
    } catch (error) {
      console.error('获取月度计划失败:', error)
      toast.add({ title: '获取月度计划失败', icon: 'i-heroicons-exclamation-circle', color: 'red' })
    } finally {
      monthPlanLoading.value = { ...monthPlanLoading.value, [month]: false }
    }
  }
}

const onDaySlotTransitionEnd = () => {
  if (collapsingDay.value !== null) {
    collapsingDay.value = null
    daySlotForceCollapse.value = false
  }
}

// 切换展开/折叠
const toggleExpand = (planId: number | undefined) => {
  if (!planId) return
  if (expandedPlans.value.has(planId)) {
    expandedPlans.value.delete(planId)
  } else {
    expandedPlans.value.add(planId)
  }
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
    deleteModal.value = false
    deleteId.value = null
    fetchPlanList()
    if (viewMode.value === 'month' && expandedMonth.value) {
      refreshMonthPlans(expandedMonth.value)
    }
    if (viewMode.value === 'day' && expandedDay.value !== null) {
      refreshMonthPlans(dayMonthSelect.value)
    }
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
    await planComplete({ list_id: completeId.value })
    toast.add({
      title: '计划完成',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    completeModal.value = false
    completeId.value = null
    fetchPlanList()
    if (viewMode.value === 'month' && expandedMonth.value) {
      refreshMonthPlans(expandedMonth.value)
    }
    if (viewMode.value === 'day' && expandedDay.value !== null) {
      refreshMonthPlans(dayMonthSelect.value)
    }
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
    await updatePlanMoney({ list_id: id, add_money: money })
    toast.add({
      title: money > 0 ? '添加成功' : '减少成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    fetchPlanList()
    if (viewMode.value === 'month' && expandedMonth.value) {
      refreshMonthPlans(expandedMonth.value)
    }
    if (viewMode.value === 'day' && expandedDay.value !== null) {
      refreshMonthPlans(dayMonthSelect.value)
    }
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

// 跳转到衣物详情
const jumpToClothes = (clothes: WardrobeClothes | WardrobeClothes[] | undefined) => {
  const clothesItem = Array.isArray(clothes) ? clothes[0] : clothes
  if (clothesItem?.clothes_id) {
    navigateTo(`/clothes/detail/${clothesItem.clothes_id}`)
  }
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
    fetchPlanList()
    if (viewMode.value === 'month' && expandedMonth.value) {
      refreshMonthPlans(expandedMonth.value)
    }
    if (viewMode.value === 'day' && expandedDay.value !== null) {
      refreshMonthPlans(dayMonthSelect.value)
    }
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
    await planListRelate({ list_id: item.list_id, clothes_id: null })
    toast.add({
      title: '已取消关联',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    fetchPlanList()
    if (viewMode.value === 'month' && expandedMonth.value) {
      refreshMonthPlans(expandedMonth.value)
    }
    if (viewMode.value === 'day' && expandedDay.value !== null) {
      refreshMonthPlans(dayMonthSelect.value)
    }
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
  if (!item.wardrobe_clothes) return undefined
  return Array.isArray(item.wardrobe_clothes) ? item.wardrobe_clothes[0] : item.wardrobe_clothes
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

// 刷新某月计划列表
const refreshMonthPlans = async (month: number) => {
  try {
    const list = await getPlanListByMonth({ year: yearSelect.value, month })
    monthPlanList.value = { ...monthPlanList.value, [month]: list }
  } catch {
    monthPlanList.value = { ...monthPlanList.value, [month]: [] }
  }
}

// 计划添加/编辑成功后的回调
const handlePlanSuccess = () => {
  editPlanData.value = null
  fetchPlanList()
  if (viewMode.value === 'month' && expandedMonth.value) {
    refreshMonthPlans(expandedMonth.value)
  }
  if (viewMode.value === 'day' && expandedDay.value !== null) {
    refreshMonthPlans(dayMonthSelect.value)
  }
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

// 组件挂载时加载数据
onMounted(() => {
  if (layoutReady) {
    fetchPlanList()
  } else {
    // 等待 layout 准备就绪
    const unwatch = watch(layoutReady, (ready) => {
      if (ready) {
        fetchPlanList()
        unwatch()
      }
    })
  }
})

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
.month-slot {
  transition: grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
</style>
