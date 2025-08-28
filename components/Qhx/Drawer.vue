<template>
  <div>
    <!-- 遮罩 -->
    <transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black bg-opacity-40 z-40"
        @click="onMaskClick"
      ></div>
    </transition>

    <!-- 抽屉内容 -->
    <transition :name="transitionName">
      <div
        v-if="modelValue"
        class="fixed z-50 bg-white shadow-xl"
        :class="drawerClasses"
        ref="drawerRef"
        @mousedown="onDragStart"
        @touchstart="onDragStart"
      >
        <slot></slot>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  direction: { type: String as () => 'left' | 'right' | 'top' | 'bottom', default: 'right' },
  closeOnClickMask: { type: Boolean, default: true },
  size: { type: String, default: '300px' } // 宽度/高度
});

const emit = defineEmits(['update:modelValue']);

const drawerRef = ref<HTMLElement | null>(null);

const drawerClasses = computed(() => {
  switch (props.direction) {
    case 'left':
      return `top-0 left-0 h-full w-[${props.size}]`;
    case 'right':
      return `top-0 right-0 h-full w-[${props.size}]`;
    case 'top':
      return `top-0 left-0 w-full h-[${props.size}]`;
    case 'bottom':
      return `bottom-0 left-0 w-full h-[${props.size}]`;
  }
});

const transitionName = computed(() => {
  return `slide-${props.direction}`;
});

const onMaskClick = () => {
  if (props.closeOnClickMask) {
    emit('update:modelValue', false);
  }
};

// ------------------- 拖拽关闭 -------------------
let startPos = 0;
let dragging = false;

const onDragStart = (event: MouseEvent | TouchEvent) => {
  dragging = true;
  if (event instanceof MouseEvent) {
    startPos = props.direction === 'left' || props.direction === 'right' ? event.clientX : event.clientY;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  } else if (event instanceof TouchEvent) {
    startPos = props.direction === 'left' || props.direction === 'right' ? event.touches[0].clientX : event.touches[0].clientY;
    window.addEventListener('touchmove', onDragMove);
    window.addEventListener('touchend', onDragEnd);
  }
};

const onDragMove = (event: MouseEvent | TouchEvent) => {
  if (!dragging || !drawerRef.value) return;

  let currentPos = 0;
  if (event instanceof MouseEvent) {
    currentPos = props.direction === 'left' || props.direction === 'right' ? event.clientX : event.clientY;
  } else if (event instanceof TouchEvent) {
    currentPos = props.direction === 'left' || props.direction === 'right' ? event.touches[0].clientX : event.touches[0].clientY;
  }

  let delta = currentPos - startPos;
  if (props.direction === 'right' || props.direction === 'bottom') delta = -delta;

  if (delta > 0) delta = 0; // 不允许向相反方向拖

  if (props.direction === 'left' || props.direction === 'right') {
    drawerRef.value.style.transform = `translateX(${delta}px)`;
  } else {
    drawerRef.value.style.transform = `translateY(${delta}px)`;
  }
};

const onDragEnd = (event: MouseEvent | TouchEvent) => {
  if (!dragging || !drawerRef.value) return;
  dragging = false;

  let endPos = 0;
  if (event instanceof MouseEvent) {
    endPos = props.direction === 'left' || props.direction === 'right' ? event.clientX : event.clientY;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  } else if (event instanceof TouchEvent) {
    endPos = props.direction === 'left' || props.direction === 'right' ? event.changedTouches[0].clientX : event.changedTouches[0].clientY;
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
  }

  let delta = endPos - startPos;
  if (props.direction === 'right' || props.direction === 'bottom') delta = -delta;

  // 超过阈值关闭
  if (Math.abs(delta) > 50) {
    emit('update:modelValue', false);
  } else {
    drawerRef.value.style.transform = '';
  }
};
</script>

<style scoped>
/* 遮罩淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 抽屉滑动动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.slide-top-enter-active,
.slide-top-leave-active {
  transition: transform 0.3s;
}
.slide-top-enter-from,
.slide-top-leave-to {
  transform: translateY(-100%);
}

.slide-bottom-enter-active,
.slide-bottom-leave-active {
  transition: transform 0.3s;
}
.slide-bottom-enter-from,
.slide-bottom-leave-to {
  transform: translateY(100%);
}
</style>
