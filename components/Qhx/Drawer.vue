<template>
  <Teleport to="body">
    <div>
      <!-- 遮罩 -->
      <transition name="fade">
        <div
          v-if="modelValue"
          class="drawer-mask"
          @click="onMaskClick"
          @touchmove.prevent
        ></div>
      </transition>

      <!-- 抽屉内容 -->
      <transition :name="transitionName">
        <div
          v-if="modelValue"
          :class="drawerClasses"
          :style="drawerStyles"
          ref="drawerRef"
        >
          <div class="drawer-inner">
            <slot></slot>
          </div>
        </div>
      </transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  direction: { type: String as () => 'left' | 'right' | 'top' | 'bottom', default: 'right' },
  closeOnClickMask: { type: Boolean, default: true }, // 默认点击遮罩不关闭
  size: { type: String, default: '300px' }, // 宽度/高度
  closeOnPressEscape: { type: Boolean, default: true }, // ESC 键关闭
  lockScroll: { type: Boolean, default: true }, // 锁定背景滚动
  mobileSize: { type: String, default: '100vw' } // 移动端宽度/高度，默认全屏
});

const emit = defineEmits(['update:modelValue', 'close']);

const drawerRef = ref<HTMLElement | null>(null);
const originalBodyOverflow = ref('');
const originalBodyPaddingRight = ref('');

// 检测是否为移动端
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isMobile = computed(() => {
  return windowWidth.value < 768; // md breakpoint
});

// 监听窗口大小变化
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth;
  }
};

// 计算抽屉样式
const drawerStyles = computed(() => {
  const size = isMobile.value ? props.mobileSize : props.size;
  
  switch (props.direction) {
    case 'left':
      return { width: size, height: '100vh' };
    case 'right':
      return { width: size, height: '100vh' };
    case 'top':
      return { width: '100vw', height: size };
    case 'bottom':
      return { width: '100vw', height: size };
    default:
      return {};
  }
});

const drawerClasses = computed(() => {
  const baseClasses = ['drawer-base'];
  switch (props.direction) {
    case 'left':
      baseClasses.push('drawer-left');
      break;
    case 'right':
      baseClasses.push('drawer-right');
      break;
    case 'top':
      baseClasses.push('drawer-top');
      break;
    case 'bottom':
      baseClasses.push('drawer-bottom');
      break;
  }
  return baseClasses.join(' ');
});

const transitionName = computed(() => {
  return `slide-${props.direction}`;
});

// 锁定 body 滚动
const lockBodyScroll = () => {
  if (!props.lockScroll || typeof document === 'undefined') return;
  
  const body = document.body;
  originalBodyOverflow.value = body.style.overflow || '';
  originalBodyPaddingRight.value = body.style.paddingRight || '';
  
  // 计算滚动条宽度
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
};

// 解锁 body 滚动
const unlockBodyScroll = () => {
  if (!props.lockScroll || typeof document === 'undefined') return;
  
  const body = document.body;
  body.style.overflow = originalBodyOverflow.value;
  body.style.paddingRight = originalBodyPaddingRight.value;
};

// ESC 键关闭
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue && props.closeOnPressEscape) {
    closeDrawer();
  }
};

const onMaskClick = () => {
  if (props.closeOnClickMask) {
    closeDrawer();
  }
};

const closeDrawer = () => {
  emit('update:modelValue', false);
  emit('close');
};

// 监听 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    lockBodyScroll();
    nextTick(() => {
      if (drawerRef.value) {
        drawerRef.value.focus();
      }
    });
  } else {
    unlockBodyScroll();
  }
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);
    windowWidth.value = window.innerWidth;
  }
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', handleResize);
  }
});
</script>

<style scoped>
/* 遮罩 */
.drawer-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 9998;
  touch-action: none;
}

/* 遮罩淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 抽屉基础样式 */
.drawer-base {
  position: fixed;
  z-index: 9999;
  background-color: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.drawer-left {
  top: 0;
  left: 0;
  height: 100vh;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
}

.drawer-right {
  top: 0;
  right: 0;
  height: 100vh;
}

.drawer-top {
  top: 0;
  left: 0;
  width: 100vw;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.drawer-bottom {
  bottom: 0;
  left: 0;
  width: 100vw;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

/* 抽屉内容区域 */
.drawer-inner {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* 抽屉滑动动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-top-enter-active,
.slide-top-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-top-enter-from,
.slide-top-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-bottom-enter-active,
.slide-bottom-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.slide-bottom-enter-from,
.slide-bottom-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 移动端优化 */
@media (max-width: 767px) {
  .drawer-mask {
    background-color: rgba(0, 0, 0, 0.5);
  }
  
  .drawer-base {
    box-shadow: none;
  }
  
  .drawer-left,
  .drawer-right {
    box-shadow: none;
  }
  
  .drawer-top,
  .drawer-bottom {
    box-shadow: none;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .drawer-base {
    background-color: #1f2937;
    color: #f9fafb;
  }
  
  .drawer-mask {
    background-color: rgba(0, 0, 0, 0.6);
  }
}
</style>
