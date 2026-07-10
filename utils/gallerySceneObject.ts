import gsap from 'gsap'
import { SplatMesh } from '@sparkjsdev/spark'
import * as THREE from 'three'
import type { GallerySceneObject } from '@/types/gallery'
import { isRadLodSplatUrl, isSplatUrl } from '@/utils/materiaModelKind'
import { BASE_IMG } from '@/utils/ipConfig'
import type ThreeCore from '@/utils/threeCore'

/** 解析展馆对象 url（与场景 loadSceneFromJSON 一致，相对路径拼 BASE_IMG） */
export function resolveGalleryObjectUrl(url: string): string {
  if (!url?.trim()) return ''
  const s = url.trim()
  if (/^(https?:|blob:|data:)/i.test(s)) return s
  if (s.startsWith('//')) return s
  const base = BASE_IMG.endsWith('/') ? BASE_IMG.slice(0, -1) : BASE_IMG
  const path = s.startsWith('/') ? s.slice(1) : s
  return `${base}/${path}`
}

/** 推断对象类型（JSON 未写 type 时按 url 后缀判断） */
export function resolveGalleryObjectType(obj: GallerySceneObject): 'model' | 'splat' {
  if (obj.type === 'model' || obj.type === 'splat') return obj.type
  return isSplatUrl(obj.url) ? 'splat' : 'model'
}

/** 构建点云加载参数（.rad 才启用 paged；.spz / .ply 等走 Spark 常规加载） */
export function resolveGallerySplatLoadOptions(
  obj: GallerySceneObject,
  mobile: boolean
) {
  const isRad = isRadLodSplatUrl(obj.url)
  return {
    fileType: obj.options?.fileType,
    maxSplats: obj.options?.maxSplats ?? 50000,
    maxSh: obj.options?.maxSh ?? 2,
    ...(isRad ? { paged: obj.options?.paged ?? true } : {}),
    mobileOptimized: obj.options?.mobileOptimized ?? mobile
  }
}

/** 加载单个 model / splat（逻辑对齐 threeCore.loadSceneFromJSON） */
export async function loadGallerySceneObject(
  core: ThreeCore,
  obj: GallerySceneObject,
  mobile: boolean
): Promise<THREE.Object3D | null> {
  const url = resolveGalleryObjectUrl(obj.url)
  if (!url) return null

  const type = resolveGalleryObjectType(obj)

  if (type === 'splat') {
    return core.loadSplat(url, resolveGallerySplatLoadOptions(obj, mobile))
  }

  const rawCt = obj.options?.characterType as
    | { stand?: { primary?: string } }
    | undefined
  const hasCharacterType = Boolean(rawCt?.stand?.primary)

  const model = await core.loadModel(url, {
    useDracoLoader: obj.useDracoLoader !== false,
    dracoDecoderPath: '/draco/gltf/',
    ...(hasCharacterType ? { skipDefaultAnimations: true } : {})
  })

  if (obj.options) {
    core.setOptionsModel(model, obj.options)
  }

  return model
}

/** 对象相对店铺标点的局部坐标，缺省按索引排布 */
export function getGalleryObjectLocalPosition(
  obj: GallerySceneObject,
  index: number
): [number, number, number] {
  return obj.position ?? [
    (index % 3) * 2 - 2,
    0,
    Math.floor(index / 3) * 2 + 1.5
  ]
}

/**
 * 将 position / rotation / scale 应用到模型根节点（与 scene loadSceneFromJSON 一致）。
 * 变换必须写在 splat/model 根上，Spark 点云对父级 group 偏移可能不生效。
 */
export function applyGalleryObjectTransform(
  asset: THREE.Object3D,
  obj: GallerySceneObject,
  shopOrigin: { x: number; y: number; z: number },
  index: number
) {
  const [lx, ly, lz] = getGalleryObjectLocalPosition(obj, index)
  asset.position.set(shopOrigin.x + lx, shopOrigin.y + ly, shopOrigin.z + lz)

  const rotation = obj.rotation ?? [0, 0, 0]
  asset.rotation.set(rotation[0], rotation[1], rotation[2])

  const scale = obj.scale ?? [1, 1, 1]
  asset.scale.set(scale[0], scale[1], scale[2])
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

/** 解析对象目标缩放 */
export function getGalleryTargetScale(
  scale?: [number, number, number]
): THREE.Vector3 {
  if (!scale) return new THREE.Vector3(1, 1, 1)
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
