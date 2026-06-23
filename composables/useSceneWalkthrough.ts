import type { GalleryWall } from '@/types/gallery'
import type ThreeCore from '@/utils/threeCore'
import { tryMoveCircle } from '@/utils/galleryCollision'
import {
	boundaryCenter,
	computeSceneWalkBoundary,
	wallColliderAABB
} from '@/utils/sceneWalkCollision'
import * as THREE from 'three'

/** 与展馆漫游一致 */
const CAMERA_PITCH = Math.PI / 4
const CAMERA_DISTANCE_DEFAULT = 8
const CAMERA_DISTANCE_MIN = 3
const CAMERA_DISTANCE_MAX = 18
const WHEEL_ZOOM_SPEED = 0.008
const PINCH_ZOOM_SPEED = 0.025
const MOVE_SPEED = 5
const PLAYER_RADIUS = 0.4
const POINTER_MOVE_THRESHOLD = 5

export interface SceneWalkCameraSnapshot {
	position: THREE.Vector3
	target: THREE.Vector3
	fov?: number
	controlsEnabled: boolean
	enableRotate: boolean
	enablePan: boolean
	enableZoom: boolean
	minAzimuthAngle: number
	maxAzimuthAngle: number
	minPolarAngle: number
	maxPolarAngle: number
}

export interface UseSceneWalkthroughOptions {
	threeCore: Ref<ThreeCore | null>
	getWalls: () => GalleryWall[]
	getContainer: () => HTMLElement | null
	isMobile: Ref<boolean>
	onEnter?: () => void
	onExit?: () => void
}

function asOrbitControls(core: ThreeCore) {
	const controls = core.controls
	if (!controls || !('enableRotate' in controls)) return null
	return controls as import('three/examples/jsm/controls/OrbitControls.js').OrbitControls
}

export function useSceneWalkthrough(options: UseSceneWalkthroughOptions) {
	const active = ref(false)
	const playerX = ref(0)
	const playerZ = ref(0)
	const cameraYaw = ref(0)
	const cameraDistance = ref(CAMERA_DISTANCE_DEFAULT)

	let playerMesh: THREE.Group | null = null
	let colliders: import('@/utils/galleryCollision').AABB2D[] = []
	let boundary: import('@/utils/galleryCollision').AABB2D
	let cameraSnapshot: SceneWalkCameraSnapshot | null = null
	let clock: THREE.Clock | null = null
	let tickCallback: (() => void) | null = null
	let boundEl: HTMLElement | null = null

	const keys = { w: false, a: false, s: false, d: false }
	const joystickInput = { x: 0, y: 0 }
	let isRotating = false
	let lastPointerX = 0
	let pointerDownX = 0
	let pointerDownY = 0
	let pointerHasMoved = false
	const activePointers = new Map<number, { x: number; y: number }>()
	let isPinching = false
	let lastPinchDistance = 0

	function captureCameraSnapshot(core: ThreeCore): SceneWalkCameraSnapshot {
		const controls = asOrbitControls(core)
		const cam = core.camera
		const fov =
			cam instanceof THREE.PerspectiveCamera ? cam.fov : undefined
		return {
			position: cam.position.clone(),
			target:
				controls && 'target' in controls
					? controls.target.clone()
					: new THREE.Vector3(),
			fov,
			controlsEnabled: controls?.enabled ?? true,
			enableRotate: controls?.enableRotate ?? true,
			enablePan: controls?.enablePan ?? true,
			enableZoom: controls?.enableZoom ?? true,
			minAzimuthAngle: controls?.minAzimuthAngle ?? Number.NEGATIVE_INFINITY,
			maxAzimuthAngle: controls?.maxAzimuthAngle ?? Number.POSITIVE_INFINITY,
			minPolarAngle: controls?.minPolarAngle ?? 0,
			maxPolarAngle: controls?.maxPolarAngle ?? Math.PI
		}
	}

	function restoreCameraSnapshot(core: ThreeCore) {
		if (!cameraSnapshot) return
		const snap = cameraSnapshot
		core.lookAtCameraState(
			{
				position: snap.position,
				target: snap.target,
				fov: snap.fov
			},
			0,
			() => {
				const controls = asOrbitControls(core)
				if (!controls) return
				controls.enabled = snap.controlsEnabled
				controls.enableRotate = snap.enableRotate
				controls.enablePan = snap.enablePan
				controls.enableZoom = snap.enableZoom
				controls.minAzimuthAngle = snap.minAzimuthAngle
				controls.maxAzimuthAngle = snap.maxAzimuthAngle
				controls.minPolarAngle = snap.minPolarAngle
				controls.maxPolarAngle = snap.maxPolarAngle
				controls.update()
			}
		)
		cameraSnapshot = null
	}

	function syncCameraYawFromCore(core: ThreeCore) {
		const controls = asOrbitControls(core)
		if (!controls) return
		const px = controls.target.x
		const pz = controls.target.z
		const cam = core.camera.position
		const dx = px - cam.x
		const dz = pz - cam.z
		cameraYaw.value = Math.atan2(dx, dz)
		const horizontal = Math.hypot(cam.x - px, cam.z - pz)
		cameraDistance.value = clampCameraDistance(horizontal)
	}

	function clampCameraDistance(distance: number) {
		return Math.max(
			CAMERA_DISTANCE_MIN,
			Math.min(CAMERA_DISTANCE_MAX, distance)
		)
	}

	function adjustCameraDistance(delta: number) {
		cameraDistance.value = clampCameraDistance(cameraDistance.value + delta)
	}

	function buildColliders(core: ThreeCore) {
		colliders = options.getWalls().map(wallColliderAABB)
		boundary = computeSceneWalkBoundary(core.scene, PLAYER_RADIUS)
		const [cx, cz] = boundaryCenter(boundary)
		const controls = asOrbitControls(core)
		if (controls) {
			playerX.value = controls.target.x
			playerZ.value = controls.target.z
		} else {
			playerX.value = cx
			playerZ.value = cz
		}
		const [nx, nz] = tryMoveCircle(
			playerX.value,
			playerZ.value,
			0,
			0,
			PLAYER_RADIUS,
			colliders,
			boundary
		)
		playerX.value = nx
		playerZ.value = nz
	}

	function createPlayer(scene: THREE.Scene) {
		const group = new THREE.Group()
		const body = new THREE.Mesh(
			new THREE.CapsuleGeometry(PLAYER_RADIUS, 0.8, 8, 16),
			new THREE.MeshStandardMaterial({
				color: 0x7ec8e3,
				roughness: 0.4,
				metalness: 0.2
			})
		)
		body.position.y = 0.8
		body.castShadow = true
		group.add(body)

		const arrow = new THREE.Mesh(
			new THREE.ConeGeometry(0.15, 0.4, 8),
			new THREE.MeshStandardMaterial({ color: 0xffffff })
		)
		arrow.rotation.x = -Math.PI / 2
		arrow.position.set(0, 1.2, -0.5)
		group.add(arrow)

		group.position.set(playerX.value, 0, playerZ.value)
		group.userData.isSceneWalkPlayer = true
		group.userData.ignorePick = true
		scene.add(group)
		playerMesh = group
	}

	function removePlayer(scene: THREE.Scene) {
		if (!playerMesh) return
		scene.remove(playerMesh)
		playerMesh.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.geometry.dispose()
				const mat = child.material
				if (mat instanceof THREE.Material) mat.dispose()
			}
		})
		playerMesh = null
	}

	function updateCamera(core: ThreeCore) {
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

		if (playerMesh) {
			playerMesh.position.set(px, 0, pz)
			playerMesh.rotation.y = yaw
		}
	}

	function tick(core: ThreeCore) {
		if (!clock) return
		const delta = clock.getDelta()

		let inputX = 0
		let inputZ = 0
		if (keys.w) inputZ += 1
		if (keys.s) inputZ -= 1
		if (keys.a) inputX += 1
		if (keys.d) inputX -= 1

		if (joystickInput.x !== 0 || joystickInput.y !== 0) {
			inputX = -joystickInput.x
			inputZ = -joystickInput.y
		}

		const len = Math.hypot(inputX, inputZ)
		if (len > 0.01) {
			inputX /= len
			inputZ /= len
			const yaw = cameraYaw.value
			const worldX = inputX * Math.cos(yaw) + inputZ * Math.sin(yaw)
			const worldZ = -inputX * Math.sin(yaw) + inputZ * Math.cos(yaw)
			const dx = worldX * MOVE_SPEED * delta
			const dz = worldZ * MOVE_SPEED * delta
			const [nx, nz] = tryMoveCircle(
				playerX.value,
				playerZ.value,
				dx,
				dz,
				PLAYER_RADIUS,
				colliders,
				boundary
			)
			playerX.value = nx
			playerZ.value = nz
		}

		updateCamera(core)
	}

	function getPinchDistance() {
		const pts = [...activePointers.values()]
		if (pts.length < 2) return 0
		return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
	}

	function onKeyDown(e: KeyboardEvent) {
		if (!active.value) return
		const target = e.target as HTMLElement
		if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
		const k = e.key.toLowerCase()
		if (k === 'w') keys.w = true
		if (k === 'a') keys.a = true
		if (k === 's') keys.s = true
		if (k === 'd') keys.d = true
		if (k === 'escape') {
			e.preventDefault()
			exit()
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		if (!active.value) return
		const k = e.key.toLowerCase()
		if (k === 'w') keys.w = false
		if (k === 'a') keys.a = false
		if (k === 's') keys.s = false
		if (k === 'd') keys.d = false
	}

	function onPointerDown(e: PointerEvent) {
		if (!active.value) return
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
		boundEl?.setPointerCapture(e.pointerId)
	}

	function onPointerMove(e: PointerEvent) {
		if (!active.value) return
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

	function onPointerUp(e: PointerEvent) {
		if (!active.value) return
		activePointers.delete(e.pointerId)
		if (activePointers.size < 2) {
			isPinching = false
			lastPinchDistance = 0
		}
		if (boundEl?.hasPointerCapture(e.pointerId)) {
			boundEl.releasePointerCapture(e.pointerId)
		}
		isRotating = false
	}

	function onWheel(e: WheelEvent) {
		if (!active.value) return
		e.preventDefault()
		adjustCameraDistance(e.deltaY * WHEEL_ZOOM_SPEED)
	}

	function onContextMenu(e: Event) {
		if (!active.value) return
		e.preventDefault()
	}

	function bindEvents(el: HTMLElement) {
		unbindEvents()
		boundEl = el
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)
		el.addEventListener('pointerdown', onPointerDown)
		el.addEventListener('pointermove', onPointerMove)
		el.addEventListener('pointerup', onPointerUp)
		el.addEventListener('pointerleave', onPointerUp)
		el.addEventListener('pointercancel', onPointerUp)
		el.addEventListener('contextmenu', onContextMenu)
		el.addEventListener('wheel', onWheel, { passive: false })
	}

	function unbindEvents() {
		window.removeEventListener('keydown', onKeyDown)
		window.removeEventListener('keyup', onKeyUp)
		if (boundEl) {
			boundEl.removeEventListener('pointerdown', onPointerDown)
			boundEl.removeEventListener('pointermove', onPointerMove)
			boundEl.removeEventListener('pointerup', onPointerUp)
			boundEl.removeEventListener('pointerleave', onPointerUp)
			boundEl.removeEventListener('pointercancel', onPointerUp)
			boundEl.removeEventListener('contextmenu', onContextMenu)
			boundEl.removeEventListener('wheel', onWheel)
		}
		boundEl = null
		keys.w = false
		keys.a = false
		keys.s = false
		keys.d = false
		joystickInput.x = 0
		joystickInput.y = 0
		isRotating = false
		isPinching = false
		activePointers.clear()
	}

	function enter() {
		const core = options.threeCore.value
		const container = options.getContainer()
		if (!core || !container || active.value) return

		cameraSnapshot = captureCameraSnapshot(core)
		syncCameraYawFromCore(core)
		buildColliders(core)

		const controls = asOrbitControls(core)
		if (controls) controls.enabled = false

		core.transformControls.detach()
		createPlayer(core.scene)
		clock = new THREE.Clock()

		tickCallback = () => {
			if (active.value && options.threeCore.value) {
				tick(options.threeCore.value)
			}
		}
		core.addAnimationCallback(tickCallback)
		updateCamera(core)

		bindEvents(container)
		active.value = true
		options.onEnter?.()
	}

	function exit() {
		if (!active.value) return
		const core = options.threeCore.value

		unbindEvents()

		if (core) {
			if (tickCallback) {
				const idx = core.animationCallbacks.indexOf(tickCallback)
				if (idx >= 0) core.animationCallbacks.splice(idx, 1)
				tickCallback = null
			}
			removePlayer(core.scene)
			restoreCameraSnapshot(core)
		}

		clock = null
		active.value = false
		options.onExit?.()
	}

	function toggle() {
		if (active.value) exit()
		else enter()
	}

	function setJoystickInput(x: number, y: number) {
		joystickInput.x = x
		joystickInput.y = y
	}

	function clearJoystickInput() {
		joystickInput.x = 0
		joystickInput.y = 0
	}

	onBeforeUnmount(() => {
		exit()
	})

	return {
		active,
		playerX,
		playerZ,
		cameraYaw,
		enter,
		exit,
		toggle,
		setJoystickInput,
		clearJoystickInput
	}
}
