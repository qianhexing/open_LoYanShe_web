<!-- 通用模态框 -->
<template>
  <Teleport to="body">
    <Transition
      name="modal-fade"
      @before-enter="setPosition"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[200] flex items-center justify-center"
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
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = defineProps<{
  modelValue: boolean
  triggerPosition?: { x: number; y: number }
}>()

const emit = defineEmits(['update:modelValue'])

const modalBox = ref<HTMLElement | null>(null)
const modalStyle = ref<Record<string, string>>({})

// 关闭方法
const close = () => {
  emit('update:modelValue', false)
}

// 进入前设置初始位置和缩放
const setPosition = () => {
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
