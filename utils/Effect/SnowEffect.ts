// effects/library/SnowEffect.ts
import * as THREE from 'three';
import type { IEffect } from '@/types/EffectBase';

export default class SnowEffect implements IEffect {
  id: string;
  target: THREE.Object3D;
  private scene: THREE.Scene;
  private options: any;
  private particles?: THREE.Points;
  private propsOptions: any;

  constructor(target: THREE.Object3D, scene: THREE.Scene, options: any = {}) {
    this.id = 'SnowEffect';
    this.target = target;
    this.scene = scene;
    this.options = Object.assign({ count: 800, size: 0.1 }, options);
    this.propsOptions = options
  }

  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.options.count * 3);
    for (let i = 0; i < this.options.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 50 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.options.size
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.userData.type = 'effect'
    this.particles.userData.effectName = this.id
    this.particles.userData.options = this.propsOptions
    this.target.add(this.particles);
    console.log(this.target, '挂载对象')
  }

  update(delta: number) {
    if (!this.particles) return;
    const pos = this.particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) - delta * 1);
      if (pos.getY(i) < 0) pos.setY(i, Math.random() * 50 + 2);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    if (this.particles) {
      this.target.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
    }
  }
}
