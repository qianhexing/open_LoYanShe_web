<script setup lang="ts">
import { ref, watch, watchEffect, onMounted, onUnmounted, nextTick } from 'vue'
import { debounce } from '@/utils/public'

interface Props<T> {
  // 获取数据的方法
  fetchData: (page: number, pageSize: number) => Promise<{
    rows: T[]
    count: number
  }>
  // 列数
  columns?: number
  columns_768?: number
  itemKey?: number
  // 每页大小
  pageSize?: number
  // 是否启用瀑布流布局
  enableWaterfall?: boolean
  // 滚动到底部触发加载的距离
  scrollDistance?: number
  // 自定义类名
  className?: string
  // 是否启用加载更多
  enableLoadMore?: boolean
}

const props = withDefaults(defineProps<Props<any>>(), {
  columns: 4,
  pageSize: 20,
  enableWaterfall: true,
  enableLoadMore: true,
  scrollDistance: 300,
  className: '',
  itemKey: 0
})

const emit = defineEmits(['loading', 'loaded', 'error'])

// 分页状态
const page = ref(1)
const isLoading = ref(false)
const isFinished = ref(false)
const list = ref<any[]>([])
const total = ref(0)

// 响应式列数（可根据屏幕宽度调整）
const column = ref(props.columns)

// 获取数据
const loadData = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (isLoading.value || isFinished.value) return
  
  isLoading.value = true
  emit('loading')
  
  try {
    const response = await props.fetchData(initPage || page.value, initPageSize || props.pageSize)
    list.value = page.value === 1 
      ? response.rows 
      : [...list.value, ...response.rows]
    
    total.value = response.count
    isFinished.value = (initPage || page.value) * (initPageSize || props.pageSize) >= response.count
    
    if (process.client && props.enableWaterfall) {
      setTimeout(() => {
        applyWaterfallLayout()
      })
    }
  } catch (error) {
    emit('error', error)
  } finally {
    isLoading.value = false
    emit('loaded')
  }
}

// 瀑布流布局函数
const applyWaterfallLayout = () => {
  if (!props.enableWaterfall) return
  
  const container = document.querySelector(`.waterfall-container${props.itemKey === 0 ? '' : props.itemKey}`)
  if (!container) return
  
  const items = container.querySelectorAll(`.waterfall-item${props.itemKey === 0 ? '' : props.itemKey}`)
  if (items.length === 0) return
  
  // 重置所有项目位置
  // biome-ignore lint/complexity/noForEach: <explanation>
      items.forEach(item => {
    (item as HTMLElement).style.position = 'static'
  })
  
  // 计算每列高度
  const columnHeights = new Array(column.value).fill(0)
  const itemWidth = 100 / column.value
  
  items.forEach((item, index) => {
    const itemElement = item as HTMLElement
    const minHeightIndex = columnHeights.indexOf(Math.min(...columnHeights))
    
    itemElement.style.position = 'absolute'
    itemElement.style.width = `${itemWidth}%`
    itemElement.style.left = `${minHeightIndex * itemWidth}%`
    itemElement.style.top = `${columnHeights[minHeightIndex]}px`
    
    // 更新列高度
    columnHeights[minHeightIndex] += itemElement.offsetHeight
  })
  
  // 设置容器高度
  container.style.height = `${Math.max(...columnHeights)}px`
}

// 加载更多
const loadMore = () => {
  if (!props.enableLoadMore) {
    return
  }
  if (isLoading.value || isFinished.value) return
  page.value += 1
  loadData()
}

// 刷新数据
const refresh = (savePage = false) => {
  if (savePage) {
    isFinished.value = false
    loadData(1, props.pageSize * page.value)
  } else {
    page.value = 1
    isFinished.value = false
    loadData()
  }
}

// 监听滚动到底部
const handleScroll = () => {
  if (isLoading.value || isFinished.value) return
  
  const { scrollTop, clientHeight, scrollHeight } = document.documentElement
  if (scrollTop + clientHeight >= scrollHeight - props.scrollDistance) {
    loadMore()
  }
}
watch(() => props.columns_768, () => {
  if (process.client) {
    updateColumns()
  }
})
// 响应式调整列数
const updateColumns = () => {
  if (!process.client) return
  
  const width = window.innerWidth
  if (width < 768) {
    column.value = props.columns_768 || 2
  } else {
    column.value = props.columns
  }
  
  if (props.enableWaterfall) {
    debouncedApplyLayout()
  }
}

const debouncedApplyLayout = debounce(applyWaterfallLayout, 300)

// 初始化
onMounted(() => {
  updateColumns()
  if (process.client) {
    window.addEventListener('resize', updateColumns)
    window.addEventListener('scroll', handleScroll)
  }
  loadData()
})

// 清理
onUnmounted(() => {
  if (process.client) {
    window.removeEventListener('resize', updateColumns)
    window.removeEventListener('scroll', handleScroll)
  }
})

// 更新单个 item
const updateItem = <T = unknown>(idKey: string, idValue: unknown, updates: Partial<T>) => {
  const index = list.value.findIndex((item: T) => (item as Record<string, unknown>)[idKey] === idValue)
  if (index !== -1) {
    // 使用 Object.assign 或展开运算符来更新对象
    list.value[index] = { ...list.value[index], ...updates } as T
    list.value.splice(index, 1, { ...list.value[index], ...updates } as T)
    console.log({ ...list.value[index], ...updates }, '更新后的item')

    // this.￥set
    // 如果启用了瀑布流，需要重新布局
    if (props.enableWaterfall) {
      nextTick(() => {
        debouncedApplyLayout()
      })
    }
  }
}

// 暴露方法
defineExpose({
  refresh,
  loadMore,
  total,
  debouncedApplyLayout,
  updateItem,
  list
})
</script>

<template>
  <div :class="['waterfall-wrapper', className]">
    <!-- 瀑布流容器 -->
    <div class="waterfall-default-container relative w-full" :class="`waterfall-container${props.itemKey === 0 ? '' : props.itemKey}`">
      <!-- 每个项目 -->
      <div 
        v-for="(item, index) in list" 
        :key="index" 
        class="waterfall-default-item"
        :class="`waterfall-item${props.itemKey === 0 ? '' : props.itemKey}`"
        :style="`width: calc(100% / ${column})`"
      >
        <!-- 插槽内容 -->
        <slot :item="item" :debouncedApplyLayout="debouncedApplyLayout" :index="index"></slot>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-indicator">
      <slot name="loading">加载中...</slot>
    </div>
    
    <!-- 无数据状态 -->
    <div v-if="!isLoading && list.length === 0" class="empty-state">
      <slot name="empty">暂无数据</slot>
    </div>
    
    <!-- 全部加载完成 -->
    <div v-if="isFinished && list.length > 0" class="finished-indicator">
      <slot name="finished">没有更多了</slot>
    </div>
  </div>
</template>

<style scoped>
/* .waterfall-container {
  transition: height 0.3s ease;
} */
.waterfall-default-container{
  transition: height 0.3s ease;
}

.waterfall-default-item {
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.loading-indicator,
.empty-state,
.finished-indicator {
  padding: 20px;
  text-align: center;
  color: #666;
}
</style>