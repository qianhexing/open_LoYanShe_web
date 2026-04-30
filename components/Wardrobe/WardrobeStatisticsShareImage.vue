<template>
  <ClientOnly>
    <div class="wardrobe-statistics-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        生成分享图
      </p>
      <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
        <button
          type="button"
          class="neu-share-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[#5e3a4b] outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-pink-100"
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
          已上传至服务器，点击「查看分享图」可在弹窗中预览或右键另存
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
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">分享图预览</span>
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
          <div
            class="share-preview-modal__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1"
          >
            <p class="mb-2 text-center text-[11px] text-[#8a6f7d] dark:text-pink-300/85">
              以下为服务器返回的图片
            </p>
            <p
              v-if="isAppWebView"
              class="share-preview-app-hint mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium leading-snug text-[#6b3548] dark:text-pink-200"
            >
              uni-app：可长按图片保存，或使用底部「保存到相册」
            </p>
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="衣柜统计分享图"
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

const toast = useToast()
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()

export interface StatisticsShareMetric {
  label: string
  value: string
}

export interface StatisticsShareRow {
  name: string
  pct: string
}

export interface StatisticsShareSection {
  title: string
  rows: StatisticsShareRow[]
  hasData: boolean
}

export interface StatisticsSharePayload {
  userName: string
  scopeLabel: string
  metrics: StatisticsShareMetric[]
  sections: StatisticsShareSection[]
}

const props = defineProps<{
  payload: StatisticsSharePayload | null
}>()

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
    await saveToAlbum(url, { docFilename: `_doc/wardrobe_statistics_${Date.now()}.png` })
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

const CW = 750
const P = 36

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius: number
) {
  ctx.save()
  ctx.fillStyle = fill
  ctx.beginPath()
  const r = radius
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function truncateName(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function measurePayloadHeight(payload: StatisticsSharePayload): number {
  const mc = document.createElement('canvas')
  const ctx = mc.getContext('2d')
  if (!ctx) return 900
  let y = P + 56 + 40
  ctx.font = '15px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  const scopeText = `统计范围：${payload.scopeLabel}`
  y += wrapLines(ctx, scopeText, CW - P * 2).length * 22 + 20
  y += 92 + 24
  for (const sec of payload.sections) {
    y += 8 + 36
    if (!sec.hasData) y += 56
    else y += sec.rows.length * 44 + 8
    y += 20
  }
  return Math.max(480, y + P + 36)
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  m: StatisticsShareMetric
) {
  drawCard(ctx, x, y, w, h, '#f0e8ed', 12)
  ctx.fillStyle = '#6b4f5f'
  ctx.font = '13px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(truncateName(m.label, 8), x + w / 2, y + 30)
  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 16px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText(truncateName(m.value, 14), x + w / 2, y + 58)
  ctx.textAlign = 'left'
}

function drawFullWidthRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, row: StatisticsShareRow) {
  drawCard(ctx, x, y, w, 38, '#ebe3e8', 10)
  const has = row.name || row.pct
  if (!has) return
  ctx.fillStyle = '#4a2f3d'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(truncateName(row.name, 22), x + 12, y + 25)
  ctx.textAlign = 'right'
  ctx.fillText(row.pct, x + w - 12, y + 25)
  ctx.textAlign = 'left'
}

function drawShareCanvas(payload: StatisticsSharePayload): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const H = measurePayloadHeight(payload)
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.fillStyle = '#ebe3e8'
  ctx.fillRect(0, 0, CW, H)

  let y = P
  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 30px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('衣柜统计', CW / 2, y + 28)
  y += 56

  ctx.font = '22px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText(truncateName(payload.userName, 14), CW / 2, y + 26)
  y += 40

  ctx.fillStyle = '#6b4f5f'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  const scopeLines = wrapLines(ctx, `统计范围：${payload.scopeLabel}`, CW - P * 2)
  for (const line of scopeLines) {
    ctx.fillText(line, CW / 2, y + 18)
    y += 22
  }
  y += 20

  const GAP = 14
  const met = payload.metrics
  const mCount = Math.max(1, met.length)
  const mw = (CW - P * 2 - GAP * (mCount - 1)) / mCount
  const mh = 92
  for (let i = 0; i < mCount; i++) {
    const mx = P + i * (mw + GAP)
    const item = met[i] ?? { label: '—', value: '—' }
    drawMetricCard(ctx, mx, y, mw, mh, item)
  }
  y += mh + 24

  const fullW = CW - P * 2
  for (const sec of payload.sections) {
    y += 8
    ctx.fillStyle = '#4a2f3d'
    ctx.font = 'bold 20px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(sec.title, P, y + 22)
    y += 36

    if (!sec.hasData) {
      ctx.fillStyle = '#8a6f7d'
      ctx.font = '16px system-ui, "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`暂无${sec.title}数据`, CW / 2, y + 28)
      ctx.textAlign = 'left'
      y += 56
    } else {
      for (let i = 0; i < sec.rows.length; i++) {
        drawFullWidthRow(ctx, P, y + i * 44, fullW, sec.rows[i] ?? { name: '', pct: '' })
      }
      y += sec.rows.length * 44 + 8
    }
    y += 20
  }

  ctx.fillStyle = '#927084'
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 衣柜统计', CW / 2, y + 22)

  return canvas
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false
  const payload = props.payload
  if (!payload) {
    errorMsg.value = '暂无统计数据'
    return
  }

  generating.value = true
  try {
    const canvas = drawShareCanvas(payload)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      return
    }
    const file = new File([blob], `wardrobe-statistics-${Date.now()}.png`, { type: 'image/png' })
    const res = await uploadImageToTemp(file)
    if (!res?.file_url) {
      errorMsg.value = '上传失败：未返回地址'
      return
    }
    serverRelativeUrl.value = res.file_url
    showSharePreviewModal.value = true
  } catch (e) {
    console.error(e)
    errorMsg.value = '生成或上传失败，请稍后重试'
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.wardrobe-statistics-share {
  background: var(--neu-dent, #e4d9e0);
}

.neu-share-btn {
  background: var(--neu-raised, #ebe3e8);
  box-shadow:
    4px 4px 10px rgba(150, 110, 130, 0.22),
    -3px -3px 10px rgba(255, 252, 254, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .neu-share-btn {
  --neu-raised: #2e252c;
  box-shadow:
    4px 4px 12px rgba(0, 0, 0, 0.4),
    -2px -2px 8px rgba(130, 90, 110, 0.06),
    inset 0 1px 0 rgba(255, 210, 230, 0.05);
}

.share-preview-modal {
  --neu-base: #e5dce2;
  --neu-raised: #ebe3e8;
  --neu-dent: #e4d9e0;
  --neu-shadow-d: rgba(150, 110, 130, 0.24);
  --neu-shadow-l: rgba(255, 252, 254, 0.94);
  --neu-inset-hi: rgba(255, 255, 255, 0.62);
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px var(--neu-shadow-d),
    -8px -8px 22px var(--neu-shadow-l),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .share-preview-modal {
  --neu-base: #19141a;
  --neu-raised: #241d26;
  --neu-dent: #18141a;
  --neu-shadow-d: rgba(0, 0, 0, 0.5);
  --neu-shadow-l: rgba(100, 70, 90, 0.1);
  --neu-inset-hi: rgba(255, 210, 230, 0.05);
  background-color: #241d26;
  box-shadow:
    8px 8px 22px var(--neu-shadow-d),
    -6px -6px 18px var(--neu-shadow-l),
    inset 1px 1px 0 var(--neu-inset-hi);
}

.share-preview-modal__head {
  background-color: var(--neu-raised);
  border-bottom: 1px solid #dfc9d4;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d2f38;
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
  box-shadow:
    3px 3px 8px rgba(150, 110, 130, 0.2),
    -2px -2px 8px rgba(255, 252, 254, 0.85);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-save-album-btn {
  color: #fad6e8;
  --neu-raised: #2e252c;
  border-color: rgba(200, 140, 165, 0.25);
  box-shadow:
    3px 3px 10px rgba(0, 0, 0, 0.35),
    -1px -1px 6px rgba(130, 90, 110, 0.05);
}

.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}

.share-preview-app-hint {
  background: rgba(214, 170, 190, 0.35);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-preview-app-hint {
  background: rgba(80, 45, 60, 0.45);
  border-color: rgba(200, 140, 165, 0.25);
}
</style>
