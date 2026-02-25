<template>
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
    <div v-if="layoutReady && userStore.user" class="flex justify-between items-center sticky top-[10px] z-10 mb-4">
      <div class="flex flex-wrap">
        <QhxJellyButton>
          <div class="h-[60px] text-center px-1 cursor-pointer" @click="(e: MouseEvent) => openAddPlan(e)">
            <div class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] flex items-center justify-center bg-qhx-primary">
              <UIcon name="material-symbols:add-2" class="text-[22px] text-[#ffffff]" />
            </div>
            <div class="text-sm text-qhx-text">新建</div>
          </div>
        </QhxJellyButton>
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

    <!-- 计划列表 -->
    <div v-if="layoutReady" class="space-y-2">
      <div
        v-for="item in planList"
        :key="item.list_id"
        class="px-1"
      >
        <!-- 母计划项 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow transition-shadow relative"
          :class="{ 'opacity-85': item.is_complete === 1 }"
        >
          <img
            v-if="item.is_complete === 1"
            :src="`${BASE_IMG}/static/plan/complete.png`"
            alt="已完成"
            class="absolute right-2 top-[30px] w-10 h-10 z-5 opacity-90"
          />
          
          <div class="px-3 py-2 flex gap-2">
            <!-- 封面 -->
            <div
              class="w-9 h-9 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-pointer"
              @click="showCover(getPlanCoverSrc(item))"
            >
              <img
                :src="getPlanCoverSrc(item)"
                :alt="item.plan_name || '封面'"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            <!-- 信息区 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1 mb-0.5">
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <button
                    v-if="hasChildren(item)"
                    @click.stop="toggleExpand(item.list_id)"
                    class="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <UIcon
                      :name="isExpanded(item.list_id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                      class="text-gray-500 w-3.5 h-3.5"
                    />
                  </button>
                  <h3
                    class="text-xs font-medium text-gray-800 dark:text-gray-100 truncate cursor-pointer"
                    @click="handlePlanClick(item)"
                  >
                    {{ item.plan_name || '未命名' }}
                  </h3>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0 relative z-6">
                  <button
                    v-if="item.is_complete !== 1"
                    @click.stop="editPlan(item)"
                    class="w-6 h-6 rounded-full bg-qhx-primary hover:bg-qhx-primary/80 flex items-center justify-center text-white"
                    title="编辑"
                  >
                    <UIcon name="i-heroicons-pencil" class="w-3 h-3" />
                  </button>
                  <button
                    @click.stop="confirmDeletePlan(item.list_id)"
                    class="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
                    title="删除"
                  >
                    <UIcon name="i-heroicons-trash" class="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <!-- 金额+进度 单行 -->
              <div class="flex items-center gap-2 text-xs"> 
                <span class="text-gray-500">{{ Math.ceil(getProgress(item)) }}%</span>
                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-16">
                  <div
                    class="bg-qhx-primary h-1.5 rounded-full transition-all"
                    :style="{ width: `${getProgress(item)}%` }"
                  ></div>
                </div>
                <span class="text-gray-700 dark:text-gray-300 font-medium">
                  ￥{{ formatMoney(item.have_money || 0) }}/{{ formatMoney(item.need_money || 0) }}
                </span>
              </div>
              
              <!-- 操作行 -->
              <div class="flex items-center gap-2 my-1">
                <button
                  v-if="!item.show_add && item.is_complete !== 1 && (!item.plan_list || item.plan_list.length === 0)"
                  @click="item.show_add = true"
                  class="flex items-center gap-0.5 px-2 py-0.5 bg-qhx-primary hover:bg-qhx-primary/80 text-white text-xs rounded"
                >
                  <UIcon name="i-heroicons-plus" class="w-3 h-3" />
                  添加
                </button>
                <button
                  v-if="item.have_money === item.need_money && item.is_complete !== 1 && (!item.plan_list || item.plan_list.length === 0)"
                  @click="confirmCompletePlan(item.list_id)"
                  class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded"
                >
                  完成
                </button>
              </div>
              
              <!-- 添加金额 紧凑 -->
              <div v-if="item.show_add" class="my-1 flex gap-0.5 items-center">
                <UInput
                  :model-value="item.add_money ?? undefined"
                  type="number"
                  placeholder="金额"
                  size="xs"
                  class="flex-1 min-w-0 text-[11px]"
                  :ui="{ padding: { xs: 'px-2 py-1' } }"
                  @update:model-value="(val) => { item.add_money = val as number | null }"
                />
                <UButton @click="addHaveMoney(item.list_id, item.add_money)" size="2xs" color="primary" :loading="addLoading">添加</UButton>
                <UButton @click="item.show_add = false; item.add_money = null" size="2xs" color="gray" variant="outline">取消</UButton>
              </div>
              
              <!-- 备注 单行省略 -->
              <div v-if="item.plan_note" class="text-xs text-gray-500 truncate mt-0.5">{{ item.plan_note }}</div>
              
              <!-- 尾款/创建时间 单行 -->
              <div class="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                <span v-if="item.end_time && item.is_complete !== 1" class="text-orange-500">{{ getTimeDifferenceText(item.end_time) }}</span>
                <span>{{ formatDate(item.create_time) }}</span>
              </div> 
            </div>
          </div>
          <!-- 关联衣物 紧凑 -->
          <div
            v-if="getWardrobeClothes(item)"
            @click="jumpToClothes(getWardrobeClothes(item))"
            class="mt-1 flex items-center gap-2 py-1 px-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img
                :src="`${BASE_IMG}${getWardrobeClothes(item)?.clothes_img || ''}${getImageParams()}`"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400 truncate">{{ getWardrobeClothes(item)?.clothes_note }}</span>
          </div>
          <!-- 子计划 -->
          <div
            v-if="hasChildren(item) && isExpanded(item.list_id)"
            class="ml-4 pb-2 pr-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3 space-y-1"
          >
            <div
              v-for="child in item.plan_list"
              :key="child.list_id"
              class="flex items-center justify-between py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded text-xs"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <div class="w-0.5 h-4 bg-blue-400 rounded flex-shrink-0"></div>
                <span class="font-medium">￥{{ formatMoney(child.need_money || 0) }}</span>
                <span v-if="child.plan_note" class="text-gray-500 truncate">{{ child.plan_note }}</span>
                <span v-if="child.end_time" class="text-gray-400">{{ formatDate(child.end_time) }}</span>
              </div>
              <button
                v-if="child.is_complete !== 1"
                @click="confirmCompletePlan(child.list_id)"
                class="px-2 py-0.5 text-xs bg-qhx-primary text-white rounded flex-shrink-0"
              >
                完成
              </button>
              <span v-else class="text-gray-400 text-xs flex-shrink-0">已完成</span>
            </div>
          </div>
        </div>
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
</template>

<script setup lang="ts">
import { ref, inject, computed, onMounted, watch, nextTick } from 'vue'
import { getPlanList, deletePlanList, updatePlanMoney, planComplete } from '@/api/plan'
import type { PlanList, PaginationResponse, WardrobeClothes } from '@/types/api'
import type PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import EmailBindModal from '@/components/user/EmailBindModal.vue'

// 禁用 SSR
definePageMeta({
  ssr: false
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const planAddEditRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

// 计划列表数据
const planList = ref<(PlanList & { show_add?: boolean; add_money?: number | null })[]>([])
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
    
    // 处理返回数据，添加 show_add 和 add_money 字段
    const processedRows = response.rows.map((plan: PlanList) => ({
      ...plan,
      show_add: false,
      add_money: null as number | null
    }))
    
    // 只显示顶级计划（parent_id 为空或0的计划）
    const topLevelPlans = processedRows.filter((plan: PlanList) => !plan.parent_id || plan.parent_id === 0)
    
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

// 添加金额
const addHaveMoney = async (id: number | undefined, money: number | null | undefined) => {
  if (!id || !money || addLoading.value) return
  
  if (!money || money <= 0) {
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
      title: '添加成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    
    // 关闭添加面板
    const plan = planList.value.find(p => p.list_id === id)
    if (plan) {
      plan.show_add = false
      plan.add_money = null
    }
    
    fetchPlanList()
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

// 计划添加/编辑成功后的回调
const handlePlanSuccess = () => {
  editPlanData.value = null
  fetchPlanList()
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
</style>
