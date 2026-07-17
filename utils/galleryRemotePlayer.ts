import * as THREE from 'three'
import type { GalleryPresenceUser } from '@/types/gallery'

const BODY_COLOR = 0xe8b4c8
const LERP = 12

function createNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = 'rgba(20, 15, 30, 0.75)'
    ctx.beginPath()
    ctx.roundRect(8, 12, 240, 40, 12)
    ctx.fill()
    ctx.fillStyle = '#f5e6ea'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = name.length > 8 ? `${name.slice(0, 8)}…` : name
    ctx.fillText(label, 128, 32)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.4, 0.35, 1)
  sprite.position.y = 2.05
  return sprite
}

/** 轻量远程玩家占位：胶囊体 + 名称标 */
export class GalleryRemotePlayer {
  readonly key: string
  readonly root: THREE.Group
  private targetX = 0
  private targetZ = 0
  private targetYaw = 0
  private nameSprite: THREE.Sprite | null = null

  constructor(user: GalleryPresenceUser, scene: THREE.Scene) {
    this.key = user.connectionId
    this.root = new THREE.Group()
    this.root.userData.isGalleryRemotePlayer = true
    this.root.userData.connectionId = user.connectionId
    this.root.userData.userId = user.userId

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({
        color: BODY_COLOR,
        roughness: 0.55,
        metalness: 0.05
      })
    )
    body.position.y = 0.73
    body.castShadow = true
    this.root.add(body)

    const name = user.userName?.trim() || '旅人'
    this.root.userData.displayName = name
    this.nameSprite = createNameSprite(name)
    this.root.add(this.nameSprite)

    this.targetX = user.x
    this.targetZ = user.z
    this.targetYaw = user.rotation
    this.root.position.set(user.x, 0, user.z)
    this.root.rotation.y = user.rotation
    scene.add(this.root)
  }

  setTarget(user: GalleryPresenceUser) {
    this.targetX = user.x
    this.targetZ = user.z
    this.targetYaw = user.rotation
    this.root.userData.userId = user.userId

    const nextName = user.userName?.trim()
    if (!nextName || !this.nameSprite) return
    const prev = this.root.userData.displayName as string | undefined
    if (prev === nextName) return
    this.root.userData.displayName = nextName
    this.root.remove(this.nameSprite)
    this.nameSprite.material.map?.dispose()
    this.nameSprite.material.dispose()
    this.nameSprite = createNameSprite(nextName)
    this.root.add(this.nameSprite)
  }

  update(delta: number) {
    const t = Math.min(1, LERP * delta)
    this.root.position.x += (this.targetX - this.root.position.x) * t
    this.root.position.z += (this.targetZ - this.root.position.z) * t
    // 朝向最短路径插值
    let dy = this.targetYaw - this.root.rotation.y
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    this.root.rotation.y += dy * t
  }

  dispose() {
    this.root.parent?.remove(this.root)
    this.root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const mat of mats) mat?.dispose()
      }
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose()
        child.material.dispose()
      }
    })
  }
}
