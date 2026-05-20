<template>
  <div class="space-y-4">
    <input ref="fileInput" type="file" accept="image/*" :multiple="multiple" class="hidden" @change="handleFiles" />

    <!-- 拖拽上传区 -->
    <div v-if="!props.disabled && !isMobile"
      class="w-full border-2 border-dashed border-gray-300 p-4 text-center rounded-lg" @dragover.prevent
      @drop.prevent="handleDrop">
      拖拽图片到这里上传
    </div>

    <!-- 预览区 -->
    <div class=" w-full">
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
            v-if="!props.disabled"
            class="[@media(min-width:1920px)]:w-[calc(100%/4)] xl:w-1/4 md:w-1/4 max-md:w-1/3"
          >
            <div
              class="flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]"
            >
              <button
                type="button"
                class="w-full aspect-[1/1] relative shadow-xl rounded-xl border border-gray-200 bg-gray-50/90 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-qhx-primary hover:bg-qhx-primary/5 hover:border-qhx-primary/35 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary/50 focus-visible:ring-offset-2"
                @click="triggerInput"
              >
                <UIcon class="size-9 text-qhx-primary/80" name="i-heroicons-photo" />
                <span class="text-xs font-medium px-1 text-center leading-tight">选择图片</span>
              </button>
            </div>
          </div>
        </template>
        <template #item="{ element, index }">
          <transition-group tag="div"
            class="[@media(min-width:1920px)]:w-[calc(100%/4)] xl:w-1/4 md:w-1/4 max-md:w-1/3" name="list">
            <div
              class="group drag-handle flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]">
              <div class="w-full aspect-[1/1] relative shadow-xl">
                <img :src="element.url" draggable="false"
                  class="object-cover w-full aspect-[1/1] max-md:aspect-[1/1] rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                  style="-webkit-touch-callout: none; -webkit-user-select: none; user-select: none;"
                  loading="lazy">
                </img>
                <UButton v-if="!props.disabled" icon="i-heroicons-x-mark" color="red" size="2xs" variant="soft"
                  class="absolute top-1 right-1 z-10" @click="removeImage(index)" />
                <!-- 透明遮罩：避免移动端误触长按；单击打开大图预览 -->
                <div
                  class="absolute z-[1] w-full h-full inset-0 rounded-xl cursor-zoom-in"
                  style="background: transparent;"
                  @click.stop="openLightbox(index)"
                />
              </div>
            </div>
          </transition-group>
        </template>
      </Draggable>
      <ClientOnly>
        <vue-easy-lightbox
          :visible="lightboxVisible"
          :imgs="lightboxImgs"
          :index="lightboxIndex"
          append-to-body
          :teleport="'body'"
          :zoomScale="0.4"
          :maxZoom="5"
          @hide="lightboxVisible = false"
        />
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
  </div>
</template>

<script setup lang="ts">
import Draggable from "vuedraggable"
import VueEasyLightbox from 'vue-easy-lightbox'
import { BASE_IMG } from '@/utils/ipConfig'
const emit = defineEmits<(e: 'update:files', value: File[]) => void>()

const props = defineProps<{
  multiple?: boolean
  max?: number  // 最大图片数量
  disabled?: boolean  // 是否禁用
  /** 已有图片相对路径（不含域名），用于编辑回显 */
  initialImagePaths?: string[]
}>()

// 移动端检测
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const previewImages = ref<{ id?: string; file?: File; url?: string }[]>([])

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)
const lightboxImgs = computed(() =>
  previewImages.value.map((el) => ({ src: el.url || '' }))
)

const openLightbox = (index: number) => {
  if (!previewImages.value[index]?.url) return
  lightboxIndex.value = index
  lightboxVisible.value = true
}

let idCounter = 0
const generateId = () => `img_${Date.now()}_${++idCounter}`

const triggerInput = () => {
  if (!props.disabled) {
    fileInput.value?.click()
  }
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    await addFiles(Array.from(input.files))
    input.value = '' // 清空 input 避免同图重复上传
  }
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
    const type = file.type?.startsWith('image/') ? file.type : 'image/jpeg'
    const name = file.name || 'image.jpg'
    return new File([blob], name, { type })
  } catch {
    return file
  }
}

const MAX_BYTES = 3 * 1024 * 1024
async function under3m(f: File): Promise<File> {
  if (f.size <= MAX_BYTES) return f
  let b: ImageBitmap
  try {
    b = await createImageBitmap(f)
  } catch {
    return f
  }
  const c = document.createElement('canvas')
  const x = c.getContext('2d')
  if (!x) {
    b.close()
    return f
  }
  const n = `${(f.name || 'img').replace(/\.[^.]+$/, '') || 'img'}.jpg`
  for (let s = 1; s > 0.18; s *= 0.86) {
    for (let q = 0.92; q > 0.42; q -= 0.07) {
      c.width = Math.max(1, (b.width * s) | 0)
      c.height = Math.max(1, (b.height * s) | 0)
      x.drawImage(b, 0, 0, c.width, c.height)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q))
      if (blob && blob.size <= MAX_BYTES) {
        b.close()
        return new File([blob], n, { type: 'image/jpeg' })
      }
    }
  }
  b.close()
  return f
}

const addFiles = async (newFiles: File[]) => {
  if (props.disabled) return
  const imageFiles = await Promise.all(newFiles.filter((f) => f.type.startsWith('image/')).map(under3m))
  const newPreviews = imageFiles.map((file) => ({
    id: generateId(),
    file,
    url: URL.createObjectURL(file)
  }))
  if (props.multiple) {
    // 如果有最大数量限制
    if (props.max && props.max > 0) {
      const remaining = props.max - previewImages.value.length
      if (remaining > 0) {
        const toAdd = newPreviews.slice(0, remaining)
        previewImages.value.push(...toAdd)
        files.value.push(...imageFiles.slice(0, remaining))
      }
    } else {
      previewImages.value.push(...newPreviews)
      files.value.push(...imageFiles)
    }
  } else {
    // 单选模式
    previewImages.value = newPreviews.slice(0, 1)
    files.value = imageFiles.slice(0, 1)
  }
  emit('update:files', files.value)
}

const removeImage = (index: number) => {
  // 删除弹出提示
  console.log(index)
  const toast = useToast()
  toast.add({
    title: '删除图片',
    icon: 'i-heroicons-exclamation-circle',
    color: 'orange'
  })
  if (props.disabled) return
  if (previewImages.value[index].url) {
    URL.revokeObjectURL(previewImages.value[index].url)
  }
  previewImages.value.splice(index, 1)
  files.value.splice(index, 1)
  emit('update:files', files.value)
}
const clear = () => {
  files.value = []
  previewImages.value = []
}

const seedFromPaths = (paths: string[]) => {
  if (!paths.length) return
  previewImages.value = paths.map((p) => {
    const t = p.trim()
    return {
      id: generateId(),
      url: t.startsWith('http') ? t : `${BASE_IMG}${t}`
    }
  })
}

onMounted(() => {
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
/* 禁止手机浏览器的长按事件 */
.no-long-press {
  /* -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  pointer-events: none;
  touch-action: manipulation; */
}
</style>
