import type ThreeCore from '@/utils/threeCore'
import {
	createVoxelPreviewMesh,
	gridKeyToBlockCenter,
	specLabel,
	updateVoxelPreviewMesh,
	type VoxelBlockSpec,
	VOXEL_BLOCK_SIZE,
	VOXEL_COLOR_PRESETS,
	VOXEL_TEXTURE_BLOCKS
} from '@/utils/voxelBlockBuild'
import {
	resolveVoxelPlacementForManager,
	type VoxelPickOptions,
	type VoxelPlacementOptions
} from '@/utils/voxelBlockInstancer'
import { VoxelLinePreviewGroup } from '@/utils/voxelLinePreview'
import {
	buildToolHint,
	buildToolLabel,
	clampLineKeys,
	clampPlaneKeys,
	computeLineKeysForDrag,
	computePlaneKeysForDrag,
	inferLineAxisFromKeys,
	type LineAxis,
	type PlaneDrawPhase,
	type VoxelBuildTool,
	VOXEL_BUILD_TOOLS
} from '@/utils/voxelLineTool'
import * as THREE from 'three'

export type VoxelBuildAction = 'place' | 'remove'
export type { VoxelBuildTool, PlaneDrawPhase }
export { VOXEL_BUILD_TOOLS, buildToolHint, buildToolLabel }

export interface UseVoxelBlockBuildOptions {
	threeCore: Ref<ThreeCore | null>
	editMode: Ref<boolean>
	addMode: Ref<boolean>
	onPlaced?: () => void
	onRemoved?: () => void
	onPlaceRejected?: (message: string) => void
}

/**
 * 方块模式：Orbit 始终可用；按下先拦截 Orbit，短按放置，拖动则交给 Orbit 旋转。
 */
export function useVoxelBlockBuild(options: UseVoxelBlockBuildOptions) {
	const active = ref(false)
	const listExpanded = ref(false)
	const selectedSpec = ref<VoxelBlockSpec | null>(null)
	const buildAction = ref<VoxelBuildAction>('place')
	const buildTool = ref<VoxelBuildTool>('single')
	const planePhase = ref<PlaneDrawPhase>('line')

	let previewMesh: THREE.Mesh | null = null
	let removeHoverMesh: THREE.Mesh | null = null
	let linePreview: VoxelLinePreviewGroup | null = null
	let lineDragActive = false
	let lineStartGridKey: string | null = null
	let lineLockedAxis: LineAxis | null = null
	let linePreviewKeys: string[] = []
	let planeLineKeys: string[] = []
	let planeLineAxis: LineAxis | null = null
	let planePerpAxis: LineAxis | null = null
	let planeExpandDragActive = false
	let planePreviewKeys: string[] = []
	/** 用于射线 NDC 与事件绑定的元素（canvas 优先） */
	let pointerSurfaceEl: HTMLElement | null = null
	const raycaster = new THREE.Raycaster()
	const pointerNdc = new THREE.Vector2()
	const MOVE_THRESHOLD = 5
	let pointerDown = { x: 0, y: 0 }
	let isTap = false
	let pointerHeld = false
	let orbitHandoff = false
	let boundEl: HTMLElement | null = null

	const canUse = computed(
		() => options.editMode.value || options.addMode.value
	)

	/** 编辑/新增模式：放宽限制，优先拾取精度 */
	const preciseInteraction = computed(
		() => active.value && canUse.value
	)

	function syncPreciseInteraction() {
		const manager = getManager()
		if (!manager) return
		manager.setPreciseInteraction(preciseInteraction.value)
	}

	function getPlacementOptions(): VoxelPlacementOptions {
		if (!preciseInteraction.value) return {}
		const core = options.threeCore.value
		return {
			precise: true,
			sceneTargets: core?.getVoxelPlacementSceneTargets()
		}
	}

	function prepareRaycaster() {
		raycaster.near = preciseInteraction.value ? 0.001 : 0.1
	}

	const canPlace = computed(
		() => buildAction.value === 'remove' || selectedSpec.value !== null
	)

	const selectionLabel = computed(() => specLabel(selectedSpec.value))

	const toolHint = computed(() =>
		buildToolHint(buildTool.value, buildAction.value, planePhase.value)
	)

	const isLineToolActive = computed(
		() => buildTool.value === 'line' && buildAction.value === 'place'
	)

	const isPlaneToolActive = computed(
		() => buildTool.value === 'plane' && buildAction.value === 'place'
	)

	const isMultiDragToolActive = computed(
		() => isLineToolActive.value || isPlaneToolActive.value
	)

	function getManager() {
		return options.threeCore.value?.voxelBlocks ?? null
	}

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

	function clonePointerInit(ev: PointerEvent, overrides: Partial<PointerEventInit> = {}) {
		return {
			bubbles: false,
			cancelable: true,
			view: window,
			pointerId: ev.pointerId,
			pointerType: ev.pointerType,
			isPrimary: ev.isPrimary,
			clientX: ev.clientX,
			clientY: ev.clientY,
			screenX: ev.screenX,
			screenY: ev.screenY,
			button: ev.button,
			...overrides
		} satisfies PointerEventInit
	}

	function handoffToOrbitControls(ev: PointerEvent) {
		const dom = getControlDomElement()
		if (!dom) return
		orbitHandoff = true
		dom.dispatchEvent(
			new PointerEvent(
				'pointerdown',
				clonePointerInit(ev, { buttons: ev.buttons || 1 })
			)
		)
	}

	function finishOrbitControls(ev: PointerEvent) {
		if (!orbitHandoff) return
		orbitHandoff = false
		const controls = options.threeCore.value?.controls
		const dom = getControlDomElement()
		if (!controls || !dom || !('state' in controls) || controls.state === -1) return
		dom.dispatchEvent(
			new PointerEvent('pointerup', clonePointerInit(ev, { buttons: 0 }))
		)
	}

	function endPointerGesture(ev: PointerEvent) {
		if (!pointerHeld) return

		if (planeExpandDragActive && ev.button === 0) {
			pointerHeld = false
			isTap = false
			ev.stopPropagation()
			ev.preventDefault()
			const core = options.threeCore.value
			if (core) core.transformControls.detach()
			commitPlaneDraw()
			return
		}

		if (lineDragActive && ev.button === 0) {
			pointerHeld = false
			isTap = false
			ev.stopPropagation()
			ev.preventDefault()
			const core = options.threeCore.value
			if (core) core.transformControls.detach()

			if (isPlaneToolActive.value && planePhase.value === 'line') {
				finishPlaneLinePhase()
			} else {
				commitLineDraw()
			}
			return
		}

		if (
			buildAction.value === 'remove'
			&& ev.button === 0
			&& !planeExpandDragActive
		) {
			pointerHeld = false
			isTap = false
			ev.stopPropagation()
			ev.preventDefault()
			finishOrbitControls(ev)
			const core = options.threeCore.value
			if (core) core.transformControls.detach()
			removeBlock(ev)
			return
		}

		pointerHeld = false
		const wasTap = isTap
		isTap = false

		if (!wasTap) {
			finishOrbitControls(ev)
			return
		}

		ev.stopPropagation()
		ev.preventDefault()

		const core = options.threeCore.value
		if (core) core.transformControls.detach()

		if (ev.button === 2 || buildAction.value === 'remove') {
			removeBlock(ev)
		} else if (ev.button === 0) {
			placeBlock(ev)
		}
		updatePreviewPosition(ev)
	}

	function syncPreviewMesh(core: ThreeCore) {
		if (!selectedSpec.value) {
			if (previewMesh) previewMesh.visible = false
			return
		}
		const variant = selectedSpec.value.variant
		if (
			previewMesh
			&& previewMesh.userData.voxelPreviewVariant !== variant
		) {
			removePreview(core)
		}
		if (!previewMesh) {
			previewMesh = createVoxelPreviewMesh(selectedSpec.value)
			core.scene.add(previewMesh)
		}
		updateVoxelPreviewMesh(previewMesh, selectedSpec.value)
	}

	function removeLinePreview(_core: ThreeCore | null) {
		linePreview?.dispose()
		linePreview = null
	}

	function removeRemoveHover(core: ThreeCore | null) {
		if (!removeHoverMesh) return
		if (core?.scene) core.scene.remove(removeHoverMesh)
		removeHoverMesh.geometry.dispose()
		;(removeHoverMesh.material as THREE.Material).dispose()
		removeHoverMesh = null
	}

	function removePreview(core: ThreeCore | null) {
		clearLineDrag()
		removeLinePreview(core)
		removeRemoveHover(core)
		if (!previewMesh) return
		if (core?.scene) core.scene.remove(previewMesh)
		previewMesh.geometry.dispose()
		const mat = previewMesh.material
		if (Array.isArray(mat)) {
			for (const m of mat) m.dispose()
		} else mat.dispose()
		previewMesh = null
	}

	function ensureLinePreview(core: ThreeCore) {
		if (!linePreview) {
			linePreview = new VoxelLinePreviewGroup(core.scene)
		}
	}

	function clearLineDragOnly() {
		lineDragActive = false
		lineStartGridKey = null
		lineLockedAxis = null
		linePreviewKeys = []
	}

	function clearPlaneSession() {
		planePhase.value = 'line'
		planeLineKeys = []
		planeLineAxis = null
		planePerpAxis = null
		planeExpandDragActive = false
		planePreviewKeys = []
		clearLineDragOnly()
		linePreview?.clear()
		if (previewMesh) previewMesh.visible = false
	}

	function clearLineDrag() {
		if (buildTool.value === 'plane') {
			clearPlaneSession()
		} else {
			clearLineDragOnly()
			linePreview?.clear()
			if (previewMesh) previewMesh.visible = false
		}
	}

	function resolvePlacementFromEvent(ev: PointerEvent) {
		const core = options.threeCore.value
		const manager = getManager()
		const surface = resolvePointerSurface()
		if (!core?.camera || !surface || !manager) return null
		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)
		return resolveVoxelPlacementForManager(
			raycaster,
			manager,
			undefined,
			getPlacementOptions()
		)
	}

	function updateLinePreviewFromEvent(ev: PointerEvent) {
		const spec = selectedSpec.value
		const core = options.threeCore.value
		if (!spec || !core?.camera || !lineStartGridKey || !lineDragActive) return

		const surface = resolvePointerSurface()
		if (!surface) return

		const screenDx = ev.clientX - pointerDown.x
		const screenDy = ev.clientY - pointerDown.y

		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)

		const { keys, lockedAxis } = computeLineKeysForDrag(
			lineStartGridKey,
			screenDx,
			screenDy,
			raycaster.ray,
			core.camera,
			lineLockedAxis,
			surface.getBoundingClientRect().height
		)
		lineLockedAxis = lockedAxis
		linePreviewKeys = clampLineKeys(keys)

		ensureLinePreview(core)
		linePreview?.update(spec, linePreviewKeys)
		if (previewMesh) previewMesh.visible = false
	}

	function commitLineDraw() {
		const spec = selectedSpec.value
		const manager = getManager()
		if (!spec || !manager || !lineStartGridKey || linePreviewKeys.length === 0) {
			clearLineDragOnly()
			linePreview?.clear()
			return
		}
		const added = manager.addBlocksAtGridKeys(spec, linePreviewKeys)
		if (added > 0) options.onPlaced?.()
		clearLineDragOnly()
		linePreview?.clear()
	}

	function finishPlaneLinePhase() {
		if (linePreviewKeys.length === 0 || !lineStartGridKey) {
			clearPlaneSession()
			return
		}

		planeLineKeys = [...linePreviewKeys]
		if (lineLockedAxis) {
			planeLineAxis = lineLockedAxis
		} else if (planeLineKeys.length >= 2) {
			planeLineAxis = inferLineAxisFromKeys(
				planeLineKeys[0],
				planeLineKeys[planeLineKeys.length - 1]
			)
		} else {
			planeLineAxis = 'y'
		}

		planePhase.value = 'expand'
		planePreviewKeys = [...planeLineKeys]
		clearLineDragOnly()

		const spec = selectedSpec.value
		const core = options.threeCore.value
		if (spec && core) {
			ensureLinePreview(core)
			linePreview?.update(spec, planeLineKeys)
		}
	}

	function beginPlaneExpand(_ev: PointerEvent) {
		if (planePhase.value !== 'expand' || planeLineKeys.length === 0 || !planeLineAxis) {
			return false
		}
		planeExpandDragActive = true
		planePerpAxis = null
		planePreviewKeys = [...planeLineKeys]
		isTap = false
		orbitHandoff = false
		return true
	}

	function updatePlaneExpandPreview(ev: PointerEvent) {
		const spec = selectedSpec.value
		const core = options.threeCore.value
		if (
			!spec
			|| !core?.camera
			|| !planeExpandDragActive
			|| planeLineKeys.length === 0
			|| !planeLineAxis
		) {
			return
		}

		const surface = resolvePointerSurface()
		if (!surface) return

		const screenDx = ev.clientX - pointerDown.x
		const screenDy = ev.clientY - pointerDown.y

		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)

		const { keys, lockedPerpAxis } = computePlaneKeysForDrag(
			planeLineKeys,
			planeLineAxis,
			planeLineKeys[0],
			screenDx,
			screenDy,
			raycaster.ray,
			core.camera,
			planePerpAxis,
			surface.getBoundingClientRect().height
		)
		planePerpAxis = lockedPerpAxis
		planePreviewKeys = clampPlaneKeys(keys)

		ensureLinePreview(core)
		linePreview?.update(spec, planePreviewKeys)
		if (previewMesh) previewMesh.visible = false
	}

	function commitPlaneDraw() {
		const spec = selectedSpec.value
		const manager = getManager()
		if (!spec || !manager || planePreviewKeys.length === 0) {
			clearPlaneSession()
			return
		}
		const added = manager.addBlocksAtGridKeys(spec, planePreviewKeys)
		if (added > 0) options.onPlaced?.()
		clearPlaneSession()
	}

	function beginLineDraw(ev: PointerEvent) {
		const spec = selectedSpec.value
		if (!spec) {
			options.onPlaceRejected?.('请先选择方块类型或颜色')
			return false
		}
		const core = options.threeCore.value
		const placement = resolvePlacementFromEvent(ev)
		if (!core || !placement?.canPlace) return false

		lineDragActive = true
		lineStartGridKey = placement.gridKey
		lineLockedAxis = null
		linePreviewKeys = [lineStartGridKey]
		isTap = false
		orbitHandoff = false
		ensureLinePreview(core)
		linePreview?.update(spec, linePreviewKeys)
		if (previewMesh) previewMesh.visible = false
		return true
	}

	function selectSolidColor(color: string) {
		selectedSpec.value = { variant: 'solid', color }
	}

	function selectTextureBlock(presetId: string) {
		selectedSpec.value = { variant: presetId }
	}

	function clearSelection() {
		selectedSpec.value = null
	}

	function setPointerFromEvent(ev: PointerEvent, el: HTMLElement) {
		const rect = el.getBoundingClientRect()
		pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
		pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
	}

	function updatePreviewPosition(ev: PointerEvent) {
		if (lineDragActive || planeExpandDragActive) return
		if (isPlaneToolActive.value && planePhase.value === 'expand') return
		if (buildAction.value === 'remove') {
			updateRemoveHover(ev)
			if (previewMesh) previewMesh.visible = false
			return
		}
		if (removeHoverMesh) removeHoverMesh.visible = false
		const core = options.threeCore.value
		const manager = getManager()
		const surface = resolvePointerSurface()
		if (!core?.camera || !surface || !active.value || !previewMesh || !selectedSpec.value || !manager) {
			if (previewMesh) previewMesh.visible = false
			return
		}
		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)
		const placement = resolveVoxelPlacementForManager(
			raycaster,
			manager,
			undefined,
			getPlacementOptions()
		)
		if (placement && buildAction.value === 'place' && placement.canPlace) {
			previewMesh.position.copy(placement.center)
			previewMesh.visible = true
		} else {
			previewMesh.visible = false
		}
	}

	function placeBlock(ev: PointerEvent) {
		const spec = selectedSpec.value
		if (!spec) {
			options.onPlaceRejected?.('请先选择方块类型或颜色')
			return
		}
		const core = options.threeCore.value
		const manager = getManager()
		const surface = resolvePointerSurface()
		if (!core?.camera || !surface || !manager) return
		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)
		const placement = resolveVoxelPlacementForManager(
			raycaster,
			manager,
			undefined,
			getPlacementOptions()
		)
		if (!placement?.canPlace) return
		if (manager.addBlock(spec, placement.center)) {
			options.onPlaced?.()
		}
	}

	function pickRemoveGridKey(): string | null {
		const manager = getManager()
		if (!manager) return null
		const pickOptions: VoxelPickOptions = { precise: preciseInteraction.value }
		return manager.pickGridKey(raycaster, pickOptions)
	}

	function ensureRemoveHoverMesh(core: ThreeCore) {
		if (removeHoverMesh) return
		removeHoverMesh = new THREE.Mesh(
			new THREE.BoxGeometry(VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE),
			new THREE.MeshStandardMaterial({
				color: 0xf87171,
				transparent: true,
				opacity: 0.42,
				depthWrite: false
			})
		)
		removeHoverMesh.userData.ignorePick = true
		removeHoverMesh.userData.sceneEditorOverlay = true
		removeHoverMesh.renderOrder = 999
		removeHoverMesh.visible = false
		core.scene.add(removeHoverMesh)
	}

	function updateRemoveHover(ev: PointerEvent) {
		const core = options.threeCore.value
		const surface = resolvePointerSurface()
		if (!core?.camera || !surface || !active.value || buildAction.value !== 'remove') {
			if (removeHoverMesh) removeHoverMesh.visible = false
			return
		}
		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)
		const gridKey = pickRemoveGridKey()
		if (!gridKey) {
			if (removeHoverMesh) removeHoverMesh.visible = false
			return
		}
		ensureRemoveHoverMesh(core)
		if (removeHoverMesh) {
			removeHoverMesh.position.copy(gridKeyToBlockCenter(gridKey))
			removeHoverMesh.visible = true
		}
	}

	function removeBlock(ev: PointerEvent) {
		const core = options.threeCore.value
		const manager = getManager()
		const surface = resolvePointerSurface()
		if (!core?.camera || !surface || !manager) return
		setPointerFromEvent(ev, surface)
		prepareRaycaster()
		raycaster.setFromCamera(pointerNdc, core.camera)
		const gridKey = pickRemoveGridKey()
		if (!gridKey) return
		if (manager.removeAtGridKey(gridKey)) {
			options.onRemoved?.()
		}
		updateRemoveHover(ev)
	}

	function onPointerDown(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return
		pointerHeld = true
		isTap = true
		orbitHandoff = false
		pointerDown = { x: ev.clientX, y: ev.clientY }

		if (isMultiDragToolActive.value && ev.button === 0) {
			if (isPlaneToolActive.value && planePhase.value === 'expand') {
				if (beginPlaneExpand(ev)) {
					ev.stopPropagation()
					return
				}
			} else if (beginLineDraw(ev)) {
				ev.stopPropagation()
				return
			}
		}

		ev.stopPropagation()
	}

	function onPointerMove(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return

		if (planeExpandDragActive) {
			updatePlaneExpandPreview(ev)
			return
		}

		if (lineDragActive) {
			updateLinePreviewFromEvent(ev)
			return
		}

		if (pointerHeld && isTap && buildAction.value !== 'remove') {
			const dx = ev.clientX - pointerDown.x
			const dy = ev.clientY - pointerDown.y
			if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
				isTap = false
				handoffToOrbitControls(ev)
			}
		}
		updatePreviewPosition(ev)
	}

	function onPointerUp(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return
		endPointerGesture(ev)
	}

	function onPointerCancel(ev: PointerEvent) {
		if (!active.value || !ev.isTrusted) return
		if (lineDragActive || planeExpandDragActive) {
			if (lineDragActive) {
				if (isPlaneToolActive.value) clearPlaneSession()
				else {
					clearLineDragOnly()
					linePreview?.clear()
				}
			}
			if (planeExpandDragActive) {
				planeExpandDragActive = false
				planePreviewKeys = [...planeLineKeys]
				const spec = selectedSpec.value
				const core = options.threeCore.value
				if (spec && core && planeLineKeys.length) {
					linePreview?.update(spec, planeLineKeys)
				}
			}
		}
		finishOrbitControls(ev)
		pointerHeld = false
		isTap = false
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
		isTap = false
		orbitHandoff = false
		clearLineDrag()
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
			syncPreciseInteraction()
			syncPreviewMesh(core)
			if (pointerSurfaceEl) bindPointerListeners(pointerSurfaceEl)
		}
	}

	function deactivate(clearSelection = false) {
		active.value = false
		listExpanded.value = false
		if (clearSelection) {
			selectedSpec.value = null
		}
		pointerHeld = false
		isTap = false
		orbitHandoff = false
		syncPreciseInteraction()
		removePreview(options.threeCore.value)
	}

	function exit(clearSelection = false) {
		deactivate(clearSelection)
	}

	function showBlockPanel() {
		if (!listExpanded.value) {
			listExpanded.value = true
			if (!active.value) enter()
		} else {
			deactivate()
		}
	}

	watch(
		() => options.threeCore.value?.renderer?.domElement,
		() => {
			if (active.value && pointerSurfaceEl) {
				bindPointerListeners(pointerSurfaceEl)
			}
		}
	)

	watch(buildAction, (action) => {
		if (action === 'remove' && (buildTool.value === 'line' || buildTool.value === 'plane')) {
			buildTool.value = 'single'
		}
		clearPlaneSession()
	})

	watch(buildTool, () => {
		clearPlaneSession()
	})

	watch(selectedSpec, () => {
		clearPlaneSession()
		const core = options.threeCore.value
		if (core && active.value) syncPreviewMesh(core)
	})

	watch(canUse, (ok) => {
		if (!ok) exit(true)
		else syncPreciseInteraction()
	})

	watch(preciseInteraction, () => {
		syncPreciseInteraction()
	})

	watch(active, (on) => {
		const core = options.threeCore.value
		if (on && core) {
			syncPreviewMesh(core)
		} else {
			removePreview(core)
		}
	})

	onBeforeUnmount(() => {
		unbindPointerListeners()
		removePreview(options.threeCore.value)
	})

	return {
		active,
		listExpanded,
		selectedSpec,
		buildAction,
		buildTool,
		planePhase,
		toolHint,
		isLineToolActive,
		isPlaneToolActive,
		isMultiDragToolActive,
		canPlace,
		selectionLabel,
		textureBlocks: VOXEL_TEXTURE_BLOCKS,
		colorPresets: VOXEL_COLOR_PRESETS,
		buildTools: VOXEL_BUILD_TOOLS,
		canUse,
		selectSolidColor,
		selectTextureBlock,
		clearSelection,
		enter,
		exit,
		showBlockPanel,
		bindContainer,
		unbindContainer: unbindPointerListeners
	}
}
