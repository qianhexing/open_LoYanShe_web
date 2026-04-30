<script setup lang="ts">
import type { ECharts, EChartsOption } from 'echarts'

const props = withDefaults(
  defineProps<{
    option: EChartsOption | null | undefined
    height?: string
  }>(),
  { height: '300px' }
)

const elRef = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

async function ensureChart() {
  if (!import.meta.client || !elRef.value) return
  const echarts = await import('echarts')
  if (!chart) {
    chart = echarts.init(elRef.value)
  }
}

async function applyOption() {
  if (!props.option || !import.meta.client) {
    chart?.clear()
    return
  }
  await ensureChart()
  if (chart) {
    chart.setOption(props.option, true)
    chart.resize()
  }
}

function onResize() {
  chart?.resize()
}

watch(
  () => props.option,
  () => {
    applyOption()
  },
  { deep: true }
)

onMounted(() => {
  applyOption()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }
  if (elRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(elRef.value)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onResize)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div
    ref="elRef"
    class="w-full min-w-0"
    :style="{ height }"
  />
</template>
