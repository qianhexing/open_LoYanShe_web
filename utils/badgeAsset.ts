import { SplatMesh, SparkRenderer, SplatFileType } from '@sparkjsdev/spark'
import * as THREE from 'three'
import { BASE_IMG, BASE_IMG_MODEL } from '@/utils/ipConfig'
import { isRadLodSplatUrl, isSplatUrl } from '@/utils/materiaModelKind'

export type BadgeCoverKind = 'image' | 'model' | 'splat'

export function isGlbCover(cover: string | undefined): boolean {
  if (!cover) return false
  const low = cover.toLowerCase()
  return low.endsWith('.glb') || low.endsWith('.gltf')
}

export function getBadgeCoverKind(cover: string | undefined): BadgeCoverKind {
  if (!cover) return 'image'
  if (isGlbCover(cover)) return 'model'
  if (isSplatUrl(cover)) return 'splat'
  return 'image'
}

/** 徽章配置列表：GLB/GLTF 与点云均视为 3D 资源 */
export function isBadge3DCover(cover: string): boolean {
  const kind = getBadgeCoverKind(cover)
  return kind === 'model' || kind === 'splat'
}

export function resolveBadgeAssetUrl(cover: string, kind?: BadgeCoverKind): string {
  if (cover.startsWith('http')) return cover
  const path = cover.startsWith('/') ? cover.slice(1) : cover
  const resolvedKind = kind ?? getBadgeCoverKind(cover)
  const base = resolvedKind === 'model' ? BASE_IMG_MODEL : BASE_IMG
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${path}`
}

function inferSplatFileTypeFromUrl(url: string): SplatFileType | undefined {
  let pathname = url
  try {
    pathname = new URL(url, 'https://placeholder.local').pathname
  } catch {
    const q = url.indexOf('?')
    const h = url.indexOf('#')
    let end = url.length
    if (q >= 0) end = Math.min(end, q)
    if (h >= 0) end = Math.min(end, h)
    pathname = url.slice(0, end)
  }
  const lower = pathname.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot < 0 || dot >= lower.length - 1) return undefined
  const ext = lower.slice(dot + 1)
  switch (ext) {
    case 'ply':
      return SplatFileType.PLY
    case 'spz':
      return SplatFileType.SPZ
    case 'splat':
      return SplatFileType.SPLAT
    case 'ksplat':
      return SplatFileType.KSPLAT
    case 'rad':
      return SplatFileType.RAD
    case 'zip':
      return SplatFileType.PCSOGSZIP
    default:
      return undefined
  }
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export interface BadgeSparkContext {
  sparkRenderer: SparkRenderer | null
  sceneHasPagedRadSplats: boolean
}

export function createBadgeSparkContext(): BadgeSparkContext {
  return { sparkRenderer: null, sceneHasPagedRadSplats: false }
}

export function ensureBadgeSparkRenderer(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  ctx: BadgeSparkContext
): SparkRenderer {
  if (ctx.sparkRenderer) {
    ctx.sparkRenderer.pagedExtSplats = ctx.sceneHasPagedRadSplats
    return ctx.sparkRenderer
  }
  const mobile = isMobileDevice()
  const sparkRenderer = new SparkRenderer({
    renderer,
    encodeLinear: false,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    pagedExtSplats: ctx.sceneHasPagedRadSplats,
    ...(mobile
      ? {
          sortRadial: true,
          focalAdjustment: 1.05,
          maxPixelRadius: 240,
          lodSplatScale: 0.52,
        }
      : {
          sortRadial: false,
          focalAdjustment: 1.2,
          minSortIntervalMs: 12,
        }),
  })
  scene.add(sparkRenderer)
  ctx.sparkRenderer = sparkRenderer
  return sparkRenderer
}

export function refreshBadgeScenePagedRadFlag(scene: THREE.Scene, ctx: BadgeSparkContext) {
  let hasPagedRad = false
  scene.traverse((obj) => {
    if (obj.userData?.type === 'splat' && obj.userData?.paged) hasPagedRad = true
  })
  ctx.sceneHasPagedRadSplats = hasPagedRad
  if (ctx.sparkRenderer) ctx.sparkRenderer.pagedExtSplats = hasPagedRad
}

function notifyBadgeSparkDirty(ctx: BadgeSparkContext) {
  const sr = ctx.sparkRenderer as (SparkRenderer & { setDirty?: () => void }) | null
  sr?.setDirty?.()
}

export async function loadBadgeSplatGroup(
  url: string,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  ctx: BadgeSparkContext
): Promise<{ mesh: THREE.Group; size: THREE.Vector3; center: THREE.Vector3 } | null> {
  try {
    ensureBadgeSparkRenderer(scene, renderer, ctx)
    const inferredFileType = inferSplatFileTypeFromUrl(url)
    const usePaged = isRadLodSplatUrl(url)
    const mobile = isMobileDevice()
    const skipRuntimeLod = inferredFileType === SplatFileType.RAD

    const splatMesh = new SplatMesh({
      url,
      ...(inferredFileType !== undefined ? { fileType: inferredFileType } : {}),
      maxSplats: mobile ? 40000 : 120000,
      ...(usePaged ? { paged: true } : {}),
      ...(mobile && !skipRuntimeLod ? { lod: true, lodScale: 0.55 } : {}),
    })
    await splatMesh.initialized

    splatMesh.maxSh = mobile ? 1 : 2
    splatMesh.userData.type = 'splat'
    splatMesh.userData.url = url
    splatMesh.userData.paged = usePaged
    splatMesh.castShadow = false
    splatMesh.receiveShadow = false
    splatMesh.quaternion.set(1, 0, 0, 0)
    splatMesh.updateGenerator()

    const group = new THREE.Group()
    group.userData.type = 'splat'
    group.userData.url = url
    group.userData.paged = usePaged
    group.add(splatMesh)

    refreshBadgeScenePagedRadFlag(scene, ctx)
    notifyBadgeSparkDirty(ctx)

    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    return { mesh: group, size, center }
  } catch (error) {
    console.error('[BadgePhysics] 加载点云失败:', url, error)
    return null
  }
}

export function refreshBadgeSplatMesh(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof SplatMesh) child.updateGenerator()
  })
}

export function disposeBadgeSplatMesh(splat: THREE.Object3D) {
  const mesh = splat as SplatMesh & {
    dispose?: () => void
    packedSplats?: { dispose?: () => void }
  }
  try {
    mesh.packedSplats?.dispose?.()
    mesh.dispose?.()
  } catch (error) {
    console.warn('SplatMesh dispose failed:', error)
  }
}

export function disposeBadgeSparkContext(ctx: BadgeSparkContext, scene: THREE.Scene) {
  if (!ctx.sparkRenderer) return
  const sr = ctx.sparkRenderer as SparkRenderer & {
    dispose?: () => void
    clearSplats?: () => void
  }
  try {
    sr.clearSplats?.()
    sr.dispose?.()
  } catch (error) {
    console.warn('SparkRenderer dispose failed:', error)
  }
  scene.remove(ctx.sparkRenderer)
  ctx.sparkRenderer = null
  ctx.sceneHasPagedRadSplats = false
}
