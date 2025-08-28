// effects/library/BubbleEffect.ts
import * as THREE from 'three'
import type { IEffect } from '@/types/EffectBase'

export default class BubbleEffect implements IEffect {
  id: string
  target: THREE.Object3D
  private scene: THREE.Scene
  private options: any
  private bubbles?: THREE.InstancedMesh
  private propsOptions: any
  private velocities: Float32Array
  private phases: Float32Array
  private dummy: THREE.Object3D

  constructor(target: THREE.Object3D, scene: THREE.Scene, options: any = {}) {
    this.id = 'BubbleEffect'
    this.target = target
    this.scene = scene
    this.options = Object.assign(
      { count: 50, size: 0.8, area: 80, height: 60 },
      options
    )
    this.propsOptions = options
    this.velocities = new Float32Array(this.options.count)
    this.phases = new Float32Array(this.options.count)
    this.dummy = new THREE.Object3D()
  }

  init() {
    console.log('添加')
    const geometry = new THREE.SphereGeometry(this.options.size, 16, 16)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x88ccff) },
        uFresnelPower: { value: 2.5 },
        uOpacity: { value: 0.6 },
        uTime: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
    
        void main() {
          // 每个实例独立弹性参数
          float freq = 1.0 + fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453) * 2.0;
          float phase = fract(sin(float(gl_InstanceID) * 78.233) * 43758.5453) * 6.2831;
    
          // 弹性缩放：Y 往复缩放，XZ 轻微反向缩放
          float scaleY = 0.85 + 0.15 * sin(uTime * freq + phase);
          float scaleXZ = 1.0 + 0.1 * sin(uTime * freq + phase + 3.1415/2.0);
    
          // 组合实例矩阵 + 缩放
          mat4 model = modelMatrix * instanceMatrix;
          vec4 worldPosition = model * vec4(position * vec3(scaleXZ, scaleY, scaleXZ), 1.0);
          vWorldPosition = worldPosition.xyz;
    
          mat3 normalMat = mat3(model);
          vNormal = normalize(normalMat * normal);
    
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uFresnelPower;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
    
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - dot(viewDir, normalize(vNormal)), uFresnelPower);
    
          vec3 bubbleColor = uColor * (0.6 + 0.4 * fresnel);
          float alpha = uOpacity * (0.2 + fresnel);
    
          gl_FragColor = vec4(bubbleColor, alpha);
          if (gl_FragColor.a < 0.05) discard;
        }
      `,
      transparent: true,
      depthWrite: false
    });
    
    
    

    this.bubbles = new THREE.InstancedMesh(
      geometry,
      material,
      this.options.count
    )
    this.bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    // 初始化气泡位置、速度、相位
    for (let i = 0; i < this.options.count; i++) {
      const x = (Math.random() - 0.5) * this.options.area
      const y = Math.random() * this.options.height - 40
      const z = (Math.random() - 0.5) * this.options.area
      this.dummy.position.set(x, y, z)

      this.velocities[i] = 0.3 + Math.random() * 0.8 // 上浮速度
      this.phases[i] = Math.random() * Math.PI * 2 // 摇摆初始相位

      const scale = 0.5 + Math.random() * 0.8
      this.dummy.scale.set(scale, scale, scale)

      this.dummy.updateMatrix()
      this.bubbles.setMatrixAt(i, this.dummy.matrix)
    }

    this.bubbles.userData.type = 'effect'
    this.bubbles.userData.effectName = this.id
    this.bubbles.userData.ignorePick = true
    this.bubbles.userData.options = this.propsOptions
    this.target.add(this.bubbles)
  }

  update(delta: number) {
    if (!this.bubbles) return
    (this.bubbles.material as THREE.ShaderMaterial).uniforms.uTime.value = delta * 10;
    for (let i = 0; i < this.options.count; i++) {
      this.bubbles.getMatrixAt(i, this.dummy.matrix)
      this.dummy.matrix.decompose(
        this.dummy.position,
        this.dummy.quaternion,
        this.dummy.scale
      )

      // 上浮
      this.dummy.position.y += this.velocities[i] * delta

      // 左右摇摆
      const sway = Math.sin(this.phases[i] + performance.now() * 0.001) * 0.002
      this.dummy.position.x += sway

      // 超出顶部 → 回到底部
      if (this.dummy.position.y > this.options.height) {
        this.dummy.position.y = -2
        this.dummy.position.x = (Math.random() - 0.5) * this.options.area
        this.dummy.position.z = (Math.random() - 0.5) * this.options.area
      }

      this.dummy.updateMatrix()
      this.bubbles.setMatrixAt(i, this.dummy.matrix)
    }

    this.bubbles.instanceMatrix.needsUpdate = true
  }

  dispose() {
    console.log('删除')
    if (this.bubbles) {
      this.target.remove(this.bubbles)
      this.bubbles.geometry.dispose()
      ;(this.bubbles.material as THREE.Material).dispose()
    }
  }
}
