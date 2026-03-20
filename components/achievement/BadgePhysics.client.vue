<template>
  <div ref="containerRef" class="badge-3d-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import type { UserDeco } from "@/types/api"
import { BASE_IMG, BASE_IMG_MODEL } from "@/utils/ipConfig"

const props = defineProps<{
  badges: UserDeco[]
}>()

function isModelCover(cover: string | undefined): boolean {
  if (!cover) return false
  const low = cover.toLowerCase()
  return low.endsWith(".glb") || low.endsWith(".gltf")
}

function getModelUrl(cover: string): string {
  if (cover.startsWith("http")) return cover
  const path = cover.startsWith("/") ? cover.slice(1) : cover
  return `${BASE_IMG_MODEL}${path}`
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
const bodies: any[] = []
const wallBodies: any[] = []
const boundDebugLines: THREE.LineSegments[] = []

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const PLANE_Z = 0
const intersectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANE_Z)
const intersectPoint = new THREE.Vector3()

let lastPointerX = 0
let lastPointerY = 0
let hasPointerPos = false

let animationId = 0
let resizeObserver: ResizeObserver | null = null

const BADGE_SIZE = 1.2
const BADGE_DEPTH = 0.18

const GRAVITY = -6
const BOUND_SCALE = 0.9
const RANDOM_FORCE = 2.5
const PUSH_FORCE = 15
const DRAG_FORCE = 0.8

let boundX = 6
let boundZ = 4
let viewHeight = 12
const viewCenterY = 1.2

/** 基准宽高比，该比例下缩放为 1 */
const TARGET_ASPECT = 16 / 9

/** 根据容器比例计算缩放系数，16:9 时为 1 */
function getAspectScale(width: number, height: number): number {
  const aspect = width / height
  return aspect / TARGET_ASPECT
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
  tempVec3.setValue(0, GRAVITY, 0)
  physicsWorld.setGravity(tempVec3)
}

function createWallDebugVisual(sizeX:number,sizeY:number,sizeZ:number,pos:THREE.Vector3){
  const geo=new THREE.BoxGeometry(sizeX,sizeY,sizeZ)
  const edges=new THREE.EdgesGeometry(geo)
  const line=new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({color:0xff6600,linewidth:2})
  )
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
  body.setRestitution(0.75)

  physicsWorld.addRigidBody(body)
  wallBodies.push(body)
}

function clearBounds(){
  for(const body of wallBodies){
    physicsWorld.removeRigidBody(body)
  }
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
  const height=viewHeight * BOUND_SCALE
  const viewBottomY = viewCenterY - viewHeight / 2
  const floorTopY = viewBottomY
  const floorCenterY = floorTopY - wall / 2
  const wallBottomY = floorTopY
  const wallCenterY = wallBottomY + height / 2

  // floor - 贴视区底部
  createWall(boundX*2,wall,boundZ*2,new THREE.Vector3(0,floorCenterY,0))

  // left
  createWall(wall,height,boundZ*2,new THREE.Vector3(-boundX,wallCenterY,0))

  // right
  createWall(wall,height,boundZ*2,new THREE.Vector3(boundX,wallCenterY,0))

  // back
  createWall(boundX*2,height,wall,new THREE.Vector3(0,wallCenterY,-boundZ))

  // front
  createWall(boundX*2,height,wall,new THREE.Vector3(0,wallCenterY,boundZ))
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

function createRigidBody(mesh:THREE.Object3D, halfExt?: THREE.Vector3, bodyPos?: THREE.Vector3){

  const shape = halfExt
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

  const mass=1

  const inertia=new AmmoLib.btVector3(0,0,0)

  shape.calculateLocalInertia(mass,inertia)

  const rbInfo=new AmmoLib.btRigidBodyConstructionInfo(
    mass,
    motion,
    shape,
    inertia
  )

  const body=new AmmoLib.btRigidBody(rbInfo)

  body.setFriction(0.4)
  body.setRestitution(0.75)

  body.setDamping(
    0.15,
    0.25
  )

  physicsWorld.addRigidBody(body)

  bodies.push(body)
}

function loadGlbModel(url: string): Promise<{ mesh: THREE.Object3D; size: THREE.Vector3; center: THREE.Vector3 } | null>{
  return new Promise((resolve)=>{
    const dracoLoader = new DRACOLoader()
    const decoderPath = '/draco/gltf/'
    dracoLoader.setDecoderPath(decoderPath)
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)
    loader.load(
      url,
      (gltf)=>{
        const mesh = gltf.scene
        mesh.traverse((child)=>{
          if (child instanceof THREE.Mesh) {
            if (child.material && !Array.isArray(child.material)) {
              (child.material as THREE.MeshStandardMaterial).color?.setHex(0xffffff)
            }
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
      (err)=>{ console.error("[BadgePhysics] 加载模型失败:", url, err); resolve(null) }
    )
  })
}

function getBadgeIndexFromHit(obj: THREE.Object3D): number {
  let o: THREE.Object3D | null = obj
  while (o?.parent && o.parent !== scene) o = o.parent as THREE.Object3D
  if (!o) return -1
  const idx = (o as THREE.Object3D & { userData?: { badgeIndex?: number } }).userData?.badgeIndex
  return idx !== undefined ? idx : meshes.indexOf(o)
}

async function createBadge(deco:UserDeco){
  const cover = deco.foreign?.cover ?? ""
  const isModel = isModelCover(cover)

  let mesh: THREE.Object3D
  let centerOffset = new THREE.Vector3(0, 0, 0)

  if (isModel) {
    const url = cover.startsWith("http") ? cover : getModelUrl(cover)
    const loaded = await loadGlbModel(url)
    if (!loaded) return
    mesh = loaded.mesh.clone(true)
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        try {
          child.material = (child.material as THREE.Material).clone()
        } catch (_) {}
      }
    })
    // 根据容器比例设置模型缩放，16:9 时为 1
    const el = containerRef.value
    const modelScale = el ? getAspectScale(el.clientWidth, el.clientHeight) : 1
    mesh.scale.setScalar(modelScale)
    centerOffset.copy(loaded.center)
    const halfExt = loaded.size.clone().multiplyScalar(0.5).multiplyScalar(modelScale)
    mesh.position.set(
      (Math.random() - 0.5) * boundX * 1.5,
      6 + Math.random() * 4,
      PLANE_Z
    )
    mesh.position.sub(centerOffset)
    mesh.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4)
    const bodyPos = mesh.position.clone().add(centerOffset)
    scene.add(mesh)
    meshes.push(mesh)
    meshCenterOffsets.push(centerOffset.clone())
    createRigidBody(mesh, halfExt, bodyPos)
  } else {
    const texture = await new THREE.TextureLoader().loadAsync(getCoverUrl(deco))
    const radius = BADGE_SIZE / 2
    const geo = new THREE.SphereGeometry(radius, 32, 32)
    const material = new THREE.MeshBasicMaterial({ map: texture, color: "#ffffff" })
    mesh = new THREE.Mesh(geo, material)
    mesh.position.set(
      (Math.random() - 0.5) * boundX * 1.5,
      6 + Math.random() * 4,
      PLANE_Z
    )
    mesh.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4)
    scene.add(mesh)
    meshes.push(mesh)
    meshCenterOffsets.push(new THREE.Vector3(0, 0, 0))
    createRigidBody(mesh)
  }

  mesh.userData = mesh.userData || {}
  const ud = mesh.userData as { badgeIndex: number; deco: UserDeco }
  ud.badgeIndex = meshes.length - 1
  ud.deco = deco
}

function getWorldPointFromPointer(clientX: number, clientY: number): THREE.Vector3 | null{
  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  return raycaster.ray.intersectPlane(intersectPlane, intersectPoint) ? intersectPoint.clone() : null
}

function applyForceFromPointer(clientX: number, clientY: number, forceX: number, forceY: number){
  const worldPt = getWorldPointFromPointer(clientX, clientY)
  if(!worldPt || !AmmoLib || !tempVec3) return
  const radius = boundX * 0.6
  for(let i = 0; i < bodies.length; i++){
    const body = bodies[i]
    const trans = body.getWorldTransform()
    const ox = trans.getOrigin().x()
    const oy = trans.getOrigin().y()
    const dx = ox - worldPt.x
    const dy = oy - worldPt.y
    const distSq = dx * dx + dy * dy
    if(distSq < radius * radius){
      const body = bodies[i]
      body.activate()
      const f = 1 - Math.sqrt(distSq) / radius
      const vec = new AmmoLib.btVector3(forceX * f, forceY * f, 0)
      body.applyCentralForce(vec)
      AmmoLib.destroy(vec)
    }
  }
}

function onPointerDown(e: PointerEvent){
  e.preventDefault()
 ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  hasPointerPos = true
  const worldPt = getWorldPointFromPointer(e.clientX, e.clientY)
  if(!worldPt || !AmmoLib || !tempVec3) return
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(meshes, true)
  for(const hit of intersects){
    const idx = getBadgeIndexFromHit(hit.object as THREE.Object3D)
    if(idx >= 0){
      const deco = (meshes[idx]?.userData as { deco?: UserDeco })?.deco ?? props.badges[idx]
      console.log("[BadgePhysics] 点击物体:", { index: idx, hitPoint: hit.point, deco })
      const body = bodies[idx]
      const dx = hit.point.x - worldPt.x
      const dy = hit.point.y - worldPt.y
      const len = Math.sqrt(dx*dx + dy*dy) || 1
      body.activate()
      const imp = new AmmoLib.btVector3((dx/len) * PUSH_FORCE, (dy/len) * PUSH_FORCE + 3, 0)
      body.applyCentralImpulse(imp)
      AmmoLib.destroy(imp)
    }
  }
  if(intersects.length === 0){
    const radius = boundX * 0.5
    for(let i = 0; i < bodies.length; i++){
      const trans = bodies[i].getWorldTransform()
      const dx = trans.getOrigin().x() - worldPt.x
      const dy = trans.getOrigin().y() - worldPt.y
      if(dx*dx + dy*dy < radius*radius){
        bodies[i].activate()
        const imp = new AmmoLib.btVector3((Math.random()-0.5)*PUSH_FORCE, PUSH_FORCE * 0.5, 0)
        bodies[i].applyCentralImpulse(imp)
        AmmoLib.destroy(imp)
      }
    }
  }
}

function onPointerUp(e: PointerEvent){
  e.preventDefault()
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch (_) {}
}

function onPointerMove(e: PointerEvent){
  if(!hasPointerPos){
    lastPointerX = e.clientX
    lastPointerY = e.clientY
    hasPointerPos = true
    return
  }
  const dx = (e.clientX - lastPointerX) * DRAG_FORCE
  const dy = (e.clientY - lastPointerY) * DRAG_FORCE
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  if(Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5){
    applyForceFromPointer(e.clientX, e.clientY, dx, -dy)
  }
}

function updatePhysics(){
  if(!tempVec3) return

  for(const body of bodies){
    tempVec3.setValue((Math.random()-0.5)*RANDOM_FORCE,(Math.random()-0.5)*RANDOM_FORCE,0)
    body.applyCentralForce(tempVec3)
  }

  physicsWorld.stepSimulation(1/60,5)

  const viewBottomY = viewCenterY - viewHeight / 2
  const minY = viewBottomY - 1.5
  const maxY = viewCenterY + viewHeight / 2 + 4
  const marginX = boundX * 1.4

  for(let i=0;i<bodies.length;i++){

    const body=bodies[i]
    const mesh=meshes[i]

    const transform=body.getWorldTransform()

    const pos=transform.getOrigin()
    const rot=transform.getRotation()

    let px = pos.x()
    let py = pos.y()
    const pz = PLANE_Z

    const outOfBounds =
      px < -marginX || px > marginX ||
      py < minY || py > maxY

    if(outOfBounds){
      px = (Math.random() - 0.5) * boundX * 1.6
      py = 6 + Math.random() * 4
      tempVec3.setValue(px, py, PLANE_Z)
      transform.setOrigin(tempVec3)
      body.setWorldTransform(transform)
      body.setLinearVelocity(zeroVec3)
      body.setAngularVelocity(zeroVec3)
    } else {
      tempVec3.setValue(px, py, PLANE_Z)
      transform.setOrigin(tempVec3)
      body.setWorldTransform(transform)
      const vel = body.getLinearVelocity()
      tempVec3.setValue(vel.x(), vel.y(), 0)
      body.setLinearVelocity(tempVec3)
    }

    const offset = meshCenterOffsets[i]
    mesh.position.set(
      px - (offset?.x ?? 0),
      py - (offset?.y ?? 0),
      pz - (offset?.z ?? 0)
    )

    mesh.quaternion.set(
      rot.x(),
      rot.y(),
      rot.z(),
      rot.w()
    )
  }
}

function animate(){

  animationId=requestAnimationFrame(animate)

  updatePhysics()

  renderer.render(scene,camera)
}

const MOCK_BADGE: UserDeco = {
  foreign: { cover: "/scene/6.glb", name: "测试模型" }
}

async function spawnBadges(){
  const list = props.badges.length > 0 ? props.badges : [MOCK_BADGE]
  for(const deco of list){
    await createBadge(deco)
  }
}

onMounted(async()=>{

  await initAmmo()

  initScene()

  initPhysics()

  createBounds()

  await spawnBadges()

  animate()

  resizeObserver = new ResizeObserver(()=>{
    updateCameraAndBounds()
  })
  const el = containerRef.value
  if(el) resizeObserver.observe(el)

  const canvas = renderer.domElement
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false })
  canvas.addEventListener("pointermove", onPointerMove, { passive: false })
  canvas.addEventListener("pointerup", onPointerUp, { passive: false })
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false })
  canvas.style.cursor = "grab"
})

onBeforeUnmount(()=>{

  if(AmmoLib && tempVec3){ AmmoLib.destroy(tempVec3); tempVec3 = null }
  if(AmmoLib && zeroVec3){ AmmoLib.destroy(zeroVec3); zeroVec3 = null }

  const canvas = renderer?.domElement
  if(canvas){
    canvas.removeEventListener("pointerdown", onPointerDown)
    canvas.removeEventListener("pointermove", onPointerMove)
    canvas.removeEventListener("pointerup", onPointerUp)
    canvas.removeEventListener("pointercancel", onPointerUp)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  cancelAnimationFrame(animationId)

  renderer.dispose()

})
</script>

<style scoped>
.badge-3d-container{
width:100%;
height:100%;
overflow:hidden;
touch-action:none;
user-select:none;
pointer-events:auto;
}
.badge-3d-container canvas{
pointer-events:auto;
}
</style>