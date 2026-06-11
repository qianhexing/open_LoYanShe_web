import * as THREE from 'three'
import type ThreeCore from '@/utils/threeCore'
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig'
import { resolveGardenFlowerModel } from '@/utils/gardenFlowerDeco'
import { GARDEN_PLANT_MODELS } from '@/utils/gardenPlants'

const FLOWER_TARGET_HEIGHT = 1.35
const GROUND_Y = 0
const FLOWER_BATCH_SIZE = 30
const PICK_PROXY_RADIUS = 0.34
const SCENE_WHITE = 0xffffff
const TERRAIN_AMPLITUDE = 0.34
const GROUND_RADIUS = 34

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function terrainHeight(x: number, z: number) {
  const nx = x * 0.085
  const nz = z * 0.1
  const h1 = Math.sin(nx * 1.65 + nz * 1.25) * 0.52
  const h2 = Math.sin(nx * 3.2 - nz * 2.35 + 1.6) * 0.3
  const h3 = Math.sin(nx * 5.6 + nz * 4.8 + 0.8) * 0.14
  const radial = Math.hypot(x, z) / GROUND_RADIUS
  const edgeFade = 1 - smoothstep(0.72, 1, radial)
  return (h1 + h2 + h3) * TERRAIN_AMPLITUDE * edgeFade
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function hashUnit(input: string) {
  return (hashString(input) % 10000) / 10000
}

function resolveModelUrl(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${BASE_IMG}${normalized}`
}

function applyNeuTintToFlower(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.roughness = Math.max(material.roughness, 0.82)
      material.metalness = Math.min(material.metalness, 0.08)
      material.color.lerp(new THREE.Color(SCENE_WHITE), 0.04)
    }
  })
}

function disableFlowerShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = false
  })
}

function normalizeFlowerHeight(object: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  object.scale.multiplyScalar(targetHeight / maxDim)
}

function createPlaceholderTemplate(): FlowerTemplate {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0xb5ead7, roughness: 0.92, metalness: 0 })
  )
  stem.position.y = 0.28
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xff9eb5, roughness: 0.9, metalness: 0 })
  )
  head.position.y = 0.62

  const root = new THREE.Group()
  root.add(stem, head)
  normalizeFlowerHeight(root, FLOWER_TARGET_HEIGHT)
  root.updateMatrixWorld(true)

  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const parts: FlowerTemplatePart[] = []
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const localMatrix = new THREE.Matrix4()
    localMatrix.multiplyMatrices(inverseRoot, mesh.matrixWorld)
    parts.push({
      geometry: mesh.geometry,
      material: mesh.material as THREE.Material,
      localMatrix,
    })
  })

  const box = new THREE.Box3().setFromObject(root)
  return {
    url: '__placeholder__',
    parts,
    normalizedMinY: box.min.y,
  }
}

interface FlowerTemplatePart {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  localMatrix: THREE.Matrix4
}

interface FlowerTemplate {
  url: string
  parts: FlowerTemplatePart[]
  normalizedMinY: number
}

interface UrlLayer {
  url: string
  template: FlowerTemplate
  parts: THREE.InstancedMesh[]
  count: number
}

export interface FlowerFocusTarget {
  position: THREE.Vector3
  targetHeight: number
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export class GardenFlowerInstancer {
  readonly displayGroup = new THREE.Group()
  readonly pickGroup = new THREE.Group()

  private templateCache = new Map<string, FlowerTemplate>()
  private urlLayers = new Map<string, UrlLayer>()
  private pickTargets: THREE.Object3D[] = []
  private readonly pickGeometry: THREE.CylinderGeometry
  private readonly pickMaterial: THREE.MeshBasicMaterial
  private readonly dummy = new THREE.Object3D()
  private readonly partMatrix = new THREE.Matrix4()
  private readonly maxCapacity: number
  private disposed = false

  constructor(maxCapacity: number) {
    this.maxCapacity = maxCapacity
    this.displayGroup.name = 'FlowerInstances'
    this.pickGroup.name = 'FlowerPickProxies'
    this.pickGeometry = new THREE.CylinderGeometry(
      PICK_PROXY_RADIUS,
      PICK_PROXY_RADIUS,
      1,
      8
    )
    this.pickMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  }

  getPickTargets(): readonly THREE.Object3D[] {
    return this.pickTargets
  }

  private async loadTemplate(url: string, core: ThreeCore): Promise<FlowerTemplate> {
    const cached = this.templateCache.get(url)
    if (cached) return cached

    if (!url) {
      const placeholder = createPlaceholderTemplate()
      this.templateCache.set(url, placeholder)
      return placeholder
    }

    try {
      const model = await core.loadModel(resolveModelUrl(url), {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/',
      })
      applyNeuTintToFlower(model)
      disableFlowerShadows(model)
      normalizeFlowerHeight(model, FLOWER_TARGET_HEIGHT)
      model.updateMatrixWorld(true)

      const inverseRoot = new THREE.Matrix4().copy(model.matrixWorld).invert()
      const parts: FlowerTemplatePart[] = []
      model.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh || !mesh.geometry) return
        const localMatrix = new THREE.Matrix4()
        localMatrix.multiplyMatrices(inverseRoot, mesh.matrixWorld)
        parts.push({
          geometry: mesh.geometry,
          material: mesh.material as THREE.Material,
          localMatrix,
        })
      })

      const box = new THREE.Box3().setFromObject(model)
      const template: FlowerTemplate = {
        url,
        parts,
        normalizedMinY: box.min.y,
      }
      this.templateCache.set(url, template)
      return template
    } catch (error) {
      console.warn('花朵模型加载失败，使用占位:', url, error)
      const fallback = createPlaceholderTemplate()
      fallback.url = url
      this.templateCache.set(url, fallback)
      return fallback
    }
  }

  private ensureLayer(url: string, template: FlowerTemplate): UrlLayer {
    const existing = this.urlLayers.get(url)
    if (existing) return existing

    const parts = template.parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, this.maxCapacity)
      mesh.frustumCulled = true
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.count = 0
      mesh.userData.ignorePick = true
      this.displayGroup.add(mesh)
      return mesh
    })

    const layer: UrlLayer = { url, template, parts, count: 0 }
    this.urlLayers.set(url, layer)
    return layer
  }

  private computeRootMatrix(
    bedPos: THREE.Vector3,
    index: number,
    template: FlowerTemplate,
    plantScale: number,
    targetHeight: number
  ) {
    const scaleJitter = 0.92 + hashUnit(`flower-${index}`) * 0.14
    const heightRatio = targetHeight / FLOWER_TARGET_HEIGHT
    const totalScale = (plantScale || 1) * scaleJitter * heightRatio

    this.dummy.position.set(0, 0, 0)
    this.dummy.rotation.set(0, 0, 0)
    this.dummy.scale.setScalar(totalScale)
    this.dummy.rotation.y =
      (hashString(`${bedPos.x},${bedPos.z}`) % 360) * (Math.PI / 180)

    const surfaceY = GROUND_Y + terrainHeight(bedPos.x, bedPos.z)
    this.dummy.position.set(
      bedPos.x,
      surfaceY - template.normalizedMinY * totalScale,
      bedPos.z
    )
    this.dummy.updateMatrix()
    return this.dummy.matrix.clone()
  }

  private writeInstance(layer: UrlLayer, instanceId: number, rootMatrix: THREE.Matrix4) {
    for (let partIndex = 0; partIndex < layer.parts.length; partIndex++) {
      this.partMatrix.multiplyMatrices(
        rootMatrix,
        layer.template.parts[partIndex].localMatrix
      )
      layer.parts[partIndex].setMatrixAt(instanceId, this.partMatrix)
    }
  }

  private flushLayer(layer: UrlLayer) {
    for (const mesh of layer.parts) {
      mesh.count = layer.count
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  private addPickProxy(
    bedPos: THREE.Vector3,
    commentId: number,
    targetHeight: number
  ) {
    const surfaceY = GROUND_Y + terrainHeight(bedPos.x, bedPos.z)
    const proxy = new THREE.Mesh(this.pickGeometry, this.pickMaterial)
    proxy.position.set(bedPos.x, surfaceY + targetHeight * 0.45, bedPos.z)
    proxy.scale.y = Math.max(targetHeight * 0.9, 0.6)
    proxy.userData.comment_id = commentId
    this.pickGroup.add(proxy)
    this.pickTargets.push(proxy)
  }

  async addRange(
    core: ThreeCore,
    startIndex: number,
    endIndex: number,
    bedPositions: THREE.Vector3[],
    flowerTypes?: string[],
    flowerCommentIds?: number[],
    plantTypeIndex?: number
  ): Promise<FlowerFocusTarget | null> {
    if (this.disposed || endIndex <= startIndex) return null

    let lastFocus: FlowerFocusTarget | null = null
    const dirtyLayers = new Set<UrlLayer>()

    for (let index = startIndex; index < endIndex; index++) {
      if (index > startIndex && (index - startIndex) % FLOWER_BATCH_SIZE === 0) {
        for (const layer of dirtyLayers) this.flushLayer(layer)
        dirtyLayers.clear()
        await nextFrame()
        if (this.disposed) return lastFocus
      }

      const bedPos = bedPositions[index]
      if (!bedPos) continue

      const plant =
        flowerTypes?.[index] != null && flowerTypes[index] !== ''
          ? resolveGardenFlowerModel(flowerTypes[index], index)
          : plantTypeIndex != null
            ? resolveGardenFlowerModel(
                GARDEN_PLANT_MODELS[plantTypeIndex]?.id,
                plantTypeIndex
              )
            : resolveGardenFlowerModel(undefined, index)

      const template = await this.loadTemplate(plant.url || '', core)
      const layer = this.ensureLayer(plant.url || template.url, template)
      const instanceId = layer.count
      if (instanceId >= this.maxCapacity) {
        console.warn('[GardenFlowerInstancer] 已达实例上限，跳过剩余花朵')
        break
      }

      const targetHeight = plant.targetHeight ?? FLOWER_TARGET_HEIGHT
      const rootMatrix = this.computeRootMatrix(
        bedPos,
        index,
        template,
        plant.scale ?? 1,
        targetHeight
      )
      this.writeInstance(layer, instanceId, rootMatrix)
      layer.count += 1
      dirtyLayers.add(layer)

      const commentId = Number(flowerCommentIds?.[index])
      if (Number.isFinite(commentId) && commentId > 0) {
        this.addPickProxy(bedPos, commentId, targetHeight)
      }

      lastFocus = {
        position: bedPos.clone(),
        targetHeight,
      }
    }

    for (const layer of dirtyLayers) this.flushLayer(layer)
    return lastFocus
  }

  clear() {
    for (const layer of this.urlLayers.values()) {
      for (const mesh of layer.parts) {
        mesh.count = 0
        mesh.instanceMatrix.needsUpdate = true
      }
      layer.count = 0
    }

    while (this.pickGroup.children.length > 0) {
      this.pickGroup.remove(this.pickGroup.children[0])
    }
    this.pickTargets = []
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.clear()

    for (const layer of this.urlLayers.values()) {
      for (const mesh of layer.parts) {
        this.displayGroup.remove(mesh)
      }
    }
    this.urlLayers.clear()
    this.templateCache.clear()

    this.pickGeometry.dispose()
    this.pickMaterial.dispose()
  }
}
