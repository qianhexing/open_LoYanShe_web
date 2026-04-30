import type { Material } from '@/types/api'

/** 是否为 GLB/GLTF 三维模型素材（非上传图片类） */
export function isGltfGlbModelMaterial(item: Material): boolean {
  const o = item.options
  if (o && o.assetKind === 'image') return false
  if (o && o.assetKind === 'model') return true
  const u = (item.materia_url || '').toLowerCase().split('?')[0] || ''
  return u.endsWith('.glb') || u.endsWith('.gltf')
}

export function materialFileNameFromUrl(url: string): string {
  if (!url) return ''
  const path = url.split('?')[0] || url
  const parts = path.split('/')
  return parts[parts.length - 1] || '素材文件'
}
