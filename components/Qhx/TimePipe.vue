<template>
  <div ref="containerRef"
    class="w-full relative bg-gray-50 select-none overflow-hidden border border-gray-200 rounded-lg"
    :style="{ height: (containerHeight > screenHeight ? screenHeight - canvasOffsetTop : containerHeight) + 'px' }">
    <canvas ref="canvasRef" class="absolute top-0 left-0 w-full h-full"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import type { LibraryPipe } from '@/types/api'
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const screenHeight = ref(0)
const imageCache: Record<string, HTMLImageElement> = {}
const canvasOffsetTop = ref(0)

// 获取canvas距离顶部的高度
const getCanvasOffsetTop = () => {
  const canvas = canvasRef.value
  if (!canvas) return 0
  const rect = canvas.getBoundingClientRect()
  canvasOffsetTop.value = rect.top
  console.log("距离顶部", rect.top)
}
/**
 * 预加载所有封面图片，只加载一次
 */
const preloadImages = async (pipes: LibraryPipe[]) => {
  const covers = pipes.map(p => `${BASE_IMG}${p.library?.cover}?x-oss-process=image/quality,q_100/resize,w_300`).filter(Boolean) as string[]
  const uniqueCovers = Array.from(new Set(covers))

  await Promise.all(
    uniqueCovers.map(
      src =>
        new Promise<void>(resolve => {
          if (imageCache[src]) return resolve()
          const img = new Image()
          img.src = src
          img.onload = () => {
            imageCache[src] = img
            resolve()
          }
          img.onerror = () => resolve() // 忽略加载失败的
        })
    )
  )
}

const props = defineProps<{
  timePipe: LibraryPipe[]
}>()

const emit = defineEmits<{
  (e: 'select', item: LibraryPipe): void
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const ctx = ref<CanvasRenderingContext2D | null>(null)
// 垂直滚动偏移（新增）

// 惯性、最大滚动范围
let maxOffsetY = 0
let offsetY = 0
let scale = 1
let offsetX = 0
let dragging = false
let lastX = 0
let lastY = 0
let startTime = 0
let endTime = 0

// 触摸缩放相关
let lastTouchDistance = 0
let isPinching = false
let pinchCenterX = 0

const containerHeight = ref(200) // 默认高度，可动态更新

// 绘制函数
const draw = () => {
  const canvas = canvasRef.value
  const context = ctx.value
  if (!canvas || !context || props.timePipe.length === 0) return
  const { width, height } = canvas
  context.clearRect(0, 0, width, height)
  context.save()
  context.translate(0, -offsetY)
  startTime = Math.min(...props.timePipe.map(p => new Date(p.start_time).getTime()))
  endTime = Math.max(...props.timePipe.map(p => new Date(p.end_time).getTime()))
  const totalDuration = endTime - startTime

  const timeToX = (t: number) => ((t - startTime) / totalDuration) * width * scale + offsetX

  // 分配行
  const lines: LibraryPipe[][] = []
  const sorted = [...props.timePipe].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  // biome-ignore lint/complexity/noForEach: <explanation>
  sorted.forEach(pipe => {
    const s = new Date(pipe.start_time).getTime()
    const e = new Date(pipe.end_time).getTime()
    let placed = false
    for (const line of lines) {
      const last = line[line.length - 1]
      const lastEnd = new Date(last.end_time).getTime()
      if (s > lastEnd) {
        line.push(pipe)
        placed = true
        break
      }
    }
    if (!placed) lines.push([pipe])
  })

  const lineHeight = 70
  const barHeight = 20
  const topPadding = 30
  const bottomPadding = 60 // 为刻度留空间

  // 动态计算总高度
  const totalHeight = topPadding + lines.length * lineHeight + bottomPadding
  maxOffsetY = Math.max(0, totalHeight - containerHeight.value)
  if (containerHeight.value !== totalHeight) {
    containerHeight.value = totalHeight
    nextTick(handleResize) // 重新调整画布尺寸
    return
  }

  const colors: Record<string, string> = {
    running: '#34d399',
    paused: '#fbbf24',
    error: '#f87171',
    default: '#60a5fa'
  }
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    // ctx.fill(); // 或者 ctx.stroke() 来描边
    ctx.fill();
    ctx.stroke()
  }
  // 绘制每行
  const viewTop = offsetY
  const viewBottom = offsetY + (containerHeight.value > screenHeight.value ? screenHeight.value : -offsetY + containerHeight.value)

  lines.forEach((line, lineIndex) => {
    const y = topPadding + lineIndex * lineHeight

    // ❗ 如果该行完全不在可视区域 → 跳过，提升性能极大
    if (y + lineHeight < viewTop || y > viewBottom ) return
    // biome-ignore lint/complexity/noForEach: <explanation>
    line.forEach(pipe => {
      const x1 = timeToX(new Date(pipe.start_time).getTime())
      const x2 = timeToX(new Date(pipe.end_time).getTime())

      // 条
      context.fillStyle = colors[pipe.state || 'default'] || colors.default
      const item = config.value?.pipe_state.find(item => item.value === pipe.state)
      if (item) {
        context.fillStyle = item.color
      }
      // context.fillRect(x1, y, x2 - x1, barHeight)
      roundRect(context, x1, y, x2 - x1, barHeight, 10)

      // 边框
      context.strokeStyle = '#1f2937'
      // 绘制圆角
      // context.strokeRect(x1, y, x2 - x1, barHeight)

      // 状态文字
      context.fillStyle = '#111'
      context.font = '12px sans-serif'
      context.textAlign = 'center'
      context.fillText(`${pipe.library?.name} ${item?.label}`, (x1 + x2) / 2, y + barHeight + 12)

      // 备注
      if (pipe.note) {
        context.fillStyle = '#6b7280'
        context.fillText(pipe.note, (x1 + x2) / 2, y + barHeight + 26)
      }

      // 封面 cover（40×40 圆角）
      if (pipe.library?.cover && imageCache[`${BASE_IMG}${pipe.library?.cover}?x-oss-process=image/quality,q_100/resize,w_300`]) {
        const img = imageCache[`${BASE_IMG}${pipe.library?.cover}?x-oss-process=image/quality,q_100/resize,w_300`]
        const size = 40
        const radius = size / 2
        const cx = x1 - size - 8 // 在条形左边
        const cy = y - 10
        context.save()
        context.beginPath()
        context.arc(cx + radius, cy + radius, radius, 0, Math.PI * 2)
        context.clip()
        context.drawImage(img, cx, cy, size, size)
        context.restore()
      }
    })
  })

  // 底部时间刻度
  // const axisY = totalHeight - bottomPadding / 2
  const axisY = offsetY + (containerHeight.value > screenHeight.value ? screenHeight.value : containerHeight.value) - bottomPadding / 2
  context.strokeStyle = '#9ca3af'
  context.beginPath()
  // context.moveTo(0, axisY)
  context.moveTo(0, axisY)

  context.lineTo(width, axisY)
  context.stroke()

  const tickCount = 8
  const tickInterval = totalDuration / tickCount
  context.fillStyle = '#374151'
  context.textAlign = 'center'
  context.font = '12px sans-serif'

  for (let i = 0; i <= tickCount; i++) {
    const t = startTime + tickInterval * i
    const x = timeToX(t)
    const date = new Date(t)
    const label = `${date.getMonth() + 1}/${date.getDate()}`
    context.beginPath()
    context.moveTo(x, axisY)
    context.lineTo(x, axisY + 6)
    context.stroke()
    context.fillText(label, x, axisY + 20)
  }

  // 今天红线
  const today = new Date()
  const todayTime = today.getTime()
  if (todayTime >= startTime && todayTime <= endTime) {
    const xToday = timeToX(todayTime)
    context.strokeStyle = '#ef4444'
    context.beginPath()
    context.moveTo(xToday, offsetY)
    context.lineTo(xToday, offsetY + (containerHeight.value > screenHeight.value ? screenHeight.value : containerHeight.value))
    context.stroke()

    context.fillStyle = '#ef4444'
    context.font = 'bold 12px sans-serif'
    context.textAlign = 'left'
    context.fillText('今天', xToday + 5, 15 + offsetY)
  }
  context.restore()
}

// 尺寸
const handleResize = () => {
  const container = containerRef.value
  const canvas = canvasRef.value
  getCanvasOffsetTop()
  screenHeight.value = window.innerHeight
  if (!container || !canvas) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = container.clientWidth * dpr
  canvas.height = container.clientHeight * dpr

  const context = canvas.getContext('2d')
  if (!context) return
  context.scale(dpr, dpr)
  ctx.value = context
  draw()
}



onMounted(async () => {
  preloadImages(props.timePipe)
  handleResize()
  window.addEventListener('resize', handleResize)

  const canvas = canvasRef.value
  if (!canvas) return

  // 拖动（鼠标）
  canvas.addEventListener('mousedown', e => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY          // 新增
  })
  window.addEventListener('mouseup', () => { dragging = false })
  window.addEventListener('mousemove', e => {
    if (!dragging) return

    const dx = e.clientX - lastX
    const dy = e.clientY - lastY   // 新增

    lastX = e.clientX
    lastY = e.clientY

    offsetX += dx
    offsetY -= dy    // 🔥 反向，因为向下拖是正方向
    console.log('上下便宜', offsetY, offsetX)
    // 限制范围
    // offsetY = Math.max(0, Math.min(maxOffsetY, offsetY))

    draw()
  })

  // 缩放（滚轮）
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const zoom = e.deltaY < 0 ? 1.1 : 0.9
    scale = Math.min(Math.max(scale * zoom, 0.5), 10)
    draw()
  })

  // === 📱 移动端手势支持 ===
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      // 单指拖动
      dragging = true
      lastX = e.touches[0].clientX
      lastY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      // 双指缩放
      isPinching = true
      const [t1, t2] = e.touches
      lastTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      pinchCenterX = (t1.clientX + t2.clientX) / 2
    }
  }, { passive: false })

  canvas.addEventListener('touchmove', e => {
    // e.preventDefault()
    if (isPinching && e.touches.length === 2) {
      const [t1, t2] = e.touches
      const newDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const zoom = newDistance / lastTouchDistance
      lastTouchDistance = newDistance
      const prevScale = scale
      scale = Math.min(Math.max(scale * zoom, 0.5), 10)
      // 缩放中心
      offsetX = (offsetX - pinchCenterX) * (scale / prevScale) + pinchCenterX
      draw()
    } else if (dragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastX
      const dy = e.touches[0].clientY - lastY

      offsetX += dx
      offsetY -= dy     // 添加 Y 方向滚动
      console.log('上下便宜', offsetY, offsetX)
      // offsetY = Math.max(0, Math.min(maxOffsetY, offsetY))

      lastX = e.touches[0].clientX
      lastY = e.touches[0].clientY
      draw()
    }
  }, { passive: false })

  canvas.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      dragging = false
      isPinching = false
    }
  })

  // 点击选中
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const { width } = canvas
    const totalDuration = endTime - startTime
    const xToTime = (x - offsetX) / (width * scale) * totalDuration + startTime
    const hit = props.timePipe.find(
      p => xToTime >= new Date(p.start_time).getTime() && xToTime <= new Date(p.end_time).getTime()
    )
    if (hit) emit('select', hit)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// watch(() => props.timePipe, () => nextTick(draw), { deep: true })
watch(
  () => props.timePipe,
  async (val) => {
    await preloadImages(val)
    nextTick(draw)
  },
  { deep: true }
)

</script>

<style scoped>
canvas {
  cursor: grab;
  /* touch-action: none;  */
  /* 防止浏览器默认滑动行为 */
}

canvas:active {
  cursor: grabbing;
}
</style>
