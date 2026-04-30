<!-- 可拖拽半模态框组件，支持四个方向 -->
<template>
  <div
    class="fixed z-50 overflow-hidden bg-qhx-bg-card drawer-neu"
    :class="[
      drawerClasses,
      drawerFlexLayout,
      { 'drawer-dragging': isDragging, 'drawer-transition': !isDragging }
    ]"
    :style="drawerStyle"
  >
    <!-- 拖拽手柄：通过 flex 顺序保证始终贴在「朝向屏幕中心」的一侧 -->
    <div
      class="drawer-handle shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      :class="handleClasses"
      @mousedown="handleDragStart"
      @touchstart="handleDragStart"
    >
      <div class="handle-bar-neu" :class="handleBarClasses"></div>
    </div>

    <!-- 内容区域：flex-1 + min-*-0 避免与手柄争抢高度/宽度 -->
    <div
      class="drawer-content min-h-0 min-w-0 flex-1 overflow-auto"
      :class="[contentClasses, props.contentPadding ? 'px-4 pb-4' : 'p-0']"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

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
  /** 是否为内容区保留默认左右/底部内边距（px-4 pb-4）；false 时贴边，由插槽自控间距 */
  contentPadding?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'bottom',
  defaultSize: 400,
  minSize: 100,
  safeArea: 50,
  contentPadding: true
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
  for (const iframe of iframes) {
    const originalStyle = iframe.style.pointerEvents
    iframeStyles.value.set(iframe, originalStyle)
    iframe.style.pointerEvents = 'none'
  }
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

/** 按当前方向用视口高或宽计算 max，并夹住 drawerSize（direction 从 right↔bottom 切换时必须立刻执行，否则会沿用另一轴的 max，出现「只能半屏」） */
const applyViewportBoundsSync = () => {
  if (typeof window === 'undefined') return
  if (isVertical.value) {
    maxDrawerSize.value = window.innerHeight - props.safeArea
  } else {
    maxDrawerSize.value = window.innerWidth - props.safeArea
  }
  if (drawerSize.value > maxDrawerSize.value) {
    drawerSize.value = maxDrawerSize.value
  }
  if (drawerSize.value < minDrawerSize) {
    drawerSize.value = minDrawerSize
  }
}

// 更新最大尺寸（使用防抖优化）
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const updateMaxSize = () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    applyViewportBoundsSync()
    resizeTimer = null
  }, 150) // 150ms 防抖延迟
}

watch(
  () => props.direction,
  () => {
    applyViewportBoundsSync()
  }
)

// 事件处理函数引用（使用箭头函数保持 this 绑定）
const handleMouseMove = (e: MouseEvent) => handleDragMove(e)
const handleMouseUp = () => handleDragEnd()
const handleTouchMove = (e: TouchEvent) => handleDragMove(e)
const handleTouchEnd = () => handleDragEnd()

// 计算样式类
/** 贴边定位；左右全屏边栏不使用圆角，与屏幕边缘贴合 */
const drawerClasses = computed(() => {
  if (props.direction === 'bottom') {
    return 'bottom-0 left-0 right-0 rounded-t-[1.75rem]'
  }
  if (props.direction === 'top') {
    return 'top-0 left-0 right-0 rounded-b-[1.75rem]'
  }
  if (props.direction === 'left') {
    return 'left-0 top-0 bottom-0 rounded-none'
  }
  if (props.direction === 'right') {
    return 'right-0 top-0 bottom-0 rounded-none'
  }
  return ''
})

/** 主轴布局：保证手柄在「内边」一侧（靠视口中心），内容与手柄相邻无错位 */
const drawerFlexLayout = computed(() => {
  if (props.direction === 'bottom') return 'flex flex-col'
  if (props.direction === 'top') return 'flex flex-col-reverse'
  if (props.direction === 'left') return 'flex flex-row-reverse'
  return 'flex flex-row'
})

// 计算样式
const drawerStyle = computed(() => {
  if (isVertical.value) {
    return {
      height: `${drawerSize.value}px`
    }
  }
  return {
    width: `${drawerSize.value}px`
  }
})

// 手柄触控条区域（固定厚度；左右方向略窄以少占内容宽度）
const handleClasses = computed(() => {
  if (isVertical.value) {
    return 'flex w-full items-center justify-center py-1.5'
  }
  return 'flex h-full w-7 flex-col items-center justify-center'
})

const handleBarClasses = computed(() => {
  if (isVertical.value) {
    return 'h-1 w-12 rounded-full'
  }
  return 'h-10 w-1 rounded-full'
})

// 内容区域样式类
const contentClasses = computed(() => {
  if (isVertical.value) {
    return 'overflow-y-auto'
  }
  return 'overflow-x-auto'
})

onMounted(() => {
  applyViewportBoundsSync()
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
/* 拟态外壳：柔和凸面 + 与主题的轻微镶边 */
.drawer-neu {
  border: 1px solid rgb(255 255 255 / 0.45);
  box-shadow:
    10px 12px 28px rgb(15 23 42 / 0.12),
    -6px -6px 18px rgb(255 255 255 / 0.75),
    inset 0 1px 0 rgb(255 255 255 / 0.65);
}

:root.dark .drawer-neu,
.dark .drawer-neu {
  border-color: rgb(255 255 255 / 0.08);
  box-shadow:
    12px 14px 32px rgb(0 0 0 / 0.55),
    -4px -4px 14px rgb(255 255 255 / 0.04),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
}

/* 手柄凹槽条 */
.handle-bar-neu {
  background: rgb(0 0 0 / 0.06);
  box-shadow:
    inset 2px 2px 4px rgb(15 23 42 / 0.12),
    inset -2px -2px 5px rgb(255 255 255 / 0.7);
}

:root.dark .handle-bar-neu,
.dark .handle-bar-neu {
  background: rgb(255 255 255 / 0.08);
  box-shadow:
    inset 2px 2px 5px rgb(0 0 0 / 0.45),
    inset -1px -1px 3px rgb(255 255 255 / 0.08);
}

/* 半模态框样式 */
.drawer-content {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* 拖拽手柄样式 */
.drawer-handle {
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
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

/* ========== 显示/隐藏动画 - 需父级用 <Transition :name="`drawer-${direction}`"> 包裹 ========== */
/* bottom: 从下方弹出，向下方收缩 */
.drawer-bottom-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.drawer-bottom-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out;
}
.drawer-bottom-enter-to {
  transform: translateY(0);
  opacity: 1;
}
.drawer-bottom-leave-from {
  transform: translateY(0);
  opacity: 1;
}
.drawer-bottom-leave-active {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in;
}
.drawer-bottom-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* top: 从上方弹出，向上方收缩 */
.drawer-top-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.drawer-top-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out;
}
.drawer-top-enter-to {
  transform: translateY(0);
  opacity: 1;
}
.drawer-top-leave-from {
  transform: translateY(0);
  opacity: 1;
}
.drawer-top-leave-active {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in;
}
.drawer-top-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* left: 从左侧弹出，向左侧收缩 */
.drawer-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.drawer-left-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out;
}
.drawer-left-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.drawer-left-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.drawer-left-leave-active {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in;
}
.drawer-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* right: 从右侧弹出，向右侧收缩 */
.drawer-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.drawer-right-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out;
}
.drawer-right-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.drawer-right-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.drawer-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in;
}
.drawer-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>

