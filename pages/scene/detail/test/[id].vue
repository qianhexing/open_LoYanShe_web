<template>
  <ClientOnly>
    <div class="ar-test-viewport-fixed overflow-hidden bg-black">
      <a-scene
        :mindar-image="mindarImageAttrString"
        color-space="sRGB"
        renderer="colorManagement: true, physicallyCorrectLights"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        embedded
        class="scene-aframe h-full w-full"
      >
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <a-entity
          id="mindar-scene-mount"
          :mindar-image-target="mindarTargetAttrString"
        ></a-entity>
      </a-scene>

      <div
        class="pointer-events-none absolute inset-x-0 top-safe z-[60] max-w-[min(92vw,20rem)] self-center px-3 text-center text-[11px] leading-snug text-white/95"
      >
        <div class="rounded bg-black/55 px-3 py-2">
          对准与你的 <span class="font-semibold">.mind</span> 对应的识别图；当前仅在锚点上挂
          <span class="font-semibold">占位球</span>。
        </div>
      </div>
    </div>

    <MindArErrorModal
      v-model="dlgOpen"
      :title="dlgTitle"
      :message="dlgMessage"
      :kind="dlgKind"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
import { useMindArErrorModal } from '@/composables/useMindArErrorModal'
import {
	attachCustomSphereToMindarMount,
	buildMindarImageAttr,
	buildMindarImageTargetAttr,
	waitForASceneLoaded,
	waitForMindarAnchorReady
} from '@/utils/ar/aframeMindarScene'
import { DEFAULT_IMAGE_TARGET } from '@/utils/ar/config'

const SCENE_LOAD_TIMEOUT_MS = 10000
const ANCHOR_READY_TIMEOUT_MS = 15000

const {
	dlgOpen,
	dlgTitle,
	dlgMessage,
	dlgKind,
	showMindArAlert
} = useMindArErrorModal()

definePageMeta({
	layout: false
})

useHead({
	script: [
		{
			src: 'https://aframe.io/releases/1.6.0/aframe.min.js',
			crossorigin: 'anonymous'
		},
		{
			src: 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js',
			crossorigin: 'anonymous'
		}
	],
	meta: [
		{
			name: 'viewport',
			content:
				'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
		}
	],
	title: 'MindAR · 占位球'
})

/** 占位球（MeshBasic）；需同时挂 GLB 时请改用 `attachMindarSphereAndExtras`（见 utils/ar/aframeMindarScene） */
const customSphere = {
	radius: 0.12,
	color: 0xff3355 as number | string,
	position: [0, 0.06, 0.16] as const
}

const mindarImageAttrString = computed(() =>
	buildMindarImageAttr(DEFAULT_IMAGE_TARGET.mindUrl)
)
const mindarTargetAttrString = computed(() =>
	buildMindarImageTargetAttr(DEFAULT_IMAGE_TARGET.targetIndex)
)

function applyArViewportHeight() {
	if (typeof window === 'undefined') return
	const h = window.visualViewport?.height ?? window.innerHeight
	document.documentElement.style.setProperty('--ar-vh', `${h}px`)
}

function resizeMindarEmbedded(sceneEl?: HTMLElement | null) {
	queueMicrotask(() => {
		const el =
			sceneEl ?? (document.querySelector('a-scene') as HTMLElement | null)
		if (!el) return
		;(el as HTMLElement & { resize?: () => void }).resize?.()
	})
}

let resizeRaf = 0
function onWindowResizeMindar() {
	applyArViewportHeight()
	if (resizeRaf) cancelAnimationFrame(resizeRaf)
	resizeRaf = requestAnimationFrame(() => {
		resizeRaf = 0
		resizeMindarEmbedded()
	})
}

async function mountSphereOnly() {
	try {
		await nextTick()
		const sceneEl = await waitForASceneLoaded(SCENE_LOAD_TIMEOUT_MS)
		if (!sceneEl) {
			showMindArAlert(
				[
					`a-scene 在约 ${SCENE_LOAD_TIMEOUT_MS / 1000}s 内未完成 loaded：`,
					'- 请刷新页面或检查网络 / 脚本是否被拦截'
				].join('\n'),
				{ title: 'MindAR · 场景未就绪', kind: 'error' }
			)
			return
		}
		await nextTick()

		const anchor = await waitForMindarAnchorReady(
			'#mindar-scene-mount',
			ANCHOR_READY_TIMEOUT_MS
		)
		if (!anchor) {
			showMindArAlert(
				[
					`MindAR 锚点 #mindar-scene-mount 未就绪（超时约 ${ANCHOR_READY_TIMEOUT_MS / 1000}s）。`,
					'- 确认 mind-ar / aframe 已成功加载并在 Console 查看报错'
				].join('\n'),
				{ title: 'MindAR · 锚点未就绪', kind: 'error' }
			)
			return
		}

		resizeMindarEmbedded(sceneEl)

		const result = attachCustomSphereToMindarMount(anchor, customSphere)

		if (!result.ok) {
			showMindArAlert(result.error, {
				title: 'MindAR · 挂载失败',
				kind: 'error'
			})
			return
		}

		requestAnimationFrame(() => {
			resizeMindarEmbedded(document.querySelector('a-scene') as HTMLElement)
		})
		anchor.addEventListener(
			'targetfound',
			() =>
				resizeMindarEmbedded(document.querySelector('a-scene') as HTMLElement),
			{ once: true }
		)
	} catch (e: unknown) {
		const detail =
			e instanceof Error ? (e.stack || e.message) : String(e)
		showMindArAlert(`挂载过程出现异常：\n\n${detail}`, {
			title: 'MindAR · 异常',
			kind: 'error'
		})
	}
}

onMounted(async () => {
	document.documentElement.classList.add('ar-test-mind-root')
	applyArViewportHeight()
	window.addEventListener('resize', onWindowResizeMindar, { passive: true })
	onWindowResizeMindar()
	window.visualViewport?.addEventListener('resize', onWindowResizeMindar, {
		passive: true
	})
	await mountSphereOnly()
})

onUnmounted(() => {
	document.documentElement.classList.remove('ar-test-mind-root')
	window.removeEventListener('resize', onWindowResizeMindar)
	window.visualViewport?.removeEventListener('resize', onWindowResizeMindar)
	if (resizeRaf) cancelAnimationFrame(resizeRaf)
})
</script>

<style scoped>
.ar-test-viewport-fixed {
	position: fixed;
	inset: 0;
	z-index: 1;
	box-sizing: border-box;
	width: 100%;
	max-width: 100vw;
	height: var(--ar-vh, 100svh);
	min-height: var(--ar-vh, 100%);
}

.top-safe {
	top: env(safe-area-inset-top, 0px);
	padding-top: max(0.75rem, env(safe-area-inset-top, 12px));
}

.scene-aframe {
	display: block !important;
	width: 100% !important;
	height: 100% !important;
	min-height: inherit;
}

:deep(a-scene.scene-aframe) {
	display: block !important;
	box-sizing: border-box;
	width: 100% !important;
	min-height: 100% !important;
	height: 100% !important;
}

:deep(video) {
	position: absolute;
	inset: 0;
	z-index: 1 !important;
	width: 100% !important;
	height: 100% !important;
	object-fit: cover;
}

:deep(.a-canvas) {
	position: absolute;
	inset: 0;
	z-index: 2 !important;
	width: 100% !important;
	height: 100% !important;
}
</style>

<style>
html.ar-test-mind-root,
html.ar-test-mind-root body {
	margin: 0;
	padding: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

html.ar-test-mind-root body {
	box-sizing: border-box;
	min-height: 100%;
	min-height: 100vh;
	min-height: 100dvh;
}

@media (max-height: 1000px) {
	html.ar-test-mind-root body {
		min-height: -webkit-fill-available;
	}
}
</style>
