import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

const LONG_PRESS_MS = 480
const MOVE_CANCEL_PX = 10

/**
 * Live 动图播放：默认播一次；短按角标重播；长按角标切换循环。
 */
export function useCommunityLivePlayback(options: {
  videoRef: Ref<HTMLVideoElement | null>
  getSrc: () => string | undefined
  /** 是否处于应播放状态（详情当前页 / Lightbox 可见等） */
  shouldPlay: () => boolean
  /** 仅用户切换循环时回调（不含切图重置） */
  onLoopChange?: (enabled: boolean) => void
}) {
  const loopEnabled = ref(false)
  const videoVisible = ref(false)

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let pressStartX = 0
  let pressStartY = 0
  let didLongPress = false

  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  async function playFromStart(): Promise<boolean> {
    if (!options.shouldPlay()) return false
    await nextTick()
    const el = options.videoRef.value
    const src = options.getSrc()?.trim()
    if (!el || !src) return false
    el.loop = loopEnabled.value
    if (el.getAttribute('src') !== src) {
      el.src = src
    }
    try {
      el.currentTime = 0
      await el.play()
      videoVisible.value = true
      return true
    } catch {
      videoVisible.value = false
      return false
    }
  }

  function stop(clearSrc = true) {
    videoVisible.value = false
    const el = options.videoRef.value
    if (!el) return
    el.pause()
    if (clearSrc) {
      el.removeAttribute('src')
      el.load()
    } else {
      try {
        el.currentTime = 0
      } catch {
        /* ignore */
      }
    }
  }

  function onEnded() {
    if (loopEnabled.value) return
    videoVisible.value = false
    const el = options.videoRef.value
    if (!el) return
    el.pause()
    try {
      el.currentTime = 0
    } catch {
      /* ignore */
    }
  }

  function setLoopEnabled(next: boolean, fromUser = false) {
    if (loopEnabled.value === next) return
    loopEnabled.value = next
    const el = options.videoRef.value
    if (el) el.loop = next
    if (fromUser) {
      options.onLoopChange?.(next)
    }
    if (next && options.shouldPlay()) {
      void playFromStart()
    }
  }

  function toggleLoop() {
    setLoopEnabled(!loopEnabled.value, true)
  }

  function getPoint(e: MouseEvent | TouchEvent) {
    if ('touches' in e) return e.touches[0] ?? e.changedTouches[0]
    return e
  }

  function onBadgePointerDown(e: MouseEvent | TouchEvent) {
    if ('button' in e && e.button !== 0) return
    e.stopPropagation()
    const point = getPoint(e)
    if (!point) return
    pressStartX = point.clientX
    pressStartY = point.clientY
    didLongPress = false
    clearPressTimer()
    pressTimer = setTimeout(() => {
      didLongPress = true
      toggleLoop()
      clearPressTimer()
      if (import.meta.client && navigator.vibrate) {
        navigator.vibrate(12)
      }
    }, LONG_PRESS_MS)
  }

  function onBadgePointerMove(e: MouseEvent | TouchEvent) {
    const point = getPoint(e)
    if (!point) return
    if (Math.hypot(point.clientX - pressStartX, point.clientY - pressStartY) > MOVE_CANCEL_PX) {
      clearPressTimer()
    }
  }

  function onBadgePointerUp(e: MouseEvent | TouchEvent) {
    e.stopPropagation()
    clearPressTimer()
    if (didLongPress) {
      didLongPress = false
      return
    }
    void playFromStart()
  }

  function onBadgePointerCancel() {
    clearPressTimer()
    didLongPress = false
  }

  function onBadgeClick(e: MouseEvent) {
    // 点击已由 pointerup 处理；阻止冒泡到封面/开 Lightbox
    e.stopPropagation()
    e.preventDefault()
  }

  watch(
    () => [options.shouldPlay(), options.getSrc()] as const,
    ([play, src], prev) => {
      if (src !== prev?.[1]) {
        setLoopEnabled(false, false)
      }
      if (play && src?.trim()) {
        void playFromStart()
      } else {
        stop(true)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    clearPressTimer()
    stop(true)
  })

  return {
    loopEnabled,
    videoVisible,
    playFromStart,
    stop,
    onEnded,
    toggleLoop,
    setLoopEnabled,
    onBadgePointerDown,
    onBadgePointerMove,
    onBadgePointerUp,
    onBadgePointerCancel,
    onBadgeClick,
  }
}
