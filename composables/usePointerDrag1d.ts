import { onUnmounted, ref } from 'vue'

type DragAxis = 'x' | 'y'

/**
 * 在 document 上跟踪 pointer，支持拖出控件范围后继续更新；
 * pointerup / pointercancel 时统一结束，避免「出界再进入」状态残留。
 */
export function usePointerDragSession() {
  const dragging = ref(false)
  let activePointerId: number | null = null
  let captureEl: HTMLElement | null = null
  let onMove: ((clientX: number, clientY: number) => void) | null = null

  function endDrag(e?: PointerEvent) {
    if (!dragging.value && activePointerId == null) return
    dragging.value = false
    if (captureEl && e && activePointerId === e.pointerId) {
      try {
        captureEl.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    activePointerId = null
    captureEl = null
    onMove = null
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerUp)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragging.value || activePointerId !== e.pointerId) return
    onMove?.(e.clientX, e.clientY)
  }

  function handlePointerUp(e: PointerEvent) {
    if (activePointerId != null && e.pointerId !== activePointerId) return
    endDrag(e)
  }

  function start(
    e: PointerEvent,
    move: (clientX: number, clientY: number) => void,
    target?: HTMLElement | null
  ) {
    if (e.button !== 0) return
    e.preventDefault()
    endDrag()
    dragging.value = true
    activePointerId = e.pointerId
    onMove = move
    captureEl = target ?? (e.currentTarget as HTMLElement)
    try {
      captureEl.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    move(e.clientX, e.clientY)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
  }

  onUnmounted(endDrag)

  return { dragging, start, endDrag }
}

/** @deprecated 使用 usePointerDragSession */
export function usePointerDrag1d(_axis: DragAxis) {
  return usePointerDragSession()
}

export function ratioFromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  dragAxis: DragAxis
): number {
  if (dragAxis === 'x') {
    return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)))
  }
  return Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(rect.height, 1)))
}
