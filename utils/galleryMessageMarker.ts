import * as THREE from 'three'
import type { GalleryMessageMarker } from '@/types/gallery'

/** 黑魂橙皂石色 */
export const SOAPSTONE_ORANGE = 0xff7a18
export const SOAPSTONE_GLOW = 0xffb04a

let dotTexture: THREE.CanvasTexture | null = null
let glowTexture: THREE.CanvasTexture | null = null

function createRadialTexture(
  size: number,
  stops: Array<[number, string]>
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    const c = size / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    for (const [t, color] of stops) g.addColorStop(t, color)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** 实心亮圆点 */
export function getSoapstoneDotTexture(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture
  dotTexture = createRadialTexture(128, [
    [0, 'rgba(255, 248, 220, 1)'],
    [0.22, 'rgba(255, 190, 90, 0.98)'],
    [0.55, 'rgba(255, 122, 24, 0.92)'],
    [0.82, 'rgba(255, 90, 10, 0.35)'],
    [1, 'rgba(255, 60, 0, 0)']
  ])
  return dotTexture
}

/** 外圈柔光 */
export function getSoapstoneGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture
  glowTexture = createRadialTexture(128, [
    [0, 'rgba(255, 160, 50, 0.55)'],
    [0.4, 'rgba(255, 120, 30, 0.28)'],
    [1, 'rgba(0, 0, 0, 0)']
  ])
  return glowTexture
}

/** 黑魂风格橙色皂石圆点标点 */
export function createGallerySoapstoneMarker(
  msg: GalleryMessageMarker
): THREE.Group {
  const group = new THREE.Group()
  const [x, y, z] = msg.position

  const glowMat = new THREE.MeshBasicMaterial({
    map: getSoapstoneGlowTexture(),
    color: SOAPSTONE_GLOW,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat)
  glow.rotation.x = -Math.PI / 2
  glow.position.y = 0.02
  glow.name = 'message-glow'
  glow.renderOrder = 2
  group.add(glow)

  const dotMat = new THREE.MeshBasicMaterial({
    map: getSoapstoneDotTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), dotMat)
  dot.rotation.x = -Math.PI / 2
  dot.position.y = 0.035
  dot.name = 'message-glyph'
  dot.renderOrder = 3
  group.add(dot)

  // 不可见点击扩大盒
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  )
  hit.position.y = 0.15
  hit.name = 'message-hit'
  group.add(hit)

  group.position.set(x, y, z)
  group.userData.isGalleryMessage = true
  group.userData.messageData = msg
  group.userData.soapstonePulse = Math.random() * Math.PI * 2
  return group
}

/** 每帧脉冲 + 靠近高亮 */
export function updateGallerySoapstoneMarker(
  group: THREE.Group,
  time: number,
  nearby: boolean
) {
  const phase = (group.userData.soapstonePulse as number) + time * 2.4
  const pulse = 0.5 + 0.5 * Math.sin(phase)

  const glow = group.getObjectByName('message-glow') as THREE.Mesh | undefined
  if (glow) {
    const mat = glow.material as THREE.MeshBasicMaterial
    mat.opacity = (nearby ? 0.78 : 0.45) + pulse * 0.25
    glow.scale.setScalar((nearby ? 1.25 : 1) * (1 + pulse * 0.1))
  }

  const glyph = group.getObjectByName('message-glyph') as THREE.Mesh | undefined
  if (glyph) {
    const mat = glyph.material as THREE.MeshBasicMaterial
    mat.opacity = nearby ? 1 : 0.85 + pulse * 0.1
    glyph.scale.setScalar(nearby ? 1.18 : 1 + pulse * 0.04)
  }
}

export function disposeGallerySoapstoneTextures() {
  dotTexture?.dispose()
  glowTexture?.dispose()
  dotTexture = null
  glowTexture = null
}
