import type { SceneObjectJSON } from '@/utils/threeCore'

/** 展馆内 3D 对象（与场景 SceneObjectJSON 中 model / splat 字段对齐） */
export type GallerySceneObject = Pick<
  SceneObjectJSON,
  | 'id'
  | 'type'
  | 'url'
  | 'position'
  | 'rotation'
  | 'scale'
  | 'options'
  | 'useDracoLoader'
  | 'library_id'
  | 'title'
> & {
  type: 'model' | 'splat'
  url: string
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
  /** 店铺关联 3D 模型/点云（position 为相对店铺标点的局部坐标） */
  objects?: GallerySceneObject[]
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
  name: string
  description?: string
  /** 展台绕 Y 轴旋转（弧度） */
  rotation?: number
  pedestalHeight?: number
  /** 与 SceneObjectJSON 对齐的模型字段 */
  type?: 'model' | 'splat'
  url?: string
  options?: Record<string, unknown>
  useDracoLoader?: boolean
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
