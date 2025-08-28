// effects/library/BloomEffect.ts
import * as THREE from 'three'
import type { IEffect } from '@/types/EffectBase'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export default class BloomEffect implements IEffect {
  id: string
  public target: THREE.Object3D<THREE.Object3DEventMap>
  private scene: THREE.Scene
  private camera!: THREE.Camera
  private renderer!: THREE.WebGLRenderer
  private composer!: EffectComposer
  private bloomPass!: UnrealBloomPass

  constructor(target: THREE.Object3D, scene: THREE.Scene, options: any = {}) {
    this.id = 'BloomEffect'
    this.target = target
    this.scene = scene
    
  }

  init(scene: THREE.Scene,camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.camera = camera
    // 初始化 EffectComposer
    this.composer = new EffectComposer(this.renderer)

    // 基础渲染通道
    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    // 辉光通道
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // 强度
      0.4, // 半径
      0.85 // 阈值
    )
    this.composer.addPass(this.bloomPass)

    // 监听窗口大小
    window.addEventListener('resize', this.onResize)
  }

  update(delta: number) {
    if (this.composer) {
      this.composer.render()
    }
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose()
    }
    window.removeEventListener('resize', this.onResize)
  }

  private onResize = () => {
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight)
    }
  }

  /** 可选：提供一个接口动态修改辉光参数 */
  setParams({ strength, radius, threshold }: { strength?: number; radius?: number; threshold?: number }) {
    if (strength !== undefined) this.bloomPass.strength = strength
    if (radius !== undefined) this.bloomPass.radius = radius
    if (threshold !== undefined) this.bloomPass.threshold = threshold
  }
}
