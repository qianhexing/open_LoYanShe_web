import type { GalleryWall } from '@/types/gallery'
import { createSceneWallMaterial, createSceneWallMesh } from '@/utils/sceneWallBuild'
import * as THREE from 'three'

interface WallEntry {
	config: GalleryWall
	mesh: THREE.Mesh
}

/**
 * 场景墙体容器：与展馆墙体数据格式一致，独立 Group 不参与 threeCore 对象序列化。
 */
export class SceneWallManager {
	readonly root: THREE.Group
	private readonly walls: WallEntry[] = []
	private readonly sharedMaterial: THREE.MeshStandardMaterial

	constructor(scene: THREE.Scene) {
		this.root = new THREE.Group()
		this.root.userData.isSceneWallRoot = true
		this.sharedMaterial = createSceneWallMaterial()
		scene.add(this.root)
	}

	loadFromJSON(walls?: GalleryWall[]) {
		this.clearMeshes()
		if (!walls?.length) return
		for (const wall of walls) {
			this.addWall(wall)
		}
	}

	exportJSON(): GalleryWall[] {
		return this.walls.map((entry) => ({
			position: [...entry.config.position],
			size: [...entry.config.size],
			...(entry.config.rotation != null ? { rotation: entry.config.rotation } : {}),
			...(entry.config.height != null ? { height: entry.config.height } : {})
		}))
	}

	addWall(config: GalleryWall): THREE.Mesh {
		const mesh = createSceneWallMesh(config, this.sharedMaterial)
		this.root.add(mesh)
		this.walls.push({ config, mesh })
		return mesh
	}

	removeMesh(mesh: THREE.Mesh): boolean {
		const index = this.walls.findIndex((entry) => entry.mesh === mesh)
		if (index < 0) return false
		const entry = this.walls[index]
		this.root.remove(entry.mesh)
		entry.mesh.geometry.dispose()
		this.walls.splice(index, 1)
		return true
	}

	pickWall(raycaster: THREE.Raycaster): THREE.Mesh | null {
		const hits = raycaster.intersectObjects(this.walls.map((entry) => entry.mesh), false)
		const hit = hits.find((item) => item.object.userData?.isSceneWall)
		return hit?.object instanceof THREE.Mesh ? hit.object : null
	}

	clear() {
		this.clearMeshes()
	}

	dispose() {
		this.clearMeshes()
		if (this.root.parent) {
			this.root.parent.remove(this.root)
		}
		this.sharedMaterial.dispose()
	}

	private clearMeshes() {
		for (const entry of this.walls) {
			this.root.remove(entry.mesh)
			entry.mesh.geometry.dispose()
		}
		this.walls.length = 0
	}
}
