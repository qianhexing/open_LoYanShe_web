import * as THREE from 'three'

/**
 * BoxGeometry 材质组顺序（与 Three.js 一致）
 * +x, -x, +y, -y, +z, -z
 */
export const VOXEL_BOX_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const
export type VoxelBoxFace = (typeof VOXEL_BOX_FACES)[number]

/** 引用 VOXEL_TEXTURE_SOURCES 中的贴图 id */
export type VoxelTextureId = string

export interface VoxelFaceMap {
	px: VoxelTextureId
	nx: VoxelTextureId
	py: VoxelTextureId
	ny: VoxelTextureId
	pz: VoxelTextureId
	nz: VoxelTextureId
}

/** 贴图方块预设：六面均可独立指定贴图 id */
export interface VoxelTexturedBlockPreset {
	id: string
	label: string
	/** UI 缩略图底色 */
	previewColor: string
	faces: VoxelFaceMap
}

export interface VoxelTextureSource {
	/** 纹理缓存键 */
	key: string
	draw: (ctx: CanvasRenderingContext2D, size: number) => void
}

function noiseRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	base: string,
	jitter = 18
) {
	ctx.fillStyle = base
	ctx.fillRect(x, y, w, h)
	for (let i = 0; i < w * h * 0.35; i++) {
		const px = x + Math.floor(Math.random() * w)
		const py = y + Math.floor(Math.random() * h)
		const delta = Math.floor(Math.random() * jitter) - jitter / 2
		ctx.fillStyle = `rgb(${Math.max(0, delta)}, ${Math.max(0, delta)}, ${Math.max(0, delta)})`
		ctx.globalAlpha = 0.25
		ctx.fillRect(px, py, 1, 1)
	}
	ctx.globalAlpha = 1
}

/** 可复用贴图库：新增方块预设时引用这里的 id 即可 */
export const VOXEL_TEXTURE_SOURCES: Record<string, VoxelTextureSource> = {
	dirt: {
		key: 'tex/dirt',
		draw: (ctx, s) => {
			noiseRect(ctx, 0, 0, s, s, '#6b4f2f', 22)
		}
	},
	stone: {
		key: 'tex/stone',
		draw: (ctx, s) => {
			noiseRect(ctx, 0, 0, s, s, '#9a9a9a', 28)
		}
	},
	grass_top: {
		key: 'tex/grass-top',
		draw: (ctx, s) => {
			noiseRect(ctx, 0, 0, s, s, '#5b8c3e', 20)
		}
	},
	grass_side: {
		key: 'tex/grass-side',
		draw: (ctx, s) => {
			const split = Math.floor(s * 0.35)
			noiseRect(ctx, 0, 0, s, split, '#5b8c3e', 18)
			noiseRect(ctx, 0, split, s, s - split, '#6b4f2f', 22)
		}
	}
}

/** 六面使用同一贴图 */
export function uniformVoxelFaces(textureId: VoxelTextureId): VoxelFaceMap {
	return {
		px: textureId,
		nx: textureId,
		py: textureId,
		ny: textureId,
		pz: textureId,
		nz: textureId
	}
}

/**
 * 贴图方块预设列表
 * 新增方块：1) 在 VOXEL_TEXTURE_SOURCES 加贴图 2) 在此追加 preset
 */
export const VOXEL_TEXTURE_BLOCK_PRESETS = [
	{
		id: 'grass',
		label: '草方块',
		previewColor: '#5b8c3e',
		faces: {
			px: 'grass_side',
			nx: 'grass_side',
			py: 'grass_top',
			ny: 'dirt',
			pz: 'grass_side',
			nz: 'grass_side'
		}
	},
	{
		id: 'dirt',
		label: '泥土',
		previewColor: '#6b4f2f',
		faces: uniformVoxelFaces('dirt')
	},
	{
		id: 'stone',
		label: '石头',
		previewColor: '#8a8a8a',
		faces: uniformVoxelFaces('stone')
	}
] as const satisfies readonly VoxelTexturedBlockPreset[]

export type VoxelTexturedPresetId = (typeof VOXEL_TEXTURE_BLOCK_PRESETS)[number]['id']

const presetMap = new Map<string, VoxelTexturedBlockPreset>(
	VOXEL_TEXTURE_BLOCK_PRESETS.map((p) => [p.id, p])
)

export function getTexturedBlockPreset(id: string): VoxelTexturedBlockPreset | undefined {
	return presetMap.get(id)
}

export function listTexturedBlockPresets(): VoxelTexturedBlockPreset[] {
	return [...VOXEL_TEXTURE_BLOCK_PRESETS]
}

export function isTexturedBlockPreset(id: string): id is VoxelTexturedPresetId {
	return presetMap.has(id)
}

const textureCache = new Map<string, THREE.Texture>()

export function resolveVoxelTexture(textureId: VoxelTextureId): THREE.Texture {
	const cached = textureCache.get(textureId)
	if (cached) return cached

	const source = VOXEL_TEXTURE_SOURCES[textureId]
	if (!source) {
		console.warn(`[voxel] 未知贴图 id: ${textureId}，使用占位`)
		return resolveVoxelTexture('dirt')
	}

	const cacheKey = source.key
	const fromKey = textureCache.get(cacheKey)
	if (fromKey) {
		textureCache.set(textureId, fromKey)
		return fromKey
	}

	const size = 16
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas 2D unavailable')
	source.draw(ctx, size)

	const tex = new THREE.CanvasTexture(canvas)
	tex.magFilter = THREE.NearestFilter
	tex.minFilter = THREE.NearestFilter
	tex.colorSpace = THREE.SRGBColorSpace
	textureCache.set(textureId, tex)
	textureCache.set(cacheKey, tex)
	return tex
}

export function createTexturedMaterial(textureId: VoxelTextureId): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		map: resolveVoxelTexture(textureId),
		roughness: 0.92,
		metalness: 0.02
	})
}

/** 按预设生成六面材质（BoxGeometry 组序） */
export function createMaterialsFromPreset(
	preset: VoxelTexturedBlockPreset
): THREE.MeshStandardMaterial[] {
	return VOXEL_BOX_FACES.map((face) => createTexturedMaterial(preset.faces[face]))
}

/** 六面材质相同时返回单材质，否则返回数组（InstancedMesh 优化） */
export function createInstancedMaterialsFromPreset(
	preset: VoxelTexturedBlockPreset
): THREE.Material | THREE.Material[] {
	const faceIds = VOXEL_BOX_FACES.map((face) => preset.faces[face])
	if (faceIds.every((id) => id === faceIds[0])) {
		return createTexturedMaterial(faceIds[0])
	}
	return VOXEL_BOX_FACES.map((face) => createTexturedMaterial(preset.faces[face]))
}
