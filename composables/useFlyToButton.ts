import type { Ref } from 'vue'

/**
 * 飞入悬浮按钮动画：从源元素位置飞向目标（如购物车/搭配按钮）
 * 使用 transform + opacity 实现 GPU 加速，保证流畅性能
 */
export function useFlyToButton() {
  const FLY_SIZE = 48
  const TARGET_MARGIN = 12
  const DURATION = 420
  const EASING = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' // ease-out-quad

  const flyToTarget = (
    sourceRect: DOMRect,
    imageSrc: string,
    targetRef?: Ref<HTMLElement | null>
  ) => {
    if (typeof document === 'undefined') return

    const vh = window.innerHeight
    let targetX: number
    let targetY: number

    if (targetRef?.value) {
      const tr = targetRef.value.getBoundingClientRect()
      targetX = tr.left + tr.width / 2 - FLY_SIZE / 2
      targetY = tr.top + tr.height / 2 - FLY_SIZE / 2
    } else {
      targetX = TARGET_MARGIN
      targetY = vh - TARGET_MARGIN - FLY_SIZE
    }

    const startX = sourceRect.left + sourceRect.width / 2 - FLY_SIZE / 2
    const startY = sourceRect.top + sourceRect.height / 2 - FLY_SIZE / 2
    const dx = targetX - startX
    const dy = targetY - startY

    const el = document.createElement('div')
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      width: ${FLY_SIZE}px;
      height: ${FLY_SIZE}px;
      z-index: 9999;
      pointer-events: none;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      will-change: transform, opacity;
    `
    const img = document.createElement('img')
    img.src = imageSrc
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
    img.loading = 'eager'
    el.appendChild(img)
    document.body.appendChild(el)

    const animation = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 }
      ],
      { duration: DURATION, easing: EASING, fill: 'forwards' }
    )

    animation.finished.then(() => {
      el.remove()
    }).catch(() => {
      el.remove()
    })
  }

  return { flyToTarget }
}
