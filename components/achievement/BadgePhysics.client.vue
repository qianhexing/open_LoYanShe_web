<template>
  <div ref="containerRef" class="badge-3d-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import type { UserDeco } from "@/types/api"
import { BASE_IMG } from "@/utils/ipConfig"
import {
  createBadgeSparkContext,
  disposeBadgeSparkContext,
  disposeBadgeSplatMesh,
  getBadgeCoverKind,
  loadBadgeSplatGroup,
  markBadgeSparkDirty,
  refreshBadgeScenePagedRadFlag,
  refreshBadgeSplatMesh,
  resolveBadgeAssetUrl,
  type BadgeSparkContext,
} from "@/utils/badgeAsset"

export type BadgePhysicsMotionPreset = "gravity" | "wallBounce"

const props = withDefaults(
  defineProps<{
    badges: UserDeco[]
    motionPreset?: BadgePhysicsMotionPreset
  }>(),
  { motionPreset: "wallBounce" }
)

function getModelUrl(cover: string): string {
  return resolveBadgeAssetUrl(cover, "model")
}

const containerRef = ref<HTMLDivElement>()

let scene: THREE.Scene
let camera: THREE.OrthographicCamera
let renderer: THREE.WebGLRenderer

let AmmoLib: any
let physicsWorld: any
let tempVec3: any
let zeroVec3: any

const meshes: THREE.Object3D[] = []
const meshCenterOffsets: THREE.Vector3[] = []
const meshIsSplat: boolean[] = []
const meshSnapshots: Array<{
  prevPos: THREE.Vector3
  currPos: THREE.Vector3
  prevQuat: THREE.Quaternion
  currQuat: THREE.Quaternion
  splatSleeping: boolean
}> = []
const splatRefreshStates: Array<{
  px: number
  py: number
  pz: number
  qx: number
  qy: number
  qz: number
  qw: number
} | null> = []
const bodies: any[] = []
const wallBodies: any[] = []
const boundDebugLines: THREE.LineSegments[] = []

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

/** 递增以取消进行中的异步加载 / 动画帧 */
let badgeGeneration = 0
let disposed = false

const sharedDracoLoader = new DRACOLoader()
sharedDracoLoader.setDecoderPath('/draco/gltf/')
const sharedGltfLoader = new GLTFLoader()
sharedGltfLoader.setDRACOLoader(sharedDracoLoader)
const sharedTextureLoader = new THREE.TextureLoader()

type GlbTemplate = {
  mesh: THREE.Object3D
  size: THREE.Vector3
  center: THREE.Vector3
}
const glbTemplateCache = new Map<string, Promise<GlbTemplate | null>>()
/** 每帧将模型局部包围盒中心旋到世界系，避免与刚体原点错位导致底部被裁切 */
const tmpMeshWorldCenter = new THREE.Vector3()
const PLANE_Z = 0
const intersectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANE_Z)
const intersectPoint = new THREE.Vector3()

/** 仅统计为「点击」的最大像素位移，超过则视为滑动/滚动手势，不施力 */
const TAP_SLOP_PX = 12

let pendingPhysicsTap = false
let tapDownX = 0
let tapDownY = 0
let tapPointerId = -1

let animationId = 0
let resizeObserver: ResizeObserver | null = null
let lastAnimTime = 0
let physicsAccumulator = 0
const sparkCtx: BadgeSparkContext = createBadgeSparkContext()
const tmpSplatQuat = new THREE.Quaternion()

const BADGE_SIZE = 1.2
const BADGE_DEPTH = 0.18

const GRAVITY = -6
const BOUND_SCALE = 0.9
/** 地板顶略高于视口底，抵消接触求解/无 margin 时的微量穿透，避免前景层底部少数字被 `overflow:hidden` 吃掉 */
const FLOOR_CONTACT_EPSILON = 0.06
/** 与视口顶、底对称的可视边距（世界单位）；顶/底各减一个 FLOOR_CONTACT_EPSILON 参与计算，与底部穿透补偿一致 */
const BOUNDARY_VISUAL_MARGIN = 0.5
const RANDOM_FORCE = 2.5
const PUSH_FORCE = 15
/** 碰壁模式：生成时冲量模长区间，便于从同一点向四周散开 */
const WALL_BOUNCE_SPAWN_IMPULSE_MIN = 5
const WALL_BOUNCE_SPAWN_IMPULSE_MAX = 12
/** 碰壁模式：水平速度模长下限，避免阻尼把运动完全磨没 */
const WALL_BOUNCE_MIN_LINEAR_SPEED = 0.32
/** 点云徽章：球形碰撞 + 更高阻尼，运动更慢、更易停下 */
const SPLAT_COLLIDER_SCALE = 0.92
const SPLAT_MASS = 1.85
const SPLAT_LINEAR_DAMPING_MUL = 2.4
const SPLAT_ANGULAR_DAMPING_MUL = 2.5
const SPLAT_FRICTION_MUL = 1.75
const SPLAT_RESTITUTION = 0.38
const SPLAT_WALL_BOUNCE_RESTITUTION = 0.52
const SPLAT_RANDOM_FORCE_SCALE = 0.32
const SPLAT_PUSH_FORCE_SCALE = 0.42
const SPLAT_SPAWN_IMPULSE_SCALE = 0.45
const SPLAT_WALL_BOUNCE_MIN_SPEED = 0.1
const SPLAT_VELOCITY_SLEEP_THRESHOLD = 0.07
/** 点云渲染：变换变化低于阈值时跳过 updateGenerator */
const SPLAT_TRANSFORM_REFRESH_EPS = 0.002
const SPLAT_QUAT_REFRESH_DOT = 0.99995
const PHYSICS_FIXED_DT = 1 / 60
const PHYSICS_MAX_STEPS_PER_FRAME = 2
const PHYSICS_MAX_FRAME_DELTA = 0.05
/** 点云：保持站立 — 绕 Y 轴可转背面，pitch/roll 仅允许轻微倾斜 */
const SPLAT_MAX_TILT = 0.32
const SPLAT_EULER_ORDER = 'YXZ' as const
const tmpSplatEuler = new THREE.Euler(0, 0, 0, SPLAT_EULER_ORDER)

/** 运动预设：重力掉落（默认） / 零重力高弹性碰壁回弹 */
const MOTION_PRESET_CONFIG: Record<
  BadgePhysicsMotionPreset,
  {
    gravityY: number
    randomForce: number
    badgeRestitution: number
    wallRestitution: number
    friction: number
    linearDamping: number
    angularDamping: number
  }
> = {
  gravity: {
    gravityY: GRAVITY,
    randomForce: RANDOM_FORCE,
    badgeRestitution: 0.75,
    wallRestitution: 0.75,
    friction: 0.4,
    linearDamping: 0.15,
    angularDamping: 0.25,
  },
  wallBounce: {
    gravityY: 0,
    randomForce: 2.8,
    badgeRestitution: 0.93,
    wallRestitution: 0.95,
    friction: 0.05,
    linearDamping: 0.008,
    angularDamping: 0.018,
  },
}

function motionCfg(): (typeof MOTION_PRESET_CONFIG)["gravity"] {
  const p = props.motionPreset
  return MOTION_PRESET_CONFIG[p] ?? MOTION_PRESET_CONFIG.gravity
}

function applyMotionPresetToWorld() {
  if (!physicsWorld || !tempVec3) return
  const cfg = motionCfg()
  tempVec3.setValue(0, cfg.gravityY, 0)
  physicsWorld.setGravity(tempVec3)
  for (const b of wallBodies) {
    b.setRestitution(cfg.wallRestitution)
  }
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    const isSplat = meshIsSplat[i]
    const wallBounce = props.motionPreset === "wallBounce"
    b.setRestitution(
      isSplat
        ? wallBounce
          ? SPLAT_WALL_BOUNCE_RESTITUTION
          : SPLAT_RESTITUTION
        : cfg.badgeRestitution
    )
    b.setFriction(isSplat ? cfg.friction * SPLAT_FRICTION_MUL : cfg.friction)
    b.setDamping(
      cfg.linearDamping * (isSplat ? SPLAT_LINEAR_DAMPING_MUL : 1),
      cfg.angularDamping * (isSplat ? SPLAT_ANGULAR_DAMPING_MUL : 1)
    )
  }
}

let boundX = 6
let boundZ = 4
let viewHeight = 12
const viewCenterY = 1.2

/** 玩法区内侧顶/底 Y（承托面顶、侧墙顶/顶盖板底），用于碰壁模式生成与逃逸重置 */
let playInnerBottomY = 0
let playInnerTopY = 0
/** 碰壁模式：生成与意外超出时的重置目标（玩法区竖直中点） */
let bounceArenaMidY = 0

/** 基准宽高比，该比例下缩放为 1 */
const TARGET_ASPECT = 16 / 9
/** 模型相对 16:9 的缩放上限（超宽屏等极端横向比例下避免过大） */
const MODEL_SCALE_MAX = 1.2
/** 碰撞盒边界线框，仅调试；默认关闭 */
const SHOW_BOUNDARY_DEBUG = false

/** 根据容器比例计算缩放系数，16:9 时为 1 */
function getAspectScale(width: number, height: number): number {
  const aspect = width / height
  return Math.min(aspect / TARGET_ASPECT, MODEL_SCALE_MAX)
}

function getCoverUrl(item: UserDeco) {
  const cover = item.foreign?.cover
  if (!cover) return `${BASE_IMG}static/plan_cover/default.jpg`
  if (cover.startsWith("http")) return cover
  const path = cover.startsWith("/") ? cover.slice(1) : cover
  return `${BASE_IMG}${path}`
}

async function initAmmo() {
  
  const AmmoModule = await import("ammo.js")
  if (AmmoModule.default && typeof AmmoModule.default === "function") {
    AmmoLib = await AmmoModule.default()
  } else if (typeof AmmoModule === "function") {
    AmmoLib = await (AmmoModule as () => Promise<unknown>)()
  } else {
    AmmoLib = AmmoModule.default ?? AmmoModule
  }
}

function initPhysics() {

  const config = new AmmoLib.btDefaultCollisionConfiguration()
  const dispatcher = new AmmoLib.btCollisionDispatcher(config)
  const broadphase = new AmmoLib.btDbvtBroadphase()
  const solver = new AmmoLib.btSequentialImpulseConstraintSolver()

  physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    config
  )

  tempVec3 = new AmmoLib.btVector3(0, 0, 0)
  zeroVec3 = new AmmoLib.btVector3(0, 0, 0)
  tempVec3.setValue(0, motionCfg().gravityY, 0)
  physicsWorld.setGravity(tempVec3)
}

function createWallDebugVisual(sizeX:number,sizeY:number,sizeZ:number,pos:THREE.Vector3){
  if (!SHOW_BOUNDARY_DEBUG) return
  const geo=new THREE.BoxGeometry(sizeX,sizeY,sizeZ)
  const edges=new THREE.EdgesGeometry(geo)
  const mat = new THREE.LineBasicMaterial({
    color: 0x22ffcc,
    depthTest: false,
    toneMapped: false,
  })
  const line = new THREE.LineSegments(edges, mat)
  line.renderOrder = 1000
  line.position.copy(pos)
  scene.add(line)
  boundDebugLines.push(line)
}

function createWall(sizeX:number,sizeY:number,sizeZ:number,pos:THREE.Vector3){

  const shape=new AmmoLib.btBoxShape(
    new AmmoLib.btVector3(sizeX/2,sizeY/2,sizeZ/2)
  )

  const transform=new AmmoLib.btTransform()
  transform.setIdentity()

  transform.setOrigin(
    new AmmoLib.btVector3(pos.x,pos.y,pos.z)
  )

  const motion=new AmmoLib.btDefaultMotionState(transform)

  const rbInfo=new AmmoLib.btRigidBodyConstructionInfo(
    0,
    motion,
    shape
  )

  const body=new AmmoLib.btRigidBody(rbInfo)
  body.setRestitution(motionCfg().wallRestitution)

  physicsWorld.addRigidBody(body)
  wallBodies.push(body)
}

function destroyAmmoRigidBody(body: unknown) {
  if (!physicsWorld || !AmmoLib || !body) return
  try {
    const rb = body as {
      getMotionState?: () => unknown
      getCollisionShape?: () => unknown
    }
    physicsWorld.removeRigidBody(body)
    const motionState = rb.getMotionState?.()
    const shape = rb.getCollisionShape?.()
    if (motionState) AmmoLib.destroy(motionState)
    if (shape) AmmoLib.destroy(shape)
    AmmoLib.destroy(body)
  } catch (_) {}
}

function disposeBadgeMaterial(mat: THREE.Material) {
  const textured = mat as THREE.MeshBasicMaterial & { map?: THREE.Texture | null }
  textured.map?.dispose()
  mat.dispose()
}

function disposeBadgeMesh(mesh: THREE.Object3D) {
  if (mesh.userData?.type === 'splat') {
    mesh.traverse((child) => disposeBadgeSplatMesh(child))
    return
  }
  mesh.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry?.dispose()
    const mat = child.material
    if (Array.isArray(mat)) {
      for (const m of mat) disposeBadgeMaterial(m)
    } else if (mat) {
      disposeBadgeMaterial(mat)
    }
  })
}

function removeBadgeAt(index: number) {
  const mesh = meshes[index]
  const body = bodies[index]

  if (mesh && scene) {
    scene.remove(mesh)
    disposeBadgeMesh(mesh)
  }
  if (body) destroyAmmoRigidBody(body)

  meshes.splice(index, 1)
  meshCenterOffsets.splice(index, 1)
  meshIsSplat.splice(index, 1)
  meshSnapshots.splice(index, 1)
  splatRefreshStates.splice(index, 1)
  bodies.splice(index, 1)

  for (let i = 0; i < meshes.length; i++) {
    const ud = meshes[i].userData as { badgeIndex?: number }
    ud.badgeIndex = i
  }

  if (scene) refreshBadgeScenePagedRadFlag(scene, sparkCtx)
}

function clearAllBadges() {
  while (meshes.length > 0) removeBadgeAt(meshes.length - 1)
}

function getBadgeKey(deco: UserDeco): string {
  const cover = deco.foreign?.cover ?? ''
  return `${deco.deco_id ?? ''}:${cover}`
}

function clearBounds(){
  for (const body of wallBodies) destroyAmmoRigidBody(body)
  wallBodies.length = 0
  for(const line of boundDebugLines){
    scene.remove(line)
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }
  boundDebugLines.length = 0
}

function computeBoundsFromView(width: number, height: number){
  const vw = viewHeight * (width / height)
  boundX = vw / 2
  boundZ = (vw / 2) * BOUND_SCALE
}

function createBounds(){

  const wall=0.5
  const viewBottomY = viewCenterY - viewHeight / 2
  const viewTopY = viewCenterY + viewHeight / 2
  const floorTopY =
    viewBottomY + FLOOR_CONTACT_EPSILON + BOUNDARY_VISUAL_MARGIN
  const playTopY =
    viewTopY - FLOOR_CONTACT_EPSILON - BOUNDARY_VISUAL_MARGIN
  const height = Math.max(playTopY - floorTopY, 1)
  const floorCenterY = floorTopY - wall / 2
  const wallBottomY = floorTopY
  const wallCenterY = wallBottomY + height / 2

  playInnerBottomY = floorTopY
  playInnerTopY = playTopY
  bounceArenaMidY = (floorTopY + playTopY) / 2

  // floor - 承托面与视口底、侧墙顶与视口顶，各留 BOUNDARY_VISUAL_MARGIN（对称）
  const floorPos = new THREE.Vector3(0, floorCenterY, 0)
  createWall(boundX * 2, wall, boundZ * 2, floorPos)
  createWallDebugVisual(boundX * 2, wall, boundZ * 2, floorPos)

  // left
  const leftPos = new THREE.Vector3(-boundX, wallCenterY, 0)
  createWall(wall, height, boundZ * 2, leftPos)
  createWallDebugVisual(wall, height, boundZ * 2, leftPos)

  // right
  const rightPos = new THREE.Vector3(boundX, wallCenterY, 0)
  createWall(wall, height, boundZ * 2, rightPos)
  createWallDebugVisual(wall, height, boundZ * 2, rightPos)

  // back
  const backPos = new THREE.Vector3(0, wallCenterY, -boundZ)
  createWall(boundX * 2, height, wall, backPos)
  createWallDebugVisual(boundX * 2, height, wall, backPos)

  // front
  const frontPos = new THREE.Vector3(0, wallCenterY, boundZ)
  createWall(boundX * 2, height, wall, frontPos)
  createWallDebugVisual(boundX * 2, height, wall, frontPos)

  // 碰壁回弹：封顶，与地板对称
  if (props.motionPreset === "wallBounce") {
    const ceilingCenterY = playTopY + wall / 2
    const ceilPos = new THREE.Vector3(0, ceilingCenterY, 0)
    createWall(boundX * 2, wall, boundZ * 2, ceilPos)
    createWallDebugVisual(boundX * 2, wall, boundZ * 2, ceilPos)
  }
}

function initScene(){

  const width=containerRef.value!.clientWidth
  const height=containerRef.value!.clientHeight

  scene=new THREE.Scene()

  const viewWidth = viewHeight * (width / height)
  camera = new THREE.OrthographicCamera(
    -viewWidth / 2,
    viewWidth / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    100
  )

  camera.position.set(0, viewCenterY, 10)
  camera.lookAt(0, viewCenterY, 0)

  renderer=new THREE.WebGLRenderer({
    antialias:true,
    alpha:true
  })

  renderer.setSize(width,height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))

  containerRef.value!.appendChild(renderer.domElement)
  renderer.domElement.style.display = "block"

  // const light=new THREE.DirectionalLight(0xffffff,1)
  // light.position.set(10,20,10)
  // scene.add(light)

  // const ambient=new THREE.AmbientLight(0xffffff,0.7)
  // scene.add(ambient)



  // ================ 环境光设置 ================
		// 基础环境光 - 为了避免完全黑暗的区域
		const ambientLight = new THREE.AmbientLight(0xffffff, 2.8)
		scene.add(ambientLight)

		// ================ 主要方向光（太阳光） ================
		const dirLight = new THREE.DirectionalLight(0xffeecc, 2)
		dirLight.position.set(50, 50, 30)
		dirLight.castShadow = true

		// 高质量阴影配置 - 解决阴影条纹问题
		dirLight.shadow.mapSize.width = 2048
		dirLight.shadow.mapSize.height = 2048
		dirLight.shadow.camera.near = 0.1
		dirLight.shadow.camera.far = 200
		dirLight.shadow.camera.left = -20
		dirLight.shadow.camera.right = 20
		dirLight.shadow.camera.top = 20
		dirLight.shadow.camera.bottom = -20

		// 关键：减少阴影条纹的bias设置
		dirLight.shadow.bias = -0.001
		dirLight.shadow.normalBias = 0.02
		dirLight.shadow.radius = 4
		dirLight.shadow.blurSamples = 20
		scene.add(dirLight)

		// 半球光 - 模拟天空散射和地面反射
		const hemiLight = new THREE.HemisphereLight(
			0x87ceeb, // 天空颜色 - 淡蓝色
			0x2f4f4f, // 地面颜色 - 暗灰色
			0.4
		)
		hemiLight.position.set(0, 10, 0)
		scene.add(hemiLight)

		// ================ 补光设置 (简化) ================
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
		fillLight.position.set(-30, 20, -30)
		fillLight.castShadow = false
		scene.add(fillLight)

		// ================ 镜头光（跟随相机） ================
		const lensLight = new THREE.PointLight(0xffffff, 0.5, 100)
		lensLight.position.copy(camera.position)
		lensLight.castShadow = false

		lensLight.shadow.mapSize.width = 1024
		lensLight.shadow.mapSize.height = 1024
		lensLight.shadow.camera.near = 0.1
		lensLight.shadow.camera.far = 100
		lensLight.shadow.bias = -0.0001
		lensLight.shadow.radius = 4
		lensLight.shadow.blurSamples = 8

		scene.add(lensLight)

  computeBoundsFromView(width, height)
}

function updateCameraAndBounds(){
  const el = containerRef.value
  if(!el || !camera || !scene || !physicsWorld || !AmmoLib) return

  const width = el.clientWidth
  const height = el.clientHeight

  const viewWidth = viewHeight * (width / height)
  camera.left = -viewWidth / 2
  camera.right = viewWidth / 2
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.updateProjectionMatrix()

  renderer.setSize(width, height)

  clearBounds()
  computeBoundsFromView(width, height)
  createBounds()
}

function createRigidBody(
  mesh: THREE.Object3D,
  halfExt?: THREE.Vector3,
  bodyPos?: THREE.Vector3,
  opts?: {
    sphereRadius?: number
    angularDampingMul?: number
    linearDampingMul?: number
    restitution?: number
    friction?: number
    mass?: number
  }
) {

  const shape = opts?.sphereRadius !== undefined
    ? new AmmoLib.btSphereShape(Math.max(opts.sphereRadius, 0.15))
    : halfExt
    ? new AmmoLib.btBoxShape(new AmmoLib.btVector3(
        Math.max(halfExt.x, 0.1),
        Math.max(halfExt.y, 0.1),
        Math.max(halfExt.z, 0.05)
      ))
    : new AmmoLib.btSphereShape(BADGE_SIZE/2)

  shape.setMargin(0)

  const transform=new AmmoLib.btTransform()
  transform.setIdentity()

  const pos = bodyPos ?? mesh.position

  transform.setOrigin(
    new AmmoLib.btVector3(pos.x,pos.y,pos.z)
  )

  const motion=new AmmoLib.btDefaultMotionState(transform)

  const mass = opts?.mass ?? 1

  const inertia=new AmmoLib.btVector3(0,0,0)

  shape.calculateLocalInertia(mass,inertia)

  const rbInfo=new AmmoLib.btRigidBodyConstructionInfo(
    mass,
    motion,
    shape,
    inertia
  )

  const body=new AmmoLib.btRigidBody(rbInfo)

  const cfg = motionCfg()
  body.setFriction(opts?.friction ?? cfg.friction)
  body.setRestitution(opts?.restitution ?? cfg.badgeRestitution)

  body.setDamping(
    cfg.linearDamping * (opts?.linearDampingMul ?? 1),
    cfg.angularDamping * (opts?.angularDampingMul ?? 1)
  )

  physicsWorld.addRigidBody(body)

  bodies.push(body)
}

function syncBodyRotationFromMesh(body: typeof bodies[number], mesh: THREE.Object3D) {
  if (!AmmoLib) return
  const transform = body.getWorldTransform()
  const q = mesh.quaternion
  transform.setRotation(new AmmoLib.btQuaternion(q.x, q.y, q.z, q.w))
  body.setWorldTransform(transform)
  body.activate()
}

/** 点云：保留完整 yaw(Y)，仅校正 pitch/roll 以尽量站立 */
function constrainSplatRotation(mesh: THREE.Object3D, body: typeof bodies[number]) {
  if (!AmmoLib) return

  tmpSplatEuler.setFromQuaternion(mesh.quaternion, SPLAT_EULER_ORDER)
  const yaw = tmpSplatEuler.y
  const pitch = tmpSplatEuler.x
  const roll = tmpSplatEuler.z
  const clampedPitch = THREE.MathUtils.clamp(
    pitch,
    -SPLAT_MAX_TILT,
    SPLAT_MAX_TILT
  )
  const clampedRoll = THREE.MathUtils.clamp(
    roll,
    -SPLAT_MAX_TILT,
    SPLAT_MAX_TILT
  )

  if (
    Math.abs(clampedPitch - pitch) < 1e-5 &&
    Math.abs(clampedRoll - roll) < 1e-5
  ) {
    return
  }

  tmpSplatEuler.set(clampedPitch, yaw, clampedRoll, SPLAT_EULER_ORDER)
  mesh.quaternion.setFromEuler(tmpSplatEuler, SPLAT_EULER_ORDER)

  const transform = body.getWorldTransform()
  const q = mesh.quaternion
  transform.setRotation(new AmmoLib.btQuaternion(q.x, q.y, q.z, q.w))
  body.setWorldTransform(transform)
  body.activate()
}

function applySplatYawSpin(body: typeof bodies[number], strength = 2.2) {
  if (!AmmoLib || !tempVec3) return
  tempVec3.setValue(0, (Math.random() - 0.5) * strength, 0)
  body.setAngularVelocity(tempVec3)
  body.activate()
}

function pushMeshSnapshot(mesh: THREE.Object3D, isSplat: boolean) {
  const snapshot = {
    prevPos: mesh.position.clone(),
    currPos: mesh.position.clone(),
    prevQuat: mesh.quaternion.clone(),
    currQuat: mesh.quaternion.clone(),
    splatSleeping: false,
  }
  meshSnapshots.push(snapshot)
  splatRefreshStates.push(null)
}

function saveMeshPhysicsPrev() {
  for (let i = 0; i < meshSnapshots.length; i++) {
    const s = meshSnapshots[i]
    s.prevPos.copy(s.currPos)
    s.prevQuat.copy(s.currQuat)
  }
}

function captureMeshPhysicsState() {
  for (let i = 0; i < meshes.length; i++) {
    const s = meshSnapshots[i]
    s.currPos.copy(meshes[i].position)
    s.currQuat.copy(meshes[i].quaternion)
  }
}

function wakeSplatBadge(index: number) {
  const snapshot = meshSnapshots[index]
  if (!snapshot) return
  snapshot.splatSleeping = false
  splatRefreshStates[index] = null
}

function recordSplatRefreshState(index: number, mesh: THREE.Object3D) {
  splatRefreshStates[index] = {
    px: mesh.position.x,
    py: mesh.position.y,
    pz: mesh.position.z,
    qx: mesh.quaternion.x,
    qy: mesh.quaternion.y,
    qz: mesh.quaternion.z,
    qw: mesh.quaternion.w,
  }
}

function shouldRefreshBadgeSplat(index: number, mesh: THREE.Object3D) {
  if (meshSnapshots[index]?.splatSleeping) return false
  const last = splatRefreshStates[index]
  if (!last) return true
  const posDelta = Math.hypot(
    mesh.position.x - last.px,
    mesh.position.y - last.py,
    mesh.position.z - last.pz
  )
  tmpSplatQuat.set(last.qx, last.qy, last.qz, last.qw)
  const quatDelta = Math.abs(mesh.quaternion.dot(tmpSplatQuat))
  return posDelta > SPLAT_TRANSFORM_REFRESH_EPS || quatDelta < SPLAT_QUAT_REFRESH_DOT
}

function applyInterpolatedMeshTransforms(alpha: number) {
  let splatDirty = false
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i]
    const s = meshSnapshots[i]
    if (!s) continue
    mesh.position.lerpVectors(s.prevPos, s.currPos, alpha)
    mesh.quaternion.slerpQuaternions(s.prevQuat, s.currQuat, alpha)
    if (meshIsSplat[i] && shouldRefreshBadgeSplat(i, mesh)) {
      refreshBadgeSplatMesh(mesh)
      recordSplatRefreshState(i, mesh)
      splatDirty = true
    }
  }
  if (splatDirty) markBadgeSparkDirty(sparkCtx)
}

function applyWallBounceSpawnKick(
  body: { activate: () => void; applyCentralImpulse: (v: unknown) => void },
  impulseScale = 1
) {
  if (!AmmoLib || props.motionPreset !== "wallBounce") return
  body.activate()
  const angle = Math.random() * Math.PI * 2
  const mag =
    (WALL_BOUNCE_SPAWN_IMPULSE_MIN +
      Math.random() * (WALL_BOUNCE_SPAWN_IMPULSE_MAX - WALL_BOUNCE_SPAWN_IMPULSE_MIN)) *
    impulseScale
  const ix = Math.cos(angle) * mag
  const iy = Math.sin(angle) * mag
  const imp = new AmmoLib.btVector3(ix, iy, 0)
  body.applyCentralImpulse(imp)
  AmmoLib.destroy(imp)
}

function loadGlbTemplate(url: string): Promise<GlbTemplate | null> {
  const cached = glbTemplateCache.get(url)
  if (cached) return cached

  const pending = new Promise<GlbTemplate | null>((resolve) => {
    sharedGltfLoader.load(
      url,
      (gltf) => {
        const mesh = gltf.scene
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = false
            child.receiveShadow = false
          }
        })
        const box = new THREE.Box3().setFromObject(mesh)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        mesh.position.set(0, 0, 0)
        mesh.rotation.set(0, 0, 0)
        resolve({ mesh, size, center })
      },
      undefined,
      (err) => {
        console.error('[BadgePhysics] 加载模型失败:', url, err)
        glbTemplateCache.delete(url)
        resolve(null)
      }
    )
  })
  glbTemplateCache.set(url, pending)
  return pending
}

async function loadGlbModel(
  url: string
): Promise<{ mesh: THREE.Object3D; size: THREE.Vector3; center: THREE.Vector3 } | null> {
  const template = await loadGlbTemplate(url)
  if (!template) return null
  const mesh = template.mesh.clone(true)
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      try {
        child.material = (child.material as THREE.Material).clone()
      } catch (_) {}
    }
  })
  return {
    mesh,
    size: template.size.clone(),
    center: template.center.clone(),
  }
}

async function createBadge(deco: UserDeco, badgeKey?: string) {
  const gen = badgeGeneration
  if (disposed || gen !== badgeGeneration) return

  const cover = deco.foreign?.cover ?? ""
  const coverKind = getBadgeCoverKind(cover)

  const spawnCenter =
    props.motionPreset === "wallBounce"
      ? new THREE.Vector3(0, bounceArenaMidY, PLANE_Z)
      : new THREE.Vector3(
          (Math.random() - 0.5) * boundX * 1.5,
          6 + Math.random() * 4,
          PLANE_Z
        )

  let mesh: THREE.Object3D
  let centerOffset = new THREE.Vector3(0, 0, 0)
  let isSplat = false

  const el = containerRef.value
  const modelScale = el ? getAspectScale(el.clientWidth, el.clientHeight) : 1

  if (coverKind === "model" || coverKind === "splat") {
    const url =
      coverKind === "model"
        ? getModelUrl(cover)
        : resolveBadgeAssetUrl(cover, "splat")
    const loaded =
      coverKind === "model"
        ? await loadGlbModel(url)
        : await loadBadgeSplatGroup(url, scene, renderer, sparkCtx)
    if (disposed || gen !== badgeGeneration) {
      if (loaded?.mesh) disposeBadgeMesh(loaded.mesh)
      return
    }
    if (!loaded) return
    mesh = loaded.mesh
    mesh.scale.setScalar(modelScale)
    isSplat = coverKind === "splat"
    if (isSplat) {
      centerOffset.set(0, 0, 0)
      tmpSplatEuler.set(
        (Math.random() - 0.5) * SPLAT_MAX_TILT * 1.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * SPLAT_MAX_TILT * 1.4
      )
      mesh.quaternion.setFromEuler(tmpSplatEuler, SPLAT_EULER_ORDER)
    } else {
      centerOffset.copy(loaded.center)
      mesh.rotation.set(
        Math.random() * 0.4,
        Math.random() * 0.4,
        Math.random() * 0.4
      )
    }
    const rc = centerOffset.clone().applyQuaternion(mesh.quaternion)
    mesh.position.copy(spawnCenter).sub(rc)
    const bodyPos = spawnCenter.clone()
    scene.add(mesh)
    meshes.push(mesh)
    meshCenterOffsets.push(centerOffset.clone())
    meshIsSplat.push(isSplat)
    if (isSplat) {
      const cfg = motionCfg()
      const sphereRadius =
        Math.max(loaded.size.x, loaded.size.y, loaded.size.z) *
        0.5 *
        modelScale *
        SPLAT_COLLIDER_SCALE
      const wallBounce = props.motionPreset === "wallBounce"
      createRigidBody(mesh, undefined, bodyPos, {
        sphereRadius,
        mass: SPLAT_MASS,
        linearDampingMul: SPLAT_LINEAR_DAMPING_MUL,
        angularDampingMul: SPLAT_ANGULAR_DAMPING_MUL,
        friction: cfg.friction * SPLAT_FRICTION_MUL,
        restitution: wallBounce ? SPLAT_WALL_BOUNCE_RESTITUTION : SPLAT_RESTITUTION,
      })
      syncBodyRotationFromMesh(bodies[bodies.length - 1], mesh)
      applySplatYawSpin(bodies[bodies.length - 1])
      refreshBadgeSplatMesh(mesh)
    } else {
      const halfExt = loaded.size.clone().multiplyScalar(0.5).multiplyScalar(modelScale)
      createRigidBody(mesh, halfExt, bodyPos)
      syncBodyRotationFromMesh(bodies[bodies.length - 1], mesh)
    }
  } else {
    const texture = await sharedTextureLoader.loadAsync(getCoverUrl(deco))
    if (disposed || gen !== badgeGeneration) {
      texture.dispose()
      return
    }
    const radius = BADGE_SIZE / 2
    const geo = new THREE.SphereGeometry(radius, 32, 32)
    const material = new THREE.MeshBasicMaterial({ map: texture, color: "#ffffff" })
    mesh = new THREE.Mesh(geo, material)
    mesh.position.copy(spawnCenter)
    mesh.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4)
    scene.add(mesh)
    meshes.push(mesh)
    meshCenterOffsets.push(new THREE.Vector3(0, 0, 0))
    meshIsSplat.push(false)
    createRigidBody(mesh, undefined, spawnCenter.clone())
    syncBodyRotationFromMesh(bodies[bodies.length - 1], mesh)
  }

  if (props.motionPreset === "wallBounce" && bodies.length > 0) {
    applyWallBounceSpawnKick(
      bodies[bodies.length - 1],
      meshIsSplat[meshIsSplat.length - 1] ? SPLAT_SPAWN_IMPULSE_SCALE : 1
    )
  }

  mesh.userData = mesh.userData || {}
  const ud = mesh.userData as { badgeIndex: number; deco: UserDeco; badgeKey: string }
  ud.badgeIndex = meshes.length - 1
  ud.deco = deco
  ud.badgeKey = badgeKey ?? getBadgeKey(deco)
  pushMeshSnapshot(mesh, isSplat)
  if (isSplat) recordSplatRefreshState(meshes.length - 1, mesh)
}

function getBadgeIndexFromHit(obj: THREE.Object3D): number {
  let o: THREE.Object3D | null = obj
  while (o?.parent && o.parent !== scene) o = o.parent as THREE.Object3D
  if (!o) return -1
  const idx = (o as THREE.Object3D & { userData?: { badgeIndex?: number } }).userData?.badgeIndex
  return idx !== undefined ? idx : meshes.indexOf(o)
}

function isPointOverContainer(clientX: number, clientY: number): boolean {
  const el = containerRef.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
}

/** 避免与展示区叠放的按钮、链接等抢点时误触发冲量 */
function isInteractiveUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a[href], input, textarea, select, [role="button"]'
    )
  )
}

function getWorldPointFromPointer(clientX: number, clientY: number): THREE.Vector3 | null {
  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  return raycaster.ray.intersectPlane(intersectPlane, intersectPoint) ? intersectPoint.clone() : null
}

function applyTapImpulseAtScreen(clientX: number, clientY: number) {
  if (!AmmoLib || !camera || !renderer || !tempVec3) return
  if (!isPointOverContainer(clientX, clientY)) return

  const worldPt = getWorldPointFromPointer(clientX, clientY)
  if (!worldPt) return

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(meshes, true)
  for (const hit of intersects) {
    const idx = getBadgeIndexFromHit(hit.object as THREE.Object3D)
    if (idx >= 0) {
      const body = bodies[idx]
      const pushForce = PUSH_FORCE * (meshIsSplat[idx] ? SPLAT_PUSH_FORCE_SCALE : 1)
      const dx = hit.point.x - worldPt.x
      const dy = hit.point.y - worldPt.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      body.activate()
      if (meshIsSplat[idx]) wakeSplatBadge(idx)
      const imp = new AmmoLib.btVector3((dx / len) * pushForce, (dy / len) * pushForce + 3 * (meshIsSplat[idx] ? SPLAT_PUSH_FORCE_SCALE : 1), 0)
      body.applyCentralImpulse(imp)
      AmmoLib.destroy(imp)
    }
  }
  if (intersects.length === 0) {
    const radius = boundX * 0.5
    for (let i = 0; i < bodies.length; i++) {
      const trans = bodies[i].getWorldTransform()
      const dx = trans.getOrigin().x() - worldPt.x
      const dy = trans.getOrigin().y() - worldPt.y
      if (dx * dx + dy * dy < radius * radius) {
        bodies[i].activate()
        if (meshIsSplat[i]) wakeSplatBadge(i)
        const pushForce = PUSH_FORCE * (meshIsSplat[i] ? SPLAT_PUSH_FORCE_SCALE : 1)
        const imp = new AmmoLib.btVector3((Math.random() - 0.5) * pushForce, pushForce * 0.5, 0)
        bodies[i].applyCentralImpulse(imp)
        AmmoLib.destroy(imp)
      }
    }
  }
}

function onGlobalPointerDown(e: PointerEvent) {
  if (!isPointOverContainer(e.clientX, e.clientY) || !AmmoLib || !camera || !renderer) return
  if (isInteractiveUiTarget(e.target)) return

  pendingPhysicsTap = true
  tapDownX = e.clientX
  tapDownY = e.clientY
  tapPointerId = e.pointerId
}

function onGlobalPointerMove(e: PointerEvent) {
  if (!pendingPhysicsTap || e.pointerId !== tapPointerId) return
  const dx = e.clientX - tapDownX
  const dy = e.clientY - tapDownY
  if (dx * dx + dy * dy > TAP_SLOP_PX * TAP_SLOP_PX) {
    pendingPhysicsTap = false
  }
}

function onGlobalPointerUp(e: PointerEvent) {
  if (e.pointerId !== tapPointerId) return
  const shouldTap = pendingPhysicsTap
  pendingPhysicsTap = false
  tapPointerId = -1
  if (!shouldTap) return
  applyTapImpulseAtScreen(tapDownX, tapDownY)
}

function onGlobalPointerCancel(e: PointerEvent) {
  if (e.pointerId !== tapPointerId) return
  pendingPhysicsTap = false
  tapPointerId = -1
}

function updatePhysics(){
  if(!tempVec3) return

  const rfBase = motionCfg().randomForce
  for (let i = 0; i < bodies.length; i++) {
    const rf = rfBase * (meshIsSplat[i] ? SPLAT_RANDOM_FORCE_SCALE : 1)
    tempVec3.setValue((Math.random() - 0.5) * rf, (Math.random() - 0.5) * rf, 0)
    bodies[i].applyCentralForce(tempVec3)
  }

  physicsWorld.stepSimulation(1/60,5)

  const viewBottomY = viewCenterY - viewHeight / 2
  const viewTopY = viewCenterY + viewHeight / 2
  const minY = viewBottomY - 1.5
  const maxY = viewTopY + 1.5
  const marginX = boundX * 1.4

  const wallBounce = props.motionPreset === "wallBounce"
  /** 玩法盒外略放宽，检出穿模/数值飞出后拉回中心 */
  const escapeSlack = 1.0

  for(let i=0;i<bodies.length;i++){

    const body=bodies[i]
    const mesh=meshes[i]

    const transform=body.getWorldTransform()

    const pos=transform.getOrigin()

    let px = pos.x()
    let py = pos.y()
    const pz = PLANE_Z

    let outOfBounds: boolean
    if (wallBounce) {
      outOfBounds =
        px < -boundX - escapeSlack ||
        px > boundX + escapeSlack ||
        py < playInnerBottomY - escapeSlack ||
        py > playInnerTopY + escapeSlack ||
        Math.abs(pos.z()) > boundZ + escapeSlack
    } else {
      outOfBounds =
        px < -marginX || px > marginX ||
        py < minY || py > maxY
    }

    if(outOfBounds){
      if (wallBounce) {
        px = 0
        py = bounceArenaMidY
      } else {
        px = (Math.random() - 0.5) * boundX * 1.6
        py = 6 + Math.random() * 4
      }
      tempVec3.setValue(px, py, PLANE_Z)
      transform.setOrigin(tempVec3)
      body.setWorldTransform(transform)
      if (wallBounce) {
        const minSpeed = meshIsSplat[i] ? SPLAT_WALL_BOUNCE_MIN_SPEED : WALL_BOUNCE_MIN_LINEAR_SPEED
        const a = Math.random() * Math.PI * 2
        tempVec3.setValue(
          Math.cos(a) * minSpeed,
          Math.sin(a) * minSpeed,
          0
        )
        body.setLinearVelocity(tempVec3)
        if (meshIsSplat[i]) applySplatYawSpin(body, 1.6)
        else body.setAngularVelocity(zeroVec3)
      } else {
        body.setLinearVelocity(zeroVec3)
        body.setAngularVelocity(zeroVec3)
      }
    } else {
      tempVec3.setValue(px, py, PLANE_Z)
      transform.setOrigin(tempVec3)
      body.setWorldTransform(transform)
      const vel = body.getLinearVelocity()
      let vx = vel.x()
      let vy = vel.y()
      if (wallBounce) {
        const minSpeed = meshIsSplat[i] ? SPLAT_WALL_BOUNCE_MIN_SPEED : WALL_BOUNCE_MIN_LINEAR_SPEED
        const sp = Math.hypot(vx, vy)
        if (sp < minSpeed) {
          if (sp > 1e-5) {
            const s = minSpeed / sp
            vx *= s
            vy *= s
          } else if (!meshIsSplat[i]) {
            const a = Math.random() * Math.PI * 2
            vx = Math.cos(a) * minSpeed
            vy = Math.sin(a) * minSpeed
          } else {
            vx = 0
            vy = 0
          }
        }
      }
      if (meshIsSplat[i] && Math.hypot(vx, vy) < SPLAT_VELOCITY_SLEEP_THRESHOLD) {
        vx = 0
        vy = 0
        body.setAngularVelocity(zeroVec3)
        if (meshSnapshots[i]) meshSnapshots[i].splatSleeping = true
      } else if (meshIsSplat[i] && meshSnapshots[i]) {
        meshSnapshots[i].splatSleeping = false
      }
      tempVec3.setValue(vx, vy, 0)
      body.setLinearVelocity(tempVec3)
    }

    const rotQuat = body.getWorldTransform().getRotation()
    mesh.quaternion.set(rotQuat.x(), rotQuat.y(), rotQuat.z(), rotQuat.w())

    if (meshIsSplat[i]) {
      constrainSplatRotation(mesh, body)
    }

    const offset = meshCenterOffsets[i]
    if (offset && (offset.x !== 0 || offset.y !== 0 || offset.z !== 0)) {
      tmpMeshWorldCenter.copy(offset).applyQuaternion(mesh.quaternion)
      mesh.position.set(
        px - tmpMeshWorldCenter.x,
        py - tmpMeshWorldCenter.y,
        pz - tmpMeshWorldCenter.z
      )
    } else {
      mesh.position.set(px, py, pz)
    }
  }
}

function animate(now = 0){
  if (disposed) return

  animationId=requestAnimationFrame(animate)

  if (!lastAnimTime) lastAnimTime = now
  const frameDelta = Math.min((now - lastAnimTime) / 1000, PHYSICS_MAX_FRAME_DELTA)
  lastAnimTime = now
  physicsAccumulator += frameDelta

  let steps = 0
  while (physicsAccumulator >= PHYSICS_FIXED_DT && steps < PHYSICS_MAX_STEPS_PER_FRAME) {
    if (meshSnapshots.length > 0) saveMeshPhysicsPrev()
    updatePhysics()
    captureMeshPhysicsState()
    physicsAccumulator -= PHYSICS_FIXED_DT
    steps++
  }

  const alpha =
    PHYSICS_FIXED_DT > 0 ? physicsAccumulator / PHYSICS_FIXED_DT : 0
  applyInterpolatedMeshTransforms(alpha)

  renderer.render(scene,camera)
}

async function syncBadges(list: UserDeco[]) {
  if (!scene || !physicsWorld || disposed) return

  const targetList = list ?? []
  /** 空列表：只清空徽章，保留镜头/物理世界，供父级切换衣柜时复用场景 */
  if (targetList.length === 0) {
    badgeGeneration++
    clearAllBadges()
    return
  }

  const targetKeys = targetList.map(getBadgeKey)
  const gen = ++badgeGeneration

  for (let i = meshes.length - 1; i >= 0; i--) {
    const key = (meshes[i].userData as { badgeKey?: string }).badgeKey ?? ''
    if (!targetKeys.includes(key)) removeBadgeAt(i)
  }

  const existingKeys = new Set(
    meshes.map((mesh) => (mesh.userData as { badgeKey?: string }).badgeKey ?? '')
  )

  for (const deco of targetList) {
    if (disposed || gen !== badgeGeneration) return
    const key = getBadgeKey(deco)
    if (existingKeys.has(key)) continue
    await createBadge(deco, key)
    existingKeys.add(key)
  }
}

watch(
  () => props.motionPreset,
  () => {
    applyMotionPresetToWorld()
    updateCameraAndBounds()
  }
)

watch(
  () => props.badges,
  (list) => {
    void syncBadges(list ?? [])
  },
  { deep: true }
)

onMounted(async()=>{

  await initAmmo()

  initScene()

  initPhysics()

  createBounds()

  await syncBadges(props.badges)

  animate()

  resizeObserver = new ResizeObserver(()=>{
    updateCameraAndBounds()
  })
  const el = containerRef.value
  if(el) resizeObserver.observe(el)

  /** 捕获阶段：先根据展示区坐标算冲量，但不阻止默认行为，下层按钮仍可响应点击 */
  document.addEventListener("pointerdown", onGlobalPointerDown, true)
  document.addEventListener("pointermove", onGlobalPointerMove, true)
  document.addEventListener("pointerup", onGlobalPointerUp, true)
  document.addEventListener("pointercancel", onGlobalPointerCancel, true)
})

onBeforeUnmount(()=>{
  disposed = true
  badgeGeneration++

  document.removeEventListener("pointerdown", onGlobalPointerDown, true)
  document.removeEventListener("pointermove", onGlobalPointerMove, true)
  document.removeEventListener("pointerup", onGlobalPointerUp, true)
  document.removeEventListener("pointercancel", onGlobalPointerCancel, true)

  resizeObserver?.disconnect()
  resizeObserver = null
  cancelAnimationFrame(animationId)

  clearAllBadges()
  clearBounds()

  if (scene) disposeBadgeSparkContext(sparkCtx, scene)

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }

  if(AmmoLib && tempVec3){ AmmoLib.destroy(tempVec3); tempVec3 = null }
  if(AmmoLib && zeroVec3){ AmmoLib.destroy(zeroVec3); zeroVec3 = null }

  physicsWorld = null
})
</script>

<style scoped>
.badge-3d-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  pointer-events: none;
  user-select: none;
}
.badge-3d-container :deep(canvas) {
  display: block;
  pointer-events: none;
}
</style>