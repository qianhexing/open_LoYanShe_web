// Effect/ToonOutlineEffect.ts
// 3渲2风格描边特效 (兼容 EffectManager)

import * as THREE from 'three'
import type { IEffect } from '@/types/EffectBase'
import type { SceneEffectJSON } from '@/utils/threeCore'

export default class ToonOutlineEffect implements IEffect {
  public id = 'ToonOutlineEffect'
  public enabled = true

  public target: THREE.Object3D
  private scene: THREE.Scene
  private options: Record<string, any>

  private camera!: THREE.Camera
  private renderer!: THREE.WebGLRenderer

  private outlineColor: THREE.Color
  private opacity: number
  private pixelWidth: number
  private onlyOpaque: boolean
  private ignoreNames: string[]

  private outlineMap = new Map<THREE.Mesh, THREE.Mesh>()
  private sizeCache = new THREE.Vector2()
  private _sphere = new THREE.Sphere()

  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    options: Record<string, any> = {}
  ) {
    this.target = target
    this.scene = scene
    this.options = options

    this.outlineColor = new THREE.Color(options.color ?? '#111318')
    this.opacity = options.opacity ?? 1.0
    this.pixelWidth = options.pixelWidth ?? 2.0
    this.onlyOpaque = options.onlyOpaque ?? true
    this.ignoreNames = options.ignoreNames ?? []
  }

  init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.camera = camera
    this.renderer = renderer

    this.attach(this.target)
  }

  update(delta: number) {
    if (!this.enabled) return
    if (!this.camera) return

    const cam = this.camera as THREE.PerspectiveCamera
    this.renderer.getSize(this.sizeCache)
    const viewportH = Math.max(1, this.sizeCache.y)

    this.outlineMap.forEach((outline, srcMesh) => {
      if (!srcMesh.geometry || !outline.visible) return
      srcMesh.geometry.computeBoundingSphere()
      const sphere = srcMesh.geometry.boundingSphere
      if (!sphere) return

      this._sphere.copy(sphere)
      this._sphere.applyMatrix4(srcMesh.matrixWorld)
      const camPos = (this.camera as any).position as THREE.Vector3
      const dist = Math.max(0.001, camPos.distanceTo(this._sphere.center))

      let worldUnitsPerPixel = 0.005
      if (cam.isPerspectiveCamera) {
        const fovRad = THREE.MathUtils.degToRad(cam.fov)
        worldUnitsPerPixel = (2 * Math.tan(fovRad / 2) * dist) / viewportH
      } else {
        const top = (this.camera as THREE.OrthographicCamera).top
        const bottom = (this.camera as THREE.OrthographicCamera).bottom
        worldUnitsPerPixel = Math.abs((top - bottom) / viewportH)
      }

      const thicknessWorld = this.pixelWidth * worldUnitsPerPixel
      const mat = outline.material as THREE.ShaderMaterial
      mat.uniforms.uThickness.value = thicknessWorld
    })
  }

  dispose() {
    this.detach(this.target)
  }

  // Attach: 遍历目标，创建 outline 并放入与 src 同级（避免将 outline 添加为 src 的子节点，防止 updateMatrixWorld 递归）
  private attach(root: THREE.Object3D) {
    root.traverse(obj => {
      if (!('isMesh' in obj) || !(obj as any).isMesh) return
      const mesh = obj as THREE.Mesh
      if (this.shouldIgnore(mesh)) return
      const outline = this.createOutlineFor(mesh)
      if (outline) {
        outline.userData.type = 'effect'
        outline.userData.type = 'effect'
        outline.userData.effectName = this.id
        outline.userData.options = this.options
        // 添加到源节点的父级（或场景）中，作为同级节点，而不是 src 的子项
        const targetParent = mesh.parent ?? this.scene
        targetParent.add(outline)
        this.outlineMap.set(mesh, outline)
      }
    })
    if (this.target.userData.effect) {
      this.target.userData.effect.push({
        type: 'effect',
        effect_name: this.id,
        options: this.options
      })
    }
  }

  // Detach: 从 outlineMap 中移除并从其父级删除
  private detach(root: THREE.Object3D) {
    root.traverse(obj => {
      if (!('isMesh' in obj) || !(obj as any).isMesh) return
      const mesh = obj as THREE.Mesh
      const outline = this.outlineMap.get(mesh)
      if (outline) {
        if (outline.parent) outline.parent.remove(outline)
        this.disposeOutline(outline)
        this.outlineMap.delete(mesh)
      }
    })
    const index = this.target.userData.effect.findIndex((item: SceneEffectJSON) => {
      item.effect_name === this.id
    })
    if (index !== -1) {
      this.target.userData.effect.splice(index, 1)
    }
  }

  private shouldIgnore(mesh: THREE.Mesh) {
    const name = mesh.name || ''
    if (this.ignoreNames.some(k => name.includes(k))) return true
    if (!mesh.geometry) return true
    const mat = mesh.material as THREE.Material | THREE.Material[]
    if (this.onlyOpaque) {
      const isOpaque = (m: THREE.Material) => !(m as any).transparent
      if (Array.isArray(mat)) {
        if (!mat.some(isOpaque)) return true
      } else if (!isOpaque(mat)) return true
    }
    return false
  }

  private createOutlineFor(src: THREE.Mesh): THREE.Mesh | null {
    if (!src.geometry) return null

    const isSkinned = (src as any).isSkinnedMesh === true

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uThickness: { value: 0.01 },
        uColor: { value: this.outlineColor.clone() },
        uAlpha: { value: this.opacity },
      },
      vertexShader: /* glsl */`
        uniform float uThickness;
        varying vec3 vViewNormal;

        #ifdef USE_SKINNING
          uniform mat4 bindMatrix;
          uniform mat4 bindMatrixInverse;
          uniform mat4 boneMatrices[ MAX_BONES ];
        #endif

        void main(){
          vec3 transformed = position;
          vec3 objectNormal = normal;

          #ifdef USE_SKINNING
            mat4 boneMatX = boneMatrices[ int(skinIndex.x) ];
            mat4 boneMatY = boneMatrices[ int(skinIndex.y) ];
            mat4 boneMatZ = boneMatrices[ int(skinIndex.z) ];
            mat4 boneMatW = boneMatrices[ int(skinIndex.w) ];
            vec4 skinned = vec4(0.0);
            skinned += boneMatX * vec4( transformed, 1.0 ) * skinWeight.x;
            skinned += boneMatY * vec4( transformed, 1.0 ) * skinWeight.y;
            skinned += boneMatZ * vec4( transformed, 1.0 ) * skinWeight.z;
            skinned += boneMatW * vec4( transformed, 1.0 ) * skinWeight.w;
            vec4 mvPos = modelViewMatrix * skinned;

            vec4 skinnedNormal4 = vec4(0.0);
            skinnedNormal4 += boneMatX * vec4( objectNormal, 0.0 ) * skinWeight.x;
            skinnedNormal4 += boneMatY * vec4( objectNormal, 0.0 ) * skinWeight.y;
            skinnedNormal4 += boneMatZ * vec4( objectNormal, 0.0 ) * skinWeight.z;
            skinnedNormal4 += boneMatW * vec4( objectNormal, 0.0 ) * skinWeight.w;
            vec3 viewNormal = normalize( ( viewMatrix * skinnedNormal4 ).xyz );
          #else
            vec4 mvPos = modelViewMatrix * vec4( transformed, 1.0 );
            vec3 viewNormal = normalize( ( modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz );
          #endif

          // 反向外壳：沿视图空间法线外扩
          mvPos.xyz += viewNormal * uThickness;
          vViewNormal = viewNormal;

          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uAlpha;
        varying vec3 vViewNormal;
        void main(){
          float a = uAlpha;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      side: THREE.BackSide,
      transparent: this.opacity < 1.0,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      skinning: isSkinned,
      morphTargets: (src as any).morphTargetInfluences !== undefined,
      morphNormals: (src as any).morphTargetInfluences !== undefined,
      toneMapped: false,
    })

    // 如果是 SkinnedMesh，创建 SkinnedMesh 并绑定原骨骼；否则创建普通 Mesh
    let outline: THREE.Mesh
    if (isSkinned) {
      // 使用 any 以避免类型冲突
      const SkinnedMeshClass = (THREE as any).SkinnedMesh as typeof THREE.SkinnedMesh
      outline = new SkinnedMeshClass(src.geometry, mat) as THREE.SkinnedMesh
      try {
        if ((src as any).skeleton) {
          ;(outline as any).bind((src as any).skeleton, (src as any).bindMatrix)
        }
      } catch (e) {
        // 绑定失败也不要抛出异常，继续使用普通 mesh 回退
        console.warn('ToonOutlineEffect: 绑定骨骼失败，使用普通 Mesh 回退', e)
      }
    } else {
      outline = new THREE.Mesh(src.geometry, mat)
    }

    outline.name = `${src.name || 'mesh'}__outline`
    outline.matrixAutoUpdate = false

    // NOTE: 不将 outline 添加为 src 的子节点（会导致 updateMatrixWorld 递归/栈溢出），
    //       而是把它作为 src 的同级（src.parent 或 scene）加入。

    const self = this
    // biome-ignore lint/complexity/useArrowFunction: <explanation>
    outline.onBeforeRender = function () {
      // 同步可见性
      outline.visible = src.visible && self.enabled
      // 直接拷贝世界矩阵以确保在渲染时位置正确（避免依赖 updateMatrixWorld 的顺序问题）
      // 这不会触发矩阵更新函数，只是简单赋值。
      outline.matrix.copy(src.matrix)
      outline.matrixWorld.copy(src.matrixWorld)
      outline.renderOrder = (src.renderOrder ?? 0) + 0.1
    }

    return outline
  }

  private disposeOutline(outline: THREE.Mesh) {
    // 从父节点移除（如果尚未移除）
    if (outline.parent) outline.parent.remove(outline)
    const m = outline.material as THREE.ShaderMaterial
    m.dispose()
    // 注意：geometry 是共享的，**不要**在这里 dispose()
  }
}
