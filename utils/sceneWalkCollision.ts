import type { GalleryWall } from '@/types/gallery'
import { createSceneWallMesh } from '@/utils/sceneWallBuild'
import type { AABB2D } from '@/utils/galleryCollision'
import * as THREE from 'three'

const _bounds = new THREE.Box3()
const _meshBounds = new THREE.Box3()

/** 将墙体转为 XZ 平面碰撞 AABB（与 Three.js 墙体朝向一致） */
export function wallColliderAABB(wall: GalleryWall): AABB2D {
	const mesh = createSceneWallMesh(wall)
	_meshBounds.setFromObject(mesh)
	mesh.geometry.dispose()
	const mat = mesh.material
	if (mat instanceof THREE.Material) mat.dispose()
	return {
		minX: _meshBounds.min.x,
		maxX: _meshBounds.max.x,
		minZ: _meshBounds.min.z,
		maxZ: _meshBounds.max.z
	}
}

/** 根据场景内容估算可活动边界（含 padding） */
export function computeSceneWalkBoundary(
	scene: THREE.Scene,
	playerRadius: number,
	padding = 6,
	minSize = 20
): AABB2D {
	_bounds.makeEmpty()
	let hasContent = false

	scene.traverse((obj) => {
		if (!obj.visible) return
		if (obj.userData?.ignorePick && !obj.userData?.isSceneWall) return
		if (obj.userData?.sceneEditorOverlay) return
		if (obj.userData?.isGalleryPlayer || obj.userData?.isSceneWalkPlayer) return

		if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
			_meshBounds.setFromObject(obj)
			if (
				Number.isFinite(_meshBounds.min.x)
				&& Number.isFinite(_meshBounds.max.x)
				&& !_meshBounds.isEmpty()
			) {
				_bounds.union(_meshBounds)
				hasContent = true
			}
		}
	})

	if (!hasContent) {
		const half = minSize / 2
		return {
			minX: -half + playerRadius,
			maxX: half - playerRadius,
			minZ: -half + playerRadius,
			maxZ: half - playerRadius
		}
	}

	const w = Math.max(_bounds.max.x - _bounds.min.x + padding * 2, minSize)
	const d = Math.max(_bounds.max.z - _bounds.min.z + padding * 2, minSize)
	const cx = (_bounds.min.x + _bounds.max.x) / 2
	const cz = (_bounds.min.z + _bounds.max.z) / 2

	return {
		minX: cx - w / 2 + playerRadius,
		maxX: cx + w / 2 - playerRadius,
		minZ: cz - d / 2 + playerRadius,
		maxZ: cz + d / 2 - playerRadius
	}
}

export function boundaryCenter(boundary: AABB2D): [number, number] {
	return [
		(boundary.minX + boundary.maxX) / 2,
		(boundary.minZ + boundary.maxZ) / 2
	]
}
