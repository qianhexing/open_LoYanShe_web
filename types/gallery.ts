/** 展馆 JSON 中精简的 library_video 条目 */
export interface GalleryLibraryVideo {
  /** 关联图鉴 id（对应 pk_id / library.library_id） */
  library_id: number
  /** 模型地址（.rad / .glb 等，相对 OSS 或绝对 URL） */
  addr: string
  /** 可选展示标题（接口拉取前备用） */
  title?: string
  /** 相对店铺标点的局部坐标 [x, y, z] */
  position?: [number, number, number]
  /** 缩放：数字为均匀缩放，或 [x, y, z] */
  scale?: number | [number, number, number]
  /** 欧拉角旋转 [x, y, z]（弧度，绕各轴） */
  rotation?: [number, number, number]
  video_id?: number
}

/** 展馆内店铺标点配置 */
export interface GalleryShopMarker {
  shop_id: number
  shop_name: string
  shop_logo: string
  /** 标点中心位置 [x, z] */
  position: [number, number]
  /** 高度偏移，默认 0 */
  y?: number
  library_video?: GalleryLibraryVideo[]
}

/** 展馆墙体配置 */
export interface GalleryWall {
  position: [number, number]
  size: [number, number]
  rotation?: number
  height?: number
}

/** 展品配置 */
export interface GalleryExhibit {
  id: string
  position: [number, number]
  size: [number, number]
  modelUrl?: string
  name: string
  description?: string
  rotation?: number
  pedestalHeight?: number
}

/** 展馆整体配置 */
export interface GalleryConfig {
  walls: GalleryWall[]
  exhibits: GalleryExhibit[]
  shops: GalleryShopMarker[]
  mapSize: { width: number; depth: number }
  moveSpeed?: number
  playerStart?: [number, number]
  interactDistance?: number
  playerRadius?: number
}

/** OSS JSON 文件结构（含元信息） */
export interface GalleryConfigFile extends GalleryConfig {
  id?: string
  name?: string
}

export interface GalleryExhibitRuntime extends GalleryExhibit {
  meshGroup?: import('three').Group
}
