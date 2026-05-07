<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import QhxModal from '@/components/Qhx/Modal.vue'

export type ImageCanvasColorPickLayout = {
  offsetX: number
  offsetY: number
  drawW: number
  drawH: number
  naturalW: number
  naturalH: number
  scale: number
   cssW: number
  cssH: number
  dpr: number
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 图片地址（支持 blob:、data:、同源 URL；跨域需服务端 CORS） */
    imageSrc: string
    triggerPosition?: { x: number; y: number }
    closeOnBackdrop?: boolean
    /** 弹窗标题 */
    title?: string
  }>(),
  {
    closeOnBackdrop: true,
    title: '从图片取色'
  }
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  close: []
  /** 用户点击确认后传出 #RRGGBB */
  confirm: [hex: string]
  cancel: []
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const clickPosition = ref({ x: 0, y: 0 })
const loading = ref(false)
const loadError = ref<string | null>(null)
const draftHex = ref('#000000')
const layout = ref<ImageCanvasColorPickLayout | null>(null)
const isPointerDown = ref(false)

let resizeObserver: ResizeObserver | null = null
let activeImage: HTMLImageElement | null = null

function rgbToHex(r: number, g: number, b: number): string {
  const hex = [r, g, b]
    .map((n) =>
      Math.max(0, Math.min(255, n))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
  return `#${hex}`
}

function trySetCrossOrigin(img: HTMLImageElement, src: string) {
  if (/^(blob:|data:)/i.test(src)) return
  img.crossOrigin = 'anonymous'
}

function releaseImage() {
  if (activeImage) {
    activeImage.onload = null
    activeImage.onerror = null
    activeImage.src = ''
    activeImage = null
  }
}

function drawImageToCanvas(img: HTMLImageElement) {
  const wrap = wrapperRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas || !img.naturalWidth) return

  const nw = img.naturalWidth
  const nh = img.naturalHeight
  const aw = Math.max(1, Math.floor(wrap.clientWidth))
  const ah = Math.max(1, Math.floor(wrap.clientHeight))

  const scale = Math.min(aw / nw, ah / nh)
  const dw = Math.floor(nw * scale)
  const dh = Math.floor(nh * scale)
  const ox = Math.floor((aw - dw) / 2)
  const oy = Math.floor((ah - dh) / 2)

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  canvas.width = Math.max(1, Math.floor(aw * dpr))
  canvas.height = Math.max(1, Math.floor(ah * dpr))
  canvas.style.width = `${aw}px`
  canvas.style.height = `${ah}px`

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, aw, ah)
  ctx.drawImage(img, ox, oy, dw, dh)

  layout.value = {
    offsetX: ox,
    offsetY: oy,
    drawW: dw,
    drawH: dh,
    naturalW: nw,
    naturalH: nh,
    scale,
    cssW: aw,
    cssH: ah,
    dpr
  }
}

async function loadAndDraw(src: string) {
  releaseImage()
  loadError.value = null
  loading.value = true
  layout.value = null

  if (!src?.trim()) {
    loadError.value = '未提供图片'
    loading.value = false
    return
  }

  const img = new Image()
  activeImage = img
  trySetCrossOrigin(img, src)
  img.decoding = 'async'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  }).catch(() => {
    loadError.value = '图片加载失败（可检查跨域或地址是否有效）'
    activeImage = null
    loading.value = false
    return
  })

  await nextTick()
  drawImageToCanvas(img)
  loading.value = false
}

function teardownObserver() {
  resizeObserver?.disconnect()
  resizeObserver = null
}

function setupObserver() {
  teardownObserver()
  const wrap = wrapperRef.value
  if (!wrap || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    if (activeImage?.complete && activeImage.naturalWidth) {
      drawImageToCanvas(activeImage)
    }
  })
  resizeObserver.observe(wrap)
}

function pickFromClientXY(clientX: number, clientY: number) {
  const canvas = canvasRef.value
  const lay = layout.value
  if (!canvas || !lay) return

  const rect = canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top

  if (x < 0 || y < 0 || x >= lay.cssW || y >= lay.cssH) return

  const ix = Math.floor((x - lay.offsetX) / lay.scale)
  const iy = Math.floor((y - lay.offsetY) / lay.scale)
  if (ix < 0 || iy < 0 || ix >= lay.naturalW || iy >= lay.naturalH) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  const px = Math.floor(x * lay.dpr)
  const py = Math.floor(y * lay.dpr)
  let data: ImageData
  try {
    data = ctx.getImageData(px, py, 1, 1)
  } catch {
    loadError.value = '无法读取像素（常为跨域图片未允许 CORS）'
    return
  }

  const [r, g, b, a] = data.data
  if (a < 16) {
    draftHex.value = '#FFFFFF'
    return
  }
  draftHex.value = rgbToHex(r, g, b)
}

function onPointerDown(e: PointerEvent) {
  if (loading.value || loadError.value) return
  isPointerDown.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  pickFromClientXY(e.clientX, e.clientY)
}

function onPointerMove(e: PointerEvent) {
  if (!isPointerDown.value) return
  if (loading.value || loadError.value) return
  pickFromClientXY(e.clientX, e.clientY)
}

function onPointerUp() {
  isPointerDown.value = false
}

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}

function onCancel() {
  emit('cancel')
  closeModal()
}

function onConfirm() {
  emit('confirm', draftHex.value)
  closeModal()
}

/** 与 ColorPicker.showModel 类似：可传入指针坐标作为弹窗动画锚点 */
function openAt(e?: MouseEvent | PointerEvent) {
  if (e) {
    clickPosition.value = { x: e.clientX, y: e.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  emit('update:modelValue', true)
}

defineExpose({ openAt })

const panelClass = computed(
  () =>
    'bg-white dark:bg-gray-900 rounded-[10px] border border-gray-100 dark:border-gray-800 shadow-xl w-full min-w-0 max-w-[min(90vw,42rem)] flex flex-col max-h-[min(96vh,900px)]'
)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      isPointerDown.value = false
      teardownObserver()
      releaseImage()
      loadError.value = null
      loading.value = false
      layout.value = null
      return
    }
    draftHex.value = '#000000'
    await nextTick()
    setupObserver()
    await loadAndDraw(props.imageSrc)
    await nextTick()
    if (activeImage?.complete) drawImageToCanvas(activeImage)
  }
)

watch(
  () => props.imageSrc,
  async (src) => {
    if (!props.modelValue) return
    await loadAndDraw(src)
    await nextTick()
    if (activeImage?.complete) drawImageToCanvas(activeImage)
  }
)

onUnmounted(() => {
  teardownObserver()
  releaseImage()
})
</script>

<template>
  <QhxModal
    :model-value="modelValue"
    :trigger-position="triggerPosition ?? clickPosition"
    :close-on-backdrop="closeOnBackdrop"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div :class="panelClass">
      <div
        class="shrink-0 px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2"
      >
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
          {{ title }}
        </h3>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="关闭"
          @click="onCancel"
        >
          <UIcon name="i-heroicons-x-mark-20-solid" class="size-5" />
        </button>
      </div>

      <div class="px-4 py-3 flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-snug">
          在图片上点击或拖动（按住）即可取色；透明区域会近似为白色。
        </p>

        <div
          ref="wrapperRef"
          class="relative w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-1 min-h-[min(60vh,320px)] max-h-[70vh]"
        >
          <div
            v-if="loading"
            class="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 z-10 bg-gray-100/80 dark:bg-gray-800/80"
          >
            加载中…
          </div>
          <div
            v-else-if="loadError"
            class="absolute inset-0 flex items-center justify-center text-sm text-amber-700 dark:text-amber-300 px-3 text-center z-10"
          >
            {{ loadError }}
          </div>
          <canvas
            v-show="!loading && !loadError"
            ref="canvasRef"
            class="block w-full h-full touch-none cursor-crosshair select-none"
            style="touch-action: none"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @lostpointercapture="onPointerUp"
          />
        </div>

        <div class="shrink-0 flex flex-wrap items-center gap-3 sm:gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="size-9 sm:size-10 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner shrink-0"
              :style="{ backgroundColor: draftHex }"
            />
            <span class="font-mono text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
              {{ draftHex.toUpperCase() }}
            </span>
          </div>
          <div class="flex-1 min-w-[8rem]" />
          <div class="flex items-center justify-end gap-2 w-full sm:w-auto">
            <UButton variant="outline" class="flex-1 sm:flex-none" @click="onCancel">
              取消
            </UButton>
            <UButton
              type="button"
              class="flex-1 sm:flex-none bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
              :disabled="!!loadError || loading"
              @click="onConfirm"
            >
              确认
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </QhxModal>
</template>
