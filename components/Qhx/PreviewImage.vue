<script setup lang="ts">
import type { LaxianItem } from '@/types/api'
import {
  isHtml5PlusWebView,
  useSaveNetworkImageToAlbum,
} from '@/composables/useSaveNetworkImageToAlbum'
import {
  isCommunityLivePath,
  normalizeCommunityMediaPath,
  normalizeRawImgPath,
  toAbsoluteMediaUrl,
  toCommunityLivePosterPath,
} from '@/utils/communityLiveMedia'
import { BASE_IMG } from '@/utils/ipConfig'

interface Image {
  src: string
  alt?: string
  title?: string
  /** Live 视频相对或绝对路径；有则缩略图显示 LIVE 角标，Lightbox 可播 */
  videoSrc?: string
}

interface LightboxImage {
  src: string
  title?: string
  alt?: string
  videoSrc?: string
}

interface Props {
  className?: string
  list: Array<Image>
  preview?: Array<string> | Image[]
  /** 2D 人台图标点，大图预览时叠加显示 */
  laxianList?: LaxianItem[]
}
const emit = defineEmits(['load'])
const visible = ref(false)
const index = ref(0)
const props = withDefaults(defineProps<Props>(), {
  laxianList: () => [],
})

const toast = useToast()
const { saving: savingImage, saveImage } = useSaveNetworkImageToAlbum()
const isAppWebView = computed(() => isHtml5PlusWebView())

const menuVisible = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const menuImageIndex = ref(0)
const suppressNextClick = ref(false)

const LONG_PRESS_MS = 480
const MOVE_CANCEL_PX = 10
const MENU_WIDTH = 168
const MENU_HEIGHT = 48

let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStartX = 0
let pressStartY = 0
let originalBodyOverflow = ''
let originalHtmlOverflow = ''

function disableBodyScroll() {
  if (!import.meta.client) return
  originalBodyOverflow = document.body.style.overflow
  originalHtmlOverflow = document.documentElement.style.overflow
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

function enableBodyScroll() {
  if (!import.meta.client) return
  document.body.style.overflow = originalBodyOverflow
  document.documentElement.style.overflow = originalHtmlOverflow
}

function preventMenuTouchMove(e: TouchEvent) {
  e.preventDefault()
}

const saveMenuLabel = computed(() =>
  isAppWebView.value ? '保存到相册' : '保存图片'
)

const menuStyle = computed(() => {
  if (!import.meta.client) return {}
  const pad = 8
  const x = Math.min(
    Math.max(pad, menuPos.value.x),
    window.innerWidth - MENU_WIDTH - pad
  )
  const y = Math.min(
    Math.max(pad, menuPos.value.y),
    window.innerHeight - MENU_HEIGHT - pad
  )
  return { left: `${x}px`, top: `${y}px` }
})

function resolveThumbSrc(image: Image): string {
  const raw = normalizeRawImgPath(image.src)
  if (image.videoSrc || isCommunityLivePath(raw)) {
    return toCommunityLivePosterPath(raw)
  }
  return raw
}

function isLiveThumb(image: Image): boolean {
  if (image.videoSrc?.trim()) return true
  return isCommunityLivePath(image.src)
}

function toLightboxSrc(item: string | Image): LightboxImage {
  if (typeof item === 'string') {
    const media = normalizeCommunityMediaPath(item)
    return {
      src: toAbsoluteMediaUrl(media.displayPath),
      videoSrc: media.videoPath ? toAbsoluteMediaUrl(media.videoPath) : undefined,
    }
  }
  const media = normalizeCommunityMediaPath(item.src)
  const videoRel = item.videoSrc
    ? normalizeRawImgPath(item.videoSrc)
    : media.videoPath
  return {
    src: toAbsoluteMediaUrl(media.kind === 'live' ? media.displayPath : normalizeRawImgPath(item.src)),
    videoSrc: videoRel ? toAbsoluteMediaUrl(videoRel.replace(/\?.*$/, '')) : undefined,
    title: item.title,
    alt: item.alt,
  }
}

const lightboxImgs = computed<LightboxImage[]>(() => {
  const source = props.preview?.length ? props.preview : props.list
  return source.map(toLightboxSrc)
})

function clearPressTimer() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function openMenu(imageIndex: number, clientX: number, clientY: number) {
  menuImageIndex.value = imageIndex
  menuPos.value = { x: clientX, y: clientY }
  menuVisible.value = true
  suppressNextClick.value = true
  disableBodyScroll()
  if (import.meta.client && navigator.vibrate) {
    navigator.vibrate(12)
  }
}

function closeMenu() {
  if (!menuVisible.value) return
  menuVisible.value = false
  enableBodyScroll()
}

function getPointerPoint(e: MouseEvent | TouchEvent) {
  if ('touches' in e) {
    return e.touches[0] ?? e.changedTouches[0]
  }
  return e
}

function onImgPressStart(e: MouseEvent | TouchEvent, imageIndex: number) {
  if ('button' in e && e.button !== 0) return
  const point = getPointerPoint(e)
  if (!point) return
  pressStartX = point.clientX
  pressStartY = point.clientY
  clearPressTimer()
  pressTimer = setTimeout(() => {
    openMenu(imageIndex, point.clientX, point.clientY)
    clearPressTimer()
  }, LONG_PRESS_MS)
}

function onImgPressMove(e: MouseEvent | TouchEvent) {
  const point = getPointerPoint(e)
  if (!point) return
  if (Math.hypot(point.clientX - pressStartX, point.clientY - pressStartY) > MOVE_CANCEL_PX) {
    clearPressTimer()
  }
}

function onImgPressEnd() {
  clearPressTimer()
}

function onImgContextMenu(e: MouseEvent, imageIndex: number) {
  e.preventDefault()
  openMenu(imageIndex, e.clientX, e.clientY)
}

const handleClick = (i: number) => {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  if (menuVisible.value) {
    closeMenu()
    return
  }
  visible.value = true
  index.value = i
}

async function handleSaveImage() {
  const url = lightboxImgs.value[menuImageIndex.value]?.src?.trim()
  closeMenu()
  if (!url) {
    toast.add({
      title: '没有可保存的图片',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }
  try {
    const result = await saveImage(url, {
      docFilename: `_doc/preview_${Date.now()}.jpg`,
      filename: `lolita_${Date.now()}.jpg`,
    })
    if (result === 'album') {
      toast.add({ title: '已保存到相册', color: 'green', icon: 'i-heroicons-check-circle' })
      return
    }
    if (result === 'opened') {
      toast.add({
        title: '已打开图片，长按可选择保存',
        color: 'blue',
        icon: 'i-heroicons-information-circle',
      })
      return
    }
    toast.add({ title: '已开始下载', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({
      title: isAppWebView.value
        ? '保存失败，请检查网络与相册权限'
        : '保存失败，请检查网络或尝试右键另存为',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const load = () => {
  emit('load')
}

onUnmounted(() => {
  clearPressTimer()
  enableBodyScroll()
})

const menuBackdropRef = ref<HTMLElement | null>(null)

watch(menuVisible, (open) => {
  if (!import.meta.client) return
  nextTick(() => {
    const el = menuBackdropRef.value
    if (!el) return
    if (open) {
      el.addEventListener('touchmove', preventMenuTouchMove, { passive: false })
    } else {
      el.removeEventListener('touchmove', preventMenuTouchMove)
    }
  })
})
</script>
<template>
  <div
    v-for="(image, i) in list"
    :key="`${image.src}-${i}`"
    class="preview-image-cell relative inline-block align-top"
    :class="props.className ? `${props.className}` : ''"
  >
    <img
      :src="`${BASE_IMG}${resolveThumbSrc(image)}`"
      :alt="image.alt || 'Lo研社 嘎嘎'"
      class="preview-image-thumb h-full w-full object-cover"
      loading="lazy"
      draggable="false"
      @click="handleClick(i)"
      @load="load"
      @mousedown="onImgPressStart($event, i)"
      @mousemove="onImgPressMove"
      @mouseup="onImgPressEnd"
      @mouseleave="onImgPressEnd"
      @touchstart.passive="onImgPressStart($event, i)"
      @touchmove.passive="onImgPressMove"
      @touchend="onImgPressEnd"
      @touchcancel="onImgPressEnd"
      @contextmenu="onImgContextMenu($event, i)"
    />
    <span
      v-if="isLiveThumb(image)"
      class="preview-image-live-badge pointer-events-none absolute left-1 top-1 z-[2] rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
      aria-hidden="true"
    >
      LIVE
    </span>
  </div>
  <slot />

  <ClientOnly>
    <Teleport to="body">
      <div
        v-if="menuVisible"
        ref="menuBackdropRef"
        class="preview-image-menu-backdrop fixed inset-0 z-[340]"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      />
      <div
        v-if="menuVisible"
        class="preview-image-menu fixed z-[341] min-w-[168px] overflow-hidden rounded-xl shadow-xl"
        :style="menuStyle"
        role="menu"
        @click.stop
      >
        <button
          type="button"
          class="preview-image-menu__item flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-55"
          role="menuitem"
          :disabled="savingImage"
          @click="handleSaveImage"
        >
          <UIcon
            :name="savingImage ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-down-tray'"
            class="h-4 w-4 shrink-0 text-gray-900"
            :class="{ 'animate-spin': savingImage }"
          />
          <span>{{ savingImage ? '保存中…' : saveMenuLabel }}</span>
        </button>
      </div>
    </Teleport>
  </ClientOnly>

  <QhxImageLightbox
    :visible="visible"
    :imgs="lightboxImgs"
    :index="index"
    :laxian-list="laxianList"
    @hide="visible = false"
  />
</template>

<style scoped>
.preview-image-thumb {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.preview-image-live-badge {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  letter-spacing: 0.04em;
}

.preview-image-menu-backdrop {
  width: 100%;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px);
}

.preview-image-menu {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
}

.preview-image-menu__item {
  color: #111827;
}

.preview-image-menu__item:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.qhx-tags-list{
	background: #fff;
	border-radius: 20px;
	margin: 2px;
	font-size: 12px;
	white-space: nowrap;
	transition: 0.3s;
	display: inline-block;
}
</style>
