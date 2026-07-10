import * as THREE from 'three'
import ThreeCore from '@/utils/threeCore'
import type {
  GalleryConfig,
  GalleryConfigFile,
  GalleryExhibit,
  GallerySceneObject,
  GalleryShopMarker
} from '@/types/gallery'
import { getLibraryById } from '@/api/library'
import { getShopDetail } from '@/api/shop'
import type { Library, Shop } from '@/types/api'
import { isSplatUrl } from '@/utils/materiaModelKind'
import {
  animateGalleryAssetScaleIn,
  applyGalleryObjectTransform,
  getGalleryTargetScale,
  killGalleryAssetScaleTweens,
  loadGallerySceneObject,
  resolveGalleryObjectType
} from '@/utils/gallerySceneObject'
import { resolveShopLogoUrl } from '@/utils/galleryShopMarker'
import {
  createMapBoundaryAABB,
  createRotatedAABB,
  tryMoveCircle,
  type AABB2D
} from '@/utils/galleryCollision'
import { defaultGalleryConfig } from '@/utils/galleryConfig'
import { GalleryPlayerController } from '@/utils/galleryPlayer'

/** 相机俯视角度（弧度） */
const CAMERA_PITCH = Math.PI / 4
/** 相机与玩家默认水平距离 */
const CAMERA_DISTANCE_DEFAULT = 8
const CAMERA_DISTANCE_MIN = 3
const CAMERA_DISTANCE_MAX = 18
/** 滚轮缩放灵敏度 */
const WHEEL_ZOOM_SPEED = 0.008
/** 双指捏合缩放灵敏度 */
const PINCH_ZOOM_SPEED = 0.025
/** 展馆环境光 / 主光（压暗整体场景） */
const GALLERY_AMBIENT = 0.6
const GALLERY_DIRECTIONAL = 0.8
/** 无点云时的曝光；略低于 1.0 配合压暗灯光 */
const GALLERY_EXPOSURE = 0.92
/** 有点云时的曝光：轻微补偿即可，避免 threeCore splat 自动 1.2x 导致偏灰 */
const GALLERY_EXPOSURE_SPLAT = 1.05

export interface GalleryWalkthroughState {
  loading: boolean
  loadProgress: number
  error: string | null
  playerX: number
  playerZ: number
  cameraYaw: number
  nearbyExhibit: GalleryExhibit | null
  selectedExhibit: GalleryExhibit | null
  isMobile: boolean
}

export function useGalleryWalkthrough() {
  const threeCore = shallowRef<ThreeCore | null>(null)
  const containerRef = ref<HTMLElement | null>(null)

  const loading = ref(false)
  const loadProgress = ref(0)
  const error = ref<string | null>(null)
  const galleryConfig = shallowRef<GalleryConfig>(defaultGalleryConfig)
  const galleryName = ref('')
  const playerX = ref(0)
  const playerZ = ref(0)
  const cameraYaw = ref(0)
  const cameraDistance = ref(CAMERA_DISTANCE_DEFAULT)
  const nearbyExhibit = ref<GalleryExhibit | null>(null)
  const selectedExhibit = ref<GalleryExhibit | null>(null)
  const nearbyShop = ref<GalleryShopMarker | null>(null)
  const selectedShop = ref<GalleryShopMarker | null>(null)
  const shopPanelOpen = ref(false)
  const selectedShopDetail = ref<Shop | null>(null)
  const shopDetailLoading = ref(false)
  const shopDetailError = ref<string | null>(null)
  const selectedLibrary = ref<Library | null>(null)
  const selectedLibraryTitle = ref('')
  const libraryLoading = ref(false)
  const shopVideosLoading = ref(false)
  const isMobile = ref(false)

  // --- 内部状态 ---
  let playerController: GalleryPlayerController | null = null
  let exhibitGroups: THREE.Group[] = []
  let shopGroups: THREE.Group[] = []
  let colliders: AABB2D[] = []
  let boundary: AABB2D
  const keys = { w: false, a: false, s: false, d: false }
  const joystickInput = { x: 0, y: 0 }
  let isRotating = false
  let lastPointerX = 0
  let pointerDownX = 0
  let pointerDownY = 0
  let pointerHasMoved = false
  const POINTER_MOVE_THRESHOLD = 5
  const activePointers = new Map<number, { x: number; y: number }>()
  let isPinching = false
  let lastPinchDistance = 0
  let clock: THREE.Clock
  let exhibitClickables: THREE.Object3D[] = []
  let shopClickables: THREE.Object3D[] = []
  let videoClickables: THREE.Object3D[] = []
  let shopVideoGroup: THREE.Group | null = null
  let loadedShopKey: string | null = null
  const textureLoader = new THREE.TextureLoader()
  let disposed = false

  let config: GalleryConfig = defaultGalleryConfig
  let moveSpeed = 5

  /** 展馆专用色彩：压暗场景，点云用 Reinhard + 低曝光补偿（不用 anime 避免偏灰） */
  const applyGalleryRenderSettings = (core: ThreeCore, withSplats: boolean) => {
    if (core.lights) {
      core.lights.ambient.intensity = GALLERY_AMBIENT
      core.lights.directional.intensity = GALLERY_DIRECTIONAL
      core.lights.directional.position.set(5, 10, 5)
    }
    core.syncSceneColorSpaces()
    core.setToneMapping(
      withSplats ? GALLERY_EXPOSURE_SPLAT : GALLERY_EXPOSURE,
      THREE.ReinhardToneMapping
    )
  }
  let playerRadius = 0.4
  let interactDistance = 2

  const applyConfig = (next: GalleryConfig, name = '') => {
    config = next
    galleryConfig.value = next
    galleryName.value = name
    moveSpeed = next.moveSpeed ?? 5
    playerRadius = next.playerRadius ?? 0.4
    interactDistance = next.interactDistance ?? 2
    playerX.value = next.playerStart?.[0] ?? 0
    playerZ.value = next.playerStart?.[1] ?? 0
    cameraYaw.value = 0
    cameraDistance.value = CAMERA_DISTANCE_DEFAULT
  }

  applyConfig(defaultGalleryConfig)

  const checkMobile = () => {
    if (!import.meta.client) return
    isMobile.value =
      window.innerWidth < 768
      || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  /** 构建碰撞体列表 */
  const buildColliders = () => {
    colliders = []
    for (const wall of config.walls) {
      colliders.push(
        createRotatedAABB(
          wall.position[0],
          wall.position[1],
          wall.size[0],
          wall.size[1],
          wall.rotation ?? 0
        )
      )
    }
    for (const ex of config.exhibits) {
      colliders.push(
        createRotatedAABB(
          ex.position[0],
          ex.position[1],
          ex.size[0],
          ex.size[1],
          ex.rotation ?? 0
        )
      )
    }
    boundary = createMapBoundaryAABB(
      config.mapSize.width,
      config.mapSize.depth,
      playerRadius
    )
  }

  /** 创建地面与网格 */
  const createFloor = (scene: THREE.Scene) => {
    const { width, depth } = config.mapSize

    const floorGeo = new THREE.PlaneGeometry(width, depth)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf5eef2,
      roughness: 0.85,
      metalness: 0.05
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floor.userData.isGalleryFloor = true
    scene.add(floor)

    const grid = new THREE.GridHelper(
      Math.max(width, depth),
      Math.max(width, depth),
      0xd48898,
      0xe8d0d8
    )
    grid.position.y = 0.01
    grid.userData.isGalleryGrid = true
    scene.add(grid)
  }

  /** 创建墙体 */
  const createWalls = (scene: THREE.Scene) => {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe8dce2,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    })

    for (const wall of config.walls) {
      const h = wall.height ?? 3
      const geo = new THREE.BoxGeometry(wall.size[0], h, wall.size[1])
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(wall.position[0], h / 2, wall.position[1])
      mesh.rotation.y = wall.rotation ?? 0
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.isGalleryWall = true
      scene.add(mesh)
    }
  }

  /** 加载玩家角色（sence/role/role.glb） */
  const createPlayer = async (core: ThreeCore, scene: THREE.Scene) => {
    playerController = await GalleryPlayerController.create(core, scene)
    playerController.setTransform(playerX.value, playerZ.value, cameraYaw.value)
  }

  /** 创建单个展品（展台 + 模型/占位） */
  const createExhibit = async (
    core: ThreeCore,
    exhibit: GalleryExhibit,
    index: number,
    total: number
  ): Promise<THREE.Group> => {
    const group = new THREE.Group()
    const [ex, ez] = exhibit.position
    const [sw, sd] = exhibit.size
    const pedH = exhibit.pedestalHeight ?? 0.8

    // 展台
    const pedGeo = new THREE.BoxGeometry(sw, pedH, sd)
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1
    })
    const pedestal = new THREE.Mesh(pedGeo, pedMat)
    pedestal.position.y = pedH / 2
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    group.add(pedestal)

    // 展品标签（CSS2D 替代：简单 3D 文字板）
    const labelGeo = new THREE.PlaneGeometry(1.2, 0.3)
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = 256
    labelCanvas.height = 64
    const ctx = labelCanvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(0, 0, 256, 64)
      ctx.fillStyle = '#d48898'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(exhibit.name, 128, 40)
      const labelTex = new THREE.CanvasTexture(labelCanvas)
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        side: THREE.DoubleSide
      })
      const label = new THREE.Mesh(labelGeo, labelMat)
      label.position.set(0, pedH + 1.5, 0)
      group.add(label)
    }

    // 点光源（展品局部照明）
    const light = new THREE.PointLight(0xfff0f5, 0.8, 6)
    light.position.set(0, pedH + 1.2, 0.5)
    group.add(light)

    group.position.set(ex, 0, ez)
    group.rotation.y = exhibit.rotation ?? 0
    group.userData.isGalleryExhibit = true
    group.userData.exhibitId = exhibit.id
    group.userData.exhibitData = exhibit

    // 加载 3D 模型 / 点云（SceneObjectJSON 对齐字段）
    if (exhibit.url) {
      try {
        const sceneObj: GallerySceneObject = {
          type: exhibit.type ?? (isSplatUrl(exhibit.url) ? 'splat' : 'model'),
          url: exhibit.url,
          options: exhibit.options,
          useDracoLoader: exhibit.useDracoLoader
        }
        const model = await loadGallerySceneObject(core, sceneObj, isMobile.value)
        if (!model) throw new Error('模型加载失败')
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetScale = Math.min(sw, sd) * 0.8 / maxDim
        model.scale.setScalar(targetScale)
        box.setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        model.position.y += pedH + (size.y * targetScale) / 2
        group.add(model)
      } catch (e) {
        console.warn(`展品模型加载失败: ${exhibit.name}`, e)
        const placeholderGeo = new THREE.BoxGeometry(sw * 0.6, sw * 0.6, sw * 0.6)
        const placeholderMat = new THREE.MeshStandardMaterial({
          color: 0xd48898,
          roughness: 0.5
        })
        const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat)
        placeholder.position.y = pedH + sw * 0.3
        group.add(placeholder)
      }
    } else {
      const placeholderGeo = new THREE.BoxGeometry(sw * 0.5, sw * 0.5, sw * 0.5)
      const placeholderMat = new THREE.MeshStandardMaterial({ color: 0xd48898 })
      const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat)
      placeholder.position.y = pedH + sw * 0.25
      group.add(placeholder)
    }

    loadProgress.value = Math.round(((index + 1) / total) * 100)
    return group
  }

  const loadTexture = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(
        url,
        tex => {
          tex.colorSpace = THREE.SRGBColorSpace
          resolve(tex)
        },
        undefined,
        reject
      )
    })

  /** 创建店铺名称牌（Canvas 纹理） */
  const createShopNamePlate = (name: string, y: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 96
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.roundRect(8, 8, 496, 80, 16)
      ctx.fill()
      ctx.fillStyle = '#d48898'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const displayName = name.length > 12 ? `${name.slice(0, 11)}…` : name
      ctx.fillText(displayName, 256, 48)
    }
    const tex = new THREE.CanvasTexture(canvas)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.28),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide
      })
    )
    mesh.position.y = y
    mesh.userData.isShopBillboard = true
    return mesh
  }

  /** 创建 fallback logo 纹理（logo 加载失败时） */
  const createFallbackLogoTexture = (name: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#fce4ec'
      ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = '#d48898'
      ctx.font = 'bold 96px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name.charAt(0) || '🛍', 128, 128)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  /** 创建单个店铺标点 */
  const createShopMarker = async (
    shop: GalleryShopMarker,
    index: number,
    total: number
  ): Promise<THREE.Group> => {
    const group = new THREE.Group()
    const [x, z] = shop.position
    const baseY = shop.y ?? 0

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 32),
      new THREE.MeshBasicMaterial({
        color: 0xd48898,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02 + baseY
    group.add(ring)

    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.07, 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xd48898, roughness: 0.45 })
    )
    pin.position.y = 0.55 + baseY
    pin.castShadow = true
    group.add(pin)

    const billboard = new THREE.Group()
    billboard.name = 'shop-billboard'
    billboard.position.y = baseY

    const logoMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide
    })
    const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), logoMat)
    logoPlane.position.y = 1.45
    logoPlane.userData.isShopBillboard = true

    const logoUrl = resolveShopLogoUrl(shop.shop_logo)
    if (logoUrl) {
      try {
        logoMat.map = await loadTexture(logoUrl)
      } catch {
        logoMat.map = createFallbackLogoTexture(shop.shop_name)
      }
    } else {
      logoMat.map = createFallbackLogoTexture(shop.shop_name)
    }

    const namePlate = createShopNamePlate(shop.shop_name, 2.05)
    billboard.add(logoPlane)
    billboard.add(namePlate)
    group.add(billboard)

    group.position.set(x, 0, z)
    group.userData.isGalleryShop = true
    group.userData.shopData = shop

    loadProgress.value = Math.round(((index + 1) / total) * 100)
    return group
  }

  /** 店铺标牌始终朝向相机 */
  const updateShopBillboards = (core: ThreeCore) => {
    const cam = core.camera
    for (const group of shopGroups) {
      const billboard = group.getObjectByName('shop-billboard')
      if (!billboard) continue
      const worldPos = new THREE.Vector3()
      billboard.getWorldPosition(worldPos)
      billboard.lookAt(cam.position.x, worldPos.y, cam.position.z)
    }
  }

  /** 限制相机距离 */
  const clampCameraDistance = (distance: number) =>
    Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, distance))

  const adjustCameraDistance = (delta: number) => {
    cameraDistance.value = clampCameraDistance(cameraDistance.value + delta)
  }

  const getPinchDistance = () => {
    const pts = [...activePointers.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
  }

  /** 更新追随相机 */
  const updateCamera = (core: ThreeCore) => {
    const cam = core.camera as THREE.PerspectiveCamera
    const yaw = cameraYaw.value
    const px = playerX.value
    const pz = playerZ.value
    const dist = cameraDistance.value
    const height = dist * Math.tan(CAMERA_PITCH)

    const offsetX = Math.sin(yaw) * dist
    const offsetZ = Math.cos(yaw) * dist

    cam.position.set(px - offsetX, height, pz - offsetZ)
    cam.lookAt(px, 0.8, pz)

    if (playerController) {
      playerController.setTransform(px, pz, yaw)
    }
  }

  /** 检测附近展品 */
  const updateNearbyExhibit = () => {
    let closest: GalleryExhibit | null = null
    let minDist = interactDistance

    for (const ex of config.exhibits) {
      const dx = playerX.value - ex.position[0]
      const dz = playerZ.value - ex.position[1]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < minDist) {
        minDist = dist
        closest = ex
      }
    }
    nearbyExhibit.value = closest
  }

  /** 检测附近店铺标点 */
  const updateNearbyShop = () => {
    let closest: GalleryShopMarker | null = null
    let minDist = interactDistance

    for (const shop of config.shops ?? []) {
      const dx = playerX.value - shop.position[0]
      const dz = playerZ.value - shop.position[1]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < minDist) {
        minDist = dist
        closest = shop
      }
    }
    nearbyShop.value = closest
  }

  /** 每帧更新：移动 + 相机 */
  const tick = (core: ThreeCore) => {
    const delta = clock.getDelta()

    // 输入方向（相对相机 yaw）
    let inputX = 0
    let inputZ = 0

    if (keys.w) inputZ += 1
    if (keys.s) inputZ -= 1
    if (keys.a) inputX += 1
    if (keys.d) inputX -= 1

    if (joystickInput.x !== 0 || joystickInput.y !== 0) {
      inputX = -joystickInput.x
      // 摇杆上推为负 y，对应前进（+Z 方向）
      inputZ = -joystickInput.y
    }

    const len = Math.sqrt(inputX * inputX + inputZ * inputZ)
    const isMoving = len > 0.01
    if (isMoving) {
      inputX /= len
      inputZ /= len

      const yaw = cameraYaw.value
      const worldX = inputX * Math.cos(yaw) + inputZ * Math.sin(yaw)
      const worldZ = -inputX * Math.sin(yaw) + inputZ * Math.cos(yaw)

      const dx = worldX * moveSpeed * delta
      const dz = worldZ * moveSpeed * delta

      const [nx, nz] = tryMoveCircle(
        playerX.value,
        playerZ.value,
        dx,
        dz,
        playerRadius,
        colliders,
        boundary
      )
      playerX.value = nx
      playerZ.value = nz
    }

    playerController?.update(delta, isMoving)

    updateCamera(core)
    updateShopBillboards(core)
    updateNearbyExhibit()
    updateNearbyShop()
  }

  /** 键盘事件 */
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w') keys.w = true
    if (k === 'a') keys.a = true
    if (k === 's') keys.s = true
    if (k === 'd') keys.d = true
    if (k === 'escape') {
      selectedExhibit.value = null
      shopPanelOpen.value = false
      selectedLibrary.value = null
      selectedLibraryTitle.value = ''
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w') keys.w = false
    if (k === 'a') keys.a = false
    if (k === 's') keys.s = false
    if (k === 'd') keys.d = false
  }

  /** 鼠标左键 / 单指触摸拖拽旋转视角；双指捏合缩放 */
  const onPointerDown = (e: PointerEvent) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.size >= 2) {
      isPinching = true
      isRotating = false
      lastPinchDistance = getPinchDistance()
      return
    }

    if (e.button !== 0) return
    isRotating = true
    lastPointerX = e.clientX
    pointerDownX = e.clientX
    pointerDownY = e.clientY
    pointerHasMoved = false
    containerRef.value?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (isPinching && activePointers.size >= 2) {
      const dist = getPinchDistance()
      if (lastPinchDistance > 0) {
        adjustCameraDistance((lastPinchDistance - dist) * PINCH_ZOOM_SPEED)
      }
      lastPinchDistance = dist
      return
    }

    if (!isRotating) return
    const dx = e.clientX - lastPointerX
    lastPointerX = e.clientX
    cameraYaw.value -= dx * 0.005
    if (
      Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY)
      > POINTER_MOVE_THRESHOLD
    ) {
      pointerHasMoved = true
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId)

    if (activePointers.size < 2) {
      isPinching = false
      lastPinchDistance = 0
    }

    if (containerRef.value?.hasPointerCapture(e.pointerId)) {
      containerRef.value.releasePointerCapture(e.pointerId)
    }
    isRotating = false
  }

  /** 滚轮缩放镜头 */
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    adjustCameraDistance(e.deltaY * WHEEL_ZOOM_SPEED)
  }

  const onContextMenu = (e: Event) => e.preventDefault()

  /** 卸载当前店铺 3D 藏品（含点云 Spark 同步） */
  const clearShopLibraryVideos = () => {
    const core = threeCore.value
    if (shopVideoGroup && core) {
      killGalleryAssetScaleTweens(shopVideoGroup)
      core.clearGroup(shopVideoGroup)
      applyGalleryRenderSettings(core, false)
    }
    shopVideoGroup = null
    videoClickables = []
    loadedShopKey = null
  }

  /** 并行加载店铺 objects 并加入场景（同时仅保留一组） */
  const loadShopObjects = async (shop: GalleryShopMarker) => {
    const core = threeCore.value
    if (!core) return

    const shopKey = `${shop.shop_id}@${shop.position.join(',')}`
    if (loadedShopKey === shopKey && shopVideoGroup) return

    clearShopLibraryVideos()
    loadedShopKey = shopKey

    const objects = shop.objects ?? []
    if (objects.length === 0) return

    const hasSplatVideo = objects.some(
      obj => resolveGalleryObjectType(obj) === 'splat'
    )

    shopVideosLoading.value = true
    const container = new THREE.Group()
    container.name = 'shop-library-videos'
    const [shopX, shopZ] = shop.position
    const shopY = shop.y ?? 0

    try {
      await Promise.all(
        objects.map(async (obj, index) => {
          try {
            const isSplat = resolveGalleryObjectType(obj) === 'splat'
            const asset = await loadGallerySceneObject(core, obj, isMobile.value)
            if (!asset) return

            applyGalleryObjectTransform(
              asset,
              obj,
              { x: shopX, y: shopY, z: shopZ },
              index
            )
            const targetScale = getGalleryTargetScale(obj.scale)
            asset.scale.set(0, 0, 0)

            const hitBox = new THREE.Mesh(
              new THREE.BoxGeometry(1.4, 2, 1.4),
              new THREE.MeshBasicMaterial({
                visible: false,
                depthWrite: false
              })
            )
            hitBox.position.y = 1
            hitBox.userData.galleryObjectData = obj
            asset.add(hitBox)
            videoClickables.push(hitBox)

            container.add(asset)
            animateGalleryAssetScaleIn(asset, targetScale, {
              isSplat,
              delay: index * 0.08
            })
          } catch (err) {
            console.warn(
              `[gallery] 模型加载失败 library_id=${obj.library_id ?? 'unknown'}`,
              err
            )
          }
        })
      )

      core.scene.add(container)
      shopVideoGroup = container
      applyGalleryRenderSettings(core, hasSplatVideo)
    } finally {
      shopVideosLoading.value = false
    }
  }

  /** 点击 3D 模型：拉取图鉴详情 */
  const openLibraryFromObject = async (obj: GallerySceneObject) => {
    if (!obj.library_id) return
    selectedLibrary.value = null
    selectedLibraryTitle.value = obj.title ?? ''
    libraryLoading.value = true
    try {
      selectedLibrary.value = await getLibraryById({
        library_id: obj.library_id,
        attributes: [
          'library_id',
          'name',
          'cover',
          'sale_time',
          'good_count',
          'collect_count',
          'wardrobe_count',
          'shop_id'
        ]
      })
    } catch (err) {
      console.error('[gallery] 图鉴加载失败', err)
    } finally {
      libraryLoading.value = false
    }
  }

  const isSameShopMarker = (
    a: GalleryShopMarker | null,
    b: GalleryShopMarker
  ) =>
    a != null
    && a.shop_id === b.shop_id
    && a.position[0] === b.position[0]
    && a.position[1] === b.position[1]

  /** 关闭店铺弹窗（保留已激活店铺与 3D 藏品） */
  const closeShopPanel = () => {
    shopPanelOpen.value = false
  }

  /** 激活店铺并打开弹窗 */
  const activateShop = (shop: GalleryShopMarker) => {
    selectedShop.value = shop
    shopPanelOpen.value = true
  }

  /** 根据 shop_id 拉取店铺详情 */
  const fetchShopDetail = async (marker: GalleryShopMarker) => {
    selectedShopDetail.value = null
    shopDetailError.value = null

    if (!marker.shop_id || marker.shop_id <= 0) {
      shopDetailError.value = '该标点暂无有效店铺'
      return
    }

    shopDetailLoading.value = true
    try {
      selectedShopDetail.value = await getShopDetail({ shop_id: marker.shop_id })
    } catch (err) {
      console.error('[gallery] 店铺详情加载失败', err)
      shopDetailError.value = '店铺信息加载失败，请稍后重试'
    } finally {
      shopDetailLoading.value = false
    }
  }

  watch(selectedShop, shop => {
    if (!shop) {
      clearShopLibraryVideos()
      selectedLibrary.value = null
      selectedLibraryTitle.value = ''
      selectedShopDetail.value = null
      shopDetailError.value = null
      shopDetailLoading.value = false
      return
    }
    void loadShopObjects(shop)
    void fetchShopDetail(shop)
  })

  /** 点击场景对象 */
  const onClick = (e: MouseEvent) => {
    if (pointerHasMoved) return
    const core = threeCore.value
    const el = containerRef.value
    if (!core || !el) return

    const rect = el.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, core.camera)

    const clickTargets = [
      ...videoClickables,
      ...shopClickables,
      ...exhibitClickables
    ]
    const hits = raycaster.intersectObjects(clickTargets, true)

    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object
      while (
        obj
        && !obj.userData.galleryObjectData
        && !obj.userData.shopData
        && !obj.userData.exhibitData
      ) {
        obj = obj.parent
      }
      if (obj?.userData.galleryObjectData) {
        void openLibraryFromObject(
          obj.userData.galleryObjectData as GallerySceneObject
        )
        return
      }
      if (obj?.userData.shopData) {
        const shop = obj.userData.shopData as GalleryShopMarker
        if (isSameShopMarker(selectedShop.value, shop)) {
          shopPanelOpen.value = true
        } else {
          activateShop(shop)
        }
        selectedExhibit.value = null
        selectedLibrary.value = null
        return
      }
      if (obj?.userData.exhibitData) {
        selectedExhibit.value = obj.userData.exhibitData as GalleryExhibit
        selectedShop.value = null
        shopPanelOpen.value = false
        selectedLibrary.value = null
      }
    }
  }

  /** 摇杆输入 */
  const setJoystickInput = (x: number, y: number) => {
    joystickInput.x = x
    joystickInput.y = y
  }

  const clearJoystickInput = () => {
    joystickInput.x = 0
    joystickInput.y = 0
  }

  /** 传送到展品前方 */
  const teleportToExhibit = (exhibit: GalleryExhibit) => {
    const yaw = cameraYaw.value
    const offsetX = Math.sin(yaw) * 2.5
    const offsetZ = Math.cos(yaw) * 2.5
    const targetX = exhibit.position[0] + offsetX
    const targetZ = exhibit.position[1] + offsetZ

    const [nx, nz] = tryMoveCircle(
      targetX,
      targetZ,
      0,
      0,
      playerRadius,
      colliders,
      boundary
    )
    playerX.value = nx
    playerZ.value = nz
    selectedExhibit.value = null
  }

  /** 初始化场景 */
  const init = async (
    container: HTMLElement,
    galleryConfigInput?: GalleryConfig | GalleryConfigFile
  ) => {
    disposed = false
    if (galleryConfigInput) {
      const name =
        'name' in galleryConfigInput ? (galleryConfigInput.name ?? '') : ''
      applyConfig(galleryConfigInput, name)
    }
    containerRef.value = container
    checkMobile()
    buildColliders()
    loading.value = true
    error.value = null
    loadProgress.value = 0

    try {
      const core = new ThreeCore({
        enableOrbitControls: false,
        enableRaycaster: false,
        enableCSS3DRenderer: false,
        alpha: false,
        clearColor: 0x1a1520,
        cameraPosition: {
          x: 0,
          y: CAMERA_DISTANCE_DEFAULT * Math.tan(CAMERA_PITCH),
          z: CAMERA_DISTANCE_DEFAULT
        },
        mobilePerfCap: isMobile.value,
        antialias: !isMobile.value
      })

      threeCore.value = core
      await core.whenRendererReady()
      await core.mount(container)

      // 禁用默认 OrbitControls
      if (core.controls) {
        core.controls.enabled = false
      }

      // 点云与 Bloom 不兼容；关闭后避免加载 splat 时整场景突然变暗
      core.toggleBloom(false)

      core.scene.background = new THREE.Color(0x1a1520)

      createFloor(core.scene)
      createWalls(core.scene)
      await createPlayer(core, core.scene)
      applyGalleryRenderSettings(core, false)

      const shops = config.shops ?? []
      const totalLoad = config.exhibits.length + shops.length

      for (let i = 0; i < shops.length; i++) {
        const group = await createShopMarker(shops[i], i, totalLoad || 1)
        core.scene.add(group)
        shopGroups.push(group)
        shopClickables.push(group)
      }

      for (let i = 0; i < config.exhibits.length; i++) {
        const group = await createExhibit(
          core,
          config.exhibits[i],
          shops.length + i,
          totalLoad || 1
        )
        core.scene.add(group)
        exhibitGroups.push(group)
        exhibitClickables.push(group)
      }
      if (totalLoad === 0) loadProgress.value = 100

      clock = new THREE.Clock()
      core.addAnimationFunc = () => {
        if (!disposed) tick(core)
      }

      updateCamera(core)
      await core.startAnimationLoop()

      // 绑定事件
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      container.addEventListener('pointerdown', onPointerDown)
      container.addEventListener('pointermove', onPointerMove)
      container.addEventListener('pointerup', onPointerUp)
      container.addEventListener('pointerleave', onPointerUp)
      container.addEventListener('pointercancel', onPointerUp)
      container.addEventListener('contextmenu', onContextMenu)
      container.addEventListener('click', onClick)
      container.addEventListener('wheel', onWheel, { passive: false })

      loading.value = false
    } catch (e) {
      console.error('展馆初始化失败:', e)
      error.value = e instanceof Error ? e.message : '展馆加载失败'
      loading.value = false
    }
  }

  /** 销毁 */
  const dispose = () => {
    disposed = true
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)

    const el = containerRef.value
    if (el) {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('click', onClick)
      el.removeEventListener('wheel', onWheel)
    }

    activePointers.clear()
    isPinching = false
    lastPinchDistance = 0
    clearShopLibraryVideos()

    if (threeCore.value) {
      threeCore.value.dispose()
      threeCore.value = null
    }

    playerController?.dispose()
    playerController = null
    exhibitGroups = []
    shopGroups = []
    exhibitClickables = []
    shopClickables = []
  }

  return {
    threeCore,
    containerRef,
    loading,
    loadProgress,
    error,
    playerX,
    playerZ,
    cameraYaw,
    nearbyExhibit,
    selectedExhibit,
    nearbyShop,
    selectedShop,
    shopPanelOpen,
    selectedShopDetail,
    shopDetailLoading,
    shopDetailError,
    selectedLibrary,
    selectedLibraryTitle,
    libraryLoading,
    shopVideosLoading,
    isMobile,
    galleryName,
    init,
    dispose,
    setJoystickInput,
    clearJoystickInput,
    teleportToExhibit,
    closeShopPanel,
    config: galleryConfig
  }
}
