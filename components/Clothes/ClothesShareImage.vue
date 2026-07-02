<template>
  <ClientOnly>
    <QhxJellyButton>
      <div
        :class="[
          variant === 'toolbar'
            ? 'h-[46px] flex flex-col items-center justify-center px-0.5 cursor-pointer'
            : 'h-[60px] text-center px-1 cursor-pointer',
          actionDisabled ? 'opacity-45 cursor-not-allowed' : '',
        ]"
        role="button"
        tabindex="0"
        title="生成或查看分享图"
        aria-label="生成或查看分享图"
        @click="handleShareAction"
        @keydown.enter="handleShareAction"
        @keydown.space.prevent="handleShareAction"
      >
        <div
          :class="[
            variant === 'toolbar'
              ? 'wardrobe-neu-tool-orb m-[3px] rounded-[50%] h-[24px] w-[24px] flex items-center justify-center bg-qhx-info text-white'
              : 'my-[5px] mx-auto text-white rounded-full h-[30px] w-[30px] flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 bg-qhx-primary',
            actionDisabled ? 'hover:scale-100' : '',
            generating ? 'opacity-70' : '',
          ]"
        >
          <UIcon
            v-if="generating"
            name="i-heroicons-arrow-path"
            :class="variant === 'toolbar' ? 'text-[16px] animate-spin' : 'text-[20px] text-[#ffffff] animate-spin'"
          />
          <UIcon
            v-else
            name="i-heroicons-photo-20-solid"
            :class="variant === 'toolbar' ? 'text-[16px]' : 'text-[22px] text-[#ffffff]'"
          />
        </div>
        <div :class="variant === 'toolbar' ? 'text-xs text-qhx-text' : 'clothes-share-action-label text-[12px]'">分享图</div>
      </div>
    </QhxJellyButton>

    <QhxModal v-model="showFieldModal">
      <div
        class="clothes-share-field-modal grid w-full max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#332c26] sm:w-[min(92vw,420px)]"
      >
        <div class="shrink-0 border-b border-[#e8ddd2] px-4 py-3 dark:border-[#3d342c]">
          <h3 class="clothes-share-serif text-sm font-semibold tracking-wide text-[#5a4638] dark:text-[#f5ebe3]">选择分享图显示的信息</h3>
          <p class="clothes-share-serif mt-1 text-[11px] leading-snug tracking-wide text-[#a89888] dark:text-[#c4b09a]">勾选后生成分享图（白底大图 + 价格信息）</p>
        </div>
        <div class="clothes-share-serif min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
          <div v-if="!availableFields.length" class="py-6 text-center text-sm leading-relaxed text-gray-500">
            暂无可展示的信息
          </div>
          <div v-else class="space-y-1">
            <div class="mb-2 flex gap-2">
              <button
                type="button"
                class="clothes-share-serif text-xs tracking-wide text-qhx-primary hover:underline"
                @click="selectAllFields"
              >
                全选
              </button>
              <button
                type="button"
                class="clothes-share-serif text-xs tracking-wide text-gray-500 hover:underline"
                @click="clearAllFields"
              >
                清空
              </button>
            </div>
            <UCheckbox
              v-for="field in availableFields"
              :key="field.key"
              v-model="selectedKeys"
              :value="field.key"
              :label="field.label"
              class="px-1 py-1.5"
              :ui="{
                rounded: 'text-qhx-primary cursor-pointer',
                color: 'qhx-primary',
                label: 'text-sm font-serif leading-relaxed cursor-pointer',
              }"
            />
          </div>
          <div class="mt-3 border-t border-[#e8ddd2] pt-3 dark:border-[#3d342c]">
            <UCheckbox
              v-model="highQuality"
              label="高清画质（4K）"
              class="px-1 py-1.5"
              :ui="{
                rounded: 'text-qhx-primary cursor-pointer',
                color: 'qhx-primary',
                label: 'text-sm font-serif leading-relaxed cursor-pointer',
              }"
            />
            <p class="clothes-share-serif mt-1 px-1 text-[11px] leading-snug tracking-wide text-[#a89888] dark:text-[#c4b09a]">
              分辨率提升至 4K，生成与上传耗时更长
            </p>
          </div>
        </div>
        <div
          class="clothes-share-field-modal__footer flex w-full min-w-0 gap-2 border-t border-[#e8ddd2] bg-white px-4 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.06)] dark:border-[#3d342c] dark:bg-[#332c26] dark:shadow-[0_-6px_16px_rgba(0,0,0,0.35)]"
        >
          <UButton
            type="button"
            class="min-w-0 flex-1"
            variant="soft"
            color="gray"
            @click="showFieldModal = false"
          >
            取消
          </UButton>
          <UButton
            type="button"
            class="min-w-0 flex-1 bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :disabled="!selectedKeys.length || generating"
            @click="confirmAndGenerate"
          >
            确认生成
          </UButton>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,520px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="clothes-share-serif text-sm font-semibold tracking-wide text-[#4a382f] dark:text-[#f5ebe3]">分享图预览</span>
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
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="服饰分享图"
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
              class="clothes-share-serif share-save-album-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium tracking-wide outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
import { useToast } from '#imports'
import { uploadShareImageToTemp } from '@/api/index'
import QhxJellyButton from '@/components/Qhx/JellyButton.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  buildClothesSharePayload,
  drawClothesShareCanvas,
  getAvailableClothesShareFields,
  prepareClothesShareImages,
  type ClothesShareImageBundle,
  type ClothesShareRenderOptions,
  type ClothesShareSource,
} from '@/utils/clothesShareCanvas'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

const props = withDefaults(
  defineProps<{
    source: ClothesShareSource | null
    /** default: 原有大按钮；toolbar: 衣柜详情工具栏尺寸 */
    variant?: 'default' | 'toolbar'
  }>(),
  { variant: 'default' },
)

const generating = ref(false)
const serverRelativeUrl = ref('')
const showFieldModal = ref(false)
const showSharePreviewModal = ref(false)
const selectedKeys = ref<string[]>([])
const highQuality = ref(false)

const isAppWebView = computed(() => isHtml5PlusWebView())

const availableFields = computed(() => getAvailableClothesShareFields(props.source))

const previewSrc = computed(() => {
  const rel = serverRelativeUrl.value.trim()
  if (!rel) return ''
  if (/^https?:\/\//i.test(rel)) return rel
  return `${BASE_IMG}${rel.replace(/^\//, '')}`
})

const hasCachedShare = computed(() => serverRelativeUrl.value.trim().length > 0)

const actionDisabled = computed(() => !props.source?.cover || generating.value)

watch(
  () => props.source?.clothesId,
  (id, prevId) => {
    if (id !== prevId) {
      serverRelativeUrl.value = ''
      showSharePreviewModal.value = false
      showFieldModal.value = false
      highQuality.value = false
    }
  },
)

function initSelectedKeys() {
  selectedKeys.value = availableFields.value.map((f) => f.key)
}

function selectAllFields() {
  selectedKeys.value = availableFields.value.map((f) => f.key)
}

function clearAllFields() {
  selectedKeys.value = []
}

function handleShareAction() {
  if (actionDisabled.value) return
  if (hasCachedShare.value) {
    showSharePreviewModal.value = true
    return
  }
  if (!props.source?.cover) {
    toast.add({ title: '缺少服饰图片，无法生成', color: 'orange', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  initSelectedKeys()
  showFieldModal.value = true
}

defineExpose({ openShare: handleShareAction })

async function savePreviewToAlbum() {
  const url = previewSrc.value.trim()
  if (!url) {
    toast.add({ title: '没有可保存的图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  try {
    await saveToAlbum(url, { docFilename: `_doc/clothes_share_${Date.now()}.jpg` })
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

async function confirmAndGenerate() {
  if (!import.meta.client || generating.value) return
  const source = props.source
  if (!source?.cover) return
  if (!selectedKeys.value.length) {
    toast.add({ title: '请至少选择一项信息', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  showFieldModal.value = false
  showSharePreviewModal.value = false
  generating.value = true

  try {
    const renderOptions: ClothesShareRenderOptions = { highQuality: highQuality.value }
    const payload = buildClothesSharePayload(source, selectedKeys.value)
    const bundle: ClothesShareImageBundle = await prepareClothesShareImages(payload, renderOptions)
    const canvas = drawClothesShareCanvas(payload, bundle, renderOptions)
    const jpegQuality = highQuality.value ? 0.95 : 0.92
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', jpegQuality),
    )
    if (!blob) {
      toast.add({ title: '生成图片失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    const file = new File(
      [blob],
      `clothes-share-${source.clothesId ?? Date.now()}-${Date.now()}.jpg`,
      { type: 'image/jpeg' },
    )
    const res = await uploadShareImageToTemp(file)
    if (!res?.file_url) {
      toast.add({ title: '上传失败', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
    toast.add({ title: '分享图已生成', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({ title: '生成失败，请稍后重试', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
/* 与服饰详情页铭牌排版一致 */
.clothes-share-serif {
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
}

.clothes-share-action-label {
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 11px;
  letter-spacing: 0.06em;
  line-height: 1.25;
}

.share-preview-modal {
  --page-raised: #fefcf9;
  --page-shadow-d: rgba(120, 95, 70, 0.08);
  --page-shadow-l: rgba(255, 252, 248, 0.98);
  background-color: #fefcf9;
  box-shadow:
    10px 10px 26px var(--page-shadow-d),
    -8px -8px 22px var(--page-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.65);
}

.dark .share-preview-modal {
  --page-raised: #332c26;
  --page-shadow-d: rgba(0, 0, 0, 0.45);
  --page-shadow-l: rgba(90, 75, 60, 0.08);
  background-color: #332c26;
}

.share-preview-modal__head {
  background-color: var(--page-raised);
  border-bottom: 1px solid #e8ddd2;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d342c;
}

.share-preview-modal__body,
.share-preview-modal__footer {
  background-color: var(--page-raised);
}

.share-save-album-btn {
  color: #7a6656;
  background: var(--page-raised);
  box-shadow:
    3px 3px 8px rgba(120, 95, 70, 0.08),
    -2px -2px 8px rgba(255, 252, 248, 0.95);
  border: 1px solid rgba(200, 175, 150, 0.3);
}

.dark .share-save-album-btn {
  color: #e8ddd2;
  border-color: rgba(160, 135, 110, 0.25);
}

.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}

.clothes-share-field-modal__footer {
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
}

.clothes-share-field-modal {
  min-height: 0;
}
</style>
