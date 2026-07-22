<!--
  Qhx 图片灯箱：替代 vue-easy-lightbox，与站点粉色拟态主题一致。
  API：visible、imgs、index、zoomScale、maxZoom、laxianList，@hide
-->
<script setup lang="ts">
import { useConfigStore } from '@/stores/config'
import { computed, nextTick, onBeforeUnmount, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { LaxianItem } from '@/types/api'
import SafeRichText from '@/components/SafeRichText.vue'
import { parseRichText } from '@/utils/public'
import { useCommunityLivePlayback } from '@/composables/useCommunityLivePlayback'
import {
  computeImageContentRect,
  drawLaxian2dMarkers,
  filterLaxianByImageIndex,
  getLaxian2dNormPos,
  LAXIAN_2D_TYPE_THEME,
  normalizeLaxian2dList,
  normToPixel,
  type ImageContentRect,
} from '@/utils/libraryVideoLaxian2d'

export interface QhxLightboxImage {
  /** 封面 / 普通图 URL（Live 为同名 jpg） */
  src: string
  title?: string
  alt?: string
  /** Live：mp4 绝对 URL；有值时在封面加载后静音循环播放 */
  videoSrc?: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    imgs: QhxLightboxImage[]
    index?: number
    /** 滚轮缩放步进（与 vue-easy-lightbox 一致，默认 0.4） */
    zoomScale?: number
    /** 最大缩放倍数，0 或不传表示不限制 */
    maxZoom?: number
    /** 最小缩放倍数，默认 0.05 */
    minZoom?: number
    /** 2D 人台图标点（position = [归一化 x, y, 图片下标]） */
    laxianList?: LaxianItem[]
  }>(),
  {
    index: 0,
    zoomScale: 0.4,
    maxZoom: 0,
    minZoom: 0.05,
    laxianList: () => [],
  }
)

const emit = defineEmits<{
  hide: []
}>()

const configStore = useConfigStore()

/** App WebView statusbar + 系统安全区，与 scene/detail 等页一致 */
const safeTopInset = computed(() => {
  const bar = configStore.statusBarHeight || 0
  return `calc(0.75rem + max(env(safe-area-inset-top, 0px), ${bar}px))`
})

const closeButtonStyle = computed(() => ({
  top: safeTopInset.value,
  right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
}))

const viewportRef = ref<HTMLElement | null>(null)
const lightboxRootRef = ref<HTMLElement | null>(null)
const imageWrapRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const mediaRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageLoading = ref(true)
const imageError = ref(false)
const expandedLaxianId = ref<string | null>(null)
/** 按类型控制 2D 标点显示：0 设计元素，1 柄图元素 */
const showLaxianType0 = ref(true)
const showLaxianType1 = ref(true)

const currentIndex = ref(0)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const isPinching = ref(false)

const contentRect = shallowRef<ImageContentRect>({ offsetX: 0, offsetY: 0, width: 0, height: 0 })

let layoutResizeObserver: ResizeObserver | null = null

/** 按 object-fit: contain 适配视口的基准显示尺寸 */
const fittedImageSize = shallowRef({ width: 0, height: 0 })

/** 拖拽/缩放中暂存变换，避免每帧触发 Vue 重渲染 */
let liveTranslateX = 0
let liveTranslateY = 0
let liveScale = 1
let laxianRedrawRaf = 0
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
const laxianDetailCache = new Map<string, ReturnType<typeof parseRichText>>()

const normalizedLaxianList = computed(() => normalizeLaxian2dList(props.laxianList))
const hasAnyLaxian = computed(() => normalizedLaxianList.value.length > 0)
const hasLaxianType0 = computed(() =>
  normalizedLaxianList.value.some((item) => (item.type ?? 0) === 0),
)
const hasLaxianType1 = computed(() =>
  normalizedLaxianList.value.some((item) => item.type === 1),
)
const currentLaxianMarkers = computed(() =>
  filterLaxianByImageIndex(normalizedLaxianList.value, currentIndex.value),
)
const isLaxianTypeVisible = (type?: number) =>
  (type === 1 ? showLaxianType1.value : showLaxianType0.value)
const visibleLaxianMarkers = computed(() =>
  currentLaxianMarkers.value.filter((item) => isLaxianTypeVisible(item.type)),
)
const hasLaxianOnCurrent = computed(() => visibleLaxianMarkers.value.length > 0)
const laxianMarkerViews = computed(() => {
  const rect = contentRect.value
  const s = scale.value > 0 ? scale.value : 1
  const inv = 1 / s
  return visibleLaxianMarkers.value.map((item, i) => {
    const { x, y } = getLaxian2dNormPos(item)
    const { x: px, y: py } = normToPixel(x, y, rect)
    return {
      item,
      index: i,
      labelStyle: {
        left: `${px}px`,
        top: `${py}px`,
        transform: `translate3d(-50%, ${10 / s}px, 0) scale(${inv})`,
        transformOrigin: '50% 0',
      },
    }
  })
})
const currentLaxianType0Count = computed(() =>
  currentLaxianMarkers.value.filter((item) => (item.type ?? 0) === 0).length,
)
const currentLaxianType1Count = computed(() =>
  currentLaxianMarkers.value.filter((item) => item.type === 1).length,
)

let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0
let pinchStartDistance = 0
let pinchStartScale = 1

let originalBodyOverflow = ''
let originalHtmlOverflow = ''
let originalBodyTouchAction = ''
let originalHtmlOverscrollBehavior = ''

function preventRootTouchMove(e: TouchEvent) {
  const viewport = viewportRef.value
  const inViewport = viewport?.contains(e.target as Node)
  if (inViewport && e.touches.length >= 2) return
  e.preventDefault()
}

function preventRootWheel(e: WheelEvent) {
  const viewport = viewportRef.value
  if (viewport?.contains(e.target as Node)) return
  e.preventDefault()
}

function bindRootScrollLock(el: HTMLElement | null) {
  if (!el) return
  el.addEventListener('touchmove', preventRootTouchMove, { passive: false })
  el.addEventListener('wheel', preventRootWheel, { passive: false })
}

function unbindRootScrollLock(el: HTMLElement | null) {
  if (!el) return
  el.removeEventListener('touchmove', preventRootTouchMove)
  el.removeEventListener('wheel', preventRootWheel)
}

const slideCount = computed(() => props.imgs.length)
const currentImage = computed(() => props.imgs[currentIndex.value])
const currentLiveVideoSrc = computed(() => currentImage.value?.videoSrc?.trim() || '')
const isCurrentLive = computed(() => Boolean(currentLiveVideoSrc.value))
const hasMultiple = computed(() => slideCount.value > 1)

const toast = useToast()
const {
  loopEnabled: liveLoopEnabled,
  videoVisible: liveVideoPlaying,
  playFromStart: playLiveVideoIfNeeded,
  stop: stopLiveVideoRaw,
  onEnded: onLiveEnded,
  onBadgePointerDown: onLiveBadgePointerDown,
  onBadgePointerMove: onLiveBadgePointerMove,
  onBadgePointerUp: onLiveBadgePointerUp,
  onBadgePointerCancel: onLiveBadgePointerCancel,
  onBadgeClick: onLiveBadgeClick,
} = useCommunityLivePlayback({
  videoRef,
  getSrc: () => (props.visible ? currentLiveVideoSrc.value : undefined),
  shouldPlay: () =>
    Boolean(
      props.visible
      && currentLiveVideoSrc.value
      && !imageLoading.value
      && !imageError.value,
    ),
  onLoopChange: (enabled) => {
    toast.add({
      title: enabled ? '已开启循环播放' : '已关闭循环，仅播放一次',
      icon: enabled ? 'i-heroicons-arrow-path' : 'i-heroicons-stop',
      color: 'gray',
    })
  },
})

function stopLiveVideo() {
  stopLiveVideoRaw(true)
}
const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < slideCount.value - 1)
const hasTransform = computed(
  () => scale.value !== 1 || translateX.value !== 0 || translateY.value !== 0,
)

const imageSizeStyle = computed(() => {
  const { width, height } = fittedImageSize.value
  if (!width || !height) return {}
  return { width: `${width}px`, height: `${height}px` }
})

function syncLiveTransformFromRefs() {
  liveTranslateX = translateX.value
  liveTranslateY = translateY.value
  liveScale = scale.value
}

function applyMediaTransform() {
  const media = mediaRef.value
  if (!media) return
  const tx = isDragging.value || isPinching.value ? liveTranslateX : translateX.value
  const ty = isDragging.value || isPinching.value ? liveTranslateY : translateY.value
  const s = isPinching.value ? liveScale : scale.value
  media.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${s})`
  media.style.opacity = imageLoading.value || imageError.value ? '0' : '1'
  media.style.transition = isDragging.value || isPinching.value
    ? 'none'
    : 'transform 0.22s ease-out, opacity 0.2s ease'
}

function clearLaxianDetailCache() {
  laxianDetailCache.clear()
}

function updateFittedImageSize() {
  const viewport = viewportRef.value
  const img = imageRef.value
  if (!viewport || !img?.naturalWidth || !img.naturalHeight) {
    fittedImageSize.value = { width: 0, height: 0 }
    return
  }
  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  if (!vw || !vh) return
  const fit = Math.min(vw / img.naturalWidth, vh / img.naturalHeight)
  const width = img.naturalWidth * fit
  const height = img.naturalHeight * fit
  const prev = fittedImageSize.value
  if (prev.width === width && prev.height === height) return
  fittedImageSize.value = { width, height }
}

function syncImageLoadingState() {
  const img = imageRef.value
  if (!img || !currentImage.value?.src) {
    imageLoading.value = true
    imageError.value = false
    return
  }
  if (img.complete && img.naturalWidth > 0) {
    imageLoading.value = false
    imageError.value = false
    nextTick(() => {
      updateFittedImageSize()
      applyMediaTransform()
      syncLaxianOverlay()
      void playLiveVideoIfNeeded()
    })
    return
  }
  imageLoading.value = true
  imageError.value = false
}

function onImageLoad() {
  imageLoading.value = false
  imageError.value = false
  nextTick(() => {
    updateFittedImageSize()
    applyMediaTransform()
    syncLaxianOverlay()
    void playLiveVideoIfNeeded()
  })
}

function onImageError() {
  imageLoading.value = false
  imageError.value = true
  stopLiveVideo()
}

const getLaxianLabelBgClass = (type?: number) =>
  type === 1
    ? 'bg-teal-400/35 dark:bg-teal-500/30 border border-teal-200/60 dark:border-teal-700/50'
    : 'bg-purple-400/35 dark:bg-purple-500/30 border border-purple-200/60 dark:border-purple-700/50'

function getLaxianDetailNodes(item: LaxianItem) {
  const cacheKey = item.laxian_id ?? item.detail?.trim() ?? ''
  if (!cacheKey) return []
  const cached = laxianDetailCache.get(cacheKey)
  if (cached) return cached
  const html = item.detail?.trim()
  if (!html) return []
  try {
    const nodes = parseRichText(html)
    laxianDetailCache.set(cacheKey, nodes)
    return nodes
  } catch {
    return []
  }
}

const hasLaxianDetail = (item: LaxianItem) => Boolean(item.detail?.trim())

const isLaxianExpanded = (id?: string) => Boolean(id && expandedLaxianId.value === id)

const toggleLaxianExpand = (item: LaxianItem) => {
  const id = item.laxian_id
  if (!id || !hasLaxianDetail(item)) return
  expandedLaxianId.value = expandedLaxianId.value === id ? null : id
}

const collapseExpandedIfHidden = () => {
  if (!expandedLaxianId.value) return
  const item = normalizedLaxianList.value.find((l) => l.laxian_id === expandedLaxianId.value)
  if (!item || !isLaxianTypeVisible(item.type)) expandedLaxianId.value = null
}

const toggleLaxianType = (type: 0 | 1) => {
  if (type === 0) showLaxianType0.value = !showLaxianType0.value
  else showLaxianType1.value = !showLaxianType1.value
  collapseExpandedIfHidden()
  nextTick(syncLaxianOverlay)
}

const onLaxianLabelPointerDown = (e: PointerEvent) => {
  e.stopPropagation()
}

const syncContentRect = () => {
  const wrap = imageWrapRef.value
  const img = imageRef.value
  if (!wrap || !img?.naturalWidth || !img.naturalHeight) return
  const next = computeImageContentRect(
    wrap.clientWidth,
    wrap.clientHeight,
    img.naturalWidth,
    img.naturalHeight,
  )
  const prev = contentRect.value
  if (
    prev.offsetX === next.offsetX
    && prev.offsetY === next.offsetY
    && prev.width === next.width
    && prev.height === next.height
  ) {
    return
  }
  contentRect.value = next
}

let cachedCanvasDpr: number | null = null
const getCanvasDpr = () => {
  if (cachedCanvasDpr === null) {
    const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    cachedCanvasDpr = Math.min(raw, 2)
  }
  return cachedCanvasDpr
}

const drawLaxianOverlay = () => {
  const canvas = canvasRef.value
  const wrap = imageWrapRef.value
  if (!canvas || !wrap || !hasLaxianOnCurrent.value) return

  const dpr = getCanvasDpr()
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  if (!w || !h) return

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return

  const currentScale = isPinching.value ? liveScale : scale.value
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  drawLaxian2dMarkers(ctx, visibleLaxianMarkers.value, contentRect.value, null, currentScale)
}

function scheduleLaxianRedraw() {
  if (laxianRedrawRaf) return
  laxianRedrawRaf = requestAnimationFrame(() => {
    laxianRedrawRaf = 0
    if (!props.visible || !hasLaxianOnCurrent.value || imageLoading.value || imageError.value) return
    syncContentRect()
    drawLaxianOverlay()
  })
}

const syncLaxianOverlay = () => {
  if (props.visible && hasLaxianOnCurrent.value && !imageLoading.value && !imageError.value) {
    scheduleLaxianRedraw()
  }
}

function cancelLaxianRedraw() {
  if (laxianRedrawRaf) {
    cancelAnimationFrame(laxianRedrawRaf)
    laxianRedrawRaf = 0
  }
}

function onLayoutResize() {
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null
    updateFittedImageSize()
    applyMediaTransform()
    syncLaxianOverlay()
  }, 80)
}

const setupLayoutResizeObserver = () => {
  layoutResizeObserver?.disconnect()
  if (!viewportRef.value) return
  layoutResizeObserver = new ResizeObserver(onLayoutResize)
  layoutResizeObserver.observe(viewportRef.value)
}

const teardownLayoutResizeObserver = () => {
  layoutResizeObserver?.disconnect()
  layoutResizeObserver = null
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer)
    resizeDebounceTimer = null
  }
}

function clampScale(value: number) {
  const min = props.minZoom > 0 ? props.minZoom : 0.05
  const max = props.maxZoom > 0 ? props.maxZoom : Number.POSITIVE_INFINITY
  return Math.min(Math.max(value, min), max)
}

function resetTransform() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
  syncLiveTransformFromRefs()
  applyMediaTransform()
  scheduleLaxianRedraw()
}

function commitLiveTransform() {
  translateX.value = liveTranslateX
  translateY.value = liveTranslateY
  scale.value = liveScale
  applyMediaTransform()
}

function clampTranslate() {
  const viewport = viewportRef.value
  const img = imageRef.value
  if (!viewport || !img) return

  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  if (!vw || !vh) return

  const s = scale.value
  const scaledW = img.offsetWidth * s
  const scaledH = img.offsetHeight * s
  if (!scaledW || !scaledH) return

  if (scaledW > vw) {
    const maxTx = (scaledW - vw) / 2
    translateX.value = Math.min(maxTx, Math.max(-maxTx, translateX.value))
  }
  if (scaledH > vh) {
    const maxTy = (scaledH - vh) / 2
    translateY.value = Math.min(maxTy, Math.max(-maxTy, translateY.value))
  }
}

function hide() {
  emit('hide')
}

function goPrev() {
  if (!canGoPrev.value) return
  currentIndex.value -= 1
  expandedLaxianId.value = null
  resetTransform()
}

function goNext() {
  if (!canGoNext.value) return
  currentIndex.value += 1
  expandedLaxianId.value = null
  resetTransform()
}

const isClient = import.meta.client

function bindViewportWheel(el: HTMLElement | null) {
  if (!el) return
  el.addEventListener('wheel', applyWheelZoom, { passive: false })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
}

function unbindViewportWheel(el: HTMLElement | null) {
  if (!el) return
  el.removeEventListener('wheel', applyWheelZoom)
  el.removeEventListener('touchmove', onTouchMove)
}

function applyWheelZoom(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1 + props.zoomScale : 1 / (1 + props.zoomScale)
  scale.value = clampScale(scale.value * factor)
  syncLiveTransformFromRefs()
  clampTranslate()
  applyMediaTransform()
  scheduleLaxianRedraw()
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  syncLiveTransformFromRefs()
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOriginX = liveTranslateX
  dragOriginY = liveTranslateY
  applyMediaTransform()
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  liveTranslateX = dragOriginX + e.clientX - dragStartX
  liveTranslateY = dragOriginY + e.clientY - dragStartY
  applyMediaTransform()
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false
  commitLiveTransform()
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    syncLiveTransformFromRefs()
    isPinching.value = true
    isDragging.value = false
    const [t1, t2] = e.touches
    pinchStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    pinchStartScale = liveScale
    applyMediaTransform()
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isPinching.value || e.touches.length !== 2) return
  e.preventDefault()
  const [t1, t2] = e.touches
  const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  if (pinchStartDistance <= 0) return
  liveScale = clampScale(pinchStartScale * (distance / pinchStartDistance))
  applyMediaTransform()
  scheduleLaxianRedraw()
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2 && isPinching.value) {
    isPinching.value = false
    commitLiveTransform()
    clampTranslate()
    scheduleLaxianRedraw()
  }
}

function onDoubleClick() {
  if (scale.value > 1) {
    resetTransform()
    return
  }
  scale.value = clampScale(2)
  syncLiveTransformFromRefs()
  clampTranslate()
  applyMediaTransform()
  scheduleLaxianRedraw()
}

function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
    return
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goPrev()
    return
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    goNext()
  }
}

function disableBodyScroll() {
  if (!isClient) return
  originalBodyOverflow = document.body.style.overflow
  originalHtmlOverflow = document.documentElement.style.overflow
  originalBodyTouchAction = document.body.style.touchAction
  originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.touchAction = 'none'
  document.documentElement.style.overscrollBehavior = 'none'
}

function enableBodyScroll() {
  if (!isClient) return
  document.body.style.overflow = originalBodyOverflow
  document.documentElement.style.overflow = originalHtmlOverflow
  document.body.style.touchAction = originalBodyTouchAction
  document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior
}

watch(
  () => [props.visible, lightboxRootRef.value] as const,
  ([open, rootEl], _, onCleanup) => {
    if (!isClient || !rootEl) return
    if (open) {
      bindRootScrollLock(rootEl)
      onCleanup(() => unbindRootScrollLock(rootEl))
    } else {
      unbindRootScrollLock(rootEl)
    }
  }
)

watch(
  () => [props.visible, viewportRef.value] as const,
  ([open, el], _, onCleanup) => {
    if (!isClient || !el) return
    if (open) {
      bindViewportWheel(el)
      onCleanup(() => unbindViewportWheel(el))
    } else {
      unbindViewportWheel(el)
    }
  }
)

watch(
  () => props.visible,
  (open) => {
    if (!isClient) return
    if (open) {
      currentIndex.value = Math.min(Math.max(0, props.index), Math.max(0, slideCount.value - 1))
      expandedLaxianId.value = null
      showLaxianType0.value = true
      showLaxianType1.value = true
      resetTransform()
      imageLoading.value = true
      imageError.value = false
      disableBodyScroll()
      window.addEventListener('keydown', onKeydown)
      nextTick(() => {
        syncImageLoadingState()
        setupLayoutResizeObserver()
        updateFittedImageSize()
        applyMediaTransform()
        syncLaxianOverlay()
      })
    } else {
      enableBodyScroll()
      window.removeEventListener('keydown', onKeydown)
      resetTransform()
      expandedLaxianId.value = null
      cancelLaxianRedraw()
      clearLaxianDetailCache()
      teardownLayoutResizeObserver()
      stopLiveVideo()
    }
  },
  { immediate: true }
)

watch(
  () => [currentImage.value?.src, currentImage.value?.videoSrc] as const,
  () => {
    imageLoading.value = true
    imageError.value = false
    expandedLaxianId.value = null
    clearLaxianDetailCache()
    stopLiveVideo()
    nextTick(syncImageLoadingState)
  }
)

watch(
  () => [currentIndex.value, normalizedLaxianList.value.length, imageLoading.value, imageError.value, showLaxianType0.value, showLaxianType1.value] as const,
  () => {
    collapseExpandedIfHidden()
    nextTick(syncLaxianOverlay)
  }
)

watch(mediaRef, (el) => {
  if (el && props.visible) {
    syncLiveTransformFromRefs()
    applyMediaTransform()
    updateFittedImageSize()
    syncLaxianOverlay()
  }
})

watch(viewportRef, (el) => {
  if (el && props.visible) {
    setupLayoutResizeObserver()
    updateFittedImageSize()
    applyMediaTransform()
  }
})

watch([imageLoading, imageError], () => {
  applyMediaTransform()
})

watch(
  () => props.index,
  (v) => {
    if (!props.visible) return
    currentIndex.value = Math.min(Math.max(0, v), Math.max(0, slideCount.value - 1))
    resetTransform()
  }
)

watch(imageRef, () => {
  nextTick(syncImageLoadingState)
})

watch(videoRef, (el) => {
  if (el && props.visible && !imageLoading.value && !imageError.value) {
    void playLiveVideoIfNeeded()
  }
})

watch(fittedImageSize, () => {
  nextTick(syncContentRect)
})

onBeforeUnmount(() => {
  stopLiveVideo()
  cancelLaxianRedraw()
  teardownLayoutResizeObserver()
  clearLaxianDetailCache()
})

onUnmounted(() => {
  enableBodyScroll()
  unbindRootScrollLock(lightboxRootRef.value)
  unbindViewportWheel(viewportRef.value)
  if (isClient) {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="qhx-lightbox-fade">
        <div
          v-if="visible && slideCount > 0"
          ref="lightboxRootRef"
          class="qhx-lightbox fixed inset-0 z-[300] select-none"
          role="dialog"
          aria-modal="true"
          :aria-label="currentImage?.title || '图片预览'"
        >
          <div
            class="qhx-lightbox__backdrop absolute inset-0"
            @click="hide"
          />

          <header
            class="qhx-lightbox__header pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-3 px-3 pb-3 sm:px-5"
            :style="{ paddingTop: safeTopInset, paddingRight: 'calc(3.25rem + max(0.75rem, env(safe-area-inset-right, 0px)))' }"
          >
            <div class="min-w-0 flex-1 pe-2">
              <p
                v-if="currentImage?.title"
                class="qhx-lightbox__header-title truncate text-sm font-semibold text-gray-900 sm:text-base"
              >
                {{ currentImage.title }}
              </p>
              <p
                v-if="hasMultiple"
                class="qhx-lightbox__header-meta text-xs text-gray-600 tabular-nums"
                :class="{ 'mt-0.5': currentImage?.title }"
              >
                {{ currentIndex + 1 }} / {{ slideCount }}
              </p>
            </div>
          </header>

          <button
            type="button"
            class="qhx-lightbox__close absolute z-40 flex h-10 w-10 items-center justify-center rounded-xl outline-none transition active:scale-95"
            :style="closeButtonStyle"
            aria-label="关闭预览"
            @click="hide"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5 text-gray-900" />
          </button>

          <div class="qhx-lightbox__stage absolute inset-0 z-10">
            <div
              ref="viewportRef"
              class="qhx-lightbox__viewport absolute inset-0 overflow-hidden touch-none"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @touchstart.passive="onTouchStart"
              @touchend="onTouchEnd"
              @dblclick="onDoubleClick"
            >
              <div
                v-if="imageLoading"
                class="qhx-lightbox__loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-2"
                aria-live="polite"
                aria-busy="true"
              >
                <UIcon
                  name="i-heroicons-arrow-path"
                  class="h-8 w-8 animate-spin text-gray-900"
                />
                <span class="text-sm font-medium text-gray-900">加载中…</span>
              </div>
              <div
                v-else-if="imageError"
                class="qhx-lightbox__error absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center"
              >
                <UIcon name="i-heroicons-photo" class="h-8 w-8 text-gray-700" />
                <span class="text-sm font-medium text-gray-900">图片加载失败</span>
              </div>
              <div
                v-if="currentImage"
                ref="mediaRef"
                class="qhx-lightbox__media absolute left-1/2 top-1/2"
                :class="{
                  'pointer-events-none': imageLoading || imageError,
                  'qhx-lightbox__media--interacting': isDragging || isPinching,
                }"
              >
                <div
                  ref="imageWrapRef"
                  class="qhx-lightbox__image-wrap relative"
                  :style="imageSizeStyle"
                >
                  <img
                    ref="imageRef"
                    :key="currentImage.src"
                    :src="currentImage.src"
                    :alt="currentImage.alt || currentImage.title || '预览图'"
                    class="qhx-lightbox__img h-full w-full"
                    :class="[
                      isDragging ? 'cursor-grabbing' : 'cursor-grab',
                      isCurrentLive && liveVideoPlaying ? 'opacity-0' : 'opacity-100',
                    ]"
                    draggable="false"
                    @load="onImageLoad"
                    @error="onImageError"
                  />
                  <video
                    v-if="isCurrentLive"
                    ref="videoRef"
                    :key="`live-${currentLiveVideoSrc}`"
                    class="qhx-lightbox__live-video absolute inset-0 h-full w-full object-contain"
                    :class="liveVideoPlaying ? 'opacity-100' : 'opacity-0'"
                    muted
                    playsinline
                    webkit-playsinline
                    preload="auto"
                    disablepictureinpicture
                    @ended="onLiveEnded"
                  />
                  <button
                    v-if="isCurrentLive"
                    type="button"
                    class="qhx-lightbox__live-badge absolute left-2 top-2 z-[5] rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    :class="{ 'qhx-lightbox__live-badge--loop': liveLoopEnabled }"
                    data-live-badge
                    :aria-label="liveLoopEnabled ? '重播；长按关闭循环' : '重播；长按开启循环'"
                    :title="liveLoopEnabled ? '点击重播 · 长按关闭循环' : '点击重播 · 长按开启循环'"
                    @click.stop="onLiveBadgeClick"
                    @mousedown.stop="onLiveBadgePointerDown"
                    @mousemove.stop="onLiveBadgePointerMove"
                    @mouseup.stop="onLiveBadgePointerUp"
                    @mouseleave="onLiveBadgePointerCancel"
                    @touchstart.stop.prevent="onLiveBadgePointerDown"
                    @touchmove.stop.prevent="onLiveBadgePointerMove"
                    @touchend.stop.prevent="onLiveBadgePointerUp"
                    @touchcancel.stop="onLiveBadgePointerCancel"
                    @contextmenu.prevent
                    @pointerdown.stop
                  >
                    LIVE
                    <span v-if="liveLoopEnabled" class="ml-0.5 opacity-90" aria-hidden="true">∞</span>
                  </button>
                  <canvas
                    v-if="hasLaxianOnCurrent"
                    ref="canvasRef"
                    class="qhx-lightbox__laxian-canvas pointer-events-none absolute inset-0"
                    aria-hidden="true"
                  />
                  <div
                    v-if="hasLaxianOnCurrent"
                    class="qhx-lightbox__laxian-labels pointer-events-none absolute inset-0"
                  >
                    <div
                      v-for="marker in laxianMarkerViews"
                      :key="marker.item.laxian_id ?? `laxian-${marker.index}`"
                      class="qhx-lightbox__laxian-label absolute z-[1] w-max max-w-[min(240px,calc(100vw-3rem))]"
                      :style="marker.labelStyle"
                    >
                    <button
                      type="button"
                      class="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-left text-[11px] font-medium text-gray-900 shadow-sm backdrop-blur-sm transition hover:brightness-105"
                      :class="[
                        getLaxianLabelBgClass(marker.item.type),
                        hasLaxianDetail(marker.item) ? 'cursor-pointer' : 'cursor-default',
                        isLaxianExpanded(marker.item.laxian_id) ? 'ring-2 ring-white/70' : '',
                      ]"
                      @pointerdown="onLaxianLabelPointerDown"
                      @click.stop="toggleLaxianExpand(marker.item)"
                    >
                      <span
                        class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                        :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[marker.item.type === 1 ? 1 : 0].dot }"
                      >
                        {{ marker.index + 1 }}
                      </span>
                      <span class="truncate">{{ marker.item.title || '标点' }}</span>
                      <UIcon
                        v-if="hasLaxianDetail(marker.item)"
                        :name="isLaxianExpanded(marker.item.laxian_id)
                          ? 'i-heroicons-chevron-up-20-solid'
                          : 'i-heroicons-chevron-down-20-solid'"
                        class="h-3.5 w-3.5 shrink-0 opacity-70"
                      />
                    </button>
                    <Transition name="qhx-laxian-detail">
                      <div
                        v-if="isLaxianExpanded(marker.item.laxian_id)"
                        class="pointer-events-auto mt-1 overflow-hidden rounded-xl border border-white/60 bg-white/92 p-2 shadow-lg backdrop-blur-sm dark:border-gray-600/50 dark:bg-gray-900/92"
                        @pointerdown="onLaxianLabelPointerDown"
                        @click.stop
                      >
                        <SafeRichText
                          v-if="getLaxianDetailNodes(marker.item).length"
                          :nodes="getLaxianDetailNodes(marker.item)"
                          class="qhx-lightbox__laxian-detail text-xs text-gray-700 dark:text-gray-200 max-h-[30vh] overflow-y-auto overscroll-contain"
                        />
                        <p v-else class="py-2 text-center text-xs text-gray-400">暂无详情</p>
                      </div>
                    </Transition>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="hasMultiple"
              type="button"
              class="qhx-lightbox__nav qhx-lightbox__nav--prev absolute z-30"
              :style="{ left: 'max(0.5rem, env(safe-area-inset-left, 0px))', top: '50%', transform: 'translateY(-50%)' }"
              :disabled="!canGoPrev"
              aria-label="上一张"
              @click="goPrev"
            >
              <UIcon name="i-heroicons-chevron-left-20-solid" class="h-6 w-6 text-gray-900" />
            </button>

            <button
              v-if="hasMultiple"
              type="button"
              class="qhx-lightbox__nav qhx-lightbox__nav--next absolute z-30"
              :style="{ right: 'max(0.5rem, env(safe-area-inset-right, 0px))', top: '50%', transform: 'translateY(-50%)' }"
              :disabled="!canGoNext"
              aria-label="下一张"
              @click="goNext"
            >
              <UIcon name="i-heroicons-chevron-right-20-solid" class="h-6 w-6 text-gray-900" />
            </button>
          </div>

          <footer
            v-if="hasAnyLaxian || hasTransform"
            class="qhx-lightbox__footer absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          >
            <div
              v-if="hasAnyLaxian || hasTransform"
              class="qhx-lightbox__toolbar flex flex-wrap items-center justify-center gap-2"
            >
              <button
                v-if="hasLaxianType0"
                type="button"
                class="qhx-lightbox__toolbar-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium outline-none transition active:scale-95"
                :class="showLaxianType0
                  ? 'qhx-lightbox__toolbar-btn--purple text-purple-700'
                  : 'qhx-lightbox__toolbar-btn--muted text-gray-500'"
                :aria-pressed="showLaxianType0"
                @click="toggleLaxianType(0)"
              >
                <span
                  class="inline-flex h-2 w-2 shrink-0 rounded-full"
                  :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[0].dot }"
                />
                <span>{{ LAXIAN_2D_TYPE_THEME[0].label }}</span>
                <span
                  v-if="currentLaxianType0Count > 0"
                  class="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                  :class="showLaxianType0
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-200 text-gray-500'"
                >
                  {{ currentLaxianType0Count }}
                </span>
              </button>
              <button
                v-if="hasLaxianType1"
                type="button"
                class="qhx-lightbox__toolbar-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium outline-none transition active:scale-95"
                :class="showLaxianType1
                  ? 'qhx-lightbox__toolbar-btn--teal text-teal-700'
                  : 'qhx-lightbox__toolbar-btn--muted text-gray-500'"
                :aria-pressed="showLaxianType1"
                @click="toggleLaxianType(1)"
              >
                <span
                  class="inline-flex h-2 w-2 shrink-0 rounded-full"
                  :style="{ backgroundColor: LAXIAN_2D_TYPE_THEME[1].dot }"
                />
                <span>{{ LAXIAN_2D_TYPE_THEME[1].label }}</span>
                <span
                  v-if="currentLaxianType1Count > 0"
                  class="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                  :class="showLaxianType1
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-gray-200 text-gray-500'"
                >
                  {{ currentLaxianType1Count }}
                </span>
              </button>
              <button
                v-if="hasTransform"
                type="button"
                class="qhx-lightbox__toolbar-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-gray-700 outline-none transition active:scale-95"
                aria-label="复原视图"
                @click="resetTransform"
              >
                <UIcon name="i-heroicons-arrow-path" class="h-3.5 w-3.5 shrink-0" />
                <span>复原</span>
              </button>
            </div>
            <p
              v-if="hasTransform"
              class="qhx-lightbox__footer-hint text-center text-[11px] text-gray-600"
            >
              滚轮或双指缩放 · 拖动平移 · 双击缩放/还原
            </p>
          </footer>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.qhx-lightbox {
  width: 100%;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}

.qhx-lightbox__stage {
  overflow: visible;
  pointer-events: none;
}

.qhx-lightbox__stage .qhx-lightbox__nav,
.qhx-lightbox__stage .qhx-lightbox__viewport {
  pointer-events: auto;
}

.qhx-lightbox__viewport {
  overflow: hidden;
}

.qhx-lightbox__loading,
.qhx-lightbox__error {
  pointer-events: none;
}

.qhx-lightbox__backdrop {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px);
}

.qhx-lightbox__header {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.28) 55%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(6px);
}

.qhx-lightbox__header-title,
.qhx-lightbox__header-meta {
  display: inline-block;
  max-width: 100%;
  padding: 0.2rem 0.55rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(8px);
}

.qhx-lightbox__close {
  color: #111827;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.65);
}

.qhx-lightbox__close:hover {
  background: rgba(255, 255, 255, 0.94);
  color: #000;
}

.qhx-lightbox__nav {
  display: flex;
  height: 2.75rem;
  width: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #111827;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.65);
  outline: none;
  transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}

.qhx-lightbox__nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.94);
}

.qhx-lightbox__nav:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}

.qhx-lightbox__img {
  display: block;
  object-fit: contain;
  transform-origin: center center;
  transition: opacity 0.15s ease;
}

.qhx-lightbox__live-video {
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.qhx-lightbox__live-badge {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  line-height: 1.2;
  pointer-events: auto;
}

.qhx-lightbox__live-badge--loop {
  background: rgba(199, 107, 152, 0.85);
  border-color: rgba(255, 255, 255, 0.35);
}

.qhx-lightbox__media {
  transform-origin: center center;
}

.qhx-lightbox__media--interacting {
  will-change: transform;
}

.qhx-lightbox__laxian-canvas {
  width: 100%;
  height: 100%;
}

.qhx-lightbox__laxian-detail :deep(img) {
  max-width: 100%;
  height: auto;
}

.qhx-laxian-detail-enter-active,
.qhx-laxian-detail-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.qhx-laxian-detail-enter-from,
.qhx-laxian-detail-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.qhx-lightbox__footer {
  pointer-events: none;
  background: linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.2) 45%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(4px);
}

.qhx-lightbox__toolbar {
  pointer-events: auto;
}

.qhx-lightbox__footer-hint {
  padding: 0.2rem 0.65rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.qhx-lightbox__toolbar-btn {
  color: #374151;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.qhx-lightbox__toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.96);
}

.qhx-lightbox__toolbar-btn--purple {
  background: rgba(243, 232, 255, 0.95);
  border-color: rgba(147, 51, 234, 0.22);
  box-shadow: 0 2px 12px rgba(147, 51, 234, 0.12);
}

.qhx-lightbox__toolbar-btn--teal {
  background: rgba(204, 251, 241, 0.95);
  border-color: rgba(20, 184, 166, 0.22);
  box-shadow: 0 2px 12px rgba(20, 184, 166, 0.12);
}

.qhx-lightbox__toolbar-btn--muted {
  opacity: 0.72;
  background: rgba(255, 255, 255, 0.72);
  border-style: dashed;
}

.qhx-lightbox-fade-enter-active,
.qhx-lightbox-fade-leave-active {
  transition: opacity 0.28s ease;
}

.qhx-lightbox-fade-enter-from,
.qhx-lightbox-fade-leave-to {
  opacity: 0;
}
</style>
