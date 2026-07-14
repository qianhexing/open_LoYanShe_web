import type { Material } from '@/types/api'
import { intersectGroundPlane } from '@/utils/sceneWallBuild'
import * as THREE from 'three'

const DRAG_THRESHOLD_PX = 8

export type SceneMaterialPointerDragHandlers = {
	onActiveChange?: (active: boolean, item: Material | null) => void
	onMove?: (clientX: number, clientY: number) => void
	onDrop?: (item: Material, clientX: number, clientY: number) => void
	onCancel?: () => void
}

let handlers: SceneMaterialPointerDragHandlers = {}
let trackingItem: Material | null = null
let dragActive = false
let startX = 0
let startY = 0
let pointerId: number | null = null
let suppressClick = false
let removeWindowListeners: (() => void) | null = null

export function setSceneMaterialPointerDragHandlers(
	next: SceneMaterialPointerDragHandlers | null
) {
	handlers = next ?? {}
}

export function shouldSuppressMaterialClick(): boolean {
	if (!suppressClick) return false
	suppressClick = false
	return true
}

export function isSceneMaterialPointerDragging(): boolean {
	return dragActive
}

function clearTracking() {
	removeWindowListeners?.()
	removeWindowListeners = null
	trackingItem = null
	dragActive = false
	pointerId = null
}

/**
 * 列表项 pointerdown：超过阈值后进入拖拽，在 window pointerup 时落点放置。
 * 避免 HTML5 DnD 与侧栏/WebGL canvas 冲突。
 */
export function beginSceneMaterialPointerDrag(item: Material, e: PointerEvent) {
	if (e.button !== 0) return
	clearTracking()
	trackingItem = item
	dragActive = false
	suppressClick = false
	startX = e.clientX
	startY = e.clientY
	pointerId = e.pointerId

	const onMove = (ev: PointerEvent) => {
		if (pointerId !== null && ev.pointerId !== pointerId) return
		const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
		if (!dragActive) {
			if (dist < DRAG_THRESHOLD_PX) return
			dragActive = true
			suppressClick = true
			handlers.onActiveChange?.(true, item)
			handlers.onMove?.(ev.clientX, ev.clientY)
			return
		}
		handlers.onMove?.(ev.clientX, ev.clientY)
	}

	const finish = (ev: PointerEvent, cancelled: boolean) => {
		const itemRef = trackingItem
		const wasActive = dragActive
		clearTracking()
		if (!wasActive || !itemRef) return
		handlers.onActiveChange?.(false, null)
		if (cancelled) {
			handlers.onCancel?.()
			return
		}
		handlers.onDrop?.(itemRef, ev.clientX, ev.clientY)
	}

	const onUp = (ev: PointerEvent) => {
		if (pointerId !== null && ev.pointerId !== pointerId) return
		finish(ev, false)
	}

	const onCancel = (ev: PointerEvent) => {
		if (pointerId !== null && ev.pointerId !== pointerId) return
		finish(ev, true)
	}

	window.addEventListener('pointermove', onMove, { passive: true })
	window.addEventListener('pointerup', onUp)
	window.addEventListener('pointercancel', onCancel)
	removeWindowListeners = () => {
		window.removeEventListener('pointermove', onMove)
		window.removeEventListener('pointerup', onUp)
		window.removeEventListener('pointercancel', onCancel)
	}
}

/** 从屏幕坐标射线与 y=0 地面求交 */
export function groundPointFromClient(
	camera: THREE.Camera,
	domElement: HTMLElement,
	clientX: number,
	clientY: number
): THREE.Vector3 | null {
	const rect = domElement.getBoundingClientRect()
	if (rect.width <= 0 || rect.height <= 0) return null
	const ndc = new THREE.Vector2(
		((clientX - rect.left) / rect.width) * 2 - 1,
		-((clientY - rect.top) / rect.height) * 2 + 1
	)
	const raycaster = new THREE.Raycaster()
	raycaster.setFromCamera(ndc, camera)
	return intersectGroundPlane(raycaster.ray)
}

/** 屏幕中心射线与地面求交；失败则退回 orbit target 的 xz 投影到 y=0 */
export function defaultGroundPlacement(
	camera: THREE.Camera,
	orbitTarget?: THREE.Vector3
): THREE.Vector3 {
	const raycaster = new THREE.Raycaster()
	raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
	const hit = intersectGroundPlane(raycaster.ray)
	if (hit) return hit
	if (orbitTarget) {
		return new THREE.Vector3(orbitTarget.x, 0, orbitTarget.z)
	}
	return new THREE.Vector3(0, 0, 0)
}

const PLACEHOLDER_SIZE = 0.5

/** 加载中示意立方体：底面贴在地面落点，不参与拾取/保存 */
export function createMaterialLoadPlaceholder(position: THREE.Vector3): THREE.Mesh {
	const geometry = new THREE.BoxGeometry(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE)
	const material = new THREE.MeshStandardMaterial({
		color: 0xa78bfa,
		transparent: true,
		opacity: 0.45,
		roughness: 0.55,
		metalness: 0.05,
		depthWrite: false
	})
	const mesh = new THREE.Mesh(geometry, material)
	const edges = new THREE.LineSegments(
		new THREE.EdgesGeometry(geometry),
		new THREE.LineBasicMaterial({
			color: 0x7c3aed,
			transparent: true,
			opacity: 0.95,
			depthTest: false
		})
	)
	edges.renderOrder = 10
	mesh.add(edges)
	mesh.position.set(
		position.x,
		position.y + PLACEHOLDER_SIZE / 2,
		position.z
	)
	mesh.userData.ignorePick = true
	mesh.userData.sceneEditorOverlay = true
	mesh.userData.isMaterialLoadPlaceholder = true
	return mesh
}

export function removeMaterialLoadPlaceholder(
	placeholder: THREE.Object3D | null | undefined,
	scene?: THREE.Scene | null
) {
	if (!placeholder) return
	scene?.remove(placeholder)
	placeholder.traverse((obj) => {
		const mesh = obj as THREE.Mesh
		if (mesh.geometry) mesh.geometry.dispose()
		const mat = mesh.material
		if (!mat) return
		if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
		else mat.dispose()
	})
}
