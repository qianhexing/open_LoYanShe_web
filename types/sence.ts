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