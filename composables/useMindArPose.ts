import {
	onBeforeUnmount,
	readonly,
	ref,
	shallowRef,
	toValue,
	type MaybeRefOrGetter
} from 'vue'
import * as THREE from 'three'
import { buildMindArPostMatrix, syncMindArVideoIntrinsicSize } from '@/utils/ar/mindArPose'
import { probeMindFile, withMindCacheBust } from '@/utils/ar/probeMindFile'

export type MindArPoseStatus =
	| 'idle'
	| 'starting'
	| 'scanning'
	| 'tracking'
	| 'lost'
	| 'error'

export interface MindArDebugSnapshot {
	status: MindArPoseStatus
	statusText: string
	errorMsg: string
	isTracking: boolean
	isRunning: boolean
	mindUrl: string
	targetIndex: number
	videoSize: string
	inputSize: string
	markerDims: string
	processDoneCount: number
	matrixUpdateCount: number
	matrixHitCount: number
	matrixMissCount: number
	lastEventType: string
	lastEventAt: string
	lastMatrixState: 'none' | 'hit' | 'miss'
	approxFps: number
	logLines: string[]
}

export interface MindArPoseStartOptions {
	video: HTMLVideoElement
	mindUrl: MaybeRefOrGetter<string>
	/** .mind 内多 target 时使用，默认 0 */
	targetIndex?: MaybeRefOrGetter<number>
	onMatrix?: (payload: {
		targetIndex: number
		worldMatrix: number[] | null
		postMatrix: THREE.Matrix4
	}) => void
	onReady?: (info: {
		dimensions: number[][]
		projectionMatrix: number[]
		inputWidth: number
		inputHeight: number
	}) => void
	onStatus?: (status: MindArPoseStatus, message?: string) => void
}

const MAX_LOG = 40

/**
 * MindAR 仅作位姿引擎：开相机、加载 .mind、输出 worldMatrix。
 * 场景加载与渲染交给 ThreeCore（路线 A）。
 */
export function useMindArPose() {
	const status = ref<MindArPoseStatus>('idle')
	const statusText = ref('')
	const errorMsg = ref('')
	const isTracking = ref(false)
	const isRunning = ref(false)

	const mindUrlText = ref('')
	const targetIndexVal = ref(0)
	const videoSizeText = ref('-')
	const inputSizeText = ref('-')
	const markerDimsText = ref('-')
	const mindProbeText = ref('-')
	const processDoneCount = ref(0)
	const matrixUpdateCount = ref(0)
	const matrixHitCount = ref(0)
	const matrixMissCount = ref(0)
	const lastEventType = ref('-')
	const lastEventAt = ref('-')
	const lastMatrixState = ref<'none' | 'hit' | 'miss'>('none')
	const approxFps = ref(0)
	const logLines = ref<string[]>([])

	const postMatrices = shallowRef<THREE.Matrix4[]>([])
	let controller: {
		addImageTargets: (url: string) => Promise<{ dimensions: number[][] }>
		addImageTargetsFromBuffer: (buffer: ArrayBuffer) => {
			dimensions: number[][]
		}
		dummyRun: (input: HTMLVideoElement) => void | Promise<void>
		processVideo: (input: HTMLVideoElement) => void
		stopProcessVideo: () => void
		dispose: () => void
		getProjectionMatrix: () => number[]
		inputWidth: number
		inputHeight: number
	} | null = null
	let stream: MediaStream | null = null
	let MindARController: (new (opts: Record<string, unknown>) => typeof controller) | null =
		null
	let fpsWindowStart = 0
	let fpsWindowCount = 0

	async function ensureControllerClass() {
		if (MindARController) return MindARController
		// @ts-expect-error mind-ar 包无 Controller 的 TS 声明
		const mod = await import('mind-ar/src/image-target/controller')
		MindARController = (mod as { Controller: typeof MindARController }).Controller
		return MindARController
	}

	function pushLog(line: string) {
		const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		logLines.value = [`[${stamp}] ${line}`, ...logLines.value].slice(0, MAX_LOG)
	}

	function markEvent(type: string) {
		lastEventType.value = type
		lastEventAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
	}

	function setStatus(next: MindArPoseStatus, message?: string, log = true) {
		const changed =
			status.value !== next ||
			(message !== undefined && statusText.value !== message)
		status.value = next
		if (message !== undefined) statusText.value = message
		if (log && changed && message) pushLog(`${next}: ${message}`)
		optionsRef?.onStatus?.(next, message)
	}

	function resetDebugCounters() {
		processDoneCount.value = 0
		matrixUpdateCount.value = 0
		matrixHitCount.value = 0
		matrixMissCount.value = 0
		lastEventType.value = '-'
		lastEventAt.value = '-'
		lastMatrixState.value = 'none'
		approxFps.value = 0
		fpsWindowStart = performance.now()
		fpsWindowCount = 0
		logLines.value = []
		markerDimsText.value = '-'
		mindProbeText.value = '-'
		inputSizeText.value = '-'
		videoSizeText.value = '-'
	}

	let optionsRef: MindArPoseStartOptions | null = null

	async function openCamera(video: HTMLVideoElement): Promise<void> {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				facingMode: { ideal: 'environment' },
				width: { ideal: 1280 },
				height: { ideal: 720 }
			}
		})
		video.srcObject = stream
		video.setAttribute('autoplay', '')
		video.setAttribute('muted', '')
		video.setAttribute('playsinline', '')
		video.setAttribute('webkit-playsinline', '')
		video.muted = true
		video.playsInline = true
		await video.play().catch(() => undefined)
		await new Promise<void>((resolve, reject) => {
			if (video.videoWidth > 0 && video.videoHeight > 0) {
				resolve()
				return
			}
			const onMeta = () => {
				cleanup()
				resolve()
			}
			const onErr = () => {
				cleanup()
				reject(new Error('摄像头视频元数据加载失败'))
			}
			const cleanup = () => {
				video.removeEventListener('loadedmetadata', onMeta)
				video.removeEventListener('error', onErr)
			}
			video.addEventListener('loadedmetadata', onMeta)
			video.addEventListener('error', onErr)
		})

		// 关键：与 MindARThree 一致，把 intrinsic 写到 width/height 属性
		const sync = syncMindArVideoIntrinsicSize(video)
		videoSizeText.value = `${sync.videoWidth}×${sync.videoHeight}`
		pushLog(
			`摄像头就绪 video=${sync.videoWidth}×${sync.videoHeight} attr=${sync.attrWidth}×${sync.attrHeight}`
		)
		if (!sync.ok) {
			throw new Error(
				`视频 width/height 属性未与 videoWidth/Height 对齐（attr=${sync.attrWidth}×${sync.attrHeight}, video=${sync.videoWidth}×${sync.videoHeight}）。MindAR 将无法取帧匹配。`
			)
		}

		// 等到有可解码帧，避免用黑帧做 dummyRun
		if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
			await new Promise<void>(resolve => {
				const onData = () => {
					video.removeEventListener('loadeddata', onData)
					resolve()
				}
				video.addEventListener('loadeddata', onData)
			})
		}
	}

	async function start(options: MindArPoseStartOptions) {
		if (isRunning.value) await stop()
		optionsRef = options
		errorMsg.value = ''
		isTracking.value = false
		resetDebugCounters()
		mindUrlText.value = toValue(options.mindUrl)
		targetIndexVal.value = toValue(options.targetIndex ?? 0)
		setStatus('starting', '启动摄像头...')

		const video = options.video
		const mindUrl = mindUrlText.value
		const targetIndex = targetIndexVal.value

		try {
			pushLog(`加载 MindAR Controller…`)
			const ControllerClass = await ensureControllerClass()
			if (!ControllerClass) throw new Error('MindAR Controller 加载失败')
			pushLog('Controller 已加载')

			await openCamera(video)
			setStatus('starting', '初始化识别引擎...')

			// 再次同步：CSS 布局后仍保持 intrinsic 属性（供 InputLoader.drawImage）
			const syncBeforeCtrl = syncMindArVideoIntrinsicSize(video)
			pushLog(
				`创建 Controller 前 attr=${syncBeforeCtrl.attrWidth}×${syncBeforeCtrl.attrHeight}`
			)

			controller = new ControllerClass({
				inputWidth: video.videoWidth,
				inputHeight: video.videoHeight,
				maxTrack: 1,
				debugMode: false,
				// 略增预热，减少首帧错误锁定；miss 更宽容，避免频繁丢跟踪重置
				warmupTolerance: 3,
				missTolerance: 10,
				// OneEuro：更低 cutoff / beta → 更稳、少甩动（默认 0.001 / 1000）
				filterMinCF: 0.0005,
				filterBeta: 80,
				onUpdate: (event: {
					type: string
					targetIndex?: number
					worldMatrix?: number[] | null
				}) => {
					markEvent(event.type)

					if (event.type === 'processDone') {
						processDoneCount.value += 1
						fpsWindowCount += 1
						const now = performance.now()
						const elapsed = now - fpsWindowStart
						if (elapsed >= 1000) {
							approxFps.value = Math.round((fpsWindowCount * 1000) / elapsed)
							fpsWindowStart = now
							fpsWindowCount = 0
							// 每秒提醒一次：若 hit 仍为 0，提示检查识别图与视频属性
							if (
								isRunning.value &&
								!isTracking.value &&
								matrixHitCount.value === 0
							) {
								const a = `${video.width}×${video.height}`
								const v = `${video.videoWidth}×${video.videoHeight}`
								if (a !== v) {
									pushLog(`警告: video attr ${a} ≠ videoSize ${v}，已尝试重新同步`)
									syncMindArVideoIntrinsicSize(video)
								}
							}
						}
						if (!isTracking.value && isRunning.value) {
							setStatus('scanning', '扫描中：未匹配到识别图', false)
						}
						return
					}

					if (event.type !== 'updateMatrix') {
						pushLog(`未知事件: ${event.type}`)
						return
					}

					matrixUpdateCount.value += 1
					const idx = event.targetIndex ?? 0
					if (idx !== targetIndex) {
						pushLog(`忽略 targetIndex=${idx}（期望 ${targetIndex}）`)
						return
					}

					const post =
						postMatrices.value[idx] ?? postMatrices.value[0] ?? new THREE.Matrix4()
					const worldMatrix = event.worldMatrix ?? null

					if (worldMatrix) {
						matrixHitCount.value += 1
						lastMatrixState.value = 'hit'
						if (!isTracking.value) {
							isTracking.value = true
							setStatus('tracking', '目标已锁定')
							pushLog('首次命中 worldMatrix')
						}
					} else {
						matrixMissCount.value += 1
						lastMatrixState.value = 'miss'
						if (isTracking.value) {
							setStatus('lost', '目标丢失，保持最后位置')
						}
					}

					options.onMatrix?.({
						targetIndex: idx,
						worldMatrix,
						postMatrix: post
					})
				}
			})

			if (!controller) throw new Error('MindAR Controller 创建失败')
			inputSizeText.value = `${controller.inputWidth}×${controller.inputHeight}`
			pushLog(`Controller 输入尺寸 ${inputSizeText.value}`)

			setStatus('starting', `加载识别图…`)
			const mindUrlToLoad = withMindCacheBust(mindUrl, Date.now())
			pushLog(`mindUrl: ${mindUrlToLoad}`)

			const probe = await probeMindFile(mindUrlToLoad)
			mindProbeText.value = probe.ok
				? `ok v${probe.version} ${probe.bytes}B targets=${probe.targetCount} feat≈${probe.featureCountApprox} ${probe.dimensions.map(d => `${d.width}×${d.height}`).join(',')}`
				: `FAIL: ${probe.error || 'unknown'}`
			pushLog(`mind probe: ${mindProbeText.value}`)
			if (!probe.ok) {
				throw new Error(
					`识别图 .mind 无效：${probe.error || '无法解析'}（请重新编译上传；若 OSS 文件可打开则检查编译服务）`
				)
			}
			if (probe.featureCountApprox < 80) {
				pushLog(
					`警告: 特征点偏少（≈${probe.featureCountApprox}），追踪可能不稳定`
				)
			}

			const mindRes = await fetch(mindUrlToLoad, {
				mode: 'cors',
				cache: 'no-cache',
				credentials: 'omit'
			})
			if (!mindRes.ok) {
				throw new Error(`下载 .mind 失败 HTTP ${mindRes.status}`)
			}
			const mindBuffer = await mindRes.arrayBuffer()
			const { dimensions } = controller.addImageTargetsFromBuffer(mindBuffer)
			if (!dimensions?.length) {
				throw new Error('MindAR 未能导入识别目标（dimensions 为空）')
			}
			postMatrices.value = dimensions.map(([w, h]) =>
				buildMindArPostMatrix(w || 1, h || 1)
			)
			markerDimsText.value =
				dimensions.map((d, i) => `#${i}:${d[0]}×${d[1]}`).join(', ') || '空'
			pushLog(`识别图 dimensions: ${markerDimsText.value}`)

			setStatus('starting', '预热识别引擎...')
			syncMindArVideoIntrinsicSize(video)
			await controller.dummyRun(video)
			pushLog('dummyRun 完成')

			const projectionMatrix = controller.getProjectionMatrix()
			options.onReady?.({
				dimensions,
				projectionMatrix: [...projectionMatrix],
				inputWidth: controller.inputWidth,
				inputHeight: controller.inputHeight
			})

			isRunning.value = true
			syncMindArVideoIntrinsicSize(video)
			await video.play().catch(() => undefined)
			setStatus(
				'scanning',
				'请对准识别图（打印件或另一块屏幕上的预览图，需完整入框）'
			)
			controller.processVideo(video)
			pushLog(
				`processVideo 已启动 | attr=${video.width}×${video.height} readyState=${video.readyState}`
			)
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'MindAR 启动失败'
			const stack = e instanceof Error && e.stack ? `\n${e.stack}` : ''
			errorMsg.value = msg + stack
			setStatus('error', msg)
			pushLog(`ERROR: ${msg}`)
			await stop()
			throw e
		}
	}

	async function stop() {
		isRunning.value = false
		isTracking.value = false
		try {
			controller?.stopProcessVideo?.()
			controller?.dispose?.()
		} catch (e) {
			pushLog(`stop 异常: ${e instanceof Error ? e.message : String(e)}`)
		}
		controller = null
		postMatrices.value = []

		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop()
			}
			stream = null
		}
		if (optionsRef?.video) {
			optionsRef.video.srcObject = null
		}
		optionsRef = null
		if (status.value !== 'error') {
			setStatus('idle', '')
		}
	}

	function getDebugSnapshot(): MindArDebugSnapshot {
		return {
			status: status.value,
			statusText: statusText.value,
			errorMsg: errorMsg.value,
			isTracking: isTracking.value,
			isRunning: isRunning.value,
			mindUrl: mindUrlText.value,
			targetIndex: targetIndexVal.value,
			videoSize: videoSizeText.value,
			inputSize: inputSizeText.value,
			markerDims: markerDimsText.value,
			processDoneCount: processDoneCount.value,
			matrixUpdateCount: matrixUpdateCount.value,
			matrixHitCount: matrixHitCount.value,
			matrixMissCount: matrixMissCount.value,
			lastEventType: lastEventType.value,
			lastEventAt: lastEventAt.value,
			lastMatrixState: lastMatrixState.value,
			approxFps: approxFps.value,
			logLines: [...logLines.value]
		}
	}

	onBeforeUnmount(() => {
		void stop()
	})

	return {
		status: readonly(status),
		statusText: readonly(statusText),
		errorMsg: readonly(errorMsg),
		isTracking: readonly(isTracking),
		isRunning: readonly(isRunning),
		mindUrlText: readonly(mindUrlText),
		targetIndexVal: readonly(targetIndexVal),
		videoSizeText: readonly(videoSizeText),
		inputSizeText: readonly(inputSizeText),
		markerDimsText: readonly(markerDimsText),
		mindProbeText: readonly(mindProbeText),
		processDoneCount: readonly(processDoneCount),
		matrixUpdateCount: readonly(matrixUpdateCount),
		matrixHitCount: readonly(matrixHitCount),
		matrixMissCount: readonly(matrixMissCount),
		lastEventType: readonly(lastEventType),
		lastEventAt: readonly(lastEventAt),
		lastMatrixState: readonly(lastMatrixState),
		approxFps: readonly(approxFps),
		logLines: readonly(logLines),
		getDebugSnapshot,
		start,
		stop
	}
}
