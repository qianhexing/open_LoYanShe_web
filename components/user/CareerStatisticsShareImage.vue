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

export interface CareerShareMetricGroup {
  title: string
  icon?: string
  items: CareerShareMetric[]
}

export interface CareerSharePayload {
  userName: string
  userFace?: string
  avatarFrame?: string
  userId?: number
  level?: number
  tags?: string[]
  location?: string
  daysInLolita: number
  totalSpending: string
  achievementProgress: number
  achievementSummary: string
  /** @deprecated 优先使用 metricGroups */
  metrics?: CareerShareMetric[]
  metricGroups?: CareerShareMetricGroup[]
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
const DEFAULT_FACE = 'static/plan_cover/default.jpg'

function resolveImgUrl(path: string | null | undefined): string {
  const p = (path?.trim() || DEFAULT_FACE).trim()
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

function loadImageCors(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return
  const scale = Math.max(w / iw, h / ih)
  const sw = w / scale
  const sh = h / scale
  const sx = (iw - sw) / 2
  const sy = (ih - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

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
  ctx.shadowColor = 'rgba(150, 100, 130, 0.12)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = fill
  drawRoundRect(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.restore()
}

function drawGlassCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  drawCard(ctx, x, y, w, h, 'rgba(255,255,255,0.88)', radius)
  ctx.save()
  drawRoundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 1.5
  ctx.stroke()
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

function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  radius: number,
) {
  const size = radius * 2
  const x = cx - radius
  const y = cy - radius

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2)
  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  ringGrad.addColorStop(0, '#f472b6')
  ringGrad.addColorStop(0.5, '#e879f9')
  ringGrad.addColorStop(1, '#c084fc')
  ctx.fillStyle = ringGrad
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, size, size)
  } else {
    ctx.fillStyle = '#e8d0dc'
    ctx.fillRect(x, y, size, size)
  }
  ctx.restore()
}

function drawAvatarFrame(
  ctx: CanvasRenderingContext2D,
  frameImg: HTMLImageElement | null,
  cx: number,
  cy: number,
  radius: number,
) {
  if (!frameImg?.naturalWidth || !frameImg.naturalHeight) return
  const frameSize = radius * 2 * 1.18
  drawImageCover(ctx, frameImg, cx - frameSize / 2, cy - frameSize / 2, frameSize, frameSize)
}

function drawTagPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): number {
  const padX = 12
  const h = 26
  ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  const tw = ctx.measureText(text).width
  const w = tw + padX * 2
  drawRoundRect(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = 'rgba(236, 72, 153, 0.1)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.22)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#9d6080'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2)
  return w
}

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

function measureProfileSection(
  ctx: CanvasRenderingContext2D,
  payload: CareerSharePayload,
  startY: number,
) {
  const cardW = CW - P * 2
  const avatarR = 40
  const padTop = 22
  const padBottom = 16

  let y = startY + padTop + avatarR * 2 + 14
  const nameY = y

  const hasLevel = payload.level != null && payload.level > 0
  let badgeY = 0
  if (hasLevel) {
    badgeY = y + 6
    y = badgeY + 20 + 12
  } else {
    y += 10
  }

  const tags = (payload.tags ?? []).filter(Boolean).slice(0, 3)
  let tagRowY = 0
  if (tags.length) {
    tagRowY = y + 2
    y = tagRowY + 26 + 12
  }

  let locationLines: string[] = []
  let locationStartY = 0
  const locationText = payload.location?.trim()
  if (locationText) {
    ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
    locationLines = wrapLines(ctx, locationText, cardW - 48)
    locationStartY = y + 4
    y = locationStartY + locationLines.length * 18 + 2
  }

  const cardH = y - startY + padBottom

  return {
    cardW,
    cardH,
    avatarR,
    avatarCy: startY + padTop + avatarR,
    nameY,
    badgeY,
    hasLevel,
    tags,
    tagRowY,
    locationLines,
    locationStartY,
  }
}

function drawProfileSection(
  ctx: CanvasRenderingContext2D,
  payload: CareerSharePayload,
  avatarImg: HTMLImageElement | null,
  frameImg: HTMLImageElement | null,
  startY: number,
): number {
  const layout = measureProfileSection(ctx, payload, startY)
  const cardX = P
  const cardY = startY
  const cx = CW / 2

  drawGlassCard(ctx, cardX, cardY, layout.cardW, layout.cardH, 22)

  drawCircleAvatar(ctx, avatarImg, cx, layout.avatarCy, layout.avatarR)
  drawAvatarFrame(ctx, frameImg, cx, layout.avatarCy, layout.avatarR)

  const name = truncateName(payload.userName, 12)
  ctx.font = 'bold 22px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillStyle = '#4a2f3d'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(name, cx, layout.nameY)

  if (layout.hasLevel) {
    const badgeText = `Lv.${payload.level}`
    ctx.font = 'bold 11px system-ui, "Microsoft YaHei", sans-serif'
    const badgeW = ctx.measureText(badgeText).width + 14
    const badgeH = 20
    const badgeX = cx - badgeW / 2
    drawRoundRect(ctx, badgeX, layout.badgeY, badgeW, badgeH, badgeH / 2)
    const lvGrad = ctx.createLinearGradient(badgeX, layout.badgeY, badgeX + badgeW, layout.badgeY + badgeH)
    lvGrad.addColorStop(0, '#ec4899')
    lvGrad.addColorStop(1, '#a855f7')
    ctx.fillStyle = lvGrad
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(badgeText, cx, layout.badgeY + badgeH / 2 + 1)
  }

  if (layout.tags.length) {
    ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
    const tagTexts = layout.tags.map((t) => `# ${truncateName(t, 6)}`)
    const tagWidths = tagTexts.map((t) => ctx.measureText(t).width + 24)
    const tagGap = 8
    const totalTagW = tagWidths.reduce((a, b) => a + b, 0) + tagGap * (layout.tags.length - 1)
    let tagX = cx - totalTagW / 2
    for (let i = 0; i < tagTexts.length; i++) {
      const w = drawTagPill(ctx, tagTexts[i], tagX, layout.tagRowY)
      tagX += w + tagGap
    }
  }

  if (layout.locationLines.length) {
    ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
    ctx.fillStyle = '#927084'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (let i = 0; i < layout.locationLines.length; i++) {
      const lineY = layout.locationStartY + i * 18
      if (i === 0) {
        ctx.fillText(`📍 ${layout.locationLines[i]}`, cx, lineY)
      } else {
        ctx.fillText(layout.locationLines[i], cx, lineY)
      }
    }
  }

  return cardY + layout.cardH + 14
}

function drawDaysHero(ctx: CanvasRenderingContext2D, y: number, daysInLolita: number): number {
  const heroH = 128
  const cardW = CW - P * 2
  drawGlassCard(ctx, P, y, cardW, heroH, 20)

  ctx.save()
  drawRoundRect(ctx, P, y, cardW, heroH, 20)
  const heroGrad = ctx.createLinearGradient(P, y, P + cardW, y + heroH)
  heroGrad.addColorStop(0, 'rgba(255,240,246,0.92)')
  heroGrad.addColorStop(1, 'rgba(243,232,255,0.92)')
  ctx.fillStyle = heroGrad
  ctx.fill()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#8a6f7d'
  ctx.font = '14px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('入坑天数', CW / 2, y + 34)

  const daysText = String(daysInLolita)
  const unitText = '天'
  const numberFont = 'bold 46px system-ui, "Microsoft YaHei", sans-serif'
  const unitFont = '600 20px system-ui, "Microsoft YaHei", sans-serif'
  ctx.font = numberFont
  const daysW = ctx.measureText(daysText).width
  ctx.font = unitFont
  const unitW = ctx.measureText(unitText).width
  const gap = 10
  const blockW = daysW + gap + unitW
  const blockX = (CW - blockW) / 2
  const valueY = y + 92

  ctx.textAlign = 'left'
  ctx.font = numberFont
  ctx.fillStyle = '#c0567a'
  ctx.fillText(daysText, blockX, valueY)
  ctx.font = unitFont
  ctx.fillStyle = '#b07a94'
  ctx.fillText(unitText, blockX + daysW + gap, valueY + 2)

  ctx.font = '20px serif'
  ctx.textAlign = 'right'
  ctx.globalAlpha = 0.35
  ctx.fillText('✨', P + cardW - 18, y + 28)
  ctx.textAlign = 'left'
  ctx.fillText('🎀', P + 14, y + heroH - 16)
  ctx.globalAlpha = 1

  return y + heroH + 14
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  m: CareerShareMetric,
) {
  drawGlassCard(ctx, x, y, w, h, 14)

  ctx.save()
  drawRoundRect(ctx, x + 1, y + 10, 4, h - 20, 2)
  const accent = ctx.createLinearGradient(x, y, x, y + h)
  accent.addColorStop(0, '#f472b6')
  accent.addColorStop(1, '#c084fc')
  ctx.fillStyle = accent
  ctx.fill()
  ctx.restore()

  if (m.emoji) {
    ctx.font = '20px serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#9d6080'
    ctx.fillText(m.emoji, x + 16, y + 30)
  }
  ctx.fillStyle = '#8a6f7d'
  ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(truncateName(m.label, 6), x + (m.emoji ? 42 : 16), y + 30)

  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 21px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText(truncateName(m.value, 10), x + 16, y + 62)
}

function drawMetricGroupHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  group: CareerShareMetricGroup,
) {
  const iconOffset = group.icon ? 26 : 0
  if (group.icon) {
    ctx.font = '16px serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#9d6080'
    ctx.fillText(group.icon, x, y + 16)
  }
  ctx.fillStyle = '#5e3a4b'
  ctx.font = 'bold 15px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(truncateName(group.title, 8), x + iconOffset, y + 16)

  const titleW = ctx.measureText(truncateName(group.title, 8)).width + iconOffset
  const lineX = x + titleW + 10
  const lineW = w - titleW - 10
  if (lineW > 24) {
    const lineGrad = ctx.createLinearGradient(lineX, y + 14, lineX + lineW, y + 14)
    lineGrad.addColorStop(0, 'rgba(236, 72, 153, 0.35)')
    lineGrad.addColorStop(1, 'rgba(236, 72, 153, 0)')
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(lineX, y + 14)
    ctx.lineTo(lineX + lineW, y + 14)
    ctx.stroke()
  }
}

function drawMetricGrid(
  ctx: CanvasRenderingContext2D,
  startY: number,
  groups: CareerShareMetricGroup[],
): number {
  const GAP = 10
  const colW = (CW - P * 2 - GAP) / 2
  const rowH = 76
  const groupGap = 12
  let y = startY

  for (const group of groups) {
    if (!group.items.length) continue
    drawMetricGroupHeader(ctx, P, y, CW - P * 2, group)
    y += 26
    for (let i = 0; i < group.items.length; i += 2) {
      const row = Math.floor(i / 2)
      const baseY = y + row * (rowH + GAP)
      const left = group.items[i]
      const right = group.items[i + 1]
      if (left) drawMetricCard(ctx, P, baseY, colW, rowH, left)
      if (right) drawMetricCard(ctx, P + colW + GAP, baseY, colW, rowH, right)
    }
    y += Math.ceil(group.items.length / 2) * (rowH + GAP) + groupGap
  }

  return y
}

function resolveShareMetricGroups(payload: CareerSharePayload): CareerShareMetricGroup[] {
  if (payload.metricGroups?.length) return payload.metricGroups
  if (payload.metrics?.length) {
    return [{ title: '数据统计', items: payload.metrics }]
  }
  return []
}

function drawShareCanvas(
  payload: CareerSharePayload,
  avatarImg: HTMLImageElement | null,
  frameImg: HTMLImageElement | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  drawGradientBg(ctx)

  let y = P + 12

  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 34px system-ui, "Microsoft YaHei", "PingFang SC", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Lo娘生涯', CW / 2, y)
  y += 12
  ctx.font = '16px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#927084'
  ctx.fillText('Career Statistics', CW / 2, y + 20)
  y += 40

  y = drawProfileSection(ctx, payload, avatarImg, frameImg, y)
  y = drawDaysHero(ctx, y, payload.daysInLolita)

  const metricGroups = resolveShareMetricGroups(payload)
  y = drawMetricGrid(ctx, y, metricGroups) + 8

  const barW = CW - P * 2
  const barH = 10
  drawGlassCard(ctx, P, y, barW, 68, 14)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#4a2f3d'
  ctx.font = 'bold 15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('成就进度', P + 16, y + 26)
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#8a6f7d'
  ctx.textAlign = 'right'
  ctx.fillText(payload.achievementSummary, P + barW - 16, y + 26)

  const barX = P + 16
  const barY = y + 38
  const innerW = barW - 32
  drawRoundRect(ctx, barX, barY, innerW, barH, barH / 2)
  ctx.fillStyle = '#e8dce3'
  ctx.fill()
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
  ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText(`${payload.achievementProgress}% 完成`, CW / 2, y + 62)
  y += 76

  drawGlassCard(ctx, P, y, barW, 52, 14)
  ctx.fillStyle = '#6b4f5f'
  ctx.font = '15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`总花费 ¥${payload.totalSpending}`, CW / 2, y + 32)

  ctx.fillStyle = '#927084'
  ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('Lo研社 · 生涯统计', CW / 2, CH - P + 4)

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
    const [avatarImg, frameImg] = await Promise.all([
      loadImageCors(resolveImgUrl(payload.userFace)),
      payload.avatarFrame ? loadImageCors(resolveImgUrl(payload.avatarFrame)) : Promise.resolve(null),
    ])
    const canvas = drawShareCanvas(payload, avatarImg, frameImg)
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
