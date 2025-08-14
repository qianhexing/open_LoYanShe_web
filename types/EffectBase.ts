// EffectBase.ts
import type * as THREE from 'three'

export interface EffectOptions {
  [key: string]: any
}

export interface IEffect {
  id: string
  target: THREE.Object3D
  init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void
  update(delta: number): void
  dispose(): void
}

export abstract class EffectBase implements IEffect {
  id: string
  target: THREE.Object3D

  constructor(id: string, target: THREE.Object3D) {
    this.id = id
    this.target = target
  }

  abstract init(scene: THREE.Scene,camera: THREE.Camera, renderer: THREE.WebGLRenderer): void
  abstract update(delta: number): void
  abstract dispose(): void
}
