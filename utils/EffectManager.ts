// EffectManager.ts
import type { IEffect, EffectBase } from '../types/EffectBase'
import type * as THREE from 'three'

export class EffectManager {
  public effects: Map<string, IEffect> = new Map();
  private effectsMap = new Map<THREE.Object3D, IEffect[]>()
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private renderer: THREE.WebGLRenderer
  ) {}
  async addEffect(
    type: string,                // 特效类型，例如 "SnowEffect"
    target: THREE.Object3D,      // 绑定的物体
    options: Record<string, any> = {}
  ) {

    if (this.effects.has(type)) {
      if (options.onlyOne) {
        console.warn(`Effect ${type} 已经存在，先移除再添加`);
        this.removeEffect(target, type);
      }
    }

    // 动态加载特效类
    const module = await import(`./Effect/${type}.ts`);
    const EffectClass = module.default;

    const effect: IEffect = new EffectClass(target, this.scene, options);
    if (!this.effectsMap.has(target)) {
      this.effectsMap.set(target, [])
    }
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    this.effectsMap.get(target)!.push(effect)
    this.effects.set(effect.id, effect);

    effect.init(this.scene, this.camera, this.renderer);

    console.log(`✅ 添加特效: ${type}`);
    return effect;
  }
  removeEffectById(typeOrId: string) {
    const effect = this.effects.get(typeOrId);
    if (!effect) return;
    effect.dispose();
    this.effects.delete(typeOrId);
  }
  removeEffect(target: THREE.Object3D, effectId: string) {
    const list = this.effectsMap.get(target)
    if (!list) return
    const idx = list.findIndex(e => e.id === effectId)
    if (idx >= 0) {
      list[idx].dispose()
      list.splice(idx, 1)
    }
  }

  
  removeAllEffects(target: THREE.Object3D) {
    const list = this.effectsMap.get(target)
    if (list) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      list.forEach(e => e.dispose())
      this.effectsMap.delete(target)
    }
  }

  update(delta: number) {
    for (const effect of this.effects.values()) {
      effect.update(delta);
    }
  }
}
