<script setup lang="ts">
import type { LibraryHistoryNew } from '@/api/library'
import type { Library } from '@/types/api'
import { getLibraryHistory } from '@/api/library'
import { useToast } from '#imports'
import dayjs from 'dayjs'
import QhxTag from '~/components/Qhx/Tag.vue'
import QhxPreviewImage from '~/components/Qhx/PreviewImage.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const config = useConfigStore()
const user = useUserStore()

// 从路由参数获取 library_id
const libraryId = computed(() => {
  const id = route.query.library_id || route.params.id
  return Number.parseInt(String(id || ''), 10)
})

// 历史记录列表
const historyList = ref<LibraryHistoryNew[]>([])
const loading = ref(false)

// 获取历史记录
const fetchHistory = async () => {
  if (!libraryId.value || Number.isNaN(libraryId.value)) {
    toast.add({
      title: '错误',
      description: '缺少图鉴ID参数',
      color: 'red'
    })
    return
  }

  loading.value = true
  try {
    const data = await getLibraryHistory({ library_id: libraryId.value })
    historyList.value = data || []
  } catch (error) {
    console.error('获取历史记录失败:', error)
    toast.add({
      title: '错误',
      description: '获取修改历史失败',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 格式化修改类型
const formatType = (type?: number | string) => {
  const typeNum = typeof type === 'string' ? Number.parseInt(type, 10) : (type || 0)
  const typeMap: Record<number, string> = {
    0: '创建',
    1: '修改',
    2: '纠错'
  }
  return typeMap[typeNum] || '未知'
}

const jumpToLibraryReview = (history: LibraryHistoryNew) => {
  window.open(`/addLibrary?library_id=${history.library_id}&review=${history.history_id}`, '_blank')
}
// 格式化修改状态
const formatApplyStatus = (isApply?: number) => {
  if (isApply === 1) {
    return { text: '已应用', color: 'green' as const }
  }
  if (isApply === 0) {
    return { text: '待审核', color: 'yellow' as const }
  }
  if (isApply === 2) {
    return { text: '已驳回', color: 'red' as const }
  }
  return { text: '未知', color: 'gray' as const }
}

// 获取用户显示名称
const getUserName = (history: LibraryHistoryNew) => {
  if (history.user?.user_name) {
    return history.user.user_name
  }
  if (history.user_id) {
    return `用户${history.user_id}`
  }
  return '未知用户'
}

// 跳转到图鉴详情
const goToDetail = (id?: number) => {
  if (id) {
    router.push(`/library/detail/${id}`)
  }
}

// 格式化货币标签
type MoneyType = { value: number; label: string; exchange_rate?: string }
const formatLabel = (shop_country: number | string | undefined, money_type: MoneyType[] = []) => {
  if (!shop_country || !money_type || money_type.length === 0) return ''
  const countryValue = typeof shop_country === 'string' ? Number.parseInt(shop_country, 10) : shop_country
  if (Number.isNaN(countryValue)) return ''
  const item = money_type.find((m) => m.value === countryValue)
  return item ? item.label : ''
}

// 汇率换算
const exchangeRate = (shop_country: number | string | undefined, price: number | string | undefined): string | false => {
  if (!shop_country || !price || !config.config) return false
  const countryValue = typeof shop_country === 'string' ? Number.parseInt(shop_country, 10) : shop_country
  const priceValue = typeof price === 'string' ? Number.parseFloat(price) : price
  if (Number.isNaN(countryValue) || Number.isNaN(priceValue)) return false
  
  const index = config.config.money_type.findIndex((item) => {
    return item.value === countryValue
  })
  if (index !== -1 && config.config.money_type[index]?.exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (priceValue / Number.parseFloat(String(config.config.exchange_rate[exchange_rate]))).toFixed(2)
  }
  return false
}

// 检查字段是否有值
const hasValue = (value: unknown): boolean => {
  return value !== null && value !== undefined && value !== ''
}

// 分割逗号分隔的字符串
const splitComma = (str: string | null | undefined): string[] => {
  if (!str) return []
  return String(str).split(',').filter(item => item.trim())
}

// 扩展Library类型以包含历史记录中的额外字段
interface ExtendedLibrary extends Library {
  complete?: boolean
  main_style?: string
  square_cover?: string | null
  edit_user?: number
}

// 获取扩展字段的值
const getExtendedValue = <K extends keyof ExtendedLibrary>(params: Library, key: K): ExtendedLibrary[K] | undefined => {
  return (params as ExtendedLibrary)[key]
}

// 比较两个值是否相等（处理null、undefined、空字符串等情况）
const isEqual = (val1: unknown, val2: unknown): boolean => {
  // 处理null和undefined
  if (val1 === null || val1 === undefined) {
    return val2 === null || val2 === undefined || val2 === ''
  }
  if (val2 === null || val2 === undefined) {
    return val1 === null || val1 === undefined || val1 === ''
  }
  // 字符串比较（去除空格）
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    return val1.trim() === val2.trim()
  }
  // 数字比较
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return val1 === val2
  }
  // 布尔值比较
  if (typeof val1 === 'boolean' && typeof val2 === 'boolean') {
    return val1 === val2
  }
  // 对象比较（简单比较）
  return String(val1) === String(val2)
}

// 获取字段的原值（从下一条记录中获取，跳过驳回状态的记录）
const getOriginalValue = (currentIndex: number, fieldName: keyof Library | keyof ExtendedLibrary): unknown => {
  // 如果是最后一条记录，没有原值
  if (currentIndex >= historyList.value.length - 1) {
    return undefined
  }
  
  // 从下一条记录开始查找，跳过驳回状态的记录
  let targetIndex = currentIndex + 1
  while (targetIndex < historyList.value.length) {
    const targetHistory = historyList.value[targetIndex]
    
    // 如果记录不存在或没有参数，继续查找
    if (!targetHistory?.params) {
      targetIndex++
      continue
    }
    
    // 如果当前记录是驳回状态（is_apply === 2），继续往前查找
    if (targetHistory.is_apply === 2) {
      targetIndex++
      continue
    }
    
    // 找到非驳回状态的记录，返回对应字段的值
    // 处理扩展字段
    if (fieldName === 'complete' || fieldName === 'main_style' || fieldName === 'square_cover' || fieldName === 'edit_user') {
      return getExtendedValue(targetHistory.params, fieldName as keyof ExtendedLibrary)
    }
    
    // 处理嵌套对象字段
    if (fieldName === 'shop') {
      return targetHistory.params.shop
    }
    
    // 处理普通字段
    return targetHistory.params[fieldName as keyof Library]
  }
  
  // 如果所有后续记录都是驳回状态或不存在，返回undefined
  return undefined
}

// 检查是否有有效的对比记录（跳过驳回状态）
const hasValidCompareRecord = (currentIndex: number): boolean => {
  // 如果是最后一条记录，没有对比记录
  if (currentIndex >= historyList.value.length - 1) {
    return false
  }
  
  // 从下一条记录开始查找，跳过驳回状态的记录
  let targetIndex = currentIndex + 1
  while (targetIndex < historyList.value.length) {
    const targetHistory = historyList.value[targetIndex]
    
    // 如果记录不存在，继续查找
    if (!targetHistory) {
      targetIndex++
      continue
    }
    
    // 如果当前记录是驳回状态（is_apply === 2），继续往前查找
    if (targetHistory.is_apply === 2) {
      targetIndex++
      continue
    }
    
    // 找到非驳回状态的记录
    return true
  }
  
  // 如果所有后续记录都是驳回状态或不存在，返回false
  return false
}

// 检查字段是否被修改（会跳过驳回状态的记录进行对比）
const isFieldChanged = (currentIndex: number, fieldName: keyof Library | keyof ExtendedLibrary, currentValue: unknown): boolean => {
  // 如果没有有效的对比记录，无法判断是否修改
  if (!hasValidCompareRecord(currentIndex)) {
    return false
  }
  
  const originalValue = getOriginalValue(currentIndex, fieldName)
  
  // 如果原值不存在，当前值存在，说明是新增
  if (!hasValue(originalValue) && hasValue(currentValue)) {
    return true
  }
  
  // 如果原值存在，当前值不存在，说明是删除
  if (hasValue(originalValue) && !hasValue(currentValue)) {
    return true
  }
  
  // 如果都存在，比较是否相等
  if (hasValue(originalValue) && hasValue(currentValue)) {
    return !isEqual(originalValue, currentValue)
  }
  
  return false
}

// 格式化字段值用于显示
const formatFieldValue = (value: unknown, fieldName: string): string => {
  if (!hasValue(value)) {
    return '无'
  }
  
  // 处理对象类型
  if (typeof value === 'object' && value !== null) {
    if ('shop_name' in value) {
      return (value as { shop_name: string }).shop_name
    }
  }
  
  // 处理布尔值
  if (typeof value === 'boolean') {
    return value ? '已完成' : '未完成'
  }
  
  // 处理数组或逗号分隔的字符串
  if (fieldName.includes('_elements') || fieldName === 'theme' || fieldName === 'season' || fieldName === 'color') {
    if (typeof value === 'string') {
      return splitComma(value).join(', ')
    }
  }
  
  return String(value)
}

onMounted(async () => {
  await config.getConfig()
  setTimeout(() => {
    fetchHistory()
  })
})

useHead({
  title: '图鉴修改历史',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,图鉴修改历史,Lolita图鉴'
    },
    {
      name: 'description',
      content: '查看图鉴的修改历史记录'
    }
  ]
})
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 px-4">
    <!-- 头部 -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold">图鉴修改历史</h1>
        <UButton
          variant="ghost"
          icon="i-heroicons-arrow-left"
          @click="router.back()"
        >
          返回
        </UButton>
      </div>
      <div v-if="libraryId && !Number.isNaN(libraryId)" class="text-sm text-gray-600 dark:text-gray-400">
        图鉴ID: {{ libraryId }}
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center items-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading && historyList.length === 0" class="text-center py-20">
      <UIcon name="i-heroicons-document-text" class="w-16 h-16 mx-auto text-gray-400 mb-4" />
      <p class="text-gray-500 dark:text-gray-400">暂无修改历史</p>
    </div>

    <!-- 历史记录列表 -->
    <div v-else class="space-y-4">
      <UCard
        v-for="(history, index) in historyList"
        :key="history.history_id || index"
        class="hover:shadow-lg transition-shadow"
      >
        <template #header>
          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <UBadge
                  :color="(formatType(history.type) === '创建' ? 'green' : formatType(history.type) === '删除' ? 'red' : 'blue') as 'green' | 'red' | 'blue'"
                  variant="subtle"
                >
                  {{ formatType(history.type) }}
                </UBadge>
                <UBadge
                  v-if="history.is_apply !== undefined"
                  :color="formatApplyStatus(history.is_apply).color as any"
                  variant="subtle"
                >
                  {{ formatApplyStatus(history.is_apply).text }}
                </UBadge>
                <UBadge
                  class="cursor-pointer"
                  variant="subtle"
                  v-if="user.hasPermi('library:manage:examin') && history.is_apply === 0"
                  @click="jumpToLibraryReview(history)"
                >
                  去审核
                </UBadge>
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {{ history.create_time ? dayjs(history.create_time).format('YYYY-MM-DD HH:mm:ss') : '' }}
              </div>
            </div>
            <div v-if="history.reason">
              备注：{{ history.reason }}
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <!-- 修改用户信息 -->
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-user" class="w-4 h-4 text-gray-400" />
            <span class="text-gray-600 dark:text-gray-400">修改人：</span>
            <span class="font-medium">{{ getUserName(history) }}</span>
          </div>

          <!-- 图鉴信息预览 -->
          <div v-if="history.params" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
            <!-- 基本信息 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- 图鉴名称 -->
              <div v-if="hasValue(history.params.name) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'name', history.params.name))" :class="['flex flex-col gap-1', isFieldChanged(index, 'name', history.params.name) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">名称：</span>
                  <span class="font-medium">{{ history.params.name }}</span>
                </div>
                <div v-if="isFieldChanged(index, 'name', history.params.name)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'name'), 'name') }}
                </div>
              </div>

              <!-- 图鉴类型 -->
              <div v-if="hasValue(history.params.library_type) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'library_type', history.params.library_type))" :class="['flex flex-col gap-1', isFieldChanged(index, 'library_type', history.params.library_type) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">类型：</span>
                  <QhxTag :active="true">{{ history.params.library_type }}</QhxTag>
                </div>
                <div v-if="isFieldChanged(index, 'library_type', history.params.library_type)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'library_type'), 'library_type') }}
                </div>
              </div>

              <!-- 状态 -->
              <div v-if="hasValue(history.params.state) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'state', history.params.state))" :class="['flex flex-col gap-1', isFieldChanged(index, 'state', history.params.state) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">状态：</span>
                  <QhxTag :active="true">{{ history.params.state }}</QhxTag>
                </div>
                <div v-if="isFieldChanged(index, 'state', history.params.state)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'state'), 'state') }}
                </div>
              </div>

              <!-- 店铺 -->
              <div v-if="history.params.shop?.shop_name && (!hasValidCompareRecord(index) || isFieldChanged(index, 'shop', history.params.shop))" :class="['flex flex-col gap-1', isFieldChanged(index, 'shop', history.params.shop) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">店铺：</span>
                  <span>{{ history.params.shop.shop_name }}</span>
                </div>
                <div v-if="isFieldChanged(index, 'shop', history.params.shop)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'shop'), 'shop') }}
                </div>
              </div>

              <!-- 价格 -->
              <div v-if="hasValue(history.params.library_price) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'library_price', history.params.library_price))" :class="['flex flex-col gap-1', isFieldChanged(index, 'library_price', history.params.library_price) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">参考价：</span>
                  <div>
                    <span class="text-qhx-primary font-semibold">
                      ¥{{ history.params.library_price }}
                      <span v-if="history.params.shop_country">
                        {{ formatLabel(history.params.shop_country as number, config.config?.money_type || []) }}
                      </span>
                    </span>
                    <div v-if="history.params.shop_country && exchangeRate(history.params.shop_country as number, history.params.library_price as number)" class="text-xs text-orange-500 mt-1">
                      汇率换算参考：{{ exchangeRate(history.params.shop_country as number, history.params.library_price as number) }}元
                    </div>
                  </div>
                </div>
                <div v-if="isFieldChanged(index, 'library_price', history.params.library_price)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>¥{{ formatFieldValue(getOriginalValue(index, 'library_price'), 'library_price') }}
                </div>
              </div>

              <!-- 尺寸 -->
              <div v-if="hasValue(history.params.size) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'size', history.params.size))" :class="['flex flex-col gap-1', isFieldChanged(index, 'size', history.params.size) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">尺码：</span>
                  <span>{{ history.params.size }}</span>
                </div>
                <div v-if="isFieldChanged(index, 'size', history.params.size)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'size'), 'size') }}
                </div>
              </div>

              <!-- 链接 -->
              <div v-if="hasValue(history.params.link) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'link', history.params.link))" :class="['flex flex-col gap-1 md:col-span-2', isFieldChanged(index, 'link', history.params.link) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">链接：</span>
                  <div :href="history.params.link || undefined" target="_blank" class="text-blue-500 hover:underline break-all">
                    {{ history.params.link }}
                  </div>
                </div>
                <div v-if="isFieldChanged(index, 'link', history.params.link)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'link'), 'link') }}
                </div>
              </div>

              <!-- 完成状态 -->
              <div v-if="getExtendedValue(history.params, 'complete') !== undefined && (!hasValidCompareRecord(index) || isFieldChanged(index, 'complete', getExtendedValue(history.params, 'complete')))" :class="['flex flex-col gap-1', isFieldChanged(index, 'complete', getExtendedValue(history.params, 'complete')) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                <div class="flex items-start gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">完成状态：</span>
                  <QhxTag :active="getExtendedValue(history.params, 'complete')" :backgroundColor="getExtendedValue(history.params, 'complete') ? '#317e10' : '#e11031'">
                    {{ getExtendedValue(history.params, 'complete') ? '已完成' : '未完成' }}
                  </QhxTag>
                </div>
                <div v-if="isFieldChanged(index, 'complete', getExtendedValue(history.params, 'complete'))" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                  <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'complete'), 'complete') }}
                </div>
              </div>

              <!-- 父图鉴ID -->
              <div v-if="hasValue(history.params.parent_id) && history.params.parent_id !== 0" class="flex items-start gap-2">
                <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">父图鉴ID：</span>
                <span>{{ history.params.parent_id }}</span>
              </div>
            </div>

            <!-- 时间信息 -->
            <div v-if="(hasValue(history.params.sale_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'sale_time', history.params.sale_time))) || (hasValue(history.params.start_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'start_time', history.params.start_time))) || (hasValue(history.params.end_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'end_time', history.params.end_time))) || (hasValue(history.params.arrears_start) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'arrears_start', history.params.arrears_start))) || (hasValue(history.params.arrears_end) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'arrears_end', history.params.arrears_end)))" class="border-t pt-4">
              <h3 class="text-sm font-medium mb-2">时间信息</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- 发售时间 -->
                <div v-if="hasValue(history.params.sale_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'sale_time', history.params.sale_time))" :class="['flex flex-col gap-1', isFieldChanged(index, 'sale_time', history.params.sale_time) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">发售时间：</span>
                    <span>{{ history.params.sale_time }}</span>
                  </div>
                  <div v-if="isFieldChanged(index, 'sale_time', history.params.sale_time)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'sale_time'), 'sale_time') }}
                  </div>
                </div>

                <!-- 开始时间 -->
                <div v-if="hasValue(history.params.start_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'start_time', history.params.start_time))" :class="['flex flex-col gap-1', isFieldChanged(index, 'start_time', history.params.start_time) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">开始时间：</span>
                    <span>{{ dayjs(history.params.start_time).format('YYYY-MM-DD HH:mm') }}</span>
                  </div>
                  <div v-if="isFieldChanged(index, 'start_time', history.params.start_time)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ getOriginalValue(index, 'start_time') ? dayjs(getOriginalValue(index, 'start_time') as string).format('YYYY-MM-DD HH:mm') : '无' }}
                  </div>
                </div>

                <!-- 结束时间 -->
                <div v-if="hasValue(history.params.end_time) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'end_time', history.params.end_time))" :class="['flex flex-col gap-1', isFieldChanged(index, 'end_time', history.params.end_time) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">结束时间：</span>
                    <span>{{ dayjs(history.params.end_time).format('YYYY-MM-DD HH:mm') }}</span>
                  </div>
                  <div v-if="isFieldChanged(index, 'end_time', history.params.end_time)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ getOriginalValue(index, 'end_time') ? dayjs(getOriginalValue(index, 'end_time') as string).format('YYYY-MM-DD HH:mm') : '无' }}
                  </div>
                </div>

                <!-- 尾款开始时间 -->
                <div v-if="hasValue(history.params.arrears_start) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'arrears_start', history.params.arrears_start))" :class="['flex flex-col gap-1', isFieldChanged(index, 'arrears_start', history.params.arrears_start) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">尾款开始：</span>
                    <span>{{ dayjs(history.params.arrears_start).format('YYYY-MM-DD HH:mm') }}</span>
                  </div>
                  <div v-if="isFieldChanged(index, 'arrears_start', history.params.arrears_start)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ getOriginalValue(index, 'arrears_start') ? dayjs(getOriginalValue(index, 'arrears_start') as string).format('YYYY-MM-DD HH:mm') : '无' }}
                  </div>
                </div>

                <!-- 尾款结束时间 -->
                <div v-if="hasValue(history.params.arrears_end) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'arrears_end', history.params.arrears_end))" :class="['flex flex-col gap-1', isFieldChanged(index, 'arrears_end', history.params.arrears_end) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">尾款结束：</span>
                    <span>{{ dayjs(history.params.arrears_end).format('YYYY-MM-DD HH:mm') }}</span>
                  </div>
                  <div v-if="isFieldChanged(index, 'arrears_end', history.params.arrears_end)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ getOriginalValue(index, 'arrears_end') ? dayjs(getOriginalValue(index, 'arrears_end') as string).format('YYYY-MM-DD HH:mm') : '无' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 分类标签 -->
            <div v-if="(hasValue(history.params.theme) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'theme', history.params.theme))) || (hasValue(history.params.season) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'season', history.params.season))) || (hasValue(history.params.color) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'color', history.params.color))) || (hasValue(history.params.pattern_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'pattern_elements', history.params.pattern_elements))) || (hasValue(history.params.design_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'design_elements', history.params.design_elements))) || (hasValue(history.params.cloth_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'cloth_elements', history.params.cloth_elements))) || (hasValue(history.params.secondary_cloth) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'secondary_cloth', history.params.secondary_cloth))) || (hasValue(history.params.fabric_composition) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'fabric_composition', history.params.fabric_composition))) || (hasValue(history.params.library_pattern) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'library_pattern', history.params.library_pattern))) || (hasValue(getExtendedValue(history.params, 'main_style')) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'main_style', getExtendedValue(history.params, 'main_style'))))" class="border-t pt-4">
              <h3 class="text-sm font-medium mb-2">分类标签</h3>
              <div class="space-y-3">
                <!-- 主题 -->
                <div v-if="hasValue(history.params.theme) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'theme', history.params.theme))" :class="['flex flex-col gap-1', isFieldChanged(index, 'theme', history.params.theme) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">主题：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.theme)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'theme', history.params.theme)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'theme'), 'theme') }}
                  </div>
                </div>

                <!-- 季节 -->
                <div v-if="hasValue(history.params.season) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'season', history.params.season))" :class="['flex flex-col gap-1', isFieldChanged(index, 'season', history.params.season) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">季节：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.season)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'season', history.params.season)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'season'), 'season') }}
                  </div>
                </div>

                <!-- 颜色 -->
                <div v-if="hasValue(history.params.color) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'color', history.params.color))" :class="['flex flex-col gap-1', isFieldChanged(index, 'color', history.params.color) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">颜色：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.color)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'color', history.params.color)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'color'), 'color') }}
                  </div>
                </div>

                <!-- 版型/部位 -->
                <div v-if="hasValue(history.params.library_pattern) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'library_pattern', history.params.library_pattern))" :class="['flex flex-col gap-1', isFieldChanged(index, 'library_pattern', history.params.library_pattern) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">版型/部位：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.library_pattern)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'library_pattern', history.params.library_pattern)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'library_pattern'), 'library_pattern') }}
                  </div>
                </div>

                <!-- 柄图元素 -->
                <div v-if="hasValue(history.params.pattern_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'pattern_elements', history.params.pattern_elements))" :class="['flex flex-col gap-1', isFieldChanged(index, 'pattern_elements', history.params.pattern_elements) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">柄图元素：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.pattern_elements)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'pattern_elements', history.params.pattern_elements)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'pattern_elements'), 'pattern_elements') }}
                  </div>
                </div>

                <!-- 设计元素 -->
                <div v-if="hasValue(history.params.design_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'design_elements', history.params.design_elements))" :class="['flex flex-col gap-1', isFieldChanged(index, 'design_elements', history.params.design_elements) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">设计元素：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.design_elements)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'design_elements', history.params.design_elements)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'design_elements'), 'design_elements') }}
                  </div>
                </div>

                <!-- 主料 -->
                <div v-if="hasValue(history.params.cloth_elements) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'cloth_elements', history.params.cloth_elements))" :class="['flex flex-col gap-1', isFieldChanged(index, 'cloth_elements', history.params.cloth_elements) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">主料：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.cloth_elements)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'cloth_elements', history.params.cloth_elements)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'cloth_elements'), 'cloth_elements') }}
                  </div>
                </div>

                <!-- 辅料/里衬 -->
                <div v-if="hasValue(history.params.secondary_cloth) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'secondary_cloth', history.params.secondary_cloth))" :class="['flex flex-col gap-1', isFieldChanged(index, 'secondary_cloth', history.params.secondary_cloth) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">辅料/里衬：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.secondary_cloth)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'secondary_cloth', history.params.secondary_cloth)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'secondary_cloth'), 'secondary_cloth') }}
                  </div>
                </div>

                <!-- 面料成分 -->
                <div v-if="hasValue(history.params.fabric_composition) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'fabric_composition', history.params.fabric_composition))" :class="['flex flex-col gap-1', isFieldChanged(index, 'fabric_composition', history.params.fabric_composition) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">面料成分：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag v-for="(tag, tagIndex) in splitComma(history.params.fabric_composition)" :key="tagIndex">
                        {{ tag }}
                      </QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'fabric_composition', history.params.fabric_composition)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'fabric_composition'), 'fabric_composition') }}
                  </div>
                </div>

                <!-- 主要风格 -->
                <div v-if="hasValue(getExtendedValue(history.params, 'main_style')) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'main_style', getExtendedValue(history.params, 'main_style')))" :class="['flex flex-col gap-1', isFieldChanged(index, 'main_style', getExtendedValue(history.params, 'main_style')) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">主要风格：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxTag>{{ getExtendedValue(history.params, 'main_style') }}</QhxTag>
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'main_style', getExtendedValue(history.params, 'main_style'))" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'main_style'), 'main_style') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 图片信息 -->
            <div v-if="(hasValue(history.params.cover) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'cover', history.params.cover))) || (hasValue(getExtendedValue(history.params, 'square_cover')) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'square_cover', getExtendedValue(history.params, 'square_cover')))) || (hasValue(history.params.detail_image) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'detail_image', history.params.detail_image))) || (hasValue(history.params.size_image) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'size_image', history.params.size_image)))" class="border-t pt-4">
              <h3 class="text-sm font-medium mb-2">图片信息</h3>
              <div class="space-y-3">
                <!-- 封面图片 -->
                <div v-if="hasValue(history.params.cover) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'cover', history.params.cover))" :class="['flex flex-col gap-1', isFieldChanged(index, 'cover', history.params.cover) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">封面：</span>
                    <QhxPreviewImage
                      :list="[{ src: history.params.cover, alt: history.params.name }]"
                      :className="'cursor-pointer w-32 h-32 object-cover rounded-lg shadow-lg border border-gray-200'"
                    />
                  </div>
                  <div v-if="isFieldChanged(index, 'cover', history.params.cover)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'cover'), 'cover') }}
                  </div>
                </div>

                <!-- 方形封面 -->
                <div v-if="hasValue(getExtendedValue(history.params, 'square_cover')) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'square_cover', getExtendedValue(history.params, 'square_cover')))" :class="['flex flex-col gap-1', isFieldChanged(index, 'square_cover', getExtendedValue(history.params, 'square_cover')) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">方形封面：</span>
                    <QhxPreviewImage
                      :list="[{ src: getExtendedValue(history.params, 'square_cover') || '', alt: history.params.name }]"
                      :className="'cursor-pointer w-32 h-32 object-cover rounded-lg shadow-lg border border-gray-200'"
                    />
                  </div>
                  <div v-if="isFieldChanged(index, 'square_cover', getExtendedValue(history.params, 'square_cover'))" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'square_cover'), 'square_cover') }}
                  </div>
                </div>

                <!-- 详情图片 -->
                <div v-if="hasValue(history.params.detail_image) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'detail_image', history.params.detail_image))" :class="['flex flex-col gap-1', isFieldChanged(index, 'detail_image', history.params.detail_image) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">详情图片：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxPreviewImage
                        v-for="(img, imgIndex) in splitComma(history.params.detail_image)"
                        :key="imgIndex"
                        :list="[{ src: img, alt: history.params.name }]"
                        :className="'cursor-pointer w-24 h-24 object-cover rounded-lg shadow-lg border border-gray-200'"
                      />
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'detail_image', history.params.detail_image)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'detail_image'), 'detail_image') }}
                  </div>
                </div>

                <!-- 信息表图片 -->
                <div v-if="hasValue(history.params.size_image) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'size_image', history.params.size_image))" :class="['flex flex-col gap-1', isFieldChanged(index, 'size_image', history.params.size_image) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
                  <div class="flex items-start gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">信息表：</span>
                    <div class="flex flex-wrap gap-2">
                      <QhxPreviewImage
                        v-for="(img, imgIndex) in splitComma(history.params.size_image || undefined)"
                        :key="imgIndex"
                        :list="[{ src: img + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: history.params.name }]"
                        :preview="splitComma(history.params.size_image || undefined).map(image => BASE_IMG + image)"
                        :className="'cursor-pointer w-24 h-24 object-cover rounded-lg shadow-lg border border-gray-200'"
                      />
                    </div>
                  </div>
                  <div v-if="isFieldChanged(index, 'size_image', history.params.size_image)" class="text-xs text-gray-500 dark:text-gray-400 ml-[100px]">
                    <span class="text-yellow-600 dark:text-yellow-400">原值：</span>{{ formatFieldValue(getOriginalValue(index, 'size_image'), 'size_image') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 备注 -->
            <div v-if="hasValue(history.params.notes) && (!hasValidCompareRecord(index) || isFieldChanged(index, 'notes', history.params.notes))" :class="['border-t pt-4', isFieldChanged(index, 'notes', history.params.notes) ? 'bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600' : '']">
              <h3 class="text-sm font-medium mb-2">备注</h3>
              <div class="text-sm" v-html="history.params.notes"></div>
              <div v-if="isFieldChanged(index, 'notes', history.params.notes)" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span class="text-yellow-600 dark:text-yellow-400">原值：</span>
                <div class="text-sm mt-1" v-html="formatFieldValue(getOriginalValue(index, 'notes'), 'notes')"></div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div class="flex-1"></div>
            <span class="text-xs text-gray-400">
              历史ID: {{ history.history_id || '-' }}
            </span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style>

