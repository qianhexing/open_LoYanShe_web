import * as THREE from 'three'
import type { SceneObjectJSON } from '@/utils/threeCore'
import {
	blockCenterToGridKey,
	gridKeyToBlockCenter,
	specFromSceneObject,
	type VoxelBlockSpec,
	VOXEL_BLOCK_HALF,
	VOXEL_BLOCK_SIZE,
	worldToBlockCenter
} from '@/utils/voxelBlockBuild'

const INITIAL_CAPACITY = 8192
const GROW_FACTOR = 2

/** solid 或贴图 preset id */
type LayerKey = string

interface BlockEntry {
	gridKey: string
	center: THREE.Vector3
	spec: VoxelBlockSpec
	layerKey: LayerKey
	instanceIndex: number
	objectId?: string
}

interface LayerState {
	key: LayerKey
	mesh: THREE.InstancedMesh
	count: number
	capacity: number
	/** instanceIndex -> gridKey */
	slots: Map<number, string>
}

type IdAssigner = (savedId?: string) => string

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()
const _normal = new THREE.Vector3()
const _placementCenter = new THREE.Vector3()
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _planeHit = new THREE.Vector3()
const _pickOnRay = new THREE.Vector3()
const _pickToCenter = new THREE.Vector3()

export interface VoxelPickOptions {
	/** 编辑模式：多命中择优 + 射线邻近兜底 */
	precise?: boolean
}

function distanceSqPointToRay(point: THREE.Vector3, ray: THREE.Ray): number {
	ray.closestPointToPoint(point, _pickOnRay)
	return point.distanceToSquared(_pickOnRay)
}

export interface VoxelPlacementOptions {
	/** 编辑模式：相邻格推算、遍历命中、场景表面兜底 */
	precise?: boolean
	/** 编辑模式下额外参与放置射线检测的场景根节点 */
	sceneTargets?: THREE.Object3D[]
}

export interface VoxelPlacementResult {
	center: THREE.Vector3
	canPlace: boolean
	gridKey: string
}

function snapAxisNormal(normal: THREE.Vector3) {
	normal.x = Math.round(normal.x)
	normal.y = Math.round(normal.y)
	normal.z = Math.round(normal.z)
}

function getHitFaceNormalWorld(hit: THREE.Intersection): THREE.Vector3 {
	if (!hit.face) return _normal.set(0, 1, 0)
	const mesh = hit.object as THREE.InstancedMesh
	_normal.copy(hit.face.normal)
	if (mesh.isInstancedMesh && hit.instanceId != null && hit.instanceId >= 0) {
		mesh.getMatrixAt(hit.instanceId, _dummy.matrix)
		_dummy.matrix.premultiply(mesh.matrixWorld)
		_normal.transformDirection(_dummy.matrix)
	} else {
		_normal.transformDirection(mesh.matrixWorld)
	}
	snapAxisNormal(_normal)
	return _normal
}

function getMeshHitFaceNormalWorld(hit: THREE.Intersection): THREE.Vector3 {
	if (!hit.face) return _normal.set(0, 1, 0)
	_normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
	snapAxisNormal(_normal)
	return _normal
}

function placementFromAdjacentGrid(
	hitCenter: THREE.Vector3,
	normal: THREE.Vector3,
	occupied: Set<string>
): VoxelPlacementResult {
	_placementCenter.copy(hitCenter).addScaledVector(normal, VOXEL_BLOCK_SIZE)
	const gridKey = blockCenterToGridKey(_placementCenter)
	return {
		center: _placementCenter.clone(),
		canPlace: !occupied.has(gridKey),
		gridKey
	}
}

/** 共享几何（所有层复用） */
let sharedBoxGeometry: THREE.BoxGeometry | null = null

function getSharedBoxGeometry() {
	if (!sharedBoxGeometry) {
		sharedBoxGeometry = new THREE.BoxGeometry(
			VOXEL_BLOCK_SIZE,
			VOXEL_BLOCK_SIZE,
			VOXEL_BLOCK_SIZE
		)
	}
	return sharedBoxGeometry
}

function layerKeyFromSpec(spec: VoxelBlockSpec): LayerKey {
	return String(spec.variant)
}

function createSolidLayerMaterial() {
	return new THREE.MeshLambertMaterial({
		vertexColors: false
	})
}

/** 贴图层材质（preset id → 六面材质，由 voxelBlockBuild 注入） */
export type VoxelLayerMaterialFactory = (presetId: string) => THREE.Material | THREE.Material[]

/**
 * InstancedMesh 方块层：solid 用 instanceColor，贴图变体各一层。
 * 极多方块仅少量 draw call。
 */
export class VoxelBlockManager {
	readonly root: THREE.Group
	private blocks = new Map<string, BlockEntry>()
	private layers = new Map<LayerKey, LayerState>()
	private idAssigner: IdAssigner = () => crypto.randomUUID()
	private materialFactory: VoxelLayerMaterialFactory | null = null
	private batchDepth = 0
	/** 编辑模式：关闭视锥剔除，拾取/放置更精确 */
	private preciseInteraction = false

	constructor(scene: THREE.Scene) {
		this.root = new THREE.Group()
		this.root.name = 'VoxelBlockLayer'
		this.root.userData.type = 'voxelBlockLayer'
		this.root.userData.ignorePick = true
		scene.add(this.root)
	}

	setIdAssigner(fn: IdAssigner) {
		this.idAssigner = fn
	}

	setMaterialFactory(factory: VoxelLayerMaterialFactory) {
		this.materialFactory = factory
	}

	setPreciseInteraction(enabled: boolean) {
		this.preciseInteraction = enabled
		for (const layer of this.layers.values()) {
			layer.mesh.frustumCulled = !enabled
		}
	}

	private createLayer(key: LayerKey, capacity: number): LayerState {
		const geometry = getSharedBoxGeometry()
		let material: THREE.Material | THREE.Material[]
		if (key === 'solid') {
			material = createSolidLayerMaterial()
		} else {
			if (!this.materialFactory) {
				material = new THREE.MeshLambertMaterial({ color: 0xffffff })
			} else {
				material = this.materialFactory(key)
			}
		}
		const mesh = new THREE.InstancedMesh(geometry, material, capacity)
		mesh.count = 0
		mesh.frustumCulled = !this.preciseInteraction
		mesh.castShadow = false
		mesh.receiveShadow = true
		mesh.userData.voxelBlockLayer = key
		mesh.userData.type = 'voxelBlockInstanced'
		if (key === 'solid') {
			mesh.instanceColor = new THREE.InstancedBufferAttribute(
				new Float32Array(capacity * 3),
				3
			)
		}
		this.root.add(mesh)
		const layer: LayerState = {
			key,
			mesh,
			count: 0,
			capacity,
			slots: new Map()
		}
		this.layers.set(key, layer)
		return layer
	}

	private getOrCreateLayer(key: LayerKey): LayerState {
		let layer = this.layers.get(key)
		if (!layer) layer = this.createLayer(key, INITIAL_CAPACITY)
		if (layer.count >= layer.capacity) {
			this.growLayer(layer)
		}
		return layer
	}

	private growLayer(layer: LayerState) {
		const newCap = Math.min(layer.capacity * GROW_FACTOR, 500_000)
		if (newCap <= layer.capacity) return
		const oldMesh = layer.mesh
		const oldCount = layer.count
		const geometry = getSharedBoxGeometry()
		const newMesh = new THREE.InstancedMesh(geometry, oldMesh.material, newCap)
		newMesh.count = oldCount
		newMesh.frustumCulled = !this.preciseInteraction
		newMesh.castShadow = oldMesh.castShadow
		newMesh.receiveShadow = oldMesh.receiveShadow
		newMesh.userData = { ...oldMesh.userData }
		if (layer.key === 'solid' && oldMesh.instanceColor) {
			const colors = new Float32Array(newCap * 3)
			colors.set(oldMesh.instanceColor.array.subarray(0, oldCount * 3))
			newMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
		}
		for (let i = 0; i < oldCount; i++) {
			oldMesh.getMatrixAt(i, _dummy.matrix)
			newMesh.setMatrixAt(i, _dummy.matrix)
			if (layer.key === 'solid' && oldMesh.instanceColor && newMesh.instanceColor) {
				_color.fromArray(oldMesh.instanceColor.array, i * 3)
				newMesh.setColorAt(i, _color)
			}
		}
		newMesh.instanceMatrix.needsUpdate = true
		if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true
		this.root.remove(oldMesh)
		oldMesh.dispose()
		this.root.add(newMesh)
		layer.mesh = newMesh
		layer.capacity = newCap
	}

	private writeInstance(layer: LayerState, index: number, center: THREE.Vector3, spec: VoxelBlockSpec) {
		_dummy.position.copy(center)
		_dummy.rotation.set(0, 0, 0)
		_dummy.scale.set(1, 1, 1)
		_dummy.updateMatrix()
		layer.mesh.setMatrixAt(index, _dummy.matrix)
		if (layer.key === 'solid' && layer.mesh.instanceColor) {
			_color.set(spec.color ?? '#ffffff')
			layer.mesh.setColorAt(index, _color)
		}
	}

	private flushLayer(layer: LayerState) {
		layer.mesh.instanceMatrix.needsUpdate = true
		if (layer.mesh.instanceColor) {
			layer.mesh.instanceColor.needsUpdate = true
		}
		layer.mesh.count = layer.count
	}

	/** 从 InstancedMesh 命中解析被点击方块的 gridKey */
	resolveHitGridKey(hit: THREE.Intersection): string | null {
		const mesh = hit.object as THREE.InstancedMesh
		const instanceId = hit.instanceId
		if (instanceId != null && instanceId >= 0) {
			const layerKey = mesh.userData.voxelBlockLayer as LayerKey
			const layer = this.layers.get(layerKey)
			const keyFromSlot = layer?.slots.get(instanceId)
			if (keyFromSlot && this.blocks.has(keyFromSlot)) {
				return keyFromSlot
			}
			mesh.getMatrixAt(instanceId, _dummy.matrix)
			_dummy.matrix.decompose(_dummy.position, _dummy.quaternion, _dummy.scale)
			const keyFromMatrix = blockCenterToGridKey(_dummy.position)
			if (this.blocks.has(keyFromMatrix)) {
				return keyFromMatrix
			}
		}
		return this.gridKeyFromHit(hit)
	}

	/** 从射线命中面反推被点中的方块 gridKey */
	private gridKeyFromHit(hit: THREE.Intersection): string | null {
		if (!hit.face) return null
		const hitKey = this.resolveHitGridKeyFromGeometry(hit)
		if (hitKey && this.blocks.has(hitKey)) return hitKey

		const normal = getHitFaceNormalWorld(hit)
		const inward = hit.point.clone().add(normal.multiplyScalar(-VOXEL_BLOCK_SIZE * 0.51))
		const center = worldToBlockCenter(inward)
		const key = blockCenterToGridKey(center)
		return this.blocks.has(key) ? key : null
	}

	private resolveHitGridKeyFromGeometry(hit: THREE.Intersection): string | null {
		const mesh = hit.object as THREE.InstancedMesh
		const instanceId = hit.instanceId
		if (instanceId == null || instanceId < 0) return null
		const layerKey = mesh.userData.voxelBlockLayer as LayerKey
		const layer = this.layers.get(layerKey)
		const keyFromSlot = layer?.slots.get(instanceId)
		if (keyFromSlot) return keyFromSlot

		mesh.getMatrixAt(instanceId, _dummy.matrix)
		_dummy.matrix.decompose(_dummy.position, _dummy.quaternion, _dummy.scale)
		return blockCenterToGridKey(_dummy.position)
	}

	placementFromBlockHit(
		hit: THREE.Intersection,
		occupied: Set<string>
	): VoxelPlacementResult | null {
		if (!hit.face) return null
		const hitKey = this.resolveHitGridKey(hit)
		if (!hitKey) return null
		const hitCenter = gridKeyToBlockCenter(hitKey)
		const normal = getHitFaceNormalWorld(hit)
		return placementFromAdjacentGrid(hitCenter, normal, occupied)
	}

	/** 批量写入时推迟 GPU 缓冲更新，结束时调用 endBatch */
	beginBatch() {
		this.batchDepth += 1
	}

	endBatch() {
		if (this.batchDepth <= 0) return
		this.batchDepth -= 1
		if (this.batchDepth === 0) {
			for (const layer of this.layers.values()) {
				this.flushLayer(layer)
			}
		}
	}

	addBlock(
		spec: VoxelBlockSpec,
		center: THREE.Vector3 | [number, number, number],
		savedId?: string
	): boolean {
		const pos =
			center instanceof THREE.Vector3
				? center
				: new THREE.Vector3(center[0], center[1], center[2])
		const gridKey = blockCenterToGridKey(pos)
		if (this.blocks.has(gridKey)) return false

		const layerKey = layerKeyFromSpec(spec)
		const layer = this.getOrCreateLayer(layerKey)
		const instanceIndex = layer.count
		this.writeInstance(layer, instanceIndex, pos, spec)
		layer.count += 1
		layer.slots.set(instanceIndex, gridKey)
		this.blocks.set(gridKey, {
			gridKey,
			center: pos.clone(),
			spec: { ...spec },
			layerKey,
			instanceIndex,
			objectId: this.idAssigner(savedId)
		})
		if (this.batchDepth === 0) {
			this.flushLayer(layer)
		}
		return true
	}

	removeAtGridKey(gridKey: string): boolean {
		const entry = this.blocks.get(gridKey)
		if (!entry) return false
		const layer = this.layers.get(entry.layerKey)
		if (!layer) return false

		const removeIndex = entry.instanceIndex
		const lastIndex = layer.count - 1

		if (removeIndex !== lastIndex) {
			const lastGridKey = layer.slots.get(lastIndex)
			if (lastGridKey) {
				const lastEntry = this.blocks.get(lastGridKey)
				if (lastEntry) {
					layer.mesh.getMatrixAt(lastIndex, _dummy.matrix)
					layer.mesh.setMatrixAt(removeIndex, _dummy.matrix)
					if (layer.key === 'solid' && layer.mesh.instanceColor) {
						_color.fromArray(layer.mesh.instanceColor.array, lastIndex * 3)
						layer.mesh.setColorAt(removeIndex, _color)
					}
					lastEntry.instanceIndex = removeIndex
					layer.slots.set(removeIndex, lastGridKey)
					layer.slots.delete(lastIndex)
				}
			}
		} else {
			layer.slots.delete(lastIndex)
		}

		layer.count -= 1
		this.blocks.delete(gridKey)
		this.flushLayer(layer)
		return true
	}

	/** 批量放置（同一规格），编辑模式直线工具等使用 */
	addBlocksAtGridKeys(spec: VoxelBlockSpec, gridKeys: string[]): number {
		if (!gridKeys.length) return 0
		this.beginBatch()
		let added = 0
		for (const gridKey of gridKeys) {
			const center = gridKeyToBlockCenter(gridKey)
			if (this.addBlock(spec, center)) added += 1
		}
		this.endBatch()
		return added
	}

	getOccupiedKeys(): Set<string> {
		return new Set(this.blocks.keys())
	}

	getRaycastTargets(): THREE.Object3D[] {
		const targets: THREE.Object3D[] = []
		for (const layer of this.layers.values()) {
			if (layer.count > 0) targets.push(layer.mesh)
		}
		return targets
	}

	get count() {
		return this.blocks.size
	}

	/** 无 mesh 命中时：沿射线找最近的方块中心（仅编辑拆除兜底） */
	pickGridKeyByRayProximity(ray: THREE.Ray): string | null {
		const maxPerp = VOXEL_BLOCK_SIZE * 0.72
		let bestKey: string | null = null
		let bestScore = Number.POSITIVE_INFINITY

		for (const entry of this.blocks.values()) {
			const center = entry.center
			_pickToCenter.subVectors(center, ray.origin)
			const along = _pickToCenter.dot(ray.direction)
			if (along < -VOXEL_BLOCK_HALF) continue

			const perpDist = Math.sqrt(distanceSqPointToRay(center, ray))
			if (perpDist > maxPerp) continue

			const score = along + perpDist * 3
			if (score < bestScore) {
				bestScore = score
				bestKey = entry.gridKey
			}
		}
		return bestKey
	}

	/** 射线命中 InstancedMesh → gridKey */
	pickGridKey(raycaster: THREE.Raycaster, options?: VoxelPickOptions): string | null {
		const targets = this.getRaycastTargets()
		if (!targets.length) return null
		const hits = raycaster.intersectObjects(targets, false)
		const precise = options?.precise ?? false

		if (hits.length > 0) {
			if (!precise) {
				for (const hit of hits) {
					const key = this.resolveHitGridKey(hit)
					if (key && this.blocks.has(key)) return key
				}
			} else {
				let bestKey: string | null = null
				let bestDist = Number.POSITIVE_INFINITY
				for (const hit of hits) {
					const key = this.resolveHitGridKey(hit)
					if (!key || !this.blocks.has(key)) continue
					const dist = distanceSqPointToRay(gridKeyToBlockCenter(key), raycaster.ray)
					if (dist < bestDist) {
						bestDist = dist
						bestKey = key
					}
				}
				if (bestKey) return bestKey
			}
		}

		if (precise) {
			return this.pickGridKeyByRayProximity(raycaster.ray)
		}
		return null
	}

	exportSceneObjects(): SceneObjectJSON[] {
		const list: SceneObjectJSON[] = []
		for (const entry of this.blocks.values()) {
			const jsonObj: SceneObjectJSON = {
				type: 'voxelBlock',
				id: entry.objectId,
				size: [VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE],
				position: [entry.center.x, entry.center.y, entry.center.z],
				rotation: [0, 0, 0],
				scale: [1, 1, 1],
				options: {
					variant: entry.spec.variant,
					...(entry.spec.variant === 'solid' && entry.spec.color
						? { color: entry.spec.color }
						: {})
				}
			}
			list.push(jsonObj)
		}
		return list
	}

	async loadFromSceneObject(obj: SceneObjectJSON): Promise<boolean> {
		const spec = specFromSceneObject(obj)
		if (!spec) return false
		const pos = obj.position ?? [0, 0, 0]
		return this.addBlock(spec, pos, obj.id)
	}

	dispose() {
		for (const layer of this.layers.values()) {
			this.root.remove(layer.mesh)
			layer.mesh.dispose()
		}
		this.layers.clear()
		this.blocks.clear()
		if (this.root.parent) this.root.parent.remove(this.root)
	}

	/** 清空所有方块，保留层结构 */
	clear() {
		this.batchDepth = 0
		for (const layer of this.layers.values()) {
			layer.count = 0
			layer.slots.clear()
			layer.mesh.count = 0
		}
		this.blocks.clear()
	}
}

export function resolveVoxelPlacementForManager(
	raycaster: THREE.Raycaster,
	manager: VoxelBlockManager,
	occupiedOverride?: Set<string>,
	options?: VoxelPlacementOptions
): VoxelPlacementResult | null {
	const occupied = occupiedOverride ?? manager.getOccupiedKeys()
	const precise = options?.precise ?? false
	const targets = manager.getRaycastTargets()
	const blockHits = targets.length ? raycaster.intersectObjects(targets, false) : []

	if (blockHits.length > 0) {
		const hitsToTry = precise ? blockHits : blockHits.slice(0, 1)
		let fallback: VoxelPlacementResult | null = null
		for (const hit of hitsToTry) {
			const placement = manager.placementFromBlockHit(hit, occupied)
			if (!placement) continue
			if (placement.canPlace) return placement
			if (!fallback) fallback = placement
		}
		if (fallback) return fallback
	}

	if (precise && options?.sceneTargets?.length) {
		const sceneHits = raycaster.intersectObjects(options.sceneTargets, true)
		for (const hit of sceneHits) {
			if (!hit.face) continue
			const normal = getMeshHitFaceNormalWorld(hit)
			const adj = hit.point.clone().add(normal.multiplyScalar(VOXEL_BLOCK_SIZE * 0.51))
			const center = worldToBlockCenter(adj)
			if (center.y < VOXEL_BLOCK_HALF) center.y = VOXEL_BLOCK_HALF
			const gridKey = blockCenterToGridKey(center)
			const placement: VoxelPlacementResult = {
				center,
				canPlace: !occupied.has(gridKey),
				gridKey
			}
			if (placement.canPlace) return placement
		}
	}

	if (raycaster.ray.intersectPlane(_groundPlane, _planeHit)) {
		const center = worldToBlockCenter(_planeHit)
		if (center.y < VOXEL_BLOCK_HALF) center.y = VOXEL_BLOCK_HALF
		const gridKey = blockCenterToGridKey(center)
		return {
			center,
			canPlace: !occupied.has(gridKey),
			gridKey
		}
	}
	return null
}
