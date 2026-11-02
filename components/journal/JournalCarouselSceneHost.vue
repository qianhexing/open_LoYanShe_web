<!--
  手账轮播专用：父级常驻单 WebGL 宿主。
  切场景对齐 pages/ar/scan.vue：互斥串行，只走 reloadSceneKeepWebGL（内部 clear + rAF + load），
  不额外 clear、不每轮重建 AAA/IBL。退出轮播才 dispose。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { getSceneId } from '@/api/scene'
import { useSceneCore } from '@/composables/useSceneCore'
import type { JournalCarouselSceneLayout } from '@/components/journal/carousel/sceneHostTypes'
import { BASE_IMG_MODEL } from '@/utils/ipConfig'
import {
  loadSceneGraphicsSettings,
  resolveRendererPixelRatio
} from '@/utils/sceneGraphicsSettings'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    interactive?: boolean
    layout?: JournalCarouselSceneLayout | null
  }>(),
  {
    visible: false,
    interactive: false,
    layout: null
  }
)

const mountRef = ref<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const bootError = ref<string | null>(null)

const {
  threeCore,
  sceneLoading,
  sceneLoadError,
  initScene,
  reloadSceneKeepWebGL,
  disposeScene
} = useSceneCore()

let inited = false
let initPromise: Promise<void> | null = null
let loadedSceneId: number | null = null

/** 与 scan.vue switchingScene 相同：切场景互斥，进行中忽略并发入口、队列只保留最新意图 */
const switchingScene = ref(false)
type SceneJob = { kind: 'load'; id: number } | { kind: 'clear' }
let queuedJob: SceneJob | null = null

const layoutStyle = computed(() => {
  const l = props.layout
  if (!l) {
    return {
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      opacity: '0',
      pointerEvents: 'none' as const
    }
  }
  return {
    top: `${l.top}px`,
    left: `${l.left}px`,
    width: `${l.width}px`,
    height: `${l.height}px`,
    opacity: props.visible ? '1' : '0',
    pointerEvents: props.interactive && props.visible ? ('auto' as const) : ('none' as const)
  }
})

function setControlsEnabled(on: boolean) {
  const controls = threeCore.value?.controls
  if (controls && 'enabled' in controls) {
    controls.enabled = on
  }
}

function requestResize() {
  if (!import.meta.client) return
  requestAnimationFrame(() => {
    threeCore.value?.onContainerResize?.()
  })
}

async function ensureInit() {
  if (!import.meta.client) return
  if (inited && threeCore.value) return
  if (initPromise) {
    await initPromise
    return
  }
  initPromise = (async () => {
    await nextTick()
    const el = mountRef.value
    if (!el) throw new Error('场景挂载节点未就绪')
    bootError.value = null
    const gfx = loadSceneGraphicsSettings()
    // 对齐 scan.vue bootPage：只起渲染器，skipSceneLoad，不在空壳上套 AAA/IBL
    await initScene(el, '0', {
      editMode: false,
      baseUrl: BASE_IMG_MODEL,
      sceneData: null,
      skipSceneLoad: true,
      preferWebGPU: false,
      colorStyle: 'pbr',
      graphicsSettings: {
        antialias: gfx.antialias,
        pixelRatio: resolveRendererPixelRatio(gfx),
        mobilePerfCap: gfx.mobilePerfCap
      }
    })
    setControlsEnabled(false)
    inited = true
    requestResize()
  })()
  try {
    await initPromise
  } catch (e) {
    bootError.value = e instanceof Error ? e.message : '场景初始化失败'
    inited = false
    throw e
  } finally {
    initPromise = null
  }
}

function hasNewerJob() {
  return queuedJob != null
}

/** 对齐 applyMatchedScene：先拉数据，再单次 reloadSceneKeepWebGL */
async function runLoadLikeScan(sceneId: number) {
  await ensureInit()
  if (hasNewerJob()) return

  if (loadedSceneId === sceneId && threeCore.value) {
    setControlsEnabled(props.interactive)
    requestResize()
    return
  }

  clearNuxtData(`studyDeatil-${sceneId}`)
  const sceneData = await getSceneId({ sence_id: sceneId })
  if (hasNewerJob()) return

  await reloadSceneKeepWebGL(String(sceneId), {
    sceneData,
    baseUrl: BASE_IMG_MODEL
  })
  await nextTick()
  loadedSceneId = sceneId
  if (hasNewerJob()) return

  const core = threeCore.value
  if (core?.controls) {
    core.controls.enabled = props.interactive
  }
  if (core?.cameraList?.length) {
    core.lookAtCameraState(core.cameraList[0])
  }
  requestResize()
}

/** 仅在空闲卸内容时走：clear + 等一帧，绝不与 load 并行 */
async function runClearLikeScan() {
  const core = threeCore.value
  if (!core || loadedSceneId == null) {
    setControlsEnabled(false)
    return
  }
  core.clearSceneContent()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  loadedSceneId = null
  setControlsEnabled(false)
}

async function pumpSceneSwitch() {
  if (switchingScene.value) return
  switchingScene.value = true
  try {
    while (queuedJob) {
      const job = queuedJob
      queuedJob = null
      if (job.kind === 'load') {
        await runLoadLikeScan(job.id)
      } else {
        await runClearLikeScan()
      }
    }
  } catch (e) {
    console.warn('[journal-scene-host] switch failed:', e)
  } finally {
    switchingScene.value = false
    if (queuedJob) void pumpSceneSwitch()
  }
}

async function load(sceneId: number) {
  queuedJob = { kind: 'load', id: sceneId }
  await pumpSceneSwitch()
}

async function clear() {
  queuedJob = { kind: 'clear' }
  await pumpSceneSwitch()
}

function dispose() {
  queuedJob = null
  loadedSceneId = null
  inited = false
  initPromise = null
  disposeScene(mountRef.value || undefined)
}

watch(
  () => [props.layout?.width, props.layout?.height, props.visible] as const,
  () => {
    if (props.visible) requestResize()
  }
)

watch(
  () => props.interactive,
  (on) => {
    if (loadedSceneId != null && !switchingScene.value) setControlsEnabled(on)
  }
)

onMounted(() => {
  void ensureInit().catch((e) => {
    console.warn('[journal-scene-host] init:', e)
  })
})

onUnmounted(() => {
  dispose()
})

defineExpose({
  ensureInit,
  load,
  clear,
  dispose,
  requestResize,
  get loadedSceneId() {
    return loadedSceneId
  }
})
</script>

<template>
  <div
    ref="rootRef"
    class="journal-carousel-scene-host absolute z-[5] overflow-hidden rounded-xl"
    :class="{ 'journal-carousel-scene-host--on': visible }"
    :style="layoutStyle"
    aria-hidden="true"
  >
    <div
      ref="mountRef"
      class="journal-carousel-scene-host__mount absolute inset-0 h-full w-full"
    />
    <div
      v-if="sceneLoading || bootError || sceneLoadError"
      class="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/25 text-xs text-white"
    >
      <span v-if="bootError || sceneLoadError">{{ bootError || sceneLoadError }}</span>
      <span v-else>场景加载中…</span>
    </div>
  </div>
</template>

<style scoped>
.journal-carousel-scene-host {
  background: rgba(0, 0, 0, 0.04);
}

.journal-carousel-scene-host--on {
  box-shadow: inset 0 0 0 1px rgba(120, 95, 70, 0.12);
}

.journal-carousel-scene-host__mount :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
