<template>
  <div ref="containerRef" class="physics-drop-container">
    <!-- Three.js 画布 -->
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { BASE_IMG_MODEL } from '@/utils/ipConfig'
import { Raycaster, Vector2 } from 'three'

// 定义接口 - 与父组件一致
interface ModelData {
  url: string
  name: string
  id: string | number
  options?: {
    useDracoLoader?: boolean
    dracoDecoderPath?: string
    [key: string]: unknown
  }
}

interface PhysicsBody {
  mesh: THREE.Object3D
  // biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
  body: any
  userData: ModelData
}

// 物理参数 - 参考 BadgePhysics，偏柔和
const HALF_HEIGHT = 8 // 视区半高（世界单位）
const MODEL_BASE_SIZE = 2
const GRAVITY_Y = -8
const RESTITUTION = 0.15
const FRICTION = 0.8
const LINEAR_DAMPING = 0.25
const ANGULAR_DAMPING = 1.5

// Props
const props = defineProps<{
  models?: ModelData[]
}>()

// Emits
const emit = defineEmits<{
  objectClick: [data: ModelData]
}>()

const containerRef = ref<HTMLElement | null>(null)
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let ammoInstance: any = null
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let physicsWorld: any = null
// biome-ignore lint/suspicious/noExplicitAny: ammo.js 缺少类型定义
let wallBodies: any[] = []
let physicsBodies: PhysicsBody[] = []
let animationId: number | null = null
let spawnTimer: ReturnType<typeof setInterval> | null = null
let lastTime = 0
let boundX = HALF_HEIGHT
let boundY = HALF_HEIGHT
let resizeObserver: ResizeObserver | null = null

// 缓存的模型模板
interface CachedModel {
  mesh: THREE.Object3D
  modelData: ModelData
  size: THREE.Vector3
  center: THREE.Vector3
}

let cachedModels: CachedModel[] = []
let modelsToLoad: ModelData[] = []

const SPAWN_INTERVAL = 1500
const MAX_MODELS = 50

// 初始化 Ammo.js
const initAmmo = async () => {
  try {
    // @ts-ignore - ammo.js 缺少类型定义
    const AmmoModule = await import('ammo.js')
    if (AmmoModule.default && typeof AmmoModule.default === 'function') {
      ammoInstance = await AmmoModule.default()
    } else if (typeof AmmoModule === 'function') {
      ammoInstance = await (AmmoModule as () => Promise<unknown>)()
    } else {
      ammoInstance = AmmoModule.default ?? AmmoModule
    }
    return ammoInstance
  } catch (err) {
    console.error('初始化 Ammo.js 失败:', err)
    throw err
  }
}

/** 根据视区宽高比计算物理边界 */
const computeBounds = () => {
  if (!containerRef.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  if (h <= 0) return
  const rawAspect = w / h
  const aspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1
  boundY = HALF_HEIGHT
  boundX = HALF_HEIGHT * aspect
}

const createPhysicsWorld = () => {
  if (!ammoInstance) return

  const collisionConfiguration = new ammoInstance.btDefaultCollisionConfiguration()
  const dispatcher = new ammoInstance.btCollisionDispatcher(collisionConfiguration)
  const overlappingPairCache = new ammoInstance.btDbvtBroadphase()
  const solver = new ammoInstance.btSequentialImpulseConstraintSolver()

  physicsWorld = new ammoInstance.btDiscreteDynamicsWorld(
    dispatcher,
    overlappingPairCache,
    solver,
    collisionConfiguration
  )

  physicsWorld.setGravity(new ammoInstance.btVector3(0, GRAVITY_Y, 0))

  wallBodies = []
  const createWall = (normal: [number, number, number], constant: number) => {
    const shape = new ammoInstance.btStaticPlaneShape(
      new ammoInstance.btVector3(...normal),
      constant
    )
    const transform = new ammoInstance.btTransform()
    transform.setIdentity()
    const motionState = new ammoInstance.btDefaultMotionState(transform)
    const rbInfo = new ammoInstance.btRigidBodyConstructionInfo(0, motionState, shape)
    const body = new ammoInstance.btRigidBody(rbInfo)
    body.setRestitution(RESTITUTION)
    physicsWorld.addRigidBody(body)
    wallBodies.push(body)
  }

  createWall([1, 0, 0], boundX)
  createWall([-1, 0, 0], boundX)
  createWall([0, 1, 0], boundY)
  createWall([0, -1, 0], boundY)
}

const destroyPhysicsWorld = () => {
  if (!ammoInstance || !physicsWorld) return
  for (const body of wallBodies) {
    try {
      physicsWorld.removeRigidBody(body)
      if (body.getMotionState) ammoInstance.destroy(body.getMotionState())
      if (body.getCollisionShape) ammoInstance.destroy(body.getCollisionShape())
      ammoInstance.destroy(body)
    } catch (_) {}
  }
  wallBodies = []
  physicsWorld = null
}

// 加载 3D 模型（不添加到场景，仅作模板）
const loadModel = (modelData: ModelData): Promise<CachedModel | null> => {
  const fullUrl = modelData.url.startsWith('http')
    ? modelData.url
    : `${BASE_IMG_MODEL}${modelData.url.startsWith('/') ? modelData.url.slice(1) : modelData.url}`

  const loader = new GLTFLoader()
  const useDraco = modelData.options?.useDracoLoader ?? false
  const dracoPath = modelData.options?.dracoDecoderPath || '/draco/gltf/'

  if (useDraco) {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(dracoPath)
    loader.setDRACOLoader(dracoLoader)
  }

  return new Promise((resolve) => {
    loader.load(
      fullUrl,
      (gltf) => {
        const mesh = gltf.scene
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        const box = new THREE.Box3().setFromObject(mesh)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        mesh.position.set(0, 0, 0)
        mesh.rotation.set(0, 0, 0)

        resolve({
          mesh,
          modelData,
          size: size,
          center: center
        })
      },
      undefined,
      (err) => {
        console.error('加载模型失败:', fullUrl, err)
        resolve(null)
      }
    )
  })
}

const createRigidBody = (
  pos: THREE.Vector3,
  halfExt: THREE.Vector3,
  quat?: THREE.Quaternion
) => {
  if (!ammoInstance || !physicsWorld) return null

  const margin = Math.min(halfExt.x, halfExt.y, halfExt.z) * 0.5
  const clampX = Math.max(-boundX + margin, Math.min(boundX - margin, pos.x))
  const clampY = Math.max(-boundY + margin, Math.min(boundY - margin, pos.y))
  const clampedPos = new THREE.Vector3(clampX, clampY, pos.z)

  const btHalfExt = new ammoInstance.btVector3(
    Math.max(halfExt.x, 0.1),
    Math.max(halfExt.y, 0.1),
    Math.max(halfExt.z, 0.05)
  )
  const shape = new ammoInstance.btBoxShape(btHalfExt)
  shape.setMargin(0.01)

  const transform = new ammoInstance.btTransform()
  transform.setIdentity()
  transform.setOrigin(new ammoInstance.btVector3(clampedPos.x, clampedPos.y, clampedPos.z))
  if (quat) {
    transform.setRotation(
      new ammoInstance.btQuaternion(quat.x, quat.y, quat.z, quat.w)
    )
  }

  const motionState = new ammoInstance.btDefaultMotionState(transform)
  const mass = 0.8
  const localInertia = new ammoInstance.btVector3(0, 0, 0)
  shape.calculateLocalInertia(mass, localInertia)

  const rbInfo = new ammoInstance.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia
  )
  const body = new ammoInstance.btRigidBody(rbInfo)
  body.setFriction(FRICTION)
  body.setRestitution(RESTITUTION)
  body.setDamping(LINEAR_DAMPING, ANGULAR_DAMPING)
  body.setActivationState(4)
  physicsWorld.addRigidBody(body)
  return body
}

const spawnModel = async (cachedModel: CachedModel) => {
  if (!scene || !ammoInstance || !physicsWorld) return

  try {
    const clonedMesh = cachedModel.mesh.clone(true)
    clonedMesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        try {
          child.material = (child.material as THREE.Material).clone()
        } catch (_) {}
      }
    })

    clonedMesh.userData.modelData = cachedModel.modelData
    clonedMesh.userData.name = cachedModel.modelData.name
    clonedMesh.userData.id = cachedModel.modelData.id

    const margin = cachedModel.size.length() * 0.5
    const startX = (Math.random() * 2 - 1) * Math.max(0, boundX - margin)
    const startY = boundY - cachedModel.size.y - Math.random() * 1.5
    const startZ = (Math.random() - 0.5) * 2

    const pos = new THREE.Vector3(
      startX - cachedModel.center.x,
      startY - cachedModel.center.y,
      startZ - cachedModel.center.z
    )

    const halfExt = cachedModel.size.clone().multiplyScalar(0.5)
    const body = createRigidBody(pos, halfExt)
    if (!body) return

    clonedMesh.position.copy(pos)
    scene.add(clonedMesh)
    physicsBodies.push({ mesh: clonedMesh, body, userData: cachedModel.modelData })

    // 限制数量
    if (physicsBodies.length > MAX_MODELS) {
      const toRemove = physicsBodies[0]
      if (toRemove) removePhysicsBody(toRemove)
    }
  } catch (err) {
    console.error('生成模型失败:', err)
  }
}

const removePhysicsBody = (pb: PhysicsBody) => {
  if (!ammoInstance || !physicsWorld || !scene) return
  const idx = physicsBodies.indexOf(pb)
  if (idx < 0) return
  try {
    physicsWorld.removeRigidBody(pb.body)
    if (pb.body.getMotionState) ammoInstance.destroy(pb.body.getMotionState())
    if (pb.body.getCollisionShape) ammoInstance.destroy(pb.body.getCollisionShape())
    ammoInstance.destroy(pb.body)
    scene.remove(pb.mesh)
    // 仅 dispose 材质（克隆时已单独复制），几何体与缓存共享不可 dispose
    pb.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose()
        } else {
          mat.dispose()
        }
      }
    })
    physicsBodies.splice(idx, 1)
  } catch (_) {}
}

const removeAllBodies = () => {
  if (!ammoInstance || !physicsWorld || !scene) return
  const copy = [...physicsBodies]
  for (const pb of copy) removePhysicsBody(pb)
}

/** 视区尺寸变化时重建物理世界 */
const refreshPhysicsForResize = () => {
  if (!ammoInstance || !scene || !physicsWorld || physicsBodies.length === 0) return

  const preserved = physicsBodies.map(({ mesh, userData }) => ({
    mesh,
    pos: mesh.position.clone(),
    quat: mesh.quaternion.clone(),
    userData,
    halfExt: new THREE.Vector3(MODEL_BASE_SIZE / 2, MODEL_BASE_SIZE / 2, 0.05)
  }))

  for (const { body } of physicsBodies) {
    physicsWorld.removeRigidBody(body)
    if (body.getMotionState) ammoInstance.destroy(body.getMotionState())
    if (body.getCollisionShape) ammoInstance.destroy(body.getCollisionShape())
    ammoInstance.destroy(body)
  }
  physicsBodies = []

  destroyPhysicsWorld()
  computeBounds()
  createPhysicsWorld()

  for (const { mesh, pos, quat, userData, halfExt } of preserved) {
    const body = createRigidBody(pos, halfExt, quat)
    if (body) physicsBodies.push({ mesh, body, userData })
  }
}

const animate = () => {
  animationId = requestAnimationFrame(animate)

  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now

  if (physicsWorld && physicsBodies.length > 0) {
    physicsWorld.stepSimulation(dt, 10, 1 / 60)
    for (const { mesh, body } of physicsBodies) {
      const transform = body.getWorldTransform()
      const pos = transform.getOrigin()
      const quat = transform.getRotation()
      mesh.position.set(pos.x(), pos.y(), pos.z())
      mesh.quaternion.set(quat.x(), quat.y(), quat.z(), quat.w())
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

const initScene = () => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  if (width <= 0 || height <= 0) return

  computeBounds()

  scene = new THREE.Scene()
  scene.background = null

  const aspect = width / height
  const camHeight = boundY * 2
  const camWidth = camHeight * aspect
  camera = new THREE.OrthographicCamera(
    -camWidth / 2,
    camWidth / 2,
    camHeight / 2,
    -camHeight / 2,
    0.1,
    1000
  )
  camera.position.set(0, 0, 20)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.pointerEvents = 'auto'
  containerRef.value.appendChild(renderer.domElement)

  createPhysicsWorld()
}

const loadModels = async (models: ModelData[]) => {
  cachedModels = []
  const results = await Promise.all(models.map((m) => loadModel(m)))
  cachedModels = results.filter((r): r is CachedModel => r !== null)
}

const startSpawning = async () => {
  const models = props.models ?? modelsToLoad
  if (models.length === 0) return

  removeAllBodies()
  await loadModels(models)
  if (cachedModels.length === 0) return

  spawnTimer = setInterval(() => {
    const idx = Math.floor(Math.random() * cachedModels.length)
    spawnModel(cachedModels[idx])
  }, SPAWN_INTERVAL)

  lastTime = performance.now()
  animate()
}

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
const handleResize = () => {
  if (!containerRef.value || !camera || !renderer) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  if (width <= 0 || height <= 0) return

  const newAspect = width / height
  const newBoundX = HALF_HEIGHT * newAspect
  const aspectChanged = Math.abs(newBoundX - boundX) > 0.01

  const camHeight = boundY * 2
  const camWidth = camHeight * newAspect

  camera.left = -camWidth / 2
  camera.right = camWidth / 2
  camera.top = camHeight / 2
  camera.bottom = -camHeight / 2
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)

  if (aspectChanged && physicsBodies.length > 0) {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      resizeTimeout = null
      refreshPhysicsForResize()
    }, 150)
  }
}

const raycaster = new Raycaster()
const mouse = new Vector2()

const handleCanvasClick = (event: MouseEvent | TouchEvent) => {
  if (!camera || !scene || !renderer) return

  let clientX: number
  let clientY: number
  if ('touches' in event) {
    const t = ('changedTouches' in event && event.changedTouches.length) ? event.changedTouches[0] : event.touches[0]
    clientX = t.clientX
    clientY = t.clientY
  } else {
    clientX = event.clientX
    clientY = event.clientY
  }

  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const targets = physicsBodies.map(({ mesh }) => mesh)
  const hits = raycaster.intersectObjects(targets, true)

  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      const ud = (obj as THREE.Object3D & { userData?: { modelData?: ModelData } }).userData
      if (ud?.modelData) {
        event.preventDefault()
        event.stopPropagation()
        emit('objectClick', ud.modelData)
        return
      }
      obj = obj.parent
    }
  }
}

const initWhenReady = async () => {
  if (!containerRef.value) return
  const models = props.models ?? modelsToLoad
  if (models.length === 0) return

  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  if (w <= 0 || h <= 0) return

  try {
    if (!ammoInstance) await initAmmo()
    initScene()
    const canvas = renderer?.domElement
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick as EventListener)
      canvas.addEventListener('touchend', handleCanvasClick as EventListener)
    }
    await startSpawning()
  } catch (err) {
    console.error('物理掉落组件初始化失败:', err)
  }
}

const loadModelData = (models: ModelData[]) => {
  modelsToLoad = models
  if (scene && physicsWorld) {
    if (spawnTimer) {
      clearInterval(spawnTimer)
      spawnTimer = null
    }
    removeAllBodies()
    startSpawning()
  }
}

defineExpose({ loadModelData })

onMounted(async () => {
  modelsToLoad = props.models ?? []
  if (modelsToLoad.length === 0) return

  await initAmmo()
  window.addEventListener('resize', handleResize)

  await nextTick()
  const tryInit = () => {
    if (!containerRef.value || scene) return
    const w = containerRef.value.clientWidth
    const h = containerRef.value.clientHeight
    if (w > 0 && h > 0) {
      initWhenReady()
      return
    }
    requestAnimationFrame(tryInit)
  }
  tryInit()

  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value || !physicsWorld) return
    const w = containerRef.value.clientWidth
    const h = containerRef.value.clientHeight
    if (w <= 0 || h <= 0) return
    const newAspect = w / h
    const newBoundX = HALF_HEIGHT * newAspect
    if (Math.abs(newBoundX - boundX) > 0.01 && physicsBodies.length > 0) {
      refreshPhysicsForResize()
      if (camera && renderer) {
        computeBounds()
        const camHeight = boundY * 2
        const camWidth = camHeight * (w / h)
        camera.left = -camWidth / 2
        camera.right = camWidth / 2
        camera.top = camHeight / 2
        camera.bottom = -camHeight / 2
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    } else {
      handleResize()
    }
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
    resizeObserver = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }
  if (spawnTimer) {
    clearInterval(spawnTimer)
    spawnTimer = null
  }
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  const canvas = renderer?.domElement
  if (canvas) {
    canvas.removeEventListener('click', handleCanvasClick as EventListener)
    canvas.removeEventListener('touchend', handleCanvasClick as EventListener)
  }

  removeAllBodies()
  destroyPhysicsWorld()
  window.removeEventListener('resize', handleResize)

  // 释放缓存的模型资源
  for (const cached of cachedModels) {
    cached.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (child.material) {
          const mat = child.material
          if (Array.isArray(mat)) {
            for (const m of mat) m.dispose()
          } else {
            mat.dispose()
          }
        }
      }
    })
  }
  cachedModels = []

  if (renderer && containerRef.value && renderer.domElement.parentNode === containerRef.value) {
    containerRef.value.removeChild(renderer.domElement)
    renderer.dispose()
  }
  renderer = null
  scene = null
  camera = null
  physicsWorld = null
  ammoInstance = null
})

watch(
  () => props.models,
  async (newVal) => {
    const models = newVal ?? []
    if (models.length === 0) {
      if (spawnTimer) {
        clearInterval(spawnTimer)
        spawnTimer = null
      }
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
      removeAllBodies()
      return
    }
    modelsToLoad = models
    if (!scene || !physicsWorld) {
      try {
        if (!ammoInstance) await initAmmo()
        initScene()
        const canvas = renderer?.domElement
        if (canvas) {
          canvas.addEventListener('click', handleCanvasClick as EventListener)
          canvas.addEventListener('touchend', handleCanvasClick as EventListener)
        }
      } catch (err) {
        console.error('物理掉落组件初始化失败:', err)
        return
      }
    }
    if (spawnTimer) {
      clearInterval(spawnTimer)
      spawnTimer = null
    }
    await startSpawning()
  },
  { deep: true, immediate: false }
)
</script>

<style scoped>
.physics-drop-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
  touch-action: none;
}

.physics-drop-container canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: pointer;
  pointer-events: auto;
}
</style>
