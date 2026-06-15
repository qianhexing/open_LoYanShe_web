import * as THREE from 'three'
import {
	createVoxelTexturedFaceMaterials,
	gridKeyToBlockCenter,
	isVoxelSolidVariant,
	type VoxelBlockSpec,
	VOXEL_BLOCK_SIZE
} from '@/utils/voxelBlockBuild'

const _dummy = new THREE.Object3D()

function createPreviewMaterial(spec: VoxelBlockSpec): THREE.Material | THREE.Material[] {
	if (isVoxelSolidVariant(spec.variant)) {
		return new THREE.MeshStandardMaterial({
			color: spec.color ?? '#ffffff',
			transparent: true,
			opacity: 0.38,
			depthWrite: false
		})
	}
	return createVoxelTexturedFaceMaterials(spec.variant)
}

/** 直线拖拽时的多格半透明虚影 */
export class VoxelLinePreviewGroup {
	readonly root: THREE.Group
	private mesh: THREE.InstancedMesh | null = null
	private currentVariant: string | null = null

	constructor(scene: THREE.Scene) {
		this.root = new THREE.Group()
		this.root.name = 'VoxelLinePreview'
		this.root.userData.ignorePick = true
		this.root.userData.sceneEditorOverlay = true
		this.root.renderOrder = 998
		scene.add(this.root)
	}

	update(spec: VoxelBlockSpec | null, gridKeys: string[]) {
		if (!spec || gridKeys.length === 0) {
			this.clear()
			return
		}

		const variantKey = isVoxelSolidVariant(spec.variant)
			? `solid:${spec.color ?? '#ffffff'}`
			: spec.variant

		if (this.mesh && this.currentVariant !== variantKey) {
			this.disposeMesh()
		}

		if (!this.mesh) {
			const geometry = new THREE.BoxGeometry(
				VOXEL_BLOCK_SIZE,
				VOXEL_BLOCK_SIZE,
				VOXEL_BLOCK_SIZE
			)
			this.mesh = new THREE.InstancedMesh(
				geometry,
				createPreviewMaterial(spec),
				Math.max(gridKeys.length, 1)
			)
			this.mesh.frustumCulled = false
			this.mesh.userData.ignorePick = true
			this.currentVariant = variantKey
			this.root.add(this.mesh)
		}

		if (this.mesh.count !== gridKeys.length) {
			this.resizeMesh(spec, gridKeys.length)
		}

		for (let i = 0; i < gridKeys.length; i++) {
			const center = gridKeyToBlockCenter(gridKeys[i])
			_dummy.position.copy(center)
			_dummy.rotation.set(0, 0, 0)
			_dummy.scale.set(1, 1, 1)
			_dummy.updateMatrix()
			this.mesh.setMatrixAt(i, _dummy.matrix)
		}
		this.mesh.count = gridKeys.length
		this.mesh.instanceMatrix.needsUpdate = true
		this.root.visible = true
	}

	private resizeMesh(spec: VoxelBlockSpec, count: number) {
		this.disposeMesh()
		const geometry = new THREE.BoxGeometry(
			VOXEL_BLOCK_SIZE,
			VOXEL_BLOCK_SIZE,
			VOXEL_BLOCK_SIZE
		)
		this.mesh = new THREE.InstancedMesh(geometry, createPreviewMaterial(spec), count)
		this.mesh.frustumCulled = false
		this.mesh.userData.ignorePick = true
		this.root.add(this.mesh)
	}

	clear() {
		if (this.mesh) {
			this.mesh.count = 0
			this.mesh.instanceMatrix.needsUpdate = true
		}
		this.root.visible = false
	}

	private disposeMesh() {
		if (!this.mesh) return
		this.root.remove(this.mesh)
		this.mesh.geometry.dispose()
		const mat = this.mesh.material
		if (Array.isArray(mat)) {
			for (const m of mat) m.dispose()
		} else {
			mat.dispose()
		}
		this.mesh = null
	}

	dispose() {
		this.disposeMesh()
		if (this.root.parent) this.root.parent.remove(this.root)
	}
}
