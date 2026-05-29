import type * as THREE from 'three'

const ID_PREFIX = 'so_'

/** 生成场景可编辑对象唯一 id（写入 userData.id） */
export function generateSceneObjectId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${ID_PREFIX}${crypto.randomUUID()}`
	}
	return `${ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/** 收集场景顶层子节点已占用的 userData.id */
export function collectTopLevelSceneObjectIds(scene: THREE.Object3D): Set<string> {
	const ids = new Set<string>()
	for (const child of scene.children) {
		const id = child.userData?.id
		if (typeof id === 'string' && id.length > 0) {
			ids.add(id)
		}
	}
	return ids
}

/**
 * 为场景对象写入 userData.id。
 * - 传入 savedId：恢复已保存 id（再次打开场景时不变）
 * - 未传 savedId：生成新 id，并避开 reservedIds 中已有值（克隆/新加）
 */
export function stampSceneObjectId(
	obj: THREE.Object3D,
	options: {
		savedId?: string | null
		reservedIds?: Set<string>
	} = {}
): string {
	const reservedIds = options.reservedIds ?? new Set<string>()
	const savedId = options.savedId

	if (typeof savedId === 'string' && savedId.length > 0) {
		obj.userData.id = savedId
		reservedIds.add(savedId)
		return savedId
	}

	let id = generateSceneObjectId()
	while (reservedIds.has(id)) {
		id = generateSceneObjectId()
	}
	obj.userData.id = id
	reservedIds.add(id)
	return id
}
