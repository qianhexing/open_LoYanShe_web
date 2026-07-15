import type { EzTreePresetId } from '@/utils/ezTree'

const DRAG_THRESHOLD_PX = 8

export type ScenePlantDragItem = {
	presetId: string
	label: string
	kind: string
}

export type ScenePlantPointerDragHandlers = {
	onActiveChange?: (active: boolean, item: ScenePlantDragItem | null) => void
	onMove?: (clientX: number, clientY: number) => void
	onDrop?: (item: ScenePlantDragItem, clientX: number, clientY: number) => void
	onCancel?: () => void
}

let handlers: ScenePlantPointerDragHandlers = {}
let trackingItem: ScenePlantDragItem | null = null
let dragActive = false
let startX = 0
let startY = 0
let pointerId: number | null = null
let suppressClick = false
let removeWindowListeners: (() => void) | null = null

export function setScenePlantPointerDragHandlers(
	next: ScenePlantPointerDragHandlers | null
) {
	handlers = next ?? {}
}

export function shouldSuppressPlantClick(): boolean {
	if (!suppressClick) return false
	suppressClick = false
	return true
}

export function isScenePlantPointerDragging(): boolean {
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
 * 与素材侧栏拖拽同一交互模型。
 */
export function beginScenePlantPointerDrag(
	item: ScenePlantDragItem,
	e: PointerEvent
) {
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

export function isEzTreePresetId(id: string): id is EzTreePresetId {
	return (
		id === 'Ash Small' ||
		id === 'Ash Medium' ||
		id === 'Ash Large' ||
		id === 'Aspen Small' ||
		id === 'Aspen Medium' ||
		id === 'Aspen Large' ||
		id === 'Bush 1' ||
		id === 'Bush 2' ||
		id === 'Bush 3' ||
		id === 'Oak Small' ||
		id === 'Oak Medium' ||
		id === 'Oak Large' ||
		id === 'Pine Small' ||
		id === 'Pine Medium' ||
		id === 'Pine Large'
	)
}
