<template>
  <ClientOnly>
    <div class="matching-share select-none">
      <div class="matching-share__icon mb-3 flex justify-center">
        <span class="matching-share__icon-well inline-flex h-11 w-11 items-center justify-center rounded-[0.7rem]">
          <UIcon name="i-heroicons-photo-20-solid" class="h-5 w-5 text-qhx-primary" />
        </span>
      </div>
      <p class="matching-share__title text-center">生成搭配分享图</p>
      <p class="mt-1.5 text-center text-[11px] leading-relaxed text-[#9a858a]">
        主图 4:3 · 服饰三列方格 · 含备注与风格信息
      </p>

      <div class="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-2.5">
        <button
          type="button"
          class="matching-share-btn matching-share-btn--primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          :disabled="!payload || generating"
          @click="generateAndUpload"
        >
          <span v-if="generating" class="inline-flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
            生成并上传中…
          </span>
          <span v-else class="inline-flex items-center justify-center gap-1.5">
            <UIcon name="i-heroicons-sparkles-20-solid" class="h-4 w-4" />
            生成分享图并上传
          </span>
        </button>
        <button
          v-if="previewSrc && !generating"
          type="button"
          class="matching-share-btn rounded-xl px-4 py-2.5 text-sm font-medium text-[#4f3f43] outline-none transition active:scale-[0.99]"
          @click="showSharePreviewModal = true"
        >
          查看分享图
        </button>
      </div>
      <p
        v-if="previewSrc && !generating"
        class="mt-2.5 text-center text-[11px] leading-relaxed text-[#9a858a]"
      >
        <template v-if="isAppWebView">
          已上传，点「查看分享图」后可用
          <strong class="font-semibold text-qhx-primary">保存到相册</strong>
          ，或长按图片保存
        </template>
        <template v-else>已上传，可在弹窗中预览或右键另存</template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-[#e05353]">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,960px)] flex-col overflow-hidden rounded-[1.35rem]"
      >
        <div
          class="share-preview-modal__head flex shrink-0 select-none items-center justify-between gap-2 px-4 py-3"
        >
          <div>
            <p class="share-preview-modal__title">分享图预览</p>
            <p class="mt-0.5 text-[11px] text-[#9a858a]">Share poster</p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[#9a858a] outline-none transition hover:bg-qhx-primary/10"
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
              class="share-preview-app-hint mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium text-[#4f3f43]"
            >
              uni-app：可长按图片保存，或使用底部「保存到相册」
            </p>
            <div class="share-preview-frame overflow-hidden rounded-2xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="搭配分享图"
                class="share-preview-modal__img mx-auto h-auto w-full max-w-full object-contain"
                loading="lazy"
                draggable="true"
              />
            </div>
          </div>
          <div
            v-if="isAppWebView && previewSrc"
            class="share-preview-modal__footer shrink-0 px-3 py-3"
          >
            <button
              type="button"
              class="matching-share-btn matching-share-btn--primary mx-auto flex w-full max-w-[320px] justify-center rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
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
              <span v-else class="inline-flex items-center justify-center gap-1.5">
                <UIcon name="i-heroicons-arrow-down-tray-20-solid" class="h-4 w-4" />
                保存到相册
              </span>
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

/** 分享图用单品缩略数据（与详情附图信息一致，供悬浮层绘制） */
export interface MatchingShareSideItem {
  clothes_img: string
  caption?: string
  price?: string | number
  /** 逗号分隔色值，如 #ff0000 */
  color?: string | number
  shopLine?: string
  /** 资料馆状态角标 */
  libraryState?: string | number
}

export interface MatchingSharePayload {
  note: string
  matchingId: number
  userName: string
  mainStyle?: string
  /** 主图：封面或主单品图路径（无封面主单品时可为首张附图，与 detail 逻辑一致） */
  mainImagePath: string
  sideItems: MatchingShareSideItem[]
  /** @deprecated 分享画布已固定为上主图下网格，此字段可忽略 */
  shareLayout?: 'floatMain' | 'gridOnly'
  tags?: string[]
  mainItemPrice?: string | number
  mainItemCaption?: string
  mainItemShopLine?: string
  /** 主单品色盘，逗号分隔，与详情主图角标一致 */
  mainItemColors?: string
}

const props = defineProps<{
  payload: MatchingSharePayload | null
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
    await saveToAlbum(url, { docFilename: `_doc/matching_share_${Date.now()}.jpg` })
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

/** 与页面内容区同宽导出基准 */
const CANVAS_W = 1080
/** 画布外边距 */
const OUTER_PAD = 36
/** 图块间距 */
const BLOCK_GAP = 10
/** 圆角 */
const PHOTO_RADIUS = 18
const CARD_RADIUS = 28
const IMG_PROC = '?x-oss-process=image/quality,q_85/resize,w_1200'

const COLOR = {
  text: '#4f3f43',
  muted: '#9a858a',
  primary: '#ff9eb5',
  primaryDeep: '#e8899f',
  cardTop: '#fffbfc',
  cardBottom: '#fff7f9',
  fallback: '#f3e8ec',
  pageTop: '#fff9fb',
  pageMid: '#fff5f8',
  pageBottom: '#fff2f6',
  border: 'rgba(255, 158, 181, 0.28)',
  badge: '#ff9eb5',
}

function resolvePrimaryColor(): string {
  if (!import.meta.client) return COLOR.primary
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()
    return v || COLOR.primary
  } catch {
    return COLOR.primary
  }
}

function resolveImgUrl(path: string | null | undefined): string {
  if (!path?.trim()) return ''
  const p = path.trim()
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

/** 与页面 img object-cover 一致 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh)
  const rw = dw / scale
  const rh = dh / scale
  const sx = (sw - rw) / 2
  const sy = (sh - rh) / 2
  ctx.drawImage(img, sx, sy, rw, rh, dx, dy, dw, dh)
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

interface CollageRect {
  x: number
  y: number
  w: number
  h: number
}

function divideEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  const q = Math.floor(total / n)
  const r = total % n
  return Array.from({ length: n }, (_, i) => q + (i < r ? 1 : 0))
}

/** 上：全宽主图 aspect 4:3；下：3 列方格 */
function buildBottomThumbGrid(width: number, count: number, y0: number): { rects: CollageRect[]; blockHeight: number } {
  if (count <= 0) return { rects: [], blockHeight: 0 }
  const cols = 3
  const colWs = divideEvenly(width, cols)
  const cellH = Math.min(colWs[0]!, colWs[1]!, colWs[2]!)
  const rows = Math.ceil(count / cols)
  const rects: CollageRect[] = []
  let idx = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols && idx < count; c++) {
      const cw = colWs[c] ?? cellH
      rects.push({ x, y: y0 + r * (cellH + BLOCK_GAP), w: cw, h: cellH })
      x += cw + (c < cols - 1 ? 0 : 0)
      // restore gap between columns
      if (c < cols - 1) {
        // colWs already partition full width without gaps; keep contiguous like before
      }
      idx++
    }
  }
  // Re-build with gaps between cells for a softer look
  const gap = BLOCK_GAP
  const innerW = width - gap * (cols - 1)
  const colWsGapped = divideEvenly(innerW, cols)
  const cellHG = Math.min(...colWsGapped)
  const rectsG: CollageRect[] = []
  let gi = 0
  for (let r = 0; r < rows; r++) {
    let x = 0
    for (let c = 0; c < cols && gi < count; c++) {
      const cw = colWsGapped[c] ?? cellHG
      rectsG.push({ x, y: y0 + r * (cellHG + gap), w: cw, h: cellHG })
      x += cw + gap
      gi++
    }
  }
  const blockHeight = rows * cellHG + Math.max(0, rows - 1) * gap
  return { rects: rectsG, blockHeight }
}

function buildMainTopClothesBottom(width: number, thumbCount: number): {
  mainRect: CollageRect
  thumbRects: CollageRect[]
  height: number
} {
  const mainW = width
  const mainH = Math.floor((mainW * 3) / 4)
  const mainRect: CollageRect = { x: 0, y: 0, w: mainW, h: mainH }
  if (thumbCount <= 0) return { mainRect, thumbRects: [], height: mainH }
  const gridY = mainH + BLOCK_GAP
  const { rects: thumbRects, blockHeight } = buildBottomThumbGrid(width, thumbCount, gridY)
  return { mainRect, thumbRects, height: gridY + blockHeight }
}

function strTrim(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function parseColorList(raw?: string | null | number): string[] {
  const s = strTrim(raw)
  if (!s) return []
  return s
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? ''
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

function drawColorDots(ctx: CanvasRenderingContext2D, x: number, y: number, colors: string[], minDim: number) {
  if (!colors.length) return
  const dotR = Math.max(5, Math.floor(minDim * 0.042))
  const gap = Math.max(3, Math.floor(dotR * 0.4))
  let cx = x
  const cy = y + dotR
  for (const c of colors) {
    ctx.beginPath()
    ctx.arc(cx + dotR, cy, dotR, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    cx += dotR * 2 + gap
  }
}

function drawSoftPhotoBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.strokeStyle = 'rgba(255, 158, 181, 0.32)'
  ctx.lineWidth = 1.5
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, radius)
  ctx.stroke()
}

/** 主图区：cover + 可选左上角色号 */
function drawMainHeroCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  r: CollageRect,
  radius: number,
  mainColors: string | undefined,
  primary: string,
) {
  const { x, y, w, h } = r
  if (w <= 0 || h <= 0) return
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = COLOR.fallback
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = COLOR.muted
    ctx.font = `${Math.max(14, Math.floor(Math.min(w, h) * 0.07))}px "Songti SC", "Microsoft YaHei", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('加载失败', x + w / 2, y + h / 2)
  }
  ctx.restore()

  drawSoftPhotoBorder(ctx, x, y, w, h, radius)

  const colors = parseColorList(mainColors)
  if (colors.length) {
    const pad = Math.max(10, Math.floor(w * 0.02))
    drawColorDots(ctx, x + pad, y + pad, colors, Math.min(w, h))
  }
}

function drawClothesThumbOverlay(
  ctx: CanvasRenderingContext2D,
  r: CollageRect,
  item: MatchingShareSideItem,
  primary: string,
) {
  const { x, y, w, h } = r
  if (w <= 0 || h <= 0) return
  const pad = Math.max(6, Math.floor(w * 0.028))
  const colors = parseColorList(item.color)
  if (colors.length) {
    drawColorDots(ctx, x + pad, y + pad, colors, Math.min(w, h))
  }

  const badgeFs = Math.max(10, Math.floor(h * 0.052))
  const state = strTrim(item.libraryState)
  if (state) {
    ctx.font = `500 ${badgeFs}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
    const tw = ctx.measureText(state).width
    const bh = Math.max(18, Math.floor(h * 0.11))
    const bw = tw + pad * 1.4
    const bx = x + w - pad - bw
    const by = y + pad
    ctx.fillStyle = primary
    roundRectPath(ctx, bx, by, bw, bh, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state, bx + bw / 2, by + bh / 2 + 0.5)
    ctx.textAlign = 'left'
  }

  const gradH = Math.min(h * 0.44, Math.max(76, h * 0.38))
  const gy = y + h - gradH
  const g = ctx.createLinearGradient(x, gy, x, y + h)
  g.addColorStop(0, 'rgba(79, 63, 67, 0)')
  g.addColorStop(0.4, 'rgba(79, 63, 67, 0.45)')
  g.addColorStop(1, 'rgba(79, 63, 67, 0.88)')
  ctx.fillStyle = g
  ctx.fillRect(x, gy, w, gradH)

  const fs = Math.max(11, Math.floor(Math.min(w, h) * 0.062))
  ctx.font = `500 ${fs}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  const priceRaw = strTrim(item.price)
  const priceStr = priceRaw ? `￥${priceRaw} ` : ''
  const cap = strTrim(item.caption)
  const blockW = w - pad * 2
  const line1Text = priceStr + cap
  const lines = wrapLines(ctx, line1Text, blockW).slice(0, 2)
  const shopLine = strTrim(item.shopLine)
  const shopFs = Math.max(9, Math.floor(fs * 0.86))
  let ty = y + h - pad - (shopLine ? shopFs + 6 : 0)
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'left'
  for (let li = lines.length - 1; li >= 0; li--) {
    ctx.fillStyle = '#fffbfc'
    ctx.fillText(lines[li]!, x + pad, ty)
    ty -= fs * 1.1
  }
  if (shopLine) {
    ctx.font = `${shopFs}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
    ctx.fillStyle = 'rgba(255, 249, 251, 0.88)'
    const short = shopLine.length > 28 ? `${shopLine.slice(0, 27)}…` : shopLine
    ctx.fillText(short, x + pad, y + h - pad)
  }
}

/** 服饰格：图 + 边框 + 悬浮层 */
function drawClothesCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  r: CollageRect,
  item: MatchingShareSideItem,
  radius: number,
  primary: string,
) {
  const { x, y, w, h } = r
  if (w <= 0 || h <= 0) return
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = COLOR.fallback
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = COLOR.muted
    ctx.font = `${Math.max(12, Math.floor(Math.min(w, h) * 0.06))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('加载失败', x + w / 2, y + h / 2)
  }
  ctx.restore()

  drawSoftPhotoBorder(ctx, x, y, w, h, radius)
  drawClothesThumbOverlay(ctx, r, item, primary)
}

function drawPageBackground(ctx: CanvasRenderingContext2D, w: number, h: number, primary: string) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, COLOR.pageTop)
  g.addColorStop(0.45, COLOR.pageMid)
  g.addColorStop(1, COLOR.pageBottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // soft radial accents（近似计划页氛围）
  const r1 = ctx.createRadialGradient(w * 0.1, 0, 0, w * 0.1, 0, w * 0.55)
  r1.addColorStop(0, hexToRgba(primary, 0.22))
  r1.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = r1
  ctx.fillRect(0, 0, w, h)

  const r2 = ctx.createRadialGradient(w, 0, 0, w, 0, w * 0.45)
  r2.addColorStop(0, hexToRgba(primary, 0.14))
  r2.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = r2
  ctx.fillRect(0, 0, w, h)
}

function hexToRgba(color: string, alpha: number): string {
  const c = color.trim()
  if (c.startsWith('rgb')) {
    const m = c.match(/[\d.]+/g)
    if (m && m.length >= 3) return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${alpha})`
  }
  let hex = c.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
  if (hex.length !== 6) return `rgba(255, 158, 181, ${alpha})`
  const n = Number.parseInt(hex, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const g = ctx.createLinearGradient(x, y, x, y + h)
  g.addColorStop(0, COLOR.cardTop)
  g.addColorStop(1, COLOR.cardBottom)
  ctx.fillStyle = g
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.strokeStyle = COLOR.border
  ctx.lineWidth = 1.5
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, radius)
  ctx.stroke()
}

function measureInfoBlock(
  ctx: CanvasRenderingContext2D,
  payload: MatchingSharePayload,
  contentW: number,
): number {
  const padY = 28
  const titleFs = 36
  const metaFs = 22
  const tagFs = 18
  let h = padY

  ctx.font = `600 ${titleFs}px "Cormorant Garamond", "Songti SC", Georgia, serif`
  const title = payload.note?.trim() || `搭配 #${payload.matchingId}`
  const titleLines = wrapLines(ctx, title, contentW - 48).slice(0, 2)
  h += titleLines.length * (titleFs * 1.25) + 10

  const metaParts: string[] = []
  if (payload.userName?.trim()) metaParts.push(payload.userName.trim())
  if (payload.mainStyle?.trim()) metaParts.push(`★ ${payload.mainStyle.trim()}`)
  if (metaParts.length) h += metaFs + 14

  const tags = (payload.tags ?? []).map((t) => strTrim(t)).filter(Boolean).slice(0, 8)
  if (tags.length) h += tagFs + 22

  h += 18 // footer brand line
  h += padY
  return Math.max(120, h)
}

function drawInfoBlock(
  ctx: CanvasRenderingContext2D,
  payload: MatchingSharePayload,
  x: number,
  y: number,
  w: number,
  h: number,
  primary: string,
) {
  drawCardShell(ctx, x, y, w, h, 22)

  const padX = 28
  const padY = 26
  let cy = y + padY

  const title = payload.note?.trim() || `搭配 #${payload.matchingId}`
  const titleFs = 36
  ctx.fillStyle = COLOR.text
  ctx.font = `600 ${titleFs}px "Cormorant Garamond", "Songti SC", Georgia, serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const titleLines = wrapLines(ctx, title, w - padX * 2).slice(0, 2)
  for (const line of titleLines) {
    ctx.fillText(line, x + padX, cy)
    cy += titleFs * 1.25
  }
  cy += 8

  const metaFs = 22
  ctx.font = `500 ${metaFs}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.fillStyle = COLOR.muted
  const metaParts: string[] = []
  if (payload.userName?.trim()) metaParts.push(payload.userName.trim())
  if (payload.mainStyle?.trim()) metaParts.push(`★ ${payload.mainStyle.trim()}`)
  if (metaParts.length) {
    ctx.fillText(metaParts.join('  ·  '), x + padX, cy)
    cy += metaFs + 14
  }

  const tags = (payload.tags ?? []).map((t) => strTrim(t)).filter(Boolean).slice(0, 8)
  if (tags.length) {
    const tagFs = 18
    ctx.font = `500 ${tagFs}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
    let tx = x + padX
    const ty = cy
    const tagH = tagFs + 14
    for (const tag of tags) {
      const label = tag.startsWith('#') ? tag : `#${tag}`
      const tw = ctx.measureText(label).width + 20
      if (tx + tw > x + w - padX) break
      ctx.fillStyle = hexToRgba(primary, 0.14)
      roundRectPath(ctx, tx, ty, tw, tagH, 999)
      ctx.fill()
      ctx.strokeStyle = hexToRgba(primary, 0.28)
      ctx.lineWidth = 1
      roundRectPath(ctx, tx + 0.5, ty + 0.5, tw - 1, tagH - 1, 999)
      ctx.stroke()
      ctx.fillStyle = COLOR.text
      ctx.textBaseline = 'middle'
      ctx.fillText(label, tx + 10, ty + tagH / 2)
      ctx.textBaseline = 'top'
      tx += tw + 8
    }
    cy += tagH + 16
  }

  // 底部分隔 + 品牌行
  const footY = y + h - 36
  ctx.strokeStyle = hexToRgba(primary, 0.18)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + padX, footY - 8)
  ctx.lineTo(x + w - padX, footY - 8)
  ctx.stroke()

  ctx.fillStyle = COLOR.muted
  ctx.font = `500 16px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText('Lo研社 · Lolita 搭配', x + padX, footY + 6)
  ctx.textAlign = 'right'
  ctx.fillText(`#${payload.matchingId}`, x + w - padX, footY + 6)
  ctx.textAlign = 'left'
}

function drawHeaderBrand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  primary: string,
): number {
  const titleFs = 42
  ctx.fillStyle = COLOR.text
  ctx.font = `600 ${titleFs}px "Cormorant Garamond", "Songti SC", Georgia, serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('Lo研社', x, y)

  ctx.fillStyle = COLOR.muted
  ctx.font = `500 18px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  ctx.fillText('Matching Share', x, y + titleFs + 4)

  // 右侧小胶囊
  const pillLabel = '搭配'
  ctx.font = `600 16px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  const pw = ctx.measureText(pillLabel).width + 28
  const ph = 32
  const px = x + w - pw
  const py = y + 8
  ctx.fillStyle = hexToRgba(primary, 0.16)
  roundRectPath(ctx, px, py, pw, ph, 999)
  ctx.fill()
  ctx.strokeStyle = hexToRgba(primary, 0.3)
  ctx.lineWidth = 1
  roundRectPath(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 999)
  ctx.stroke()
  ctx.fillStyle = primary
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(pillLabel, px + pw / 2, py + ph / 2 + 0.5)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  return titleFs + 28
}

/**
 * 粉白氛围海报：顶栏品牌 + 主图/方格 + 信息卡
 */
async function drawMatchingShareCanvas(payload: MatchingSharePayload): Promise<HTMLCanvasElement> {
  const primary = resolvePrimaryColor()
  const pathsOrdered = [payload.mainImagePath, ...payload.sideItems.map((s) => s.clothes_img)]
  const urls = pathsOrdered.map((p) => resolveImgUrl(p) + IMG_PROC)
  const images = await Promise.all(urls.map(loadImageCors))

  const contentW = CANVAS_W - OUTER_PAD * 2
  const sideCount = payload.sideItems.length
  const { mainRect, thumbRects, height: collageH } = buildMainTopClothesBottom(contentW, sideCount)

  // 临时测量信息区高度
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = 10
  measureCanvas.height = 10
  const mctx = measureCanvas.getContext('2d')
  if (!mctx) throw new Error('canvas')
  const infoH = measureInfoBlock(mctx, payload, contentW)

  const headerH = 78
  const sectionGap = 22
  const canvasH =
    OUTER_PAD +
    headerH +
    sectionGap +
    collageH +
    sectionGap +
    infoH +
    OUTER_PAD

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = Math.max(1, Math.ceil(canvasH))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  drawPageBackground(ctx, CANVAS_W, canvas.height, primary)

  // 外层主卡片
  const cardX = OUTER_PAD - 8
  const cardY = OUTER_PAD - 8
  const cardW = CANVAS_W - (OUTER_PAD - 8) * 2
  const cardH = canvas.height - (OUTER_PAD - 8) * 2
  drawCardShell(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS)

  let cursorY = OUTER_PAD + 8
  const contentX = OUTER_PAD

  const usedHeader = drawHeaderBrand(ctx, contentX, cursorY, contentW, primary)
  cursorY += usedHeader + sectionGap

  // 拼贴相对偏移
  const ox = contentX
  const oy = cursorY
  drawMainHeroCell(
    ctx,
    images[0] ?? null,
    { ...mainRect, x: mainRect.x + ox, y: mainRect.y + oy },
    PHOTO_RADIUS,
    payload.mainItemColors,
    primary,
  )

  for (let i = 0; i < thumbRects.length; i++) {
    const item = payload.sideItems[i]
    const rect = thumbRects[i]
    if (!item || !rect) continue
    drawClothesCell(
      ctx,
      images[i + 1] ?? null,
      { ...rect, x: rect.x + ox, y: rect.y + oy },
      item,
      PHOTO_RADIUS,
      primary,
    )
  }

  cursorY += collageH + sectionGap
  drawInfoBlock(ctx, payload, contentX, cursorY, contentW, infoH, primary)

  return canvas
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false
  const payload = props.payload
  if (!payload?.mainImagePath) {
    errorMsg.value = '缺少主图，无法生成'
    return
  }

  generating.value = true
  try {
    const canvas = await drawMatchingShareCanvas(payload)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      return
    }
    const file = new File([blob], `matching-share-${payload.matchingId}-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })
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
.matching-share {
  color: #4f3f43;
  padding: 1.1rem 1rem 1.15rem;
  border-radius: 1.15rem;
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 9%, transparent);
}

.matching-share__title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
}

.matching-share__icon-well {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.matching-share-btn {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.matching-share-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary-color) 8%, white);
}

.matching-share-btn--primary {
  color: #fff;
  background: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 55%, transparent);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary-color) 28%, transparent);
}

.matching-share-btn--primary:hover:not(:disabled) {
  filter: brightness(1.03);
  background: var(--primary-color);
}

.share-preview-modal {
  color: #4f3f43;
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.share-preview-modal__head {
  border-bottom: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.share-preview-modal__title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: #4f3f43;
}

.share-preview-modal__footer {
  border-top: 1px solid color-mix(in srgb, var(--primary-color) 14%, transparent);
  background: color-mix(in srgb, #fff9fb 88%, transparent);
}

.share-preview-frame {
  background: color-mix(in srgb, var(--primary-color) 6%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}

.share-preview-app-hint {
  background: color-mix(in srgb, var(--primary-color) 12%, white);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
}
</style>
