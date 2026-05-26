import type { Material } from '@/types/api'

/** 是否为 GLB/GLTF 三维模型素材（非上传图片类） */
export function isGltfGlbModelMaterial(item: Material): boolean {
  const o = item.options
  if (o && o.assetKind === 'image') return false
  if (o && o.assetKind === 'model') return true
  const u = (item.materia_url || '').toLowerCase().split('?')[0] || ''
  return /\.(glb|gltf)(\?|#|$)/i.test(u)
}

const SPLAT_URL_RE = /\.(ply|spz|splat|ksplat|rad|zip)(\?|#|$)/i

export function isSplatMaterial(item: Material): boolean {
  const o = item.options
  if (o && o.assetKind === 'splat') return true
  const u = (item.materia_url || '').toLowerCase().split('?')[0] || ''
  return SPLAT_URL_RE.test(u)
}

export function materialFileNameFromUrl(url: string): string {
  if (!url) return ''
  const path = url.split('?')[0] || url
  const parts = path.split('/')
  return parts[parts.length - 1] || '素材文件'
}
