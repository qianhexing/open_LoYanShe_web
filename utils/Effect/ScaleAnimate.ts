// effects/ScaleAnimate.ts
import type * as THREE from 'three'
import type { IEffect } from '@/types/EffectBase'

export default class ScaleAnimate implements IEffect {
  private speed: number
  private maxScale: number
  private direction = 1
  id: string
  target: THREE.Object3D<THREE.Object3DEventMap>

  // 这里保存引用，方便 dispose 时做清理
  private _scene!: THREE.Scene
  private _camera!: THREE.Camera
  private _renderer!: THREE.WebGLRenderer

  constructor(target: THREE.Object3D,
    scene: THREE.Scene,
    options: Record<string, any> = {}) {
    this.id = options.id || 0
    this.target = target
    this.speed = options.speed ?? 1
    this.maxScale = options.maxScale ?? 2
  }

  init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this._scene = scene
    this._camera = camera
    this._renderer = renderer

    // 这里可以做额外的初始化，例如添加一个辅助 gizmo
    // const helper = new THREE.BoxHelper(this.target, 0xff0000)
    // this._scene.add(helper)
  }

  update(delta: number): void {
    const scale = this.target.scale.x + this.direction * this.speed * delta
    if (scale > this.maxScale) this.direction = -1
    if (scale < 1) this.direction = 1
    this.target.scale.setScalar(scale)
  }

  dispose(): void {
    // 如果 init 里有添加辅助物体或事件，这里要清理
    // this._scene.remove(helper)
    // helper.geometry.dispose()
    // (helper.material as THREE.Material).dispose()

    // 这里因为只是修改 target 的 scale，不需要额外清理
    this.target.scale.setScalar(1) // 恢复到初始状态（可选）
  }
}
