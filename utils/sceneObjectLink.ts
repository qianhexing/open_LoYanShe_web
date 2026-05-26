import * as THREE from 'three'
import { isSceneObjectEffectivelyVisible } from '@/utils/sceneSteps'

/** 场景模型关联类型（可扩展：wardrobe / library / text / url …） */
export type SceneObjectLinkType = 'wardrobe' | 'library' | 'text' | 'url'

/** 单条关联：仅 type + id */
export interface SceneObjectLink {
	type: SceneObjectLinkType
	/** 业务主键，如 wardrobe_id、library_id */
	id: number | string
}

const LINKABLE_TYPES = new Set(['model', 'character'])

export function isLinkableSceneObject(obj: THREE.Object3D): boolean {
	const t = obj.userData?.type
	return typeof t === 'string' && LINKABLE_TYPES.has(t)
}

export function normalizeSceneObjectLinks(
	raw: unknown
): SceneObjectLink[] {
	if (!Array.isArray(raw)) return []
	const out: SceneObjectLink[] = []
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue
		const o = item as Record<string, unknown>
		const type = o.type as SceneObjectLinkType
		if (
			type !== 'wardrobe' &&
			type !== 'library' &&
			type !== 'text' &&
			type !== 'url'
		) {
			continue
		}
		const id = o.id
		if (id === undefined || id === null || id === '') continue
		out.push({
			type,
			id: typeof id === 'number' ? id : String(id)
		})
	}
	return out
}

export function getSceneObjectLinks(obj: THREE.Object3D): SceneObjectLink[] {
	return normalizeSceneObjectLinks(obj.userData?.links)
}

export function setSceneObjectLinks(
	obj: THREE.Object3D,
	links: SceneObjectLink[]
): void {
	obj.userData.links = links.length
		? links.map(l => ({ type: l.type, id: l.id }))
		: undefined
}

export function hasSceneObjectLinks(obj: THREE.Object3D): boolean {
	return getSceneObjectLinks(obj).length > 0
}

export function cloneSceneObjectLinks(
	links: SceneObjectLink[] | undefined
): SceneObjectLink[] | undefined {
	if (!links?.length) return undefined
	return links.map(l => ({ type: l.type, id: l.id }))
}

export function sceneObjectLinkKey(link: SceneObjectLink): string {
	return `${link.type}:${link.id}`
}

export function sceneObjectLinkTypeLabel(type: SceneObjectLinkType): string {
	switch (type) {
		case 'wardrobe':
			return '衣柜'
		case 'library':
			return '图鉴'
		case 'text':
			return '文本'
		case 'url':
			return '链接'
		default:
			return type
	}
}

const _boundsBox = new THREE.Box3()
const _boundsCorner = new THREE.Vector3()

/** 场景顶层子节点中带关联的模型/角色 */
export function collectSceneObjectsWithLinks(scene: THREE.Scene): THREE.Object3D[] {
	const out: THREE.Object3D[] = []
	for (const child of scene.children) {
		if (child.userData?.ignorePick || child.userData?.sceneEditorOverlay) {
			continue
		}
		if (
			isLinkableSceneObject(child)
			&& hasSceneObjectLinks(child)
			&& isSceneObjectEffectivelyVisible(child)
		) {
			out.push(child)
		}
	}
	return out
}

export interface LinkBadgeScreenPoint {
	/** 相对 renderer 画布左上角的像素坐标 */
	x: number
	y: number
	visible: boolean
}

/** 屏幕包围盒右上角向中心收拢的比例（越大越贴近模型） */
const LINK_BADGE_INSET = 0.35

/**
 * 将物体世界包围盒投影到屏幕矩形，取右上角并向中心收拢，使角标更贴近模型。
 */
export function getLinkBadgeScreenPosition(
	object: THREE.Object3D,
	camera: THREE.Camera,
	viewSize: { width: number; height: number }
): LinkBadgeScreenPoint | null {
	if (!isSceneObjectEffectivelyVisible(object)) return null
	if (viewSize.width <= 0 || viewSize.height <= 0) return null

	_boundsBox.setFromObject(object)
	if (_boundsBox.isEmpty()) return null

	const { min, max } = _boundsBox
	const xs = [min.x, max.x]
	const ys = [min.y, max.y]
	const zs = [min.z, max.z]

	let minSx = Number.POSITIVE_INFINITY
	let maxSx = Number.NEGATIVE_INFINITY
	let minSy = Number.POSITIVE_INFINITY
	let maxSy = Number.NEGATIVE_INFINITY
	let anyInFront = false

	for (const x of xs) {
		for (const y of ys) {
			for (const z of zs) {
				_boundsCorner.set(x, y, z).project(camera)
				if (_boundsCorner.z >= 1) continue
				anyInFront = true
				const sx = ((_boundsCorner.x + 1) * viewSize.width) / 2
				const sy = ((-_boundsCorner.y + 1) * viewSize.height) / 2
				minSx = Math.min(minSx, sx)
				maxSx = Math.max(maxSx, sx)
				minSy = Math.min(minSy, sy)
				maxSy = Math.max(maxSy, sy)
			}
		}
	}

	if (!anyInFront || !Number.isFinite(minSx) || !Number.isFinite(maxSx)) {
		return null
	}

	const cx = (minSx + maxSx) / 2
	const cy = (minSy + maxSy) / 2
	const t = LINK_BADGE_INSET
	const x = maxSx - (maxSx - cx) * t
	const y = minSy + (cy - minSy) * t

	const margin = 40
	if (
		x < -margin ||
		y < -margin ||
		x > viewSize.width + margin ||
		y > viewSize.height + margin
	) {
		return null
	}

	return { x, y, visible: true }
}
