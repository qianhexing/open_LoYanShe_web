import type { GalleryConfig, GalleryConfigFile } from '@/types/gallery'
import { BASE_IMG } from '@/utils/ipConfig'
import { defaultGalleryConfig, DEFAULT_GALLERY_ID } from '@/utils/galleryConfig'

const GALLERY_CONFIG_BASE = `${BASE_IMG}ssr/gallery`

/** 规范化 OSS 返回的 JSON */
export function normalizeGalleryConfigFile(data: GalleryConfigFile): GalleryConfigFile {
  return {
    ...data,
    walls: data.walls ?? [],
    exhibits: data.exhibits ?? [],
    shops: (data.shops ?? []).map(shop => ({
      ...shop,
      objects: shop.objects ?? []
    })),
    mapSize: data.mapSize ?? { width: 20, depth: 20 }
  }
}

/** 从 OSS 按 ID 加载展馆配置：{BASE_IMG}ssr/gallery/{id}.json */
export async function fetchGalleryConfigById(id: string): Promise<GalleryConfigFile> {
  const safeId = encodeURIComponent(id.trim())
  const url = `${GALLERY_CONFIG_BASE}/${safeId}.json`

  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const data = (await res.json()) as GalleryConfigFile
    return normalizeGalleryConfigFile(data)
  } catch (err) {
    // 默认馆本地 fallback，便于 OSS 未上传时开发调试
    if (id === DEFAULT_GALLERY_ID) {
      console.warn('[gallery] OSS 配置加载失败，使用本地 fallback:', err)
      return normalizeGalleryConfigFile({
        ...defaultGalleryConfig,
        id: DEFAULT_GALLERY_ID,
        name: '默认展馆'
      })
    }
    throw new Error(`展馆配置加载失败（id=${id}）`)
  }
}
