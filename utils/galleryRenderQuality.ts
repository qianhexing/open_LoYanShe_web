import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type ThreeCore from '@/utils/threeCore'

/**
 * 展馆 3A 渲染增强：光照 / IBL / 阴影 / 色调 / 材质
 * 不改动场景 background 与地面网格（由 walkthrough 自行创建）
 */

export const GALLERY_LIGHT = {
  /**
   * 有/无点云共用同一套灯光，避免进店后明暗跳变。
   * 点云仅关闭 Bloom，用 exposureSplat 做小幅补偿（约 +8%）。
   */
  ambient: 0.28,
  ambientSplat: 0.28,
  hemi: 0.55,
  hemiSplat: 0.55,
  key: 1.28,
  keySplat: 1.28,
  fill: 0.36,
  fillSplat: 0.36,
  lens: 0.14,
  lensSplat: 0.14,
  exposure: 1.0,
  /** Bloom 关闭后的轻微提亮，过大易「太亮」 */
  exposureSplat: 1.08,
  bloomStrength: 0.28,
  bloomRadius: 0.38,
  bloomThreshold: 0.85,
  envIntensity: 0.48,
  envIntensitySplat: 0.48
} as const

export interface GalleryMapSize {
  width: number
  depth: number
}

export interface GalleryRenderHandles {
  envRT: THREE.WebGLRenderTarget | null
}

/** 让物体参与阴影 */
export function enableGalleryObjectShadows(
  root: THREE.Object3D,
  opts: { cast?: boolean; receive?: boolean } = {}
) {
  const cast = opts.cast ?? true
  const receive = opts.receive ?? true
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    const skipCast = mats.some(
      m =>
        m instanceof THREE.MeshBasicMaterial
        || m instanceof THREE.SpriteMaterial
        || Boolean((m as THREE.Material)?.transparent)
    )
    if (!skipCast) obj.castShadow = cast
    obj.receiveShadow = receive
  })
}

/** 微调 Standard/Physical 环境反射 */
export function polishGalleryMaterials(root: THREE.Object3D, envIntensity: number) {
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (
        mat instanceof THREE.MeshStandardMaterial
        || mat instanceof THREE.MeshPhysicalMaterial
      ) {
        mat.envMapIntensity = envIntensity
        if (typeof mat.roughness === 'number') {
          mat.roughness = THREE.MathUtils.clamp(mat.roughness * 0.92, 0.08, 1)
        }
        mat.needsUpdate = true
      }
    }
  })
}

/** 按地图尺寸收紧阴影锥 */
export function fitGalleryShadowCamera(
  light: THREE.DirectionalLight,
  map: GalleryMapSize,
  mobile: boolean
) {
  const half = Math.max(map.width, map.depth) * 0.55 + 2
  const cam = light.shadow.camera
  cam.near = 0.5
  cam.far = half * 4
  cam.left = -half
  cam.right = half
  cam.top = half
  cam.bottom = -half
  cam.updateProjectionMatrix()

  const elev = half * 1.35
  light.position.set(half * 0.72, elev, half * 0.48)
  light.target.position.set(0, 0, 0)
  light.target.updateMatrixWorld()

  light.shadow.bias = mobile ? -0.0015 : -0.0006
  light.shadow.normalBias = mobile ? 0.04 : 0.02
  light.shadow.radius = mobile ? 2.5 : 4
}

/** RoomEnvironment → PMREM */
export function createGalleryIBL(core: ThreeCore): THREE.WebGLRenderTarget | null {
  if (core.rendererBackend !== 'webgl') return null
  try {
    const gl = core.getWebGLRenderer()
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const room = new RoomEnvironment()
    const rt = pmrem.fromScene(room, 0.04)
    room.dispose()
    pmrem.dispose()
    return rt
  } catch (e) {
    console.warn('[gallery] IBL 环境生成失败', e)
    return null
  }
}

/**
 * 应用 3A 渲染设置。
 * 不修改 scene.background / fog / 地面。
 */
export function applyGalleryAaaRender(
  core: ThreeCore,
  opts: {
    map: GalleryMapSize
    withSplats: boolean
    mobile: boolean
    handles: GalleryRenderHandles
  }
): GalleryRenderHandles {
  const { map, withSplats, mobile } = opts
  const handles = opts.handles
  const L = GALLERY_LIGHT

  const cam = core.camera as THREE.PerspectiveCamera
  if (cam.isPerspectiveCamera) {
    cam.fov = mobile ? 52 : 46
    cam.near = 0.08
    cam.far = 220
    cam.updateProjectionMatrix()
  }

  if (!handles.envRT && !withSplats) {
    handles.envRT = createGalleryIBL(core)
  }
  if (handles.envRT) {
    core.scene.environment = handles.envRT.texture
    core.envMap = handles.envRT.texture
    core.envMapIntensity = withSplats ? L.envIntensitySplat : L.envIntensity
    core.setEnvironmentIntensity(withSplats ? L.envIntensitySplat : L.envIntensity)
  }

  if (core.lights) {
    const { ambient, hemisphere, directional, fill } = core.lights

    ambient.color.setHex(0xfff5f8)
    ambient.intensity = withSplats ? L.ambientSplat : L.ambient

    if (hemisphere) {
      hemisphere.color.setHex(0xffdce8)
      hemisphere.groundColor.setHex(0x3a2830)
      hemisphere.intensity = withSplats ? L.hemiSplat : L.hemi
    }

    directional.color.setHex(0xfff2e6)
    directional.intensity = withSplats ? L.keySplat : L.key
    directional.castShadow = true
    if (!directional.target.parent) {
      core.scene.add(directional.target)
    }
    fitGalleryShadowCamera(directional, map, mobile)

    if (fill) {
      fill.color.setHex(0xa8b8e0)
      fill.intensity = withSplats ? L.fillSplat : L.fill
      fill.position.set(-map.width * 0.4, map.depth * 0.35, -map.depth * 0.35)
      fill.castShadow = false
    }
  }

  if (core.lensLight) {
    core.lensLight.color.setHex(0xfff8f5)
    core.lensLight.intensity = withSplats ? L.lensSplat : L.lens
    core.lensLight.distance = 18
    core.lensLight.decay = 2
    core.lensLight.castShadow = false
  }

  core.setShadowQuality(mobile ? 'medium' : 'high')
  core.setShadowMapEnabled(true)

  // sync 会改写 toneMapping；必须在其后重新设定展馆曝光
  core.syncSceneColorSpaces()
  // 点云与网格统一 ACES，避免 Reinhard 中灰压暗；曝光已单独补偿 Bloom 关闭
  core.setToneMapping(
    withSplats ? L.exposureSplat : L.exposure,
    THREE.ACESFilmicToneMapping
  )

  if (withSplats) {
    // 点云与 EffectComposer 不兼容，关闭 Bloom；亮度靠 exposureSplat 补偿
    core.toggleBloom(false)
  } else {
    core.toggleBloom(true)
    core.setBloomParams(
      mobile ? L.bloomStrength * 0.75 : L.bloomStrength,
      L.bloomRadius,
      L.bloomThreshold
    )
  }

  return handles
}

export function disposeGalleryRenderHandles(handles: GalleryRenderHandles) {
  if (handles.envRT) {
    handles.envRT.dispose()
    handles.envRT = null
  }
}

/** 展台聚光（桌面） */
export function createExhibitSpot(
  pedH: number
): { light: THREE.SpotLight; target: THREE.Object3D } {
  const light = new THREE.SpotLight(0xfff4ec, 2.4, 9, Math.PI / 5.5, 0.42, 1.4)
  light.position.set(0.15, pedH + 2.35, 0.9)
  light.castShadow = true
  light.shadow.mapSize.set(512, 512)
  light.shadow.bias = -0.001
  light.shadow.normalBias = 0.03
  const target = new THREE.Object3D()
  target.position.set(0, pedH + 0.35, 0)
  light.target = target
  return { light, target }
}

/**
 * 程序化木地板：色图 + 粗糙度图（拼接地板条）
 * 返回的纹理需在场景销毁时 dispose
 */
export function createGalleryWoodFloorTextures(size = 512): {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
} {
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size

  const ctx = colorCanvas.getContext('2d')!
  const rctx = roughCanvas.getContext('2d')!

  const plankCount = 8
  const plankH = size / plankCount
  const baseTones = ['#c4a07a', '#b8956e', '#c9a882', '#ae8562', '#d0b08a']

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH
    const tone = baseTones[i % baseTones.length]
    ctx.fillStyle = tone
    ctx.fillRect(0, y, size, plankH + 1)

    // 木纹纤维
    for (let n = 0; n < 28; n++) {
      const gy = y + Math.random() * plankH
      const alpha = 0.04 + Math.random() * 0.1
      ctx.strokeStyle = `rgba(90, 55, 30, ${alpha})`
      ctx.lineWidth = 0.6 + Math.random() * 1.8
      ctx.beginPath()
      ctx.moveTo(0, gy)
      let x = 0
      while (x < size) {
        const nx = x + 18 + Math.random() * 30
        const ny = gy + (Math.random() - 0.5) * 3.5
        ctx.lineTo(nx, ny)
        x = nx
      }
      ctx.stroke()
    }

    // 板缝
    ctx.fillStyle = 'rgba(62, 38, 22, 0.55)'
    ctx.fillRect(0, y + plankH - 1.5, size, 1.5)

    // 错缝节点
    if (i % 2 === 1) {
      const seamX = size * (0.35 + (i % 3) * 0.12)
      ctx.fillStyle = 'rgba(62, 38, 22, 0.4)'
      ctx.fillRect(seamX, y, 1.5, plankH)
    }
  }

  // 轻微光泽斑
  const gloss = ctx.createLinearGradient(0, 0, size, size)
  gloss.addColorStop(0, 'rgba(255,245,230,0.06)')
  gloss.addColorStop(0.5, 'rgba(255,255,255,0)')
  gloss.addColorStop(1, 'rgba(80,45,25,0.08)')
  ctx.fillStyle = gloss
  ctx.fillRect(0, 0, size, size)

  // 粗糙度：板缝更糙，板面更滑
  rctx.fillStyle = '#a0a0a0'
  rctx.fillRect(0, 0, size, size)
  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH
    rctx.fillStyle = '#e8e8e8'
    rctx.fillRect(0, y + plankH - 2, size, 2)
    for (let n = 0; n < 12; n++) {
      rctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`
      rctx.fillRect(Math.random() * size, y + Math.random() * plankH, 40 + Math.random() * 80, 1)
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.anisotropy = 8

  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = THREE.RepeatWrapping
  roughnessMap.wrapT = THREE.RepeatWrapping
  roughnessMap.anisotropy = 4

  return { map, roughnessMap }
}

/** 按地图尺寸设置木纹 UV 重复（约每 2m 一条板宽视觉） */
export function configureGalleryWoodFloorRepeat(
  textures: { map: THREE.Texture; roughnessMap: THREE.Texture },
  mapWidth: number,
  mapDepth: number
) {
  const repeatX = Math.max(2, mapWidth / 2.2)
  const repeatY = Math.max(2, mapDepth / 2.2)
  textures.map.repeat.set(repeatX, repeatY)
  textures.roughnessMap.repeat.set(repeatX, repeatY)
  textures.map.needsUpdate = true
  textures.roughnessMap.needsUpdate = true
}
