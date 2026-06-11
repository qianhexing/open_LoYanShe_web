import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

/**
 * 祖先容器 CSS rotate(90deg) 时，修正 OrbitControls 等依赖指针坐标的交互。
 * 对应 exhibition 竖屏强制横屏：viewport 顺时针 90°（transform-origin: top left）。
 * 移动端 OrbitControls 触摸路径使用 pageX/pageY，须与 clientX/clientY 一并修正。
 */
export function useCssRotatedPointerFix(
    getDomElement: () => HTMLElement | null | undefined,
    enabled: Ref<boolean>,
    /** canvas 就绪等触发重新挂载监听（getDomElement 非响应式时需传入） */
    ready?: MaybeRefOrGetter<boolean>
) {
    let cleanup: (() => void) | null = null

    const mapClientCoords = (el: HTMLElement, clientX: number, clientY: number) => {
        const rect = el.getBoundingClientRect()
        const ow = el.offsetWidth || 1
        const oh = el.offsetHeight || 1
        if (rect.width < 1 || rect.height < 1) {
            return { clientX, clientY }
        }

        // 祖先 viewport 顺时针 90°：屏幕坐标 → 元素本地 → 再映射回「未旋转」的 client 值
        const localX = ((clientY - rect.top) / rect.height) * ow
        const localY = ((rect.right - clientX) / rect.width) * oh
        return {
            clientX: rect.left + (localX / ow) * rect.width,
            clientY: rect.top + (localY / oh) * rect.height
        }
    }

    const patchPointer = (e: Event) => {
        if (!enabled.value || !(e instanceof PointerEvent || e instanceof WheelEvent)) return
        const el = getDomElement()
        if (!el) return

        const mapped = mapClientCoords(el, e.clientX, e.clientY)

        Object.defineProperty(e, 'clientX', {
            get: () => mapped.clientX,
            configurable: true
        })
        Object.defineProperty(e, 'clientY', {
            get: () => mapped.clientY,
            configurable: true
        })
        Object.defineProperty(e, 'pageX', {
            get: () => mapped.clientX + window.scrollX,
            configurable: true
        })
        Object.defineProperty(e, 'pageY', {
            get: () => mapped.clientY + window.scrollY,
            configurable: true
        })
    }

    const install = () => {
        cleanup?.()
        cleanup = null
        const el = getDomElement()
        if (!el) return

        const opts: AddEventListenerOptions = { capture: true, passive: true }
        el.addEventListener('pointerdown', patchPointer, opts)
        el.addEventListener('pointermove', patchPointer, opts)
        el.addEventListener('pointerup', patchPointer, opts)
        el.addEventListener('pointercancel', patchPointer, opts)
        el.addEventListener('wheel', patchPointer, opts)

        cleanup = () => {
            el.removeEventListener('pointerdown', patchPointer, opts)
            el.removeEventListener('pointermove', patchPointer, opts)
            el.removeEventListener('pointerup', patchPointer, opts)
            el.removeEventListener('pointercancel', patchPointer, opts)
            el.removeEventListener('wheel', patchPointer, opts)
        }
    }

    watch(
        () => [enabled.value, toValue(ready) ?? true, getDomElement()] as const,
        () => {
            nextTick(install)
        },
        { immediate: true }
    )

    onUnmounted(() => {
        cleanup?.()
    })
}
