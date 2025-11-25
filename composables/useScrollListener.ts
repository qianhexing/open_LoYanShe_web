import { ref, onMounted, onUnmounted } from 'vue'

export interface ScrollEvent {
  deltaX: number
  deltaY: number
  deltaZ: number
  wheelDelta: number
  direction: 'up' | 'down' | 'left' | 'right'
  event: WheelEvent
}

export interface TouchScrollEvent {
  deltaX: number
  deltaY: number
  direction: 'up' | 'down' | 'left' | 'right'
  event: TouchEvent
}

export interface ScrollListenerOptions {
  /**
   * 是否启用鼠标中键滚动监听
   */
  enableWheel?: boolean
  /**
   * 是否启用手势拖拽滚动监听
   */
  enableTouch?: boolean
  /**
   * 滚动阈值，小于此值的事件将被忽略
   */
  threshold?: number
  /**
   * 是否阻止默认滚动行为
   */
  preventDefault?: boolean
  /**
   * 目标元素选择器，如果不提供则监听整个窗口
   */
  target?: string | HTMLElement
}

export function useScrollListener(options: ScrollListenerOptions = {}) {
  const {
    enableWheel = true,
    enableTouch = true,
    threshold = 1,
    preventDefault = false,
    target
  } = options

  const isScrolling = ref(false)
  const scrollDirection = ref<'up' | 'down' | 'left' | 'right' | null>(null)
  const lastScrollTime = ref(0)

  let targetElement: HTMLElement | Window | null = null
  let touchStartX = 0
  let touchStartY = 0
  let lastTouchX = 0
  let lastTouchY = 0
  let isTouching = false

  // 鼠标滚轮事件处理
  const handleWheel = (event: WheelEvent) => {
    if (!enableWheel) return

    const deltaX = event.deltaX || 0
    const deltaY = event.deltaY || 0
    const deltaZ = event.deltaZ || 0
    const wheelDelta = (event as WheelEvent & { wheelDelta?: number }).wheelDelta || 0

    // 检查是否超过阈值
    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return

    // 确定滚动方向
    let direction: 'up' | 'down' | 'left' | 'right'
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      direction = deltaY > 0 ? 'down' : 'up'
    } else {
      direction = deltaX > 0 ? 'right' : 'left'
    }

    const scrollEvent: ScrollEvent = {
      deltaX,
      deltaY,
      deltaZ,
      wheelDelta,
      direction,
      event
    }

    // 更新状态
    isScrolling.value = true
    scrollDirection.value = direction
    lastScrollTime.value = Date.now()

    // 触发自定义事件
    const customEvent = new CustomEvent('scroll-wheel', {
      detail: scrollEvent
    })
    targetElement?.dispatchEvent(customEvent)

    // 阻止默认行为
    if (preventDefault) {
      event.preventDefault()
    }

    // 重置滚动状态
    setTimeout(() => {
      isScrolling.value = false
      scrollDirection.value = null
    }, 150)
  }

  // 触摸开始事件处理
  const handleTouchStart = (event: TouchEvent) => {
    if (!enableTouch || event.touches.length !== 1) return

    isTouching = true
    const touch = event.touches[0]
    touchStartX = touch.clientX
    touchStartY = touch.clientY
    lastTouchX = touch.clientX
    lastTouchY = touch.clientY
  }

  // 触摸移动事件处理
  const handleTouchMove = (event: TouchEvent) => {
    if (!enableTouch || !isTouching || event.touches.length !== 1) return

    const touch = event.touches[0]
    const deltaX = touch.clientX - lastTouchX
    const deltaY = touch.clientY - lastTouchY

    // 检查是否超过阈值
    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return

    // 确定滚动方向
    let direction: 'up' | 'down' | 'left' | 'right'
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      direction = deltaY > 0 ? 'down' : 'up'
    } else {
      direction = deltaX > 0 ? 'right' : 'left'
    }

    const touchScrollEvent: TouchScrollEvent = {
      deltaX,
      deltaY,
      direction,
      event
    }

    // 更新状态
    isScrolling.value = true
    scrollDirection.value = direction
    lastScrollTime.value = Date.now()

    // 触发自定义事件
    const customEvent = new CustomEvent('scroll-touch', {
      detail: touchScrollEvent
    })
    targetElement?.dispatchEvent(customEvent)

    // 阻止默认行为
    if (preventDefault) {
      event.preventDefault()
    }

    // 更新最后触摸位置
    lastTouchX = touch.clientX
    lastTouchY = touch.clientY

    // 重置滚动状态
    setTimeout(() => {
      isScrolling.value = false
      scrollDirection.value = null
    }, 150)
  }

  // 触摸结束事件处理
  const handleTouchEnd = (event: TouchEvent) => {
    isTouching = false
  }

  // 获取目标元素
  const getTargetElement = () => {
    if (target) {
      if (typeof target === 'string') {
        return document.querySelector(target) as HTMLElement
      }
      return target
    }
    return window
  }

  // 添加事件监听器
  const addEventListeners = () => {
    targetElement = getTargetElement()
    
    if (!targetElement) {
      console.warn('useScrollListener: 目标元素未找到')
      return
    }

    if (enableWheel) {
      targetElement.addEventListener('wheel', handleWheel, { passive: !preventDefault })
    }

    if (enableTouch) {
      targetElement.addEventListener('touchstart', handleTouchStart, { passive: !preventDefault })
      targetElement.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault })
      targetElement.addEventListener('touchend', handleTouchEnd, { passive: true })
    }
  }

  // 移除事件监听器
  const removeEventListeners = () => {
    if (!targetElement) return

    if (enableWheel) {
      targetElement.removeEventListener('wheel', handleWheel)
    }

    if (enableTouch) {
      targetElement.removeEventListener('touchstart', handleTouchStart)
      targetElement.removeEventListener('touchmove', handleTouchMove)
      targetElement.removeEventListener('touchend', handleTouchEnd)
    }
  }

  // 监听自定义事件
  const onScrollWheel = (callback: (event: ScrollEvent) => void) => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<ScrollEvent>
      callback(customEvent.detail)
    }
    
    targetElement?.addEventListener('scroll-wheel', handler)
    
    return () => {
      targetElement?.removeEventListener('scroll-wheel', handler)
    }
  }

  const onScrollTouch = (callback: (event: TouchScrollEvent) => void) => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<TouchScrollEvent>
      callback(customEvent.detail)
    }
    
    targetElement?.addEventListener('scroll-touch', handler)
    
    return () => {
      targetElement?.removeEventListener('scroll-touch', handler)
    }
  }

  // 生命周期管理
  onMounted(() => {
    addEventListeners()
  })

  onUnmounted(() => {
    removeEventListeners()
  })

  return {
    isScrolling: readonly(isScrolling),
    scrollDirection: readonly(scrollDirection),
    lastScrollTime: readonly(lastScrollTime),
    onScrollWheel,
    onScrollTouch,
    addEventListeners,
    removeEventListeners
  }
}
