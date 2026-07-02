<template>
  <ClientOnly>
    <div
      v-if="!panelless"
      class="journal-share-panel journal-book-page select-none rounded-2xl p-4 font-serif"
    >
      <p class="mb-3 text-center text-xs font-medium text-[var(--ink-muted)]">
        生成手账日历 4K 分享图（3840px 宽 · JPG）
      </p>
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          class="journal-neu-icon-btn rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
          class="journal-neu-icon-btn rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99]"
          @click="showSharePreviewModal = true"
        >
          查看分享图
        </button>
      </div>
      <p
        v-if="previewSrc && !generating"
        class="mt-2 text-center text-[11px] text-[var(--ink-faint)]"
      >
        <template v-if="isAppWebView">
          已上传，点「查看分享图」后可用<strong class="font-semibold text-[var(--accent-warm)]">保存到相册</strong>按钮，或长按图片保存
        </template>
        <template v-else>
          已上传至服务器，点击「查看分享图」可在弹窗中预览或右键另存
        </template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-[var(--seal-red)]">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="journal-share-preview journal-neu-modal journal-book-page flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl font-serif"
      >
        <div
          class="journal-neu-modal-head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[var(--ink-primary)]">手账日历分享图</span>
          <button
            type="button"
            class="journal-neu-icon-btn flex h-9 w-9 items-center justify-center rounded-full outline-none transition"
            aria-label="关闭"
            @click="showSharePreviewModal = false"
          >
            <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5 text-[var(--ink-muted)]" />
          </button>
        </div>
        <div class="journal-neu-modal-body flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2"
          >
            <p class="mb-2 text-center text-[11px] text-[var(--ink-muted)]">
              以下为生成的手账日历长图
            </p>
            <p
              v-if="isAppWebView"
              class="journal-share-hint mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium leading-snug text-[var(--ink-secondary)]"
            >
              uni-app：可长按图片保存，或使用底部「保存到相册」
            </p>
            <div class="overflow-hidden rounded-xl border border-[var(--border-light)]">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="手账日历分享图"
                class="mx-auto h-auto w-full max-w-full object-contain bg-[var(--paper-dent)]"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="journal-neu-modal-foot shrink-0 px-3 py-3"
          >
            <button
              type="button"
              class="journal-neu-icon-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
import { uploadImageToTemp } from '@/api/index'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  drawJournalCalendarShareCanvas,
  type JournalCalendarSharePayload
} from '@/utils/journalShareCanvas'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

const props = withDefaults(
  defineProps<{
    payload: JournalCalendarSharePayload | null
    /** 无操作面板，仅保留预览弹窗（由外部直接调用 generateAndUpload） */
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
    await saveToAlbum(url, { docFilename: `_doc/journal_calendar_${Date.now()}.jpg` })
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
    const msg = '暂无手账数据，请切换到「按日」视图后再试'
    errorMsg.value = msg
    toast.add({ title: msg, icon: 'i-heroicons-exclamation-circle', color: 'amber' })
    return
  }

  generating.value = true
  try {
    const canvas = await drawJournalCalendarShareCanvas(payload)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      toast.add({ title: '生成图片失败', icon: 'i-heroicons-x-circle', color: 'red' })
      return
    }
    const file = new File([blob], `journal-calendar-${Date.now()}.jpg`, { type: 'image/jpeg' })
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

<style scoped>
/* 与手账页 journal-book-page 对齐的设计变量 */
.journal-book-page {
  --paper-bg: #f7f0e8;
  --paper-sheet: #fefcf9;
  --paper-raised: #fffefb;
  --paper-dent: #f5efe6;
  --ink-primary: #3d3429;
  --ink-secondary: #5c4f42;
  --ink-muted: #8a7b6a;
  --ink-faint: #b5a898;
  --border-paper: rgba(120, 95, 70, 0.14);
  --border-light: rgba(120, 95, 70, 0.08);
  --shadow-paper: 0 1px 0 rgba(255, 255, 255, 0.85), 0 12px 40px rgba(110, 88, 62, 0.1);
  --shadow-soft: 0 2px 8px rgba(110, 88, 62, 0.05);
  --seal-red: #b85c48;
  --accent-warm: #8a7355;
  color: var(--ink-primary);
}

.dark .journal-book-page {
  --paper-bg: #1a1612;
  --paper-sheet: #221e19;
  --paper-raised: #2a2520;
  --paper-dent: #1e1a16;
  --ink-primary: #e8dfd0;
  --ink-secondary: #c9bfb0;
  --ink-muted: #9a8f80;
  --ink-faint: #6b6258;
  --border-paper: rgba(200, 180, 150, 0.12);
  --border-light: rgba(200, 180, 150, 0.06);
  --shadow-paper: 0 12px 40px rgba(0, 0, 0, 0.45);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.25);
  --seal-red: #c46a55;
  --accent-warm: #a89070;
}

.journal-share-panel {
  background: var(--paper-dent);
  border: 1px dashed var(--border-paper);
  box-shadow: var(--shadow-soft);
}

.journal-neu-modal {
  background-color: var(--paper-sheet);
  border: 1px solid var(--border-paper);
  box-shadow: var(--shadow-paper);
}

.journal-neu-modal-head {
  background: var(--paper-dent);
  border-bottom: 1px solid var(--border-light);
}

.journal-neu-modal-body {
  background: var(--paper-sheet);
}

.journal-neu-modal-foot {
  background: var(--paper-dent);
  border-top: 1px solid var(--border-light);
}

.journal-neu-icon-btn {
  border: 1px solid var(--border-paper);
  background: var(--paper-sheet);
  color: var(--ink-muted);
  box-shadow: none;
}

.journal-neu-icon-btn:hover {
  color: var(--ink-secondary);
  border-color: rgba(120, 95, 70, 0.22);
}

.journal-neu-icon-btn:active {
  background: var(--paper-dent);
}

.journal-share-hint {
  background: var(--paper-dent);
  border-left: 2px solid var(--accent-warm);
}
</style>
