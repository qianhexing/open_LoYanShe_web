import type { GalleryWall } from '@/types/gallery'
import * as THREE from 'three'

export const SCENE_WALL_DEFAULT_HEIGHT = 3
export const SCENE_WALL_DEFAULT_THICKNESS = 0.2
export const SCENE_WALL_MIN_LENGTH = 0.25
export const SCENE_WALL_SNAP = 0.5

const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _planeHit = new THREE.Vector3()

export function snapWallCoord(value: number): number {
	return Math.round(value / SCENE_WALL_SNAP) * SCENE_WALL_SNAP
}

export function snapWallPoint(x: number, z: number) {
	return { x: snapWallCoord(x), z: snapWallCoord(z) }
}

/**
 * 由拉线两端点生成墙体配置。
 * Box 沿本地 X 为长度，中心在两端点中点，端点与 (sx,sz)、(ex,ez) 对齐（所见即所得）。
 */
export function wallConfigFromEndpoints(
	sx: number,
	sz: number,
	ex: number,
	ez: number,
	height = SCENE_WALL_DEFAULT_HEIGHT,
	thickness = SCENE_WALL_DEFAULT_THICKNESS
): GalleryWall | null {
	const dx = ex - sx
	const dz = ez - sz
	const length = Math.hypot(dx, dz)
	if (length < SCENE_WALL_MIN_LENGTH) return null

	// Three.js rotation.y：本地 +X 轴在世界 XZ 为 (cos θ, -sin θ)
	const rotation = Math.atan2(-dz, dx)

	return {
		position: [(sx + ex) / 2, (sz + ez) / 2],
		size: [length, thickness],
		rotation,
		height
	}
}

/** 拖拽两点生成展馆同款墙体配置（XZ 平面，端点吸附网格） */
export function wallConfigFromDrag(
	x1: number,
	z1: number,
	x2: number,
	z2: number,
	height = SCENE_WALL_DEFAULT_HEIGHT,
	thickness = SCENE_WALL_DEFAULT_THICKNESS
): GalleryWall | null {
	const start = snapWallPoint(x1, z1)
	const end = snapWallPoint(x2, z2)
	return wallConfigFromEndpoints(
		start.x,
		start.z,
		end.x,
		end.z,
		height,
		thickness
	)
}

export function createSceneWallMaterial(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: 0xe8dce2,
		roughness: 0.7,
		metalness: 0.1,
		side: THREE.DoubleSide
	})
}

/** 与展馆 createWalls 一致的可视墙体 */
export function createSceneWallMesh(
	wall: GalleryWall,
	material?: THREE.Material
): THREE.Mesh {
	const h = wall.height ?? SCENE_WALL_DEFAULT_HEIGHT
	const geo = new THREE.BoxGeometry(wall.size[0], h, wall.size[1])
	const mesh = new THREE.Mesh(geo, material ?? createSceneWallMaterial())
	mesh.position.set(wall.position[0], h / 2, wall.position[1])
	mesh.rotation.y = wall.rotation ?? 0
	mesh.castShadow = true
	mesh.receiveShadow = true
	mesh.userData.isSceneWall = true
	return mesh
}

/** 射线与 y=0 地面求交 */
export function intersectGroundPlane(ray: THREE.Ray): THREE.Vector3 | null {
	const hit = ray.intersectPlane(_groundPlane, _planeHit)
	return hit ? _planeHit.clone() : null
}

const WALL_LINE_Y = 0.06

/** 顶视拉线预览 */
export function createWallLinePreview(): THREE.Line {
	const geometry = new THREE.BufferGeometry().setFromPoints([
		new THREE.Vector3(),
		new THREE.Vector3()
	])
	const material = new THREE.LineBasicMaterial({
		color: 0x38bdf8,
		depthTest: false,
		transparent: true,
		opacity: 0.95
	})
	const line = new THREE.Line(geometry, material)
	line.frustumCulled = false
	line.renderOrder = 999
	line.userData.ignorePick = true
	line.userData.sceneEditorOverlay = true
	line.visible = false
	return line
}

export function updateWallLinePreview(
	line: THREE.Line,
	x1: number,
	z1: number,
	x2: number,
	z2: number
) {
	const positions = line.geometry.attributes.position as THREE.BufferAttribute
	positions.setXYZ(0, x1, WALL_LINE_Y, z1)
	positions.setXYZ(1, x2, WALL_LINE_Y, z2)
	positions.needsUpdate = true
	line.geometry.computeBoundingSphere()
	line.visible = true
}

/** 拉线起点标记 */
export function createWallStartMarker(): THREE.Mesh {
	const mesh = new THREE.Mesh(
		new THREE.RingGeometry(0.12, 0.2, 24),
		new THREE.MeshBasicMaterial({
			color: 0x38bdf8,
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 0.9
		})
	)
	mesh.rotation.x = -Math.PI / 2
	mesh.position.y = WALL_LINE_Y
	mesh.renderOrder = 999
	mesh.userData.ignorePick = true
	mesh.userData.sceneEditorOverlay = true
	mesh.visible = false
	return mesh
}

export function updateWallStartMarker(marker: THREE.Mesh, x: number, z: number) {
	marker.position.set(x, WALL_LINE_Y, z)
	marker.visible = true
}
