<template>
  <div :class="props.compact ? 'image-picker' : 'image-picker space-y-4'">
    <!-- 拖拽上传区：仅桌面浏览器；手机 / 原生壳不展示 -->
    <div
      v-if="showDesktopDropZone"
      class="hidden md:block w-full border-2 border-dashed border-gray-300 p-4 text-center rounded-lg"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      {{ dropHint }}
    </div>

    <!-- 预览区 -->
    <div class="picker-list w-full" @selectstart.prevent>
      <!-- <div
        v-for="(img, index) in previewImages"
        :key="index"
        class="relative group"
      >
        <UCard>
          <img :src="img.url" alt="预览图" class="w-full h-32 object-cover rounded" />
        </UCard>

        <UButton
          icon="i-heroicons-x-mark"
          color="red"
          size="2xs"
          variant="soft"
          class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
          @click="removeImage(index)"
        />
      </div> -->

      <Draggable :scroll="true" :scroll-sensitivity="150" :scroll-speed="15" :fallback-tolerance="0"
        :forceFallback="true" :delay="150" :disabled="!props.multiple || props.disabled"
        item-key="id" animation="300"
        v-model="previewImages"
        ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging" class=" flex flex-wrap">
        <template #header>
          <div
            v-if="showAddTile"
            :class="tileClass"
          >
            <div
              :class="tilePadClass"
            >
              <div
                class="picker-square w-full relative shadow-xl rounded-xl border border-gray-200 bg-gray-50/90 overflow-hidden"
                @dragover.prevent="onPickerDragOver"
                @drop.prevent="handleDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  :accept="fileAccept"
                  :multiple="multiple"
                  :class="isMobile && !props.allowLive && !useNativePicker
                    ? 'absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 touch-manipulation'
                    : 'picker-file-input'"
                  @change="handleFiles"
                  @dragover.prevent="onPickerDragOver"
                  @drop.prevent.stop="handleDrop"
                />
                <input
                  v-if="props.allowLive"
                  ref="liveFileInput"
                  type="file"
                  :accept="LIVE_ACCEPT"
                  :multiple="multiple"
                  class="picker-file-input"
                  @change="handleFiles"
                />
                <button
                  v-if="!isMobile"
                  type="button"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-qhx-primary hover:bg-qhx-primary/5 hover:border-qhx-primary/35 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary/50 focus-visible:ring-offset-2"
                  @click="triggerInput"
                  @dragover.prevent="onPickerDragOver"
                  @drop.prevent="handleDrop"
                >
                  <UIcon class="size-9 text-qhx-primary/80" name="i-heroicons-photo" />
                  <span class="text-xs font-medium px-1 text-center leading-tight">{{ pickerActionLabel }}</span>
                </button>
                <button
                  v-else-if="props.allowLive || useNativePicker"
                  type="button"
                  class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 text-gray-500 cursor-pointer touch-manipulation"
                  @click="onMobilePickerTap"
                >
                  <UIcon class="size-9 text-qhx-primary/80" name="i-heroicons-photo" />
                  <span class="text-xs font-medium px-1 text-center leading-tight">{{ pickerActionLabel }}</span>
                </button>
                <div
                  v-else
                  class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-500 pointer-events-none"
                  aria-hidden="true"
                >
                  <UIcon class="size-9 text-qhx-primary/80" name="i-heroicons-photo" />
                  <span class="text-xs font-medium px-1 text-center leading-tight">{{ pickerActionLabel }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #item="{ element, index }">
          <transition-group tag="div"
            :class="tileClass" name="list">
            <div
              :class="['group drag-handle no-long-press', tilePadClass]">
              <div class="picker-square w-full relative shadow-xl">
                <img :src="element.url" draggable="false"
                  class="absolute inset-0 h-full w-full object-cover rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                  loading="lazy">
                </img>
                <span
                  v-if="element.kind === 'live'"
                  class="picker-live-badge pointer-events-none absolute left-1 bottom-1 z-10 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                >LIVE</span>
                <UButton v-if="!props.disabled" icon="i-heroicons-x-mark" color="red" size="2xs" variant="soft"
                  class="absolute top-1 right-1 z-10" @click="removeImage(index)" />
                <!-- 透明遮罩：避免移动端误触长按；单击打开大图预览 -->
                <div
                  class="absolute z-[1] w-full h-full inset-0 rounded-xl cursor-zoom-in no-long-press"
                  style="background: transparent;"
                  @click.stop="openLightbox(index)"
                />
              </div>
            </div>
          </transition-group>
        </template>
      </Draggable>
      <ClientOnly>
        <QhxImageLightbox
          :visible="lightboxVisible"
          :imgs="lightboxImgs"
          :index="lightboxIndex"
          @hide="lightboxVisible = false"
        />
        <Teleport to="body">
          <div
            v-if="mobileLiveSheetOpen"
            class="fixed inset-0 z-[260] flex items-end justify-center bg-black/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            @click="mobileLiveSheetOpen = false"
          >
            <div
              class="w-[min(100%,22rem)] overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800"
              @click.stop
            >
              <p class="px-4 pt-4 pb-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                {{ t('qhx.imagePicker.pick_type') }}
              </p>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200"
                @click="pickImages"
              >
                <UIcon name="i-heroicons-photo" class="size-5 text-qhx-primary" />
                <span>{{ t('qhx.imagePicker.pick_image') }}</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200"
                @click="pickLiveVideo"
              >
                <UIcon name="i-heroicons-video-camera" class="size-5 text-qhx-primary" />
                <span>{{ t('qhx.imagePicker.pick_live', { sec: liveMaxDurationSec }) }}</span>
              </button>
              <button
                type="button"
                class="w-full border-t border-gray-100 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
                @click="mobileLiveSheetOpen = false"
              >
                {{ t('common.cancel') }}
              </button>
            </div>
          </div>
        </Teleport>
      </ClientOnly>
      <!-- <Draggable :forceFallback="true" :disabled="!props.multiple || props.disabled" :delay="150"
        v-model="previewImages" item-key="id" animation="250" ghost-class="drag-ghost" chosen-class="drag-chosen"
        drag-class="dragging" class="grid grid-cols-3 gap-4">
        <template #item="{ element, index }">

          <div class="relative group aspect-square">
            <img :src="element.url" alt="预览图" class="w-full h-full aspect-square object-cover rounded no-long-press" />
            <UButton v-if="!props.disabled" icon="i-heroicons-x-mark" color="red" size="2xs" variant="soft"
              class="absolute top-1 right-1 z-10" @click="removeImage(index)" />
          </div>
        </template>
      </Draggable> -->
    </div>

    <label
      v-if="!props.disabled && !props.compact"
      class="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400"
    >
      <UCheckbox v-model="compressEnabled" />
      <span>{{ t('qhx.imagePicker.compress') }}</span>
      <span class="text-xs text-gray-400">{{ t('qhx.imagePicker.compress_hint') }}</span>
    </label>
    <p
      v-if="props.allowLive && !props.disabled"
      class="text-xs text-gray-400 dark:text-gray-500"
    >
      {{ t('qhx.imagePicker.live_hint', { sec: liveMaxDurationSec }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import Draggable from "vuedraggable"
import { BASE_IMG } from '@/utils/ipConfig'
import { useImageUploadStore } from '@/stores/imageUpload'
import { ensureAllowedImageForUpload, ImageConvertError } from '@/utils/heicUploadGate'
import {
  isCommunityLivePath,
  toAbsoluteMediaUrl,
  toCommunityLivePosterPath,
} from '@/utils/communityLiveMedia'
import {
  extractEmbeddedLiveVideo,
  pairLivePhotoFiles,
} from '@/utils/livePhotoExtract'
import {
  isLikelyLiveVideoFile,
  isLiveVideoFile,
  LIVE_MAX_DURATION_SEC,
  processLiveVideoFile,
} from '@/utils/livePhotoUpload'
import {
  canUseNativePicker,
  itemsToPreviewable,
  pickFromNative,
  revokeNativePreviewEntry,
  type NativePickerPreviewEntry,
  type NativePickerTab,
} from '@/utils/nativePicker'
import { isNativeShell } from '@/utils/nativeShell'

export interface ImagePickerPreviewItem {
  id?: string
  file?: File
  url?: string
  videoFile?: File
  videoUrl?: string
  kind?: 'image' | 'live'
}

const emit = defineEmits<(e: 'update:files', value: File[]) => void>()
const toast = useToast()
const { t } = useI18n()

const props = withDefaults(defineProps<{
  multiple?: boolean
  max?: number  // 最大图片数量
  disabled?: boolean  // 是否禁用
  /** 已有图片相对路径（不含域名），用于编辑回显 */
  initialImagePaths?: string[]
  /** 是否允许上传实况（短视频 + 抽帧封面）。默认关闭，避免衣橱/图鉴等误选 */
  allowLive?: boolean
  /** 列表内嵌封面：隐藏拖拽区和压缩开关，格子铺满父级 */
  compact?: boolean
}>(), {
  allowLive: false,
  compact: false,
})

// 移动端检测
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)
/** 有桥才走原生相册；无桥 / post 失败回退 input */
const useNativePicker = computed(() => canUseNativePicker())
/** 手机或原生壳不展示「拖拽上传」提示（避免宽屏 WebView 误判为桌面） */
const showDesktopDropZone = computed(() => {
  if (props.disabled || props.compact) return false
  if (isMobile.value) return false
  if (isNativeShell()) return false
  return true
})
const liveMaxDurationSec = LIVE_MAX_DURATION_SEC
const pickerActionLabel = computed(() => {
  if (props.compact) return t('qhx.imagePicker.cover')
  return props.allowLive ? t('qhx.imagePicker.pick_image_live') : t('qhx.imagePicker.pick_image')
})
const dropHint = computed(() =>
  props.allowLive ? t('qhx.imagePicker.drop_image_live') : t('qhx.imagePicker.drop_image')
)

const IMAGE_ACCEPT_MOBILE = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/bmp,image/avif,image/tiff,.jfif'
const IMAGE_ACCEPT_DESKTOP = 'image/*'
const LIVE_ACCEPT = 'video/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,.livp,.pvt'
const LIVE_IMAGE_EXTRA_ACCEPT = '.livp,.pvt,.heic,.heif,video/quicktime,video/mp4,.mov,.mp4'

/** 移动端用具体图片 MIME，减少系统弹出「选择文件/浏览」导致进文件管理器。
 *  允许实况时：桌面端仍合并 accept；手机端图片/视频拆开，避免相册选不出视频。 */
const fileAccept = computed(() => {
  const images = isMobile.value ? IMAGE_ACCEPT_MOBILE : IMAGE_ACCEPT_DESKTOP
  if (!props.allowLive) return images
  if (isMobile.value) return `${images},${LIVE_IMAGE_EXTRA_ACCEPT}`
  return `${images},${LIVE_ACCEPT}`
})

const imageUploadStore = useImageUploadStore()
const compressEnabled = computed({
  get: () => imageUploadStore.compressEnabled,
  set: (v: boolean) => imageUploadStore.setCompressEnabled(v),
})

const fileInput = ref<HTMLInputElement | null>(null)
const liveFileInput = ref<HTMLInputElement | null>(null)
const mobileLiveSheetOpen = ref(false)
const files = ref<File[]>([])
const previewImages = ref<ImagePickerPreviewItem[]>([])

const tileClass = computed(() =>
  props.compact
    ? 'w-full'
    : '[@media(min-width:1920px)]:w-[calc(100%/4)] xl:w-1/4 md:w-1/4 max-md:w-1/3'
)
const tilePadClass = computed(() =>
  props.compact
    ? 'flex flex-col items-center'
    : 'flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]'
)
const showAddTile = computed(() => {
  if (props.disabled) return false
  if (!props.compact) return true
  const limit = props.max && props.max > 0 ? props.max : (props.multiple ? Number.POSITIVE_INFINITY : 1)
  return previewImages.value.length < limit
})

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)
const lightboxImgs = computed(() =>
  previewImages.value.map((el) => ({
    src: el.url || '',
    videoSrc: el.kind === 'live' ? el.videoUrl : undefined,
  }))
)

const openLightbox = (index: number) => {
  if (!previewImages.value[index]?.url) return
  lightboxIndex.value = index
  lightboxVisible.value = true
}

let idCounter = 0
const generateId = () => `img_${Date.now()}_${++idCounter}`

function remainingSelectionLimit(): number {
  if (!props.multiple) return 1
  if (props.max && props.max > 0) {
    return Math.max(0, props.max - previewImages.value.length)
  }
  return 9
}

/**
 * 无原生桥或旧版不支持时：直接点系统 input。
 * 勿再弹 H5 sheet，避免与 native 失败互相套娃。
 */
function fallbackToFileInput(initialTab: NativePickerTab = 'image') {
  if (initialTab === 'video' && props.allowLive) {
    liveFileInput.value?.click()
    return
  }
  fileInput.value?.click()
}

async function openNativePickerFlow(initialTab: NativePickerTab = 'image') {
  const limit = remainingSelectionLimit()
  if (limit <= 0) {
    toast.add({
      title: t('qhx.imagePicker.limit_title'),
      description: props.max
        ? t('qhx.imagePicker.limit_max', { max: props.max })
        : t('qhx.imagePicker.limit_generic'),
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }
  // 无桥：立刻回退，避免旧版 Outlink 点了没反应
  if (!canUseNativePicker()) {
    fallbackToFileInput(initialTab)
    return
  }
  imageUploadStore.initFromLocalStorage()
  try {
    const outcome = await pickFromNative({
      selectionLimit: limit,
      initialTab,
      allowLive: props.allowLive,
      maxLiveDurationSec: LIVE_MAX_DURATION_SEC,
    })
    if (!outcome.ok) {
      // no_bridge | unsupported（旧版有桥但无选图事件）→ 立刻系统选图
      fallbackToFileInput(initialTab)
      return
    }
    const result = outcome.result
    if (result.cancelled) return
    if (result.error) {
      toast.add({
        title: t('qhx.imagePicker.pick_failed'),
        description: result.error,
        color: 'red',
        icon: 'i-heroicons-x-circle',
      })
      return
    }
    await addNativePreviewEntries(itemsToPreviewable(result.items))
  } catch (e) {
    console.error('[ImagePicker] native picker failed:', e)
    fallbackToFileInput(initialTab)
  }
}

async function addNativePreviewEntries(entries: NativePickerPreviewEntry[]) {
  if (props.disabled || !entries.length) return

  const newPreviews: ImagePickerPreviewItem[] = []
  let rejectedLive = 0

  for (const entry of entries) {
    if (entry.kind === 'image') {
      const processed = await processImageFile(
        entry.file,
        imageUploadStore.compressEnabled,
      )
      revokeNativePreviewEntry(entry)
      if (!processed) continue
      newPreviews.push({
        id: generateId(),
        kind: 'image',
        file: processed,
        url: URL.createObjectURL(processed),
      })
      continue
    }

    if (!props.allowLive) {
      rejectedLive++
      revokeNativePreviewEntry(entry)
      continue
    }

    if (entry.kind === 'live') {
      const converted = await processImageFile(
        entry.posterFile,
        imageUploadStore.compressEnabled,
      )
      URL.revokeObjectURL(entry.previewUrl)
      if (!converted) {
        if (entry.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(entry.videoUrl)
        continue
      }
      newPreviews.push({
        id: generateId(),
        kind: 'live',
        file: converted,
        url: URL.createObjectURL(converted),
        videoFile: entry.videoFile,
        videoUrl: entry.videoUrl,
      })
      continue
    }

    // video Tab → 按实况成对（封面 + 视频）进预览，上传仍走 uploadPairedLiveToOSS
    if (entry.posterFile) {
      const converted = await processImageFile(
        entry.posterFile,
        imageUploadStore.compressEnabled,
      )
      URL.revokeObjectURL(entry.previewUrl)
      if (!converted) {
        if (entry.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(entry.videoUrl)
        continue
      }
      newPreviews.push({
        id: generateId(),
        kind: 'live',
        file: converted,
        url: URL.createObjectURL(converted),
        videoFile: entry.file,
        videoUrl: entry.videoUrl,
      })
    } else {
      const result = await processLiveVideoFile(entry.file)
      revokeNativePreviewEntry(entry)
      if (!result.ok) {
        toast.add({
          title:
            result.reason === 'duration'
              ? t('qhx.imagePicker.video_too_long', { sec: LIVE_MAX_DURATION_SEC })
              : t('qhx.imagePicker.live_skipped'),
          description: result.error,
          color: 'orange',
          icon: 'i-heroicons-exclamation-triangle',
        })
        continue
      }
      let poster = result.posterFile
      if (shouldCompressImage(poster, imageUploadStore.compressEnabled)) {
        poster = await compressUniform(poster)
      }
      newPreviews.push({
        id: generateId(),
        kind: 'live',
        file: poster,
        url: URL.createObjectURL(poster),
        videoFile: result.videoFile,
        videoUrl: URL.createObjectURL(result.videoFile),
      })
    }
  }

  if (rejectedLive) {
    toast.add({
      title: t('qhx.imagePicker.live_unsupported'),
      description: t('qhx.imagePicker.pick_static'),
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
  if (!newPreviews.length) return

  const newEmitFiles = newPreviews
    .map((p) => p.file)
    .filter((f): f is File => f != null)

  if (props.multiple) {
    if (props.max && props.max > 0) {
      const remaining = props.max - previewImages.value.length
      if (remaining > 0) {
        const toAdd = newPreviews.slice(0, remaining)
        const dropped = newPreviews.slice(remaining)
        dropped.forEach(revokePreviewUrls)
        previewImages.value.push(...toAdd)
        files.value.push(...newEmitFiles.slice(0, remaining))
      } else {
        newPreviews.forEach(revokePreviewUrls)
      }
    } else {
      previewImages.value.push(...newPreviews)
      files.value.push(...newEmitFiles)
    }
  } else {
    previewImages.value.forEach(revokePreviewUrls)
    previewImages.value = newPreviews.slice(0, 1)
    files.value = newEmitFiles.slice(0, 1)
    newPreviews.slice(1).forEach(revokePreviewUrls)
  }
  emit('update:files', files.value)
}

const triggerInput = () => {
  if (props.disabled) return
  // 有桥走原生（post 失败内部回退 input）
  if (useNativePicker.value) {
    void openNativePickerFlow('image')
    return
  }
  if (isMobile.value && props.allowLive) {
    mobileLiveSheetOpen.value = true
    return
  }
  fileInput.value?.click()
}

const onMobilePickerTap = () => {
  if (props.disabled) return
  if (useNativePicker.value) {
    void openNativePickerFlow('image')
    return
  }
  if (props.allowLive) {
    mobileLiveSheetOpen.value = true
    return
  }
  fileInput.value?.click()
}

const pickImages = () => {
  mobileLiveSheetOpen.value = false
  if (useNativePicker.value) {
    void openNativePickerFlow('image')
    return
  }
  // 必须同步 click，否则 iOS 会丢掉用户手势打不开相册
  fileInput.value?.click()
}

const pickLiveVideo = () => {
  mobileLiveSheetOpen.value = false
  if (useNativePicker.value) {
    void openNativePickerFlow('video')
    return
  }
  liveFileInput.value?.click()
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await addFiles(Array.from(input.files))
    input.value = '' // 清空 input 避免同图重复上传
  }
}

function onPickerDragOver(event: DragEvent) {
  if (props.disabled) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

async function handleDrop(event: DragEvent) {
  if (props.disabled) return
  const dt = event.dataTransfer
  if (!dt) return

  let filesToAdd: File[] = []
  let needSafeConvert = false

  // 1. 优先从 dataTransfer.files 获取（本地/网页图片拖入）
  if (dt.files?.length) {
    filesToAdd = Array.from(dt.files)
    needSafeConvert = true
  }
  // 2. 从 dataTransfer.items 获取（网页拖入时有些浏览器只在这里提供）
  else if (dt.items?.length) {
    const fromFiles: File[] = []
    const urlPromises: Promise<File | null>[] = []
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) fromFiles.push(file)
      } else if (item.kind === 'string' && item.type === 'text/uri-list') {
        urlPromises.push(
          new Promise((resolve) => {
            item.getAsString((url) => resolve(fetchImageAsFile(url)))
          })
        )
      }
    }
    if (fromFiles.length) {
      filesToAdd = fromFiles
      needSafeConvert = true
    } else if (urlPromises.length) {
      const fetched = await Promise.all(urlPromises)
      filesToAdd = fetched.filter((f): f is File => f != null)
      // fetchImageAsFile 已创建新 File，无需再转换
    }
  }

  if (filesToAdd.length) {
    const safe = needSafeConvert
      ? await Promise.all(filesToAdd.map(toSafeUploadFile))
      : filesToAdd
    await addFiles(safe)
  }
}

/** 从 URL 拉取图片并转为 File（网页拖入时可能只有 URL） */
async function fetchImageAsFile(url: string): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const name = url.split('/').pop()?.split('?')[0] || 'image.png'
    return new File([blob], name, { type: blob.type })
  } catch {
    return null
  }
}

/**
 * 将 File 转为可安全上传的副本。
 * 从其他网页拖拽过来的 File 可能带跨域/引用限制，直接上传易触发 CORS 或 500，转为本地 Blob 副本可规避。
 */
async function toSafeUploadFile(file: File): Promise<File> {
  if (file.size === 0) return file
  try {
    const blob = await file.arrayBuffer()
    const asVideo = file.type?.startsWith('video/') || isLiveVideoFile(file)
    const type = file.type?.startsWith('image/')
      ? file.type
      : asVideo
        ? (file.type || 'video/mp4')
        : 'image/jpeg'
    const name = file.name || (asVideo ? 'video.mp4' : 'image.jpg')
    return new File([blob], name, { type })
  } catch {
    return file
  }
}

const UNIFORM_MAX_EDGE = 1920
const UNIFORM_QUALITY = 0.85
/** 超过该体积（含 HEIC 转 JPEG 后）即使未开压缩开关也强制压缩 */
const FORCE_COMPRESS_BYTES = 10 * 1024 * 1024

function jpegFileName(file: File) {
  return `${(file.name || 'img').replace(/\.[^.]+$/, '') || 'img'}.jpg`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function shouldCompressImage(file: File, compressEnabled: boolean): boolean {
  return compressEnabled || file.size > FORCE_COMPRESS_BYTES
}

async function loadImageBitmap(f: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(f)
  } catch {
    return null
  }
}

/** 开启压缩：全部图片按统一质量/尺寸压缩 */
async function compressUniform(f: File): Promise<File> {
  const b = await loadImageBitmap(f)
  if (!b) return f
  const c = document.createElement('canvas')
  const x = c.getContext('2d')
  if (!x) {
    b.close()
    return f
  }
  const maxEdge = Math.max(b.width, b.height)
  const scale = maxEdge > UNIFORM_MAX_EDGE ? UNIFORM_MAX_EDGE / maxEdge : 1
  c.width = Math.max(1, (b.width * scale) | 0)
  c.height = Math.max(1, (b.height * scale) | 0)
  x.drawImage(b, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', UNIFORM_QUALITY))
  b.close()
  return blob ? new File([blob], jpegFileName(f), { type: 'image/jpeg' }) : f
}

async function processImageFile(f: File, forceCompress: boolean): Promise<File | null> {
  // 上传闸门：非 jpg/jpeg、png、webp 转为 JPEG（压缩前）
  let file: File
  try {
    file = await ensureAllowedImageForUpload(f)
  } catch (e) {
    const msg =
      e instanceof ImageConvertError
        ? e.message
        : t('qhx.imagePicker.convert_failed')
    toast.add({
      title: f.name || t('qhx.imagePicker.image'),
      description: msg,
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    })
    console.warn('[ImagePicker] 图片格式闸门拦截:', f.name, e)
    return null
  }

  const oversize = file.size > FORCE_COMPRESS_BYTES
  if (!forceCompress && !oversize) {
    console.log(`[ImagePicker] ${file.name} | 未开启压缩 | ${formatFileSize(file.size)} | 原图直传`)
    return file
  }

  const label = forceCompress
    ? (oversize ? '统一压缩(含超10MB)' : '统一压缩')
    : '超过10MB强制压缩'
  const before = file.size
  const result = await compressUniform(file)
  const after = result.size
  if (before === after) {
    console.log(`[ImagePicker] ${result.name} | ${label} | ${formatFileSize(before)} → 未变化`)
  } else {
    const savedPct = before > 0 ? (((before - after) / before) * 100).toFixed(1) : '0'
    console.log(
      `[ImagePicker] ${result.name} | ${label} | ${formatFileSize(before)} → ${formatFileSize(after)} (减少 ${formatFileSize(before - after)}, ${savedPct}%)`
    )
  }
  return result
}

const IMAGE_EXT_RE = /\.(jpe?g|jfif|jpe|png|gif|webp|heic|heif|bmp|avif|tiff?|svg|ico)$/i

function isImageFile(f: File) {
  if (f.type?.startsWith('image/')) return true
  // iOS 选 HEIC 时 type 常为空，靠扩展名放行
  return IMAGE_EXT_RE.test(f.name)
}

function revokePreviewUrls(item: ImagePickerPreviewItem | undefined) {
  if (!item) return
  if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
  if (item.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(item.videoUrl)
}

const addFiles = async (newFiles: File[]) => {
  if (props.disabled) return
  imageUploadStore.initFromLocalStorage()

  const images: File[] = []
  const videos: File[] = []
  const extractedPosters = new Map<File, File>()
  let rejectedLiveCount = 0
  let unknownCount = 0

  const { pairs, rest } = props.allowLive
    ? pairLivePhotoFiles(newFiles)
    : { pairs: [], rest: newFiles }

  for (const pair of pairs) {
    videos.push(pair.video)
    extractedPosters.set(pair.video, pair.poster)
  }

  for (const f of rest) {
    if (isLiveVideoFile(f) || await isLikelyLiveVideoFile(f)) {
      if (props.allowLive) videos.push(f)
      else rejectedLiveCount++
      continue
    }

    if (props.allowLive) {
      const embedded = await extractEmbeddedLiveVideo(f)
      if (embedded) {
        videos.push(embedded.videoFile)
        if (embedded.posterFile) extractedPosters.set(embedded.videoFile, embedded.posterFile)
        continue
      }
    }

    if (isImageFile(f)) {
      images.push(f)
    } else {
      unknownCount++
    }
  }

  if (rejectedLiveCount) {
    toast.add({
      title: t('qhx.imagePicker.live_unsupported'),
      description: t('qhx.imagePicker.pick_static'),
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
  if (unknownCount) {
    toast.add({
      title: t('qhx.imagePicker.unrecognized'),
      description: props.allowLive
        ? t('qhx.imagePicker.pick_or_live', { sec: LIVE_MAX_DURATION_SEC })
        : t('qhx.imagePicker.pick_image_only'),
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }

  const processedImages = (
    await Promise.all(
      images.map((f) => processImageFile(f, imageUploadStore.compressEnabled)),
    )
  ).filter((f): f is File => f != null)

  const livePreviews: ImagePickerPreviewItem[] = []
  if (props.allowLive && videos.length) {
    // 逐个处理：超 8 秒在读到时长后立刻 toast，不空等抽帧
    for (const video of videos) {
      const result = await processLiveVideoFile(video)
      if (!result.ok) {
        toast.add({
          title: result.reason === 'duration'
            ? t('qhx.imagePicker.video_too_long', { sec: LIVE_MAX_DURATION_SEC })
            : t('qhx.imagePicker.live_skipped'),
          description: result.error,
          color: 'orange',
          icon: 'i-heroicons-exclamation-triangle',
        })
        continue
      }
      let poster = result.posterFile
      const still = extractedPosters.get(video)
      if (still) {
        const converted = await processImageFile(still, imageUploadStore.compressEnabled)
        if (converted) poster = converted
      } else if (shouldCompressImage(poster, imageUploadStore.compressEnabled)) {
        poster = await compressUniform(poster)
      }
      livePreviews.push({
        id: generateId(),
        kind: 'live',
        file: poster,
        url: URL.createObjectURL(poster),
        videoFile: result.videoFile,
        videoUrl: URL.createObjectURL(result.videoFile),
      })
    }
  }

  const imagePreviews: ImagePickerPreviewItem[] = processedImages.map((file) => ({
    id: generateId(),
    kind: 'image',
    file,
    url: URL.createObjectURL(file),
  }))

  const newPreviews = [...imagePreviews, ...livePreviews]
  if (!newPreviews.length) return

  const newEmitFiles = newPreviews
    .map((p) => p.file)
    .filter((f): f is File => f != null)

  if (props.multiple) {
    if (props.max && props.max > 0) {
      const remaining = props.max - previewImages.value.length
      if (remaining > 0) {
        const toAdd = newPreviews.slice(0, remaining)
        previewImages.value.push(...toAdd)
        files.value.push(...newEmitFiles.slice(0, remaining))
      }
    } else {
      previewImages.value.push(...newPreviews)
      files.value.push(...newEmitFiles)
    }
  } else {
    previewImages.value.forEach(revokePreviewUrls)
    previewImages.value = newPreviews.slice(0, 1)
    files.value = newEmitFiles.slice(0, 1)
  }
  emit('update:files', files.value)
}

const removeImage = (index: number) => {
  if (props.disabled) return
  revokePreviewUrls(previewImages.value[index])
  previewImages.value.splice(index, 1)
  files.value.splice(index, 1)
  emit('update:files', files.value)
}
const clear = () => {
  previewImages.value.forEach(revokePreviewUrls)
  files.value = []
  previewImages.value = []
}

const seedFromPaths = (paths: string[]) => {
  if (!paths.length) return
  previewImages.value = paths.map((p) => {
    const t = p.trim()
    if (isCommunityLivePath(t)) {
      return {
        id: generateId(),
        kind: 'live' as const,
        url: toAbsoluteMediaUrl(toCommunityLivePosterPath(t)),
        videoUrl: toAbsoluteMediaUrl(t),
      }
    }
    return {
      id: generateId(),
      kind: 'image' as const,
      url: t.startsWith('http') || t.startsWith('blob:') || t.startsWith('data:') ? t : `${BASE_IMG}${t}`,
    }
  })
}

onMounted(() => {
  imageUploadStore.initFromLocalStorage()
  if (props.initialImagePaths?.length) {
    seedFromPaths(props.initialImagePaths)
  }
})

defineExpose({
  triggerInput, clear, previewImages,
  seedFromPaths,
})
</script>

<style scoped>
/* 1:1 占位：旧版 WebView（如 HarmonyOS 3）不支持 aspect-ratio 时会高度塌缩 */
.picker-square {
  height: 0;
  padding-bottom: 100%;
}

/* 预览/排序区禁止选中文本，避免长按拖拽时选中文字 */
.picker-list,
.no-long-press,
.picker-list :deep(.drag-ghost),
.picker-list :deep(.drag-chosen),
.picker-list :deep(.dragging) {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.picker-list img {
  -webkit-user-drag: none;
  user-drag: none;
  -webkit-touch-callout: none;
}

.picker-live-badge {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  letter-spacing: 0.04em;
}

/* 不用 display:none，避免 iOS 程序化 click 打不开相册 */
.picker-file-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
