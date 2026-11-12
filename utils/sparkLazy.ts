/**
 * 按需加载 @sparkjsdev/spark，避免点云库进 WebView 共享入口包。
 */
export type SparkModule = typeof import('@sparkjsdev/spark')

let sparkMod: SparkModule | null = null
let loadPromise: Promise<SparkModule> | null = null

export function loadSpark(): Promise<SparkModule> {
	if (sparkMod) return Promise.resolve(sparkMod)
	if (!loadPromise) {
		loadPromise = import('@sparkjsdev/spark').then((m) => {
			sparkMod = m
			return m
		})
	}
	return loadPromise
}

export function tryGetSpark(): SparkModule | null {
	return sparkMod
}

/** 未加载 Spark 时用 userData / duck typing，避免静态依赖 SplatMesh */
export function isSplatMeshObject(obj: unknown): boolean {
	if (!obj || typeof obj !== 'object') return false
	const SplatMesh = sparkMod?.SplatMesh
	if (SplatMesh && obj instanceof SplatMesh) return true
	const o = obj as {
		userData?: { type?: string }
		updateGenerator?: unknown
	}
	return o.userData?.type === 'splat' && typeof o.updateGenerator === 'function'
}

export function isSparkRendererObject(obj: unknown): boolean {
	if (!obj || typeof obj !== 'object') return false
	const SparkRenderer = sparkMod?.SparkRenderer
	if (SparkRenderer && obj instanceof SparkRenderer) return true
	return (obj as { type?: string }).type === 'SparkRenderer'
}
