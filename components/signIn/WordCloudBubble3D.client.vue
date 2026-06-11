<script setup lang="ts">
import {
  WordCloudBubble3D,
  buildFlowerMetaKey,
  type WordCloudDatum,
  type GardenSceneData,
  type WordCloudBubble3DOptions,
} from '@/utils/wordCloudBubble3d'
import { getMaxGardenFlowerCount } from '@/utils/gardenPlants'

export type { WordCloudDatum }

const props = withDefaults(
  defineProps<{
    chartData?: WordCloudDatum[]
    /** 今日评论数，1 条 = 1 株植物 */
    flowerCount?: number
    /** 与评论顺序对齐的 GARDEN_PLANT_MODELS.id */
    flowerTypes?: string[]
    /** 与评论顺序对齐的 comment_id */
    flowerCommentIds?: number[]
    /** GARDEN_PLANT_MODELS 下标，不传则多种植物轮播 */
    plantTypeIndex?: number
    height?: string
    fullscreen?: boolean
    /** 页面不可见时暂停 3D 动画以省 GPU */
    paused?: boolean
    /** 优先 WebGPU 渲染，不支持时回退 WebGL */
    preferWebGPU?: boolean
    /** 移动端降低像素比等以提升帧率 */
    mobileOptimized?: boolean
  }>(),
  {
    chartData: () => [],
    flowerCount: 0,
    flowerTypes: () => [],
    flowerCommentIds: () => [],
    height: '360px',
    fullscreen: false,
    paused: false,
    preferWebGPU: true,
    mobileOptimized: false,
  }
)

const emit = defineEmits<{
  wordClick: [word: string]
  flowerClick: [commentId: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const hoveredWord = ref<string | null>(null)
const hoveredCount = ref<number | null>(null)
let bubbleScene: WordCloudBubble3D | null = null
let mounting = false
let mountTask: Promise<void> | null = null
let applyTimer: ReturnType<typeof setTimeout> | null = null

function resolveFlowerCount(): number {
  const max = getMaxGardenFlowerCount(props.mobileOptimized)
  return Math.min(max, Math.max(0, Math.floor(props.flowerCount)))
}

function buildSceneData(): GardenSceneData {
  return {
    words: props.chartData,
    flowerCount: resolveFlowerCount(),
    flowerTypes: props.flowerTypes,
    flowerCommentIds: props.flowerCommentIds,
    plantTypeIndex: props.plantTypeIndex,
  }
}

const sceneSignature = computed(() => {
  const count = resolveFlowerCount()
  const wordsKey = props.chartData.map((item) => `${item.name}\0${item.value}`).join('\n')
  const metaKey = buildFlowerMetaKey(
    props.flowerTypes,
    props.flowerCommentIds,
    count
  )
  return `${count}|${props.plantTypeIndex ?? ''}|${wordsKey}|${metaKey}`
})

async function mountScene() {
  if (!import.meta.client || !containerRef.value || mounting) return
  mounting = true

  bubbleScene?.dispose()
  bubbleScene = new WordCloudBubble3D(
    containerRef.value,
    {
      onWordClick: (word) => emit('wordClick', word),
      onWordHover: (word) => {
        hoveredWord.value = word
        if (word) {
          const item = props.chartData.find((d) => d.name === word)
          hoveredCount.value = item?.value ?? null
        } else {
          hoveredCount.value = null
        }
      },
      onFlowerClick: (commentId) => emit('flowerClick', commentId),
    },
    {
      preferWebGPU: props.preferWebGPU,
      mobileOptimized: props.mobileOptimized,
    }
  )
  bubbleScene.setPaused(props.paused)

  const scene = bubbleScene
  if (!scene) return

  mountTask = (async () => {
    try {
      await scene.mount(buildSceneData())
    } catch (error) {
      console.error('3D 词云初始化失败:', error)
    } finally {
      mounting = false
      mountTask = null
    }
  })()

  await mountTask
}

async function applyGardenScene() {
  if (!bubbleScene) {
    await mountScene()
    return
  }
  if (mounting && mountTask) {
    await mountTask
  }
  if (!bubbleScene) return
  await bubbleScene.setGardenScene(buildSceneData())
}

function scheduleApplyGardenScene() {
  if (applyTimer) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => {
    applyTimer = null
    void applyGardenScene()
  }, 80)
}

watch(sceneSignature, () => {
  scheduleApplyGardenScene()
})

watch(
  () => props.paused,
  (paused) => {
    bubbleScene?.setPaused(paused)
  }
)

function onVisibilityChange() {
  if (!import.meta.client) return
  const hidden = document.visibilityState === 'hidden'
  bubbleScene?.setPaused(hidden || props.paused)
}

onMounted(() => {
  const startMount = () => {
    void mountScene()
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => requestAnimationFrame(startMount))
  } else {
    startMount()
  }
  if (import.meta.client) {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
})

onBeforeUnmount(() => {
  if (applyTimer) {
    clearTimeout(applyTimer)
    applyTimer = null
  }
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
  bubbleScene?.dispose()
  bubbleScene = null
})
</script>

<template>
  <div
    class="relative w-full overflow-hidden"
    :class="
      fullscreen
        ? 'h-full min-h-0'
        : 'rounded-2xl border border-[#FFD1DC] dark:border-gray-700 h-[360px]'
    "
    :style="fullscreen ? undefined : { height }"
  >
    <div class="pointer-events-none absolute inset-0 bg-white dark:bg-black" />

    <div ref="containerRef" class="absolute inset-0 touch-none z-[1]" />

    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-4 px-4"
    >
      <div
        class="flex items-center gap-2 rounded-full border border-[#FFD1DC] bg-white/70 px-3 py-1.5 text-[11px] text-qhx-text-muted shadow-sm backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300"
      >
        <span class="text-sm" aria-hidden="true">🌸</span>
        <span>转动花园 · 点击花语或花朵</span>
      </div>
    </div>

    <Transition name="fade-scale">
      <div
        v-if="hoveredWord"
        class="pointer-events-none absolute left-4 top-4 z-10 max-w-[70%]"
      >
        <div
          class="rounded-2xl border border-[#FFD1DC] bg-white/75 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/70"
        >
          <div class="text-[10px] tracking-widest text-qhx-primary mb-1">
            花语
          </div>
          <div class="text-base font-bold text-qhx-text dark:text-white leading-snug">
            {{ hoveredWord }}
          </div>
          <div v-if="hoveredCount != null" class="mt-1 text-xs text-qhx-text-muted">
            已在花园绽放 {{ hoveredCount }} 次
          </div>
        </div>
      </div>
    </Transition>

    <div
      v-if="!(chartData?.length) && !flowerCount"
      class="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 text-sm text-qhx-text-muted"
    >
      <span class="text-3xl" aria-hidden="true">🌱</span>
      <span>花园还是空的，签到来种下第一朵花吧</span>
    </div>
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
</style>
