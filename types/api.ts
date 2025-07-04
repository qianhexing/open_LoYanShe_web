// types/api.ts

/** 基础响应类型 */
export interface BaseResponse<T = any> {
  code: number;
  message: string;
  msg: string;
  data: T;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页响应数据 */
export interface PaginationResponse<T = any> {
  rows: T[];
  count: number;
}
/** 配置类型 */
export interface Config {
  app_version: string
}

/** 配置类型 */
export interface Swiper {
  create_time:Date
  sort: number
  swiper_cover: string
  swiper_id: number
  swiper_title: string
}
export interface Icon {
  create_time: Date
  en: string
  icon_belong: number
  icon_cover: string
  icon_id: number
  icon_name: string
  icon_type: number
  is_enable: number
  ja: string
  link: string
  sort: number
}

/** 合集 */
// Competition.ts
export interface Compilations {
  comp_id: number
  comp_name?: string | null
  comp_describe?: string | null
  comp_cover?: string | null
  manage_user?: string | null
  create_user?: number | null
  create_date?: string // ISO 格式时间戳
  good_number?: number
  brows_times?: number
  pk_type?: number // 0是图鉴合集 1是搭配合集
}


/** 店铺类型 */
export interface Shop {
	shop_id: number
	shop_name: string
	shop_logo: string
	shop_country: number
	goods_count?: number
	likes?: number
  count_library?: number
  main_type?: string
}
/** 图鉴 */
export interface Library {
	library_id: number
  name: string
  cover: string
  shop?: Shop
  shop_id?: number
}
/** 研习类型 */
export interface Study {
  study_id: number
  parent_id?: number
  study_cover: string
  sort: number
  study_title: string
  study_desc: string
  create_user?: number | null
  create_time: Date
  study_type: number
  study_url: string
  count: number
  child?: Study[]
}

export interface Community {
  community_id: number
  type?: string | null
  title?: string | null
  content?: string | null
  user_id?: number
  good_num?: number
  collection_number?: number
  is_enable?: number
  boutique?: number
  sort?: number
  img_list?: string | null   // JSON 字符串，可能是 string[]
  small_img_list?: string | null
  community_type?: number
  library_list?: string | null
  shop_list?: string | null
  collocation_list?: string | null
  clothes_id?: number
  is_open?: number
  video?: string | null
  date?: string              // ISO timestamp string
  is_lock?: number
  vote_id?: number

  // 关联字段
  user?: User
  good?: Good[]
  black_list?: BlackList
  comments?: Comment[]
  collect?: Collect
  community_hide?: CommunityHide
}

export interface User {
  user_id: number
}

export interface Good {
  good_id: number
}
export interface BlackList {
  good_id: number
}

export interface Collect {
  collect_id: number
}
export interface CommunityHide {
  hidden_id: number
}

