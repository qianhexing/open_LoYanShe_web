<!-- 可拖拽半模态框组件，支持四个方向 -->
<template>
  <div
    class="fixed z-50 bg-qhx-bg-card shadow-2xl"
    :class="[
      drawerClasses,
      { 'drawer-dragging': isDragging, 'drawer-transition': !isDragging }
    ]"
    :style="drawerStyle"
  >
    <!-- 拖拽手柄 -->
    <div
      class="drawer-handle cursor-grab active:cursor-grabbing"
      :class="handleClasses"
      @mousedown="handleDragStart"
      @touchstart="handleDragStart"
    >
      <div :class="handleBarClasses"></div>
    </div>

    <!-- 内容区域 -->
    <div class="drawer-content overflow-auto px-4 pb-4" :class="contentClasses" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

type DrawerDirection = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  /** 弹出方向 */
  direction?: DrawerDirection
  /** 默认尺寸（像素）- 垂直方向为高度，水平方向为宽度 */
  defaultSize?: number
  /** 最小尺寸（像素） */
  minSize?: number
  /** 安全区域（像素），用于计算最大尺寸 */
  safeArea?: number
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'bottom',
  defaultSize: 400,
  minSize: 100,
  safeArea: 50
})

// 判断是否为垂直方向
const isVertical = computed(() => props.direction === 'top' || props.direction === 'bottom')
// 判断是否为水平方向
const isHorizontal = computed(() => props.direction === 'left' || props.direction === 'right')

const drawerSize = ref(props.defaultSize)
const minDrawerSize = props.minSize
const maxDrawerSize = ref(0)
const isDragging = ref(false)
const startPos = ref(0) // 拖拽开始位置（Y或X）
const startSize = ref(0) // 拖拽开始时的尺寸
const iframeStyles = ref<Map<HTMLIFrameElement, string>>(new Map()) // 存储 iframe 的原始 pointer-events 样式

// 使用 requestAnimationFrame 优化拖拽更新
let rafId: number | null = null
let pendingSize: number | null = null

// 更新尺寸的函数，使用 RAF 批量更新
const updateSize = (newSize: number) => {
  pendingSize = newSize
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      if (pendingSize !== null) {
        drawerSize.value = pendingSize
        pendingSize = null
      }
      rafId = null
    })
  }
}

// 禁用所有 iframe 的交互（防止 iframe 拦截鼠标事件）
const disableIframes = () => {
  const iframes = document.querySelectorAll('iframe')
  iframes.forEach((iframe) => {
    const originalStyle = iframe.style.pointerEvents
    iframeStyles.value.set(iframe, originalStyle)
    iframe.style.pointerEvents = 'none'
  })
}

// 恢复所有 iframe 的交互
const enableIframes = () => {
  iframeStyles.value.forEach((originalStyle, iframe) => {
    iframe.style.pointerEvents = originalStyle
  })
  iframeStyles.value.clear()
}

// 拖拽开始
const handleDragStart = (e: MouseEvent | TouchEvent) => {
  isDragging.value = true
  const isTouch = 'touches' in e
  const clientPos = isTouch ? (isVertical.value ? e.touches[0].clientY : e.touches[0].clientX) : (isVertical.value ? (e as MouseEvent).clientY : (e as MouseEvent).clientX)
  startPos.value = clientPos
  startSize.value = drawerSize.value
  
  // 禁用所有 iframe 的交互，防止 iframe 拦截鼠标事件
  disableIframes()
  
  // 添加事件监听器（使用 document 和 capture 模式，确保鼠标移出元素后仍能捕获事件）
  document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
  document.addEventListener('touchend', handleTouchEnd, { capture: true })
  
  e.preventDefault()
}

// 拖拽移动
const handleDragMove = (e: MouseEvent | TouchEvent) => {
  console.log('拖拽', isDragging.value)
  if (!isDragging.value) return
  
  const isTouch = 'touches' in e
  const clientPos = isTouch ? (isVertical.value ? e.touches[0].clientY : e.touches[0].clientX) : (isVertical.value ? (e as MouseEvent).clientY : (e as MouseEvent).clientX)
  
  let delta: number
  if (isVertical.value) {
    // 垂直方向：top 向下拖拽为正，bottom 向上拖拽为正
    delta = props.direction === 'top' 
      ? clientPos - startPos.value 
      : startPos.value - clientPos
  } else {
    // 水平方向：left 向右拖拽为正，right 向左拖拽为正
    delta = props.direction === 'left'
      ? clientPos - startPos.value
      : startPos.value - clientPos
  }
  
  const newSize = Math.max(minDrawerSize, Math.min(maxDrawerSize.value, startSize.value + delta))
  updateSize(newSize)
}

// 拖拽结束
const handleDragEnd = () => {
  isDragging.value = false
  
  // 恢复所有 iframe 的交互
  enableIframes()
  
  // 清理事件监听器（需要匹配 capture 选项）
  document.removeEventListener('mousemove', handleMouseMove, { capture: true })
  document.removeEventListener('mouseup', handleMouseUp, { capture: true })
  document.removeEventListener('touchmove', handleTouchMove, { capture: true })
  document.removeEventListener('touchend', handleTouchEnd, { capture: true })
  
  // 确保最后的更新被应用
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (pendingSize !== null) {
    drawerSize.value = pendingSize
    pendingSize = null
  }
}

// 更新最大尺寸（使用防抖优化）
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const updateMaxSize = () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    if (isVertical.value) {
      maxDrawerSize.value = window.innerHeight - props.safeArea
    } else {
      maxDrawerSize.value = window.innerWidth - props.safeArea
    }
    if (drawerSize.value > maxDrawerSize.value) {
      drawerSize.value = maxDrawerSize.value
    }
    resizeTimer = null
  }, 150) // 150ms 防抖延迟
}

// 事件处理函数引用（使用箭头函数保持 this 绑定）
const handleMouseMove = (e: MouseEvent) => handleDragMove(e)
const handleMouseUp = () => handleDragEnd()
const handleTouchMove = (e: TouchEvent) => handleDragMove(e)
const handleTouchEnd = () => handleDragEnd()

// 计算样式类
const drawerClasses = computed(() => {
  if (props.direction === 'bottom') {
    return 'bottom-0 left-0 right-0 rounded-t-3xl'
  } else if (props.direction === 'top') {
    return 'top-0 left-0 right-0 rounded-b-3xl'
  } else if (props.direction === 'left') {
    return 'left-0 top-0 bottom-0 rounded-r-3xl'
  } else if (props.direction === 'right') {
    return 'right-0 top-0 bottom-0 rounded-l-3xl'
  }
  return ''
})

// 计算样式
const drawerStyle = computed(() => {
  if (isVertical.value) {
    return {
      height: `${drawerSize.value}px`
    }
  } else {
    return {
      width: `${drawerSize.value}px`
    }
  }
})

// 手柄样式类
const handleClasses = computed(() => {
  if (isVertical.value) {
    return 'flex justify-center pt-3 pb-2'
  } else {
    return 'flex items-center pl-2 pr-3'
  }
})

// 手柄条样式类
const handleBarClasses = computed(() => {
  if (isVertical.value) {
    return 'w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full'
  } else {
    return 'h-12 w-1.5 bg-gray-300 dark:bg-gray-600 rounded-full'
  }
})

// 内容区域样式类
const contentClasses = computed(() => {
  if (isVertical.value) {
    return 'overflow-y-auto'
  } else {
    return 'overflow-x-auto'
  }
})

// 内容区域样式
const contentStyle = computed(() => {
  if (isVertical.value) {
    return {
      height: `calc(100% - 3rem)`
    }
  } else {
    return {
      width: `calc(100% - 3rem)`
    }
  }
})

onMounted(() => {
  // 设置最大尺寸
  if (isVertical.value) {
    maxDrawerSize.value = window.innerHeight - props.safeArea
  } else {
    maxDrawerSize.value = window.innerWidth - props.safeArea
  }
  // 设置默认尺寸（不超过最大尺寸）
  drawerSize.value = Math.min(props.defaultSize, maxDrawerSize.value * 0.6)

  // 监听窗口大小变化（使用防抖）
  window.addEventListener('resize', updateMaxSize, { passive: true })
  window.addEventListener('mousemove', handleMouseMove, { capture: true })
  window.addEventListener('mouseup', handleMouseUp, { capture: true })
})

onUnmounted(() => {
  // 清理窗口大小监听
  window.removeEventListener('resize', updateMaxSize)
  
  // 清理防抖定时器
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  
  // 清理 RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
  
  // 确保恢复所有 iframe 的交互
  enableIframes()
  
  // 确保清理所有事件监听器（防止内存泄漏，需要匹配 capture 选项）
  document.removeEventListener('mousemove', handleMouseMove, { capture: true })
  document.removeEventListener('mouseup', handleMouseUp, { capture: true })
  document.removeEventListener('touchmove', handleTouchMove, { capture: true })
  document.removeEventListener('touchend', handleTouchEnd, { capture: true })
})
</script>

<style scoped>
/* 半模态框样式 */
.drawer-content {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* 拖拽手柄样式 */
.drawer-handle {
  user-select: none;
  -webkit-user-select: none;
}

/* 防止拖拽时选中文本 */
.drawer-dragging {
  user-select: none;
  -webkit-user-select: none;
}

/* 平滑过渡 */
.drawer-transition {
  transition: height 0.2s ease-out, width 0.2s ease-out;
}

/* 滚动条样式 */
.drawer-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>

