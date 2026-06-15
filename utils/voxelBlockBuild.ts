import * as THREE from 'three'
import {
	createInstancedMaterialsFromPreset,
	createMaterialsFromPreset,
	getTexturedBlockPreset,
	isTexturedBlockPreset,
	listTexturedBlockPresets,
	type VoxelTexturedBlockPreset,
	type VoxelTexturedPresetId
} from '@/utils/voxelBlockPresets'

export {
	VOXEL_TEXTURE_BLOCK_PRESETS,
	VOXEL_TEXTURE_SOURCES,
	uniformVoxelFaces,
	getTexturedBlockPreset,
	listTexturedBlockPresets,
	isTexturedBlockPreset,
	type VoxelTexturedBlockPreset,
	type VoxelTexturedPresetId,
	type VoxelBoxFace,
	type VoxelFaceMap,
	type VoxelTextureId
} from '@/utils/voxelBlockPresets'

/** 标准方块边长（场景 1 单位网格内可放 4×4×4 个） */
export const VOXEL_BLOCK_SIZE = 0.25

/** 方块半高，用于地面首层放置 */
export const VOXEL_BLOCK_HALF = VOXEL_BLOCK_SIZE / 2

/** solid=纯色；其余为 VOXEL_TEXTURE_BLOCK_PRESETS 中的 preset id */
export type VoxelBlockVariant = 'solid' | VoxelTexturedPresetId | (string & {})

export interface VoxelBlockSpec {
	variant: VoxelBlockVariant
	/** 仅 solid 使用 */
	color?: string
}

/** UI 用贴图方块列表（由预设派生） */
export interface VoxelTextureBlockDef {
	id: string
	label: string
	previewColor: string
}

export const VOXEL_TEXTURE_BLOCKS: VoxelTextureBlockDef[] = listTexturedBlockPresets().map(
	(p) => ({
		id: p.id,
		label: p.label,
		previewColor: p.previewColor
	})
)

/** 纯色方块快捷色 */
export const VOXEL_COLOR_PRESETS = [
	'#ffffff',
	'#f87171',
	'#fb923c',
	'#facc15',
	'#4ade80',
	'#38bdf8',
	'#818cf8',
	'#c084fc',
	'#78716c',
	'#171717'
] as const

export function getVoxelTextureBlock(id: string): VoxelTextureBlockDef | undefined {
	return VOXEL_TEXTURE_BLOCKS.find((t) => t.id === id)
}

export function isVoxelSolidVariant(variant: string): variant is 'solid' {
	return variant === 'solid'
}

export function specLabel(spec: VoxelBlockSpec | null): string {
	if (!spec) return '未选择方块'
	if (isVoxelSolidVariant(spec.variant)) {
		return `纯色 ${spec.color ?? '#ffffff'}`
	}
	return getTexturedBlockPreset(spec.variant)?.label ?? spec.variant
}

export function worldToBlockCenter(p: THREE.Vector3): THREE.Vector3 {
	const s = VOXEL_BLOCK_SIZE
	return new THREE.Vector3(
		(Math.floor(p.x / s) + 0.5) * s,
		(Math.floor(p.y / s) + 0.5) * s,
		(Math.floor(p.z / s) + 0.5) * s
	)
}

export function blockCenterToGridKey(center: THREE.Vector3): string {
	const s = VOXEL_BLOCK_SIZE
	const gx = Math.round(center.x / s - 0.5)
	const gy = Math.round(center.y / s - 0.5)
	const gz = Math.round(center.z / s - 0.5)
	return `${gx},${gy},${gz}`
}

export function gridKeyToBlockCenter(gridKey: string): THREE.Vector3 {
	const [gx, gy, gz] = gridKey.split(',').map(Number)
	const s = VOXEL_BLOCK_SIZE
	return new THREE.Vector3((gx + 0.5) * s, (gy + 0.5) * s, (gz + 0.5) * s)
}

function cloneMaterialForPreview(source: THREE.Material): THREE.Material {
	const mat = source.clone() as THREE.MeshStandardMaterial
	mat.transparent = true
	mat.opacity = 0.45
	mat.depthWrite = false
	return mat
}

/** 贴图 preset 六面材质 */
export function createVoxelTexturedFaceMaterials(presetId: string): THREE.Material[] {
	const preset = getTexturedBlockPreset(presetId)
	if (!preset) {
		throw new Error(`未知贴图方块预设: ${presetId}`)
	}
	return createMaterialsFromPreset(preset).map(cloneMaterialForPreview)
}

/** 实例层材质（preset id → 六面材质） */
export function createVoxelInstancedLayerMaterial(
	presetId: string
): THREE.Material | THREE.Material[] {
	const preset = getTexturedBlockPreset(presetId)
	if (!preset) {
		throw new Error(`未知贴图方块预设: ${presetId}`)
	}
	return createInstancedMaterialsFromPreset(preset)
}

/** 半透明预览 */
export function createVoxelPreviewMesh(spec: VoxelBlockSpec): THREE.Mesh {
	const geometry = new THREE.BoxGeometry(VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE, VOXEL_BLOCK_SIZE)
	let material: THREE.Material | THREE.Material[]
	if (isVoxelSolidVariant(spec.variant)) {
		material = new THREE.MeshStandardMaterial({
			color: spec.color ?? '#ffffff',
			transparent: true,
			opacity: 0.45,
			depthWrite: false
		})
	} else {
		material = createVoxelTexturedFaceMaterials(spec.variant)
	}
	const mesh = new THREE.Mesh(geometry, material)
	mesh.visible = false
	mesh.userData.ignorePick = true
	mesh.userData.sceneEditorOverlay = true
	mesh.userData.voxelPreviewVariant = spec.variant
	mesh.renderOrder = 999
	return mesh
}

export function updateVoxelPreviewMesh(preview: THREE.Mesh, spec: VoxelBlockSpec | null) {
	if (!spec) {
		preview.visible = false
		return
	}
	if (!isVoxelSolidVariant(spec.variant) && preview.userData.voxelPreviewVariant !== spec.variant) {
		return
	}
	if (isVoxelSolidVariant(spec.variant)) {
		const mat = preview.material as THREE.MeshStandardMaterial
		mat.color.set(spec.color ?? '#ffffff')
	}
}

/** 从场景 JSON 条目解析方块规格 */
export function specFromSceneObject(obj: {
	type?: string
	color?: string
	options?: { variant?: string; color?: string }
}): VoxelBlockSpec | null {
	if (obj.type !== 'voxelBlock' || !obj.options?.variant) return null
	const variant = obj.options.variant
	if (isVoxelSolidVariant(variant)) {
		return {
			variant: 'solid',
			color: obj.options.color ?? obj.color ?? '#ffffff'
		}
	}
	if (!isTexturedBlockPreset(variant) && !getTexturedBlockPreset(variant)) {
		return null
	}
	return { variant }
}
