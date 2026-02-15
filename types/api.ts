// types/api.ts
import type { SceneJSON } from '@/utils/threeCore'
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
export interface ExchangeRate  {
  JPY?: number
  RUB?: number
  [key: string]: number | undefined; // 添加索引签名
}

/** 配置类型 */
export interface Config {
  app_down_link: string;
  app_version: string;
  community_foreign: Array<{ label: string; value: number }>;
  community_type: Array<{ label: string; value: string }>;
  emoji_config: Array<{
    name: string;
    list: Array<{
      label: string;
      url: string;
      value: number;
    }>;
  }>;
  exchange_rate: ExchangeRate
  good_addr: Array<{ label: number; value: string }>;
  image_link: Array<{ label: number; value: string }>;
  image_params: string;
  image_params_small: string;
  image_params_square: string;
  level: number[];
  library_state: Array<{ label: string; value: number }>;
  main_style: Array<{ label: string; value: number }>;
  min_add_library: number;
  money_type: Array<{
    label: string;
    value: number;
    exchange_rate?: string;
  }>;
  need_anwser: boolean;
  phone_code: Array<{
    value: number;
    label: string;
    children: Array<{
      value: number;
      label: string;
    }>;
    // 如果有更多字段可以在这里添加
  }>;
  reply_addr: Array<{ label: string; value: string }>;
  richtext_link: Array<{ label: string; value: string }>;
  scan_code: Array<{ label: number; value: string }>;
  shop_country: Array<{ label: string; value: number }>;
  shop_state: Array<{ label: string; value: number }>;
  study_type: Array<{ type: number; value: string }>;
  user: Record<string, unknown>; // 或者定义更具体的用户接口
  wiki_type: Array<{ value: number; label: string }>;
  pipe_state: Array<{ label: string; value: number, color: string }>;
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
  is_enable?: number
  is_open?: number // 是否开放编辑
  is_official?: number // 是否官方合集
}


/** 店铺类型 */
export interface Shop {
	shop_id: number
	shop_name: string
	shop_logo: string
	shop_country: number
	good_count?: number
	likes?: number
  count_library?: number
  main_type?: string
  masterpiece_list?: Library[]
  style_list?: Wiki[]
  type_list?: Wiki[]
  shop_url?: string
  shop_describe?: string
  black_count?: number
  
}
export interface PhysicalShop {
	physical_id?: number
  physical_name?: string
  latitude?: string | number
  longitude?: string | number
  physical_logo?: string
  address?: string
  area?: string
  city?: string
  province?: string
  create_time?: string
  shop_id?: number
  shop?: {
    shop_id: number
    shop_name?: string
    shop_url?: string | null
  }
}
export interface Wiki {
  wiki_id: number | string
  wiki_name: string
  type_id?: string
  cover?: string
  sort?: number
  parent_list?: WikiForeign[]
  child_list?: WikiForeign[]
}

export interface WikiForeign {
  foreign_id: number
  pk_type: number
  pk_id: number
  wiki_id: number
  create_time?: string
  is_show: number
  wiki: Wiki
}
export interface WikiType {
  wiki_type_id: number
  wiki_type_name: string
  wiki_secondary_type?: string
  wiki_type?: string
}
export interface FilterList {
  field: string
  op: string
  value: string | number
}

/** 图鉴 */
export interface Library {
	library_id: number
  name: string
  cover: string
  shop?: Shop
  state?: string
  shop_id?: number
  library_type?: string
  theme?: string;
  library_pattern?: string;
  sale_time?: string;
  color?: string;
  pattern_elements?: string | null;
  design_elements?: string | null;
  fabric_composition?: string | null; // Comma-separated string
  cloth_elements?: string | null;
  secondary_cloth?: string | null;
  notes?: string | null;
  size_image?: string; // Comma-separated image paths
  size?: string | null;
  good_count?: number
  collect_count?: number
  wardrobe_count?: number
  is_good?: number
  library_price?: number
  shop_country?: number
  quality_test?: string | null  | null;
  parent?: Library;
  style_list?: Wiki[];
  start_time?: string | null;
  end_time?: string | null;
  arrears_start?: string;
  arrears_end?: string | null;
  season?: string | null;
  link?: string | null;
  parent_id?: number;
  detail_image?: string | null;
  is_collect?: number;
  is_wardrobe?: number;
  examin?: number;
}
/** 衣柜 */
export interface Wardrobe {
  wardrobe_id?: number
  wardrobe_cover?: string | null
  wardrobe_name?: string
  user_id?: number
  is_private?: number
  wardrobe_desc?: string
  count_clothes?: number
  create_date?: Date
  is_enable?: number
  sort?: number
  show_price?: number
  sort_type?: number
  custom_style?: Record<string, any>
  background?: string
  password?: string
  include_tags?: string
  total_times?: number
  total_community?: number
  total_price?: number
  total_count?: number
}
/** 服饰 */
export interface WardrobeClothes {
  main_style_list?: { label: string; value: number }[]
  include?: WardrobeClothes[]
  clothes_id?: number
  wardrobe_id?: number
  clothes_img?: string
  clothes_note?: string
  date?: Date
  is_enable?: number
  library_id?: number
  is_have?: number
  plan_id?: number
  wardrobe_status?: string
  detail_image?: string
  detail_image_list?: string[]
  season?: string
  price?: number
  color?: string
  times?: number
  real_picture?: string
  sort?: number
  clothes_part?: string
  tags?: string
  note?: string
  include_clothes?: string
  origin?: string
  sum_price?: number
  size?: string
  add_time?: Date
  position?: string
  is_favorite?: number
  main_style?: string
  num?: number
  last_dress?: Date
  sence_id?: number
  model_list?: MaterialForeign[]
}
export interface MaterialForeign {
  foreign_id?: number
  pk_type?: number
  pk_id?: number
  materia_id?: number
  create_time?: string
  is_enable?: number
  material_box?: Material
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
/** 研习关联 */
export interface StudyForeign {
  create_time: Date
  foreign?: {
    text?: string
    cover?: string
  }
  community?: Community
  library?: Library
  shop?: Shop
  foreign_id: number
  is_enable: number
  pk_id: number | string
  pk_type: number
  sort: number
  study_id: number
}

/** 收藏夹 */
export interface Favorite {
  id: number;
  is_collect?: number;
  favorite_name: string;
  favorite_pic?: string | null;
}

/** 采集清单（collection_list） */
export interface CollectionList {
  /** 主键 ID */
  collection_id?: number
  /** 评论 ID，对应后端 comment_id */
  comment_id?: number
  /** 用户 ID */
  user_id?: number
  /** 创建时间 */
  create_time?: Date
  /** 关联类型，0 等各种业务类型 */
  pk_type?: number
  /** 关联的业务主键 ID */
  pk_id?: number
  /** 是否完成：0/1 等 */
  is_completed?: number
  comment?: Comment
  note?: string
  url?: string
}

export interface CommunityForeign {
  community:Community
  community_fireign_id: number
  community_id: number
  create_time: Date
  is_enable: number
  pk_id:number
  pk_type: number
  sort: number
}
export interface Comment {
  bad_num:number
  comment_content: string
  comment_id: number
  date: Date
  floor: number
  good_num: number
  id: number
  ip_location?: string
  is_enable?: number
  library_list?: Library[]
  mount_img?: string
  mount_library?: Library[]
  notice?: number
  r_count?: number
  reply_to?: number
  type?: string
  user: User
  isCheck?: boolean
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
  sence_id?: number
}

export interface User {
  user_id?: number,
  user_face?: string
  user_name?: string
  avatar?: Avatar
  permission_list?: string[]
  email?: string
  message_config?: Record<string, boolean>
  signature?: string
  province?: string | null
  city?: string | null
  area?: string | null
  show_area?: number
  is_achieve?: number
  main_style?: string | null
  exp?: number
  level?: number
  star_coin?: number
}
export interface Avatar {
  frame_id: number,
  avatar_frame?: string
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


export interface LibraryVideo {
  addr?: string
  create_time?: string
  is_enable?: number
  is_show?: number
  pk_id?: number
  pk_type?: number
  sort?: number
  title?: string
  video_id?: number
  cover?: string
}

export interface Scene {
  addr?: string
  can_edit: boolean
  create_time:Date
  is_enable: number
  is_private: number
  matching_id: number
  sence_cover: string
  sence_data: string
  sence_desc:string
  sence_id: number
  user_id:number
  json_data: SceneJSON
}


export interface TemplateInterface {
  template_id: number
  pk_type: number
  is_free: number
  user_id: number
  main_style: string
  json_url: string
  json_data: SceneJSON
  create_time: Date
  update_time: Date
  use_time: number
  price: number
  title: string
  cover?: string
}
export interface Effect {
  effect_id: number
  effect_title?: string
  cover?: string
  is_remote?:number
  effect_name: string
  effect_url?: string
  is_free?: number
  create_time?: Date
  only_one?: number
  mian_style?: string
  options?: Record<string, any>
  target?: number
}
export interface Material {
  materia_id: number
  user_id: number
  pk_type: number
  pk_id: number
  create_time: Date
  is_enable?: number
  is_private?: number
  materia_title?: string
  materia_url: string
  cover?: string,
  options: Record<string, any>
}

export interface FileInterface {
  file_id: number
  file_url: string
  file_type: number
  file_md5: string
  create_time: Date
}

export interface LibraryPipe {
  pipe_id: number
  pk_id?: number
  create_time: Date
  start_time?: string
  end_time?: string
  library_list?: Library[]
  is_enable?: number
  state?: number
  user_id?: number
  note?: string
  url_list?: Array<Record<string, unknown>>
  pk_type?: number
  change_log?: Array<Record<string, unknown>>
  library?: Library
  item?: Library
  is_wardrobe?: number
  is_good?: number
  is_collect?: number
}

export interface BrowTime {
  times_id: number
  id: string | number
  type: string
  data: string
  count_times: number
}
/** 相册 */
export interface Album {
  album_id: number
  album_title: string
  album_cover: string
  parent_id?: number
  create_time?: Date
  sort?: number
}

export interface DisplayCabinet {
  cabinet_id?: number
  pk_id?: number
  pk_type?: number
  user_id?: number
  wardrobe_id?: number
  update_time?: string
  wardrobe?: Wardrobe
  wardrobe_clothes?: WardrobeClothes[]
}
export interface Magazine {
  magazine_id: number
  image_list: string
  title: string
  desc: string
  create_user: number
}
export interface NoticeMessage {
  notice_id?: number
  date?: string
  notice_content?: string
  notice?: number
  type?: number // 0全体 1个人
  is_enable?: number
  user_id: number // 如果是1时才有
}

/** 茶会 */
export interface Teaparty {
  tea_id?: number
  tea_title?: string
  tea_desc?: string
  tea_cover?: string
  create_time?: Date
  start_time?: Date
  end_time?: Date
  limit_number?: number
  current_number?: number
  admin_user?: number
  address?: string
  province?: string
  city?: string
  area?: string
  tea_type?: number
  join_way?: number
  detail_image?: string
  user?: User
  latitude?: number
  longitude?: number
}

/** 茶会参与者 */
export interface TeapartyAttend {
  attend_id?: number
  tea_id?: number
  user_id?: number
  is_approval?: number // 0待审批 1已通过 2已拒绝
  note?: string
  create_time?: Date
  user?: User
}
export interface PlanList {
  list_id?: number
  create_user?: number
  plan_member?: string
  plan_name?: string
  need_money?: number
  have_money?: number
  plan_cover?: string
  plan_note?: string
  is_complete?  : number
  is_enable?: number
  create_time?: Date
  end_time?: Date
  parent_id?: number
  clothes_id?: number
  is_email?: number
  plan_list?: PlanList[]
}