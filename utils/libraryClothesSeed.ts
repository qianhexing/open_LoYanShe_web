import type { Library, Shop } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

export interface LibraryClothesSeed {
  library: Library
  origin_shop?: Shop
  library_id?: number
  clothes_note?: string
  clothes_img?: string
  price?: number
  clothes_part?: string
  detail_image_list?: string[]
}

export interface LibraryTypeColorChooseResult {
  library: Library
  /** 选封面区手动选择的封面，未选则为 null */
  clothes_img: string | null
  selected_type_labels: string[]
  /** 已选子图鉴 / SKU 对应的封面（与 labels 顺序一致） */
  selected_type_covers: string[]
}

export function normalizeClothesImgPath(cover?: string | null): string | undefined {
  if (!cover?.trim()) return undefined
  return cover
    .trim()
    .replace(BASE_IMG, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^\//, '')
}

/** 图鉴 → 新增服饰表单初始数据（名称、封面、价格、店铺） */
export function librarySeedForClothesAdd(
  lib: Library,
  clothesImg?: string | null
): LibraryClothesSeed {
  const seed: LibraryClothesSeed = {
    library: lib,
    library_id: lib.library_id,
    clothes_note: lib.name ?? '',
    clothes_img: normalizeClothesImgPath(clothesImg) ?? normalizeClothesImgPath(lib.cover),
    price: lib.library_price ?? 0
  }
  if (lib.shop) {
    seed.origin_shop = lib.shop
  } else if (lib.shop_id) {
    seed.origin_shop = {
      shop_id: lib.shop_id,
      shop_name: `店铺 #${lib.shop_id}`,
      shop_logo: '',
      shop_country: 0
    }
  }
  return seed
}

/** 型色选择结果 → 新增服饰表单初始数据 */
export function librarySeedFromTypeColorChoose(
  data: LibraryTypeColorChooseResult
): LibraryClothesSeed {
  const typeLabels = data.selected_type_labels.filter(Boolean)
  const typeCovers = data.selected_type_covers
    .map((cover) => normalizeClothesImgPath(cover))
    .filter((cover): cover is string => Boolean(cover))
    .filter((cover, index, arr) => arr.indexOf(cover) === index)

  const manualCover = normalizeClothesImgPath(data.clothes_img)
  const mainCover = manualCover ?? typeCovers[0] ?? normalizeClothesImgPath(data.library.cover)

  const seed = librarySeedForClothesAdd(data.library, mainCover)

  if (typeLabels.length) {
    seed.clothes_part = typeLabels.join(',')
  }

  if (typeCovers.length) {
    seed.detail_image_list = typeCovers
  }

  seed.clothes_img = mainCover
  return seed
}
