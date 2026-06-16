<script setup lang="ts">
import type { GalleryConfig, GalleryExhibit } from '@/types/gallery'

const props = defineProps<{
  config: GalleryConfig
  playerX: number
  playerZ: number
  cameraYaw: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const MAP_PADDING = 8

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width: mapW, depth: mapD } = props.config.mapSize
  const size = canvas.width
  const scale = (size - MAP_PADDING * 2) / Math.max(mapW, mapD)
  const ox = size / 2
  const oz = size / 2

  const toCanvas = (x: number, z: number) => ({
    cx: ox + x * scale,
    cz: oz + z * scale
  })

  ctx.clearRect(0, 0, size, size)

  // 背景
  ctx.fillStyle = 'rgba(20, 15, 30, 0.85)'
  ctx.fillRect(0, 0, size, size)

  // 地图边框
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  const tl = toCanvas(-mapW / 2, -mapD / 2)
  ctx.strokeRect(tl.cx, tl.cz, mapW * scale, mapD * scale)

  // 墙体
  ctx.fillStyle = 'rgba(100, 100, 120, 0.6)'
  for (const wall of props.config.walls) {
    const [wx, wz] = wall.position
    const [ww, wd] = wall.size
    const p = toCanvas(wx - ww / 2, wz - wd / 2)
    ctx.fillRect(p.cx, p.cz, ww * scale, wd * scale)
  }

  // 展品
  for (const ex of props.config.exhibits) {
    const [ex_x, ex_z] = ex.position
    const p = toCanvas(ex_x, ex_z)
    ctx.beginPath()
    ctx.arc(p.cx, p.cz, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#d48898'
    ctx.fill()
  }

  // 店铺标点
  for (const shop of props.config.shops ?? []) {
    const [sx, sz] = shop.position
    const p = toCanvas(sx, sz)
    ctx.beginPath()
    ctx.arc(p.cx, p.cz, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb347'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 玩家（带朝向三角）
  const pp = toCanvas(props.playerX, props.playerZ)
  ctx.save()
  ctx.translate(pp.cx, pp.cz)
  ctx.rotate(-props.cameraYaw + Math.PI)
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(-5, 5)
  ctx.lineTo(5, 5)
  ctx.closePath()
  ctx.fillStyle = '#7ec8e3'
  ctx.fill()
  ctx.restore()

  // 边框
  ctx.strokeStyle = 'rgba(216, 136, 152, 0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
}

watch(
  () => [props.playerX, props.playerZ, props.cameraYaw, props.config],
  () => draw(),
  { deep: true }
)

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = 140
    canvas.height = 140
    draw()
  }
})
</script>

<template>
  <div class="gallery-minimap">
    <canvas ref="canvasRef" class="gallery-minimap__canvas" />
    <span class="gallery-minimap__label">地图</span>
  </div>
</template>

<style scoped>
.gallery-minimap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.gallery-minimap__canvas {
  display: block;
  width: 140px;
  height: 140px;
}

.gallery-minimap__label {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
</style>
