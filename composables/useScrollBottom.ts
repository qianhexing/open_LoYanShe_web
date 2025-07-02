import { ref, onMounted, onUnmounted } from 'vue'
import { debounce } from '@/utils/public'

export default function useScrollBottom(
  callback: () => Promise<void> | void,
  options: {
    distance?: number
    immediate?: boolean
    disabled?: boolean
    debounce?: number // 防抖时间(ms)
  } = {}
) {
  const { distance = 50, immediate = false, disabled = false, debounce: debounceTime = 200 } = options
  const isLoading = ref(false)
  const isFinished = ref(false)
  const scrollListener = ref<(() => void) | null>(null)

  const checkScroll = () => {
    // SSR 安全检查
    if (typeof document === 'undefined') return
    if (disabled || isLoading.value || isFinished.value) return

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement
    const isBottom = scrollTop + clientHeight >= scrollHeight - distance

    if (isBottom) {
      executeCallback()
    }
  }

  // 初始化滚动监听器
  const initScrollListener = () => {
    if (debounceTime > 0) {
      scrollListener.value = debounce(checkScroll, debounceTime)
    } else {
      scrollListener.value = checkScroll
    }
  }

  const executeCallback = async () => {
    if (isLoading.value) return
    
    isLoading.value = true
    try {
      await callback()
    } catch (error) {
      console.error('ScrollBottom callback error:', error)
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    // 确保只在客户端执行
    if (process.client) {
      initScrollListener()
      window.addEventListener('scroll', scrollListener.value!)
      
      // 初始检查，确保内容不足一屏时也能触发
      requestAnimationFrame(() => {
        checkScroll()
      })
      
      if (immediate) {
        executeCallback()
      }
    }
  })

  onUnmounted(() => {
    if (process.client && scrollListener.value) {
      window.removeEventListener('scroll', scrollListener.value)
      if ('cancel' in scrollListener.value) {
        (scrollListener.value as any).cancel()
      }
    }
  })

  return {
    isLoading,
    isFinished,
    setFinished: (value: boolean) => { isFinished.value = value },
    // 添加手动检查方法
    check: () => {
      if (process.client) {
        checkScroll()
      }
    }
  }
}