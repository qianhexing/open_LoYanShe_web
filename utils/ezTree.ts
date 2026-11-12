/**
 * 程序化植物已下线（原 @dgreenheck/ez-tree）。
 * 保留轻量类型/预设表，避免场景侧引用报错；不再拉取会污染 SSR 的贴图库。
 */
import type * as THREE from 'three'

export type EzTreePresetKind =
	| 'ash'
	| 'aspen'
	| 'bush'
	| 'oak'
	| 'pine'
	| 'maple'
	| 'cherry'
	| 'willow'
	| 'birch'
	| 'cypress'
	| 'spruce'
	| 'ginkgo'
	| 'olive'
	| 'dogwood'
	| 'lavender'
	| 'autumn'
	| 'trellis'
	| 'acacia'
	| 'dead'

export type EzTreePresetDef = {
	id: string
	label: string
	kind: EzTreePresetKind
	base?: string
	targetHeight?: number
}

/** 仅作兼容列表；创建接口已禁用 */
export const EZ_TREE_PRESETS: readonly EzTreePresetDef[] = [
	{ id: 'Cherry Blossom', label: '樱花 · 粉', kind: 'cherry', targetHeight: 4 },
	{ id: 'Ash Small', label: '白蜡 · 小', kind: 'ash', targetHeight: 2.6 },
	{ id: 'Ash Medium', label: '白蜡 · 中', kind: 'ash', targetHeight: 4.2 },
	{ id: 'Ash Large', label: '白蜡 · 大', kind: 'ash', targetHeight: 6.5 },
	{ id: 'Aspen Small', label: '白杨 · 小', kind: 'aspen', targetHeight: 2.8 },
	{ id: 'Aspen Medium', label: '白杨 · 中', kind: 'aspen', targetHeight: 4.5 },
	{ id: 'Aspen Large', label: '白杨 · 大', kind: 'aspen', targetHeight: 6.8 },
	{ id: 'Bush 1', label: '灌木 · 1', kind: 'bush', targetHeight: 1.2 },
	{ id: 'Bush 2', label: '灌木 · 2', kind: 'bush', targetHeight: 1.4 },
	{ id: 'Bush 3', label: '灌木 · 3', kind: 'bush', targetHeight: 1.6 },
	{ id: 'Oak Small', label: '橡树 · 小', kind: 'oak', targetHeight: 3 },
	{ id: 'Oak Medium', label: '橡树 · 中', kind: 'oak', targetHeight: 5 },
	{ id: 'Oak Large', label: '橡树 · 大', kind: 'oak', targetHeight: 7.5 },
	{ id: 'Pine Small', label: '松树 · 小', kind: 'pine', targetHeight: 3.2 },
	{ id: 'Pine Medium', label: '松树 · 中', kind: 'pine', targetHeight: 5.2 },
	{ id: 'Pine Large', label: '松树 · 大', kind: 'pine', targetHeight: 8 }
]

export type EzTreePresetId = (typeof EZ_TREE_PRESETS)[number]['id']

export interface CreateEzTreeOptions {
	preset?: string
	seed?: number
	targetHeight?: number | false
}

const DISABLED_MSG = '程序化植物已下线'

export function isEzTreeObject(obj: THREE.Object3D | null | undefined): boolean {
	return Boolean(obj && obj.userData?.type === 'eztree')
}

export async function warmEzTree(_renderer?: unknown): Promise<void> {
	/* no-op：库已移除，避免 SSR/客户端再拉贴图 */
}

export function isEzTreeWarmed(): boolean {
	return false
}

export async function createEzTree(
	_opts: CreateEzTreeOptions = {},
): Promise<THREE.Group> {
	throw new Error(DISABLED_MSG)
}

export async function createEzTreeFromJSON(_data: {
	preset?: string
	seed?: number
	options?: unknown
}): Promise<THREE.Group | null> {
	console.warn('[ezTree]', DISABLED_MSG, '— 跳过场景植物还原')
	return null
}

export function getEzTreeSavePayload(obj: THREE.Object3D): {
	preset: string
	seed: number
} {
	const preset =
		(typeof obj.userData.preset === 'string' && obj.userData.preset) ||
		'Oak Small'
	const seedRaw = obj.userData.seed
	const seed =
		typeof seedRaw === 'number' && Number.isFinite(seedRaw) ? seedRaw : 0
	return { preset, seed }
}
