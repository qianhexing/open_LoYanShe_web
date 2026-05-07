<template>
  <ClientOnly>
    <div class="relative overflow-hidden" style="height: 100vh; width: 100vw">
      <a-scene
        mindar-image="imageTargetSrc: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind;"
        color-space="sRGB"
        renderer="colorManagement: true, physicallyCorrectLights"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        embedded
        style="width: 100%; height: 100%"
      >
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <a-entity id="mindar-scene-mount" mindar-image-target="targetIndex: 0"></a-entity>
      </a-scene>

      <div class="pointer-events-none absolute left-0 top-4 z-50 w-full text-center">
        <div class="inline-block rounded bg-black/50 px-4 py-2 text-sm text-white">
          识别图锚点示例：仅挂载自定义球（与 scene/detail/test 一致逻辑）
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
	waitForASceneLoaded,
	waitForMindarAnchorReady
} from '@/utils/ar/aframeMindarScene'

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
			content: 'width=device-width, initial-scale=1, user-scalable=no'
		}
	]
})

async function mountSphere() {
	try {
		const sceneEl = await waitForASceneLoaded(SCENE_LOAD_TIMEOUT_MS)
		if (!sceneEl) {
			showMindArAlert(
				[`a-scene 在约 ${SCENE_LOAD_TIMEOUT_MS / 1000}s 内未完成 loaded：`, '- 请刷新页面或检查网络 / 脚本拦截', '- 打开开发者工具 → Network / Console 排查'].join(
					'\n'
				),
				{ title: 'MindAR · 场景未就绪', kind: 'error' }
			)
			return
		}
		const anchor = await waitForMindarAnchorReady(
			'#mindar-scene-mount',
			ANCHOR_READY_TIMEOUT_MS
		)
		if (!anchor) {
			showMindArAlert(
				[`未检测到可挂载的 #mindar-scene-mount（带 setObject3D）。超时约 ${ANCHOR_READY_TIMEOUT_MS / 1000}s。`, '- 确认 MindAR 脚本已成功加载', '- 查看 Console 是否有 JS 报错'].join(
					'\n'
				),
				{ title: 'MindAR · 锚点未就绪', kind: 'error' }
			)
			return
		}
		const result = attachCustomSphereToMindarMount(anchor, {
			radius: 0.1,
			color: 0x66ccff,
			position: [0, 0.06, 0.15]
		})
		if (!result.ok) {
			showMindArAlert(result.error, {
				title: 'MindAR · 挂载失败',
				kind: 'error'
			})
		}
	} catch (e: unknown) {
		const detail =
			e instanceof Error ? (e.stack || e.message) : String(e)
		showMindArAlert(`挂载过程出现异常：\n\n${detail}`, {
			title: 'MindAR · 异常',
			kind: 'error'
		})
	}
}

onMounted(() => {
	void mountSphere()
})
</script>

<style scoped>
:deep(video) {
	z-index: 1 !important;
}
:deep(.a-canvas) {
	z-index: 2 !important;
}
</style>
