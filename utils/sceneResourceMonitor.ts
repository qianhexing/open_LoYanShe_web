import type * as THREE from 'three'

export type SceneResourceRisk = 'ok' | 'warn' | 'danger'

export interface SceneResourceSnapshot {
	/** WebGL 几何体缓存数 */
	geometries: number
	/** WebGL 贴图缓存数 */
	textures: number
	/** 着色器程序数 */
	programs: number
	/** 上一帧 draw call */
	drawCalls: number
	/** 上一帧三角形 */
	triangles: number
	/** 场景根对象（可编辑物体近似） */
	sceneRoots: number
	/** Mesh 数量 */
	meshes: number
	/** 点云（splat）数量 */
	splats: number
	/** ez-tree 植物数量 */
	plants: number
	/** SparkRenderer 是否仍挂在场景 */
	sparkActive: boolean
	/** Chrome：已用 JS 堆 MB */
	jsHeapUsedMb: number | null
	/** Chrome：JS 堆上限 MB */
	jsHeapLimitMb: number | null
	/** 综合风险 */
	risk: SceneResourceRisk
	/** 风险说明 */
	riskHints: string[]
	updatedAt: number
}

type PerfMemory = {
	usedJSHeapSize: number
	jsHeapSizeLimit: number
}

function readJsHeap(): { usedMb: number; limitMb: number } | null {
	if (typeof performance === 'undefined') return null
	const mem = (performance as Performance & { memory?: PerfMemory }).memory
	if (!mem?.jsHeapSizeLimit) return null
	return {
		usedMb: mem.usedJSHeapSize / (1024 * 1024),
		limitMb: mem.jsHeapSizeLimit / (1024 * 1024)
	}
}

function evaluateRisk(s: Omit<SceneResourceSnapshot, 'risk' | 'riskHints' | 'updatedAt'>): {
	risk: SceneResourceRisk
	riskHints: string[]
} {
	const hints: string[] = []
	let risk: SceneResourceRisk = 'ok'

	const bump = (level: SceneResourceRisk, hint: string) => {
		hints.push(hint)
		if (level === 'danger') risk = 'danger'
		else if (level === 'warn' && risk === 'ok') risk = 'warn'
	}

	if (s.textures >= 160) bump('danger', `贴图过多（${s.textures}），易占满显存`)
	else if (s.textures >= 90) bump('warn', `贴图较多（${s.textures}）`)

	if (s.geometries >= 400) bump('danger', `几何体过多（${s.geometries}）`)
	else if (s.geometries >= 200) bump('warn', `几何体较多（${s.geometries}）`)

	if (s.triangles >= 5_000_000) bump('danger', `三角形过高（${(s.triangles / 1e6).toFixed(1)}M）`)
	else if (s.triangles >= 2_000_000) bump('warn', `三角形偏高（${(s.triangles / 1e6).toFixed(1)}M）`)

	if (s.splats >= 3) bump('danger', `点云过多（${s.splats} 个），显存压力大`)
	else if (s.splats >= 1 && s.plants >= 8) {
		bump('warn', '点云 + 多株植物并存，建议少加高模')
	} else if (s.splats >= 1 && s.textures >= 60) {
		bump('warn', '已有点云，继续加载大贴图资源风险升高')
	}

	if (s.sparkActive && s.splats === 0) {
		bump('warn', 'Spark 仍占用中（点云已删未释放？）')
	}

	if (s.jsHeapUsedMb != null && s.jsHeapLimitMb != null && s.jsHeapLimitMb > 0) {
		const ratio = s.jsHeapUsedMb / s.jsHeapLimitMb
		if (ratio >= 0.88) bump('danger', `JS 内存紧张（${Math.round(ratio * 100)}%）`)
		else if (ratio >= 0.72) bump('warn', `JS 内存偏高（${Math.round(ratio * 100)}%）`)
	}

	if (s.plants >= 20) bump('warn', `植物较多（${s.plants}），注意面数`)

	return { risk, riskHints: hints }
}

export interface CollectSceneResourceInput {
	scene: THREE.Scene | null | undefined
	glRenderer: THREE.WebGLRenderer | null | undefined
	/** 是否存在 SparkRenderer 实例 */
	sparkActive?: boolean
	isSplatObject?: (obj: THREE.Object3D) => boolean
}

/**
 * 采集编辑器用的资源快照（非精确 VRAM，用于趋势与预警）
 */
export function collectSceneResourceSnapshot(
	input: CollectSceneResourceInput
): SceneResourceSnapshot {
	const { scene, glRenderer } = input
	const info = glRenderer?.info
	const memory = info?.memory
	const render = info?.render

	let meshes = 0
	let splats = 0
	let plants = 0
	let sceneRoots = 0

	if (scene) {
		for (const child of scene.children) {
			if (child.userData?.ignorePick || child.userData?.sceneEditorOverlay) continue
			if (child.type === 'AmbientLight' || child.type?.includes('Light')) continue
			if ((child as { isTransformControls?: boolean }).isTransformControls) continue
			sceneRoots++
		}
		scene.traverse((obj) => {
			const mesh = obj as THREE.Mesh
			if (mesh.isMesh) meshes++
			const isSplat =
				input.isSplatObject?.(obj) || obj.userData?.type === 'splat'
			if (isSplat) splats++
			if (obj.userData?.type === 'eztree') plants++
		})
	}

	const heap = readJsHeap()
	const base = {
		geometries: memory?.geometries ?? 0,
		textures: memory?.textures ?? 0,
		programs: Array.isArray((info as { programs?: unknown[] } | undefined)?.programs)
			? ((info as { programs: unknown[] }).programs.length)
			: 0,
		drawCalls: render?.calls ?? 0,
		triangles: render?.triangles ?? 0,
		sceneRoots,
		meshes,
		splats,
		plants,
		sparkActive: Boolean(input.sparkActive),
		jsHeapUsedMb: heap ? Math.round(heap.usedMb * 10) / 10 : null,
		jsHeapLimitMb: heap ? Math.round(heap.limitMb) : null
	}

	const { risk, riskHints } = evaluateRisk(base)
	return {
		...base,
		risk,
		riskHints,
		updatedAt: Date.now()
	}
}

export function formatTriangles(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}
