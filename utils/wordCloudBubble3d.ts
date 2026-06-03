import * as THREE from 'three'
import ThreeCore from '@/utils/threeCore'
import { BASE_IMG_MODEL as BASE_IMG } from '@/utils/ipConfig'
import { resolveGardenFlowerModel } from '@/utils/gardenFlowerDeco'
import { buildWordCloudRankColorMap } from '@/utils/lolitaHeatGradient'
import {
  GARDEN_PLANT_MODELS,
  MAX_GARDEN_FLOWER_COUNT,
  resolvePlantIndex,
  type GardenPlantModel,
} from '@/utils/gardenPlants'

export {
  GARDEN_PLANT_MODELS,
  MAX_GARDEN_FLOWER_COUNT,
  DEFAULT_GARDEN_PLANT_ID,
  parseCommentFlowerType,
  resolvePlantIndex,
  type CommentGardenJsonData,
  type GardenPlantModel,
} from '@/utils/gardenPlants'

export interface WordCloudDatum {
  name: string
  value: number
}

/** @deprecated 使用 GardenPlantModel */
export type GardenFlowerModel = Pick<GardenPlantModel, 'url'> & Partial<GardenPlantModel>

export type GardenDecoKind = 'rock' | 'tree' | 'bush' | 'misc'

export interface GardenDecoModel {
  url: string
  kind: GardenDecoKind
  /** 目标高度（世界单位） */
  targetHeight?: number
  /** 额外缩放 */
  scale?: number
  /** 该模型放置数量 */
  count?: number
}

/** @deprecated 使用 GARDEN_PLANT_MODELS（来自 @/utils/gardenPlants） */
export const GARDEN_FLOWER_MODELS = GARDEN_PLANT_MODELS

export interface GardenSceneData {
  words: WordCloudDatum[]
  /** 今日评论数，1 条评论 = 1 株植物 */
  flowerCount: number
  /** 与评论顺序对齐，每项为 GARDEN_PLANT_MODELS.id */
  flowerTypes?: string[]
  /** 与评论顺序对齐，每项为 comment_id */
  flowerCommentIds?: number[]
  /** @deprecated 全局单一植物类型；优先使用 flowerTypes */
  plantTypeIndex?: number
}

/** 花园装饰 GLB：石块、树木等，按 count 散布在圆柱外围 */
export const GARDEN_DECO_MODELS: ReadonlyArray<GardenDecoModel> = [
  // { url: '/sence/3.glb', kind: 'rock', targetHeight: 0.52, count: 5 },
  { url: 'material/9d2e41255c0768cb2928f3e230ec769b.glb', kind: 'rock', targetHeight: 0.38, scale: 0.92, count: 4 },
  // { url: '/sence/8.glb', kind: 'tree', targetHeight: 2.6, count: 4 },
  // { url: '/sence/9.glb', kind: 'tree', targetHeight: 2.1, scale: 0.88, count: 3 },
  // { url: '/sence/5.glb', kind: 'bush', targetHeight: 1.05, count: 4 },
]

const DECO_DEFAULT_HEIGHT: Record<GardenDecoKind, number> = {
  rock: 0.48,
  tree: 2.4,
  bush: 0.95,
  misc: 1.1,
}

const GROUND_Y = 0
const CYLINDER_RADIUS = 10.5
const FLOWER_TARGET_HEIGHT = 1.35
/** 词云底部与种花区域的净空（需高于 FLOWER_TARGET_HEIGHT） */
const WORD_GROUND_GAP = 3.5
const WORD_LIFT_MAX = 7.0
const WORD_FONT_SIZE = 18
const WORD_COUNT_FONT_SIZE = 9
const WORD_LABEL_WORLD_HEIGHT = 0.82
const WORD_LAYOUT_SIZE = 0.88
const WORD_XZ_MARGIN = 0.65
const WORD_Y_MIN = GROUND_Y + WORD_GROUND_GAP + WORD_LABEL_WORLD_HEIGHT * 0.5
/** 圆柱顶面：最高词 + 文字半高 + 浮动余量 */
const CYLINDER_TOP = GROUND_Y + WORD_LIFT_MAX + WORD_LABEL_WORLD_HEIGHT * 0.55
const CYLINDER_BOTTOM = GROUND_Y
const FLOWER_XZ_MARGIN = 0.75
const SCENE_WHITE = 0xffffff
const GRASS_TEXTURE_URL = '/textures/grass.jpg'
const GROUND_RADIUS = 34
/** 草地凹凸幅度与网格精度 */
const TERRAIN_AMPLITUDE = 0.34
const TERRAIN_SEGMENTS = 64
const FOG_COLOR = 0xf5fbff
const FOG_DENSITY = 0.028
const CLOUD_COUNT = 7
/** 圆柱范围线框（调试用，改为 true 可重新显示） */
const SHOW_CYLINDER_DEBUG = false

/** 拟态配色（与 sign-in-page neu-page 一致） */
const NEU = {
  base: 0xe5dce2,
  raised: 0xebe3e8,
  dent: 0xe4d9e0,
  highlight: 0xfff9fc,
  shadow: 0xc4b0ba,
  shadowDeep: 0x967e8a,
  primary: 0xff9eb5,
  secondary: 0xa5d8ff,
  accent: 0xb5ead7,
  tertiary: 0xffdac1,
} as const

export interface WordCloudBubble3DCallbacks {
  onWordClick?: (word: string) => void
  onWordHover?: (word: string | null) => void
  onFlowerClick?: (commentId: number) => void
  onFlowerHover?: (commentId: number | null) => void
}

type GardenPickTarget =
  | { kind: 'word'; word: string }
  | { kind: 'flower'; commentId: number }

export function buildFlowerMetaKey(
  types: string[] | undefined,
  commentIds: number[] | undefined,
  count: number
): string {
  return Array.from({ length: count }, (_, index) => {
    const commentId = commentIds?.[index] ?? 0
    const typeId = types?.[index] ?? ''
    return `${commentId}\0${typeId}`
  }).join('\n')
}

function findFlowerCommentId(object: THREE.Object3D): number | null {
  let node: THREE.Object3D | null = object
  while (node) {
    const commentId = Number(node.userData?.comment_id)
    if (Number.isFinite(commentId) && commentId > 0) return commentId
    node = node.parent
  }
  return null
}

const PETAL_COLORS = [
  NEU.raised, NEU.dent, NEU.primary, NEU.secondary, NEU.accent, NEU.tertiary,
] as const

const AMBIENT_COUNT = 40

interface WordEntry {
  group: THREE.Group
  label: THREE.Sprite
  basePosition: THREE.Vector3
  phase: number
  freq: number
  word: string
  size: number
  targetScale: number
  currentScale: number
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function resolveModelUrl(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${BASE_IMG}${normalized}`
}

/** 将点限制在 Y 轴圆柱内（可选 XZ / Y 边距） */
function clampIntoCylinder(
  position: THREE.Vector3,
  options: { xzMargin?: number; yMin?: number; yMax?: number } = {}
) {
  const xzMargin = options.xzMargin ?? 0
  const yMin = options.yMin ?? CYLINDER_BOTTOM
  const yMax = options.yMax ?? CYLINDER_TOP
  position.y = THREE.MathUtils.clamp(position.y, yMin, yMax)
  const maxR = Math.max(CYLINDER_RADIUS - xzMargin, 0.05)
  const dist = Math.hypot(position.x, position.z)
  if (dist > maxR) {
    const scale = maxR / dist
    position.x *= scale
    position.z *= scale
  }
  return position
}

function wordXzMargin(text?: string) {
  const extra = text ? Math.min(text.length * 0.07, 1.4) : 0
  return WORD_XZ_MARGIN + extra
}

function createCylinderDebugHelper(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'CylinderDebug'
  group.userData.ignorePick = true

  const height = CYLINDER_TOP - CYLINDER_BOTTOM
  const centerY = (CYLINDER_TOP + CYLINDER_BOTTOM) * 0.5

  const shellGeo = new THREE.CylinderGeometry(
    CYLINDER_RADIUS,
    CYLINDER_RADIUS,
    height,
    48,
    1,
    true
  )
  const shellEdges = new THREE.EdgesGeometry(shellGeo)
  shellGeo.dispose()

  const shellLines = new THREE.LineSegments(
    shellEdges,
    new THREE.LineBasicMaterial({
      color: 0xff6b9d,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  )
  shellLines.position.y = centerY
  group.add(shellLines)

  const addRing = (y: number, color: number, radius = CYLINDER_RADIUS) => {
    const points: THREE.Vector3[] = []
    const segments = 72
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    group.add(
      new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      )
    )
  }

  addRing(CYLINDER_BOTTOM, 0xff9eb5)
  addRing(CYLINDER_TOP, 0xff9eb5)
  addRing(WORD_Y_MIN, 0x5c8fb8)

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const x = Math.cos(angle) * CYLINDER_RADIUS
    const z = Math.sin(angle) * CYLINDER_RADIUS
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, CYLINDER_BOTTOM, z),
      new THREE.Vector3(x, CYLINDER_TOP, z),
    ])
    group.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0xff6b9d,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      )
    )
  }

  return group
}

function hashUnit(input: string) {
  return (hashString(input) % 10000) / 10000
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 圆柱内错落高度：hash 主导，与词频无关 */
function computeWordLiftY(name: string) {
  const yTop = CYLINDER_TOP - wordXzMargin() * 0.35
  const yBottom = WORD_Y_MIN
  const span = Math.max(yTop - yBottom, 0.5)

  const u1 = hashUnit(`${name}-y1`)
  const u2 = hashUnit(`${name}-y2`)
  const u3 = hashUnit(`${name}-y3`)
  const noise = THREE.MathUtils.clamp(u1 * 0.5 + u2 * 0.32 + u3 * 0.18, 0, 1) ** 0.78
  const wave = Math.sin(hashString(name) * 0.011 + u2 * Math.PI * 2) * 0.22
  return yBottom + span * THREE.MathUtils.clamp(noise + wave, 0.04, 0.96)
}

function computeWordXzOffset(name: string) {
  const angle = hashUnit(`${name}-wa`) * Math.PI * 2
  const radius = hashUnit(`${name}-wr`) ** 0.62 * 2.6
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  }
}

function refineVerticalSpacing(
  wordPositions: THREE.Vector3[],
  texts: string[]
) {
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < wordPositions.length; i++) {
      for (let j = i + 1; j < wordPositions.length; j++) {
        const dy = wordPositions[i].y - wordPositions[j].y
        const minDy = WORD_LABEL_WORLD_HEIGHT * 0.72 + 0.55
        if (Math.abs(dy) >= minDy) continue
        const push = (minDy - Math.abs(dy)) * 0.42
        const dir = dy >= 0 ? 1 : -1
        wordPositions[i].y += push * dir * 0.5
        wordPositions[j].y -= push * dir * 0.5
        clampIntoCylinder(wordPositions[i], { xzMargin: wordXzMargin(texts[i]) })
        clampIntoCylinder(wordPositions[j], { xzMargin: wordXzMargin(texts[j]) })
      }
    }
  }
}

/** 世界 XZ 处的地面高度（相对 GROUND_Y） */
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

function createTerrainGeometry(radius: number, segments: number) {
  const geometry = new THREE.CircleGeometry(radius, segments)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    position.setZ(i, terrainHeight(x, -y))
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

async function createGrassGround(): Promise<THREE.Group> {
  const group = new THREE.Group()
  group.userData.ignorePick = true

  const loader = new THREE.TextureLoader()
  const grassMap = await loader.loadAsync(GRASS_TEXTURE_URL)
  grassMap.wrapS = THREE.RepeatWrapping
  grassMap.wrapT = THREE.RepeatWrapping
  grassMap.repeat.set(10, 10)
  grassMap.colorSpace = THREE.SRGBColorSpace
  grassMap.anisotropy = 8

  const ground = new THREE.Mesh(
    createTerrainGeometry(GROUND_RADIUS, TERRAIN_SEGMENTS),
    new THREE.MeshStandardMaterial({
      map: grassMap,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      flatShading: false,
    })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = GROUND_Y - 0.03
  ground.receiveShadow = true

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(GROUND_RADIUS * 0.88, GROUND_RADIUS, 72),
    new THREE.MeshBasicMaterial({
      color: 0xf8f8f8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = GROUND_Y - 0.02

  group.add(ground, halo)
  return group
}

function createPlaceholderFlower(color: THREE.Color): THREE.Group {
  const group = new THREE.Group()
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: NEU.accent, roughness: 0.92, metalness: 0 })
  )
  stem.position.y = 0.28
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })
  )
  head.position.y = 0.62
  group.add(stem, head)
  return group
}

function createPlaceholderDeco(kind: GardenDecoKind): THREE.Group {
  const group = new THREE.Group()
  const mat = (color: number, roughness = 0.9) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 })

  if (kind === 'rock') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), mat(0xb8b0a8))
    rock.scale.set(1.15, 0.62, 0.95)
    rock.rotation.set(0.25, 0.4, 0.1)
    group.add(rock)
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), mat(0xc4bcb4))
    pebble.position.set(0.22, 0.02, 0.1)
    pebble.scale.set(1, 0.7, 0.85)
    group.add(pebble)
  } else if (kind === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.75, 8), mat(0x8b6914))
    trunk.position.y = 0.38
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.05, 10), mat(0x7cb87c))
    crown.position.y = 1.02
    group.add(trunk, crown)
  } else if (kind === 'bush') {
    const colors = [0x8ec4a8, 0x9ed0b4, 0x7fb896]
    for (let i = 0; i < 3; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(colors[i % colors.length]))
      bush.position.set((i - 1) * 0.17, 0.16 + i * 0.04, (i % 2) * 0.1)
      bush.scale.setScalar(0.85 + i * 0.12)
      group.add(bush)
    }
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat(NEU.dent))
    post.position.y = 0.28
    group.add(post)
  }

  return group
}

function randomPlanarInAnnulus(minR: number, maxR: number, y = GROUND_Y) {
  const t = Math.random()
  const radius = Math.sqrt(minR * minR + t * (maxR * maxR - minR * minR))
  const angle = Math.random() * Math.PI * 2
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
}

function seededPlanarInAnnulus(minR: number, maxR: number, seed: string, y = GROUND_Y) {
  const t = hashUnit(`${seed}-r`)
  const radius = Math.sqrt(minR * minR + t * (maxR * maxR - minR * minR))
  const angle = hashUnit(`${seed}-a`) * Math.PI * 2
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
}

function shufflePositions(positions: THREE.Vector3[]) {
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = positions[i]
    positions[i] = positions[j]
    positions[j] = tmp
  }
}

function computeDecoPositions(totalCount: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []
  const minR = CYLINDER_RADIUS + 1.2
  const maxR = Math.min(GROUND_RADIUS * 0.76, CYLINDER_RADIUS + 10.5)
  const minDist = 1.25
  const maxAttempts = Math.max(totalCount * 50, 80)

  for (let attempt = 0; attempt < maxAttempts && positions.length < totalCount; attempt++) {
    const candidate = randomPlanarInAnnulus(minR, maxR)
    const spaced = positions.every((pos) => pos.distanceTo(candidate) >= minDist)
    if (spaced) positions.push(candidate)
  }

  while (positions.length < totalCount) {
    positions.push(randomPlanarInAnnulus(minR, maxR))
  }

  shufflePositions(positions)
  return positions
}

function relaxFlowerPositions2D(positions: THREE.Vector3[]) {
  const minDist = 0.95
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x
        const dz = positions[i].z - positions[j].z
        const dist = Math.hypot(dx, dz)
        if (dist >= minDist || dist <= 0.001) continue
        const push = ((minDist - dist) / dist) * 0.38
        positions[i].x += dx * push * 0.5
        positions[i].z += dz * push * 0.5
        positions[j].x -= dx * push * 0.5
        positions[j].z -= dz * push * 0.5
        clampIntoCylinder(positions[i], {
          yMin: CYLINDER_BOTTOM,
          yMax: CYLINDER_BOTTOM,
          xzMargin: FLOWER_XZ_MARGIN,
        })
        clampIntoCylinder(positions[j], {
          yMin: CYLINDER_BOTTOM,
          yMax: CYLINDER_BOTTOM,
          xzMargin: FLOWER_XZ_MARGIN,
        })
      }
    }
  }
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

function placeOnGround(
  object: THREE.Object3D,
  groundPos: THREE.Vector3,
  scale = 1,
  options: { randomYaw?: boolean } = {}
) {
  object.scale.multiplyScalar(scale)
  object.rotation.y = options.randomYaw
    ? Math.random() * Math.PI * 2
    : (hashString(`${groundPos.x},${groundPos.z}`) % 360) * (Math.PI / 180)
  const box = new THREE.Box3().setFromObject(object)
  const surfaceY = GROUND_Y + terrainHeight(groundPos.x, groundPos.z)
  object.position.set(groundPos.x, surfaceY - box.min.y, groundPos.z)
}

function normalizeFlowerHeight(object: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  object.scale.multiplyScalar(targetHeight / maxDim)
}

interface GardenLayout {
  sizes: number[]
  flowerPositions: THREE.Vector3[]
  wordPositions: THREE.Vector3[]
}

function computeGardenLayout(words: WordCloudDatum[], flowerCount: number): GardenLayout {
  const sizes = words.map(() => WORD_LAYOUT_SIZE)
  return {
    sizes,
    flowerPositions: computeFlowerPositionsUpTo(flowerCount),
    wordPositions: computeWordPositions(words),
  }
}

function computeInitialFlowerPosition(index: number): THREE.Vector3 {
  const innerR = Math.max(CYLINDER_RADIUS * 0.9 - FLOWER_XZ_MARGIN, CYLINDER_RADIUS * 0.15)
  const pos = seededPlanarInAnnulus(
    CYLINDER_RADIUS * 0.08,
    innerR * 0.94,
    `flower-pos-${index}`
  )
  clampIntoCylinder(pos, {
    yMin: CYLINDER_BOTTOM,
    yMax: CYLINDER_BOTTOM,
    xzMargin: FLOWER_XZ_MARGIN,
  })
  return pos
}

function settleFlowerPosition(index: number, existing: THREE.Vector3[]): THREE.Vector3 {
  const pos = computeInitialFlowerPosition(index)
  const minDist = 0.95

  for (let iter = 0; iter < 10; iter++) {
    for (const other of existing) {
      const dx = pos.x - other.x
      const dz = pos.z - other.z
      const dist = Math.hypot(dx, dz)
      if (dist >= minDist || dist <= 0.001) continue
      const push = ((minDist - dist) / dist) * 0.5
      pos.x += dx * push
      pos.z += dz * push
    }
    clampIntoCylinder(pos, {
      yMin: CYLINDER_BOTTOM,
      yMax: CYLINDER_BOTTOM,
      xzMargin: FLOWER_XZ_MARGIN,
    })
  }

  return pos
}

function computeFlowerPositionsUpTo(count: number): THREE.Vector3[] {
  if (count <= 0) return []

  const positions: THREE.Vector3[] = []
  for (let index = 0; index < count; index++) {
    positions.push(settleFlowerPosition(index, positions))
  }
  relaxFlowerPositions2D(positions)
  return positions
}

function computeWordPositions(data: WordCloudDatum[]): THREE.Vector3[] {
  const count = data.length
  if (count <= 0) return []

  const positions = Array.from({ length: count }, () => new THREE.Vector3())
  const innerR = Math.max(CYLINDER_RADIUS * 0.9 - WORD_XZ_MARGIN, CYLINDER_RADIUS * 0.15)

  for (let index = 0; index < count; index++) {
    const candidate = randomPlanarInAnnulus(CYLINDER_RADIUS * 0.1, innerR * 0.92)
    const liftY = computeWordLiftY(data[index].name)
    const xzOff = computeWordXzOffset(data[index].name)
    positions[index].set(candidate.x + xzOff.x, liftY, candidate.z + xzOff.z)
    clampIntoCylinder(positions[index], { xzMargin: wordXzMargin(data[index].name) })
  }

  relaxWordPositions3D(positions, data)
  refineVerticalSpacing(positions, data.map((item) => item.name))
  return positions
}

function relaxWordPositions3D(
  positions: THREE.Vector3[],
  data: WordCloudDatum[]
) {
  const minDist = WORD_LAYOUT_SIZE * 1.04 + 1.15
  for (let iter = 0; iter < 14; iter++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const minDistXZ =
          wordXzMargin(data[i].name) + wordXzMargin(data[j].name) + 0.35
        const delta = new THREE.Vector3().subVectors(positions[i], positions[j])
        const dist = delta.length()
        if (dist < minDist && dist > 0.001) {
          const push = ((minDist - dist) / dist) * 0.32
          delta.y *= 1.35
          positions[i].addScaledVector(delta, push * 0.5)
          positions[j].addScaledVector(delta, -push * 0.5)
        } else if (Math.hypot(delta.x, delta.z) < minDistXZ && Math.hypot(delta.x, delta.z) > 0.001) {
          const push = ((minDistXZ - Math.hypot(delta.x, delta.z)) / Math.hypot(delta.x, delta.z)) * 0.28
          positions[i].x += delta.x * push * 0.5
          positions[i].z += delta.z * push * 0.5
          positions[j].x -= delta.x * push * 0.5
          positions[j].z -= delta.z * push * 0.5
        }
      }
    }
    for (let i = 0; i < positions.length; i++) {
      positions[i].y = Math.max(positions[i].y, WORD_Y_MIN)
      clampIntoCylinder(positions[i], { xzMargin: wordXzMargin(data[i].name) })
    }
  }
}

const WORD_LABEL_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

function createWordLabel(text: string, count: number, accent: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0 }))
  }

  const mainFont = `700 ${WORD_FONT_SIZE}px ${WORD_LABEL_FONT}`
  const countFont = `600 ${WORD_COUNT_FONT_SIZE}px ${WORD_LABEL_FONT}`
  ctx.font = mainFont
  const textWidth = ctx.measureText(text).width
  ctx.font = countFont
  const countWidth = ctx.measureText(String(count)).width

  const paddingX = 16
  const paddingY = 10
  const lineGap = 6
  const canvasWidth = Math.ceil(Math.max(textWidth, countWidth) + paddingX * 2)
  const canvasHeight = Math.ceil(WORD_FONT_SIZE + WORD_COUNT_FONT_SIZE + lineGap + paddingY * 2)
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const cx = canvasWidth / 2
  const mainY = paddingY + WORD_FONT_SIZE * 0.72
  const countY = mainY + WORD_FONT_SIZE * 0.38 + lineGap + WORD_COUNT_FONT_SIZE * 0.35

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = mainFont
  ctx.shadowColor = 'rgba(155, 138, 151, 0.28)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 1
  ctx.fillStyle = accent
  ctx.fillText(text, cx, mainY)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.font = countFont
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.88
  ctx.fillText(String(count), cx, countY)
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
  })
  const sprite = new THREE.Sprite(material)
  sprite.userData.word = text
  const aspect = canvasWidth / canvasHeight
  sprite.scale.set(WORD_LABEL_WORLD_HEIGHT * aspect, WORD_LABEL_WORLD_HEIGHT, 1)
  sprite.renderOrder = 3
  return sprite
}

function createAmbientField(): THREE.InstancedMesh {
  const geometry = new THREE.SphereGeometry(0.1, 8, 6)
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    vertexColors: true,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, AMBIENT_COUNT)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const seed = hashString(`petal-${i}`)
    const angle = ((seed % 360) / 360) * Math.PI * 2
    const r = Math.sqrt(((seed >> 3) % 100) / 100) * CYLINDER_RADIUS * 0.82
    const y = WORD_Y_MIN + ((seed >> 5) % 100) / 100 * (WORD_LIFT_MAX - WORD_GROUND_GAP)
    const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)
    clampIntoCylinder(pos, { xzMargin: 0.35 })
    dummy.position.copy(pos)
    dummy.scale.set(
      0.6 + Math.random() * 1.4,
      0.25 + Math.random() * 0.35,
      0.6 + Math.random() * 1.2
    )
    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    color.setHex(PETAL_COLORS[i % PETAL_COLORS.length])
    mesh.setColorAt(i, color)
  }

  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.userData.ignorePick = true
  return mesh
}

function disposeObject3D(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) material?.dispose()
  })
}

function createCloudPuffMaterial(opacity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe8f4ff,
    emissiveIntensity: 0.18,
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: true,
  })
}

function createVolumetricCloud(seed: number): THREE.Group {
  const group = new THREE.Group()
  group.userData.ignorePick = true
  group.userData.isDriftingCloud = true
  group.userData.driftPhase = hashUnit(`cloud-ph-${seed}`) * Math.PI * 2
  group.userData.driftSpeed = 0.07 + hashUnit(`cloud-sp-${seed}`) * 0.1
  group.userData.baseY = 0

  const puffCount = 5 + (seed % 3)
  for (let i = 0; i < puffCount; i++) {
    const radius = 0.75 + hashUnit(`cloud-r-${seed}-${i}`) * 1.35
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      createCloudPuffMaterial(0.82 + hashUnit(`cloud-o-${seed}-${i}`) * 0.12)
    )
    mesh.position.set(
      (hashUnit(`cloud-x-${seed}-${i}`) - 0.5) * 3.2,
      (hashUnit(`cloud-y-${seed}-${i}`) - 0.5) * 1.1,
      (hashUnit(`cloud-z-${seed}-${i}`) - 0.5) * 2.2
    )
    mesh.scale.setScalar(0.82 + hashUnit(`cloud-s-${seed}-${i}`) * 0.45)
    group.add(mesh)
  }

  return group
}

function createGardenAtmosphere(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'GardenAtmosphere'

  const clouds = new THREE.Group()
  clouds.name = 'GardenClouds'
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = createVolumetricCloud(i)
    const angle = hashUnit(`cloud-a-${i}`) * Math.PI * 2
    const radius = 16 + hashUnit(`cloud-dist-${i}`) * 24
    const y = 24 + hashUnit(`cloud-h-${i}`) * 22
    cloud.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    cloud.userData.baseY = y
    cloud.userData.baseX = cloud.position.x
    cloud.userData.baseZ = cloud.position.z
    clouds.add(cloud)
  }
  group.add(clouds)

  return group
}

function animateGardenAtmosphere(group: THREE.Group, t: number) {
  group.traverse((child) => {
    if (!child.userData.isDriftingCloud) return

    const cloud = child as THREE.Group
    const phase = cloud.userData.driftPhase as number
    const speed = cloud.userData.driftSpeed as number
    const baseX = cloud.userData.baseX as number
    const baseY = cloud.userData.baseY as number
    const baseZ = cloud.userData.baseZ as number
    cloud.position.set(
      baseX + Math.sin(t * speed + phase) * 0.65,
      baseY + Math.sin(t * speed * 0.7 + phase) * 0.35,
      baseZ + Math.cos(t * speed * 0.9 + phase) * 0.55
    )
    cloud.rotation.y = Math.sin(t * speed * 0.35 + phase) * 0.04
  })
}

function createGardenSkybox(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(320, 48, 32)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0xa8d8ff) },
      horizonColor: { value: new THREE.Color(0xf5fbff) },
      groundColor: { value: new THREE.Color(0xfff9fb) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = dir.y;
        vec3 color = h >= 0.0
          ? mix(horizonColor, topColor, pow(h, 0.62))
          : mix(horizonColor, groundColor, pow(-h, 0.75) * 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })

  const skybox = new THREE.Mesh(geometry, material)
  skybox.name = 'GardenSkybox'
  skybox.renderOrder = -2000
  skybox.userData.ignorePick = true
  return skybox
}

function tuneSceneAtmosphere(core: ThreeCore) {
  core.scene.background = null
  core.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)
  core.toggleBloom(false)

  if (core.lights) {
    core.lights.ambient.intensity = 1.05
    core.lights.ambient.color.set(0xf5fbff)
    core.lights.hemisphere.color.set(0xc8e6ff)
    core.lights.hemisphere.groundColor.set(0xe8f8ef)
    core.lights.hemisphere.intensity = 0.72
    core.lights.directional.intensity = 0.75
    core.lights.directional.color.set(SCENE_WHITE)
    core.lights.directional.position.set(-6, 14, 8)
    core.lights.fill.intensity = 0.25
    core.lights.fill.color.set(0xfff0f5)
  }

  const softKey = new THREE.PointLight(0xffffff, 0.35, 48)
  softKey.position.set(-5, 10, 6)
  core.scene.add(softKey)

  const softFill = new THREE.PointLight(0xfff0f5, 0.22, 40)
  softFill.position.set(8, 4, -4)
  core.scene.add(softFill)
}

export class WordCloudBubble3D {
  private core: ThreeCore | null = null
  private container: HTMLElement
  private callbacks: WordCloudBubble3DCallbacks
  private cloudGroup = new THREE.Group()
  private gardenGroup = new THREE.Group()
  private flowerGroup = new THREE.Group()
  private decoGroup = new THREE.Group()
  private flowerModelCache = new Map<string, THREE.Object3D>()
  private decoModelCache = new Map<string, THREE.Object3D>()
  private decoBuilt = false
  private ambientField: THREE.InstancedMesh | null = null
  private skybox: THREE.Mesh | null = null
  private atmosphereGroup: THREE.Group | null = null
  private ambientDummy = new THREE.Object3D()
  private entries: WordEntry[] = []
  private animatedPosition = new THREE.Vector3()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private hoveredWord: string | null = null
  private hoveredFlowerCommentId: number | null = null
  private pointerDownTarget: GardenPickTarget | null = null
  private pointerDownX = 0
  private pointerDownY = 0
  private readonly clickMoveThreshold = 10
  private animationBound: (() => void) | null = null
  private resizeObserver: ResizeObserver | null = null
  private disposed = false
  private paused = false
  private pointerMoveRaf: number | null = null
  private pendingPointerMove: PointerEvent | null = null
  private mountComplete = false
  private pendingScene: GardenSceneData | null = null
  private syncedFlowerCount = 0
  private syncedWordsSignature = ''
  private syncedPlantTypeIndex: number | undefined = undefined
  private syncedFlowerMetaKey = ''
  private flowerBedPositions: THREE.Vector3[] = []

  private onPointerMove = (event: PointerEvent) => {
    this.pendingPointerMove = event
    if (this.pointerMoveRaf != null) return
    this.pointerMoveRaf = requestAnimationFrame(() => {
      this.pointerMoveRaf = null
      const moveEvent = this.pendingPointerMove
      this.pendingPointerMove = null
      if (!moveEvent || this.disposed) return
      this.handlePointerMovePick(moveEvent)
    })
  }

  private handlePointerMovePick(event: PointerEvent) {
    this.updatePointer(event.clientX, event.clientY)
    const hit = this.pickInteractable()
    const nextWord = hit?.kind === 'word' ? hit.word : null
    const nextFlowerId = hit?.kind === 'flower' ? hit.commentId : null

    if (nextWord !== this.hoveredWord) {
      this.hoveredWord = nextWord
      this.callbacks.onWordHover?.(nextWord)
    }
    if (nextFlowerId !== this.hoveredFlowerCommentId) {
      this.hoveredFlowerCommentId = nextFlowerId
      this.callbacks.onFlowerHover?.(nextFlowerId)
    }

    this.container.style.cursor = hit ? 'pointer' : 'grab'
  }

  private onPointerDown = (event: PointerEvent) => {
    this.updatePointer(event.clientX, event.clientY)
    this.pointerDownTarget = this.pickInteractable()
    this.pointerDownX = event.clientX
    this.pointerDownY = event.clientY
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointerDownTarget) return

    const dx = event.clientX - this.pointerDownX
    const dy = event.clientY - this.pointerDownY
    const moved = dx * dx + dy * dy > this.clickMoveThreshold ** 2
    const target = this.pointerDownTarget
    this.pointerDownTarget = null

    if (moved) return

    this.updatePointer(event.clientX, event.clientY)
    const hit = this.pickInteractable()
    if (!hit || hit.kind !== target.kind) return

    if (hit.kind === 'word' && target.kind === 'word' && hit.word === target.word) {
      this.callbacks.onWordClick?.(hit.word)
      return
    }

    if (
      hit.kind === 'flower' &&
      target.kind === 'flower' &&
      hit.commentId === target.commentId
    ) {
      this.callbacks.onFlowerClick?.(hit.commentId)
    }
  }

  constructor(container: HTMLElement, callbacks: WordCloudBubble3DCallbacks = {}) {
    this.container = container
    this.callbacks = callbacks
  }

  async mount(scene: GardenSceneData) {
    if (this.disposed) return

    this.core = new ThreeCore({
      container: this.container,
      alpha: true,
      clearColor: SCENE_WHITE,
      cameraPosition: { x: 0, y: 3.2, z: 22 },
      enableOrbitControls: true,
      enableStats: false,
      colorStyle: 'anime',
    })

    await this.core.mount(this.container)
    this.skybox = createGardenSkybox()
    this.core.scene.add(this.skybox)
    this.atmosphereGroup = createGardenAtmosphere()
    this.core.scene.add(this.atmosphereGroup)
    tuneSceneAtmosphere(this.core)

    if (this.core.controls) {
      this.core.controls.enableDamping = true
      this.core.controls.dampingFactor = 0.08
      this.core.controls.autoRotate = false
    }

    this.gardenGroup.add(await createGrassGround())
    if (SHOW_CYLINDER_DEBUG) {
      this.gardenGroup.add(createCylinderDebugHelper())
    }
    this.gardenGroup.add(this.decoGroup)
    this.gardenGroup.add(this.flowerGroup)
    this.gardenGroup.add(this.cloudGroup)
    this.core.scene.add(this.gardenGroup)
    this.ambientField = createAmbientField()
    this.core.scene.add(this.ambientField)
    await this.buildDecorations()
    await this.setGardenScene(scene)

    this.animationBound = () => {
      if (this.paused) return

      const t = performance.now() * 0.001

      if (this.atmosphereGroup) {
        animateGardenAtmosphere(this.atmosphereGroup, t)
      }

      for (const entry of this.entries) {
        this.animatedPosition.set(
          entry.basePosition.x + Math.sin(t * entry.freq + entry.phase) * 0.03,
          entry.basePosition.y + Math.sin(t * entry.freq * 1.15 + entry.phase) * 0.1,
          entry.basePosition.z + Math.cos(t * entry.freq * 0.85 + entry.phase) * 0.03
        )
        clampIntoCylinder(this.animatedPosition, { xzMargin: wordXzMargin(entry.word) })
        entry.group.position.copy(this.animatedPosition)
      }

      if (this.ambientField) {
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          this.ambientField.getMatrixAt(i, this.ambientDummy.matrix)
          this.ambientDummy.matrix.decompose(
            this.ambientDummy.position,
            this.ambientDummy.quaternion,
            this.ambientDummy.scale
          )
          this.ambientDummy.position.y += Math.sin(t * 0.35 + i * 0.7) * 0.0012
          this.ambientDummy.position.x += Math.cos(t * 0.25 + i) * 0.0006
          clampIntoCylinder(this.ambientDummy.position, { xzMargin: 0.35 })
          this.ambientDummy.rotation.y += 0.002
          this.ambientDummy.updateMatrix()
          this.ambientField.setMatrixAt(i, this.ambientDummy.matrix)
        }
        this.ambientField.instanceMatrix.needsUpdate = true
      }
    }
    this.core.animationCallbacks.push(this.animationBound)

    await this.core.startAnimationLoop()

    this.container.addEventListener('pointermove', this.onPointerMove)
    this.container.addEventListener('pointerdown', this.onPointerDown)
    this.container.addEventListener('pointerup', this.onPointerUp)

    let resizeRaf: number | null = null
    this.resizeObserver = new ResizeObserver(() => {
      if (resizeRaf != null) return
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null
        this.core?.onContainerResize?.()
      })
    })
    this.resizeObserver.observe(this.container)

    this.mountComplete = true
    if (this.pendingScene) {
      const pending = this.pendingScene
      this.pendingScene = null
      await this.setGardenScene(pending)
    }
  }

  async setGardenScene(scene: GardenSceneData) {
    if (!this.mountComplete) {
      this.pendingScene = scene
      return
    }

    if (!this.core) return

    const targetCount = Math.min(
      MAX_GARDEN_FLOWER_COUNT,
      Math.max(0, Math.floor(scene.flowerCount))
    )
    const wordsSignature = scene.words.map((item) => `${item.name}\0${item.value}`).join('\n')
    const wordsChanged = wordsSignature !== this.syncedWordsSignature
    const typesKey = buildFlowerMetaKey(scene.flowerTypes, scene.flowerCommentIds, targetCount)
    const metaChanged = typesKey !== this.syncedFlowerMetaKey
    const plantTypeChanged = scene.plantTypeIndex !== this.syncedPlantTypeIndex
    const prevFlowerCount = this.syncedFlowerCount

    if (wordsChanged) {
      this.clearWords()
      if (scene.words.length) {
        const layout = computeGardenLayout(scene.words, this.syncedFlowerCount)
        this.buildWords(scene.words, layout)
      }
      this.syncedWordsSignature = wordsSignature
    }

    if (metaChanged || plantTypeChanged || targetCount < this.syncedFlowerCount) {
      this.resetFlowers()
      this.syncedFlowerMetaKey = typesKey
      this.syncedPlantTypeIndex = scene.plantTypeIndex
    }

    if (targetCount > this.syncedFlowerCount) {
      const addedCount = targetCount - this.syncedFlowerCount
      const focusLast =
        addedCount === 1 && !metaChanged && !plantTypeChanged && prevFlowerCount >= 0
      await this.addFlowersRange(
        this.syncedFlowerCount,
        targetCount,
        scene.flowerTypes,
        scene.flowerCommentIds,
        scene.plantTypeIndex,
        focusLast
      )
      this.syncedFlowerCount = targetCount
    }

    if (!scene.words.length && targetCount <= 0) return
  }

  /** @deprecated 使用 setGardenScene */
  async setData(
    data: WordCloudDatum[],
    flowerCount = 0,
    flowerTypes?: string[],
    flowerCommentIds?: number[],
    plantTypeIndex?: number
  ) {
    await this.setGardenScene({
      words: data,
      flowerCount,
      flowerTypes,
      flowerCommentIds,
      plantTypeIndex,
    })
  }

  private async loadDecoTemplate(url: string, kind: GardenDecoKind): Promise<THREE.Object3D> {
    const cached = this.decoModelCache.get(url)
    if (cached) return cached

    const core = this.core
    if (!core) {
      return createPlaceholderDeco(kind)
    }

    try {
      const model = await core.loadModel(resolveModelUrl(url), {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/',
      })
      model.userData.ignorePick = true
      this.decoModelCache.set(url, model)
      return model
    } catch (error) {
      console.warn('装饰模型加载失败，使用占位:', url, error)
      const fallback = createPlaceholderDeco(kind)
      fallback.userData.ignorePick = true
      this.decoModelCache.set(url, fallback)
      return fallback
    }
  }

  private async buildDecorations() {
    if (!this.core || this.decoBuilt || !GARDEN_DECO_MODELS.length) return
    this.decoBuilt = true

    const totalCount = GARDEN_DECO_MODELS.reduce((sum, item) => sum + (item.count ?? 1), 0)
    const positions = computeDecoPositions(totalCount)
    let posIndex = 0

    for (const deco of GARDEN_DECO_MODELS) {
      const template = await this.loadDecoTemplate(deco.url, deco.kind)
      const instanceCount = deco.count ?? 1
      const targetHeight = deco.targetHeight ?? DECO_DEFAULT_HEIGHT[deco.kind]

      for (let i = 0; i < instanceCount; i++) {
        if (posIndex >= positions.length) break

        const pos = positions[posIndex++]
        const model = template.clone(true)
        model.userData.ignorePick = true

        normalizeFlowerHeight(model, targetHeight)
        applyNeuTintToFlower(model)
        const scaleJitter = 0.86 + Math.random() * 0.28
        placeOnGround(model, pos, (deco.scale ?? 1) * scaleJitter, { randomYaw: true })

        this.decoGroup.add(model)
      }
    }
  }

  private async loadFlowerTemplate(url: string): Promise<THREE.Object3D> {
    const cached = this.flowerModelCache.get(url)
    if (cached) return cached

    const core = this.core
    if (!core) {
      return createPlaceholderFlower(new THREE.Color(NEU.primary))
    }

    try {
      const model = await core.loadModel(resolveModelUrl(url), {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/',
      })
      model.userData.ignorePick = true
      this.flowerModelCache.set(url, model)
      return model
    } catch (error) {
      console.warn('花朵模型加载失败，使用占位:', url, error)
      const fallback = createPlaceholderFlower(new THREE.Color(NEU.primary))
      fallback.userData.ignorePick = true
      this.flowerModelCache.set(url, fallback)
      return fallback
    }
  }

  private resetFlowers() {
    this.clearFlowers()
    this.flowerBedPositions = []
    this.syncedFlowerCount = 0
  }

  private async addFlowersRange(
    startIndex: number,
    endIndex: number,
    flowerTypes?: string[],
    flowerCommentIds?: number[],
    plantTypeIndex?: number,
    focusLast = false
  ) {
    if (!this.core || endIndex <= startIndex) return

    let lastFlower: THREE.Object3D | null = null

    if (startIndex === 0) {
      const positions = computeFlowerPositionsUpTo(endIndex)
      for (let index = 0; index < endIndex; index++) {
        const bedPos = positions[index]
        if (!bedPos) continue
        this.flowerBedPositions.push(bedPos.clone())
        lastFlower = await this.createFlowerAt(
          index,
          bedPos,
          flowerTypes?.[index] || undefined,
          flowerCommentIds?.[index],
          plantTypeIndex
        )
      }
    } else {
      for (let index = startIndex; index < endIndex; index++) {
        const bedPos = settleFlowerPosition(index, this.flowerBedPositions)
        this.flowerBedPositions.push(bedPos.clone())
        lastFlower = await this.createFlowerAt(
          index,
          bedPos,
          flowerTypes?.[index] || undefined,
          flowerCommentIds?.[index],
          plantTypeIndex
        )
      }
    }

    if (focusLast && lastFlower) {
      this.focusOnFlower(lastFlower)
    }
  }

  private async createFlowerAt(
    index: number,
    bedPos: THREE.Vector3,
    flowerTypeId?: string,
    commentId?: number,
    plantTypeIndex?: number
  ): Promise<THREE.Object3D | null> {
    if (!this.core) return null

    const plant =
      flowerTypeId != null
        ? resolveGardenFlowerModel(flowerTypeId, index)
        : plantTypeIndex != null
          ? resolveGardenFlowerModel(GARDEN_PLANT_MODELS[plantTypeIndex]?.id, plantTypeIndex)
          : resolveGardenFlowerModel(undefined, index)

    if (!plant.url) return null

    const template = await this.loadFlowerTemplate(plant.url)
    const flower = template.clone(true)
    flower.userData.plantId = plant.id
    flower.userData.flowerTypeId = flowerTypeId ?? plant.id
    flower.userData.flowerIndex = index

    const resolvedCommentId = Number(commentId)
    if (Number.isFinite(resolvedCommentId) && resolvedCommentId > 0) {
      flower.userData.comment_id = resolvedCommentId
      flower.traverse((child) => {
        child.userData.ignorePick = false
      })
    } else {
      flower.userData.ignorePick = true
    }
    const targetHeight = plant.targetHeight ?? FLOWER_TARGET_HEIGHT
    flower.userData.targetHeight = targetHeight

    normalizeFlowerHeight(flower, targetHeight)
    applyNeuTintToFlower(flower)
    const scaleJitter = 0.92 + hashUnit(`flower-${index}`) * 0.14
    placeOnGround(flower, bedPos.clone(), (plant.scale ?? 1) * scaleJitter)

    this.flowerGroup.add(flower)
    return flower
  }

  private focusOnFlower(flower: THREE.Object3D) {
    if (!this.core?.controls || !this.core.camera) return

    const focusPoint = new THREE.Vector3()
    flower.getWorldPosition(focusPoint)
    focusPoint.y += (flower.userData.targetHeight as number | undefined) ?? FLOWER_TARGET_HEIGHT * 0.42

    const currentOffset = this.core.camera.position.clone().sub(this.core.controls.target)
    const horizontalDist = Math.max(Math.hypot(currentOffset.x, currentOffset.z), 5.5)
    const heightRatio = THREE.MathUtils.clamp(
      currentOffset.y / (horizontalDist || 1),
      0.28,
      0.72
    )

    const dirXZ = new THREE.Vector3(currentOffset.x, 0, currentOffset.z)
    if (dirXZ.lengthSq() < 0.01) {
      dirXZ.set(0.35, 0, 1)
    }
    dirXZ.normalize().multiplyScalar(horizontalDist)

    const cameraPosition = new THREE.Vector3(
      focusPoint.x + dirXZ.x,
      focusPoint.y + horizontalDist * heightRatio,
      focusPoint.z + dirXZ.z
    )

    this.core.lookAtCameraState(
      {
        position: cameraPosition,
        target: focusPoint,
      },
      900
    )
  }

  private buildWords(data: WordCloudDatum[], layout: GardenLayout) {
    const { wordPositions: positions } = layout
    const heatColorByWord = buildWordCloudRankColorMap(data)

    data.forEach((item, index) => {
      const heatColor = heatColorByWord.get(item.name) ?? '#7130ae'
      const label = createWordLabel(item.name, item.value, heatColor)

      const group = new THREE.Group()
      group.add(label)
      group.position.copy(positions[index])
      group.userData.word = item.name

      this.cloudGroup.add(group)
      this.entries.push({
        group,
        label,
        basePosition: positions[index].clone(),
        phase: Math.random() * Math.PI * 2,
        freq: 0.35 + Math.random() * 0.45,
        word: item.name,
        size: WORD_LAYOUT_SIZE,
        targetScale: 1,
        currentScale: 1,
      })
    })
  }

  private clearFlowers() {
    while (this.flowerGroup.children.length > 0) {
      this.flowerGroup.remove(this.flowerGroup.children[0])
    }
  }

  private clearWords() {
    for (const entry of this.entries) {
      this.cloudGroup.remove(entry.group)
      entry.label.material.map?.dispose()
      entry.label.material.dispose()
    }
    this.entries = []
  }

  private updatePointer(clientX: number, clientY: number) {
    if (!this.core?.camera) return
    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickInteractable(): GardenPickTarget | null {
    if (!this.core?.camera) return null
    this.raycaster.setFromCamera(this.pointer, this.core.camera)

    const targets: THREE.Object3D[] = []
    for (const flower of this.flowerGroup.children) {
      flower.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !child.userData.ignorePick) {
          targets.push(child)
        }
      })
    }
    for (const entry of this.entries) {
      targets.push(entry.label)
    }
    if (!targets.length) return null

    const hits = this.raycaster.intersectObjects(targets, false)
    if (!hits.length) return null

    const hitObject = hits[0].object
    const word = hitObject.userData?.word as string | undefined
    if (word) return { kind: 'word', word }

    const commentId = findFlowerCommentId(hitObject)
    if (commentId) return { kind: 'flower', commentId }

    return null
  }

  private pickWord(): string | null {
    const hit = this.pickInteractable()
    return hit?.kind === 'word' ? hit.word : null
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.pointerMoveRaf != null) {
      cancelAnimationFrame(this.pointerMoveRaf)
      this.pointerMoveRaf = null
    }
    this.pendingPointerMove = null
    this.mountComplete = false
    this.pendingScene = null

    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerdown', this.onPointerDown)
    this.container.removeEventListener('pointerup', this.onPointerUp)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.core && this.animationBound) {
      const index = this.core.animationCallbacks.indexOf(this.animationBound)
      if (index >= 0) this.core.animationCallbacks.splice(index, 1)
    }

    this.clearWords()
    this.resetFlowers()
    this.core?.scene.remove(this.gardenGroup)
    this.cloudGroup.clear()
    this.flowerGroup.clear()
    this.decoGroup.clear()
    this.gardenGroup.clear()
    this.flowerModelCache.clear()
    this.decoModelCache.clear()
    this.decoBuilt = false

    if (this.ambientField) {
      this.core?.scene.remove(this.ambientField)
      this.ambientField.geometry.dispose()
      ;(this.ambientField.material as THREE.Material).dispose()
      this.ambientField = null
    }

    if (this.skybox) {
      this.core?.scene.remove(this.skybox)
      this.skybox.geometry.dispose()
      ;(this.skybox.material as THREE.Material).dispose()
      this.skybox = null
    }

    if (this.atmosphereGroup) {
      this.core?.scene.remove(this.atmosphereGroup)
      disposeObject3D(this.atmosphereGroup)
      this.atmosphereGroup = null
    }

    if (this.core) {
      this.core.scene.fog = null
    }

    this.core?.dispose?.()
    this.core = null
  }
}
