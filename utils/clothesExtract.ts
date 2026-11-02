import type { Library, Shop, Wardrobe, WardrobeClothes } from '@/types/api'
import type {
  ClothesExtractItem,
  ClothesExtractJsonExtra,
  ClothesExtractLibraryCandidate,
  ClothesExtractResult,
  ClothesExtractShopCandidate,
} from '@/api/wardrobe'
import { toAbsoluteMediaUrl, normalizeRawImgPath } from '@/utils/communityLiveMedia'

export const CLOTHES_EXTRACT_MAX_IMAGES = 4

export interface ClothesExtractAddItem extends Partial<Omit<WardrobeClothes, 'add_time' | 'origin' | 'plan'>> {
  wardrobe_name?: string
  wardrobe?: Wardrobe
  library?: Library | null
  origin_shop?: Partial<Shop>
  /** 纯文本颜色，与 hex 的 color 分开 */
  color_text?: string | null
  add_time?: string | Date | null
  origin?: string | number | null
  extractFill?: boolean
}

export interface ClothesExtractDraft {
  key: string
  selected: boolean
  inserted: boolean
  item: ClothesExtractItem
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function toFavoriteLevel(value: unknown): number | null {
  const n = toNullableNumber(value)
  if (n == null) return null
  return Math.min(5, Math.max(0, Math.round(n)))
}

export function toPublicImageUrl(fileUrl: string): string {
  return toAbsoluteMediaUrl(fileUrl)
}

export function toRelativeClothesImg(path: string | null | undefined): string | null {
  const raw = toNullableString(path)
  if (!raw) return null
  if (raw.startsWith('blob:')) return null
  return normalizeRawImgPath(raw)
}

export function normalizeAddTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const cn = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (cn) {
    return `${cn[1]}-${cn[2].padStart(2, '0')}-${cn[3].padStart(2, '0')}`
  }
  return s || null
}

function normalizeShopCandidate(raw: unknown): ClothesExtractShopCandidate | null {
  const o = asRecord(raw)
  if (!o) return null
  const shop_id = toNullableNumber(o.shop_id)
  const shop_name = toNullableString(o.shop_name ?? o.name)
  if (shop_id == null && !shop_name) return null
  return {
    shop_id,
    shop_name,
    score: toNullableNumber(o.score ?? o.similarity),
    similarity: toNullableNumber(o.similarity),
    match: toNullableString(o.match),
  }
}

function normalizeLibraryCandidate(raw: unknown): ClothesExtractLibraryCandidate | null {
  const o = asRecord(raw)
  if (!o) return null
  const library_id = toNullableNumber(o.library_id)
  if (library_id == null) return null
  return {
    library_id,
    name: toNullableString(o.name),
    cover: toNullableString(o.cover),
    square_cover: toNullableString(o.square_cover),
    shop_id: toNullableNumber(o.shop_id),
  }
}

function pickItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const o = asRecord(raw)
  if (!o) return []
  if (Array.isArray(o.items)) return o.items
  if (Array.isArray(o.data)) return o.data
  const nested = asRecord(o.data)
  if (nested) {
    if (Array.isArray(nested.items)) return nested.items
    if (Array.isArray(nested.data)) return nested.data
  }
  return []
}

function normalizeCommaField(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value.map((p) => String(p).trim()).filter(Boolean).join(',')
    return joined || null
  }
  return toNullableString(value)
}

function normalizeOrigin(origin: unknown): string | number | null {
  if (typeof origin === 'number' && Number.isFinite(origin)) return origin
  return toNullableString(origin)
}

function normalizeCurrency(value: unknown): string | number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(value)
  if (String(value).trim() !== '' && Number.isFinite(n) && String(value).trim() === String(n)) {
    return n
  }
  return toNullableString(value)
}

function normalizeExtractItem(raw: unknown): ClothesExtractItem {
  const src = asRecord(raw) ?? {}
  const json_data = asRecord(src.json_data)

  return {
    clothes_note: toNullableString(src.clothes_note),
    price: toNullableNumber(src.price),
    original_price: toNullableNumber(src.original_price),
    offer_price: toNullableNumber(src.offer_price),
    num: toNullableNumber(src.num),
    size: toNullableString(src.size),
    color: toNullableString(src.color),
    color_text: toNullableString(src.color_text),
    origin: normalizeOrigin(src.origin),
    add_time: normalizeAddTime(src.add_time),
    clothes_part: normalizeCommaField(src.clothes_part),
    wardrobe_status: toNullableString(src.wardrobe_status),
    is_favorite: toFavoriteLevel(src.is_favorite),
    season: normalizeCommaField(src.season),
    tags: normalizeCommaField(src.tags),
    note: toNullableString(src.note),
    currency_type: normalizeCurrency(src.currency_type),
    clothes_img: toNullableString(src.clothes_img),
    library_id: toNullableNumber(src.library_id),
    json_data,
    library_candidates: Array.isArray(src.library_candidates)
      ? src.library_candidates
          .map(normalizeLibraryCandidate)
          .filter((c): c is ClothesExtractLibraryCandidate => c != null)
      : [],
    shop_candidates: Array.isArray(src.shop_candidates)
      ? src.shop_candidates
          .map(normalizeShopCandidate)
          .filter((c): c is ClothesExtractShopCandidate => c != null)
      : [],
  }
}

/** 只取返回里的服饰数组，整理成列表 */
export function normalizeClothesExtractResult(raw: unknown): ClothesExtractResult {
  return {
    items: pickItems(raw).map(normalizeExtractItem),
  }
}

export function createExtractDrafts(items: ClothesExtractItem[]): ClothesExtractDraft[] {
  return items.map((item, index) => ({
    key: `extract_${index}_${item.library_id ?? ''}_${item.clothes_note ?? ''}`,
    selected: true,
    inserted: false,
    item: { ...item },
  }))
}

export function extractItemTitle(item: ClothesExtractItem, index: number): string {
  return item.clothes_note?.trim() || `服饰 ${index + 1}`
}

function readExtractExtra(item: ClothesExtractItem): ClothesExtractJsonExtra | null {
  const extra = asRecord(item.json_data)?.extract
  return asRecord(extra) as ClothesExtractJsonExtra | null
}

export function extractItemMeta(item: ClothesExtractItem): string {
  const parts: string[] = []
  if (item.price != null) parts.push(`¥${item.price}`)
  if (item.original_price != null) parts.push(`原价 ¥${item.original_price}`)
  if (item.offer_price != null) parts.push(`出价 ¥${item.offer_price}`)
  const extra = readExtractExtra(item)
  if (extra?.deposit != null) parts.push(`定金 ¥${extra.deposit}`)
  if (extra?.balance != null) parts.push(`尾款 ¥${extra.balance}`)
  if (item.size) parts.push(item.size)
  if (item.color) parts.push(item.color)
  if (item.color_text) parts.push(item.color_text)
  const shop = selectedShopCandidate(item)?.shop_name
  if (item.origin != null && item.origin !== '') parts.push(String(item.origin))
  else if (shop) parts.push(shop)
  if (item.clothes_part) parts.push(item.clothes_part)
  if (item.wardrobe_status) parts.push(item.wardrobe_status)
  if (item.num != null && item.num !== 1) parts.push(`×${item.num}`)
  const includeNames = extra?.include_names
  const includeLabel = Array.isArray(includeNames)
    ? includeNames.filter(Boolean).join('、')
    : toNullableString(includeNames)
  if (includeLabel) parts.push(`含 ${includeLabel}`)
  return parts.join(' · ')
}

export function libraryCandidateCover(candidate: ClothesExtractLibraryCandidate): string | null {
  return toNullableString(candidate.cover) ?? toNullableString(candidate.square_cover)
}

export function selectedLibraryCandidate(item: ClothesExtractItem): ClothesExtractLibraryCandidate | null {
  const id = item.library_id
  if (id == null) return null
  return item.library_candidates?.find((c) => c.library_id === id) ?? null
}

export function selectedShopCandidate(item: ClothesExtractItem): ClothesExtractShopCandidate | null {
  const origin = item.origin
  if (origin == null || origin === '') return item.shop_candidates?.[0] ?? null
  if (typeof origin === 'number') {
    return item.shop_candidates?.find((c) => c.shop_id === origin) ?? null
  }
  const asId = Number(origin)
  if (/^\d+$/.test(String(origin)) && Number.isFinite(asId)) {
    return item.shop_candidates?.find((c) => c.shop_id === asId) ?? null
  }
  return item.shop_candidates?.find((c) => c.shop_name === origin) ?? null
}

export function applyLibraryCandidate(
  item: ClothesExtractItem,
  candidate: ClothesExtractLibraryCandidate,
): ClothesExtractItem {
  const cover = libraryCandidateCover(candidate)
  return {
    ...item,
    library_id: candidate.library_id,
    clothes_img: cover ?? item.clothes_img ?? null,
  }
}

export function clearLibraryCandidate(item: ClothesExtractItem): ClothesExtractItem {
  return {
    ...item,
    library_id: null,
  }
}

export function applyShopCandidate(
  item: ClothesExtractItem,
  candidate: ClothesExtractShopCandidate,
): ClothesExtractItem {
  return {
    ...item,
    origin: candidate.shop_id ?? candidate.shop_name ?? item.origin ?? null,
  }
}

function shopFromCandidate(candidate: ClothesExtractShopCandidate | null): Partial<Shop> | undefined {
  if (!candidate) return undefined
  const shop_id = candidate.shop_id
  const shop_name = candidate.shop_name?.trim()
  if (shop_id == null && !shop_name) return undefined
  return {
    ...(shop_id != null ? { shop_id } : {}),
    shop_name: shop_name || (shop_id != null ? `店铺 #${shop_id}` : ''),
  }
}

function shopFromOrigin(origin: string | number | null | undefined): Partial<Shop> | undefined {
  if (origin == null || origin === '') return undefined
  if (typeof origin === 'number' && Number.isFinite(origin)) {
    return { shop_id: origin, shop_name: `店铺 #${origin}` }
  }
  const name = String(origin).trim()
  if (!name) return undefined
  const asId = Number(name)
  if (/^\d+$/.test(name) && Number.isFinite(asId)) {
    return { shop_id: asId, shop_name: `店铺 #${asId}` }
  }
  return { shop_name: name }
}

function libraryFromExtract(item: ClothesExtractItem): Library | null {
  if (item.library_id == null) return null
  const candidate = selectedLibraryCandidate(item)
  return {
    library_id: item.library_id,
    name: candidate?.name?.trim() || item.clothes_note?.trim() || '',
    cover: libraryCandidateCover(candidate ?? { library_id: item.library_id }) || item.clothes_img || '',
  }
}

/** 把识图条目映射成 ClothesAdd.showModel 可吃的 item；null 字段不写，避免覆盖已填内容 */
export function mapExtractToClothesAddItem(
  wardrobe: Wardrobe,
  item: ClothesExtractItem,
  selectedShop: ClothesExtractShopCandidate | null = null,
): ClothesExtractAddItem {
  const origin_shop =
    shopFromCandidate(selectedShop)
    ?? shopFromCandidate(selectedShopCandidate(item))
    ?? shopFromOrigin(item.origin)
  const origin =
    origin_shop?.shop_id
    ?? origin_shop?.shop_name
    ?? item.origin
    ?? null

  const mapped: ClothesExtractAddItem = {
    wardrobe_id: wardrobe.wardrobe_id,
    wardrobe,
    wardrobe_name: wardrobe.wardrobe_name,
    extractFill: true,
  }

  if (item.clothes_note != null) mapped.clothes_note = item.clothes_note
  if (item.price != null) mapped.price = item.price
  if (item.original_price != null) mapped.original_price = item.original_price
  if (item.offer_price != null) mapped.offer_price = item.offer_price
  if (item.num != null) mapped.num = item.num
  if (item.size != null) mapped.size = item.size
  if (item.color != null) mapped.color = item.color
  if (item.color_text != null) mapped.color_text = item.color_text
  if (origin != null) mapped.origin = origin
  if (origin_shop) mapped.origin_shop = origin_shop
  if (item.add_time != null) mapped.add_time = item.add_time
  if (item.clothes_part != null) mapped.clothes_part = item.clothes_part
  if (item.wardrobe_status != null) mapped.wardrobe_status = item.wardrobe_status
  if (item.is_favorite != null) mapped.is_favorite = item.is_favorite
  if (item.season != null) mapped.season = item.season
  if (item.tags != null) mapped.tags = item.tags
  if (item.note != null) mapped.note = item.note
  if (item.currency_type != null) mapped.currency_type = String(item.currency_type)
  if (item.json_data != null) mapped.json_data = item.json_data
  if (item.clothes_img != null) mapped.clothes_img = toRelativeClothesImg(item.clothes_img) ?? item.clothes_img
  if (item.library_id != null) {
    mapped.library_id = item.library_id
    const lib = libraryFromExtract(item)
    if (lib) mapped.library = lib
  }

  return mapped
}

type CoverPreview = {
  file?: File
  url?: string
}

export async function resolveExtractCoverPath(
  preview: CoverPreview | null | undefined,
  fallbackImg: string | null | undefined,
  upload: (file: File) => Promise<string>,
): Promise<string | null> {
  if (preview?.file) {
    return upload(preview.file)
  }
  const fromPreview = toRelativeClothesImg(preview?.url)
  if (fromPreview) return fromPreview
  return toRelativeClothesImg(fallbackImg)
}

/** 直接入库：只带非 null 字段 */
export function mapExtractToInsertPayload(
  wardrobeId: number,
  item: ClothesExtractItem,
  clothesImg: string | null,
): WardrobeClothes {
  const params: WardrobeClothes & { origin?: string | number | null; add_time?: string | Date | null } = {
    wardrobe_id: wardrobeId,
  }
  if (clothesImg) params.clothes_img = clothesImg
  if (item.clothes_note != null) params.clothes_note = item.clothes_note
  if (item.note != null) params.note = item.note
  if (item.price != null && item.price !== 0) params.price = item.price
  if (item.original_price != null) params.original_price = item.original_price
  if (item.offer_price != null) params.offer_price = item.offer_price
  if (item.num != null) params.num = item.num
  if (item.size != null) params.size = item.size
  if (item.color != null) params.color = item.color
  if (item.origin != null) params.origin = item.origin
  if (item.add_time != null) params.add_time = item.add_time
  if (item.clothes_part != null) params.clothes_part = item.clothes_part
  if (item.wardrobe_status != null) params.wardrobe_status = item.wardrobe_status
  if (item.is_favorite != null) params.is_favorite = item.is_favorite
  if (item.season != null) params.season = item.season
  if (item.tags != null) params.tags = item.tags
  if (item.currency_type != null) params.currency_type = String(item.currency_type)
  if (item.library_id != null) params.library_id = item.library_id
  if (item.json_data != null) params.json_data = item.json_data
  return params as WardrobeClothes
}
