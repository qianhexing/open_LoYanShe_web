import type { Object3D } from "three"

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
