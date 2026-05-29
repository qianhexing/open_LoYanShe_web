<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ratioFromClient, usePointerDragSession } from '@/composables/usePointerDrag1d'
import {
  clamp01,
  clampHue,
  clientToRatio,
  hsvaToHex,
  hsvaToRgb,
  normalizeHexOutput,
  parseColorInput,
  type Hsva
} from '@/utils/colorPickerHsva'

const props = withDefaults(
  defineProps<{
    /** 打开弹窗时的默认颜色；若同时传入 modelValue，则以 modelValue 为准 */
    color?: string | null
    modelValue?: string | null
    disableAlpha?: boolean
    /** @deprecated 自研选择器仅 chrome 布局，保留以兼容旧调用 */
    pickerType?: 'chrome' | 'fk'
  }>(),
  {
    disableAlpha: true,
    pickerType: 'chrome'
  }
)

const emit = defineEmits<{
  choose: [hex: string]
  'update:modelValue': [hex: string]
}>()

const show = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const hsva = ref<Hsva>({ h: 0, s: 1, v: 1, a: 1 })
const hexInput = ref('#000000')
/** 上次确认的颜色，用于未绑定 props 时再次打开 */
const lastConfirmedHex = ref<string | null>(null)
let pendingOpenColor: string | null | undefined

const svAreaRef = ref<HTMLElement | null>(null)
const hueTrackRef = ref<HTMLElement | null>(null)
const alphaTrackRef = ref<HTMLElement | null>(null)

const svDrag = usePointerDragSession()
const hueDrag = usePointerDragSession()
const alphaDrag = usePointerDragSession()

const includeAlpha = computed(() => !props.disableAlpha)

const previewRgb = computed(() => {
  const { r, g, b } = hsvaToRgb(hsva.value)
  return `rgb(${r}, ${g}, ${b})`
})

const previewStyle = computed(() => ({
  backgroundColor: previewRgb.value,
  opacity: includeAlpha.value ? hsva.value.a : 1
}))

const svPointerStyle = computed(() => ({
  left: `${hsva.value.s * 100}%`,
  top: `${(1 - hsva.value.v) * 100}%`
}))

const huePointerStyle = computed(() => ({
  left: `${(hsva.value.h / 360) * 100}%`
}))

const alphaPointerStyle = computed(() => ({
  left: `${hsva.value.a * 100}%`
}))

const svPanelStyle = computed(() => ({
  backgroundColor: `hsl(${hsva.value.h}, 100%, 50%)`
}))

const alphaGradientStyle = computed(() => ({
  background: `linear-gradient(to right, transparent, ${previewRgb.value})`
}))

function resolveInitialHex(override?: string | null): string {
  const raw =
    override ?? props.modelValue ?? props.color ?? lastConfirmedHex.value
  if (raw == null || String(raw).trim() === '') {
    return includeAlpha.value ? '#000000FF' : '#000000'
  }
  return normalizeHexOutput(String(raw).trim(), includeAlpha.value)
}

function syncFromHsva() {
  const hex = hsvaToHex(hsva.value, includeAlpha.value)
  hexInput.value = hex
}

function applyHsva(next: Hsva) {
  hsva.value = {
    h: clampHue(next.h),
    s: clamp01(next.s),
    v: clamp01(next.v),
    a: clamp01(next.a)
  }
  syncFromHsva()
}

function loadFromHex(hex: string) {
  const parsed = parseColorInput(hex, hsva.value.h)
  if (parsed) {
    if (props.disableAlpha) parsed.a = 1
    applyHsva(parsed)
    return
  }
  applyHsva({ h: 0, s: 0, v: 0, a: 1 })
}

/** @param initialColor 打开时使用的颜色（优先于 props / 上次确认值） */
function showModel(e?: MouseEvent, initialColor?: string | null) {
  if (e) {
    clickPosition.value = { x: e.clientX, y: e.clientY }
  }
  pendingOpenColor = initialColor
  show.value = true
}

defineExpose({ showModel })

watch(
  () => [props.modelValue, props.color] as const,
  () => {
    if (!show.value) return
    loadFromHex(resolveInitialHex(pendingOpenColor))
  }
)

watch(show, (open) => {
  if (open) {
    loadFromHex(resolveInitialHex(pendingOpenColor))
    pendingOpenColor = undefined
    return
  }
  svDrag.endDrag()
  hueDrag.endDrag()
  alphaDrag.endDrag()
})

function confirm() {
  const hex = normalizeHexOutput(hexInput.value.trim() || hsvaToHex(hsva.value, includeAlpha.value), includeAlpha.value)
  lastConfirmedHex.value = hex
  emit('update:modelValue', hex)
  emit('choose', hex)
  show.value = false
}

function onSvPointerDown(e: PointerEvent) {
  const el = svAreaRef.value
  if (!el) return
  svDrag.start(e, (clientX, clientY) => {
    const rect = el.getBoundingClientRect()
    const { x, y } = clientToRatio(clientX, clientY, rect, 'xy')
    applyHsva({ ...hsva.value, s: x, v: 1 - y })
  }, el)
}

function onHuePointerDown(e: PointerEvent) {
  const el = hueTrackRef.value
  if (!el) return
  hueDrag.start(e, (clientX) => {
    const rect = el.getBoundingClientRect()
    const ratio = ratioFromClient(clientX, 0, rect, 'x')
    applyHsva({ ...hsva.value, h: ratio * 360 })
  }, el)
}

function onAlphaPointerDown(e: PointerEvent) {
  if (props.disableAlpha) return
  const el = alphaTrackRef.value
  if (!el) return
  alphaDrag.start(e, (clientX) => {
    const rect = el.getBoundingClientRect()
    const ratio = ratioFromClient(clientX, 0, rect, 'x')
    applyHsva({ ...hsva.value, a: ratio })
  }, el)
}

function commitHexInput() {
  const normalized = normalizeHexOutput(hexInput.value, includeAlpha.value)
  loadFromHex(normalized)
}

function onHexInput(e: Event) {
  hexInput.value = (e.target as HTMLInputElement).value
}
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div
      class="bg-white dark:bg-gray-900 rounded-[10px] max-h-[50vh] overflow-y-auto border border-gray-100 dark:border-gray-800 shadow-xl w-full min-w-0 max-w-[min(90vw,42rem)]"
    >
      <div class="p-6 w-full min-w-0 box-border space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="size-10 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner ring-1 ring-gray-100 dark:ring-gray-800"
            :style="previewStyle"
          />
          <label class="flex flex-1 min-w-[10rem] items-center gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">HEX</span>
            <input
              :value="hexInput"
              type="text"
              spellcheck="false"
              autocomplete="off"
              class="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-qhx-primary/40"
              @input="onHexInput"
              @change="commitHexInput"
              @keydown.enter.prevent="commitHexInput"
            />
          </label>
        </div>

        <!-- 饱和度 × 明度 -->
        <div
          ref="svAreaRef"
          class="qhx-color-picker-sv relative w-full h-[200px] rounded-lg overflow-hidden cursor-crosshair touch-none select-none ring-1 ring-gray-200/80 dark:ring-gray-700"
          :style="svPanelStyle"
          @pointerdown="onSvPointerDown"
          @lostpointercapture="svDrag.endDrag()"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
          <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
          <div
            class="qhx-color-picker-pointer absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20 pointer-events-none"
            :style="svPointerStyle"
          />
        </div>

        <!-- 色相 -->
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">色相</span>
          <div
            ref="hueTrackRef"
            class="qhx-color-picker-hue relative h-3 w-full rounded-full cursor-pointer touch-none select-none ring-1 ring-gray-200/80 dark:ring-gray-700"
            @pointerdown="onHuePointerDown"
            @lostpointercapture="hueDrag.endDrag()"
          >
            <div
              class="qhx-color-picker-pointer absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/15 pointer-events-none"
              :style="huePointerStyle"
            />
          </div>
        </div>

        <!-- 透明度 -->
        <div v-if="includeAlpha" class="space-y-1.5">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">透明度</span>
          <div
            ref="alphaTrackRef"
            class="qhx-color-picker-alpha relative h-3 w-full rounded-full cursor-pointer touch-none select-none ring-1 ring-gray-200/80 dark:ring-gray-700 overflow-hidden"
            @pointerdown="onAlphaPointerDown"
            @lostpointercapture="alphaDrag.endDrag()"
          >
            <div class="absolute inset-0 qhx-color-picker-checker" />
            <div class="absolute inset-0" :style="alphaGradientStyle" />
            <div
              class="qhx-color-picker-pointer absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/15 pointer-events-none z-[1]"
              :style="alphaPointerStyle"
            />
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <UButton
            type="button"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="confirm"
          >
            确认选择
          </UButton>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.qhx-color-picker-hue {
  background: linear-gradient(
    to right,
    #ff0000 0%,
    #ffff00 17%,
    #00ff00 33%,
    #00ffff 50%,
    #0000ff 67%,
    #ff00ff 83%,
    #ff0000 100%
  );
}

.qhx-color-picker-checker {
  background-image:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 10px 10px;
  background-position:
    0 0,
    0 5px,
    5px -5px,
    -5px 0;
}

:global(.dark) .qhx-color-picker-checker {
  background-image:
    linear-gradient(45deg, #374151 25%, transparent 25%),
    linear-gradient(-45deg, #374151 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #374151 75%),
    linear-gradient(-45deg, transparent 75%, #374151 75%);
}
</style>
