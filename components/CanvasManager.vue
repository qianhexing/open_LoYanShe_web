<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const animationFrameId = ref<number | null>(null)
const effects = ref<CanvasEffect[]>([])

interface CanvasEffect {
  render: (ctx: CanvasRenderingContext2D) => void
  update?: () => void
  onResize?: () => void
  onClick?: (x: number, y: number) => void
}

const initCanvas = () => {
  if (!canvasRef.value) return
  
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  
  ctx.value = canvasRef.value.getContext('2d')
}

const animate = () => {
  if (!ctx.value || !canvasRef.value) return
  
  // 清除画布
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  // 更新并渲染所有特效
  // biome-ignore lint: <就用forEach>
  effects.value.forEach(effect => {
    effect.update?.()
    effect.render(ctx.value!)
  })
  
  animationFrameId.value = requestAnimationFrame(animate)
}

const handleResize = () => {
  if (!canvasRef.value) return
  
  canvasRef.value.width = window.innerWidth
  canvasRef.value.height = window.innerHeight
  // biome-ignore lint: <就用>
  effects.value.forEach(effect => effect.onResize?.())
}

const handleClick = (e: MouseEvent) => {
  // biome-ignore lint: <就用>
  effects.value.forEach(effect => effect.onClick?.(e.clientX, e.clientY))
}

const registerEffect = (effect: CanvasEffect) => {
  effects.value.push(effect)
  return () => {
    effects.value = effects.value.filter(e => e !== effect)
  }
}

defineExpose({
  registerEffect
})

onMounted(() => {
  initCanvas()
  animate()
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', handleClick)
})

onUnmounted(() => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', handleClick)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed top-0 left-0 w-full h-full pointer-events-none z-[9999]"
  />
</template>