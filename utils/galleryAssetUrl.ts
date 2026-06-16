import gsap from 'gsap'
import { SplatMesh } from '@sparkjsdev/spark'
import * as THREE from 'three'
import type { GalleryLibraryVideo } from '@/types/gallery'
import { BASE_IMG_MODEL } from '@/utils/ipConfig'

/** 解析展馆模型 addr 为完整 URL */
export function resolveGalleryModelUrl(addr: string): string {
  if (!addr?.trim()) return ''
  const s = addr.trim()
  if (/^(https?:|blob:|data:)/i.test(s)) return s
  const base = BASE_IMG_MODEL.endsWith('/')
    ? BASE_IMG_MODEL.slice(0, -1)
    : BASE_IMG_MODEL
  const path = s.startsWith('/') ? s.slice(1) : s
  return `${base}/${path}`
}

/** 是否为 Spark 点云资源 */
export function isGallerySplatUrl(url: string): boolean {
  return /\.(rad|radc|spz|ply|splat|ksplat)$/i.test(url.split('?')[0] ?? '')
}

/** 应用欧拉角旋转 [x, y, z]（弧度） */
export function applyGalleryRotation(
  obj: THREE.Object3D,
  rotation?: [number, number, number]
) {
  if (!rotation) return
  obj.rotation.set(rotation[0], rotation[1], rotation[2])
}

/** 应用均匀或三轴缩放 */
export function applyGalleryScale(
  obj: THREE.Object3D,
  scale?: number | [number, number, number]
) {
  if (scale === undefined) return
  if (typeof scale === 'number') {
    obj.scale.setScalar(scale)
  } else {
    obj.scale.set(scale[0], scale[1], scale[2])
  }
}

/** library_video 相对店铺标点的局部坐标，缺省按索引排布 */
export function getGalleryVideoLocalPosition(
  video: GalleryLibraryVideo,
  index: number
): [number, number, number] {
  return video.position ?? [
    (index % 3) * 2 - 2,
    0,
    Math.floor(index / 3) * 2 + 1.5
  ]
}

/**
 * 将 position / rotation / scale 应用到模型根节点（与 scene loadSceneFromJSON 一致）。
 * 变换必须写在 splat/model 根上，Spark 点云对父级 group 偏移可能不生效。
 */
export function applyGalleryVideoTransform(
  asset: THREE.Object3D,
  video: GalleryLibraryVideo,
  shopOrigin: { x: number; y: number; z: number },
  index: number
) {
  const [lx, ly, lz] = getGalleryVideoLocalPosition(video, index)
  asset.position.set(shopOrigin.x + lx, shopOrigin.y + ly, shopOrigin.z + lz)
  applyGalleryRotation(asset, video.rotation)
  applyGalleryScale(asset, video.scale)
  asset.updateMatrixWorld(true)
}

/** 点云根节点变换后通知 Spark 重建 */
export function refreshGallerySplatMesh(asset: THREE.Object3D) {
  asset.traverse(child => {
    if (child instanceof SplatMesh) {
      child.updateGenerator()
    }
  })
}

/** 解析 library_video 目标缩放 */
export function getGalleryTargetScale(
  scale?: number | [number, number, number]
): THREE.Vector3 {
  if (scale === undefined) return new THREE.Vector3(1, 1, 1)
  if (typeof scale === 'number') return new THREE.Vector3(scale, scale, scale)
  return new THREE.Vector3(scale[0], scale[1], scale[2])
}

/** GSAP 缩放入场：0 → 目标值（参考 threeCore animateStepObjectIn） */
export function animateGalleryAssetScaleIn(
  asset: THREE.Object3D,
  targetScale: THREE.Vector3,
  options?: { isSplat?: boolean; duration?: number; delay?: number }
): gsap.core.Tween {
  const { isSplat = false, duration = 0.55, delay = 0 } = options ?? {}

  gsap.killTweensOf(asset.scale)
  asset.scale.set(0, 0, 0)
  if (isSplat) refreshGallerySplatMesh(asset)

  return gsap.to(asset.scale, {
    x: targetScale.x,
    y: targetScale.y,
    z: targetScale.z,
    duration,
    delay,
    ease: 'back.out(1.35)',
    onUpdate: () => {
      asset.updateMatrixWorld(true)
      if (isSplat) refreshGallerySplatMesh(asset)
    },
    onComplete: () => {
      asset.updateMatrixWorld(true)
      if (isSplat) refreshGallerySplatMesh(asset)
    }
  })
}

/** 停止模型根节点上的缩放 tween */
export function killGalleryAssetScaleTweens(root: THREE.Object3D) {
  root.traverse(obj => gsap.killTweensOf(obj.scale))
}
