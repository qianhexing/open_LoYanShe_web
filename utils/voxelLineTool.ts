import { gridKeyToBlockCenter, VOXEL_BLOCK_SIZE } from '@/utils/voxelBlockBuild'
import * as THREE from 'three'

export type VoxelBuildTool = 'single' | 'line' | 'plane'
export type PlaneDrawPhase = 'line' | 'expand'
export type LineAxis = 'x' | 'y' | 'z'

/** 屏幕移动超过该像素后锁定拖拽轴 */
export const LINE_AXIS_LOCK_PX = 6

const _axisDir = new THREE.Vector3()
const _viewDir = new THREE.Vector3()
const _planeNormal = new THREE.Vector3()
const _plane = new THREE.Plane()
const _planeHit = new THREE.Vector3()
const _dragWorld = new THREE.Vector3()
const _camRight = new THREE.Vector3()
const _camUp = new THREE.Vector3()

export interface GridIndex {
	x: number
	y: number
	z: number
}

export function parseGridKey(gridKey: string): GridIndex {
	const [x, y, z] = gridKey.split(',').map(Number)
	return { x, y, z }
}

export function formatGridKey(index: GridIndex): string {
	return `${index.x},${index.y},${index.z}`
}

/** 将终点约束到与起点仅相差一条 X/Y/Z 轴直线 */
export function axisLockedEndKey(startKey: string, endKey: string): string {
	const start = parseGridKey(startKey)
	const end = parseGridKey(endKey)
	const dx = end.x - start.x
	const dy = end.y - start.y
	const dz = end.z - start.z
	const adx = Math.abs(dx)
	const ady = Math.abs(dy)
	const adz = Math.abs(dz)

	if (ady >= adx && ady >= adz) {
		return formatGridKey({ x: start.x, y: start.y + dy, z: start.z })
	}
	if (adx >= ady && adx >= adz) {
		return formatGridKey({ x: start.x + dx, y: start.y, z: start.z })
	}
	return formatGridKey({ x: start.x, y: start.y, z: start.z + dz })
}

function axisDirection(axis: LineAxis): THREE.Vector3 {
	return _axisDir.set(
		axis === 'x' ? 1 : 0,
		axis === 'y' ? 1 : 0,
		axis === 'z' ? 1 : 0
	)
}

/**
 * 根据屏幕拖拽方向锁定 X/Y/Z 轴（竖向拖拽会优先锁 Y，不受射线相邻格限制）
 */
export function pickLineAxisFromScreenDelta(
	screenDx: number,
	screenDy: number,
	camera: THREE.Camera
): LineAxis {
	_camRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
	_camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
	_dragWorld.copy(_camRight).multiplyScalar(screenDx).addScaledVector(_camUp, -screenDy)

	const candidates: { axis: LineAxis; score: number }[] = [
		{ axis: 'x', score: Math.abs(_dragWorld.x) },
		{ axis: 'y', score: Math.abs(_dragWorld.y) },
		{ axis: 'z', score: Math.abs(_dragWorld.z) }
	]
	candidates.sort((a, b) => b.score - a.score)
	return candidates[0]?.axis ?? 'y'
}

const ALL_AXES: LineAxis[] = ['x', 'y', 'z']

export function otherAxes(lineAxis: LineAxis): LineAxis[] {
	return ALL_AXES.filter((axis) => axis !== lineAxis)
}

/** 平面第二步：在与直线轴垂直的两个轴中选拖拽方向 */
export function pickPerpAxisFromScreenDelta(
	screenDx: number,
	screenDy: number,
	camera: THREE.Camera,
	lineAxis: LineAxis
): LineAxis {
	_camRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
	_camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
	_dragWorld.copy(_camRight).multiplyScalar(screenDx).addScaledVector(_camUp, -screenDy)

	const candidates = otherAxes(lineAxis)
	let best = candidates[0] ?? 'x'
	let bestScore = -1
	for (const axis of candidates) {
		const score = Math.abs(_dragWorld.dot(axisDirection(axis)))
		if (score > bestScore) {
			bestScore = score
			best = axis
		}
	}
	return best
}

/** 以直线边为起点，沿垂直轴扩展成矩形平面（含直线边） */
export function computePlaneKeysFromLine(
	lineKeys: string[],
	perpAxis: LineAxis,
	perpSteps: number
): string[] {
	const sign = Math.sign(perpSteps) || 1
	const absSteps = Math.abs(perpSteps)
	const result = new Set<string>()

	for (const lineKey of lineKeys) {
		const base = parseGridKey(lineKey)
		for (let p = 0; p <= absSteps; p++) {
			const idx = { ...base }
			const offset = p * sign
			if (perpAxis === 'x') idx.x += offset
			else if (perpAxis === 'y') idx.y += offset
			else idx.z += offset
			result.add(formatGridKey(idx))
		}
	}
	return [...result]
}

/** 从直线两端格子推断直线轴 */
export function inferLineAxisFromKeys(startKey: string, endKey: string): LineAxis {
	const a = parseGridKey(startKey)
	const b = parseGridKey(endKey)
	if (a.x !== b.x) return 'x'
	if (a.y !== b.y) return 'y'
	return 'z'
}

export function computePlaneKeysForDrag(
	lineKeys: string[],
	lineAxis: LineAxis,
	anchorKey: string,
	screenDx: number,
	screenDy: number,
	ray: THREE.Ray,
	camera: THREE.Camera,
	lockedPerpAxis: LineAxis | null,
	viewHeight = 720
): { keys: string[]; lockedPerpAxis: LineAxis | null } {
	if (lineKeys.length === 0) {
		return { keys: [], lockedPerpAxis: null }
	}
	if (Math.hypot(screenDx, screenDy) < LINE_AXIS_LOCK_PX) {
		return { keys: lineKeys, lockedPerpAxis: null }
	}

	const perpAxis =
		lockedPerpAxis ?? pickPerpAxisFromScreenDelta(screenDx, screenDy, camera, lineAxis)
	const endKey = lineEndKeyFromLockedAxis(anchorKey, perpAxis, ray, camera, {
		dx: screenDx,
		dy: screenDy,
		viewHeight
	})
	const anchor = parseGridKey(anchorKey)
	const end = parseGridKey(endKey)
	let perpSteps = 0
	if (perpAxis === 'x') perpSteps = end.x - anchor.x
	else if (perpAxis === 'y') perpSteps = end.y - anchor.y
	else perpSteps = end.z - anchor.z

	return {
		keys: computePlaneKeysFromLine(lineKeys, perpAxis, perpSteps),
		lockedPerpAxis: perpAxis
	}
}

/**
 * 轴已锁定后：射线与含该轴且面向相机的平面求交，推算沿轴的格子步数
 */
export function lineEndKeyFromLockedAxis(
	startKey: string,
	axis: LineAxis,
	ray: THREE.Ray,
	camera: THREE.Camera,
	screenDrag?: { dx: number; dy: number; viewHeight: number }
): string {
	const start = parseGridKey(startKey)
	const startCenter = gridKeyToBlockCenter(startKey)
	const dir = axisDirection(axis)

	camera.getWorldDirection(_viewDir)
	_planeNormal.crossVectors(dir, _viewDir)
	if (_planeNormal.lengthSq() < 1e-8) {
		_planeNormal.crossVectors(dir, camera.up)
	}
	if (_planeNormal.lengthSq() < 1e-8) {
		_camRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
		_planeNormal.crossVectors(dir, _camRight)
	}
	if (_planeNormal.lengthSq() < 1e-8) {
		return startKey
	}
	_planeNormal.normalize()
	_plane.setFromNormalAndCoplanarPoint(_planeNormal, startCenter)

	let steps = 0
	if (ray.intersectPlane(_plane, _planeHit)) {
		const delta = _planeHit.sub(startCenter)
		if (axis === 'x') steps = Math.round(delta.x / VOXEL_BLOCK_SIZE)
		else if (axis === 'y') steps = Math.round(delta.y / VOXEL_BLOCK_SIZE)
		else steps = Math.round(delta.z / VOXEL_BLOCK_SIZE)
	} else if (screenDrag && 'fov' in camera) {
		_camRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
		_camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
		_dragWorld
			.copy(_camRight)
			.multiplyScalar(screenDrag.dx)
			.addScaledVector(_camUp, -screenDrag.dy)
		const along = _dragWorld.dot(dir)
		if (Math.abs(along) > 1e-6) {
			const dist = camera.position.distanceTo(startCenter)
			const vFov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov)
			const worldPerPixel =
				(2 * dist * Math.tan(vFov / 2)) / Math.max(screenDrag.viewHeight, 1)
			const dragPixels = Math.hypot(screenDrag.dx, screenDrag.dy)
			steps = Math.round((Math.sign(along) * dragPixels * worldPerPixel) / VOXEL_BLOCK_SIZE)
		}
	}

	return formatGridKey({
		x: start.x + (axis === 'x' ? steps : 0),
		y: start.y + (axis === 'y' ? steps : 0),
		z: start.z + (axis === 'z' ? steps : 0)
	})
}

export function computeLineKeysForDrag(
	startKey: string,
	screenDx: number,
	screenDy: number,
	ray: THREE.Ray,
	camera: THREE.Camera,
	lockedAxis: LineAxis | null,
	viewHeight = 720
): { keys: string[]; lockedAxis: LineAxis | null } {
	if (Math.hypot(screenDx, screenDy) < LINE_AXIS_LOCK_PX) {
		return { keys: [startKey], lockedAxis: null }
	}

	const axis = lockedAxis ?? pickLineAxisFromScreenDelta(screenDx, screenDy, camera)
	const endKey = lineEndKeyFromLockedAxis(startKey, axis, ray, camera, {
		dx: screenDx,
		dy: screenDy,
		viewHeight
	})
	return {
		keys: computeAxisLockedLineKeys(startKey, endKey),
		lockedAxis: axis
	}
}

/** 起点到轴锁定终点之间所有格子（含两端） */
export function computeAxisLockedLineKeys(startKey: string, endKey: string): string[] {
	const start = parseGridKey(startKey)
	const lockedEnd = parseGridKey(axisLockedEndKey(startKey, endKey))
	const dx = lockedEnd.x - start.x
	const dy = lockedEnd.y - start.y
	const dz = lockedEnd.z - start.z
	const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))
	if (steps === 0) return [startKey]

	const stepX = dx === 0 ? 0 : Math.sign(dx)
	const stepY = dy === 0 ? 0 : Math.sign(dy)
	const stepZ = dz === 0 ? 0 : Math.sign(dz)
	const keys: string[] = []
	for (let i = 0; i <= steps; i++) {
		keys.push(
			formatGridKey({
				x: start.x + stepX * i,
				y: start.y + stepY * i,
				z: start.z + stepZ * i
			})
		)
	}
	return keys
}

export function lineCentersFromGridKeys(gridKeys: string[]) {
	return gridKeys.map((key) => gridKeyToBlockCenter(key))
}

export const VOXEL_BUILD_TOOLS: { id: VoxelBuildTool; label: string; hint: string }[] = [
	{
		id: 'single',
		label: '单块',
		hint: '短按放置/拆除 · 拖动旋转视角'
	},
	{
		id: 'line',
		label: '直线',
		hint: '按住拖拽 · 方向锁定 X/Y/Z 轴 · 抬起填满'
	},
	{
		id: 'plane',
		label: '平面',
		hint: '先拖拽画线 · 再拖拽扩面 · 抬起填充'
	}
]

export function buildToolLabel(tool: VoxelBuildTool): string {
	return VOXEL_BUILD_TOOLS.find((t) => t.id === tool)?.label ?? tool
}

export function buildToolHint(
	tool: VoxelBuildTool,
	action: 'place' | 'remove',
	planePhase?: PlaneDrawPhase
): string {
	if (tool === 'plane' && action === 'place') {
		if (planePhase === 'expand') {
			return '第二步：拖拽拉出平面 · 抬起填充'
		}
		return '第一步：拖拽画直线 · 抬起确认边'
	}
	if (tool === 'line' && action === 'place') {
		return VOXEL_BUILD_TOOLS.find((t) => t.id === 'line')?.hint ?? ''
	}
	if (action === 'remove') {
		return '短按拆除 · 拖动旋转视角'
	}
	return VOXEL_BUILD_TOOLS.find((t) => t.id === 'single')?.hint ?? ''
}

/** 直线过长时截断，避免一次放置过多 */
export const VOXEL_LINE_MAX_BLOCKS = 512

export function clampLineKeys(keys: string[]): string[] {
	if (keys.length <= VOXEL_LINE_MAX_BLOCKS) return keys
	return keys.slice(0, VOXEL_LINE_MAX_BLOCKS)
}

/** 平面填充上限 */
export const VOXEL_PLANE_MAX_BLOCKS = 4096

export function clampPlaneKeys(keys: string[]): string[] {
	if (keys.length <= VOXEL_PLANE_MAX_BLOCKS) return keys
	return keys.slice(0, VOXEL_PLANE_MAX_BLOCKS)
}
