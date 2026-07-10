<template>
  <ClientOnly>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45 dark:text-gray-300 dark:hover:bg-gray-800"
      title="生成或查看推荐单"
      aria-label="生成或查看相似推荐单"
      :disabled="!payload || generating"
      @click="handleAction"
    >
      <UIcon
        v-if="generating"
        name="i-heroicons-arrow-path"
        class="text-sm animate-spin"
      />
      <UIcon
        v-else
        name="i-heroicons-photo"
        class="text-sm"
      />
      <span>推荐单</span>
    </button>

    <QhxModal v-model="showPreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[#4a382f] dark:text-[#f5ebe3]">推荐单预览</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#9a8268] outline-none transition hover:bg-[#e8ddd2]/60 dark:text-[#c4b09a] dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showPreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            class="share-preview-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1"
          >
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="相似推荐单"
                class="share-preview-modal__img mx-auto h-auto w-full max-w-full object-contain"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="share-preview-modal__footer shrink-0 border-t border-[#e8ddd2] px-3 py-3 dark:border-[#3d342c]"
          >
            <button
              type="button"
              class="share-save-album-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              :disabled="savingToAlbum"
              @click="savePreviewToAlbum"
            >
              <span
                v-if="savingToAlbum"
                class="inline-flex items-center justify-center gap-2"
              >
                <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
                保存中…
              </span>
              <span v-else>保存到相册</span>
            </button>
          </div>
        </div>
      </div>
    </QhxModal>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useToast } from '#imports'
import { uploadImageToTemp } from '@/api/index'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  drawLibraryRecommendCanvas,
  type LibraryRecommendImageBundle,
  type LibraryRecommendPayload,
  prepareLibraryRecommendImages,
} from '@/utils/libraryShareCanvas'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

const props = defineProps<{
  payload: LibraryRecommendPayload | null
}>()

const generating = ref(false)
const serverRelativeUrl = ref('')
const showPreviewModal = ref(false)

const isAppWebView = computed(() => isHtml5PlusWebView())

const previewSrc = computed(() => {
  const rel = serverRelativeUrl.value.trim()
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  return `${BASE_IMG}${rel.replace(/^\//, '')}`
})

const hasCachedImage = computed(() => serverRelativeUrl.value.trim().length > 0)

watch(
  () => [props.payload?.libraryId, props.payload?.similarList.length] as const,
  ([libraryId, count], [prevId, prevCount]) => {
    if (libraryId !== prevId || count !== prevCount) {
      serverRelativeUrl.value = ''
      showPreviewModal.value = false
    }
  },
)

function handleAction() {
  if (hasCachedImage.value) {
    showPreviewModal.value = true
    return
  }
  void generateAndUpload()
}

async function savePreviewToAlbum() {
  const url = previewSrc.value.trim()
  if (!url) {
    toast.add({ title: '没有可保存的图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  try {
    await saveToAlbum(url, { docFilename: `_doc/library_recommend_${Date.now()}.jpg` })
    toast.add({ title: '已保存到相册', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败，请检查网络、相册权限，或尝试长按图片',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value) return
  if (hasCachedImage.value) {
    showPreviewModal.value = true
    return
  }

  showPreviewModal.value = false
  const payload = props.payload
  if (!payload?.cover) {
    toast.add({ title: '缺少图鉴封面，无法生成', color: 'orange', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  if (!payload.similarList.length) {
    toast.add({ title: '暂无相似推荐，无法生成', color: 'orange', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  generating.value = true
  try {
    const bundle: LibraryRecommendImageBundle = await prepareLibraryRecommendImages(payload)
    const canvas = drawLibraryRecommendCanvas(payload, bundle)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    )
    if (!blob) {
      toast.add({ title: '生成图片失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    const file = new File(
      [blob],
      `library-recommend-${payload.libraryId ?? Date.now()}-${Date.now()}.jpg`,
      { type: 'image/jpeg' },
    )
    const res = await uploadImageToTemp(file)
    if (!res?.file_url) {
      toast.add({ title: '上传失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    serverRelativeUrl.value = res.file_url
    showPreviewModal.value = true
    toast.add({ title: '推荐单已生成', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({ title: '生成失败，请稍后重试', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.share-preview-modal {
  --page-base: #f7f0e8;
  --page-raised: #fefcf9;
  --page-dent: #f7f0e8;
  --page-shadow-d: rgba(120, 95, 70, 0.08);
  --page-shadow-l: rgba(255, 252, 248, 0.98);
  --page-inset-hi: rgba(255, 255, 255, 0.75);
  background-color: #fefcf9;
  box-shadow:
    10px 10px 26px var(--page-shadow-d),
    -8px -8px 22px var(--page-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.65);
}

.dark .share-preview-modal {
  --page-base: #2a241e;
  --page-raised: #332c26;
  --page-dent: #241f1a;
  --page-shadow-d: rgba(0, 0, 0, 0.45);
  --page-shadow-l: rgba(90, 75, 60, 0.08);
  --page-inset-hi: rgba(255, 248, 240, 0.04);
  background-color: #332c26;
  box-shadow:
    8px 8px 22px var(--page-shadow-d),
    -6px -6px 18px var(--page-shadow-l),
    inset 1px 1px 0 var(--page-inset-hi);
}

.share-preview-modal__head {
  background-color: var(--page-raised);
  border-bottom: 1px solid #e8ddd2;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d342c;
}

.share-preview-modal__body {
  background-color: var(--page-raised);
}

.share-preview-modal__footer {
  background-color: var(--page-raised);
}

.share-save-album-btn {
  color: #7a6656;
  background: var(--page-raised, #fefcf9);
  box-shadow:
    3px 3px 8px rgba(120, 95, 70, 0.08),
    -2px -2px 8px rgba(255, 252, 248, 0.95);
  border: 1px solid rgba(200, 175, 150, 0.3);
}

.dark .share-save-album-btn {
  color: #e8ddd2;
  --page-raised: #3a322b;
  border-color: rgba(160, 135, 110, 0.25);
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -1px -1px 6px rgba(90, 75, 60, 0.06);
}

.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}
</style>
