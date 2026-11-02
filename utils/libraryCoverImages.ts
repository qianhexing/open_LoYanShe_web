import { getLibraryDetail, getLibraryList, getLibraryVideo } from '@/api/library'
import type { Library, LibraryVideo } from '@/types/api'
import { normalizeClothesImgPath } from '@/utils/libraryClothesSeed'

export interface LibraryCoverImageGroup {
  title: string
  images: string[]
}

export interface LibraryCoverTypeOption {
  key: string
  label: string
  cover: string
}

export interface LibraryCoverPickerData {
  groups: LibraryCoverImageGroup[]
  typeOptions: LibraryCoverTypeOption[]
}

interface LibrarySkuItem {
  library_pattern: string
  cover?: string
}

function parseJsonRecord(jsonData: unknown): Record<string, unknown> {
  if (jsonData == null) return {}
  if (typeof jsonData === 'string') {
    try {
      const parsed = JSON.parse(jsonData)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    return jsonData as Record<string, unknown>
  }
  return {}
}

function extractSkuCovers(jsonData: unknown): string[] {
  const raw = parseJsonRecord(jsonData).sku
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return []
    }
  }
  return uniquePaths(
    list.map((item) => {
      if (!item || typeof item !== 'object' || !('library_pattern' in item)) return ''
      const record = item as LibrarySkuItem
      if (!String(record.library_pattern ?? '').trim()) return ''
      return record.cover ?? ''
    })
  )
}

const MODEL_EXT = /\.(rad|spz|splat|glb|gltf|ply|ksplat|mp4|webm|mov)(\?|$)/i

function isSelectableImage(path: string): boolean {
  return !MODEL_EXT.test(path)
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    const normalized = normalizeClothesImgPath(path)
    if (!normalized || !isSelectableImage(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function splitImageField(value: unknown): string[] {
  if (Array.isArray(value)) return uniquePaths(value.map((item) => String(item)))
  if (typeof value !== 'string') return []
  return uniquePaths(value.split(/[,，]/))
}

function videoImagePaths(video: { addr?: string; cover?: string; pk_type?: number }): string[] {
  if (video.pk_type === 2) return uniquePaths([video.cover])
  return uniquePaths([...(video.addr ?? '').split(/[,，]/), video.cover])
}

async function loadLibraryRecord(libraryId: number): Promise<Library | null> {
  try {
    const detail = await getLibraryDetail({ library_id: libraryId })
    return detail.library ?? null
  } catch {
    return null
  }
}

async function loadVideos(libraryId: number): Promise<LibraryVideo[]> {
  try {
    return await getLibraryVideo({ pk_id: Number.parseInt(String(libraryId), 10) })
  } catch {
    return []
  }
}

function pushGroup(groups: LibraryCoverImageGroup[], title: string, images: string[]) {
  const next = uniquePaths(images)
  if (!next.length) return
  const existing = groups.find((group) => group.title === title)
  if (existing) {
    existing.images = uniquePaths([...existing.images, ...next])
    return
  }
  groups.push({ title, images: next })
}

function childTypeOption(child: Library): LibraryCoverTypeOption | null {
  const cover = normalizeClothesImgPath(child.cover)
  if (!cover || !isSelectableImage(cover)) return null
  const label = (child.library_pattern || child.library_type || child.name || '版型').trim()
  return {
    key: `lib-${child.library_id ?? label}`,
    label,
    cover
  }
}

/** 详情图、人台图的全部可选图片；有子图鉴时附带顶部版型 */
export async function loadLibraryCoverImageGroups(source: Library): Promise<LibraryCoverPickerData> {
  let item = source
  if (item.library_id) {
    const detail = await loadLibraryRecord(item.library_id)
    if (detail) item = { ...item, ...detail }
  }

  const related: Library[] = []
  if (item.library_type === '系列' && item.library_id) {
    try {
      const result = await getLibraryList({
        page: 1,
        pageSize: 999,
        filter_list: [{ field: 'parent_id', value: item.library_id, op: 'and' }]
      })
      const children = await Promise.all(
        (result.rows ?? []).map(async (row) => {
          if (row.detail_image) return row
          const detail = row.library_id ? await loadLibraryRecord(row.library_id) : null
          return detail ? { ...row, ...detail } : row
        })
      )
      related.push(...children)
    } catch {
      /* 子图鉴可选 */
    }
  } else if (item.parent_id) {
    const parent = await loadLibraryRecord(item.parent_id)
    if (parent) related.push(parent)
  }

  const groups: LibraryCoverImageGroup[] = []
  const cover = normalizeClothesImgPath(item.cover)
  const detailImages = uniquePaths([
    cover,
    ...splitImageField(item.detail_image),
    ...related.flatMap((lib) => splitImageField(lib.detail_image))
  ])

  const skuCovers = extractSkuCovers(item.json_data)
  if (skuCovers.length) pushGroup(groups, '版型', skuCovers)

  const videoSources = [item, ...related].filter((lib) => lib.library_id)
  const videoLists = await Promise.all(videoSources.map((lib) => loadVideos(lib.library_id)))
  videoLists.flat().forEach((video) => {
    pushGroup(groups, video.title?.trim() || '人台图', videoImagePaths(video))
  })

  if (cover && !detailImages.includes(cover) && !groups.some((group) => group.images.includes(cover))) {
    groups.unshift({ title: '图鉴封面', images: [cover] })
  }

  pushGroup(groups, '详情图', detailImages)

  const typeOptions = item.library_type === '系列'
    ? related.map(childTypeOption).filter((option): option is LibraryCoverTypeOption => option != null)
    : []

  return { groups, typeOptions }
}
