// types/api.ts
import type { SceneJSON } from '@/utils/threeCore'
import type { MatchingListItem } from '@/api/matching_list'
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
export interface QrCode {
  code_id?: number
  pk_type?: number
  pk_id?: number
  create_time?: string
  expires_time?: string | null
  user_id?: number
  code_url?: string
  code_content?: string
  is_enable?: number
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
  /** 研习内部链接等映射配置；value 为 APP 路径（如 pages/…）时可出现在管理端「类型映射」下拉里 */
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
  wb_name?: string
  wb_url?: string
  shop_state?: number
  shop_describe?: string
  black_count?: number
  collect_count?: number
  physical_shop?: PhysicalShop[]
  related_shop_list?: Shop[]

}
export interface PhysicalShop {
	physical_id?: number
  physical_name?: string
  physical_desc?: string
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
  /** 等值筛选，或区间对象（如图鉴价 library_price：`{ start, end }`） */
  value: string | number | Record<string, unknown>
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
  complete?: boolean;
  /** 综合评分（总分，0–5） */
  score?: number;
  /** 评分人数 */
  score_number?: number;
  /** 当前用户是否已评分（与 POST /score/one 未评分时 false 一致，常见 0/1） */
  is_score?: number | boolean;
  json_data?: Record<string, unknown>;
  /** 是否有关联 3D 人台（点云） */
  has_3d?: number | boolean;
}

/** 相似推荐 / 识图搜索列表项（相似度分越大越相似） */
export interface LibrarySimilarItem extends Library {
  similarity_score: number
  metadata_similarity_score?: number
  vector_similarity_bonus?: number
  vector_distance?: number | null
}

/** 衣柜配置 */
export interface WardrobeConfig {
  open_danmu?: number
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
  config?: WardrobeConfig
  display_badge?: string
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
  /** 喜爱级别，0–5，0 表示无星级 */
  is_favorite?: number
  main_style?: string
  num?: number
  last_dress?: Date
  sence_id?: number
  model_list?: MaterialForeign[]
  plan?: PlanList | null
  is_shared?: number
  good_count?: number
  bad_count?: number
  citation_count?: number
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
/** 研习类型 study_type：0 学习板块 · 1 内部链接（APP pages 路径）· 2 外部链接 */
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
  /** 是否底层：0 否（还可有下级）· 1 是（叶子，不显示展开） */
  is_bottom?: number
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

/** 用户收藏夹列表项（GET /favorite/list/visitor） */
export interface FavoriteFolder {
  id: number
  favorite_name: string
  favorite_pic?: string | null
  favorite_desc?: string | null
  collect_type?: number
  collect_count?: number
  create_time?: string
  /** 0 公开 1 私有 */
  is_private?: number
}

/** 收藏夹详情（GET /favorite/detail） */
export interface FavoriteDetail extends FavoriteFolder {
  user_id?: number
  user_name?: string
  times_count?: number
  /** 与旧站一致：0 表示允许删除 */
  able_delete?: number
}

/** 收藏夹内单条记录关联的图鉴摘要 */
export interface CollectLibraryInfo {
  library_id: number
  name: string
  cover?: string
  square_cover?: string
  library_pattern?: string
  pattern?: string
  library_type?: string
  state?: string
  shop_country?: number
  price?: number | string
  /** 列表接口可选返回，供收藏按钮展示 */
  collect_count?: number
  is_collect?: number
}

/** 收藏夹内单条记录关联的帖子摘要 */
export interface CollectCommunityInfo {
  community_id: number
  title?: string
  content?: string
  user?: User
  collect_count?: number
  is_collect?: number
  /** 帖子图列表，逗号分隔路径，与 Community 一致 */
  img_list?: string | null
  small_img_list?: string | null
}

/** 收藏夹内容列表项（POST /collect/list/visitor） */
export interface CollectVisitorRow {
  id: number
  collect_type: number
  create_time?: string
  /** 收藏附加数据（备注、标签等） */
  json_data?: Record<string, unknown> | null
  info?: CollectLibraryInfo | CollectCommunityInfo | null
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

/**
 * 帖子关联外键（community foreign）里的 `pk_type` 与业务实体对应：
 * - 0 店铺
 * - 1 实体店
 * - 2 衣柜服饰
 * - 3 搭配场景
 * - 4 搭配清单
 * - 5 合集考据
 * - 6 茶会返图
 * - 7 图鉴返图
 */
export interface CommunityForeign {
  community:Community
  community_fireign_id: number
  community_id: number
  create_time: Date
  is_enable: number
  pk_id:number
  /** 关联实体类型，取值见接口上方说明 */
  pk_type: number
  sort: number
}

/**
 * 帖子详情接口 `foreign_list` 单项：`pk_type` 含义与 {@link CommunityForeign} 一致，
 * 结构常与 {@link Library} 类似（封面、店铺、library_id / shop_id 等）。
 */
export type CommunityDetailForeignItem = Partial<Library> & {
  pk_type: number
  pk_id: number
  title?: string | null
  square_cover?: string | null
}

/** 评论 json_data 扩展字段 */
export interface CommentJsonData {
  flower_types?: string
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
  json_data?: CommentJsonData | Record<string, unknown>
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
  /** 社区内可见：0 正式居民可见，1 开放，2 仅自己可见 */
  is_open?: number
  video?: string | null
  date?: string              // ISO timestamp string
  is_lock?: number
  vote_id?: number
  display_badge?: string

  // 关联字段
  user?: User
  good?: Good[]
  good_count?: number
  collect_count?: number
  /** 帖子浏览次数（详情接口 / times 统计） */
  times_count?: number
  brows_times?: number
  black_list?: BlackList
  comments?: Comment[]
  collect?: Collect
  community_hide?: CommunityHide
  sence_id?: number
  /** 发帖关联的外部实体摘要列表（与 {@link CommunityDetailForeignItem} 对应） */
  foreign_list?: CommunityDetailForeignItem[]
  custom_style?: Record<string, any>
}

export interface UserDeco {
  deco_id?: number
  pk_type?: number
  pk_id?: number
  create_time?: string
  user_id?: number
  note?: string
  foreign?: {
    cover?: string
    name?: string
  }
}

export interface User {
  user_id?: number,
  user_face?: string
  user_name?: string
  avatar?: Avatar
  permission_list?: string[]
  email?: string
  /** 含邮件开关等布尔项，以及如 `home_page`（首页枚举）等非布尔配置 */
  message_config?: Record<string, unknown>
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
  access_level?: number
  /** 个人空间展示的小窝场景 ID */
  sence_id?: number
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
  user_id?: number | null
  is_enable?: number
  is_show?: number
  pk_id?: number
  pk_type?: number
  sort?: number
  title?: string
  video_id?: number
  cover?: string
  library?: Library
  /** 兼容两种存法：仅拉线 / 完整 SceneJSON（含 objects/lighting/background 等） */
  json_data?: {
    laxian_list?: LaxianItem[]
    objects?: unknown[]
    lighting?: unknown[]
    background?: string
    cameraList?: LaxianInitialCamera[]
    controls?: Record<string, unknown>
  }
}

/** 拉线镜头聚焦参数（可选） */
export interface LaxianCameraState {
  position: [number, number, number]
  target: [number, number, number]
}

/** 人台图初始镜头（存于 json_data.cameraList[0]） */
export interface LaxianInitialCamera extends LaxianCameraState {
  fov?: number
}

/** 拉线类型：0 设计元素，1 柄图元素 */
export type LaxianType = 0 | 1

/** 拉线标注线框形状：立方体 / 椭圆（椭球） */
export type LaxianFrameShape = 'box' | 'ellipse'

/** 拉线点下级标注线框 */
export interface LaxianHighlightFrame {
  frame_id?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** scale[0]=长 scale[1]=高 scale[2]=宽（世界单位，立方体线框） */
  scale?: [number, number, number]
  /** 标注形状，默认 box */
  shape?: LaxianFrameShape
}

// 拉线点项接口
export interface LaxianItem {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  title?: string
  laxian_id?: string
  /** 拉线类型：0 设计元素，1 柄图元素，默认 0 */
  type?: LaxianType
  /** 镜头聚焦参数（可选），点击拉线时若有则聚焦至该机位 */
  camera?: LaxianCameraState
  /** 下级标注线框（不限个数） */
  frames?: LaxianHighlightFrame[]
  /** 拉线点详情（富文本 HTML） */
  detail?: string
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
  allow_copy?: number
}

/** 场景关联（sence_foreign）嵌套的场景摘要 */
export interface SenceForeignScene {
  sence_id: number
  sence_cover?: string
  sence_desc?: string
}

/**
 * 场景关联外键（sence_foreign）
 * pk_type：0 店铺 · 2 图鉴（与 good/collect、event_redblack 一致）
 */
export interface SenceForeign {
  foreign_id: number
  sence_id: number
  pk_type: number
  pk_id: number
  create_time?: string | Date
  user_id?: number
  is_enable?: number
  sence?: SenceForeignScene
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
export type AlbumSourceType = 'system' | 'owned' | 'subscribed' | 'public'

/** 子打卡目标输入 */
export interface AlbumChildInput {
  album_id?: number
  album_title: string
  album_cover?: string
  album_desc?: string
  pk_type: number
  target_num?: number
  points_num?: number
  conditions?: { logic: string; rules: unknown[] }
  conclusion?: string
  sort?: number
}

/** 新建打卡相册 */
export interface InsertAlbumParams {
  album_title: string
  album_cover?: string
  album_desc?: string
  is_private?: number
  sort?: number
  children: AlbumChildInput[]
}

/** 编辑打卡相册 */
export interface UpdateAlbumParams {
  album_id: number
  album_title?: string
  album_cover?: string
  album_desc?: string
  is_private?: number
  sort?: number
  children?: AlbumChildInput[]
  delete_child_ids?: number[]
}

/** 相册 */
export interface Album {
  album_id: number
  album_title: string
  album_cover: string
  parent_id?: number
  create_time?: Date
  sort?: number
  album_desc?: string
  /** 0 公开 / 1 私有 */
  is_private?: number
  /** 列表来源：system | owned | subscribed | public */
  source_type?: AlbumSourceType
  is_subscribed?: boolean
  user_id?: number
  /** 子目标总数 */
  count?: number
  /** 已打卡数 */
  count_achieve?: number
  conclusion?: string
  pk_type?: number
  target_num?: number
  points_num?: number
  conditions?: { logic: string; rules: unknown[] }
  album_foreign?: AblumForeign
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

/** 茶会状态：0筹备中 / 1预约中 / 2已取消 / 3已结束 */
export type TeapartyState = 0 | 1 | 2 | 3

/** 茶会可写字段（新增与修改共用） */
export interface TeapartyWritableFields {
  tea_title?: string | null
  tea_desc?: string | null
  tea_cover?: string | null
  start_time?: Date | string | null
  end_time?: Date | string | null
  limit_number?: number | null
  address?: string | null
  province?: string | null
  city?: string | null
  area?: string | null
  tea_type?: number | null
  join_way?: number | null
  detail_image?: string | null
  latitude?: number | null
  longitude?: number | null
  organizer?: string | null
  mian_style?: string | null
  state?: TeapartyState | null
  dress_code?: string | null
  json_data?: Record<string, unknown> | string | null
  is_enable?: number | null
}

export type TeapartyInsertParams = TeapartyWritableFields

export interface TeapartyUpdateParams extends TeapartyWritableFields {
  tea_id: number
}

/** 茶会 */
export interface Teaparty extends TeapartyWritableFields {
  tea_id?: number
  create_time?: Date | string
  current_number?: number
  admin_user?: number
  user?: User
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
/** 经验获取记录 */
export interface ExpRecord {
  record_id: number
  create_time: string
  user_id: number
  type: number
  num: number
  note: string
  pk_type: number
}

/** 父计划摘要（子计划时的关联信息） */
export interface ParentPlanSummary {
  list_id?: number
  plan_name?: string
  need_money?: number
  have_money?: number
  parent_id?: number
  plan_cover?: string
  end_time?: string | Date
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
  wardrobe_clothes?: WardrobeClothes
  parent_plan?: ParentPlanSummary
}

/** 手账 */
export interface Journal {
  journal_id: number
  pk_type: number // 0=评论(签到) 1=帖子 2=服饰 3=搭配 4=图鉴 5=计划 6=3D场景
  pk_id: number
  journal_time: string // YYYY-MM-DD
  create_time?: string
  is_enable?: number
  note?: string
  tags?: string // 逗号分隔标签
  json_data?: Record<string, unknown>
  /** 根据 pk_type 返回关联数据 */
  community?: Community
  comment?: Comment
  wardrobe_clothes?: WardrobeClothes
  matching_list?: MatchingListItem
  library?: Library
  plan?: PlanList
  sence?: Scene
}

/** 投票选项 */
export interface VoteOption {
  options_id: number
  options_content: string
  options_number: number
}

/**
 * 投票类型：0 单选，1 多选
 * @see VoteDetail.vote_type
 */
export type VoteType = 0 | 1

/** 投票详情 */
export interface VoteDetail {
  vote_id?: number
  vote_title: string
  /** 0 单选，1 多选 */
  vote_type: number
  vote_options: VoteOption[]
  /** 已参与投票人数 */
  vote_number: number
  vote_end_time?: string | null
}

/** 单条用户已选（与 isVote 接口返回项一致） */
export interface VoteRecordChoice {
  options_id: number
}


export interface AblumForeign {
  foreign_id?: number
  album_id?: number
  cover?: string
  user_id?: number
  create_time?: Date
  update_time?: Date
  note?: string
  pk_type?: number
  pk_id?: number
  album?: Album
  user?: User
  wardrobe_clothes?: WardrobeClothes
  community?: Community
  library?: Library
  matching_list?: MatchingListItem
  plan?: PlanList
}

/**
 * 红黑大事记（店铺 pk_type=0，图鉴 pk_type=2）
 * attitude: 0 好评，1 差评，其余为中性
 */
export interface EventRedblack {
  event_id: number
  event_desc?: string
  attitude?: number
  create_time?: string | Date
  pk_type?: number
  pk_id?: number
  user_id?: number
  user?: User
}