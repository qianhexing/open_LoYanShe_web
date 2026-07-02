<template>
  <ClientOnly>
    <div
      v-if="!panelless"
      class="album-share-panel select-none rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <p class="mb-3 text-center text-xs font-medium text-gray-500">生成成就相册分享图</p>
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          class="rounded-xl bg-qhx-primary px-4 py-2.5 text-sm font-medium text-white outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          :disabled="!payload || generating"
          @click="generateAndUpload"
        >
          <span v-if="generating" class="inline-flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
            生成并上传中…
          </span>
          <span v-else>生成分享图并上传</span>
        </button>
        <button
          v-if="previewSrc && !generating"
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 outline-none ring-1 ring-gray-200 transition hover:bg-gray-50 active:scale-[0.99]"
          @click="showSharePreviewModal = true"
        >
          查看分享图
        </button>
      </div>
      <p v-if="previewSrc && !generating" class="mt-2 text-center text-[11px] text-gray-400">
        <template v-if="isAppWebView">
          已上传，点「查看分享图」后可用<strong class="font-semibold text-qhx-primary">保存到相册</strong>按钮，或长按图片保存
        </template>
        <template v-else>
          已上传至服务器，点击「查看分享图」可在弹窗中预览或右键另存
        </template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-red-500">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3"
        >
          <span class="text-sm font-semibold text-gray-900">成就相册分享图</span>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 outline-none transition hover:bg-gray-100"
            aria-label="关闭"
            @click="showSharePreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
            <p
              v-if="isAppWebView"
              class="mb-3 rounded-xl bg-pink-50 px-3 py-2 text-center text-xs font-medium leading-snug text-gray-600"
            >
              uni-app：可长按图片保存，或使用底部「保存到相册」
            </p>
            <p class="mb-2 text-center text-[11px] text-gray-400">
              以下为完整分享长图，可上下滑动查看
            </p>
            <div class="rounded-xl border border-gray-100">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="成就相册分享图"
                class="mx-auto block h-auto w-full max-w-full bg-gray-50"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="shrink-0 border-t border-gray-100 px-3 py-3"
          >
            <button
              type="button"
              class="mx-auto flex w-full max-w-[320px] justify-center rounded-xl bg-qhx-primary px-4 py-2.5 text-sm font-medium text-white outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
import { uploadImageToTemp } from '@/api/index'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  drawAlbumCoverShareCanvas,
  type AlbumCoverSharePayload
} from '@/utils/albumShareCanvas'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

const props = withDefaults(
  defineProps<{
    payload: AlbumCoverSharePayload | null
    panelless?: boolean
  }>(),
  { panelless: false }
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

async function savePreviewToAlbum() {
  const url = previewSrc.value.trim()
  if (!url) {
    toast.add({ title: '没有可保存的图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  try {
    await saveToAlbum(url, { docFilename: `_doc/album_cover_${Date.now()}.jpg` })
    toast.add({ title: '已保存到相册', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败，请检查网络、相册权限，或尝试长按图片',
      color: 'red',
      icon: 'i-heroicons-x-circle'
    })
  }
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false
  const payload = props.payload
  if (!payload) {
    const msg = '暂无相册数据，请稍后再试'
    errorMsg.value = msg
    toast.add({ title: msg, icon: 'i-heroicons-exclamation-circle', color: 'amber' })
    return
  }

  generating.value = true
  try {
    const canvas = await drawAlbumCoverShareCanvas(payload, { highQuality: true })
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      toast.add({ title: '生成图片失败', icon: 'i-heroicons-x-circle', color: 'red' })
      return
    }
    const file = new File([blob], `album-cover-${Date.now()}.jpg`, { type: 'image/jpeg' })
    const res = await uploadImageToTemp(file)
    if (!res?.file_url) {
      errorMsg.value = '上传失败：未返回地址'
      toast.add({ title: '上传失败，请稍后重试', icon: 'i-heroicons-x-circle', color: 'red' })
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
  } catch (e) {
    console.error(e)
    errorMsg.value = '生成或上传失败，请稍后重试'
    toast.add({ title: '生成或上传失败，请稍后重试', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    generating.value = false
  }
}

defineExpose({
  generateAndUpload,
  generating
})
</script>
