import { onUnmounted, ref, watch, type Ref } from 'vue'
import type ThreeCore from '@/utils/threeCore'
import {
	collectSceneResourceSnapshot,
	type SceneResourceSnapshot
} from '@/utils/sceneResourceMonitor'

const emptySnapshot = (): SceneResourceSnapshot => ({
	geometries: 0,
	textures: 0,
	programs: 0,
	drawCalls: 0,
	triangles: 0,
	sceneRoots: 0,
	meshes: 0,
	splats: 0,
	plants: 0,
	sparkActive: false,
	jsHeapUsedMb: null,
	jsHeapLimitMb: null,
	risk: 'ok',
	riskHints: [],
	updatedAt: 0
})

/**
 * 编辑模式下周期性采集场景资源占用，供 HUD 展示与预警。
 */
export function useSceneResourceMonitor(options: {
	threeCore: Ref<ThreeCore | null | undefined>
	/** 是否启用采集（通常 = edit || add） */
	enabled: Ref<boolean>
	/** 轮询间隔 ms */
	intervalMs?: number
}) {
	const snapshot = ref<SceneResourceSnapshot>(emptySnapshot())
	const visible = ref(true)
	let timer: ReturnType<typeof setInterval> | null = null
	let contextLostHandler: ((e: Event) => void) | null = null
	let boundCanvas: HTMLCanvasElement | null = null
	const contextLost = ref(false)

	const refresh = () => {
		const core = options.threeCore.value
		if (!core?.scene) {
			snapshot.value = emptySnapshot()
			return
		}
		try {
			snapshot.value = core.getResourceSnapshot()
		} catch (e) {
			console.warn('[sceneResource] snapshot failed', e)
		}
	}

	const bindContextLost = () => {
		unbindContextLost()
		const core = options.threeCore.value
		const canvas = core?.getWebGLRenderer?.()?.domElement
		if (!canvas) return
		boundCanvas = canvas
		contextLostHandler = (e: Event) => {
			e.preventDefault()
			contextLost.value = true
		}
		canvas.addEventListener('webglcontextlost', contextLostHandler, false)
	}

	const unbindContextLost = () => {
		if (boundCanvas && contextLostHandler) {
			boundCanvas.removeEventListener('webglcontextlost', contextLostHandler)
		}
		boundCanvas = null
		contextLostHandler = null
	}

	const start = () => {
		stop()
		refresh()
		bindContextLost()
		timer = setInterval(refresh, options.intervalMs ?? 1200)
	}

	const stop = () => {
		if (timer) {
			clearInterval(timer)
			timer = null
		}
		unbindContextLost()
	}

	watch(
		[options.enabled, options.threeCore],
		([enabled, core]) => {
			if (enabled && core) start()
			else stop()
		},
		{ immediate: true }
	)

	onUnmounted(stop)

	return {
		snapshot,
		visible,
		contextLost,
		refresh,
		start,
		stop
	}
}
