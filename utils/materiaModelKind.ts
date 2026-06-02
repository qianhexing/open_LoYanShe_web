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

/** 根据 URL 判断是否为 Spark 支持的点云资源（不含 .radc 分片，分片由 .rad + paged 自动拉取） */
export function isSplatUrl(url: string): boolean {
  const u = (url || '').toLowerCase().split('?')[0] || ''
  return SPLAT_URL_RE.test(u)
}

/** Spark 2.0 LoD：.rad 头文件（build-lod --rad-chunked 时分片为 .radc，加载头文件并 paged 流式） */
export function isRadLodSplatUrl(url: string): boolean {
  const u = (url || '').toLowerCase().split('?')[0].split('#')[0] || ''
  return /\.rad$/i.test(u)
}

export function isSplatMaterial(item: Material): boolean {
  const o = item.options
  if (o && o.assetKind === 'splat') return true
  return isSplatUrl(item.materia_url || '')
}

export function materialFileNameFromUrl(url: string): string {
  if (!url) return ''
  const path = url.split('?')[0] || url
  const parts = path.split('/')
  return parts[parts.length - 1] || '素材文件'
}
