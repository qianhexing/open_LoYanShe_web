<script setup lang="ts">
import { useSceneCore } from '@/composables/useSceneCore'
import { useMindArPose } from '@/composables/useMindArPose'
import { getSceneId } from '@/api/scene'
import { getARConfig, DEFAULT_IMAGE_TARGET } from '@/utils/ar/config'
import {
	hasSceneArTarget,
	normalizeSceneArTarget,
	pickArTargetFromSceneJson,
	resolveSceneArAssetUrl
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
const id = route.params.id as string
const sceneIdNum = computed(() => Number.parseInt(id, 10) || 1)
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
/** 场景已加载（识别成功前隐藏） */
const sceneLoaded = ref(false)
const sceneObjectCount = ref(0)
/**
 * 必须用独立 ref：threeCore.arTarget 是 class 普通字段，
 * Vue computed 不会在 loadSceneFromJSON 赋值后失效重算，会一直落到「默认兜底」。
 */
const loadedArTarget = ref<SceneArTargetJSON | null>(null)

const {
	threeCore,
	sceneLoading,
	sceneLoadProgress,
	sceneLoadError,
	diaryList,
	libraryList,
	initScene,
	disposeScene
} = useSceneCore()

function syncLoadedArTarget(sceneData?: { json_data?: unknown } | null) {
	// 优先用刚拉到的 API 数据，避免依赖 class 字段的 Vue 追踪
	const fromApi = pickArTargetFromSceneJson(sceneData?.json_data)
	const fromCore = normalizeSceneArTarget(threeCore.value?.arTarget)
	const next = fromApi || fromCore
	loadedArTarget.value = next
	if (threeCore.value && next) {
		threeCore.value.arTarget = next
	}
	return next
}

/** 优先场景 json_data.arTarget，否则兜底默认 Card */
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
	start: startMindAr,
	stop: stopMindAr
} = useMindArPose()

const poseLockedFlag = ref(false)
const debugPanelOpen = ref(true)
/** 识别成功后才显示场景 */
const sceneVisible = computed(() => isTracking.value || poseLockedFlag.value)

const debugRows = computed(() => [
	{ k: '场景 ID', v: String(sceneIdNum.value) },
	{ k: '识别图来源', v: usingSceneArTarget.value ? '场景 JSON' : '默认兜底' },
	{
		k: 'arTarget',
		v: loadedArTarget.value
			? `${loadedArTarget.value.mindUrl}`
			: '(空)'
	},
	{ k: 'mind probe', v: mindProbeText.value },
	{ k: '场景加载', v: sceneLoading.value ? `进行中 ${sceneLoadProgress.value.current}/${sceneLoadProgress.value.total}` : sceneLoadError.value ? `失败` : '完成' },
	{ k: '场景物体', v: String(sceneObjectCount.value) },
	{ k: '场景已加载', v: sceneLoaded.value ? '是' : '否' },
	{ k: '场景可见', v: sceneVisible.value ? '是（已识别）' : '否（等待识别）' },
	{ k: '位姿锁定', v: poseLockedFlag.value ? '是' : '否' },
	{ k: 'MindAR status', v: `${status.value}` },
	{ k: 'statusText', v: statusText.value || '-' },
	{ k: 'isRunning', v: String(isRunning.value) },
	{ k: 'isTracking', v: String(isTracking.value) },
	{ k: 'mindReady', v: String(mindArReady.value) },
	{ k: 'video', v: videoSizeText.value },
	{ k: 'video.attr', v: videoRef.value ? `${videoRef.value.width}×${videoRef.value.height}` : '-' },
	{ k: 'input', v: inputSizeText.value },
	{ k: 'marker', v: markerDimsText.value },
	{ k: 'targetIndex', v: String(targetIndexVal.value) },
	{ k: 'processDone', v: String(processDoneCount.value) },
	{ k: 'matrixUpdate', v: String(matrixUpdateCount.value) },
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
		sceneLoadError.value
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

function syncCameraAndVideoLayout() {
	const core = threeCore.value
	const video = videoRef.value
	const root = rootRef.value
	if (!core || !video || !root) return

	const w = root.clientWidth
	const h = root.clientHeight
	layoutMindArVideo(video, w, h)

	// 仅在位姿锁定后使用 MindAR 投影；预览阶段保持 near 较小，避免场景被裁掉
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

	core.renderer.setSize(w, h, false)
}

function markSceneReadyHidden() {
	const core = threeCore.value
	if (!core?.arContentGroup) {
		sceneLoaded.value = false
		sceneObjectCount.value = 0
		return
	}
	core.hideMindArContent()
	const fit = core.arContentGroup.getObjectByName('mindArContentFit')
	sceneObjectCount.value =
		fit?.children.length ?? core.arContentGroup.children.length
	sceneLoaded.value =
		sceneObjectCount.value > 0 || core.arContentGroup.children.length > 0
	poseLockedFlag.value = false
	syncCameraAndVideoLayout()
}

async function bootMindArTracking() {
	const video = videoRef.value
	const core = threeCore.value
	if (!video || !core?.isMindArMode) return

	// 场景已加载但先隐藏，等识别成功再显示
	markSceneReadyHidden()

	mindArBootError.value = ''
	try {
		await startMindAr({
			video,
			mindUrl: () => activeMindUrl.value,
			targetIndex: () => activeTargetIndex.value,
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
	} catch (e) {
		mindArBootError.value =
			e instanceof Error ? e.message : 'MindAR 追踪启动失败'
		markSceneReadyHidden()
	}
}

async function loadFreshSceneData() {
	const sid = Number.parseInt(id, 10)
	if (!Number.isFinite(sid) || sid <= 0) return null
	try {
		clearNuxtData(`studyDeatil-${id}`)
		return await getSceneId({ sence_id: sid })
	} catch (e) {
		console.warn('[AR] 刷新场景失败，回退 initScene 内加载', e)
		return null
	}
}

async function retryInit() {
	await stopMindAr()
	mindArReady.value = false
	sceneLoaded.value = false
	poseLockedFlag.value = false
	mindArBootError.value = ''
	loadedArTarget.value = null
	lastProjection = null
	const el = sceneArRef.value
	if (!el) return
	const sceneData = await loadFreshSceneData()
	await initScene(el, id, {
		editMode: false,
		baseUrl: BASE_IMG_MODEL,
		enableAR: true,
		arMode: 'mindar',
		...(sceneData ? { sceneData } : {})
	})
	await nextTick()
	const ar = syncLoadedArTarget(sceneData)
	if (!hasSceneArTarget(ar)) {
		mindArBootError.value =
			'当前场景未配置识别图（json_data.arTarget），将使用默认识别图；请在场景「更多 → 添加识别图」后重试'
	}
	markSceneReadyHidden()
	await bootMindArTracking()
}

onMounted(async () => {
	uni = await import('@dcloudio/uni-webview-js').catch(err => {
		console.error('Failed to load uni-webview-js:', err)
		return undefined
	}) as typeof uni

	const sceneElement = sceneArRef.value
	if (!sceneElement) return

	const sceneData = await loadFreshSceneData()

	await initScene(sceneElement, id, {
		editMode: false,
		baseUrl: BASE_IMG_MODEL,
		enableAR: true,
		arMode: 'mindar',
		...(sceneData ? { sceneData } : {})
	})

	await nextTick()
	const ar = syncLoadedArTarget(sceneData)
	if (!hasSceneArTarget(ar)) {
		mindArBootError.value =
			'当前场景未配置识别图（json_data.arTarget），将使用默认识别图；请在场景「更多 → 添加识别图」后重试'
	}
	markSceneReadyHidden()
	await bootMindArTracking()

	resizeHandler = () => syncCameraAndVideoLayout()
	window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler)
		resizeHandler = null
	}
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
	if (sceneLoading.value) return ''
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
	return statusText.value || '正在准备场景...'
})

const showScanFrame = computed(
	() => !sceneLoading.value && !sceneLoadError.value && !isTracking.value
)

useHead({
	title: 'AR场景 · 识别图追踪',
	meta: [
		{
			name: 'viewport',
			content: 'width=device-width, initial-scale=1, user-scalable=no'
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
		class="relative h-screen w-full touch-callout-none select-none overflow-hidden bg-black"
	>
		<video
			ref="videoRef"
			class="pointer-events-none absolute left-0 top-0 z-0"
			autoplay
			muted
			playsinline
			webkit-playsinline
		/>

		<div
			v-if="sceneLoading || sceneLoadError"
			class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
		>
			<template v-if="sceneLoading && !sceneLoadError">
				<div
					class="h-16 w-16 animate-spin rounded-full border-4 border-purple-400 border-t-transparent"
				/>
				<p class="mt-4 font-bold tracking-widest text-purple-600">
					<span v-if="sceneLoadProgress.total > 0">
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
			id="scene-ar"
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

		<!-- 最顶层实时追踪调试面板 -->
		<div
			class="pointer-events-auto fixed left-2 right-2 top-2 z-[9999] max-h-[48vh] overflow-hidden rounded-xl border border-white/25 bg-black/80 text-left text-white shadow-2xl backdrop-blur-md sm:left-3 sm:right-auto sm:w-[min(420px,92vw)]"
		>
			<div class="flex items-center justify-between gap-2 border-b border-white/15 px-3 py-2">
				<div class="min-w-0">
					<div class="text-xs font-semibold tracking-wide text-emerald-300">
						MindAR 实时追踪
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
			v-if="!sceneLoading && !sceneLoadError"
			class="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
		>
			<!-- 预览阶段弱化遮罩，避免盖住场景 -->
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

			<a
				v-if="showScanFrame && previewImageUrl"
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
.scan-box--dim {
	box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
}

.scan-box--light {
	box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.12);
}

:deep(canvas) {
	outline: none;
	background: transparent !important;
}
</style>
