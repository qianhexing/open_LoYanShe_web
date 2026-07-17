import * as THREE from 'three'
import type ThreeCore from '@/utils/threeCore'
import { BASE_IMG } from '@/utils/ipConfig'

export const GALLERY_PLAYER_MODEL_PATH = 'sence/role/role.glb'
export const GALLERY_PLAYER_IDLE_CLIP = 'Idle'
export const GALLERY_PLAYER_RUN_CLIP = 'Run'

const TARGET_HEIGHT = 1.65
const BLEND_SPEED = 10

function resolvePlayerModelUrl() {
  const base = BASE_IMG.endsWith('/') ? BASE_IMG.slice(0, -1) : BASE_IMG
  const path = GALLERY_PLAYER_MODEL_PATH.startsWith('/')
    ? GALLERY_PLAYER_MODEL_PATH.slice(1)
    : GALLERY_PLAYER_MODEL_PATH
  return `${base}/${path}`
}

function findClip(clips: THREE.AnimationClip[], name: string) {
  return clips.find(clip => clip.name === name) ?? null
}

/** 云看展玩家角色：Idle / Run 权重混合 */
export class GalleryPlayerController {
  readonly root: THREE.Group

  private readonly mixer: THREE.AnimationMixer
  private readonly idleAction: THREE.AnimationAction
  private readonly runAction: THREE.AnimationAction
  private runBlend = 0

  private constructor(
    root: THREE.Group,
    mixer: THREE.AnimationMixer,
    idleAction: THREE.AnimationAction,
    runAction: THREE.AnimationAction
  ) {
    this.root = root
    this.mixer = mixer
    this.idleAction = idleAction
    this.runAction = runAction
  }

  static async create(
    core: ThreeCore,
    scene: THREE.Scene
  ): Promise<GalleryPlayerController> {
    const modelUrl = resolvePlayerModelUrl()
    const model = await core.loadModel(modelUrl, {
      useDracoLoader: true,
      dracoDecoderPath: '/draco/gltf/',
      skipDefaultAnimations: true
    })

    const clips = core.getLoadedAnimationClips(modelUrl) ?? []
    const idleClip = findClip(clips, GALLERY_PLAYER_IDLE_CLIP)
    const runClip = findClip(clips, GALLERY_PLAYER_RUN_CLIP)
    if (!idleClip || !runClip) {
      throw new Error(
        `角色动画缺失，需要 ${GALLERY_PLAYER_IDLE_CLIP} 与 ${GALLERY_PLAYER_RUN_CLIP}`
      )
    }

    const group = new THREE.Group()
    group.userData.isGalleryPlayer = true

    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    if (size.y > 0) {
      model.scale.setScalar(TARGET_HEIGHT / size.y)
    }
    box.setFromObject(model)
    model.position.y -= box.min.y
    group.add(model)
    group.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        if (
          mat instanceof THREE.MeshStandardMaterial
          || mat instanceof THREE.MeshPhysicalMaterial
        ) {
          mat.envMapIntensity = 0.65
          mat.needsUpdate = true
        }
      }
    })
    scene.add(group)

    const mixer = new THREE.AnimationMixer(model)
    const idleAction = mixer.clipAction(idleClip)
    const runAction = mixer.clipAction(runClip)

    idleAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY).play()
    runAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY).play()
    idleAction.setEffectiveWeight(1)
    runAction.setEffectiveWeight(0)

    return new GalleryPlayerController(group, mixer, idleAction, runAction)
  }

  setTransform(x: number, z: number, yaw: number) {
    this.root.position.set(x, 0, z)
    this.root.rotation.y = yaw
  }

  /** 按移动状态更新 Idle / Run 权重并推进 mixer */
  update(delta: number, isMoving: boolean) {
    const target = isMoving ? 1 : 0
    this.runBlend += (target - this.runBlend) * Math.min(1, BLEND_SPEED * delta)
    this.idleAction.setEffectiveWeight(1 - this.runBlend)
    this.runAction.setEffectiveWeight(this.runBlend)
    this.mixer.update(delta)
  }

  dispose() {
    this.mixer.stopAllAction()
    this.root.parent?.remove(this.root)
    this.root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry?.dispose()
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of mats) {
        mat?.dispose()
      }
    })
  }
}
