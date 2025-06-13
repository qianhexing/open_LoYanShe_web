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