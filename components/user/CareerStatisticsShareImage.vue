<template>
  <ClientOnly>
    <div class="career-statistics-share select-none rounded-2xl p-4 shadow-inner">
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
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <span class="text-sm font-semibold text-[#4a2f3d] dark:text-pink-50">生涯统计分享图</span>
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
                alt="生涯统计分享图"
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

export interface CareerShareMetric {
  label: string
  value: string
  emoji?: string
}

export interface CareerSharePayload {
  userName: string
  daysInLolita: number
  totalSpending: string
  achievementProgress: number
  achievementSummary: string
  metrics: CareerShareMetric[]
}

const props = defineProps<{
  payload: CareerSharePayload | null
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
    await saveToAlbum(url, { docFilename: `_doc/career_statistics_${Date.now()}.png` })
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

/** 9:16 竖版画布 */
const CW = 750
const CH = 1334
const P = 40

function truncateName(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
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
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius: number,
) {
  ctx.save()
  ctx.fillStyle = fill
  drawRoundRect(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.restore()
}

function drawGradientBg(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, CW, CH)
  grad.addColorStop(0, '#fff5f8')
  grad.addColorStop(0.35, '#fce7f0')
  grad.addColorStop(0.65, '#f3e8ff')
  grad.addColorStop(1, '#ede4f0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CW, CH)

  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = '#e8b4c8'
  ctx.beginPath()
  ctx.arc(CW * 0.85, CH * 0.12, 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c9b8e8'
  ctx.beginPath()
  ctx.arc(CW * 0.1, CH * 0.55, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f5c6d8'
  ctx.beginPath()
  ctx.arc(CW * 0.75, CH * 0.78, 160, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.04
  for (let i = 0; i < 12; i++) {
    ctx.font = `${28 + (i % 3) * 8}px serif`
    ctx.fillStyle = '#9d6080'
    ctx.fillText(['✨', '🎀', '💗', '🌸', '👗'][i % 5], (i * 67) % CW, 80 + (i * 110) % (CH - 160))
  }
  ctx.restore()
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  m: CareerShareMetric,
) {
  drawCard(ctx, x, y, w, h, 'rgba(255,255,255,0.82)', 16)
  ctx.save()
  ctx.shadowColor = 'rgba(180, 120, 145, 0.15)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  drawRoundRect(ctx, x, y, w, h, 16)
  ctx.strokeStyle = 'rgba(210, 170, 190, 0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  if (m.emoji) {
    ctx.font = '22px serif'
    ctx.textAlign = 'left'
    ctx.fillText(m.emoji, x + 14, y + 30)
  }
  ctx.fillStyle = '#8a6f7d'
  ctx.font = '13px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(truncateName(m.label, 6), x + (m.emoji ? 40 : 14), y + 30)

  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 22px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(truncateName(m.value, 10), x + 14, y + 62)
}

function drawShareCanvas(payload: CareerSharePayload): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  drawGradientBg(ctx)

  let y = P + 20

  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 36px system-ui, "Microsoft YaHei", "PingFang SC", serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo娘生涯', CW / 2, y)
  y += 16
  ctx.font = '18px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#927084'
  ctx.fillText('Career Statistics', CW / 2, y + 24)
  y += 52

  ctx.font = '24px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillStyle = '#5e3a4b'
  ctx.fillText(truncateName(payload.userName, 14), CW / 2, y)
  y += 36

  const heroH = 148
  drawCard(ctx, P, y, CW - P * 2, heroH, 'rgba(255,255,255,0.88)', 20)
  ctx.save()
  drawRoundRect(ctx, P, y, CW - P * 2, heroH, 20)
  const heroGrad = ctx.createLinearGradient(P, y, P + CW - P * 2, y + heroH)
  heroGrad.addColorStop(0, 'rgba(255,240,246,0.95)')
  heroGrad.addColorStop(1, 'rgba(243,232,255,0.95)')
  ctx.fillStyle = heroGrad
  ctx.fill()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#8a6f7d'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('入坑天数', CW / 2, y + 38)
  ctx.fillStyle = '#c0567a'
  ctx.font = 'bold 52px system-ui, "Microsoft YaHei", sans-serif'
  const daysText = String(payload.daysInLolita)
  ctx.fillText(daysText, CW / 2, y + 98)
  ctx.font = '18px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#927084'
  ctx.fillText('天', CW / 2 + ctx.measureText(daysText).width / 2 + 10, y + 98)
  y += heroH + 24

  const GAP = 14
  const colW = (CW - P * 2 - GAP) / 2
  const rowH = 88
  const metrics = payload.metrics
  for (let i = 0; i < metrics.length; i += 2) {
    const row = Math.floor(i / 2)
    const baseY = y + row * (rowH + GAP)
    const left = metrics[i]
    const right = metrics[i + 1]
    if (left) drawMetricCard(ctx, P, baseY, colW, rowH, left)
    if (right) drawMetricCard(ctx, P + colW + GAP, baseY, colW, rowH, right)
  }
  y += Math.ceil(metrics.length / 2) * (rowH + GAP) + 20

  const barW = CW - P * 2
  const barH = 12
  drawCard(ctx, P, y, barW, 72, 'rgba(255,255,255,0.75)', 14)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 16px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('成就进度', P + 16, y + 28)
  ctx.font = '14px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#8a6f7d'
  ctx.textAlign = 'right'
  ctx.fillText(payload.achievementSummary, P + barW - 16, y + 28)

  const barX = P + 16
  const barY = y + 42
  const innerW = barW - 32
  drawCard(ctx, barX, barY, innerW, barH, '#e8dce3', barH / 2)
  const progW = Math.max(0, Math.min(100, payload.achievementProgress)) / 100 * innerW
  if (progW > 0) {
    ctx.save()
    drawRoundRect(ctx, barX, barY, progW, barH, barH / 2)
    const pg = ctx.createLinearGradient(barX, barY, barX + progW, barY)
    pg.addColorStop(0, '#ec4899')
    pg.addColorStop(1, '#a855f7')
    ctx.fillStyle = pg
    ctx.fill()
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#927084'
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText(`${payload.achievementProgress}% 完成`, CW / 2, y + 68)
  y += 88

  drawCard(ctx, P, y, barW, 56, 'rgba(255,255,255,0.7)', 14)
  ctx.fillStyle = '#6b4f5f'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`总花费 ¥${payload.totalSpending}`, CW / 2, y + 34)
  y += 72

  ctx.fillStyle = '#927084'
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 生涯统计', CW / 2, CH - P)

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
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      return
    }
    const file = new File([blob], `career-statistics-${Date.now()}.png`, { type: 'image/png' })
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
.career-statistics-share {
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
