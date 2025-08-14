// OutlineEffect.ts
import { EffectBase } from '@/types/EffectBase'
import * as THREE from 'three'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'

export class OutlineEffect extends EffectBase {
  private outlinePass: OutlinePass
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer

  init(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene
    this.renderer = renderer

    this.outlinePass = new OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      scene,
      this.renderer.camera
    )
    this.outlinePass.selectedObjects = [this.target]
    // 可以进一步设置 outlinePass 参数
  }

  update(delta: number) {
    // OutlinePass 自己会在渲染时生效，这里可做动态调整
  }

  dispose() {
    this.outlinePass.dispose()
  }
}
