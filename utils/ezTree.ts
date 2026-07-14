import * as THREE from 'three'

/** ez-tree 内置预设（与 @dgreenheck/ez-tree TreePreset 一致） */
export const EZ_TREE_PRESETS = [
	{ id: 'Ash Small', label: '白蜡 · 小', kind: 'ash' },
	{ id: 'Ash Medium', label: '白蜡 · 中', kind: 'ash' },
	{ id: 'Ash Large', label: '白蜡 · 大', kind: 'ash' },
	{ id: 'Aspen Small', label: '白杨 · 小', kind: 'aspen' },
	{ id: 'Aspen Medium', label: '白杨 · 中', kind: 'aspen' },
	{ id: 'Aspen Large', label: '白杨 · 大', kind: 'aspen' },
	{ id: 'Bush 1', label: '灌木 · 1', kind: 'bush' },
	{ id: 'Bush 2', label: '灌木 · 2', kind: 'bush' },
	{ id: 'Bush 3', label: '灌木 · 3', kind: 'bush' },
	{ id: 'Oak Small', label: '橡树 · 小', kind: 'oak' },
	{ id: 'Oak Medium', label: '橡树 · 中', kind: 'oak' },
	{ id: 'Oak Large', label: '橡树 · 大', kind: 'oak' },
	{ id: 'Pine Small', label: '松树 · 小', kind: 'pine' },
	{ id: 'Pine Medium', label: '松树 · 中', kind: 'pine' },
	{ id: 'Pine Large', label: '松树 · 大', kind: 'pine' }
] as const

export type EzTreePresetId = (typeof EZ_TREE_PRESETS)[number]['id']

export interface CreateEzTreeOptions {
	/** 预设名，默认 Oak Small */
	preset?: string
	/** 随机种子；不传则随机 */
	seed?: number
	/**
	 * 目标世界高度（米级场景单位），默认 3.5。
	 * 传 `false` 时不自动缩放（场景 JSON 加载用，由调用方写入 scale）。
	 */
	targetHeight?: number | false
}

/** 判断是否为 ez-tree 植物对象 */
export function isEzTreeObject(obj: THREE.Object3D | null | undefined): boolean {
	return Boolean(obj && obj.userData?.type === 'eztree')
}

function fitTreeToHeight(tree: THREE.Object3D, targetHeight: number) {
	tree.updateMatrixWorld(true)
	const box = new THREE.Box3().setFromObject(tree)
	const size = new THREE.Vector3()
	box.getSize(size)
	if (size.y > 1e-4) {
		tree.scale.setScalar(targetHeight / size.y)
	}
}

/**
 * 程序化生成一棵植物（仅客户端；内部动态 import 避免 SSR 读 document）
 */
export async function createEzTree(opts: CreateEzTreeOptions = {}) {
	const { Tree } = await import('@dgreenheck/ez-tree')
	const preset = opts.preset || 'Oak Small'
	const seed =
		opts.seed != null && Number.isFinite(opts.seed)
			? Math.floor(opts.seed)
			: Math.floor(Math.random() * 100000)

	const tree = new Tree()
	tree.loadPreset(preset)
	tree.options.seed = seed
	tree.generate()

	tree.userData.type = 'eztree'
	tree.userData.preset = preset
	tree.userData.seed = seed

	if (opts.targetHeight !== false) {
		fitTreeToHeight(tree, opts.targetHeight ?? 3.5)
	}

	tree.traverse((child) => {
		const mesh = child as THREE.Mesh
		if (mesh.isMesh) {
			mesh.castShadow = true
			mesh.receiveShadow = true
		}
	})

	return tree
}

/** 从场景 JSON 字段还原植物（不自动缩放，由 load 流程写入 scale） */
export async function createEzTreeFromJSON(data: {
	preset?: string
	seed?: number
	options?: { seed?: number; preset?: string }
}) {
	const preset = data.preset || data.options?.preset || 'Oak Small'
	const seed = data.seed ?? data.options?.seed
	return createEzTree({
		preset,
		seed,
		targetHeight: false
	})
}

/** 保存用：仅存预设 + 种子（纹理由库内置，不序列化） */
export function getEzTreeSavePayload(obj: THREE.Object3D): {
	preset: string
	seed: number
} {
	const preset =
		(typeof obj.userData.preset === 'string' && obj.userData.preset) ||
		'Oak Small'
	const seedRaw = obj.userData.seed
	const seed =
		typeof seedRaw === 'number' && Number.isFinite(seedRaw)
			? seedRaw
			: 0
	return { preset, seed }
}
