<!-- 果冻动画！嘎嘎嘎 -->
<template>
  <div
    ref="jellyRef"
    class="inline-block"
    @mousedown="triggerJelly"
    @touchstart="triggerJelly"
  >
    <slot />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const jellyRef = ref(null)

const triggerJelly = () => {
  const el = jellyRef.value
  console.log('触发了')
  if (!el) return

  el.classList.remove('jelly-animation') // 重新触发动画
  void el.offsetWidth // 强制重绘
  el.classList.add('jelly-animation')
}
</script>

<style scoped>
@keyframes jelly {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(0.9, 1.1);
  }
  50% {
    transform: scale(1.1, 0.9);
  }
  70% {
    transform: scale(0.95, 1.05);
  }
  100% {
    transform: scale(1);
  }
}

.jelly-animation {
  animation: jelly 500ms ease;
}
</style>
