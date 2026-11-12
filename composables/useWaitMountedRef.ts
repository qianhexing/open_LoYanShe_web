import { nextTick, type Ref } from 'vue'

/**
 * 挂载异步子组件并等到 ref 可用。
 * 避免 defineAsyncComponent / v-if 延迟挂载时「首点只加载、第二次才弹出」。
 */
export async function waitForMountedRef<T>(options: {
	/** 控制 v-if 挂载；不传则假定已在模板中 */
	mounted?: Ref<boolean>
	getRef: () => T | null | undefined
	/** 与 defineAsyncComponent 共用同一 import 工厂时传入，可提前拉包 */
	preload?: () => Promise<unknown>
	timeoutMs?: number
}): Promise<T> {
	const { mounted, getRef, preload, timeoutMs = 15000 } = options
	if (mounted && !mounted.value) {
		mounted.value = true
	}
	if (preload) {
		await preload()
	}
	await nextTick()
	const existing = getRef()
	if (existing) return existing

	const start = Date.now()
	while (!getRef()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('[waitForMountedRef] async component mount timeout')
		}
		await new Promise((r) => setTimeout(r, 16))
	}
	return getRef() as T
}
