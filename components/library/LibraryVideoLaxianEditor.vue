<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { LibraryVideo, LaxianItem } from '@/types/api'
import type { RichTextToolbarItem } from '@/components/Qhx/RichTextEditor.vue'
import QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'
import { getLibraryVideoById, updateLibraryVideoJson } from '@/api/library'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  computeImageContentRect,
  drawLaxian2dMarkers,
  filterLaxianByImageIndex,
  getLaxian2dImageIndex,
  getLaxian2dNormPos,
  LAXIAN_2D_TYPE_THEME,
  normalizeLaxian2dList,
  normToPixel,
  pixelToNorm,
  setLaxian2dPosition,
  type ImageContentRect,
} from '@/utils/libraryVideoLaxian2d'

const emit = defineEmits<{
  saved: []
}>()

const toast = useToast()
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)

const show = ref(false)
const loading = ref(false)
const saving = ref(false)
const clickPosition = ref({ x: 0, y: 0 })

const video = ref<LibraryVideo | null>(null)
const laxianList = ref<LaxianItem[]>([])
const currentImageIndex = ref(0)
const selectedLaxianId = ref<string | null>(null)
const addMode = ref(false)
const draggingId = ref<string | null>(null)
const pendingDragId = ref<string | null>(null)
const mobileListOpen = ref(false)

const hitRadius = computed(() => (isMobile.value ? 28 : 14))
const dragThreshold = computed(() => (isMobile.value ? 10 : 4))
const markerVisualScale = computed(() => (isMobile.value ? 0.72 : 1))

let pointerDownClient = { x: 0, y: 0 }
let dragActivated = false

const imageContainerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const contentRect = shallowRef<ImageContentRect>({ offsetX: 0, offsetY: 0, width: 0, height: 0 })

const showDetailEdit = ref(false)
const detailEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)
const detailEditItem = ref<LaxianItem | null>(null)
const laxianDetailToolbar: RichTextToolbarItem[] = ['bold', 'italic', 'strike', 'image', 'internalLink', 'emoji']

let overlayLoopId = 0
let overlayActive = false
let resizeObserver: ResizeObserver | null = null

const images = computed(() =>
  (video.value?.addr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const currentImageKey = computed(() => images.value[currentImageIndex.value] ?? '')

const currentImageSrc = computed(() =>
  currentImageKey.value
    ? `${BASE_IMG}${currentImageKey.value}?x-oss-process=image/quality,q_85`
    : '',
)

const markersOnCurrentImage = computed(() =>
  filterLaxianByImageIndex(laxianList.value, currentImageIndex.value),
)

const selectedMarker = computed(() =>
  laxianList.value.find((item) => item.laxian_id === selectedLaxianId.value) ?? null,
)

const selectedMarkerIndex = computed(() => {
  if (!selectedLaxianId.value) return -1
  return markersOnCurrentImage.value.findIndex((item) => item.laxian_id === selectedLaxianId.value)
})

const showMobileSelectedPanel = computed(
  () => isMobile.value && Boolean(selectedMarker.value) && !mobileListOpen.value,
)

const totalMarkerCount = computed(() => laxianList.value.length)

const setTriggerPosition = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
    return
  }
  if (import.meta.client) {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
}

const resetEditorState = () => {
  video.value = null
  laxianList.value = []
  currentImageIndex.value = 0
  selectedLaxianId.value = null
  addMode.value = false
  draggingId.value = null
  pendingDragId.value = null
  dragActivated = false
  mobileListOpen.value = false
  showDetailEdit.value = false
  detailEditItem.value = null
  unbindDocumentPointer()
}

const closeEditor = () => {
  show.value = false
  resetEditorState()
}

const syncContentRect = () => {
  const container = imageContainerRef.value
  const img = imageRef.value
  if (!container || !img) return
  contentRect.value = computeImageContentRect(
    container.clientWidth,
    container.clientHeight,
    img.naturalWidth,
    img.naturalHeight,
  )
}

const getCanvasDpr = () => {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(raw, 2)
}

const drawOverlayFrame = () => {
  const canvas = canvasRef.value
  const container = imageContainerRef.value
  if (!canvas || !container) return

  const dpr = getCanvasDpr()
  const w = container.clientWidth
  const h = container.clientHeight
  if (!w || !h) return

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)
  drawLaxian2dMarkers(
    ctx,
    markersOnCurrentImage.value,
    contentRect.value,
    selectedLaxianId.value,
    markerVisualScale.value,
  )
  ctx.restore()
}

const stopOverlayLoop = () => {
  overlayActive = false
  if (overlayLoopId) {
    cancelAnimationFrame(overlayLoopId)
    overlayLoopId = 0
  }
}

const startOverlayLoop = () => {
  if (overlayActive || !show.value) return
  overlayActive = true
  const tick = () => {
    if (!overlayActive || !show.value) {
      stopOverlayLoop()
      return
    }
    drawOverlayFrame()
    overlayLoopId = requestAnimationFrame(tick)
  }
  overlayLoopId = requestAnimationFrame(tick)
}

const setupResizeObserver = () => {
  resizeObserver?.disconnect()
  if (!imageContainerRef.value) return
  resizeObserver = new ResizeObserver(() => {
    syncContentRect()
  })
  resizeObserver.observe(imageContainerRef.value)
}

const loadVideo = async (videoId: number) => {
  loading.value = true
  try {
    const detail = await getLibraryVideoById({ video_id: videoId })
    video.value = detail
    laxianList.value = normalizeLaxian2dList(detail.json_data?.laxian_list)
    currentImageIndex.value = 0
    selectedLaxianId.value = null
    addMode.value = false
    await nextTick()
    setupResizeObserver()
    syncContentRect()
    startOverlayLoop()
  } catch (err) {
    console.error(err)
    toast.add({ title: '加载失败', color: 'red' })
    closeEditor()
  } finally {
    loading.value = false
  }
}

const openEditor = async (item: LibraryVideo, event?: MouseEvent) => {
  if (!item.video_id) {
    toast.add({ title: '缺少 video_id', color: 'red' })
    return
  }
  if ((item.pk_type ?? 0) !== 0) {
    toast.add({ title: '仅支持图片类型人台图', color: 'orange' })
    return
  }
  setTriggerPosition(event)
  show.value = true
  await loadVideo(item.video_id)
}

const switchImage = (index: number) => {
  if (index < 0 || index >= images.value.length) return
  currentImageIndex.value = index
  selectedLaxianId.value = null
  addMode.value = false
  nextTick(syncContentRect)
}

const findMarkerAt = (localX: number, localY: number): LaxianItem | null => {
  const radius = hitRadius.value
  for (let i = markersOnCurrentImage.value.length - 1; i >= 0; i--) {
    const item = markersOnCurrentImage.value[i]
    const { x, y } = getLaxian2dNormPos(item)
    const { x: px, y: py } = normToPixel(x, y, contentRect.value)
    const dx = localX - px
    const dy = localY - py
    if (Math.hypot(dx, dy) <= radius) return item
  }
  return null
}

const updateMarkerPosition = (item: LaxianItem, normX: number, normY: number) => {
  const idx = laxianList.value.findIndex((l) => l.laxian_id === item.laxian_id)
  if (idx < 0) return
  laxianList.value[idx] = setLaxian2dPosition(item, normX, normY, currentImageIndex.value)
  laxianList.value = [...laxianList.value]
}

const updateDragFromClient = (clientX: number, clientY: number) => {
  const container = imageContainerRef.value
  if (!container || !draggingId.value) return
  const bounds = container.getBoundingClientRect()
  const localX = clientX - bounds.left
  const localY = clientY - bounds.top
  const norm = pixelToNorm(localX, localY, contentRect.value)
  if (!norm) return
  const item = laxianList.value.find((l) => l.laxian_id === draggingId.value)
  if (!item) return
  updateMarkerPosition(item, norm.x, norm.y)
}

const onDocumentPointerMove = (e: PointerEvent) => {
  if (!pendingDragId.value && !draggingId.value) return

  if (pendingDragId.value && !dragActivated) {
    const dx = e.clientX - pointerDownClient.x
    const dy = e.clientY - pointerDownClient.y
    if (Math.hypot(dx, dy) < dragThreshold.value) return
    dragActivated = true
    draggingId.value = pendingDragId.value
  }

  if (draggingId.value) {
    e.preventDefault()
    updateDragFromClient(e.clientX, e.clientY)
  }
}

const onDocumentPointerUp = () => {
  pendingDragId.value = null
  draggingId.value = null
  dragActivated = false
  unbindDocumentPointer()
}

const bindDocumentPointer = () => {
  document.addEventListener('pointermove', onDocumentPointerMove, { passive: false })
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
}

const unbindDocumentPointer = () => {
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('pointercancel', onDocumentPointerUp)
}

const onCanvasPointerDown = (e: PointerEvent) => {
  if (loading.value) return
  const container = imageContainerRef.value
  if (!container) return
  const bounds = container.getBoundingClientRect()
  const localX = e.clientX - bounds.left
  const localY = e.clientY - bounds.top

  pointerDownClient = { x: e.clientX, y: e.clientY }
  dragActivated = false
  unbindDocumentPointer()

  const hit = findMarkerAt(localX, localY)
  if (hit?.laxian_id) {
    selectedLaxianId.value = hit.laxian_id
    pendingDragId.value = hit.laxian_id
    addMode.value = false
    bindDocumentPointer()
    return
  }

  if (addMode.value) {
    const norm = pixelToNorm(localX, localY, contentRect.value)
    if (!norm) {
      toast.add({ title: '请在图片区域内标点', color: 'orange' })
      return
    }
    const laxianId = `laxian_${Date.now()}`
    const newItem: LaxianItem = {
      laxian_id: laxianId,
      title: `标点 ${laxianList.value.length + 1}`,
      type: 0,
      position: [norm.x, norm.y, currentImageIndex.value],
    }
    laxianList.value = [...laxianList.value, newItem]
    selectedLaxianId.value = laxianId
    addMode.value = false
    return
  }

  selectedLaxianId.value = null
}

const toggleAddMode = () => {
  addMode.value = !addMode.value
  if (addMode.value) {
    selectedLaxianId.value = null
    if (isMobile.value) mobileListOpen.value = false
  }
}

const addMarker = () => {
  addMode.value = true
  selectedLaxianId.value = null
  if (isMobile.value) {
    mobileListOpen.value = false
    return
  }
  toast.add({ title: '点击图片添加标点', color: 'blue' })
}

const toggleMobileList = () => {
  mobileListOpen.value = !mobileListOpen.value
  if (mobileListOpen.value) addMode.value = false
}

const closeMobileList = () => {
  mobileListOpen.value = false
}

const selectMarkerFromList = (id: string | undefined | null) => {
  selectedLaxianId.value = id ?? null
  closeMobileList()
}

const updateSelectedMarkerType = (e: Event) => {
  const marker = selectedMarker.value
  if (!marker) return
  updateMarkerMeta(marker, {
    type: Number((e.target as HTMLSelectElement).value) as 0 | 1,
  })
}

const blurSelectedMarkerTitle = () => {
  const marker = selectedMarker.value
  if (!marker) return
  updateMarkerMeta(marker, { title: marker.title })
}

const openSelectedDetailEdit = () => {
  const marker = selectedMarker.value
  if (!marker) return
  openDetailEdit(marker)
}

const removeSelectedMarker = () => {
  const marker = selectedMarker.value
  if (!marker) return
  removeMarker(marker)
}

const removeMarker = (item: LaxianItem) => {
  if (!item.laxian_id) return
  if (selectedLaxianId.value === item.laxian_id) selectedLaxianId.value = null
  laxianList.value = laxianList.value.filter((l) => l.laxian_id !== item.laxian_id)
}

const updateMarkerMeta = (item: LaxianItem, updates: Partial<Pick<LaxianItem, 'title' | 'type'>>) => {
  const idx = laxianList.value.findIndex((l) => l.laxian_id === item.laxian_id)
  if (idx < 0) return
  laxianList.value[idx] = { ...laxianList.value[idx], ...updates }
  laxianList.value = [...laxianList.value]
}

const openDetailEdit = (item: LaxianItem) => {
  detailEditItem.value = { ...item }
  showDetailEdit.value = true
}

watch(showDetailEdit, async (open) => {
  if (!open) return
  await nextTick()
  detailEditorRef.value?.setContentForEdit(detailEditItem.value?.detail || '')
})

const saveDetailEdit = () => {
  const laxianId = detailEditItem.value?.laxian_id
  if (!laxianId || !detailEditorRef.value) return
  const detail = detailEditorRef.value.getContent()
  const idx = laxianList.value.findIndex((l) => l.laxian_id === laxianId)
  if (idx >= 0) {
    laxianList.value[idx] = { ...laxianList.value[idx], detail }
    laxianList.value = [...laxianList.value]
  }
  showDetailEdit.value = false
  toast.add({ title: '详情已更新，记得保存', color: 'green' })
}

const saveLaxianJson = async () => {
  const videoId = video.value?.video_id
  if (videoId == null) return
  saving.value = true
  try {
    const existingJsonData = video.value?.json_data ?? {}
    const updated = await updateLibraryVideoJson({
      video_id: videoId,
      json_data: {
        ...existingJsonData,
        laxian_list: laxianList.value,
      },
    })
    video.value = updated
    laxianList.value = normalizeLaxian2dList(updated.json_data?.laxian_list)
    toast.add({ title: '保存成功', color: 'green' })
    emit('saved')
  } catch (err) {
    console.error(err)
    toast.add({ title: '保存失败', color: 'red' })
  } finally {
    saving.value = false
  }
}

const onImageLoad = () => {
  syncContentRect()
}

watch(show, (open) => {
  if (!open) {
    stopOverlayLoop()
    resizeObserver?.disconnect()
    resizeObserver = null
    unbindDocumentPointer()
  }
})

onBeforeUnmount(() => {
  stopOverlayLoop()
  resizeObserver?.disconnect()
  unbindDocumentPointer()
})

defineExpose({ openEditor })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :close-on-backdrop="false" @close="closeEditor">
    <div
      class="flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900"
      :class="isMobile
        ? 'h-[100dvh] w-[100vw] max-w-none rounded-none border-0'
        : 'h-[92vh] w-[96vw] max-w-6xl rounded-2xl border border-gray-200/60 dark:border-gray-700/60'"
    >
      <div
        class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700"
        :class="isMobile ? 'px-3 py-2.5' : 'px-4 py-3'"
      >
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-semibold text-gray-900 dark:text-gray-100" :class="isMobile ? 'text-sm' : 'text-base'">
            人台图标点
          </h2>
          <p v-if="video?.title && !isMobile" class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ video.title }} · 共 {{ totalMarkerCount }} 个标点
          </p>
        </div>
        <div v-if="!isMobile" class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
            :class="addMode ? 'ring-2 ring-purple-400' : ''"
            @click="toggleAddMode"
          >
            <UIcon name="i-heroicons-map-pin" class="h-3.5 w-3.5" />
            {{ addMode ? '点击图片放置' : '添加标点' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
            :disabled="saving || loading"
            @click="saveLaxianJson"
          >
            <UIcon name="i-heroicons-check" class="h-3.5 w-3.5" />
            {{ saving ? '保存中…' : '保存' }}
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="closeEditor"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="关闭"
          @click="closeEditor"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-gray-500">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col md:flex-row">
        <div class="flex min-h-0 flex-1 flex-col md:border-r md:border-gray-200 dark:md:border-gray-700">
          <div v-if="images.length > 1" class="flex shrink-0 gap-2 overflow-x-auto px-3 py-2">
            <button
              v-for="(img, idx) in images"
              :key="`${img}_${idx}`"
              type="button"
              class="relative shrink-0 overflow-hidden rounded-lg border-2 transition"
              :class="[
                isMobile ? 'h-12 w-12' : 'h-14 w-14',
                idx === currentImageIndex
                  ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800'
                  : 'border-gray-200 opacity-80 hover:opacity-100 dark:border-gray-600',
              ]"
              @click="switchImage(idx)"
            >
              <img
                :src="`${BASE_IMG}${img}?x-oss-process=image/quality,q_60/resize,w_120,h_120`"
                class="h-full w-full object-cover"
                alt=""
              />
              <span
                v-if="filterLaxianByImageIndex(laxianList, idx).length"
                class="absolute right-0.5 top-0.5 rounded-full bg-purple-500 px-1 text-[9px] font-semibold text-white"
              >
                {{ filterLaxianByImageIndex(laxianList, idx).length }}
              </span>
            </button>
          </div>

          <div class="relative min-h-0 flex-1" :class="isMobile ? 'px-2 pb-1 pt-1' : 'p-3'">
            <div
              ref="imageContainerRef"
              class="relative mx-auto h-full w-full max-w-3xl overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
              :class="isMobile ? 'min-h-[200px]' : 'min-h-[240px] max-h-[58vh]'"
            >
              <img
                v-if="currentImageSrc"
                ref="imageRef"
                :src="currentImageSrc"
                class="h-full w-full select-none object-contain"
                alt=""
                crossorigin="anonymous"
                draggable="false"
                @load="onImageLoad"
              />
              <canvas
                ref="canvasRef"
                class="absolute inset-0 touch-none"
                :class="addMode ? 'cursor-crosshair' : draggingId ? 'cursor-grabbing' : 'cursor-pointer'"
                @pointerdown="onCanvasPointerDown"
              />
            </div>
            <p
              v-if="!isMobile"
              class="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500"
            >
              点击已有标点可选中并拖动；{{ addMode ? '在图片上点击放置新标点' : '点「添加标点」后点击图片' }}
            </p>
            <p
              v-else-if="addMode"
              class="mt-1.5 text-center text-[11px] font-medium text-purple-600 dark:text-purple-400"
            >
              点击图片放置新标点
            </p>

            <!-- 手机端浮层：不参与文档流，避免挤压图片导致标点偏移 -->
            <template v-if="isMobile">
              <div
                v-if="mobileListOpen"
                class="absolute inset-0 z-10 bg-black/25"
                aria-hidden="true"
                @click="closeMobileList"
              />

              <!-- 选中标点：紧凑编辑条 -->
              <div
                v-if="showMobileSelectedPanel && selectedMarker"
                class="absolute inset-x-2 bottom-2 z-20 rounded-xl border border-purple-200/80 bg-white/95 p-2.5 shadow-lg backdrop-blur-sm dark:border-purple-700/60 dark:bg-gray-900/95"
              >
                <div class="mb-2 flex items-center gap-2">
                  <span
                    v-if="selectedMarkerIndex >= 0"
                    class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[selectedMarker.type === 1 ? 1 : 0].dot }"
                  >
                    {{ selectedMarkerIndex + 1 }}
                  </span>
                  <input
                    v-model="selectedMarker.title"
                    type="text"
                    class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    placeholder="标题"
                    @blur="blurSelectedMarkerTitle"
                  />
                  <button
                    type="button"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="取消选中"
                    @click="selectedLaxianId = null"
                  >
                    <UIcon name="i-heroicons-x-mark" class="h-4 w-4" />
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select
                    :value="selectedMarker.type ?? 0"
                    class="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    @change="updateSelectedMarkerType"
                  >
                    <option :value="0">{{ LAXIAN_2D_TYPE_THEME[0].label }}</option>
                    <option :value="1">{{ LAXIAN_2D_TYPE_THEME[1].label }}</option>
                  </select>
                  <button
                    type="button"
                    class="rounded-lg px-3 py-2 text-sm text-gray-600 active:bg-gray-200 dark:text-gray-300 dark:active:bg-gray-700"
                    @click="openSelectedDetailEdit"
                  >
                    详情
                  </button>
                  <button
                    type="button"
                    class="ml-auto rounded-lg px-3 py-2 text-sm text-red-500 active:bg-red-50 dark:active:bg-red-900/30"
                    @click="removeSelectedMarker"
                  >
                    删除
                  </button>
                </div>
              </div>

              <!-- 标点列表：底部抽屉浮层 -->
              <div
                v-if="mobileListOpen"
                class="absolute inset-x-0 bottom-0 z-20 flex max-h-[min(50dvh,420px)] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:border-gray-700 dark:bg-gray-900"
              >
                <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                  <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    当前图标点 ({{ markersOnCurrentImage.length }})
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-purple-600 dark:text-purple-400"
                      @click="addMarker"
                    >
                      + 添加
                    </button>
                    <button
                      type="button"
                      class="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="关闭列表"
                      @click="closeMobileList"
                    >
                      <UIcon name="i-heroicons-chevron-down" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
                  <div
                    v-if="markersOnCurrentImage.length === 0"
                    class="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-700"
                  >
                    当前图片暂无标点
                  </div>
                  <div
                    v-for="(item, i) in markersOnCurrentImage"
                    :key="item.laxian_id ?? i"
                    class="mb-2 rounded-xl border p-2.5 transition active:bg-purple-50/50 dark:active:bg-purple-900/10"
                    :class="selectedLaxianId === item.laxian_id
                      ? 'border-purple-400 bg-purple-50/80 dark:border-purple-600 dark:bg-purple-900/20'
                      : 'border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/60'"
                    @click="selectMarkerFromList(item.laxian_id)"
                  >
                    <div class="mb-2 flex items-center gap-2">
                      <span
                        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[item.type === 1 ? 1 : 0].dot }"
                      >
                        {{ i + 1 }}
                      </span>
                      <input
                        v-model="item.title"
                        type="text"
                        class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                        placeholder="标题"
                        @click.stop
                        @blur="updateMarkerMeta(item, { title: item.title })"
                      />
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <select
                        :value="item.type ?? 0"
                        class="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                        @click.stop
                        @change="(e) => updateMarkerMeta(item, { type: Number((e.target as HTMLSelectElement).value) as 0 | 1 })"
                      >
                        <option :value="0">{{ LAXIAN_2D_TYPE_THEME[0].label }}</option>
                        <option :value="1">{{ LAXIAN_2D_TYPE_THEME[1].label }}</option>
                      </select>
                      <button
                        type="button"
                        class="rounded-lg px-3 py-2 text-sm text-gray-600 active:bg-gray-200 dark:text-gray-300 dark:active:bg-gray-700"
                        @click.stop="openDetailEdit(item)"
                      >
                        详情
                      </button>
                      <button
                        type="button"
                        class="ml-auto rounded-lg px-3 py-2 text-sm text-red-500 active:bg-red-50 dark:active:bg-red-900/30"
                        @click.stop="removeMarker(item)"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 手机端底部操作栏 -->
          <div
            v-if="isMobile"
            class="shrink-0 border-t border-gray-200 px-3 py-2 dark:border-gray-700"
            :style="{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }"
          >
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium transition active:scale-[0.98]"
                :class="addMode
                  ? 'bg-purple-600 text-white ring-2 ring-purple-300 dark:ring-purple-700'
                  : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'"
                @click="toggleAddMode"
              >
                <UIcon name="i-heroicons-map-pin" class="h-4 w-4" />
                {{ addMode ? '点击图片放置' : '添加标点' }}
              </button>
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-500 py-3 text-sm font-medium text-white transition hover:bg-green-600 active:scale-[0.98] disabled:opacity-50"
                :disabled="saving || loading"
                @click="saveLaxianJson"
              >
                <UIcon name="i-heroicons-check" class="h-4 w-4" />
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button
                type="button"
                class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 transition active:scale-[0.98] dark:border-gray-600 dark:bg-gray-800"
                :class="mobileListOpen ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'"
                aria-label="标点列表"
                @click="toggleMobileList"
              >
                <UIcon name="i-heroicons-list-bullet" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <aside class="hidden w-full shrink-0 flex-col md:flex md:w-72 lg:w-80">
          <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">
              当前图标点 ({{ markersOnCurrentImage.length }})
            </span>
            <button
              type="button"
              class="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
              @click="addMarker"
            >
              + 添加
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div
              v-if="markersOnCurrentImage.length === 0"
              class="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center text-xs text-gray-400 dark:border-gray-700"
            >
              当前图片暂无标点
            </div>
            <div
              v-for="(item, i) in markersOnCurrentImage"
              :key="item.laxian_id ?? i"
              class="mb-2 rounded-xl border p-2 transition"
              :class="selectedLaxianId === item.laxian_id
                ? 'border-purple-400 bg-purple-50/80 dark:border-purple-600 dark:bg-purple-900/20'
                : 'border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/60'"
              @click="selectedLaxianId = item.laxian_id ?? null"
            >
              <div class="mb-2 flex items-center gap-2">
                <span
                  class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[item.type === 1 ? 1 : 0].dot }"
                >
                  {{ i + 1 }}
                </span>
                <input
                  v-model="item.title"
                  type="text"
                  class="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                  placeholder="标题"
                  @click.stop
                  @blur="updateMarkerMeta(item, { title: item.title })"
                />
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <select
                  :value="item.type ?? 0"
                  class="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                  @click.stop
                  @change="(e) => updateMarkerMeta(item, { type: Number((e.target as HTMLSelectElement).value) as 0 | 1 })"
                >
                  <option :value="0">{{ LAXIAN_2D_TYPE_THEME[0].label }}</option>
                  <option :value="1">{{ LAXIAN_2D_TYPE_THEME[1].label }}</option>
                </select>
                <button
                  type="button"
                  class="rounded px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                  @click.stop="openDetailEdit(item)"
                >
                  详情
                </button>
                <button
                  type="button"
                  class="ml-auto rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  @click.stop="removeMarker(item)"
                >
                  删除
                </button>
              </div>
              <p class="mt-1 text-[10px] text-gray-400">
                图 {{ getLaxian2dImageIndex(item) + 1 }} ·
                {{ Math.round(getLaxian2dNormPos(item).x * 100) }}%,
                {{ Math.round(getLaxian2dNormPos(item).y * 100) }}%
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </QhxModal>

  <QhxModal v-model="showDetailEdit" :close-on-backdrop="false">
    <div class="w-[95vw] max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div class="text-sm font-semibold">编辑标点详情</div>
        <div v-if="detailEditItem?.title" class="text-xs text-gray-500">{{ detailEditItem.title }}</div>
      </div>
      <div class="p-3">
        <QhxRichTextEditor ref="detailEditorRef" :toolbar="laxianDetailToolbar" />
      </div>
      <div class="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <UButton color="gray" variant="ghost" @click="showDetailEdit = false">取消</UButton>
        <UButton color="primary" @click="saveDetailEdit">确定</UButton>
      </div>
    </div>
  </QhxModal>
</template>
