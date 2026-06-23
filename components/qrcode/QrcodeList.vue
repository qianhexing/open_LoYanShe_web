<script setup lang="ts">
import type { QrCode, Wardrobe, WardrobeClothes } from '@/types/api'
import {
  deleteQrCode,
  getQrCodeList,
  insertQrCode,
  updateQrCode,
} from '@/api/qrcode'
import { uploadImageToTemp } from '@/api/index'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  buildWardrobeQrcodeSharePayload,
  drawWardrobeQrcodeShareCanvas,
  prepareWardrobeQrcodeShareImages,
} from '@/utils/wardrobeQrcodeShareCanvas'
import dayjs from 'dayjs'
import VueEasyLightbox from 'vue-easy-lightbox'

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()
const isAppWebView = computed(() => isHtml5PlusWebView())

const showModal = ref(false)
const loading = ref(false)
const inserting = ref(false)
const page = ref(0)
const pageSize = 10
const total = ref(0)
const list = ref<QrCode[]>([])
const pkType = ref<number | null>(null)
const pkId = ref<number | null>(null)
const shareWardrobe = ref<Wardrobe | null>(null)
const shareUserName = ref('')
const shareUserFace = ref<string | null>(null)
const sharePreviewClothes = ref<WardrobeClothes[]>([])

const generatingShareId = ref<number | null>(null)
const showSharePreviewModal = ref(false)
const sharePreviewUrl = ref('')
const shareErrorMsg = ref('')

const editingItem = ref<QrCode | null>(null)
const expirySelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const deleteTarget = ref<QrCode | null>(null)
const showDeleteConfirm = ref(false)

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)
const lightboxImgs = ref<Array<{ src: string; title?: string }>>([])

const expiryOptions: optionsInterface[] = [
  { label: '永久有效', value: 'permanent' },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '8 小时', value: 480 },
  { label: '1 天', value: 60 * 24 },
  { label: '15 天', value: 60 * 24 * 15 },
  { label: '1 个月', value: 60 * 24 * 30 },
]

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : '—'
}

const getRemainingDays = (expiresTime?: string | null) => {
  if (!expiresTime) return null
  const diffDays = dayjs(expiresTime).diff(dayjs(), 'day', true)
  if (diffDays <= 0) return '已过期'
  return `${diffDays.toFixed(2)} 天`
}

const reload = () => {
  page.value = 0
  list.value = []
  void fetchList()
}

const fetchList = async () => {
  if (loading.value || pkType.value == null || pkId.value == null) return
  loading.value = true
  page.value += 1
  try {
    const res = await getQrCodeList({
      page: page.value,
      pageSize,
      pk_type: pkType.value,
      pk_id: pkId.value,
    })
    total.value = res.count ?? 0
    const rows = res.rows ?? []
    list.value = page.value === 1 ? rows : [...list.value, ...rows]
  } catch {
    toast.add({ title: '加载失败', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    loading.value = false
  }
}

const open = (params: {
  pk_type: number
  pk_id: number
  wardrobe?: Wardrobe | null
  userName?: string
  userFace?: string | null
  previewClothes?: WardrobeClothes[]
}) => {
  pkType.value = params.pk_type
  pkId.value = params.pk_id
  shareWardrobe.value = params.wardrobe ?? null
  shareUserName.value = params.userName?.trim() || 'Lo娘'
  shareUserFace.value = params.userFace ?? null
  sharePreviewClothes.value = params.previewClothes ?? []
  showModal.value = true
  page.value = 0
  list.value = []
  total.value = 0
  sharePreviewUrl.value = ''
  shareErrorMsg.value = ''
  void fetchList()
}

const close = () => {
  showModal.value = false
  pkType.value = null
  pkId.value = null
  shareWardrobe.value = null
  shareUserName.value = ''
  shareUserFace.value = null
  sharePreviewClothes.value = []
  page.value = 0
  list.value = []
  total.value = 0
  generatingShareId.value = null
}

const handleInsert = async () => {
  if (inserting.value || pkType.value == null || pkId.value == null) return
  inserting.value = true
  try {
    await insertQrCode({ pk_id: pkId.value, pk_type: pkType.value })
    toast.add({ title: '生成成功', icon: 'i-heroicons-check-circle', color: 'green' })
    reload()
  } catch {
    toast.add({ title: '生成失败', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    inserting.value = false
  }
}

const openExpiryEdit = (item: QrCode, e: MouseEvent) => {
  editingItem.value = item
  expirySelectRef.value?.showPicker(e)
}

const onExpiryChange = async (option: optionsInterface) => {
  const item = editingItem.value
  if (!item?.code_id) return
  const expiresTime = option.value === 'permanent' ? null : Number(option.value)
  try {
    await updateQrCode({ code_id: item.code_id, expires_time: expiresTime })
    toast.add({ title: '已更新有效期', icon: 'i-heroicons-check-circle', color: 'green' })
    reload()
  } catch {
    toast.add({ title: '更新失败', icon: 'i-heroicons-x-circle', color: 'red' })
  } finally {
    editingItem.value = null
  }
}

const askDelete = (item: QrCode) => {
  deleteTarget.value = item
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  const item = deleteTarget.value
  if (!item?.code_id) return
  try {
    await deleteQrCode({ code_id: item.code_id })
    toast.add({ title: '已删除', icon: 'i-heroicons-check-circle', color: 'green' })
    showDeleteConfirm.value = false
    deleteTarget.value = null
    reload()
  } catch {
    toast.add({ title: '删除失败', icon: 'i-heroicons-x-circle', color: 'red' })
  }
}

const previewQr = (item: QrCode) => {
  if (!item.code_url) return
  lightboxImgs.value = [{ src: `${BASE_IMG}${item.code_url}`, title: '衣柜二维码' }]
  lightboxIndex.value = 0
  lightboxVisible.value = true
}

const loadMore = () => {
  if (loading.value) return
  const maxPage = Math.ceil(total.value / pageSize)
  if (page.value < maxPage) {
    void fetchList()
  } else {
    toast.add({ title: '没有更多了', icon: 'i-heroicons-information-circle', color: 'amber' })
  }
}

const previewShareSrc = computed(() => {
  const u = sharePreviewUrl.value.trim()
  if (!u) return ''
  return u.startsWith('http') ? u : `${BASE_IMG}${u.replace(/^\//, '')}`
})

async function generateSharePoster(item: QrCode) {
  if (!import.meta.client || generatingShareId.value != null) return
  const payload = buildWardrobeQrcodeSharePayload(
    shareWardrobe.value,
    item,
    shareUserName.value,
    shareUserFace.value,
    sharePreviewClothes.value,
  )
  if (!payload) {
    toast.add({ title: '缺少二维码图片', color: 'amber', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  generatingShareId.value = item.code_id ?? -1
  shareErrorMsg.value = ''
  sharePreviewUrl.value = ''
  showSharePreviewModal.value = false

  try {
    const bundle = await prepareWardrobeQrcodeShareImages(payload)
    const canvas = drawWardrobeQrcodeShareCanvas(payload, bundle)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
    )
    if (!blob) {
      shareErrorMsg.value = '生成图片失败'
      return
    }
    const file = new File([blob], `wardrobe-qrcode-share-${Date.now()}.png`, { type: 'image/png' })
    const res = await uploadImageToTemp(file)
    if (!res?.file_url) {
      shareErrorMsg.value = '上传失败'
      return
    }
    sharePreviewUrl.value = res.file_url
    showSharePreviewModal.value = true
    toast.add({ title: '分享图已生成', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    shareErrorMsg.value = '生成分享图失败，请稍后重试'
    toast.add({ title: '生成失败', color: 'red', icon: 'i-heroicons-x-circle' })
  } finally {
    generatingShareId.value = null
  }
}

async function saveShareToAlbum() {
  const url = previewShareSrc.value
  if (!url) return
  try {
    await saveToAlbum(url, { docFilename: `_doc/wardrobe_qrcode_share_${Date.now()}.png` })
    toast.add({ title: '已保存到相册', color: 'green', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败，请长按图片或右键另存',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  }
}

defineExpose({ open })
</script>

<template>
  <QhxModal v-model="showModal" @close="close">
    <div
      class="qrcode-list-modal flex max-h-[88vh] w-[min(94vw,520px)] flex-col overflow-hidden rounded-3xl"
    >
      <div class="qrcode-list-toolbar flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-200/90 to-purple-200/80 text-[#9d4080] shadow-sm dark:from-pink-900/50 dark:to-purple-900/40 dark:text-pink-200"
          >
            <UIcon name="material-symbols:qr-code-2" class="text-lg" />
          </div>
          <div class="min-w-0 pt-0.5">
            <h3 class="text-base font-bold tracking-tight text-[#4a2f3d] dark:text-pink-50 sm:text-[17px]">
              二维码列表
            </h3>
            <p class="mt-0.5 text-[11px] leading-snug text-[#8a6f7d] dark:text-pink-300/80 sm:text-xs">
              生成后可扫码访问本衣柜
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8a6f7d] transition hover:bg-black/5 dark:text-pink-300/85 dark:hover:bg-white/10"
          aria-label="关闭"
          @click="close"
        >
          <UIcon name="i-heroicons-x-mark-20-solid" class="h-5 w-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 sm:px-4">
        <button
          type="button"
          class="qrcode-insert-btn mb-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          :disabled="inserting"
          @click="handleInsert"
        >
          <UIcon
            :name="inserting ? 'i-heroicons-arrow-path' : 'material-symbols:qr-code-2'"
            :class="inserting ? 'animate-spin' : ''"
            class="text-base"
          />
          {{ inserting ? '生成中…' : '生成二维码' }}
        </button>

        <div v-if="loading && list.length === 0" class="flex flex-col items-center justify-center gap-3 py-12">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-[#9d6080] dark:text-pink-300" />
          <p class="text-sm text-[#7a5f6f] dark:text-pink-300/85">加载中…</p>
        </div>

        <div
          v-else-if="list.length === 0"
          class="flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center"
        >
          <div
            class="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100/70 text-[#9d6080] dark:bg-pink-950/40 dark:text-pink-300"
          >
            <UIcon name="material-symbols:qr-code-2" class="text-2xl" />
          </div>
          <p class="text-sm font-medium text-[#5e3a4b] dark:text-pink-100">暂无二维码</p>
          <p class="max-w-[240px] text-xs leading-relaxed text-[#8a6f7d] dark:text-pink-300/75">
            点击上方按钮生成，扫码即可访问本衣柜
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in list"
            :key="item.code_id"
            class="qrcode-list-item flex items-center gap-3 rounded-2xl p-3"
          >
            <button
              type="button"
              class="qrcode-thumb shrink-0 overflow-hidden rounded-xl outline-none transition hover:opacity-90"
              @click="previewQr(item)"
            >
              <img
                v-if="item.code_url"
                :src="`${BASE_IMG}${item.code_url}`"
                alt="二维码"
                class="h-[70px] w-[70px] object-cover"
                loading="lazy"
              />
            </button>
            <div class="min-w-0 flex-1 space-y-1 text-xs text-[#5e3a4b] dark:text-pink-100">
              <p>
                过期时间：
                <span class="font-medium">
                  {{ item.expires_time == null ? '永久有效' : formatDate(item.expires_time) }}
                </span>
              </p>
              <p v-if="item.expires_time != null" class="text-red-500 dark:text-red-400">
                剩余 {{ getRemainingDays(item.expires_time) }}
              </p>
              <p class="text-[#8a6f7d] dark:text-pink-300/75">
                创建时间：{{ formatDate(item.create_time) }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-center gap-1.5">
              <QhxJellyButton>
                <div
                  class="flex cursor-pointer flex-col items-center px-0.5 text-center"
                  :class="generatingShareId != null ? 'pointer-events-none opacity-55' : ''"
                  @click="generateSharePoster(item)"
                >
                  <div
                    class="qrcode-neu-tool-orb m-[3px] flex h-[24px] w-[24px] items-center justify-center rounded-[50%] bg-qhx-primary text-white"
                  >
                    <UIcon
                      :name="generatingShareId === item.code_id ? 'i-heroicons-arrow-path' : 'i-heroicons-share'"
                      class="text-[16px] text-white"
                      :class="{ 'animate-spin': generatingShareId === item.code_id }"
                    />
                  </div>
                  <div class="text-[11px] text-[#5e3a4b] dark:text-pink-100">分享</div>
                </div>
              </QhxJellyButton>
              <QhxJellyButton>
                <div
                  class="flex cursor-pointer flex-col items-center px-0.5 text-center"
                  @click="openExpiryEdit(item, $event)"
                >
                  <div
                    class="qrcode-neu-tool-orb m-[3px] flex h-[24px] w-[24px] items-center justify-center rounded-[50%] bg-qhx-primary text-white"
                  >
                    <UIcon name="i-heroicons-pencil-square" class="text-[16px]" />
                  </div>
                  <div class="text-[11px] text-[#5e3a4b] dark:text-pink-100">编辑</div>
                </div>
              </QhxJellyButton>
              <QhxJellyButton>
                <div
                  class="flex cursor-pointer flex-col items-center px-0.5 text-center"
                  @click="askDelete(item)"
                >
                  <div
                    class="qrcode-neu-tool-orb m-[3px] flex h-[24px] w-[24px] items-center justify-center rounded-[50%] bg-red-500 text-white"
                  >
                    <UIcon name="i-heroicons-trash" class="text-[16px]" />
                  </div>
                  <div class="text-[11px] text-[#5e3a4b] dark:text-pink-100">删除</div>
                </div>
              </QhxJellyButton>
            </div>
          </div>
        </div>

        <QhxLoading
          :loading="loading && list.length > 0"
          :page="page"
          :total="total"
          :page-size="pageSize"
          class="mt-3"
          @load-more="loadMore"
        />
        <p v-if="shareErrorMsg" class="mt-2 text-center text-xs text-red-600 dark:text-red-400">
          {{ shareErrorMsg }}
        </p>
      </div>
    </div>
  </QhxModal>

  <QhxModal v-model="showSharePreviewModal">
    <div
      class="share-preview-modal flex max-h-[88vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
    >
      <div
        class="share-preview-modal__head flex shrink-0 items-center justify-between gap-2 px-4 py-3"
      >
        <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">分享海报预览</span>
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
          <p class="mb-2 text-center text-[11px] text-[#8a6f7d] dark:text-pink-300/85">
            固定比例 3:4 · 含衣柜信息与二维码
          </p>
          <div class="overflow-hidden rounded-xl">
            <img
              v-if="previewShareSrc"
              :src="previewShareSrc"
              alt="衣柜二维码分享海报"
              class="share-preview-modal__img mx-auto h-auto w-full max-w-full object-contain"
              loading="lazy"
              draggable="true"
            />
          </div>
        </div>
        <div
          v-if="isAppWebView && previewShareSrc"
          class="share-preview-modal__footer shrink-0 border-t border-[#dfc9d4] px-3 py-3 dark:border-[#3d2f38]"
        >
          <button
            type="button"
            class="share-save-album-btn mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
            :disabled="savingToAlbum"
            @click="saveShareToAlbum"
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

  <QhxSelect
    ref="expirySelectRef"
    :options="expiryOptions"
    @select="onExpiryChange"
  />

  <QhxModal v-model="showDeleteConfirm">
    <div class="p-6 w-[min(94vw,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
      <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">操作确认</h3>
      <p class="text-gray-700 dark:text-gray-300 mb-4">确定要删除这个二维码吗？</p>
      <div class="flex justify-end gap-2">
        <UButton color="gray" @click="showDeleteConfirm = false">取消</UButton>
        <UButton color="red" @click="confirmDelete">确定删除</UButton>
      </div>
    </div>
  </QhxModal>

  <ClientOnly>
    <VueEasyLightbox
      :visible="lightboxVisible"
      :imgs="lightboxImgs"
      :index="lightboxIndex"
      teleport="body"
      @hide="lightboxVisible = false"
    />
  </ClientOnly>
</template>

<style scoped>
.qrcode-list-modal {
  background: linear-gradient(165deg, #f5eef2 0%, #ebe3e8 48%, #e8dfe5 100%);
  box-shadow:
    0 24px 48px rgba(74, 47, 61, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.dark .qrcode-list-modal {
  background: linear-gradient(165deg, #2a2228 0%, #241d26 55%, #1f1920 100%);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.qrcode-insert-btn {
  color: #5e3a4b;
  background: linear-gradient(145deg, #faf6f8, #ebe3e8);
  box-shadow:
    4px 4px 10px rgba(157, 96, 128, 0.14),
    -3px -3px 8px rgba(255, 255, 255, 0.85);
}

.dark .qrcode-insert-btn {
  color: #f5d9e8;
  background: linear-gradient(145deg, #2e2630, #241d26);
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.35),
    -2px -2px 6px rgba(255, 255, 255, 0.04);
}

.qrcode-list-item {
  background: rgba(255, 255, 255, 0.55);
  box-shadow:
    3px 3px 10px rgba(157, 96, 128, 0.1),
    -2px -2px 6px rgba(255, 255, 255, 0.7);
}

.dark .qrcode-list-item {
  background: rgba(255, 255, 255, 0.04);
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.25),
    -1px -1px 4px rgba(255, 255, 255, 0.03);
}

.qrcode-neu-tool-orb {
  box-shadow:
    4px 5px 11px rgba(0, 0, 0, 0.2),
    -2px -3px 9px rgba(255, 255, 255, 0.42),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.38),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s ease, transform 0.18s ease;
}

.dark .qrcode-neu-tool-orb {
  box-shadow:
    4px 5px 14px rgba(0, 0, 0, 0.52),
    -2px -2px 7px rgba(255, 255, 255, 0.06),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.qrcode-neu-tool-orb:active {
  box-shadow:
    inset 3px 3px 9px rgba(0, 0, 0, 0.24),
    inset -2px -2px 7px rgba(255, 255, 255, 0.12);
  transform: scale(0.94);
}

.dark .qrcode-neu-tool-orb:active {
  box-shadow:
    inset 3px 3px 11px rgba(0, 0, 0, 0.48),
    inset -1px -1px 4px rgba(255, 255, 255, 0.06);
}

.share-preview-modal {
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px rgba(150, 110, 130, 0.24),
    -8px -8px 22px rgba(255, 252, 254, 0.94),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .share-preview-modal {
  background-color: #241d26;
}

.share-preview-modal__head,
.share-preview-modal__body,
.share-preview-modal__footer {
  background-color: #ebe3e8;
}

.dark .share-preview-modal__head,
.dark .share-preview-modal__body,
.dark .share-preview-modal__footer {
  background-color: #241d26;
}

.share-preview-modal__head {
  border-bottom: 1px solid #dfc9d4;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d2f38;
}

.share-save-album-btn {
  color: #5e3a4b;
  background: #ebe3e8;
  box-shadow:
    3px 3px 8px rgba(150, 110, 130, 0.2),
    -2px -2px 8px rgba(255, 252, 254, 0.85);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-save-album-btn {
  color: #fad6e8;
  background: #2e252c;
  border-color: rgba(200, 140, 165, 0.25);
}

.share-preview-modal__img {
  aspect-ratio: 3 / 4;
}
</style>
