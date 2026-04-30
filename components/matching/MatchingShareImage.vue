<template>
  <ClientOnly>
    <div class="matching-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        分享图：上为全宽主图（4:3），下为服饰 3 列方格，含悬浮信息、色号圆点（与详情小图一致）
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
        <template v-else>已上传，可在弹窗中预览或右键另存</template>
      </p>
      <div v-if="errorMsg" class="mt-2 text-center text-xs text-red-600 dark:text-red-400">
        {{ errorMsg }}
      </div>
    </div>

    <QhxModal v-model="showSharePreviewModal">
      <div
        class="share-preview-modal flex max-h-[88vh] w-[min(92vw,960px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
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
          <p
            v-if="isAppWebView"
            class="share-preview-app-hint mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium text-[#6b3548] dark:text-pink-200"
          >
            uni-app：可长按图片保存，或使用底部「保存到相册」
          </p>
          <div class="overflow-hidden rounded-xl bg-black/5">
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
    await saveToAlbum(url, { docFilename: `_doc/matching_share_${Date.now()}.png` })
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
/** 图块间距（约 Tailwind p-1 双边） */
const BLOCK_GAP = 8
/** 圆角 rounded-xl */
const PHOTO_RADIUS = 12
const IMG_PROC = '?x-oss-process=image/quality,q_85/resize,w_1200'

const LOGO_MARGIN = 24
const CELL_FALLBACK = '#e0d6dc'

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

/** 上：全宽主图 aspect 4:3；下：3 列方格（与详情无主图区栅格一致） */
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
      x += cw
      idx++
    }
  }
  const blockHeight = rows * cellH + Math.max(0, rows - 1) * BLOCK_GAP
  return { rects, blockHeight }
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
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
    cx += dotR * 2 + gap
  }
}

/** 主图区：cover + 可选左上角色号（主单品） */
function drawMainHeroCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  r: CollageRect,
  radius: number,
  mainColors?: string,
) {
  const { x, y, w, h } = r
  if (w <= 0 || h <= 0) return
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = CELL_FALLBACK
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#6b4f5f'
    ctx.font = `${Math.max(14, Math.floor(Math.min(w, h) * 0.07))}px system-ui, "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('加载失败', x + w / 2, y + h / 2)
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()

  const colors = parseColorList(mainColors)
  if (colors.length) {
    const pad = Math.max(8, Math.floor(w * 0.02))
    drawColorDots(ctx, x + pad, y + pad, colors, Math.min(w, h))
  }
}

function drawClothesThumbOverlay(
  ctx: CanvasRenderingContext2D,
  r: CollageRect,
  item: MatchingShareSideItem,
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
    ctx.font = `500 ${badgeFs}px system-ui, "Microsoft YaHei", sans-serif`
    const tw = ctx.measureText(state).width
    const bh = Math.max(18, Math.floor(h * 0.11))
    const bw = tw + pad * 1.4
    const bx = x + w - pad - bw
    const by = y + pad
    ctx.fillStyle = '#c45a6e'
    roundRectPath(ctx, bx, by, bw, bh, 5)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state, bx + bw / 2, by + bh / 2)
    ctx.textAlign = 'left'
  }

  const gradH = Math.min(h * 0.42, Math.max(72, h * 0.36))
  const gy = y + h - gradH
  const g = ctx.createLinearGradient(x, gy, x, y + h)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.35, 'rgba(0,0,0,0.5)')
  g.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = g
  ctx.fillRect(x, gy, w, gradH)

  const fs = Math.max(11, Math.floor(Math.min(w, h) * 0.062))
  ctx.font = `500 ${fs}px system-ui, "Microsoft YaHei", sans-serif`
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
    ctx.fillStyle = '#fff'
    ctx.fillText(lines[li]!, x + pad, ty)
    ty -= fs * 1.1
  }
  if (shopLine) {
    ctx.font = `${shopFs}px system-ui, "Microsoft YaHei", sans-serif`
    ctx.fillStyle = 'rgba(255,245,250,0.9)'
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
) {
  const { x, y, w, h } = r
  if (w <= 0 || h <= 0) return
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = CELL_FALLBACK
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#6b4f5f'
    ctx.font = `${Math.max(12, Math.floor(Math.min(w, h) * 0.06))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('加载失败', x + w / 2, y + h / 2)
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()

  drawClothesThumbOverlay(ctx, r, item)
}

/** 搭配分享图用略大字号；风格同衣橱头部品牌字；置于画布左上角 */
function drawBrandMarkTopLeft(ctx: CanvasRenderingContext2D) {
  const lx = LOGO_MARGIN
  const ty = LOGO_MARGIN
  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(122, 72, 95, 0.38)'
  ctx.font = 'bold 24px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText('Lo研社', lx, ty)
  ctx.fillStyle = 'rgba(122, 72, 95, 0.28)'
  ctx.font = '600 15px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('Lolita图书馆', lx, ty + 30)
  ctx.restore()
}

/**
 * 上：全宽主图 4:3；下：服饰 3 列方格 + 悬浮信息 / 色号 / 馆状态角标。
 */
async function drawMatchingShareCanvas(payload: MatchingSharePayload): Promise<HTMLCanvasElement> {
  const pathsOrdered = [payload.mainImagePath, ...payload.sideItems.map((s) => s.clothes_img)]
  const urls = pathsOrdered.map((p) => resolveImgUrl(p) + IMG_PROC)
  const images = await Promise.all(urls.map(loadImageCors))

  const sideCount = payload.sideItems.length
  const { mainRect, thumbRects, height: canvasH } = buildMainTopClothesBottom(CANVAS_W, sideCount)

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = Math.max(1, canvasH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.fillStyle = '#e5dce2'
  ctx.fillRect(0, 0, CANVAS_W, canvas.height)

  drawMainHeroCell(ctx, images[0] ?? null, mainRect, PHOTO_RADIUS, payload.mainItemColors)

  for (let i = 0; i < thumbRects.length; i++) {
    const item = payload.sideItems[i]
    if (!item) continue
    drawClothesCell(ctx, images[i + 1] ?? null, thumbRects[i]!, item, PHOTO_RADIUS)
  }

  drawBrandMarkTopLeft(ctx)

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
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
    )
    if (!blob) {
      errorMsg.value = '生成图片失败'
      return
    }
    const file = new File([blob], `matching-share-${payload.matchingId}-${Date.now()}.png`, {
      type: 'image/png',
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
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px rgba(150, 110, 130, 0.24),
    -8px -8px 22px rgba(255, 252, 254, 0.94),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .share-preview-modal {
  background-color: #241d26;
  box-shadow:
    8px 8px 22px rgba(0, 0, 0, 0.5),
    -6px -6px 18px rgba(100, 70, 90, 0.1),
    inset 1px 1px 0 rgba(255, 210, 230, 0.05);
}

.share-preview-modal__head {
  background-color: var(--neu-raised, #ebe3e8);
  border-bottom: 1px solid #dfc9d4;
}

.dark .share-preview-modal__head {
  border-bottom-color: #3d2f38;
}

.share-preview-modal__body {
  background-color: var(--neu-raised, #ebe3e8);
}

.share-preview-modal__footer {
  background-color: var(--neu-raised, #ebe3e8);
}

.dark .share-preview-modal__footer {
  background-color: #241d26;
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
