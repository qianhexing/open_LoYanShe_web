<template>
  <ClientOnly>
    <template v-if="variant === 'inline'">
      <button
        type="button"
        class="share-inline-btn cursor-pointer inline-flex items-center justify-center gap-0.5 disabled:opacity-45 disabled:cursor-not-allowed"
        title="生成或查看分享图"
        aria-label="生成或查看分享图"
        :disabled="!payload || generating"
        @click="handleShareAction"
      >
        <UIcon
          v-if="generating"
          name="i-heroicons-arrow-path"
          class="text-[26px] text-gray-500 animate-spin"
        />
        <UIcon
          v-else
          name="i-heroicons-photo"
          class="text-[26px] text-gray-500"
        />
        <span class="text-base text-gray-500">分享图</span>
      </button>
    </template>
    <div
      v-else
      class="library-share select-none rounded-2xl p-4 shadow-inner"
    >
      <ShareActionPanel
        :payload="payload"
        :generating="generating"
        :preview-ready="!!previewSrc"
        :error-msg="errorMsg"
        @generate="handleShareAction"
        @preview="showSharePreviewModal = true"
      />
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[#4a382f] dark:text-[#f5ebe3]">分享图预览</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#9a8268] outline-none transition hover:bg-[#e8ddd2]/60 dark:text-[#c4b09a] dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showSharePreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            class="share-preview-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1"
          >
            <!-- <p class="mb-2 text-center text-[11px] text-[#9a8268] dark:text-[#c4b09a]">
              以下为服务器返回的图片
            </p> -->
            <!-- <p
              v-if="isAppWebView"
              class="share-preview-app-hint mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium leading-snug text-[#6b5748] dark:text-[#e8ddd2]"
            >
              uni-app：可长按图片保存，或使用底部「保存到相册」
            </p> -->
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="图鉴分享图"
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
import { getLibrarySimilar } from '@/api/library'
import { uploadImageToTemp } from '@/api/index'
import QhxModal from '@/components/Qhx/Modal.vue'
import ShareActionPanel from '@/components/library/LibraryShareActionPanel.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  drawLibraryShareCanvas,
  type LibraryShareImageBundle,
  type LibrarySharePayload,
  type LibraryShareSimilarItem,
  prepareLibraryShareImages,
} from '@/utils/libraryShareCanvas'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

export type { LibrarySharePayload }

const props = withDefaults(
  defineProps<{
    payload: LibrarySharePayload | null
    variant?: 'inline' | 'block'
  }>(),
  { variant: 'block' },
)

const generating = ref(false)
const errorMsg = ref('')
const serverRelativeUrl = ref('')
const showSharePreviewModal = ref(false)

const isAppWebView = computed(() => isHtml5PlusWebView())

const previewSrc = computed(() => {
  const rel = serverRelativeUrl.value.trim()
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  return `${BASE_IMG}${rel.replace(/^\//, '')}`
})

const hasCachedShare = computed(() => serverRelativeUrl.value.trim().length > 0)

watch(
  () => props.payload?.libraryId,
  (libraryId, prevId) => {
    if (libraryId !== prevId) {
      serverRelativeUrl.value = ''
      errorMsg.value = ''
      showSharePreviewModal.value = false
    }
  },
)

function handleShareAction() {
  if (hasCachedShare.value) {
    showSharePreviewModal.value = true
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
    await saveToAlbum(url, { docFilename: `_doc/library_share_${Date.now()}.jpg` })
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

async function enrichPayloadWithSimilar(payload: LibrarySharePayload): Promise<LibrarySharePayload> {
  if (payload.similarList?.length) return payload
  if (!payload.libraryId) return payload
  try {
    const res = await getLibrarySimilar({ library_id: payload.libraryId, pageSize: 5 })
    const rows = (res.rows ?? [])
      .filter((r) => r.library_id !== payload.libraryId)
      .slice(0, 4)
    if (!rows.length) return payload
    const similarList: LibraryShareSimilarItem[] = rows.map((item) => ({
      name: item.name,
      cover: item.cover,
      libraryType: item.library_type || '图鉴',
      similarityText:
        item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))
          ? formatSimilarityScore(Number(item.similarity_score))
          : undefined,
      shopName: item.shop?.shop_name?.trim() || undefined,
    }))
    return { ...payload, similarList }
  } catch {
    return payload
  }
}

function formatSimilarityScore(score: number) {
  if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value) return
  if (hasCachedShare.value) {
    showSharePreviewModal.value = true
    return
  }

  errorMsg.value = ''
  showSharePreviewModal.value = false
  const payload = props.payload
  if (!payload?.cover) {
    errorMsg.value = '缺少图鉴封面，无法生成'
    toast.add({ title: '缺少图鉴封面，无法生成', color: 'orange', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  generating.value = true
  try {
    const enriched = await enrichPayloadWithSimilar(payload)
    const bundle: LibraryShareImageBundle = await prepareLibraryShareImages(enriched)
    const canvas = drawLibraryShareCanvas(enriched, bundle)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      toast.add({ title: '生成图片失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    const file = new File(
      [blob],
      `library-share-${payload.libraryId ?? Date.now()}-${Date.now()}.jpg`,
      { type: 'image/jpeg' },
    )
    const res = await uploadImageToTemp(file)
    if (!res?.file_url) {
      errorMsg.value = '上传失败：未返回地址'
      toast.add({ title: '上传失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
    toast.add({ title: '分享图已生成', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    errorMsg.value = '生成或上传失败，请稍后重试'
    toast.add({ title: '生成失败，请稍后重试', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.library-share {
  background: var(--page-dent, #f7f0e8);
}

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

.share-preview-app-hint {
  background: rgba(240, 232, 222, 0.45);
  border: 1px solid rgba(210, 190, 170, 0.35);
}

.dark .share-preview-app-hint {
  background: rgba(60, 50, 42, 0.55);
  border-color: rgba(140, 120, 100, 0.3);
}
</style>
