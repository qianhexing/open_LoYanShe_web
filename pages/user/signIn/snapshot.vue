<script setup lang="ts">
import dayjs from 'dayjs'
import type { ECharts, EChartsOption } from 'echarts'
import { getWordCloudAll } from '@/api/word_cloud'

definePageMeta({
  ssr: false,
})

interface WordCloudDatum {
  name: string
  value: number
}

/** 9:16 · 4K 竖屏（2160×3840） */
const EXPORT_WIDTH = 2160
const EXPORT_HEIGHT = 3840

const list = ref<WordCloudDatum[]>([])
const loading = ref(false)
const isDownloading = ref(false)
const chartHostRef = ref<HTMLElement | null>(null)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const toast = useToast()
const formattedDate = computed(() => dayjs().format('YYYY-MM-DD'))
const totalCount = computed(() =>
  list.value.reduce((sum, item) => sum + item.value, 0)
)

/** 与旧项目 wordCloud.vue 一致的随机配色 */
function randomWordColor(): string {
  return `rgb(${[
    Math.round(Math.random() * 160),
    Math.round(Math.random() * 160),
    Math.round(Math.random() * 160),
  ].join(',')})`
}

function mapRows(rows: { word: string; count: number }[] | undefined): WordCloudDatum[] {
  return (rows ?? [])
    .map((item) => ({
      name: String(item.word ?? '').trim(),
      value: Number(item.count) || 0,
    }))
    .filter((item) => item.name && item.value > 0)
}

/**
 * 词云配置对齐旧项目 lolita-app/src/components/wordCloud.vue
 * - shape: pentagon
 * - rotationRange: [0, 0]
 * - sizeRange: [10, 30]（导出按 4K 等比放大）
 * - 随机 rgb 配色
 */
function buildOption(data: WordCloudDatum[], forExport = false): EChartsOption {
  // 预览沿用旧项目 [10, 30]；4K(2160) 相对常见预览宽(~400) 约 ×5.4
  const sizeRange: [number, number] = forExport ? [48, 160] : [10, 30]

  return {
    backgroundColor: '#ffffff',
    grid: {
      left: '5%',
      right: '5%',
      bottom: '5%',
      top: '5%',
      containLabel: true,
    },
    series: [
      {
        type: 'wordCloud',
        shape: 'pentagon',
        left: 'center',
        top: 'center',
        width: '100%',
        height: '100%',
        sizeRange,
        rotationRange: [0, 0],
        drawOutOfBound: false,
        layoutAnimation: !forExport,
        textStyle: {
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          color: randomWordColor,
        },
        data,
      },
    ],
  } as EChartsOption
}

async function ensureEcharts() {
  const echarts = await import('echarts')
  await import('echarts-wordcloud')
  return echarts
}

function disposePreviewChart() {
  chartInstance?.dispose()
  chartInstance = null
}

async function renderPreview() {
  if (!import.meta.client || !chartRef.value || list.value.length === 0) return

  const echarts = await ensureEcharts()
  const el = chartRef.value

  // DOM 被 v-if 重建后，旧实例已失效，必须重新 init
  if (chartInstance && chartInstance.getDom() !== el) {
    disposePreviewChart()
  }

  if (!chartInstance) {
    chartInstance = echarts.init(el, undefined, { renderer: 'canvas' })
  }

  // 容器尚未完成布局时宽高可能为 0，延迟再画
  const { clientWidth, clientHeight } = el
  if (clientWidth < 2 || clientHeight < 2) {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  if (!chartRef.value || chartRef.value !== el) return

  chartInstance.setOption(buildOption(list.value, false), true)
  chartInstance.resize()
  // 二次 resize，避免 aspect-ratio 容器首帧高度未稳定
  requestAnimationFrame(() => {
    chartInstance?.resize()
  })
}

function bindResizeObserver() {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!chartHostRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
  })
  resizeObserver.observe(chartHostRef.value)
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getWordCloudAll()
    list.value = mapRows(res.rows)
    await nextTick()
    bindResizeObserver()
    await renderPreview()
  } catch (error) {
    console.error('获取词云失败:', error)
    toast.add({ title: '获取词云失败', color: 'red' })
  } finally {
    loading.value = false
    // loading 结束后容器再次稳定，补一次绘制
    await nextTick()
    await renderPreview()
  }
}

/** 离屏 4K Canvas 绘制并下载 */
async function downloadSnapshot() {
  if (list.value.length === 0 || isDownloading.value) return
  isDownloading.value = true
  toast.add({ title: '正在绘制 4K 词云…', color: 'blue' })

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${EXPORT_WIDTH}px;height:${EXPORT_HEIGHT}px;pointer-events:none;background:#fff;`
  document.body.appendChild(host)

  let offscreen: ECharts | null = null
  try {
    const echarts = await ensureEcharts()
    offscreen = echarts.init(host, undefined, {
      renderer: 'canvas',
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      devicePixelRatio: 1,
    })
    offscreen.setOption(buildOption(list.value, true), true)

    // 全量词条布局耗时更长，按词量动态等待
    const waitMs = Math.min(4000, 800 + Math.floor(list.value.length / 20) * 40)
    await new Promise((resolve) => setTimeout(resolve, waitMs))

    const href = offscreen.getDataURL({
      type: 'jpeg',
      pixelRatio: 1,
      backgroundColor: '#ffffff',
    })

    const link = document.createElement('a')
    link.download = `花语词云_${formattedDate.value}_4K.jpg`
    link.href = href
    link.click()
    toast.add({ title: '下载完成', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '下载失败', color: 'red' })
  } finally {
    offscreen?.dispose()
    host.remove()
    isDownloading.value = false
  }
}

function onResize() {
  chartInstance?.resize()
}

onMounted(() => {
  void fetchData()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  disposePreviewChart()
})
</script>

<template>
  <div class="container mx-auto min-h-screen p-4">
    <div
      class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg overflow-x-auto"
    >
      <div class="text-sm text-gray-600 whitespace-nowrap">
        <span class="font-bold text-gray-800">花语词云截图</span>
        <span class="mx-2 text-gray-300">|</span>
        词条
        <span class="text-primary-600 font-bold">{{ list.length }}</span>
        · 累计
        <span class="text-primary-600 font-bold">{{ totalCount }}</span>
        次 · 9:16 · 4K
      </div>

      <div class="flex items-center gap-2 flex-wrap ml-auto">
        <UButton
          :loading="loading"
          color="gray"
          variant="soft"
          icon="i-heroicons-arrow-path"
          @click="fetchData"
        >
          刷新词云
        </UButton>
        <UButton
          :loading="isDownloading"
          :disabled="list.length === 0"
          color="primary"
          icon="i-heroicons-arrow-down-tray"
          @click="downloadSnapshot"
        >
          下载 4K 截图
        </UButton>
      </div>
    </div>

    <div v-if="loading && list.length === 0" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
    </div>

    <div
      v-else-if="list.length > 0"
      class="pb-20 max-w-[420px] mx-auto"
    >
      <div class="bg-white shadow-xl overflow-hidden relative group">
        <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <UButton
            size="xs"
            color="gray"
            icon="i-heroicons-camera"
            :loading="isDownloading"
            @click="downloadSnapshot"
          >
            下载此图
          </UButton>
        </div>

        <!-- 9:16 预览：固定宽高链，避免 echarts 初始化时高度为 0 -->
        <div
          ref="chartHostRef"
          class="w-full bg-white relative"
          style="aspect-ratio: 9 / 16"
        >
          <div
            ref="chartRef"
            class="absolute inset-0 w-full h-full"
          />
          <div
            v-if="loading"
            class="absolute inset-0 z-10 flex items-center justify-center bg-white/60"
          >
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-3xl text-gray-400" />
          </div>
        </div>

        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">
          {{ formattedDate }} · 9:16 · {{ EXPORT_WIDTH }}×{{ EXPORT_HEIGHT }} (4K)
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-500">
      暂无词云数据
    </div>
  </div>
</template>
