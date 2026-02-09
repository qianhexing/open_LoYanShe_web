<template>
  <div class="container mx-auto p-4 pb-20 max-w-4xl">
    <!-- 统计卡片区域 -->
    <div v-if="layoutReady && statistics" class="mb-6">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-800 dark:border-gray-700">
          <div class="flex items-center mb-2">
            <div class="w-10 h-10 rounded-lg bg-gray-800 dark:bg-gray-700 flex items-center justify-center mr-3">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold text-white">{{ statistics.total_plan || 0 }}</div>
              <div class="text-xs text-gray-400">总计划</div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-800 dark:border-gray-700">
          <div class="flex items-center mb-2">
            <div class="w-10 h-10 rounded-lg bg-gray-800 dark:bg-gray-700 flex items-center justify-center mr-3">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold text-white">{{ statistics.is_complete || 0 }}</div>
              <div class="text-xs text-gray-400">已完成</div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-800 dark:border-gray-700">
          <div class="flex items-center mb-2">
            <div class="w-10 h-10 rounded-lg bg-gray-800 dark:bg-gray-700 flex items-center justify-center mr-3">
              <UIcon name="i-heroicons-currency-dollar" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold text-white">￥{{ formatMoney(statistics.have_money || 0) }}</div>
              <div class="text-xs text-gray-400">已攒金额</div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-800 dark:border-gray-700">
          <div class="flex items-center mb-2">
            <div class="w-10 h-10 rounded-lg bg-gray-800 dark:bg-gray-700 flex items-center justify-center mr-3">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold text-white">￥{{ formatMoney((statistics.need_money || 0) - (statistics.have_money || 0)) }}</div>
              <div class="text-xs text-gray-400">还需金额</div>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        v-if="(statistics.need_money || 0) - (statistics.have_money || 0) > 0"
        class="bg-gray-900 dark:bg-gray-800 rounded-lg p-3 flex items-center backdrop-blur-sm border border-gray-800 dark:border-gray-700"
      >
        <span class="text-lg mr-2">⚠️</span>
        <span class="text-sm text-white font-medium">注意尾款！</span>
      </div>
    </div>

    <!-- 新建计划按钮 -->
    <div v-if="layoutReady && userStore.user" class="mb-6">
      <UButton
        @click="(e: MouseEvent) => openAddPlan(e)"
        icon="i-heroicons-plus"
        color="primary"
        class="w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white"
        size="lg"
      >
        新建攒钱计划
      </UButton>
    </div>

    <!-- 计划列表 -->
    <div v-if="layoutReady" class="space-y-4">
      <div
        v-for="item in planList"
        :key="item.list_id"
        class="px-2"
      >
        <!-- 父计划项 -->
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow relative"
          :class="{ 'opacity-85': item.is_complete === 1 }"
        >
          <!-- 完成徽章 -->
          <img
            v-if="item.is_complete === 1"
            :src="`${BASE_IMG}/static/plan/complete.png`"
            alt="已完成"
            class="absolute right-4 bottom-6 w-15 h-15 z-5 opacity-90"
          />
          
          <div class="p-4">
            <div class="flex gap-4">
              <!-- 计划封面 -->
              <div class="flex-shrink-0">
                <div
                  class="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                  @click="showCover(item.plan_cover)"
                >
                  <img
                    :src="`${BASE_IMG}${item.plan_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="item.plan_name || '计划封面'"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              
              <!-- 计划信息 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <!-- 展开/折叠按钮 -->
                    <button
                      v-if="hasChildren(item)"
                      @click.stop="toggleExpand(item.list_id)"
                      class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UIcon
                        :name="isExpanded(item.list_id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                        class="text-gray-500 dark:text-gray-400"
                      />
                    </button>
                    
                    <h3
                      class="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate cursor-pointer"
                      @click="handlePlanClick(item)"
                    >
                      {{ item.plan_name || '未命名计划' }}
                    </h3>
                  </div>
                  
                  <div class="flex items-center gap-2 flex-shrink-0 ml-2 relative z-6">
                    <!-- 编辑和删除按钮 -->
                    <div class="flex gap-2">
                      <button
                        v-if="item.is_complete !== 1"
                        @click.stop="editPlan(item)"
                        class="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow-md transition-all active:scale-90"
                        title="编辑"
                      >
                        <UIcon name="i-heroicons-pencil" class="w-4 h-4" />
                      </button>
                      <button
                        @click.stop="confirmDeletePlan(item.list_id)"
                        class="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-md transition-all active:scale-90"
                        title="删除"
                      >
                        <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- 金额信息 -->
                <div class="flex gap-5 mb-3">
                  <div class="flex-1">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">共需</div>
                    <div class="text-lg font-bold text-gray-800 dark:text-gray-200">￥{{ formatMoney(item.need_money || 0) }}</div>
                  </div>
                  <div class="flex-1">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">已有</div>
                    <div class="text-lg font-bold text-gray-800 dark:text-gray-200">￥{{ formatMoney(item.have_money || 0) }}</div>
                  </div>
                </div>
                
                <!-- 操作按钮 -->
                <div class="flex items-center gap-2 mb-3">
                  <button
                    v-if="!item.show_add && item.is_complete !== 1 && (!item.plan_list || item.plan_list.length === 0)"
                    @click="item.show_add = true"
                    class="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-full shadow-md transition-all active:scale-95"
                  >
                    <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                    <span>添加金额</span>
                  </button>
                  <UButton
                    v-if="item.have_money === item.need_money && item.is_complete !== 1 && (!item.plan_list || item.plan_list.length === 0)"
                    @click="confirmCompletePlan(item.list_id)"
                    size="xs"
                    color="primary"
                    class="bg-blue-500 hover:bg-blue-600"
                  >
                    完成计划
                  </UButton>
                </div>
                
                <!-- 添加金额面板 -->
                <div
                  v-if="item.show_add"
                  class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3 border border-gray-200 dark:border-gray-700"
                >
                  <div class="mb-3">
                    <label class="text-sm text-gray-600 dark:text-gray-400 mb-2 block">攒钱金额</label>
                    <UInput
                      :model-value="item.add_money ?? undefined"
                      type="number"
                      placeholder="请输入金额"
                      class="w-full"
                      @update:model-value="(val) => { item.add_money = val as number | null }"
                    />
                  </div>
                  <div class="flex gap-2">
                    <UButton
                      @click="addHaveMoney(item.list_id, item.add_money)"
                      size="sm"
                      color="primary"
                      :loading="addLoading"
                      class="flex-1"
                    >
                      确认添加
                    </UButton>
                    <UButton
                      @click="item.show_add = false; item.add_money = null"
                      size="sm"
                      color="gray"
                      variant="outline"
                      class="flex-1"
                    >
                      取消
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- 进度信息 -->
          <div class="mb-3 p-2 px-3">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-gray-600 dark:text-gray-400">进度</span>
              <span class="font-medium text-gray-800 dark:text-gray-200">
                {{ Math.ceil(getProgress(item)) }}%
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                class="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-300"
                :style="{ width: `${getProgress(item)}%` }"
              ></div>
            </div>
          </div>
          
          <!-- 计划备注 -->
          <div v-if="item.plan_note" class="px-4 pb-3">
            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">备注</div>
              <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ item.plan_note }}</div>
            </div>
          </div>
          
          <!-- 计划元信息 -->
          <div class="px-4 pb-3">
            <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div
                v-if="item.end_time && item.is_complete !== 1"
                class="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium"
              >
                <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                <span>
                  距离尾款 {{ getTimeDifferenceText(item.end_time) }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                <span>创建时间 {{ formatDate(item.create_time) }}</span>
              </div>
            </div>
          </div>
          
          <!-- 关联衣物 -->
          <div
            v-if="getWardrobeClothes(item)"
            @click="jumpToClothes(getWardrobeClothes(item))"
            class="mx-4 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
              <img
                :src="`${BASE_IMG}${getWardrobeClothes(item)?.clothes_img || ''}${getImageParams()}`"
                :alt="getWardrobeClothes(item)?.clothes_note || ''"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
              {{ getWardrobeClothes(item)?.clothes_note }}
            </div>
          </div>
          
          <!-- 子计划列表 -->
          <div
            v-if="hasChildren(item) && isExpanded(item.list_id)"
            class="ml-6 mt-2 space-y-2 border-l-2 border-blue-200 dark:border-blue-800 pl-4"
          >
          <div
            v-for="child in item.plan_list"
            :key="child.list_id"
            class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 flex-1">
                <div class="flex-shrink-0 w-1 h-5 bg-blue-400 dark:bg-blue-500 rounded"></div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">共需</span>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-200">￥{{ formatMoney(child.need_money || 0) }}</span>
                  </div>
                </div>
              </div>
              <button
                v-if="child.is_complete !== 1"
                @click="confirmCompletePlan(child.list_id)"
                class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-md transition-all active:scale-95"
              >
                完成
              </button>
              <span
                v-else
                class="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
              >
                已完成
              </span>
            </div>
            
            <div v-if="child.plan_note" class="text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span class="text-gray-500 dark:text-gray-500">备注：</span>
              <span>{{ child.plan_note }}</span>
            </div>
            
            <div v-if="child.end_time" class="text-xs text-gray-600 dark:text-gray-400">
              <span class="text-gray-500 dark:text-gray-500">尾款时间：</span>
              <span>{{ formatDate(child.end_time) }}</span>
            </div>
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

// 显示封面预览
const showCover = (cover: string | undefined) => {
  if (cover) {
    coverPreview.value = [`${BASE_IMG}${cover}`]
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
