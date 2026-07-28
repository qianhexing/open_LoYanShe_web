import { matchScenes, type MatchSceneItem } from '@/api/ar'
import { uploadTempFileToOSS } from '@/utils/ossUpload'

export type ArMatchPhase = 'idle' | 'matching' | 'locking' | 'locked' | 'error'

const DEFAULT_INTERVAL_MS = 1600
const DEFAULT_VOTE_NEED = 2
const DEFAULT_TOP_K = 10
const DEFAULT_DISTANCE_MAX = 1.5
/** 抽帧最长边，控制上传体积（取景器方形） */
const CAPTURE_MAX_EDGE = 480
/** 首选 JPEG 质量 */
const CAPTURE_JPEG_QUALITY = 0.72
/** 超过则继续降质/缩放，避免频繁上传大图 */
const CAPTURE_TARGET_MAX_BYTES = 120 * 1024

export interface ArMatchViewfinder {
	containerWidth: number
	containerHeight: number
	/** 中间方形取景器边长（CSS px） */
	boxSize: number
}

export interface UseArSceneMatchOptions {
	intervalMs?: number
	voteNeed?: number
	topK?: number
	onlyMine?: boolean
	distanceMax?: number
	/** 返回当前取景器，用于只上传中间方形区域 */
	getViewfinder?: () => ArMatchViewfinder | null
	onLocked?: (item: MatchSceneItem) => void | Promise<void>
}

/**
 * 摄像头抽帧 → 压缩 → 上传 temp → POST /ar/match-scenes → 多帧投票锁定场景。
 * 专供 /ar/scan 等扫图页使用。
 */
export function useArSceneMatch(options: UseArSceneMatchOptions = {}) {
	const phase = ref<ArMatchPhase>('idle')
	const statusText = ref('')
	const errorMsg = ref('')
	const lastMatchHint = ref('')
	const voteMap = ref<Record<string, number>>({})
	const lockedItem = ref<MatchSceneItem | null>(null)
	const matchingBusy = ref(false)

	let timer: ReturnType<typeof setInterval> | null = null
	let videoEl: HTMLVideoElement | null = null
	let generation = 0
	/** 复用 canvas，减少 GC */
	let captureCanvas: HTMLCanvasElement | null = null

	const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
	const voteNeed = options.voteNeed ?? DEFAULT_VOTE_NEED

	function getCaptureCanvas(): HTMLCanvasElement {
		if (!captureCanvas) captureCanvas = document.createElement('canvas')
		return captureCanvas
	}

	function canvasToJpegBlob(
		canvas: HTMLCanvasElement,
		quality: number
	): Promise<Blob> {
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				blob => {
					if (blob) resolve(blob)
					else reject(new Error('抽帧 toBlob 失败'))
				},
				'image/jpeg',
				quality
			)
		})
	}

	/**
	 * 将屏幕中央方形取景器映射到视频像素（视频按 cover 铺满容器）。
	 * 无取景器信息时回退为视频帧中心正方形。
	 */
	function resolveViewfinderCrop(video: HTMLVideoElement): {
		sx: number
		sy: number
		sw: number
		sh: number
	} {
		const vw = video.videoWidth
		const vh = video.videoHeight
		const vf = options.getViewfinder?.()
		if (!vf || vf.containerWidth <= 0 || vf.containerHeight <= 0 || vf.boxSize <= 0) {
			const side = Math.min(vw, vh)
			return {
				sx: (vw - side) / 2,
				sy: (vh - side) / 2,
				sw: side,
				sh: side
			}
		}

		const { containerWidth: cw, containerHeight: ch, boxSize } = vf
		const videoRatio = vw / vh
		const containerRatio = cw / ch
		let visibleW: number
		let visibleH: number
		let ox: number
		let oy: number
		if (videoRatio > containerRatio) {
			visibleH = vh
			visibleW = vh * containerRatio
			ox = (vw - visibleW) / 2
			oy = 0
		} else {
			visibleW = vw
			visibleH = vw / containerRatio
			ox = 0
			oy = (vh - visibleH) / 2
		}

		const cropSide = Math.min(
			visibleW * (boxSize / cw),
			visibleH * (boxSize / ch)
		)
		return {
			sx: ox + (visibleW - cropSide) / 2,
			sy: oy + (visibleH - cropSide) / 2,
			sw: cropSide,
			sh: cropSide
		}
	}

	/**
	 * 从视频抽帧：只取中间方形取景器，再按目标体积迭代降质/缩放。
	 */
	async function captureCompressedFrame(video: HTMLVideoElement): Promise<File> {
		const vw = video.videoWidth
		const vh = video.videoHeight
		if (!vw || !vh) {
			throw new Error('视频尚未就绪，无法抽帧')
		}

		const canvas = getCaptureCanvas()
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Canvas 不可用')

		const crop = resolveViewfinderCrop(video)
		const baseSide = Math.min(
			CAPTURE_MAX_EDGE,
			Math.max(1, Math.round(crop.sw))
		)
		let side = baseSide
		let quality = CAPTURE_JPEG_QUALITY
		let blob: Blob | null = null

		for (let attempt = 0; attempt < 6; attempt++) {
			const out = Math.max(1, Math.round(side))
			canvas.width = out
			canvas.height = out
			ctx.drawImage(
				video,
				crop.sx,
				crop.sy,
				crop.sw,
				crop.sh,
				0,
				0,
				out,
				out
			)
			blob = await canvasToJpegBlob(canvas, quality)
			if (blob.size <= CAPTURE_TARGET_MAX_BYTES) break
			quality = Math.max(0.45, quality - 0.08)
			if (attempt >= 2) {
				side = Math.max(96, side * 0.85)
			}
		}

		if (!blob) throw new Error('抽帧压缩失败')

		return new File([blob], `frame_${Date.now()}.jpg`, {
			type: 'image/jpeg'
		})
	}

	async function matchOnce(video: HTMLVideoElement): Promise<MatchSceneItem | null> {
		const file = await captureCompressedFrame(video)
		const uploaded = await uploadTempFileToOSS(file)
		const result = await matchScenes({
			url: uploaded.file_url,
			topK: options.topK ?? DEFAULT_TOP_K,
			onlyMine: options.onlyMine ?? true,
			distanceMax: options.distanceMax ?? DEFAULT_DISTANCE_MAX
		})
		const items = result?.items ?? []
		if (!items.length) return null
		return items[0]
	}

	function resetVotes() {
		voteMap.value = {}
		lockedItem.value = null
	}

	async function tick(gen: number) {
		if (gen !== generation) return
		if (phase.value !== 'matching') return
		if (matchingBusy.value) return
		const video = videoEl
		if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
			statusText.value = '等待摄像头画面…'
			return
		}

		matchingBusy.value = true
		try {
			const best = await matchOnce(video)
			if (gen !== generation || phase.value !== 'matching') return

			if (!best?.scene_id || !best.mind_url) {
				lastMatchHint.value = '未匹配到场景'
				statusText.value = '扫描中：未匹配到场景，请对准识别图'
				return
			}

			const key = String(best.scene_id)
			const nextVotes = { ...voteMap.value }
			nextVotes[key] = (nextVotes[key] || 0) + 1
			voteMap.value = nextVotes
			const votes = nextVotes[key]
			lastMatchHint.value = `场景 ${key} · dist=${best.distance.toFixed(3)} · 票 ${votes}/${voteNeed}`
			statusText.value = `候选场景 ${key}（${votes}/${voteNeed}）`

			if (votes < voteNeed) return

			phase.value = 'locking'
			statusText.value = `已锁定场景 ${key}，正在切换…`
			lockedItem.value = best
			stopLoop()
			await options.onLocked?.(best)
			if (gen === generation) {
				phase.value = 'locked'
				statusText.value = `已锁定场景 ${key}`
			}
		} catch (e) {
			if (gen !== generation) return
			const msg = e instanceof Error ? e.message : '匹配失败'
			errorMsg.value = msg
			lastMatchHint.value = msg
			statusText.value = `匹配异常：${msg}`
			console.warn('[AR match]', e)
		} finally {
			if (gen === generation) matchingBusy.value = false
		}
	}

	function stopLoop() {
		if (timer) {
			clearInterval(timer)
			timer = null
		}
	}

	function start(video: HTMLVideoElement) {
		stopLoop()
		generation += 1
		const gen = generation
		videoEl = video
		errorMsg.value = ''
		resetVotes()
		phase.value = 'matching'
		statusText.value = '请对准识别图，正在匹配场景…'
		void tick(gen)
		timer = setInterval(() => void tick(gen), intervalMs)
	}

	/** 暂停截帧匹配（保留摄像头，可随后重新识别） */
	function pause() {
		if (phase.value !== 'matching' && phase.value !== 'locking') return
		generation += 1
		stopLoop()
		matchingBusy.value = false
		phase.value = 'idle'
		statusText.value = '已暂停识别'
	}

	function stop() {
		generation += 1
		stopLoop()
		matchingBusy.value = false
		videoEl = null
		if (phase.value === 'matching' || phase.value === 'locking') {
			phase.value = 'idle'
		}
	}

	onBeforeUnmount(() => {
		stop()
	})

	return {
		phase: readonly(phase),
		statusText: readonly(statusText),
		errorMsg: readonly(errorMsg),
		lastMatchHint: readonly(lastMatchHint),
		voteMap: readonly(voteMap),
		lockedItem: readonly(lockedItem),
		matchingBusy: readonly(matchingBusy),
		start,
		pause,
		stop,
		resetVotes
	}
}
