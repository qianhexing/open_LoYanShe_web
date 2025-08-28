// 信号干扰效果
import * as THREE from 'three';
import type { IEffect } from '@/types/EffectBase';

export default class SignalInterferenceEffect implements IEffect {
  target: THREE.Mesh;
  id: string;
  originalMaterial: THREE.Material | THREE.Material[];
  material: THREE.ShaderMaterial;
  time: number = 0;
  constructor(mesh: THREE.Mesh) {
    this.target = mesh
    this.id = 'SignalInterference'
    // 保存原来的材质
    this.originalMaterial = mesh.material;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.2 }, // 干扰强度
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;

        float rand(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        void main() {
          vec3 color = vec3(1.0); // 原始亮度白色，可改为纹理采样
          
          // 电子干扰：竖向扫描线
          float scan = sin(vUv.y * 50.0 + uTime * 20.0) * 0.1;
          
          // 随机噪点干扰
          float noise = (rand(vUv + uTime) - 0.5) * uIntensity;
          
          vec3 finalColor = color + vec3(scan + noise);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
    });

    // 替换物体材质
    this.target.material = this.material;
  }

  init() {
    // 物体已经替换材质，无需额外添加
  }

  update(delta: number) {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;
  }

  dispose() {
    // 恢复原材质
    this.target.material = this.originalMaterial;
    this.material.dispose();
  }
}
