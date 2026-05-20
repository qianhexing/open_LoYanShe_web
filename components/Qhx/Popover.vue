<!-- 锚点浮层：替代 Nuxt UI UPopover，不依赖 @nuxt/ui -->
<template>
  <div class="qhx-popover inline-flex">
    <div ref="triggerRef" class="qhx-popover-trigger inline-flex" @click="onTriggerClick">
      <slot />
    </div>
    <ClientOnly>
      <Teleport to="body">
        <Transition name="qhx-popover-fade">
          <div
            v-if="open"
            ref="panelRef"
            class="qhx-popover-panel fixed z-[150] max-h-[min(90vh,calc(100vh-2rem))] overflow-y-auto overflow-x-hidden shadow-xl ring-1 ring-gray-200/80 dark:ring-gray-600/80 bg-white dark:bg-gray-900"
            :class="panelClass"
            :style="panelStyle"
            role="dialog"
            @click.stop
          >
            <slot name="panel" />
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
    /** 与原先 UPopover :ui.rounded 等一致的Tailwind类名 */
    panelClass?: string
  }>(),
  {
    placement: 'bottom-start',
    panelClass: 'rounded-[18px]'
  }
)

const open = defineModel<boolean>('open', { default: false })

const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return
  const node = e.target as Node | null
  if (!node) return
  if (triggerRef.value?.contains(node)) return
  if (panelRef.value?.contains(node)) return
  open.value = false
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

function onResizeOrScroll() {
  if (open.value) updatePosition()
}

function updatePosition() {
  if (!import.meta.client) return
  if (!open.value || !triggerRef.value || !panelRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const p = panelRef.value
  const w = p.offsetWidth
  const h = p.offsetHeight
  const gap = 8

  let top = 0
  let left = 0
  switch (props.placement) {
    case 'bottom-start':
      top = rect.bottom + gap
      left = rect.left
      break
    case 'bottom-end':
      top = rect.bottom + gap
      left = rect.right - w
      break
    case 'top-start':
      top = rect.top - h - gap
      left = rect.left
      break
    case 'top-end':
      top = rect.top - h - gap
      left = rect.right - w
      break
  }

  const pad = 8
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))
  top = Math.max(pad, Math.min(top, window.innerHeight - h - pad))

  panelStyle.value = { top: `${top}px`, left: `${left}px` }
}

function onTriggerClick() {
  open.value = !open.value
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return

  if (isOpen) {
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onEscapeKey)
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)
    await nextTick()
    updatePosition()
    requestAnimationFrame(() => updatePosition())
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onEscapeKey)
    window.removeEventListener('resize', onResizeOrScroll)
    window.removeEventListener('scroll', onResizeOrScroll, true)
  }
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onEscapeKey)
  window.removeEventListener('resize', onResizeOrScroll)
  window.removeEventListener('scroll', onResizeOrScroll, true)
})
</script>

<style scoped>
.qhx-popover-fade-enter-active,
.qhx-popover-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.qhx-popover-fade-enter-from,
.qhx-popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
