<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

export type StepGuidePlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export type StepGuideItem = {
  id: string
  title: string
  description: string
  targetId?: string
  placement?: StepGuidePlacement
  padding?: number
}

type HoleRect = { x: number; y: number; w: number; h: number; r: number }

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    steps: StepGuideItem[]
    storageKey?: string
    zIndex?: number
    overlayOpacity?: number
    holeRadius?: number
  }>(),
  {
    zIndex: 210,
    overlayOpacity: 0.72,
    holeRadius: 12
  }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  finish: []
  skip: []
  'step-change': [index: number, step: StepGuideItem]
}>()

const cardRef = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const cardVisible = ref(false)
const cardStyle = ref<Record<string, string>>({})
/** CSS 聚光灯洞（box-shadow 挖空），无 Canvas 每帧重绘 */
const spotlightStyle = ref<Record<string, string> | null>(null)
const showSpotlight = ref(false)

const currentStep = computed(() => props.steps[currentIndex.value])
const isFirst = computed(() => currentIndex.value === 0)
const isLast = computed(() => currentIndex.value >= props.steps.length - 1)
const progressLabel = computed(
  () => `${currentIndex.value + 1} / ${props.steps.length}`
)

const overlayRgb = '15, 23, 42'

function getTargetRect(step: StepGuideItem | undefined): HoleRect | null {
  if (!step || !import.meta.client) return null
  const id = step.targetId?.trim()
  if (!id || step.placement === 'center') return null

  const el = document.getElementById(id)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const pad = step.padding ?? 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const x = Math.max(0, rect.left - pad)
  const y = Math.max(0, rect.top - pad)
  const w = Math.min(vw - x, rect.width + pad * 2)
  const h = Math.min(vh - y, rect.height + pad * 2)

  return { x, y, w, h, r: props.holeRadius }
}

function clampCard(left: number, top: number, cardW: number, cardH: number) {
  const margin = 12
  const maxW = Math.min(cardW, window.innerWidth - margin * 2)
  const x = Math.min(Math.max(left, margin), window.innerWidth - maxW - margin)
  const y = Math.min(Math.max(top, margin), window.innerHeight - cardH - margin)
  return { left: x, top: y, width: maxW }
}

function updateCardPosition(step: StepGuideItem, hole: HoleRect | null) {
  const cardW = Math.min(300, window.innerWidth - 24)
  const cardH = cardRef.value?.offsetHeight ?? 200
  const gap = 14

  if (!hole) {
    cardStyle.value = {
      left: '50%',
      top: '50%',
      width: 'min(22rem, calc(100vw - 2rem))',
      transform: 'translate(-50%, -50%)'
    }
    return
  }

  const placement = step.placement ?? 'bottom'
  let left = hole.x + hole.w / 2 - cardW / 2
  let top = hole.y + hole.h + gap

  if (placement === 'top') {
    top = hole.y - gap - cardH
  } else if (placement === 'left') {
    left = hole.x - cardW - gap
    top = hole.y + hole.h / 2 - cardH / 2
  } else if (placement === 'right') {
    left = hole.x + hole.w + gap
    top = hole.y + hole.h / 2 - cardH / 2
  }

  const clamped = clampCard(left, top, cardW, cardH)
  cardStyle.value = {
    left: `${clamped.left}px`,
    top: `${clamped.top}px`,
    width: `${clamped.width}px`,
    transform: 'none'
  }
}

function applySpotlight(hole: HoleRect | null) {
  if (!hole) {
    showSpotlight.value = false
    spotlightStyle.value = null
    return
  }
  showSpotlight.value = true
  const spread = 9999
  spotlightStyle.value = {
    left: `${hole.x}px`,
    top: `${hole.y}px`,
    width: `${hole.w}px`,
    height: `${hole.h}px`,
    borderRadius: `${hole.r}px`,
    boxShadow: `0 0 0 ${spread}px rgba(${overlayRgb}, ${props.overlayOpacity})`
  }
}

/** @param emitChange 为 false 时仅重算几何（resize / 侧栏动画后），不重复触发 step-change */
function remeasure(emitChange: boolean) {
  const step = currentStep.value
  if (!step || !props.modelValue) return

  if (emitChange) {
    emit('step-change', currentIndex.value, step)
  }

  const hole = getTargetRect(step)
  applySpotlight(hole)

  nextTick(() => {
    updateCardPosition(step, hole)
    cardVisible.value = true
  })
}

let remeasureTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRemeasure() {
  if (remeasureTimer) clearTimeout(remeasureTimer)
  remeasureTimer = setTimeout(() => {
    remeasureTimer = null
    remeasure(false)
  }, 360)
}

function persistCompleted() {
  if (!props.storageKey || !import.meta.client) return
  try {
    localStorage.setItem(props.storageKey, '1')
  } catch {
    /* ignore */
  }
}

function closeGuide() {
  emit('update:modelValue', false)
}

function finishGuide() {
  persistCompleted()
  emit('finish')
  closeGuide()
}

function skipGuide() {
  persistCompleted()
  emit('skip')
  closeGuide()
}

function goPrev() {
  if (currentIndex.value > 0) {
    cardVisible.value = false
    currentIndex.value -= 1
    remeasure(true)
  }
}

function goNext() {
  if (isLast.value) {
    finishGuide()
  } else {
    cardVisible.value = false
    currentIndex.value += 1
    remeasure(true)
  }
}

function resetGuideUi() {
  if (remeasureTimer) {
    clearTimeout(remeasureTimer)
    remeasureTimer = null
  }
  showSpotlight.value = false
  spotlightStyle.value = null
  cardVisible.value = false
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      currentIndex.value = 0
      await nextTick()
      remeasure(true)
    } else {
      resetGuideUi()
    }
  }
)

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('resize', scheduleRemeasure, { passive: true })
  if (props.modelValue) {
    remeasure(true)
  }
})

onUnmounted(() => {
  resetGuideUi()
  if (!import.meta.client) return
  window.removeEventListener('resize', scheduleRemeasure)
})

defineExpose({
  refreshLayout: scheduleRemeasure,
  remeasure,
  currentIndex
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="step-guide-root">
        <div
          v-if="modelValue && currentStep"
          class="step-guide-root fixed inset-0 touch-none"
          :style="{ zIndex }"
          role="dialog"
          aria-modal="true"
          :aria-label="currentStep.title"
        >
          <!-- 无目标：整屏遮罩 -->
          <div
            v-if="!showSpotlight"
            class="step-guide-dim absolute inset-0"
            :style="{ background: `rgba(${overlayRgb}, ${overlayOpacity})` }"
            aria-hidden="true"
          />
          <!-- 有目标：单节点 box-shadow 聚光灯（GPU 合成，无 Canvas RAF） -->
          <div
            v-else
            class="step-guide-spotlight pointer-events-none absolute ring-2 ring-white/80"
            :style="spotlightStyle ?? undefined"
            aria-hidden="true"
          />

          <div
            ref="cardRef"
            class="step-guide-card absolute rounded-2xl border border-white/20 bg-white/95 p-5 shadow-2xl dark:border-gray-600/60 dark:bg-gray-900/95"
            :class="{ 'step-guide-card--visible': cardVisible }"
            :style="cardStyle"
          >
            <Transition name="step-guide-text" mode="out-in">
              <div :key="currentStep.id">
                <p class="mb-1 text-[11px] font-medium uppercase tracking-wide text-qhx-primary">
                  {{ progressLabel }}
                </p>
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-50">
                  {{ currentStep.title }}
                </h2>
                <p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {{ currentStep.description }}
                </p>
              </div>
            </Transition>
            <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                class="text-sm text-gray-500 transition-colors duration-200 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                @click="skipGuide"
              >
                跳过
              </button>
              <div class="flex gap-2">
                <UButton
                  v-if="!isFirst"
                  color="gray"
                  variant="ghost"
                  size="sm"
                  @click="goPrev"
                >
                  上一步
                </UButton>
                <UButton color="primary" size="sm" @click="goNext">
                  {{ isLast ? '开始使用' : '下一步' }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.step-guide-dim,
.step-guide-spotlight {
  pointer-events: auto;
}

.step-guide-spotlight {
  transition:
    left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 0.35s ease,
    box-shadow 0.28s ease;
  will-change: left, top, width, height;
}

.step-guide-card {
  pointer-events: auto;
  z-index: 1;
  opacity: 0;
  transition:
    left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.28s ease,
    opacity 0.25s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.step-guide-card--visible {
  opacity: 1;
}

.step-guide-root-enter-active,
.step-guide-root-leave-active {
  transition: opacity 0.22s ease;
}

.step-guide-root-enter-from,
.step-guide-root-leave-to {
  opacity: 0;
}

.step-guide-text-enter-active,
.step-guide-text-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.step-guide-text-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.step-guide-text-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
