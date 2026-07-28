<script setup lang="ts">
/**
 * 独立 AR 扫图匹配页：抽帧 → match-scenes → 清内容切换场景/识别图（不销毁 WebGL）。
 * 与 pages/scene/detail/ar/[id].vue 互不影响。
 */
import { useSceneCore } from '@/composables/useSceneCore'
import { useMindArPose } from '@/composables/useMindArPose'
import { useArSceneMatch } from '@/composables/useArSceneMatch'
import { getSceneId } from '@/api/scene'
import type { MatchSceneItem } from '@/api/ar'
import { getARConfig, DEFAULT_IMAGE_TARGET } from '@/utils/ar/config'
import {
	hasSceneArTarget,
	normalizeSceneArTarget,
	pickArTargetFromSceneJson,
	resolveSceneArAssetUrl,
	toSceneArTarget
} from '@/utils/ar/sceneArTarget'
import { withMindCacheBust } from '@/utils/ar/probeMindFile'
import {
	applyMindArProjectionToCamera,
	layoutMindArVideo
} from '@/utils/ar/mindArPose'
import { BASE_IMG, BASE_IMG_MODEL } from '@/utils/ipConfig'
import type { DiaryInterface, LibraryInterface } from '@/types/sence'
import type { SceneArTargetJSON } from '@/utils/threeCore'
import { PerspectiveCamera } from 'three'

const route = useRoute()
const userStore = useUserStore()

// layout: false 不会走 default 布局的 token 注入；须在发起匹配/场景接口前就绪
if (route.query?.token) {
	userStore.setToken(String(route.query.token))
}
if (import.meta.client && !userStore.token) {
	await userStore.initialize()
}

const activeSceneId = ref(0)
const sceneIdNum = computed(() => activeSceneId.value || 1)
const fallbackArConfig = computed(() => getARConfig(sceneIdNum.value))

const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const showDiary = ref(false)
const activeDiary = ref<DiaryInterface | null>(null)
const clickPosition = ref({ x: 0, y: 0 })

const videoRef = ref<HTMLVideoElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const sceneArRef = ref<HTMLElement | null>(null)
const mindArBootError = ref('')
const mindArReady = ref(false)
const sceneLoaded = ref(false)
const sceneObjectCount = ref(0)
const loadedArTarget = ref<SceneArTargetJSON | null>(null)
const arPhase = ref<'booting' | 'matching' | 'loading' | 'tracking'>('booting')
const switchingScene = ref(false)

const {
	threeCore,
	sceneLoading,
	sceneLoadProgress,
	sceneLoadError,
	diaryList,
	libraryList,
	initScene,
	reloadSceneKeepWebGL,
	disposeScene
} = useSceneCore()

function syncLoadedArTarget(sceneData?: { json_data?: unknown } | null) {
	const fromApi = pickArTargetFromSceneJson(sceneData?.json_data)
	const fromCore = normalizeSceneArTarget(threeCore.value?.arTarget)
	const next = fromApi || fromCore
	loadedArTarget.value = next
	if (threeCore.value && next) {
		threeCore.value.arTarget = next
	}
	return next
}

function applyMatchArTarget(item: MatchSceneItem) {
	const target = toSceneArTarget({
		mindUrl: item.mind_url,
		previewUrl: item.preview_url,
		targetIndex: item.target_index ?? 0,
		...(item.name ? { name: item.name } : {}),
		updatedAt: new Date().toISOString()
	})
	loadedArTarget.value = target
	if (threeCore.value) {
		threeCore.value.arTarget = target
	}
	return target
}

const activeMindUrl = computed(() => {
	const t = loadedArTarget.value
	if (hasSceneArTarget(t)) {
		return withMindCacheBust(
			resolveSceneArAssetUrl(t.mindUrl),
			t.updatedAt || t.mindUrl
		)
	}
	return fallbackArConfig.value.mindUrl
})

const activeTargetIndex = computed(() => {
	const t = loadedArTarget.value
	if (hasSceneArTarget(t)) return t.targetIndex ?? 0
	return fallbackArConfig.value.targetIndex
})

const previewImageUrl = computed(() => {
	const t = loadedArTarget.value
	if (hasSceneArTarget(t)) return resolveSceneArAssetUrl(t.previewUrl)
	return DEFAULT_IMAGE_TARGET.previewImageUrl
})

const usingSceneArTarget = computed(() =>
	hasSceneArTarget(loadedArTarget.value)
)

const {
	status,
	statusText,
	errorMsg,
	isTracking,
	isRunning,
	mindUrlText,
	targetIndexVal,
	videoSizeText,
	inputSizeText,
	markerDimsText,
	mindProbeText,
	processDoneCount,
	matrixUpdateCount,
	matrixHitCount,
	matrixMissCount,
	lastEventType,
	lastEventAt,
	lastMatrixState,
	approxFps,
	logLines,
	startCameraOnly,
	start: startMindAr,
	switchImageTarget,
	stop: stopMindAr
} = useMindArPose()

const poseLockedFlag = ref(false)
const debugPanelOpen = ref(false)
const sceneVisible = computed(() => isTracking.value || poseLockedFlag.value)

async function applyMatchedScene(item: MatchSceneItem) {
	if (switchingScene.value) return
	switchingScene.value = true
	arPhase.value = 'loading'
	mindArBootError.value = ''
	const sid = Number(item.scene_id)
	try {
		await stopMindAr({ keepCamera: true })
		mindArReady.value = false
		poseLockedFlag.value = false
		lastProjection = null

		activeSceneId.value = sid
		applyMatchArTarget(item)

		clearNuxtData(`studyDeatil-${sid}`)
		const sceneData = await getSceneId({ sence_id: sid })
		await reloadSceneKeepWebGL(String(sid), {
			sceneData,
			baseUrl: BASE_IMG_MODEL
		})
		await nextTick()

		applyMatchArTarget(item)
		if (!hasSceneArTarget(loadedArTarget.value)) {
			syncLoadedArTarget(sceneData)
		}

		markSceneReadyHidden()
		await bootMindArTracking(true)
	} catch (e) {
		mindArBootError.value =
			e instanceof Error ? e.message : '切换场景失败'
		arPhase.value = 'matching'
		const video = videoRef.value
		if (video) {
			try {
				await startCameraOnly(video)
			} catch {
				/* ignore */
			}
			startSceneMatch(video)
		}
	} finally {
		switchingScene.value = false
	}
}

/** 取景器边长，与模板 w-64/h-64 一致 */
const SCAN_BOX_SIZE = 256
/** 长时间未 hit / 未匹配成功后显示「重新识别」 */
const NO_HIT_TIMEOUT_MS = 10_000

const {
	statusText: matchStatusText,
	errorMsg: matchErrorMsg,
	lastMatchHint,
	start: startSceneMatch,
	pause: pauseSceneMatch,
	stop: stopSceneMatch
} = useArSceneMatch({
	getViewfinder: () => {
		const root = rootRef.value
		if (!root) return null
		const { w, h } = getViewportSize(root)
		if (w <= 0 || h <= 0) return null
		return {
			containerWidth: w,
			containerHeight: h,
			boxSize: SCAN_BOX_SIZE
		}
	},
	onLocked: item => applyMatchedScene(item)
})

const matchPaused = ref(false)
const noHitTimedOut = ref(false)
let noHitTimer: ReturnType<typeof setTimeout> | null = null

function clearNoHitTimer() {
	if (noHitTimer) {
		clearTimeout(noHitTimer)
		noHitTimer = null
	}
}

function armNoHitTimer() {
	clearNoHitTimer()
	noHitTimedOut.value = false
	noHitTimer = setTimeout(() => {
		noHitTimedOut.value = true
	}, NO_HIT_TIMEOUT_MS)
}

function pauseRecognize() {
	if (switchingScene.value || arPhase.value !== 'matching') return
	pauseSceneMatch()
	matchPaused.value = true
	noHitTimedOut.value = true
	clearNoHitTimer()
}

const showPauseBtn = computed(
	() =>
		arPhase.value === 'matching' &&
		!matchPaused.value &&
		!switchingScene.value &&
		!sceneLoadError.value
)

const showReRecognizeBtn = computed(() => {
	if (arPhase.value === 'booting' || sceneLoadError.value) return false
	if (switchingScene.value || arPhase.value === 'loading') return false
	return matchPaused.value || noHitTimedOut.value
})

watch(arPhase, phase => {
	if (phase === 'matching') {
		matchPaused.value = false
		armNoHitTimer()
	} else if (phase === 'tracking') {
		matchPaused.value = false
		// 已锁定过则等丢失再显示；尚未命中则启动超时
		if (isTracking.value || status.value === 'tracking') {
			clearNoHitTimer()
			noHitTimedOut.value = false
		} else {
			armNoHitTimer()
		}
	} else {
		clearNoHitTimer()
		noHitTimedOut.value = false
		matchPaused.value = false
	}
})

watch(isTracking, hit => {
	if (arPhase.value !== 'tracking') return
	if (hit) {
		clearNoHitTimer()
		noHitTimedOut.value = false
	} else {
		armNoHitTimer()
	}
})

/** MindAR 丢失目标后立刻显示「重新识别」 */
watch(status, s => {
	if (arPhase.value !== 'tracking') return
	if (s === 'lost') {
		clearNoHitTimer()
		noHitTimedOut.value = true
	} else if (s === 'tracking') {
		clearNoHitTimer()
		noHitTimedOut.value = false
	}
})

/** 匹配到候选场景时重置超时（有进展不算「长时间未 hit」） */
watch(lastMatchHint, hint => {
	if (arPhase.value !== 'matching' || matchPaused.value) return
	if (hint && !hint.includes('未匹配')) {
		armNoHitTimer()
	}
})

const debugRows = computed(() => [
	{ k: '场景 ID', v: String(activeSceneId.value || '-') },
	{ k: 'AR 阶段', v: arPhase.value },
	{ k: '匹配提示', v: lastMatchHint.value || '-' },
	{ k: '识别图来源', v: usingSceneArTarget.value ? '匹配结果' : '默认兜底' },
	{
		k: 'arTarget',
		v: loadedArTarget.value ? loadedArTarget.value.mindUrl : '(空)'
	},
	{ k: 'mind probe', v: mindProbeText.value },
	{
		k: '场景加载',
		v: sceneLoading.value
			? `进行中 ${sceneLoadProgress.value.current}/${sceneLoadProgress.value.total}`
			: sceneLoadError.value
				? '失败'
				: '完成'
	},
	{ k: '场景物体', v: String(sceneObjectCount.value) },
	{ k: '场景已加载', v: sceneLoaded.value ? '是' : '否' },
	{ k: '场景可见', v: sceneVisible.value ? '是（已识别）' : '否（等待识别）' },
	{ k: '位姿锁定', v: poseLockedFlag.value ? '是' : '否' },
	{ k: 'MindAR status', v: String(status.value) },
	{ k: 'statusText', v: statusText.value || '-' },
	{ k: 'isRunning', v: String(isRunning.value) },
	{ k: 'isTracking', v: String(isTracking.value) },
	{ k: 'mindReady', v: String(mindArReady.value) },
	{ k: 'video', v: videoSizeText.value },
	{ k: 'input', v: inputSizeText.value },
	{ k: 'marker', v: markerDimsText.value },
	{ k: 'targetIndex', v: String(targetIndexVal.value) },
	{ k: 'processDone', v: String(processDoneCount.value) },
	{ k: 'hit / miss', v: `${matrixHitCount.value} / ${matrixMissCount.value}` },
	{ k: 'lastMatrix', v: lastMatrixState.value },
	{ k: 'lastEvent', v: `${lastEventType.value} @ ${lastEventAt.value}` },
	{ k: 'approx FPS', v: String(approxFps.value) },
	{ k: 'mindUrl', v: mindUrlText.value || activeMindUrl.value }
])

const errorBanner = computed(() => {
	const parts = [
		mindArBootError.value,
		errorMsg.value,
		sceneLoadError.value,
		matchErrorMsg.value
	].filter(Boolean)
	return parts.join('\n\n')
})

let uni: { navigateTo?: (opts: { url: string; fail?: () => void }) => void } | undefined
let resizeHandler: (() => void) | null = null
let lastProjection: {
	matrix: number[]
	inputWidth: number
	inputHeight: number
} | null = null

/** 手机 WebView 上 clientWidth 偶发偏小，优先用 visualViewport / inner* 铺满 */
function getViewportSize(root: HTMLElement) {
	const vv = window.visualViewport
	const w = Math.max(
		root.clientWidth,
		vv?.width ?? 0,
		window.innerWidth || 0
	)
	const h = Math.max(
		root.clientHeight,
		vv?.height ?? 0,
		window.innerHeight || 0
	)
	return {
		w: Math.round(w),
		h: Math.round(h)
	}
}

function syncCameraAndVideoLayout() {
	const core = threeCore.value
	const video = videoRef.value
	const root = rootRef.value
	if (!core || !video || !root) return

	const { w, h } = getViewportSize(root)
	if (w <= 0 || h <= 0) return

	layoutMindArVideo(video, w, h)

	if (
		core.isMindArPoseLocked &&
		lastProjection &&
		core.camera instanceof PerspectiveCamera
	) {
		applyMindArProjectionToCamera(core.camera, lastProjection.matrix, {
			containerWidth: w,
			containerHeight: h,
			videoWidth: video.videoWidth || lastProjection.inputWidth,
			videoHeight: video.videoHeight || lastProjection.inputHeight,
			controllerInputWidth: lastProjection.inputWidth,
			controllerInputHeight: lastProjection.inputHeight
		})
	} else if (core.camera instanceof PerspectiveCamera) {
		core.camera.aspect = h > 0 ? w / h : 1
		core.camera.updateProjectionMatrix()
	}

	// 必须更新 canvas CSS，否则手机端 buffer 变了样式仍偏窄，右侧会留黑条
	core.renderer.setSize(w, h, true)
	const canvas = core.renderer.domElement
	canvas.style.width = `${w}px`
	canvas.style.height = `${h}px`
	canvas.style.display = 'block'
}

function markSceneReadyHidden() {
	const core = threeCore.value
	if (!core?.arContentGroup) {
		sceneLoaded.value = false
		sceneObjectCount.value = 0
		return
	}
	// 切换后强制复位 MindAR 视图，避免 step 镜头/旧矩阵导致内容不在视野内
	core.resetMindArViewForTracking?.()
	core.hideMindArContent()
	const fit = core.arContentGroup.getObjectByName('mindArContentFit')
	const orient = core.arContentGroup.getObjectByName('mindArOrient')
	sceneObjectCount.value =
		fit?.children.length ??
		orient?.children.length ??
		core.arContentGroup.children.length
	sceneLoaded.value =
		sceneObjectCount.value > 0 || core.arContentGroup.children.length > 0
	poseLockedFlag.value = false
	syncCameraAndVideoLayout()
}

async function bootMindArTracking(reuseCamera = false) {
	const video = videoRef.value
	const core = threeCore.value
	if (!video || !core?.isMindArMode) return

	markSceneReadyHidden()
	mindArBootError.value = ''
	const startFn = reuseCamera ? switchImageTarget : startMindAr
	try {
		await startFn({
			video,
			mindUrl: () => activeMindUrl.value,
			targetIndex: () => activeTargetIndex.value,
			reuseCamera,
			onReady: info => {
				lastProjection = {
					matrix: info.projectionMatrix,
					inputWidth: info.inputWidth,
					inputHeight: info.inputHeight
				}
				mindArReady.value = true
				if (!core.isMindArPoseLocked) {
					core.hideMindArContent()
				}
				syncCameraAndVideoLayout()
			},
			onMatrix: ({ worldMatrix, postMatrix }) => {
				const wasLocked = core.isMindArPoseLocked
				core.applyMindArPose(worldMatrix, postMatrix)
				poseLockedFlag.value = core.isMindArPoseLocked
				if (worldMatrix && !wasLocked) {
					syncCameraAndVideoLayout()
				}
			}
		})
		arPhase.value = 'tracking'
	} catch (e) {
		mindArBootError.value =
			e instanceof Error ? e.message : 'MindAR 追踪启动失败'
		markSceneReadyHidden()
		arPhase.value = 'matching'
	}
}

async function reRecognize() {
	if (switchingScene.value || arPhase.value === 'booting') return
	stopSceneMatch()
	await stopMindAr({ keepCamera: true })
	mindArReady.value = false
	poseLockedFlag.value = false
	lastProjection = null
	mindArBootError.value = ''
	matchPaused.value = false
	noHitTimedOut.value = false
	threeCore.value?.hideMindArContent()
	arPhase.value = 'matching'

	const video = videoRef.value
	if (!video) return
	try {
		await startCameraOnly(video)
	} catch (e) {
		mindArBootError.value =
			e instanceof Error ? e.message : '摄像头启动失败'
		return
	}
	syncCameraAndVideoLayout()
	startSceneMatch(video)
}

async function retryInit() {
	stopSceneMatch()
	await stopMindAr()
	mindArReady.value = false
	sceneLoaded.value = false
	poseLockedFlag.value = false
	mindArBootError.value = ''
	loadedArTarget.value = null
	lastProjection = null
	arPhase.value = 'booting'
	const el = sceneArRef.value
	if (!el) return
	disposeScene(el)
	await nextTick()
	await bootPage()
}

async function bootPage() {
	const sceneElement = sceneArRef.value
	const video = videoRef.value
	if (!sceneElement || !video) return

	arPhase.value = 'booting'
	await initScene(sceneElement, '0', {
		editMode: false,
		baseUrl: BASE_IMG_MODEL,
		enableAR: true,
		arMode: 'mindar',
		skipSceneLoad: true
	})
	await nextTick()
	syncCameraAndVideoLayout()

	try {
		await startCameraOnly(video)
	} catch (e) {
		mindArBootError.value =
			e instanceof Error ? e.message : '摄像头启动失败'
		return
	}
	syncCameraAndVideoLayout()
	arPhase.value = 'matching'
	startSceneMatch(video)
}

onMounted(async () => {
	uni = (await import('@dcloudio/uni-webview-js').catch(err => {
		console.error('Failed to load uni-webview-js:', err)
		return undefined
	})) as typeof uni

	await bootPage()

	resizeHandler = () => syncCameraAndVideoLayout()
	window.addEventListener('resize', resizeHandler)
	window.visualViewport?.addEventListener('resize', resizeHandler)
	window.visualViewport?.addEventListener('scroll', resizeHandler)
})

onUnmounted(() => {
	clearNoHitTimer()
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler)
		window.visualViewport?.removeEventListener('resize', resizeHandler)
		window.visualViewport?.removeEventListener('scroll', resizeHandler)
		resizeHandler = null
	}
	stopSceneMatch()
	void stopMindAr()
	disposeScene(sceneArRef.value || undefined)
})

const handleClickDiary = (e: MouseEvent, item: DiaryInterface) => {
	showDiary.value = true
	clickPosition.value = {
		x: e.clientX,
		y: e.clientY
	}
	activeDiary.value = item
}

const handleClickLibrary = (item: LibraryInterface) => {
	const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus')
	if (!item.library_id) return
	if (isInUniApp && uni?.navigateTo) {
		uni.navigateTo({
			url: `/pages/library/libraryDetail/libraryDetail?id=${item.library_id}`,
			fail: () => {
				console.log('跳转错误')
			}
		})
	} else if (port.value) {
		port.value.postMessage(
			JSON.stringify({
				type: 'jump',
				path: 'LibraryDetail',
				params: {
					id: item.library_id
				}
			})
		)
	} else {
		window.open(`/library/detail/${item.library_id}`, '_blank')
	}
}

const overlayHint = computed(() => {
	if (sceneLoading.value || switchingScene.value || arPhase.value === 'loading') {
		return '正在切换场景…'
	}
	if (matchPaused.value) {
		return '已暂停识别，可点击重新识别'
	}
	if (arPhase.value === 'matching') {
		return matchStatusText.value || statusText.value || '请对准识别图，正在匹配场景…'
	}
	if (mindArBootError.value || errorMsg.value) {
		const err = mindArBootError.value || errorMsg.value
		if (sceneLoaded.value) {
			return `场景已就绪（${sceneObjectCount.value} 物体，待识别显示）· 追踪异常：${err}`
		}
		return err
	}
	if (sceneVisible.value) {
		return '目标已锁定 · 场景已锚定到识别图'
	}
	if (sceneLoaded.value) {
		const trackHint = mindArReady.value
			? statusText.value || '请对准识别图'
			: isRunning.value
				? statusText.value || '正在启动追踪...'
				: '追踪未启动'
		return `场景已加载（${sceneObjectCount.value} 物体）· 识别成功后显示 · ${trackHint}`
	}
	return statusText.value || '正在准备…'
})

const showScanFrame = computed(
	() =>
		!sceneLoading.value &&
		!sceneLoadError.value &&
		!isTracking.value &&
		(arPhase.value === 'matching' || arPhase.value === 'tracking')
)

useHead({
	title: 'AR 扫图匹配',
	meta: [
		{
			name: 'viewport',
			content:
				'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
		}
	]
})

definePageMeta({
	layout: false
})
</script>

<template>
	<div
		ref="rootRef"
		class="ar-scan-root fixed inset-0 z-0 touch-callout-none select-none overflow-hidden bg-black"
	>
		<video
			ref="videoRef"
			class="pointer-events-none absolute left-0 top-0 z-0 min-h-full min-w-full"
			autoplay
			muted
			playsinline
			webkit-playsinline
		/>

		<div
			v-if="sceneLoading || sceneLoadError || arPhase === 'booting' || switchingScene"
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
		>
			<template v-if="(sceneLoading || switchingScene || arPhase === 'booting') && !sceneLoadError">
				<div
					class="h-16 w-16 animate-spin rounded-full border-4 border-purple-400 border-t-transparent"
				/>
				<p class="mt-4 font-bold tracking-widest text-purple-600">
					<span v-if="switchingScene || arPhase === 'loading'">
						正在切换场景...
						<template v-if="sceneLoadProgress.total > 0">
							{{ sceneLoadProgress.current }} /
							{{ sceneLoadProgress.total }}
						</template>
					</span>
					<span v-else-if="sceneLoadProgress.total > 0">
						正在加载场景... {{ sceneLoadProgress.current }} /
						{{ sceneLoadProgress.total }}
					</span>
					<span v-else>正在初始化...</span>
				</p>
			</template>

			<template v-else-if="sceneLoadError">
				<div class="flex flex-col items-center gap-4">
					<UIcon
						name="material-symbols:error-outline"
						class="text-6xl text-red-500"
					/>
					<p class="text-lg font-bold text-red-600">加载失败</p>
					<p class="max-w-md px-4 text-center text-sm text-gray-600">
						{{ sceneLoadError }}
					</p>
					<UButton color="purple" class="mt-2" @click="retryInit">
						重试
					</UButton>
				</div>
			</template>
		</div>

		<div
			id="scene-ar-scan"
			ref="sceneArRef"
			class="absolute inset-0 z-10 bg-transparent"
		/>

		<template v-if="sceneVisible">
			<div
				v-for="diary in diaryList"
				:key="diary.id"
				class="fixed z-20 flex h-[60px] cursor-pointer items-center overflow-hidden whitespace-nowrap rounded-[30px] bg-white/80 p-3 shadow-lg backdrop-blur-sm"
				:style="{
					left: (diary.position?.x ?? 0) + 'px',
					top: (diary.position?.y ?? 0) - 30 + 'px'
				}"
				@click.stop="handleClickDiary($event, diary)"
			>
				{{ diary.title }}
			</div>

			<div
				v-for="library in libraryList"
				:key="library.id"
				class="fixed z-20 flex h-[60px] cursor-pointer items-center overflow-hidden whitespace-nowrap rounded-[30px] bg-white/80 shadow-lg backdrop-blur-sm"
				:style="{
					left: (library.position?.x ?? 0) + 'px',
					top: (library.position?.y ?? 0) - 30 + 'px'
				}"
				@click.stop="handleClickLibrary(library)"
			>
				<div class="flex items-center">
					<img
						:src="`${BASE_IMG}${library.cover}`"
						class="my-2 h-16 w-16 cursor-pointer rounded-[60px] border border-gray-200 object-cover"
						loading="lazy"
					/>
					<div class="p-2">{{ library.title }}</div>
				</div>
			</div>
		</template>

		<QhxModal v-model="showDiary" :trigger-position="clickPosition">
			<div
				class="max-h-[50vh] w-[300px] overflow-y-auto rounded-[10px] bg-white p-6 md:w-[400px]"
			>
				<div class="mb-2 font-bold">{{ activeDiary?.title }}</div>
				<div class="text-sm text-gray-600">{{ activeDiary?.content }}</div>
			</div>
		</QhxModal>

		<div
			class="pointer-events-auto fixed left-2 right-2 top-3 z-[9999] max-h-[48vh] overflow-hidden rounded-xl border border-white/25 bg-black/80 text-left text-white shadow-2xl backdrop-blur-md sm:left-3 sm:right-auto sm:w-[min(420px,92vw)]"
		>
			<div class="flex items-center justify-between gap-2 border-b border-white/15 px-3 py-2">
				<div class="min-w-0">
					<div class="text-xs font-semibold tracking-wide text-emerald-300">
						AR 扫图匹配
					</div>
					<div class="truncate text-[11px] text-white/80">
						{{ overlayHint || '—' }}
					</div>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
					@click="debugPanelOpen = !debugPanelOpen"
				>
					{{ debugPanelOpen ? '收起' : '展开' }}
				</button>
			</div>

			<div v-show="debugPanelOpen" class="max-h-[40vh] overflow-y-auto px-3 py-2">
				<div
					v-if="errorBanner"
					class="mb-2 whitespace-pre-wrap break-all rounded-lg bg-red-600/85 px-2 py-1.5 text-[11px] leading-snug text-white"
				>
					{{ errorBanner }}
				</div>

				<div class="grid grid-cols-[88px_1fr] gap-x-2 gap-y-0.5 text-[11px] leading-snug">
					<template v-for="row in debugRows" :key="row.k">
						<div class="text-white/50">{{ row.k }}</div>
						<div class="break-all text-white/95">{{ row.v }}</div>
					</template>
				</div>

				<div class="mt-2 border-t border-white/15 pt-2">
					<div class="mb-1 text-[11px] font-medium text-amber-200">事件日志</div>
					<div
						v-if="logLines.length === 0"
						class="text-[11px] text-white/40"
					>
						暂无日志
					</div>
					<ul class="space-y-0.5 font-mono text-[10px] leading-snug text-white/85">
						<li
							v-for="(line, i) in logLines"
							:key="i"
							class="break-all"
						>
							{{ line }}
						</li>
					</ul>
				</div>
			</div>
		</div>

		<div
			v-if="!sceneLoading && !sceneLoadError && arPhase !== 'booting'"
			class="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
		>
			<div
				v-if="showScanFrame"
				class="scan-box relative h-64 w-64 rounded-lg border-2 border-white/50"
				:class="sceneLoaded ? 'scan-box--light animate-pulse' : 'scan-box--dim animate-pulse'"
			>
				<div class="absolute left-0 top-0 h-4 w-4 border-l-4 border-t-4 border-white" />
				<div class="absolute right-0 top-0 h-4 w-4 border-r-4 border-t-4 border-white" />
				<div
					class="absolute bottom-0 left-0 h-4 w-4 border-b-4 border-l-4 border-white"
				/>
				<div
					class="absolute bottom-0 right-0 h-4 w-4 border-b-4 border-r-4 border-white"
				/>
			</div>

			<p
				v-if="arPhase === 'matching'"
				class="mt-4 max-w-[80vw] text-center text-sm font-medium text-white drop-shadow"
			>
				{{
					matchPaused
						? '已暂停识别'
						: matchStatusText || '请对准识别图，正在匹配场景…'
				}}
			</p>

			<div
				v-if="showPauseBtn || showReRecognizeBtn"
				class="pointer-events-auto mt-4 flex flex-col items-center gap-2"
			>
				<button
					v-if="showPauseBtn"
					type="button"
					class="rounded-full border border-white/30 bg-black/65 px-5 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-md hover:bg-black/80 disabled:opacity-50"
					:disabled="switchingScene"
					@click="pauseRecognize"
				>
					暂停识别
				</button>
				<button
					v-if="showReRecognizeBtn"
					type="button"
					class="rounded-full border border-white/30 bg-black/65 px-5 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-md hover:bg-black/80 disabled:opacity-50"
					:disabled="switchingScene || arPhase === 'loading'"
					@click="reRecognize"
				>
					重新识别
				</button>
			</div>

			<a
				v-if="showScanFrame && previewImageUrl && arPhase === 'tracking'"
				:href="previewImageUrl"
				target="_blank"
				rel="noopener"
				class="pointer-events-auto absolute bottom-6 right-3 overflow-hidden rounded-lg border-2 border-amber-300/80 bg-black/50 shadow-lg"
			>
				<img
					:src="previewImageUrl"
					alt="请对准此识别图"
					class="h-28 w-40 object-contain bg-white"
				/>
				<div class="px-2 py-1 text-[10px] font-medium text-amber-100">
					{{ usingSceneArTarget ? '对准此识别图' : '对准此图（默认兜底）' }}
				</div>
			</a>
		</div>
	</div>
</template>

<style scoped>
.ar-scan-root {
	/* 由 fixed inset-0 贴齐视口；禁止横向溢出露出黑缝 */
	overflow-x: hidden;
}

.scan-box--dim {
	box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
}

.scan-box--light {
	box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.12);
}

:deep(canvas) {
	display: block;
	outline: none;
	background: transparent !important;
	max-width: none !important;
}
</style>
