import type * as THREE from 'three'

/** 分组镜头（序列化用三元组，与拉线机位格式一致） */
export interface SceneStepCameraJSON {
	position: [number, number, number]
	target: [number, number, number]
	fov?: number
}

/** 场景分组：通过 userData.id 指定本组显示的对象（id 可重复） */
export interface SceneStepJSON {
	/** 本组可见的对象 userData.id 列表（允许重复） */
	id: string[]
	/** 分组介绍 */
	intro?: string
	/** 切换至本组时的镜头机位 */
	camera?: SceneStepCameraJSON
}

export function isSceneStepCameraJSON(
	value: unknown
): value is SceneStepCameraJSON {
	if (!value || typeof value !== 'object') return false
	const cam = value as SceneStepCameraJSON
	return (
		Array.isArray(cam.position) &&
		cam.position.length === 3 &&
		cam.position.every(n => typeof n === 'number' && Number.isFinite(n)) &&
		Array.isArray(cam.target) &&
		cam.target.length === 3 &&
		cam.target.every(n => typeof n === 'number' && Number.isFinite(n)) &&
		(cam.fov === undefined ||
			(typeof cam.fov === 'number' && Number.isFinite(cam.fov)))
	)
}

/** 参与分组显隐的用户内容类型（模型/点云/图片等），不含灯光、控制器等 */
const SCENE_STEP_CONTENT_TYPES = new Set([
	'model',
	'character',
	'image',
	'splat',
	'longtext',
	'3Dtext',
	'diary',
	'library',
	'laxian',
	'template',
	'box',
	'sphere',
	'object'
])

/**
 * 是否为可纳入分组的自主添加内容（顶层根节点）。
 * 灯光、变换控制器、网格辅助、SparkRenderer 等均不参与。
 */
export function isSceneStepContentRoot(obj: THREE.Object3D): boolean {
	if (obj.userData?.sceneEditorOverlay) return false
	if (obj.userData?.ignorePick && !obj.userData?.id) return false

	const id = obj.userData?.id
	if (typeof id === 'string' && id.startsWith('so_')) return true

	const type = obj.userData?.type
	if (typeof type === 'string' && SCENE_STEP_CONTENT_TYPES.has(type)) {
		return true
	}

	return false
}

/** 物体及其父级均可见时才算显示（用于同步隐藏屏幕标点） */
export function isSceneObjectEffectivelyVisible(obj: THREE.Object3D): boolean {
	let node: THREE.Object3D | null = obj
	while (node) {
		if (!node.visible) return false
		node = node.parent
	}
	return true
}

function shouldSkipStepVisibility(obj: THREE.Object3D): boolean {
	return !isSceneStepContentRoot(obj)
}

/** 根据当前分组索引切换场景根对象的 visible */
export function applySceneStepVisibility(
	roots: readonly THREE.Object3D[],
	steps: SceneStepJSON[],
	stepIndex: number
): number {
	if (!steps.length) return 0
	const index = Math.max(0, Math.min(stepIndex, steps.length - 1))
	const step = steps[index]
	if (!step) return index

	for (const child of roots) {
		if (shouldSkipStepVisibility(child)) continue
		const oid = child.userData?.id
		if (typeof oid !== 'string' || !oid.length) continue
		child.visible = step.id.includes(oid)
	}
	return index
}

export function sceneStepLabel(step: SceneStepJSON, index: number): string {
	const intro = step.intro?.trim()
	if (intro) return intro
	return `场景 ${index + 1}`
}

export interface SceneStepMember {
	uid: string
	objectId: string
}

export interface SceneObjectStepOption {
	id: string
	label: string
	type: string
}

export function sceneObjectStepLabel(obj: THREE.Object3D): string {
	const type = String(obj.userData?.type || 'object')
	const title = obj.userData?.title || obj.userData?.text || obj.name
	if (typeof title === 'string' && title.trim()) {
		return title.trim()
	}
	const url = obj.userData?.url
	if (typeof url === 'string' && url) {
		const path = url.split('?')[0] || url
		const parts = path.split('/')
		const file = parts[parts.length - 1]
		if (file) return file
	}
	return type
}

export function listSceneObjectsForSteps(
	roots: readonly THREE.Object3D[]
): SceneObjectStepOption[] {
	const result: SceneObjectStepOption[] = []
	for (const child of roots) {
		if (!isSceneStepContentRoot(child)) continue
		const id = child.userData?.id
		if (typeof id !== 'string' || !id.length) continue
		result.push({
			id,
			label: sceneObjectStepLabel(child),
			type: String(child.userData?.type || 'object')
		})
	}
	return result
}

export function membersFromStepIds(
	stepIndex: number,
	ids: string[]
): SceneStepMember[] {
	return ids.map((objectId, idx) => ({
		uid: `s${stepIndex}-i${idx}-${objectId}`,
		objectId
	}))
}

export function idsFromMembers(members: readonly SceneStepMember[]): string[] {
	return members.map(m => m.objectId)
}

export function pruneSceneObjectIdFromSteps(
	steps: SceneStepJSON[],
	objectId: string
): void {
	for (const step of steps) {
		step.id = step.id.filter(id => id !== objectId)
	}
}

export function showAllStepManagedObjects(roots: readonly THREE.Object3D[]): void {
	for (const child of roots) {
		if (shouldSkipStepVisibility(child)) continue
		child.visible = true
	}
}

/** 分组编辑模式：先显示全部，再隐藏指定分组内的物体（同时仅允许隐藏一个分组） */
export function applyGroupingStepHidden(
	roots: readonly THREE.Object3D[],
	steps: SceneStepJSON[],
	hiddenStepIndex: number | null
): void {
	showAllStepManagedObjects(roots)
	if (hiddenStepIndex === null || hiddenStepIndex < 0 || hiddenStepIndex >= steps.length) {
		return
	}
	const step = steps[hiddenStepIndex]
	if (!step?.id.length) return

	const idSet = new Set(step.id)
	for (const child of roots) {
		if (shouldSkipStepVisibility(child)) continue
		const oid = child.userData?.id
		if (typeof oid === 'string' && oid.length > 0 && idSet.has(oid)) {
			child.visible = false
		}
	}
}

/** 从命中节点向上找到可写入分组的场景根对象（含 userData.id 的顶层可编辑节点） */
export function resolveStepGroupRoot(
	object: THREE.Object3D,
	scene: THREE.Object3D
): THREE.Object3D | null {
	let node: THREE.Object3D | null = object
	while (node) {
		if (node.userData?.sceneEditorOverlay) return null
		if (typeof node.userData?.id === 'string' && node.userData.id.length > 0) {
			return node
		}
		node = node.parent
	}
	node = object
	while (node.parent && node.parent !== scene) {
		node = node.parent
	}
	if (node.userData?.sceneEditorOverlay) return null
	if (node.userData?.ignorePick && !node.userData?.id) return null
	return node
}

export function labelForStepGroupRoot(obj: THREE.Object3D): string {
	return sceneObjectStepLabel(obj)
}

/** 按 userData.id 查找可纳入分组的场景根对象 */
export function findSceneStepContentByObjectId(
	roots: readonly THREE.Object3D[],
	objectId: string
): THREE.Object3D | null {
	if (!objectId) return null
	for (const child of roots) {
		if (!isSceneStepContentRoot(child)) continue
		if (child.userData?.id === objectId) return child
	}
	return null
}

export function sceneObjectTypeLabel(type: string): string {
	const map: Record<string, string> = {
		model: '模型',
		character: '角色',
		image: '图片',
		splat: '点云',
		longtext: '长文本',
		'3Dtext': '3D文本',
		diary: '日记',
		library: '图鉴',
		laxian: '拉线',
		template: '模版',
		box: '立方体',
		sphere: '球体'
	}
	return map[type] || type
}
