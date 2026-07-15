<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { useConfigStore } from '@/stores/config'
import { uploadFileToOSS } from '@/utils/ossUpload'
import {
	cloneSceneCanvasDocument,
	createCanvasElementId,
	createEmptySceneCanvasDocument,
	normalizeSceneCanvasDocument,
	resolveCanvasAssetUrl,
	toRelativeCanvasAssetUrl,
	type SceneCanvasDocument,
	type SceneCanvasElement,
	type SceneCanvasImageElement,
	type SceneCanvasTextElement
} from '@/utils/sceneCanvas'

export interface SceneCanvasApplyPayload {
	document: SceneCanvasDocument
}

const show = ref(false)
const saving = ref(false)
const uploading = ref(false)
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)
const toast = useToast()

/** App WebView statusbar + 系统安全区，与 scene/detail、ImageLightbox 一致 */
const safeTopPad = computed(() => {
	const bar = configStore.statusBarHeight || 0
	return `max(env(safe-area-inset-top, 0px), ${bar}px)`
})
const shellSafeStyle = computed(() => {
	if (!isMobile.value) return undefined
	return {
		paddingTop: safeTopPad.value,
		paddingBottom: 'env(safe-area-inset-bottom, 0px)',
		paddingLeft: 'env(safe-area-inset-left, 0px)',
		paddingRight: 'env(safe-area-inset-right, 0px)',
		boxSizing: 'border-box' as const
	}
})

const doc = ref<SceneCanvasDocument>(createEmptySceneCanvasDocument())
const selectedId = ref<string | null>(null)
const imageFileInput = ref<HTMLInputElement | null>(null)
const stageWrapRef = ref<HTMLElement | null>(null)
const stageScale = ref(1)

const selected = computed(() =>
	doc.value.elements.find(e => e.id === selectedId.value) ?? null
)
const selectedText = computed(() =>
	selected.value?.type === 'text' ? (selected.value as SceneCanvasTextElement) : null
)
const selectedImage = computed(() =>
	selected.value?.type === 'image' ? (selected.value as SceneCanvasImageElement) : null
)

const sortedElements = computed(() =>
	[...doc.value.elements].sort((a, b) => a.zIndex - b.zIndex)
)

const emit = defineEmits<{
	apply: [payload: SceneCanvasApplyPayload]
	close: []
}>()

function openEditor(initial?: SceneCanvasDocument | null) {
	const normalized = initial ? normalizeSceneCanvasDocument(initial) : null
	doc.value = normalized
		? cloneSceneCanvasDocument(normalized)
		: createEmptySceneCanvasDocument()
	selectedId.value = doc.value.elements[0]?.id ?? null
	show.value = true
	nextTick(() => fitStage())
}

function closeEditor() {
	if (saving.value) return
	show.value = false
	emit('close')
}

function fitStage() {
	const el = stageWrapRef.value
	if (!el) return
	const pad = 24
	const aw = Math.max(120, el.clientWidth - pad)
	const ah = Math.max(120, el.clientHeight - pad)
	const sx = aw / doc.value.width
	const sy = ah / doc.value.height
	stageScale.value = Math.min(1, sx, sy)
}

watch(show, v => {
	if (v) nextTick(() => fitStage())
})

function selectElement(id: string | null) {
	selectedId.value = id
}

function nextZIndex(): number {
	if (!doc.value.elements.length) return 1
	return Math.max(...doc.value.elements.map(e => e.zIndex)) + 1
}

function addText() {
	const el: SceneCanvasTextElement = {
		id: createCanvasElementId(),
		type: 'text',
		x: doc.value.width * 0.2,
		y: doc.value.height * 0.35,
		width: doc.value.width * 0.6,
		height: 80,
		rotation: 0,
		opacity: 1,
		zIndex: nextZIndex(),
		text: '双击编辑文本',
		fontSize: 48,
		fontFamily: 'sans-serif',
		color: '#111111',
		fontWeight: 'bold',
		textAlign: 'center'
	}
	doc.value.elements.push(el)
	selectedId.value = el.id
}

function triggerAddImage() {
	imageFileInput.value?.click()
}

async function onImageFileChange(e: Event) {
	const input = e.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	if (!file.type.startsWith('image/')) {
		toast.add({
			title: '请选择图片文件',
			icon: 'i-heroicons-exclamation-circle',
			color: 'orange'
		})
		return
	}
	uploading.value = true
	try {
		const uploaded = await uploadFileToOSS(file, 'editor')
		const rel = toRelativeCanvasAssetUrl(uploaded.file_url)
		const abs = resolveCanvasAssetUrl(rel)
		const dims = await probeImageSize(abs)
		const maxW = doc.value.width * 0.5
		const scale = Math.min(1, maxW / dims.w)
		const w = Math.max(40, dims.w * scale)
		const h = Math.max(40, dims.h * scale)
		const el: SceneCanvasImageElement = {
			id: createCanvasElementId(),
			type: 'image',
			x: (doc.value.width - w) / 2,
			y: (doc.value.height - h) / 2,
			width: w,
			height: h,
			rotation: 0,
			opacity: 1,
			zIndex: nextZIndex(),
			url: rel
		}
		doc.value.elements.push(el)
		selectedId.value = el.id
	} catch (err) {
		console.error(err)
		toast.add({
			title: '图片上传失败',
			description: err instanceof Error ? err.message : '请稍后重试',
			icon: 'i-heroicons-x-circle',
			color: 'red'
		})
	} finally {
		uploading.value = false
	}
}

function probeImageSize(src: string): Promise<{ w: number; h: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () =>
			resolve({ w: img.naturalWidth || 200, h: img.naturalHeight || 200 })
		img.onerror = () => reject(new Error('无法读取图片尺寸'))
		img.src = src
	})
}

function removeSelected() {
	if (!selectedId.value) return
	const id = selectedId.value
	doc.value.elements = doc.value.elements.filter(e => e.id !== id)
	selectedId.value = doc.value.elements[0]?.id ?? null
}

function bringForward() {
	const el = selected.value
	if (!el) return
	const above = doc.value.elements
		.filter(e => e.zIndex > el.zIndex)
		.sort((a, b) => a.zIndex - b.zIndex)[0]
	if (!above) {
		el.zIndex += 1
		return
	}
	const tmp = el.zIndex
	el.zIndex = above.zIndex
	above.zIndex = tmp
}

function sendBackward() {
	const el = selected.value
	if (!el) return
	const below = doc.value.elements
		.filter(e => e.zIndex < el.zIndex)
		.sort((a, b) => b.zIndex - a.zIndex)[0]
	if (!below) {
		el.zIndex -= 1
		return
	}
	const tmp = el.zIndex
	el.zIndex = below.zIndex
	below.zIndex = tmp
}

/** 拖拽移动 */
type DragState = {
	id: string
	mode: 'move' | 'resize'
	startX: number
	startY: number
	origX: number
	origY: number
	origW: number
	origH: number
}

let drag: DragState | null = null

function clientToStage(clientX: number, clientY: number): { x: number; y: number } {
	const wrap = stageWrapRef.value
	if (!wrap) return { x: 0, y: 0 }
	const rect = wrap.getBoundingClientRect()
	const stageW = doc.value.width * stageScale.value
	const stageH = doc.value.height * stageScale.value
	const ox = rect.left + (rect.width - stageW) / 2
	const oy = rect.top + (rect.height - stageH) / 2
	return {
		x: (clientX - ox) / stageScale.value,
		y: (clientY - oy) / stageScale.value
	}
}

function onElementPointerDown(e: PointerEvent, el: SceneCanvasElement) {
	if (e.button !== 0) return
	e.preventDefault()
	e.stopPropagation()
	selectedId.value = el.id
	const pt = clientToStage(e.clientX, e.clientY)
	drag = {
		id: el.id,
		mode: 'move',
		startX: pt.x,
		startY: pt.y,
		origX: el.x,
		origY: el.y,
		origW: el.width,
		origH: el.height
	}
	;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
	window.addEventListener('pointermove', onPointerMove)
	window.addEventListener('pointerup', onPointerUp)
}

function onResizePointerDown(e: PointerEvent, el: SceneCanvasElement) {
	if (e.button !== 0) return
	e.preventDefault()
	e.stopPropagation()
	selectedId.value = el.id
	const pt = clientToStage(e.clientX, e.clientY)
	drag = {
		id: el.id,
		mode: 'resize',
		startX: pt.x,
		startY: pt.y,
		origX: el.x,
		origY: el.y,
		origW: el.width,
		origH: el.height
	}
	window.addEventListener('pointermove', onPointerMove)
	window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
	if (!drag) return
	const current = drag
	const el = doc.value.elements.find(item => item.id === current.id)
	if (!el) return
	const pt = clientToStage(e.clientX, e.clientY)
	const dx = pt.x - current.startX
	const dy = pt.y - current.startY
	if (current.mode === 'move') {
		el.x = current.origX + dx
		el.y = current.origY + dy
	} else {
		el.width = Math.max(20, current.origW + dx)
		el.height = Math.max(20, current.origH + dy)
	}
}

function onPointerUp() {
	drag = null
	window.removeEventListener('pointermove', onPointerMove)
	window.removeEventListener('pointerup', onPointerUp)
}

function onStageBackgroundClick() {
	selectedId.value = null
}

async function applyToScene() {
	if (saving.value) return
	saving.value = true
	try {
		emit('apply', {
			document: cloneSceneCanvasDocument(doc.value)
		})
		show.value = false
		toast.add({
			title: '已应用到场景',
			icon: 'i-heroicons-check-circle',
			color: 'green'
		})
	} catch (err) {
		console.error(err)
		toast.add({
			title: '应用失败',
			description: err instanceof Error ? err.message : '请稍后重试',
			icon: 'i-heroicons-x-circle',
			color: 'red'
		})
	} finally {
		saving.value = false
	}
}

defineExpose({ openEditor, closeEditor })
</script>

<template>
  <QhxModal v-model="show" :close-on-backdrop="false" @close="closeEditor">
    <div
      class="flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900"
      :class="isMobile
        ? 'h-[100dvh] w-[100vw] max-w-none rounded-none border-0'
        : 'h-[100dvh] w-[100vw] max-w-none rounded-none border-0'"
      :style="shellSafeStyle"
    >
      <!-- 顶栏 -->
      <div
        class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700"
        :class="isMobile ? 'px-3 py-2.5' : 'px-4 py-3'"
      >
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-semibold text-gray-900 dark:text-gray-100" :class="isMobile ? 'text-sm' : 'text-base'">
            画布编辑
          </h2>
          <p v-if="!isMobile" class="truncate text-xs text-gray-500 dark:text-gray-400">
            添加图片 / 文本素材，本地合成贴图加入场景；保存文档可二次编辑
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
            :disabled="saving || uploading"
            @click="applyToScene"
          >
            <UIcon name="i-heroicons-check" class="h-3.5 w-3.5" />
            {{ saving ? '应用中…' : '应用到场景' }}
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            :disabled="saving"
            aria-label="关闭"
            @click="closeEditor"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col md:flex-row">
        <!-- 左侧工具 -->
        <aside
          class="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-200 p-2 dark:border-gray-700 md:w-48 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r"
        >
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
            :disabled="uploading || saving"
            @click="triggerAddImage"
          >
            <UIcon name="material-symbols:add-photo-alternate-rounded" class="h-4 w-4" />
            {{ uploading ? '上传中…' : '添加图片' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300"
            :disabled="saving"
            @click="addText"
          >
            <UIcon name="material-symbols:title-rounded" class="h-4 w-4" />
            添加文本
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300"
            :disabled="!selected || saving"
            @click="bringForward"
          >
            上移一层
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300"
            :disabled="!selected || saving"
            @click="sendBackward"
          >
            下移一层
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:bg-rose-900/30 dark:text-rose-300"
            :disabled="!selected || saving"
            @click="removeSelected"
          >
            删除选中
          </button>

          <div class="mt-auto hidden space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700 md:block">
            <label class="block text-[11px] text-gray-500">画布尺寸</label>
            <div class="flex items-center gap-1 text-xs">
              <input
                v-model.number="doc.width"
                type="number"
                min="64"
                max="4096"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                @change="fitStage"
              >
              <span>×</span>
              <input
                v-model.number="doc.height"
                type="number"
                min="64"
                max="4096"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
                @change="fitStage"
              >
            </div>
            <label class="block text-[11px] text-gray-500">背景色</label>
            <div class="flex items-center gap-2">
              <input v-model="doc.background" type="color" class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0">
              <button
                type="button"
                class="rounded px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="doc.background = 'transparent'"
              >
                透明
              </button>
            </div>
          </div>
        </aside>

        <!-- 舞台 -->
        <div
          ref="stageWrapRef"
          class="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] dark:bg-gray-950"
          @click="onStageBackgroundClick"
        >
          <div class="flex h-full w-full items-center justify-center p-3">
            <div
              class="relative shadow-lg ring-1 ring-black/10"
              :style="{
                width: `${doc.width * stageScale}px`,
                height: `${doc.height * stageScale}px`,
                background: doc.background === 'transparent' ? 'transparent' : doc.background
              }"
              @click.stop
            >
              <div
                class="absolute left-0 top-0 origin-top-left"
                :style="{
                  width: `${doc.width}px`,
                  height: `${doc.height}px`,
                  transform: `scale(${stageScale})`
                }"
              >
                <div
                  v-for="el in sortedElements"
                  :key="el.id"
                  class="absolute box-border cursor-move select-none"
                  :class="selectedId === el.id ? 'ring-2 ring-emerald-500 ring-offset-1' : 'ring-1 ring-black/10'"
                  :style="{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    height: `${el.height}px`,
                    opacity: el.opacity,
                    zIndex: el.zIndex,
                    transform: `rotate(${el.rotation}deg)`
                  }"
                  @pointerdown="onElementPointerDown($event, el)"
                >
                  <img
                    v-if="el.type === 'image'"
                    :src="resolveCanvasAssetUrl(el.url)"
                    class="pointer-events-none h-full w-full object-fill"
                    draggable="false"
                    crossorigin="anonymous"
                  >
                  <div
                    v-else
                    class="pointer-events-none h-full w-full overflow-hidden whitespace-pre-wrap break-words"
                    :style="{
                      fontSize: `${el.fontSize}px`,
                      fontFamily: el.fontFamily,
                      fontWeight: el.fontWeight,
                      color: el.color,
                      textAlign: el.textAlign,
                      lineHeight: 1.25
                    }"
                  >
                    {{ el.text }}
                  </div>
                  <div
                    v-if="selectedId === el.id"
                    class="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm bg-emerald-500 shadow"
                    @pointerdown="onResizePointerDown($event, el)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧属性 -->
        <aside
          v-if="selected"
          class="max-h-[40vh] shrink-0 overflow-y-auto border-t border-gray-200 p-3 dark:border-gray-700 md:max-h-none md:w-64 md:border-l md:border-t-0"
        >
          <h3 class="mb-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
            {{ selected.type === 'image' ? '图片属性' : '文本属性' }}
          </h3>

          <template v-if="selectedText">
            <label class="mb-1 block text-[11px] text-gray-500">内容</label>
            <textarea
              v-model="selectedText.text"
              rows="3"
              class="mb-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <label class="mb-1 block text-[11px] text-gray-500">字号 {{ selectedText.fontSize }}</label>
            <input
              v-model.number="selectedText.fontSize"
              type="range"
              min="12"
              max="200"
              class="mb-2 w-full"
            >
            <label class="mb-1 block text-[11px] text-gray-500">颜色</label>
            <input v-model="selectedText.color" type="color" class="mb-2 h-8 w-full cursor-pointer">
            <label class="mb-1 block text-[11px] text-gray-500">对齐</label>
            <div class="mb-2 flex gap-1">
              <button
                v-for="align in (['left', 'center', 'right'] as const)"
                :key="align"
                type="button"
                class="flex-1 rounded px-2 py-1 text-[11px]"
                :class="selectedText.textAlign === align
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'"
                @click="selectedText.textAlign = align"
              >
                {{ align === 'left' ? '左' : align === 'center' ? '中' : '右' }}
              </button>
            </div>
          </template>

          <template v-if="selectedImage">
            <p class="mb-2 break-all text-[11px] text-gray-500">{{ selectedImage.url }}</p>
          </template>

          <label class="mb-1 block text-[11px] text-gray-500">透明度 {{ selected.opacity.toFixed(2) }}</label>
          <input
            v-model.number="selected.opacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="mb-2 w-full"
          >
          <label class="mb-1 block text-[11px] text-gray-500">旋转 {{ Math.round(selected.rotation) }}°</label>
          <input
            v-model.number="selected.rotation"
            type="range"
            min="-180"
            max="180"
            class="mb-2 w-full"
          >
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="text-[11px] text-gray-500">X
              <input v-model.number="selected.x" type="number" class="mt-0.5 w-full rounded border border-gray-200 px-1 py-1 dark:border-gray-600 dark:bg-gray-800">
            </label>
            <label class="text-[11px] text-gray-500">Y
              <input v-model.number="selected.y" type="number" class="mt-0.5 w-full rounded border border-gray-200 px-1 py-1 dark:border-gray-600 dark:bg-gray-800">
            </label>
            <label class="text-[11px] text-gray-500">宽
              <input v-model.number="selected.width" type="number" class="mt-0.5 w-full rounded border border-gray-200 px-1 py-1 dark:border-gray-600 dark:bg-gray-800">
            </label>
            <label class="text-[11px] text-gray-500">高
              <input v-model.number="selected.height" type="number" class="mt-0.5 w-full rounded border border-gray-200 px-1 py-1 dark:border-gray-600 dark:bg-gray-800">
            </label>
          </div>
        </aside>
      </div>

      <input
        ref="imageFileInput"
        type="file"
        class="hidden"
        accept="image/*"
        @change="onImageFileChange"
      >
    </div>
  </QhxModal>
</template>
