import type { Object3D } from "three"
import type * as THREE from 'three'

export interface DiaryInterface {
  title: string
  content: string
  object?: Object3D
  id?: string,
  position?: {
    x: number
    y: number
  }
}
export interface LibraryInterface {
  title: string
  cover: string
  object?: THREE.Object3D
  id?: string,
  library_id?: number
  position?: {
    x: number
    y: number
  }
}

/** 拉线镜头聚焦参数（可选，有则点击时聚焦至该机位） */
export interface LaxianCameraState {
  position: [number, number, number]
  target: [number, number, number]
}

/** 拉线类型：0 设计元素，1 柄图元素 */
export type LaxianType = 0 | 1

export interface LaxianInterface {
  title: string
  laxian_id?: string
  /** 拉线类型：0 设计元素，1 柄图元素 */
  type?: LaxianType
  object?: THREE.Object3D
  /** 3D 点投影到屏幕的坐标 */
  position?: {
    x: number
    y: number
  }
  /** 拉线终点（屏幕边缘）坐标，以中线划分左右 */
  edgePosition?: {
    x: number
    y: number
  }
  /** 是否被其他物体遮挡 */
  occluded?: boolean
  /** 镜头聚焦参数，点击拉线时若有则聚焦至该机位 */
  camera?: LaxianCameraState
}