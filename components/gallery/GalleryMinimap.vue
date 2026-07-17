<script setup lang="ts">
import type { GalleryConfig, GalleryPresenceUser } from '@/types/gallery'

const props = defineProps<{
  config: GalleryConfig
  playerX: number
  playerZ: number
  cameraYaw: number
  remoteUsers?: readonly GalleryPresenceUser[]
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

  // 雷达底
  const bg = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.72)
  bg.addColorStop(0, 'rgba(28, 18, 30, 0.95)')
  bg.addColorStop(1, 'rgba(8, 6, 12, 0.96)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // 扫描网格
  ctx.strokeStyle = 'rgba(232, 164, 180, 0.08)'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const r = (size / 2) * (i / 4)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(size / 2, MAP_PADDING)
  ctx.lineTo(size / 2, size - MAP_PADDING)
  ctx.moveTo(MAP_PADDING, size / 2)
  ctx.lineTo(size - MAP_PADDING, size / 2)
  ctx.stroke()

  // 地图边框
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 1
  const tl = toCanvas(-mapW / 2, -mapD / 2)
  ctx.strokeRect(tl.cx, tl.cz, mapW * scale, mapD * scale)

  // 墙体
  ctx.fillStyle = 'rgba(90, 88, 110, 0.55)'
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
    ctx.arc(p.cx, p.cz, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#e8a4b4'
    ctx.fill()
  }

  // 店铺标点
  for (const shop of props.config.shops ?? []) {
    const [sx, sz] = shop.position
    const p = toCanvas(sx, sz)
    ctx.beginPath()
    ctx.arc(p.cx, p.cz, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb347'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 其他在线用户
  for (const remote of props.remoteUsers ?? []) {
    const rp = toCanvas(remote.x, remote.z)
    ctx.beginPath()
    ctx.arc(rp.cx, rp.cz, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#f0c8d4'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 玩家（带朝向三角 + 脉冲环）
  const pp = toCanvas(props.playerX, props.playerZ)
  ctx.beginPath()
  ctx.arc(pp.cx, pp.cz, 9, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(126, 200, 227, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.save()
  ctx.translate(pp.cx, pp.cz)
  ctx.rotate(-props.cameraYaw + Math.PI)
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.lineTo(-5, 5)
  ctx.lineTo(5, 5)
  ctx.closePath()
  ctx.fillStyle = '#8ed4ef'
  ctx.shadowColor = 'rgba(126, 200, 227, 0.7)'
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.restore()

  // 外框
  ctx.strokeStyle = 'rgba(232, 164, 180, 0.42)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3)
}

watch(
  () => [props.playerX, props.playerZ, props.cameraYaw, props.config, props.remoteUsers],
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
    <span class="gallery-minimap__bracket gallery-minimap__bracket--tl" aria-hidden="true" />
    <span class="gallery-minimap__bracket gallery-minimap__bracket--tr" aria-hidden="true" />
    <span class="gallery-minimap__bracket gallery-minimap__bracket--bl" aria-hidden="true" />
    <span class="gallery-minimap__bracket gallery-minimap__bracket--br" aria-hidden="true" />
    <canvas ref="canvasRef" class="gallery-minimap__canvas" />
    <span class="gallery-minimap__label">RADAR</span>
  </div>
</template>

<style scoped>
.gallery-minimap {
  position: relative;
  padding: 3px;
  border: 1px solid rgba(232, 164, 180, 0.28);
  border-radius: 2px;
  background: rgba(8, 6, 12, 0.55);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
}

.gallery-minimap__canvas {
  display: block;
  width: 140px;
  height: 140px;
}

.gallery-minimap__label {
  position: absolute;
  bottom: 8px;
  left: 10px;
  font-size: 9px;
  letter-spacing: 0.28em;
  color: rgba(232, 164, 180, 0.55);
  pointer-events: none;
}

.gallery-minimap__bracket {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: rgba(232, 164, 180, 0.55);
  border-style: solid;
  z-index: 1;
  pointer-events: none;
}

.gallery-minimap__bracket--tl {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}

.gallery-minimap__bracket--tr {
  top: -1px;
  right: -1px;
  border-width: 2px 2px 0 0;
}

.gallery-minimap__bracket--bl {
  bottom: -1px;
  left: -1px;
  border-width: 0 0 2px 2px;
}

.gallery-minimap__bracket--br {
  bottom: -1px;
  right: -1px;
  border-width: 0 2px 2px 0;
}
</style>
