import type { BaseResponse, WardrobeClothes, Shop } from '@/types/api'

// 用户基本信息接口
export interface UserInfo {
  user_id: number
  user_name: string
  user_face: string
  /**
   * 兼容旧字段：以逗号分隔的风格名称
   * 例如："甜系,哥特"
   */
  main_style_name?: string | null
  /**
   * 新增字段：主要风格（可能有也可能没有）
   */
  main_style?: Array<{ label: string; value: number }> | null
}

// 相册项接口
export interface AlbumItem {
  album_id: number
  user_id: number
  note?: string
  ablumn: { // 保持用户给的拼写
    album_id: number
    parent_id: number
    album_title?: string
    album_cover?: string
  } | undefined
}

// 收藏服饰项接口
export interface FavoriteItem extends WardrobeClothes {
  library: {
    library_id: number
    name: string
    cover: string
    square_cover: string
    pattern_elements: string
    design_elements: string
    theme: string
  } | null
}

// 穿着率最高服饰项接口
export interface MostWornItem extends WardrobeClothes {
  library: {
    library_id: number
    name: string
    cover: string
    square_cover: string
    pattern_elements: string
    design_elements: string
    theme: string
  } | null
}

// 店铺列表项
export interface ShopListItem {
  label: string
  value: number
  shop: Shop | undefined
}

/** 年度总结数据接口 */
export interface YearlySummaryData {
  /** 用户基本信息 */
  user_info: UserInfo
  
  /** 相册项（重点展示） */
  ablumn_items: AlbumItem[]
  
  /** 入坑年数 */
  years_in_lolita: number
  
  /** 今年总消费 */
  total_spending: number
  
  /** 购买统计 */
  purchase_stats: Array<{ label: string; value: number }>
  
  /** 总入柜统计 */
  total_wardrobe_stats?: Array<{ label: string; value: number }>
  
  /** 最喜欢的物品，按部位分组 */
  favorite: Array<{
    label: string
    value: FavoriteItem[]
  }>
  
  /** 穿着率最高的 */
  most_worn: MostWornItem[]
  
  /** 今年拉黑的店铺 */
  blacklisted_shops: Shop[]
  
  /** 购买次数最多的店铺 */
  shop_list: ShopListItem[]
}

/** 获取年度总结数据 */
export async function getYearlySummary(
  params: {
    year?: number // 年份，默认为当前年份
    user_id?: string | number
  } = {}
): Promise<YearlySummaryData> {
  const response = await use$Post<BaseResponse<YearlySummaryData>>(
    '/yearly/summary',
    params
  )
  return response.data
}
