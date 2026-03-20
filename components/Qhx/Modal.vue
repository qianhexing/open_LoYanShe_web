<!-- 通用模态框 -->
<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        name="modal-fade"
        @before-enter="setPosition"
        @enter="onEnter"
        @leave="onLeave"
      >
        <div
          v-if="modelValue"
          ref="modalContainer"
          class="modal-container fixed inset-0 z-[200] flex items-center justify-center"
          tabindex="0"
          @keydown.esc="close"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/10 transition-opacity duration-300"
            @click="close"
          ></div>

          <!-- Modal -->
          <div
            ref="modalBox"
            class="relative shadow-xl transition-transform duration-300 ease-out"
            :style="modalStyle"
          >
            <slot />
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onUnmounted } from 'vue'

// 客户端检查
const isClient = process.client

const props = defineProps<{
  modelValue: boolean
  triggerPosition?: { x: number; y: number }
}>()

const emit = defineEmits(['update:modelValue', 'close'])

const modalBox = ref<HTMLElement | null>(null)
const modalContainer = ref<HTMLElement | null>(null)
const modalStyle = ref<Record<string, string>>({})

// 保存原始样式
let originalBodyOverflow = ''
let originalHtmlOverflow = ''

// 禁用页面滚动（使用 overflow 而非 position:fixed，避免打开弹窗时页面回弹到顶部）
const disableBodyScroll = () => {
  if (!isClient) return

  originalBodyOverflow = document.body.style.overflow
  originalHtmlOverflow = document.documentElement.style.overflow

  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

// 恢复页面滚动
const enableBodyScroll = () => {
  if (!isClient) return

  document.body.style.overflow = originalBodyOverflow
  document.documentElement.style.overflow = originalHtmlOverflow
}

// 检查事件目标是否在模态框内容区域内
const isInsideModalBox = (target: EventTarget | null): boolean => {
  if (!target || !modalBox.value) return false
  const element = target as HTMLElement
  return modalBox.value.contains(element)
}

// 阻止滚轮事件（仅在背景区域）
const preventWheel = (e: WheelEvent) => {
  // 如果事件发生在模态框内容区域内，允许滚动
  if (isInsideModalBox(e.target)) {
    return
  }
  e.preventDefault()
  e.stopPropagation()
}

// 阻止触摸移动事件（仅在背景区域）
const preventTouchMove = (e: TouchEvent) => {
  // 如果事件发生在模态框内容区域内，允许滚动
  if (isInsideModalBox(e.target)) {
    return
  }
  e.preventDefault()
  e.stopPropagation()
}

// 监听 modelValue 变化，控制页面滚动
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isClient) return
    
    if (isOpen) {
      disableBodyScroll()
      // 在模态框容器上添加事件监听器
      nextTick(() => {
        if (modalContainer.value) {
          modalContainer.value.addEventListener('wheel', preventWheel, { passive: false })
          modalContainer.value.addEventListener('touchmove', preventTouchMove, { passive: false })
        }
      })
    } else {
      enableBodyScroll()
      // 移除事件监听器
      if (modalContainer.value) {
        modalContainer.value.removeEventListener('wheel', preventWheel)
        modalContainer.value.removeEventListener('touchmove', preventTouchMove)
      }
    }
  },
  { immediate: true }
)

// 组件卸载时恢复滚动
onUnmounted(() => {
  enableBodyScroll()
  if (modalContainer.value) {
    modalContainer.value.removeEventListener('wheel', preventWheel)
    modalContainer.value.removeEventListener('touchmove', preventTouchMove)
  }
})

// 关闭方法
const close = () => {
  enableBodyScroll()
  emit('update:modelValue', false)
  emit('close')
}

// 进入前设置初始位置和缩放
const setPosition = () => {
  if (!isClient) return
  
  const pos = props.triggerPosition ?? {
    x: window.innerWidth,
    y: window.innerHeight
  }
  modalStyle.value = {
    transform: `translate(${pos.x - window.innerWidth / 2}px, ${pos.y -  window.innerHeight / 2}px) scale(0.2)`,
    opacity: '1',
  }
}

// 进入动画
const onEnter = (el: Element, done: () => void) => {
  requestAnimationFrame(() => {
    modalStyle.value = {
      transform: 'translate(0, 0) scale(1)',
      opacity: '1',
      transition: 'all 300ms ease-out',
    }
    setTimeout(done, 300)
  })
}

// 离开动画
const onLeave = async (el: Element, done: () => void) => {
  if (!isClient) {
    done()
    return
  }
  
  const pos = props.triggerPosition ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }

  await nextTick()

  requestAnimationFrame(() => {
    modalStyle.value = {
      transform: `translate(${pos.x}px, ${pos.y}px) scale(0.2)`,
      opacity: '0',
      transition: 'all 200ms ease-in',
    }
    setTimeout(done, 200)
  })
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
