import * as THREE from 'three'

type EzTreeOptionsLike = {
	seed: number
	bark: {
		type: string
		tint: number
		textured: boolean
		flatShading: boolean
		textureScale?: { x: number; y: number }
	}
	branch: {
		levels: number
		sections: Record<number, number>
		segments: Record<number, number>
		children: Record<number, number>
		force?: {
			direction: { x: number; y: number; z: number }
			strength: number
		}
		length?: Record<number, number>
		gnarliness?: Record<number, number>
		angle?: Record<number, number>
	}
	leaves: {
		count: number
		tint: number
		alphaTest: number
		type: string
		size?: number
		sizeVariance?: number
		billboard?: string
		angle?: number
		start?: number
	}
	trellis: { enabled: boolean }
}

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
	/** 列表与存档用的唯一 id（自定义树种也用此 id） */
	id: string
	label: string
	kind: EzTreePresetKind
	/** 实际 loadPreset 的内置名；缺省等于 id */
	base?: string
	/** 默认世界高度；缺省 3.5 */
	targetHeight?: number
	/** 在内置预设上叠加外观/结构 */
	style?: (options: EzTreeOptionsLike) => void
}

/** 内置 + 自定义树种（自定义基于内置预设调色/改形） */
export const EZ_TREE_PRESETS: readonly EzTreePresetDef[] = [
	// —— 白蜡 ——
	{ id: 'Ash Small', label: '白蜡 · 小', kind: 'ash', targetHeight: 2.6 },
	{ id: 'Ash Medium', label: '白蜡 · 中', kind: 'ash', targetHeight: 4.2 },
	{ id: 'Ash Large', label: '白蜡 · 大', kind: 'ash', targetHeight: 6.5 },
	// —— 白杨 / 桦 ——
	{ id: 'Aspen Small', label: '白杨 · 小', kind: 'aspen', targetHeight: 2.8 },
	{ id: 'Aspen Medium', label: '白杨 · 中', kind: 'aspen', targetHeight: 4.5 },
	{ id: 'Aspen Large', label: '白杨 · 大', kind: 'aspen', targetHeight: 7 },
	{
		id: 'Birch Grove',
		label: '白桦',
		kind: 'birch',
		base: 'Aspen Medium',
		targetHeight: 5.2,
		style: (o) => {
			o.bark.type = 'birch'
			o.bark.tint = 0xffffff
			o.leaves.type = 'aspen'
			o.leaves.tint = 0xb8e986
			o.leaves.count = Math.max(o.leaves.count, 22)
			o.leaves.size = 2.2
		}
	},
	{
		id: 'Golden Ginkgo',
		label: '银杏 · 金黄',
		kind: 'ginkgo',
		base: 'Aspen Medium',
		targetHeight: 4.8,
		style: (o) => {
			o.bark.type = 'birch'
			o.bark.tint = 0xe8dcc8
			o.leaves.type = 'aspen'
			o.leaves.tint = 0xf4c430
			o.leaves.count = Math.max(o.leaves.count, 26)
			o.leaves.size = 2.8
			o.leaves.sizeVariance = 0.55
		}
	},
	// —— 灌木 ——
	{ id: 'Bush 1', label: '灌木 · 绿', kind: 'bush', targetHeight: 1.4 },
	{ id: 'Bush 2', label: '灌木 · 密', kind: 'bush', targetHeight: 1.6 },
	{ id: 'Bush 3', label: '灌木 · 疏', kind: 'bush', targetHeight: 1.3 },
	{
		id: 'Olive Bush',
		label: '橄榄丛',
		kind: 'olive',
		base: 'Bush 2',
		targetHeight: 1.8,
		style: (o) => {
			o.bark.tint = 0x6b5a3e
			o.leaves.type = 'oak'
			o.leaves.tint = 0x6b8e23
			o.leaves.count = Math.max(o.leaves.count, 28)
			o.leaves.size = 1.6
		}
	},
	{
		id: 'Lavender Bush',
		label: '薰衣草丛',
		kind: 'lavender',
		base: 'Bush 1',
		targetHeight: 1.2,
		style: (o) => {
			o.bark.tint = 0x5c4a3a
			o.leaves.type = 'ash'
			o.leaves.tint = 0x9b7ebd
			o.leaves.count = Math.max(o.leaves.count, 32)
			o.leaves.size = 1.35
			o.leaves.alphaTest = 0.35
		}
	},
	// —— 橡树 ——
	{ id: 'Oak Small', label: '橡树 · 小', kind: 'oak', targetHeight: 2.8 },
	{ id: 'Oak Medium', label: '橡树 · 中', kind: 'oak', targetHeight: 4.5 },
	{ id: 'Oak Large', label: '橡树 · 大', kind: 'oak', targetHeight: 7.2 },
	{
		id: 'Maple Autumn',
		label: '枫树 · 秋红',
		kind: 'maple',
		base: 'Oak Medium',
		targetHeight: 4.6,
		style: (o) => {
			o.bark.type = 'oak'
			o.bark.tint = 0xc4a574
			o.leaves.type = 'oak'
			o.leaves.tint = 0xd94f2b
			o.leaves.count = Math.max(o.leaves.count, 28)
			o.leaves.size = 2.7
		}
	},
	{
		id: 'Maple Crimson',
		label: '枫树 · 绯红',
		kind: 'maple',
		base: 'Oak Small',
		targetHeight: 3.4,
		style: (o) => {
			o.bark.type = 'oak'
			o.leaves.type = 'oak'
			o.leaves.tint = 0xb01030
			o.leaves.count = Math.max(o.leaves.count, 24)
		}
	},
	{
		id: 'Cherry Blossom',
		label: '樱花',
		kind: 'cherry',
		base: 'Ash Medium',
		targetHeight: 4,
		style: (o) => {
			o.bark.type = 'oak'
			o.bark.tint = 0xd2b48c
			o.leaves.type = 'ash'
			o.leaves.tint = 0xffc0cb
			o.leaves.count = Math.max(o.leaves.count, 36)
			o.leaves.size = 2.1
			o.leaves.alphaTest = 0.28
			o.leaves.billboard = 'double'
		}
	},
	{
		id: 'Dogwood Bloom',
		label: '山茱萸',
		kind: 'dogwood',
		base: 'Ash Small',
		targetHeight: 2.9,
		style: (o) => {
			o.bark.type = 'oak'
			o.bark.tint = 0xb8956a
			o.leaves.type = 'ash'
			o.leaves.tint = 0xfff5f7
			o.leaves.count = Math.max(o.leaves.count, 30)
			o.leaves.size = 2.4
			o.leaves.alphaTest = 0.25
		}
	},
	{
		id: 'Weeping Willow',
		label: '垂柳',
		kind: 'willow',
		base: 'Oak Medium',
		targetHeight: 5.5,
		style: (o) => {
			o.bark.type = 'willow'
			o.bark.tint = 0x8f7a5a
			o.leaves.type = 'ash'
			o.leaves.tint = 0x7cb342
			o.leaves.count = Math.max(o.leaves.count, 34)
			o.leaves.size = 2.0
			o.branch.levels = Math.max(o.branch.levels, 3)
			if (o.branch.force) {
				o.branch.force.direction = { x: 0.05, y: -1, z: 0.02 }
				o.branch.force.strength = 0.035
			}
			if (o.branch.length) {
				o.branch.length[1] = Math.max(o.branch.length[1] ?? 10, 14)
				o.branch.length[2] = Math.max(o.branch.length[2] ?? 10, 16)
			}
			if (o.branch.angle) {
				o.branch.angle[1] = 70
				o.branch.angle[2] = 85
			}
		}
	},
	{
		id: 'Autumn Ash',
		label: '白蜡 · 秋色',
		kind: 'autumn',
		base: 'Ash Medium',
		targetHeight: 4.3,
		style: (o) => {
			o.leaves.type = 'ash'
			o.leaves.tint = 0xe67e22
			o.leaves.count = Math.max(o.leaves.count, 26)
		}
	},
	{
		id: 'Acacia Sparse',
		label: '金合欢',
		kind: 'acacia',
		base: 'Oak Small',
		targetHeight: 3.6,
		style: (o) => {
			o.bark.type = 'oak'
			o.bark.tint = 0xa67c52
			o.leaves.type = 'oak'
			o.leaves.tint = 0xc9d45a
			o.leaves.count = 14
			o.leaves.size = 1.8
			o.branch.levels = 2
			if (o.branch.children) {
				o.branch.children[0] = Math.min(o.branch.children[0] ?? 5, 4)
				o.branch.children[1] = Math.min(o.branch.children[1] ?? 3, 3)
			}
			if (o.branch.force) {
				o.branch.force.direction = { x: 0, y: 1, z: 0 }
				o.branch.force.strength = 0.02
			}
		}
	},
	{
		id: 'Dead Oak',
		label: '枯树',
		kind: 'dead',
		base: 'Oak Medium',
		targetHeight: 4.2,
		style: (o) => {
			o.bark.type = 'oak'
			o.bark.tint = 0x5c4033
			o.leaves.count = 0
			if (o.branch.gnarliness) {
				o.branch.gnarliness[0] = 0.12
				o.branch.gnarliness[1] = 0.22
				o.branch.gnarliness[2] = 0.28
			}
		}
	},
	// —— 松 / 柏 / 云杉 ——
	{ id: 'Pine Small', label: '松树 · 小', kind: 'pine', targetHeight: 3.2 },
	{ id: 'Pine Medium', label: '松树 · 中', kind: 'pine', targetHeight: 5.5 },
	{ id: 'Pine Large', label: '松树 · 大', kind: 'pine', targetHeight: 8.5 },
	{
		id: 'Cypress Tall',
		label: '柏树',
		kind: 'cypress',
		base: 'Pine Medium',
		targetHeight: 7.5,
		style: (o) => {
			o.bark.type = 'pine'
			o.bark.tint = 0xd9c2a0
			o.leaves.type = 'pine'
			o.leaves.tint = 0x2f5d3a
			o.leaves.count = Math.max(o.leaves.count, 36)
			o.leaves.size = 1.15
			if (o.branch.length) {
				o.branch.length[0] = Math.max(o.branch.length[0] ?? 40, 55)
				o.branch.length[1] = Math.min(o.branch.length[1] ?? 20, 16)
			}
			if (o.branch.angle) {
				o.branch.angle[1] = 95
			}
		}
	},
	{
		id: 'Blue Spruce',
		label: '蓝杉',
		kind: 'spruce',
		base: 'Pine Medium',
		targetHeight: 5.8,
		style: (o) => {
			o.bark.type = 'pine'
			o.leaves.type = 'pine'
			o.leaves.tint = 0x7a9eaf
			o.leaves.count = Math.max(o.leaves.count, 38)
			o.leaves.size = 1.35
			o.leaves.alphaTest = 0.28
		}
	},
	{
		id: 'Dark Fir',
		label: '冷杉 · 墨绿',
		kind: 'spruce',
		base: 'Pine Large',
		targetHeight: 8,
		style: (o) => {
			o.bark.type = 'pine'
			o.bark.tint = 0xcbb89a
			o.leaves.type = 'pine'
			o.leaves.tint = 0x1b4332
			o.leaves.count = Math.max(o.leaves.count, 40)
		}
	},
	// —— 棚架藤 ——
	{
		id: 'Trellis',
		label: '棚架藤',
		kind: 'trellis',
		targetHeight: 3.2,
		style: (o) => {
			o.trellis.enabled = true
			o.leaves.tint = 0x6aa84f
			o.leaves.count = Math.max(o.leaves.count, 18)
		}
	}
]

export type EzTreePresetId = (typeof EZ_TREE_PRESETS)[number]['id']

export interface CreateEzTreeOptions {
	/** 预设 id（内置名或自定义 id） */
	preset?: string
	/** 随机种子；不传则随机 */
	seed?: number
	/**
	 * 目标世界高度（米级场景单位）。
	 * 传 `false` 时不自动缩放（场景 JSON 加载用，由调用方写入 scale）。
	 */
	targetHeight?: number | false
}

/** 判断是否为 ez-tree 植物对象 */
export function isEzTreeObject(obj: THREE.Object3D | null | undefined): boolean {
	return Boolean(obj && obj.userData?.type === 'eztree')
}

function findPresetDef(presetId: string): EzTreePresetDef | undefined {
	return EZ_TREE_PRESETS.find((p) => p.id === presetId)
}

function resolveLoadPresetName(presetId: string): string {
	const def = findPresetDef(presetId)
	return def?.base || def?.id || presetId
}

function fitTreeToHeight(tree: THREE.Object3D, targetHeight: number) {
	tree.updateMatrixWorld(true)
	const box = new THREE.Box3().setFromObject(tree)
	const size = new THREE.Vector3()
	box.getSize(size)
	if (size.y > 1e-4 && Number.isFinite(size.y)) {
		tree.scale.setScalar(targetHeight / size.y)
	}
}

type RawTreeBuffers = {
	verts: number[]
	normals?: number[]
	uvs?: number[]
	indices: number[]
}

type EzTreeInstance = THREE.Group & {
	options: EzTreeOptionsLike
	branches: RawTreeBuffers
	leaves: RawTreeBuffers
	branchesMesh: THREE.Mesh
	leavesMesh: THREE.Mesh
	generate: () => void
	loadPreset: (name: string) => void
	vertexCount: number
}

let ezTreeModulePromise: Promise<typeof import('@dgreenheck/ez-tree')> | null =
	null
let ezTreeWarmed = false
let ezTreeWarmPromise: Promise<void> | null = null

function loadEzTreeModule() {
	if (!ezTreeModulePromise) {
		ezTreeModulePromise = import('@dgreenheck/ez-tree')
	}
	return ezTreeModulePromise
}

function yieldToMain() {
	return new Promise<void>((resolve) => {
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => resolve())
		} else {
			setTimeout(resolve, 0)
		}
	})
}

/**
 * 质量增强：保留树皮贴图与分支层级，适当提高叶片密度。
 * （不再为点云兼容做激进降面）
 */
function enhanceTreeOptionsForQuality(options: EzTreeOptionsLike) {
	options.bark.flatShading = false
	options.bark.textured = true
	if (typeof options.leaves.count === 'number' && options.leaves.count > 0) {
		options.leaves.count = Math.min(Math.max(options.leaves.count, 14), 48)
	}
	for (const key of [0, 1, 2, 3] as const) {
		if (options.branch.sections[key] != null) {
			options.branch.sections[key] = Math.min(
				Math.max(options.branch.sections[key], 4),
				14
			)
		}
		if (options.branch.segments[key] != null) {
			options.branch.segments[key] = Math.min(
				Math.max(options.branch.segments[key], 4),
				10
			)
		}
	}
	if (options.leaves.billboard == null) {
		options.leaves.billboard = 'double'
	}
}

/** 顶点过多时轻度收敛，避免 Uint 索引与主线程卡顿 */
function softenTreeOptions(options: EzTreeOptionsLike) {
	if (typeof options.leaves.count === 'number' && options.leaves.count > 8) {
		options.leaves.count = Math.max(8, Math.floor(options.leaves.count * 0.7))
	}
	for (const key of [0, 1, 2] as const) {
		if (options.branch.children[key] != null && options.branch.children[key] > 3) {
			options.branch.children[key] = Math.max(
				2,
				Math.floor(options.branch.children[key] * 0.75)
			)
		}
	}
}

function buildSafeGeometry(
	buffers: RawTreeBuffers,
	withNormals: boolean
): THREE.BufferGeometry | null {
	const { verts, normals, uvs, indices } = buffers
	if (!verts?.length || !indices?.length) return null

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute(
		'position',
		new THREE.BufferAttribute(new Float32Array(verts), 3)
	)
	if (withNormals && normals && normals.length === verts.length) {
		geometry.setAttribute(
			'normal',
			new THREE.BufferAttribute(new Float32Array(normals), 3)
		)
	}
	if (uvs && uvs.length > 0) {
		geometry.setAttribute(
			'uv',
			new THREE.BufferAttribute(new Float32Array(uvs), 2)
		)
	}
	// 库内用 Uint16，超限会坏模；烘焙统一 Uint32
	geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
	if (!withNormals || !normals || normals.length !== verts.length) {
		geometry.computeVertexNormals()
	}
	geometry.computeBoundingSphere()
	geometry.computeBoundingBox()
	return geometry
}

function cloneTexture(tex: THREE.Texture | null | undefined): THREE.Texture | null {
	if (!tex) return null
	const cloned = tex.clone()
	cloned.needsUpdate = true
	if ('colorSpace' in cloned && 'colorSpace' in tex) {
		;(cloned as THREE.Texture & { colorSpace?: string }).colorSpace = (
			tex as THREE.Texture & { colorSpace?: string }
		).colorSpace
	}
	return cloned
}

function disposeObjectGpu(root: THREE.Object3D) {
	root.traverse((obj) => {
		const mesh = obj as THREE.Mesh
		if (!mesh.isMesh) return
		mesh.geometry?.dispose()
		const mat = mesh.material
		if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
		else mat?.dispose()
	})
}

function disposeTreeInstance(tree: EzTreeInstance) {
	try {
		tree.branchesMesh?.geometry?.dispose()
		tree.leavesMesh?.geometry?.dispose()
		const mats = [tree.branchesMesh?.material, tree.leavesMesh?.material]
		for (const mat of mats) {
			if (!mat) continue
			if (Array.isArray(mat)) {
				mat.forEach((m) => {
					;(m as THREE.Material & { map?: THREE.Texture | null }).map = null
					m.dispose()
				})
			} else {
				;(mat as THREE.Material & { map?: THREE.Texture | null }).map = null
				mat.dispose()
			}
		}
	} catch {
		/* ignore */
	}
}

type PhongLike = THREE.MeshPhongMaterial & {
	aoMap?: THREE.Texture | null
	normalMap?: THREE.Texture | null
	roughnessMap?: THREE.Texture | null
}

/**
 * 烘焙为高质量 MeshStandardMaterial Group。
 * 保留树皮/叶片贴图；去掉库内风动 onBeforeCompile（与现行 Three 更稳）。
 */
function bakeEzTreeToSafeGroup(tree: EzTreeInstance): THREE.Group {
	const group = new THREE.Group()

	const branchGeo = buildSafeGeometry(tree.branches, true)
	if (branchGeo) {
		const srcMat = tree.branchesMesh?.material as PhongLike | undefined
		const barkTint =
			typeof tree.options.bark.tint === 'number'
				? tree.options.bark.tint
				: 0x8b5a2b
		const branchMat = new THREE.MeshStandardMaterial({
			map: cloneTexture(srcMat?.map),
			aoMap: cloneTexture(srcMat?.aoMap),
			normalMap: cloneTexture(srcMat?.normalMap),
			roughnessMap: cloneTexture(srcMat?.roughnessMap),
			color: new THREE.Color(barkTint),
			roughness: 0.9,
			metalness: 0.02,
			aoMapIntensity: 1,
			envMapIntensity: 0.35,
			flatShading: false
		})
		if (branchMat.normalMap) {
			branchMat.normalScale = new THREE.Vector2(0.85, 0.85)
		}
		// aoMap 需要 uv2；无则复用 uv
		if (branchMat.aoMap && branchGeo.getAttribute('uv') && !branchGeo.getAttribute('uv2')) {
			branchGeo.setAttribute('uv2', branchGeo.getAttribute('uv'))
		}
		const branchMesh = new THREE.Mesh(branchGeo, branchMat)
		branchMesh.name = 'eztree-branches'
		branchMesh.castShadow = true
		branchMesh.receiveShadow = true
		group.add(branchMesh)
	}

	const leafGeo = buildSafeGeometry(tree.leaves, false)
	if (leafGeo && (tree.options.leaves.count ?? 0) > 0) {
		const srcMat = tree.leavesMesh?.material as
			| THREE.MeshPhongMaterial
			| undefined
		const leafTint =
			typeof tree.options.leaves.tint === 'number'
				? tree.options.leaves.tint
				: 0x5a8f3c
		const leafMat = new THREE.MeshStandardMaterial({
			map: cloneTexture(srcMat?.map),
			color: new THREE.Color(leafTint),
			side: THREE.DoubleSide,
			alphaTest:
				typeof tree.options.leaves.alphaTest === 'number'
					? tree.options.leaves.alphaTest
					: 0.4,
			transparent: false,
			depthWrite: true,
			roughness: 0.78,
			metalness: 0,
			envMapIntensity: 0.45,
			dithering: true
		})
		const leafMesh = new THREE.Mesh(leafGeo, leafMat)
		leafMesh.name = 'eztree-leaves'
		leafMesh.castShadow = true
		leafMesh.receiveShadow = true
		group.add(leafMesh)
	}

	return group
}

/**
 * 预热：动态 import + 生成极简树 bake + compile 上传贴图。
 */
export async function warmEzTree(renderer: THREE.WebGLRenderer): Promise<void> {
	if (ezTreeWarmed) return
	if (ezTreeWarmPromise) return ezTreeWarmPromise

	ezTreeWarmPromise = (async () => {
		await yieldToMain()
		const { Tree } = await loadEzTreeModule()
		await yieldToMain()

		const tree = new Tree() as unknown as EzTreeInstance
		tree.loadPreset('Bush 1')
		tree.options.seed = 1
		tree.options.bark.textured = true
		tree.options.branch.levels = 1
		tree.options.leaves.count = 6
		tree.generate()

		const group = bakeEzTreeToSafeGroup(tree)
		disposeTreeInstance(tree)

		const warmScene = new THREE.Scene()
		const warmCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
		warmCam.position.set(0, 2, 6)
		warmCam.lookAt(0, 1, 0)
		warmScene.add(group)
		warmScene.add(new THREE.AmbientLight(0xffffff, 1))
		warmScene.add(new THREE.DirectionalLight(0xffffff, 1.2))

		const prevSize = new THREE.Vector2()
		renderer.getSize(prevSize)
		const prevRatio = renderer.getPixelRatio()
		try {
			renderer.setSize(4, 4, false)
			renderer.compile(warmScene, warmCam)
			renderer.render(warmScene, warmCam)
		} finally {
			renderer.setSize(prevSize.x, prevSize.y, false)
			renderer.setPixelRatio(prevRatio)
			warmScene.remove(group)
			disposeObjectGpu(group)
		}

		ezTreeWarmed = true
	})().catch((err) => {
		ezTreeWarmPromise = null
		console.warn('[ezTree] warm failed:', err)
		throw err
	})

	return ezTreeWarmPromise
}

export function isEzTreeWarmed(): boolean {
	return ezTreeWarmed
}

/**
 * 程序化生成一棵植物（高质量几何 + 贴图烘焙）。
 */
export async function createEzTree(opts: CreateEzTreeOptions = {}) {
	await yieldToMain()
	const { Tree } = await loadEzTreeModule()
	await yieldToMain()

	const presetId = opts.preset || 'Oak Small'
	const def = findPresetDef(presetId)
	const loadName = resolveLoadPresetName(presetId)
	const seed =
		opts.seed != null && Number.isFinite(opts.seed)
			? Math.floor(opts.seed)
			: Math.floor(Math.random() * 100000)

	const tree = new Tree() as unknown as EzTreeInstance
	tree.loadPreset(loadName)
	tree.options.seed = seed
	enhanceTreeOptionsForQuality(tree.options)
	def?.style?.(tree.options)

	await yieldToMain()
	tree.generate()

	let guard = 0
	while (tree.vertexCount > 140000 && guard < 4) {
		softenTreeOptions(tree.options)
		await yieldToMain()
		tree.generate()
		guard++
	}

	const group = bakeEzTreeToSafeGroup(tree)
	disposeTreeInstance(tree)

	group.userData.type = 'eztree'
	group.userData.preset = presetId
	group.userData.seed = seed
	group.userData.basePreset = loadName

	if (opts.targetHeight !== false) {
		const h =
			opts.targetHeight ??
			def?.targetHeight ??
			3.5
		fitTreeToHeight(group, h)
	}

	return group
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

/** 保存用：仅存预设 + 种子 */
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
