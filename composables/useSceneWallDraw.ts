import type ThreeCore from '@/utils/threeCore'
import {
	createWallLinePreview,
	createWallStartMarker,
	intersectGroundPlane,
	SCENE_WALL_DEFAULT_HEIGHT,
	snapWallPoint,
	updateWallLinePreview,
	updateWallStartMarker,
	wallConfigFromEndpoints,
	wallConfigFromDrag,
	createSceneWallMesh
} from '@/utils/sceneWallBuild'
import { SceneWallManager } from '@/utils/sceneWallManager'
import {
	applyWallDrawTopView,
	captureWallDrawCameraSnapshot,
	restoreWallDrawCamera,
	type WallDrawCameraSnapshot
} from '@/utils/sceneWallTopView'
import * as THREE from 'three'

export type SceneWallBuildAction = 'place' | 'remove'

export interface UseSceneWallDrawOptions {
	threeCore: Ref<ThreeCore | null>
	editMode: Ref<boolean>
	addMode: Ref<boolean>
	onChanged?: () => void
}

/**
 * 场景墙体绘制：锁定顶视正交 + 地面拉线，数据格式与展馆 GalleryWall 一致。
 */
export function useSceneWallDraw(options: UseSceneWallDrawOptions) {
	const active = ref(false)
	const listExpanded = ref(false)
	const buildAction = ref<SceneWallBuildAction>('place')
	const wallHeight = ref(SCENE_WALL_DEFAULT_HEIGHT)

	let manager: SceneWallManager | null = null
	let previewMesh: THREE.Mesh | null = null
	let linePreview: THREE.Line | null = null
	let startMarker: THREE.Mesh | null = null
	let cameraSnapshot: WallDrawCameraSnapshot | null = null
	let boundEl: HTMLElement | null = null
	let pointerSurfaceEl: HTMLElement | null = null

	const raycaster = new THREE.Raycaster()
	const pointerNdc = new THREE.Vector2()
	let dragStart: { x: number; z: number } | null = null
	let dragActive = false
	let pointerHeld = false

	const canUse = computed(() => options.editMode.value || options.addMode.value)

	const toolHint = computed(() => {
		if (buildAction.value === 'remove') {
			return '顶视图 · 点击墙体拆除'
		}
		return '顶视图 · 按下起点拖拽拉线生成墙体 · 可平移/缩放画面'
	})

	function getControlDomElement(): HTMLElement | null {
		const controls = options.threeCore.value?.controls
		if (controls && 'domElement' in controls && controls.domElement) {
			return controls.domElement as HTMLElement
		}
		return options.threeCore.value?.renderer?.domElement ?? null
	}

	function resolvePointerSurface(): HTMLElement | null {
		return getControlDomElement() ?? pointerSurfaceEl
	}

	function setPointerFromEvent(ev: PointerEvent, el: HTMLElement) {
		const rect = el.getBoundingClientRect()
		pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
		pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
	}

	function prepareRaycaster() {
		const core = options.threeCore.value
		if (!core?.camera) return null
		raycaster.setFromCamera(pointerNdc, core.camera)
		return raycaster
	}

	function groundPointFromEvent(ev: PointerEvent): THREE.Vector3 | null {
		const surface = resolvePointerSurface()
		const core = options.threeCore.value
		if (!surface || !core?.camera) return null
		setPointerFromEvent(ev, surface)
		const caster = prepareRaycaster()
		return caster ? intersectGroundPlane(caster.ray) : null
	}

	function syncManager(core: ThreeCore | null) {
		if (manager) {
			manager.dispose()
			manager = null
		}
		if (!core) return
		manager = new SceneWallManager(core.scene)
	}

	function ensureDrawOverlay(core: ThreeCore) {
		if (!linePreview) {
			linePreview = createWallLinePreview()
			core.scene.add(linePreview)
		}
		if (!startMarker) {
			startMarker = createWallStartMarker()
			core.scene.add(startMarker)
		}
	}

	function removeDrawOverlay(core: ThreeCore | null) {
		if (linePreview) {
			if (core) core.scene.remove(linePreview)
			linePreview.geometry.dispose()
			const mat = linePreview.material
			if (mat instanceof THREE.Material) mat.dispose()
			linePreview = null
		}
		if (startMarker) {
			if (core) core.scene.remove(startMarker)
			startMarker.geometry.dispose()
			const mat = startMarker.material
			if (mat instanceof THREE.Material) mat.dispose()
			startMarker = null
		}
	}

	function ensurePreviewMesh(core: ThreeCore) {
		if (previewMesh) return
		previewMesh = createSceneWallMesh({
			position: [0, 0],
			size: [1, 0.2],
			height: wallHeight.value
		})
		previewMesh.material = new THREE.MeshStandardMaterial({
			color: 0x93c5fd,
			transparent: true,
			opacity: 0.35,
			depthWrite: false
		})
		previewMesh.userData.ignorePick = true
		previewMesh.userData.sceneEditorOverlay = true
		previewMesh.renderOrder = 998
		previewMesh.visible = false
		core.scene.add(previewMesh)
	}

	function removePreviewMesh(core: ThreeCore | null) {
		if (!previewMesh) return
		if (core) core.scene.remove(previewMesh)
		previewMesh.geometry.dispose()
		const mat = previewMesh.material
		if (mat instanceof THREE.Material) mat.dispose()
		previewMesh = null
	}

	function updatePreviewFromDrag(endX: number, endZ: number) {
		const core = options.threeCore.value
		if (!core || !dragStart) return
		ensureDrawOverlay(core)

		const end = snapWallPoint(endX, endZ)
		const sx = dragStart.x
		const sz = dragStart.z
		const ex = end.x
		const ez = end.z

		if (startMarker && linePreview) {
			updateWallStartMarker(startMarker, sx, sz)
			updateWallLinePreview(linePreview, sx, sz, ex, ez)
		}

		if (!previewMesh) ensurePreviewMesh(core)
		const config = wallConfigFromEndpoints(
			sx,
			sz,
			ex,
			ez,
			wallHeight.value
		)
		if (!config || !previewMesh) {
			if (previewMesh) previewMesh.visible = false
			return
		}
		const h = config.height ?? wallHeight.value
		previewMesh.geometry.dispose()
		previewMesh.geometry = new THREE.BoxGeometry(config.size[0], h, config.size[1])
		previewMesh.position.set(config.position[0], h / 2, config.position[1])
		previewMesh.rotation.y = config.rotation ?? 0
		previewMesh.visible = true
	}

	function clearDrag() {
		dragActive = false
		dragStart = null
		if (previewMesh) previewMesh.visible = false
		if (linePreview) linePreview.visible = false
		if (startMarker) startMarker.visible = false
	}

	function commitDrag(endX: number, endZ: number) {
		if (!manager || !dragStart) return
		const config = wallConfigFromDrag(
			dragStart.x,
			dragStart.z,
			endX,
			endZ,
			wallHeight.value
		)
		if (!config) return
		manager.addWall(config)
		options.onChanged?.()
	}

	function tryRemoveAtEvent(ev: PointerEvent) {
		const surface = resolvePointerSurface()
		const core = options.threeCore.value
		if (!manager || !surface || !core?.camera) return
		setPointerFromEvent(ev, surface)
		const caster = prepareRaycaster()
		if (!caster) return
		const mesh = manager.pickWall(caster)
		if (!mesh) return
		manager.removeMesh(mesh)
		options.onChanged?.()
	}

	function applyTopView() {
		const core = options.threeCore.value
		if (!core || cameraSnapshot) return
		cameraSnapshot = captureWallDrawCameraSnapshot(core)
		applyWallDrawTopView(core)
	}

	function restoreCamera() {
		const core = options.threeCore.value
		if (!core || !cameraSnapshot) return
		restoreWallDrawCamera(core, cameraSnapshot)
		cameraSnapshot = null
	}

	function onPointerDown(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted || ev.button !== 0) return
		pointerHeld = true

		if (buildAction.value === 'remove') {
			ev.stopPropagation()
			ev.preventDefault()
			return
		}

		const point = groundPointFromEvent(ev)
		const core = options.threeCore.value
		if (!point || !core) return

		const start = snapWallPoint(point.x, point.z)
		dragActive = true
		dragStart = { x: start.x, z: start.z }
		ensureDrawOverlay(core)
		updatePreviewFromDrag(point.x, point.z)
		ev.stopPropagation()
		ev.preventDefault()
	}

	function onPointerMove(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return

		if (dragActive && dragStart) {
			const point = groundPointFromEvent(ev)
			if (point) updatePreviewFromDrag(point.x, point.z)
			ev.stopPropagation()
		}
	}

	function onPointerUp(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return
		endPointerGesture(ev)
	}

	function onPointerCancel(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return
		clearDrag()
		pointerHeld = false
	}

	function endPointerGesture(ev: PointerEvent) {
		if (!pointerHeld || ev.button !== 0) return

		if (buildAction.value === 'remove') {
			pointerHeld = false
			ev.stopPropagation()
			ev.preventDefault()
			options.threeCore.value?.transformControls.detach()
			tryRemoveAtEvent(ev)
			return
		}

		if (dragActive) {
			pointerHeld = false
			ev.stopPropagation()
			ev.preventDefault()
			options.threeCore.value?.transformControls.detach()
			const point = groundPointFromEvent(ev)
			if (point && dragStart) {
				commitDrag(point.x, point.z)
			}
			clearDrag()
			return
		}

		pointerHeld = false
	}

	function onWindowPointerUp(ev: PointerEvent) {
		if (!active.value || !pointerHeld || !ev.isTrusted) return
		endPointerGesture(ev)
	}

	function onContextMenu(ev: Event) {
		if (!active.value) return
		ev.preventDefault()
	}

	function bindPointerListeners(el: HTMLElement | null) {
		unbindPointerListeners()
		pointerSurfaceEl = el
		const target = resolvePointerSurface()
		if (!target) return
		boundEl = target
		target.addEventListener('pointerdown', onPointerDown, { capture: true })
		target.addEventListener('pointermove', onPointerMove)
		target.addEventListener('pointerup', onPointerUp)
		target.addEventListener('pointercancel', onPointerCancel)
		target.addEventListener('contextmenu', onContextMenu)
		window.addEventListener('pointerup', onWindowPointerUp)
		window.addEventListener('pointercancel', onWindowPointerUp)
	}

	function unbindPointerListeners() {
		if (boundEl) {
			boundEl.removeEventListener('pointerdown', onPointerDown, { capture: true })
			boundEl.removeEventListener('pointermove', onPointerMove)
			boundEl.removeEventListener('pointerup', onPointerUp)
			boundEl.removeEventListener('pointercancel', onPointerCancel)
			boundEl.removeEventListener('contextmenu', onContextMenu)
		}
		window.removeEventListener('pointerup', onWindowPointerUp)
		window.removeEventListener('pointercancel', onWindowPointerUp)
		boundEl = null
		pointerSurfaceEl = null
		pointerHeld = false
		clearDrag()
	}

	function bindContainer(el: HTMLElement | null) {
		if (!el) {
			unbindPointerListeners()
			return
		}
		bindPointerListeners(el)
	}

	function enter() {
		if (!canUse.value) return
		active.value = true
		const core = options.threeCore.value
		if (core) {
			core.transformControls.detach()
			applyTopView()
			if (pointerSurfaceEl) bindPointerListeners(pointerSurfaceEl)
		}
	}

	function deactivate() {
		const core = options.threeCore.value
		restoreCamera()
		active.value = false
		listExpanded.value = false
		pointerHeld = false
		clearDrag()
		removePreviewMesh(core)
		removeDrawOverlay(core)
	}

	function exit() {
		deactivate()
	}

	function showPanel() {
		if (!listExpanded.value) {
			listExpanded.value = true
			if (!active.value) enter()
		} else {
			deactivate()
		}
	}

	function loadFromJSON(walls?: import('@/types/gallery').GalleryWall[]) {
		if (!manager && options.threeCore.value) {
			syncManager(options.threeCore.value)
		}
		manager?.loadFromJSON(walls)
	}

	function exportJSON(): import('@/types/gallery').GalleryWall[] {
		return manager?.exportJSON() ?? []
	}

	watch(
		() => options.threeCore.value,
		(core) => {
			syncManager(core)
		},
		{ immediate: true }
	)

	watch(
		() => options.threeCore.value?.renderer?.domElement,
		() => {
			if (active.value && pointerSurfaceEl) {
				bindPointerListeners(pointerSurfaceEl)
			}
		}
	)

	watch(canUse, (ok) => {
		if (!ok) exit()
	})

	watch(wallHeight, () => {
		clearDrag()
	})

	onBeforeUnmount(() => {
		unbindPointerListeners()
		const core = options.threeCore.value
		removePreviewMesh(core)
		removeDrawOverlay(core)
		restoreCamera()
		if (manager) {
			manager.dispose()
			manager = null
		}
	})

	return {
		active,
		listExpanded,
		buildAction,
		wallHeight,
		toolHint,
		showPanel,
		enter,
		exit,
		bindContainer,
		loadFromJSON,
		exportJSON
	}
}
