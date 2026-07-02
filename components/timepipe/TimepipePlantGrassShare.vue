<template>
  <ClientOnly>
    <div class="plant-grass-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        按种草评级生成 4K 长图（有点慢，请耐心等待）
      </p>
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          class="neu-share-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-pink-100"
          :disabled="!canGenerate || generating"
          @click="generateAndUpload"
        >
          <span v-if="generating" class="inline-flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
            {{ progressLabel }}
          </span>
          <span v-else>生成种草分享图并上传</span>
        </button>
        <button
          v-if="previewSrc && !generating"
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium text-[#7a5f6f] outline-none ring-1 ring-pink-300/50 transition hover:bg-pink-50/80 active:scale-[0.99] dark:text-pink-200/90 dark:ring-pink-800/60 dark:hover:bg-pink-950/40"
          @click="showSharePreviewModal = true"
        >
          查看分享图
        </button>
      </div>
      <p
        v-if="previewSrc && !generating"
        class="mt-2 text-center text-[11px] text-[#8a6f7d] dark:text-pink-300/80"
      >
        <template v-if="isAppWebView">
          已上传，点「查看分享图」后可用<strong class="font-semibold text-[#9d6080] dark:text-pink-300">保存到相册</strong>按钮，或长按图片保存
        </template>
        <template v-else>
          已上传至服务器，可在弹窗中预览或右键另存
        </template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-red-600 dark:text-red-400">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3">
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">种草分享图预览</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a6f7d] outline-none transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
            aria-label="关闭"
            @click="showSharePreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="share-preview-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="种草分享图"
                class="share-preview-modal__img mx-auto h-auto w-full max-w-full object-contain"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="share-preview-modal__footer shrink-0 border-t border-[#dfc9d4] px-3 py-3 dark:border-[#3d2f38]"
          >
            <button
              type="button"
              class="share-save-album-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              :disabled="savingToAlbum"
              @click="savePreviewToAlbum"
            >
              <span v-if="savingToAlbum" class="inline-flex items-center justify-center gap-2">
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
import type { PlantGrassCartItem } from '@/stores/plantGrassCart'
import { uploadTempFileToOSS } from '@/utils/ossUpload'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import { drawPlantGrassShareCanvas } from '@/utils/plantGrassShareCanvas'
import { WARDROBE_SHARE_DEFAULT_AVATAR } from '@/utils/wardrobeClothesShareCanvas'

const toast = useToast()

const props = defineProps<{
  items: PlantGrassCartItem[]
  title?: string
  dateLabel: string
  userName?: string
  userFace?: string
}>()

const generating = ref(false)
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()
const progressLabel = ref('')
const errorMsg = ref('')
const serverRelativeUrl = ref('')
const showSharePreviewModal = ref(false)

const canGenerate = computed(() => props.items.length > 0)
const isAppWebView = computed(() => isHtml5PlusWebView())

const previewSrc = computed(() => {
  const rel = serverRelativeUrl.value.trim()
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  return `${BASE_IMG}${rel.replace(/^\//, '')}`
})

async function savePreviewToAlbum() {
  const url = previewSrc.value.trim()
  if (!url) {
    toast.add({ title: '没有可保存的图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  try {
    await saveToAlbum(url, { docFilename: `_doc/plant_grass_${Date.now()}.jpg` })
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

watch(
  () => [props.items.length, props.dateLabel],
  () => {
    serverRelativeUrl.value = ''
    errorMsg.value = ''
  }
)

async function generateAndUpload() {
  if (!import.meta.client || generating.value || !canGenerate.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false

  generating.value = true
  progressLabel.value = '绘制中…'
  try {
    const { canvas, drawnCount, sourceCount } = await drawPlantGrassShareCanvas({
      items: props.items,
      title: props.title?.trim() || '种草单',
      dateLabel: props.dateLabel,
      userName: props.userName?.trim() || '用户',
      userFace: props.userFace?.trim() || WARDROBE_SHARE_DEFAULT_AVATAR,
      onProgress: (label) => {
        progressLabel.value = label
      },
    })
    if (drawnCount < sourceCount) {
      toast.add({
        title: `分享图仅包含 ${drawnCount} 件（共 ${sourceCount} 件），超出部分未绘制`,
        color: 'amber',
        icon: 'i-heroicons-information-circle',
      })
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败（可能被跨域图片污染画布，请稍后重试）'
      return
    }
    progressLabel.value = '上传中…'
    const file = new File([blob], `plant-grass-${Date.now()}.jpg`, { type: 'image/jpeg' })
    const res = await uploadTempFileToOSS(file)
    if (!res?.file_url) {
      errorMsg.value = '上传失败：未返回地址'
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
    progressLabel.value = ''
  } catch (e) {
    console.error(e)
    errorMsg.value = '生成或上传失败，请稍后重试'
  } finally {
    generating.value = false
    progressLabel.value = ''
  }
}

defineExpose({ generateAndUpload })
</script>

<style scoped>
.plant-grass-share {
  background: var(--neu-dent, #e4d9e0);
}

.neu-share-btn {
  background: var(--neu-raised, #ebe3e8);
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -3px -3px 10px rgba(255, 252, 254, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.share-preview-modal {
  --neu-raised: #ebe3e8;
  background-color: #ebe3e8;
}

.dark .share-preview-modal {
  --neu-raised: #241d26;
  background-color: #241d26;
}

.share-preview-modal__head {
  background-color: var(--neu-raised);
  border-bottom: 1px solid #dfc9d4;
}

.share-preview-modal__body {
  background-color: var(--neu-raised);
}

.share-preview-modal__footer {
  background-color: var(--neu-raised);
}

.share-save-album-btn {
  color: #5e3a4b;
  background: var(--neu-raised, #ebe3e8);
  border: 1px solid rgba(180, 120, 145, 0.35);
}
</style>
