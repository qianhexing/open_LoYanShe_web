<template>
  <!-- compact：按月/按日列表紧凑项 -->
  <div
    v-if="variant === 'compact'"
    class="relative px-2 py-1.5 bg-gray-50 dark:bg-gray-900 rounded text-xs space-y-1"
    :class="{ 'opacity-80': item.is_complete === 1 }"
  >
    <img
      v-if="item.is_complete === 1"
      :src="`${BASE_IMG}/static/plan/complete.png`"
      alt="已完成"
      class="absolute right-[24px] top-[24px] w-10 h-10 z-10 opacity-90 pointer-events-none"
    />
    <div class="flex items-center gap-2">
      <div
        class="w-6 h-6 rounded overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-pointer"
        @click="$emit('cover', getPlanCoverSrc())"
      >
        <img :src="getPlanCoverSrc()" class="w-full h-full object-cover" loading="lazy" alt="" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <span class="font-medium truncate">
            {{ item.plan_note || '未备注' }}
            <span v-if="item.parent_plan?.plan_name" class="text-gray-400 font-normal"> · {{ item.parent_plan.plan_name }}</span>
          </span>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span v-if="item.end_time && item.is_complete !== 1" class="text-orange-600 dark:text-orange-400 font-semibold">尾款：{{ formatEndTime(item.end_time) }}</span>
            <span class="text-gray-600 dark:text-gray-400">￥{{ formatMoney(item.have_money || 0) }}/{{ formatMoney(item.need_money || 0) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <template v-if="!isChildPlan">
            <span class="text-gray-500">{{ Math.ceil(getProgress()) }}%</span>
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1 max-w-12">
              <div class="bg-qhx-primary h-1 rounded-full" :style="{ width: `${getProgress()}%` }"></div>
            </div>
          </template>
          <div class="flex gap-1 flex-shrink-0 items-center flex-1" :class="{ 'ml-auto': isChildPlan }">
            <div class="flex gap-1 flex-1">
              <button v-if="item.is_complete !== 1 && (isChildPlan || (item.have_money ?? 0) >= (item.need_money ?? 0))" class="px-1.5 py-0.5 text-[10px] bg-qhx-primary text-white rounded" @click.stop="$emit('complete', item.list_id)">完成</button>
              <button v-if="item.is_complete !== 1 && !isChildPlan && (!item.plan_list || item.plan_list.length === 0)" class="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-qhx-primary text-white rounded" @click.stop="openAddModal($event)">
                <UIcon name="i-heroicons-plus" class="w-2.5 h-2.5" />添加
              </button>
            </div>
            <button v-if="!isChildPlan" class="p-0.5 text-red-500 ml-auto" title="删除" @click.stop="$emit('delete', item.list_id)"><UIcon name="i-heroicons-trash" class="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
    <!-- 母计划详情：进度条 + 总金额，删除按钮（删除母计划） -->
    <div v-if="item.parent_plan" class="pl-8 space-y-1">
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-gray-400 flex-shrink-0">{{ Math.ceil(getParentProgress()) }}%</span>
        <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1 min-w-0">
          <div class="bg-qhx-primary h-1 rounded-full transition-all" :style="{ width: `${getParentProgress()}%` }"></div>
        </div>
      </div>
      <div class="flex items-center justify-between gap-1.5 text-[10px] text-gray-400">
        <span>
          <span v-if="item.parent_plan?.end_time" class="text-orange-600 dark:text-orange-400 font-semibold mr-1">尾款：{{ formatEndTime(item.parent_plan.end_time) }}</span>
          母计划 ￥{{ formatMoney(item.parent_plan.have_money ?? 0) }}/￥{{ formatMoney(item.parent_plan.need_money ?? 0) }}
        </span>
        <button class="p-0.5 text-red-500 flex-shrink-0" title="删除母计划" @click.stop="$emit('delete', item.parent_plan?.list_id)"><UIcon name="i-heroicons-trash" class="w-3 h-3" /></button>
      </div>
    </div>
    <!-- 关联服饰 -->
    <div
      v-if="wardrobeClothes"
      class="flex items-center gap-1.5 pl-8 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 -mx-1 px-1 py-0.5 rounded"
      @click="$emit('jump-clothes', wardrobeClothes)"
    >
      <div class="w-4 h-4 rounded overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
        <img :src="getClothesImgSrc()" class="w-full h-full object-cover" loading="lazy" alt="" />
      </div>
      <span class="text-[10px] text-gray-500 truncate">{{ wardrobeClothes.clothes_note || '关联服饰' }}</span>
    </div>
  </div>

  <!-- full：全部视图完整卡片 -->
  <div
    v-else
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
      <div
        class="w-9 h-9 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-pointer"
        @click="$emit('cover', getPlanCoverSrc())"
      >
        <img :src="getPlanCoverSrc()" :alt="item.plan_name || '封面'" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1 mb-0.5">
          <div class="flex items-center gap-1 flex-1 min-w-0">
            <button
              v-if="hasChildren"
              @click.stop="$emit('toggle-expand', item.list_id)"
              class="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <UIcon :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="text-gray-500 w-3.5 h-3.5" />
            </button>
            <h3 class="text-xs font-medium text-gray-800 dark:text-gray-100 truncate cursor-pointer" @click="$emit('click', item)">
              {{ item.plan_name || '未命名' }}
            </h3>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 relative z-6">
            <button v-if="item.is_complete !== 1" @click.stop="$emit('edit', item)" class="w-6 h-6 rounded-full bg-qhx-primary hover:bg-qhx-primary/80 flex items-center justify-center text-white" title="编辑">
              <UIcon name="i-heroicons-pencil" class="w-3 h-3" />
            </button>
            <button @click.stop="$emit('delete', item.list_id)" class="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white" title="删除">
              <UIcon name="i-heroicons-trash" class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-gray-500">{{ Math.ceil(getProgress()) }}%</span>
          <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-16">
            <div class="bg-qhx-primary h-1.5 rounded-full transition-all" :style="{ width: `${getProgress()}%` }"></div>
          </div>
          <span class="text-gray-700 dark:text-gray-300 font-medium">￥{{ formatMoney(item.have_money || 0) }}/{{ formatMoney(item.need_money || 0) }}</span>
        </div>
        <div class="flex items-center gap-2 my-1">
          <button v-if="item.is_complete !== 1 && (!item.plan_list || item.plan_list.length === 0)" @click="openAddModal($event)" class="flex items-center gap-0.5 px-2 py-0.5 bg-qhx-primary hover:bg-qhx-primary/80 text-white text-xs rounded">
            <UIcon name="i-heroicons-plus" class="w-3 h-3" />添加
          </button>
          <button v-if="item.is_complete !== 1" @click="$emit('complete', item.list_id)" class="px-2 py-0.5 text-xs bg-qhx-primary hover:bg-qhx-primary/80 text-white rounded">完成</button>
        </div>

        <div v-if="item.plan_note" class="text-xs text-gray-500 truncate mt-0.5">{{ item.plan_note }}</div>
        <div class="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
          <span v-if="item.end_time && item.is_complete !== 1" class="text-orange-600 dark:text-orange-400 font-semibold">尾款：{{ formatEndTime(item.end_time) }} {{ getTimeDifferenceText(item.end_time) }}</span>
          <span> {{ formatDate(item.create_time) }}</span>
        </div>
      </div>
    </div>

    <div v-if="wardrobeClothes || item.is_complete !== 1" class="mt-1 py-1 px-2 bg-gray-50 dark:bg-gray-900 rounded">
      <div v-if="wardrobeClothes" class="flex items-center gap-2">
        <div @click="$emit('jump-clothes', wardrobeClothes)" class="flex-1 flex items-center gap-2 min-w-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 -my-1 -mx-2 py-1 px-2 rounded">
          <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
            <img :src="getClothesImgSrc()" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <span class="text-xs text-gray-600 dark:text-gray-400 truncate">{{ wardrobeClothes?.clothes_note }}</span>
        </div>
        <button v-if="item.is_complete !== 1" @click.stop="$emit('unlink-clothes')" class="w-6 h-6 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0" title="取消关联">
          <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
        </button>
      </div>
      <button v-else-if="item.is_complete !== 1" @click="$emit('link-clothes')" class="flex items-center gap-1.5 px-2 py-1 text-xs text-qhx-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded w-full text-left">
        <UIcon name="i-heroicons-link" class="w-3.5 h-3.5" />关联服饰
      </button>
    </div>
    <div v-if="hasChildren && isExpanded" class="ml-4 pb-2 pr-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3 space-y-1">
      <div v-for="child in item.plan_list" :key="child.list_id" class="flex items-center justify-between py-1.5 px-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="w-0.5 h-4 bg-blue-400 rounded flex-shrink-0"></div>
          <span class="font-medium">￥{{ formatMoney(child.need_money || 0) }}</span>
          <span v-if="child.plan_note" class="text-gray-500 truncate">{{ child.plan_note }}</span>
          <span v-if="child.end_time && child.is_complete !== 1" class="text-orange-600 dark:text-orange-400 font-semibold">尾款：{{  formatEndTime(child.end_time) }}</span>
          <span v-else-if="child.end_time" class="text-gray-400">尾款：{{ formatEndTime(child.end_time) }}</span>
        </div>
        <button v-if="child.is_complete !== 1" @click="$emit('complete', child.list_id)" class="px-2 py-0.5 text-xs bg-qhx-primary text-white rounded flex-shrink-0">完成</button>
        <span v-else class="text-gray-400 text-xs flex-shrink-0 w-10 h-10">已完成</span>
      </div>
    </div>
  </div>

  <!-- 金额加减弹窗：正数加、负数减（compact 和 full 共用） -->
  <QhxModal v-model="showAddModal" :trigger-position="addModalClickPosition" @close="addMoneyInput = ''">
    <div class="p-6 w-[320px] max-md:w-[90vw] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">金额加减</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">正数增加，负数减少</p>
      <UInput v-model="addMoneyInput" type="number" placeholder="输入金额，如 100 或 -50" size="sm" class="mb-4" :ui="{ padding: { sm: 'px-3 py-2' } }" />
      <div class="flex gap-2">
        <UButton class="flex-1" color="gray" variant="ghost" @click="showAddModal = false">取消</UButton>
        <UButton class="flex-1" color="primary" :loading="addLoading" :disabled="!addMoneyNum" @click="handleAddMoney">确定</UButton>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import type { PlanList, WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import { useConfigStore } from '@/stores/config'
import QhxModal from '@/components/Qhx/Modal.vue'

const props = withDefaults(
  defineProps<{
    item: PlanList
    variant?: 'full' | 'compact'
    addLoading?: boolean
    hasChildren?: boolean
    isExpanded?: boolean
    wardrobeClothes?: WardrobeClothes
    imageParams?: string
  }>(),
  { variant: 'compact', addLoading: false, hasChildren: false, isExpanded: false, imageParams: '' }
)

const emit = defineEmits<{
  cover: [url: string]
  edit: [item: PlanList]
  delete: [listId: number | undefined]
  complete: [listId: number | undefined]
  'toggle-expand': [listId: number | undefined]
  click: [item: PlanList]
  'add-money': [money: number]
  'link-clothes': []
  'unlink-clothes': []
  'jump-clothes': [clothes: WardrobeClothes]
}>()

const showAddModal = ref(false)
const addMoneyInput = ref('')
const addModalClickPosition = ref({ x: 0, y: 0 })

const openAddModal = (e: MouseEvent) => {
  addModalClickPosition.value = { x: e.clientX, y: e.clientY }
  showAddModal.value = true
  addMoneyInput.value = ''
}

const addMoneyNum = computed(() => {
  const n = Number(addMoneyInput.value)
  return !Number.isNaN(n) && n !== 0 ? n : null
})

const handleAddMoney = () => {
  const amount = addMoneyNum.value
  if (amount === null) return
  emit('add-money', amount)
  showAddModal.value = false
  addMoneyInput.value = ''
}

const configStore = useConfigStore()

const isChildPlan = computed(() => {
  const item = props.item
  return !!(item.parent_plan || (item.parent_id && item.parent_id > 0))
})

const formatMoney = (money: number | undefined): string => {
  if (money === undefined || money === null) return '0'
  return Number(money).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return ''
  try {
    return dayjs(date).format('YYYY-MM-DD')
  } catch {
    return String(date)
  }
}

/** 尾款时间格式 YY-MM-DD 如 26-02-26 */
const formatEndTime = (date: Date | string | undefined): string => {
  if (!date) return ''
  try {
    return dayjs(date).format('YY-MM-DD')
  } catch {
    return String(date)
  }
}

const getProgress = (): number => {
  const needMoney = props.item.need_money || 0
  const haveMoney = props.item.have_money || 0
  if (needMoney === 0) return 0
  const progress = (haveMoney / needMoney) * 100
  return Math.min(Math.max(Math.round(progress), 0), 100)
}

const getParentProgress = (): number => {
  const parent = props.item.parent_plan
  if (!parent) return 0
  const needMoney = parent.need_money || 0
  const haveMoney = parent.have_money || 0
  if (needMoney === 0) return 0
  const progress = (haveMoney / needMoney) * 100
  return Math.min(Math.max(Math.round(progress), 0), 100)
}

const resolveImgUrl = (url: string | undefined, appendParams = true): string => {
  if (!url) return ''
  const params = appendParams ? (props.imageParams || configStore.config?.image_params || '') : ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url + params
  return `${BASE_IMG}${url}${params}`
}

const getPlanCoverSrc = (): string => {
  const cover = props.item.plan_cover || props.item.parent_plan?.plan_cover
  if (cover) return resolveImgUrl(cover)
  const clothes = props.wardrobeClothes
  if (clothes?.clothes_img) return resolveImgUrl(clothes.clothes_img)
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

const getClothesImgSrc = (): string => {
  const clothes = props.wardrobeClothes
  if (!clothes?.clothes_img) return ''
  return resolveImgUrl(clothes.clothes_img)
}

const getTimeDifferenceText = (endTime: Date | string | undefined): string => {
  if (!endTime) return ''
  try {
    const end = dayjs(endTime)
    const now = dayjs()
    const diffDays = end.diff(now, 'day', true)
    if (diffDays > 0) return `${diffDays.toFixed(1)} 天`
    return '已经开始'
  } catch {
    return ''
  }
}
</script>
