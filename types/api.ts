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