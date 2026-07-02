<template>
  <ClientOnly>
    <div class="wardrobe-long-share select-none rounded-2xl p-4 shadow-inner">
      <p class="mb-3 text-center text-xs font-medium text-[#6b4f5f] dark:text-pink-200/90">
        生成长图（含当前筛选与排序，服饰较多时请稍候）
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
          <span v-else>生成长图并上传</span>
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
          已上传至服务器，可在弹窗中预览或右键另存（过长图若异常可缩小浏览器再试）
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
            <div class="overflow-hidden rounded-xl">
              <img
                v-if="previewSrc"
                :src="previewSrc"
                alt="衣柜长图分享"
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
                <UIcon
                  name="i-heroicons-arrow-path"
                  class="h-4 w-4 animate-spin"
                />
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
import type { Wardrobe, WardrobeClothes } from '@/types/api'
import { getClothesList, type ClothesParams } from '@/api/wardrobe'
import { uploadTempFileToOSS } from '@/utils/ossUpload'
import QhxModal from '@/components/Qhx/Modal.vue'
import { isHtml5PlusWebView, useSaveNetworkImageToAlbum } from '@/composables/useSaveNetworkImageToAlbum'
import { BASE_IMG } from '@/utils/ipConfig'

const toast = useToast()

const props = defineProps<{
  wardrobeId: number
  info: Wardrobe
  filterList: { tags: string[]; wardrobe_status: string[]; clothes_note: string; size: string[] }
  password: string
  timelineMode: boolean
}>()

const generating = ref(false)
const { saving: savingToAlbum, saveToAlbum } = useSaveNetworkImageToAlbum()
const progressLabel = ref('')
const errorMsg = ref('')
const serverRelativeUrl = ref('')
const showSharePreviewModal = ref(false)

const canGenerate = computed(() => !!props.wardrobeId && !!props.info?.wardrobe_id)

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
    await saveToAlbum(url, { docFilename: `_doc/wardrobe_long_${Date.now()}.jpg` })
    toast.add({
      title: '已保存到相册',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    })
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
const PAD = 28
/** 头部右上角品牌标识占位，避免标题与文案重叠 */
const HEADER_BRAND_RESERVE = 120
/** 头部左侧封面尺寸 */
const COVER_HEADER = 200
const COVER_HEAD_GAP = 16
/** 单张画布最大高度，避免超出浏览器限制 */
const MAX_CANVAS_H = 16000
const PHOTO_RADIUS = 12
const COVER_RADIUS = 14
/** 卡片下方文案区 */
const META_H_PAD = 12
const META_TOP = 14
/** 备注与封面之间的顶部间距（大于仅价格时的 META_TOP） */
const NOTE_TOP = 22
const LINE_H = 20
const NOTE_PRICE_GAP = 8
const ROW_GAP = 12
const BADGE_INSET = 6

const SHOW_CLOTHES_NOTE_KEY = 'wardrobe-detail-show-clothes-note'
const SHOW_CLOTHES_PRICE_KEY = 'wardrobe-detail-show-clothes-price'
const SHOW_CLOTHES_STATUS_KEY = 'wardrobe-detail-show-clothes-status'
const SHOW_CLOTHES_FAVORITE_KEY = 'wardrobe-detail-show-clothes-favorite'

interface ShareLayoutPrefs {
  showNote: boolean
  showPrice: boolean
  showStatus: boolean
  showFavorite: boolean
}

interface CellMetaMeasure {
  noteLines: string[]
  showPrice: boolean
  metaH: number
}

interface ShareCanvasTheme {
  bg: string
  bgOverlay: string | null
  text: string
  textMuted: string
  title: string
  primary: string
  photoBorder: string
  divider: string
  footer: string
  photoBg: string
}

interface StatusBadgeStyle {
  text: string
  bg: string
  border: string
}

const STATUS_BADGE_STYLES: Record<string, StatusBadgeStyle> = {
  待补款: { text: '#92400e', bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.3)' },
  已拥有: { text: '#065f46', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.26)' },
}

const DEFAULT_STATUS_BADGE: StatusBadgeStyle = {
  text: '#5b21b6',
  bg: 'rgba(139, 92, 246, 0.14)',
  border: 'rgba(139, 92, 246, 0.24)',
}

function getCssVar(name: string, fallback: string): string {
  if (!import.meta.client) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildShareTheme(info: Wardrobe): ShareCanvasTheme {
  const style = info.custom_style as Record<string, unknown> | undefined
  const backColor = typeof style?.backColor === 'string' ? style.backColor : ''
  const backOpacity = typeof style?.back_opacity === 'number' ? style.back_opacity : 1
  const fontColor =
    typeof style?.fontColor === 'string' ? style.fontColor : getCssVar('--text-color', '#4b5563')
  const primary =
    typeof style?.btnColor === 'string' ? style.btnColor : getCssVar('--primary-color', '#ff9eb5')
  const defaultBg = getCssVar('--background-color', '#f3f4f6')

  let bg = defaultBg
  let bgOverlay: string | null = null
  if (backColor) {
    const rgba = hexToRgba(backColor, backOpacity)
    if (info.background) {
      bgOverlay = rgba
    } else {
      bg = rgba
    }
  }

  return {
    bg,
    bgOverlay,
    text: fontColor,
    textMuted: hexToRgba(fontColor.startsWith('#') ? fontColor : '#4b5563', 0.72),
    title: fontColor,
    primary,
    photoBorder: 'rgba(209, 213, 219, 0.95)',
    divider: 'rgba(0, 0, 0, 0.08)',
    footer: hexToRgba(fontColor.startsWith('#') ? fontColor : '#4b5563', 0.55),
    photoBg: '#f9fafb',
  }
}

function getStatusBadgeStyle(status: string): StatusBadgeStyle {
  return STATUS_BADGE_STYLES[status] ?? DEFAULT_STATUS_BADGE
}

function readBoolPref(key: string, defaultValue = true): boolean {
  if (!import.meta.client || typeof localStorage === 'undefined') return defaultValue
  try {
    const v = localStorage.getItem(key)
    return v === null ? defaultValue : v === '1'
  } catch {
    return defaultValue
  }
}

function readShareLayoutPrefs(): ShareLayoutPrefs {
  return {
    showNote: readBoolPref(SHOW_CLOTHES_NOTE_KEY),
    showPrice: readBoolPref(SHOW_CLOTHES_PRICE_KEY),
    showStatus: readBoolPref(SHOW_CLOTHES_STATUS_KEY),
    showFavorite: readBoolPref(SHOW_CLOTHES_FAVORITE_KEY),
  }
}

function getFavoriteLevel(item: WardrobeClothes): number {
  const v = item.is_favorite
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
}

function hasClothesPrice(item: WardrobeClothes): boolean {
  return item.price != null && Number(item.price) > 0
}

function formatClothesPrice(info: Wardrobe, price: number | string | null | undefined): string {
  if (info.show_price === 2 || info.show_price !== 1) return '***'
  return String(price ?? 0)
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

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
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

/** 与衣柜详情时间轴一致：按入柜时间升序 */
function clothesAddTimeMs(item: WardrobeClothes): number {
  const t = item.add_time
  if (t == null) return 0
  const d = t instanceof Date ? t : new Date(typeof t === 'string' || typeof t === 'number' ? t : String(t))
  const ms = d.getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function sortListByAddTimeAsc(rows: WardrobeClothes[]): WardrobeClothes[] {
  return [...rows].sort((a, b) => clothesAddTimeMs(a) - clothesAddTimeMs(b))
}

async function fetchAllClothesForShare(): Promise<WardrobeClothes[]> {
  const batch = 400
  const all: WardrobeClothes[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY
  while (all.length < totalCount) {
    const params: ClothesParams = {
      page,
      pageSize: batch,
      wardrobe_id: props.wardrobeId,
      filter_list: props.filterList,
    }
    if (props.timelineMode) {
      params.sort_list = 'add_time_asc'
    }
    if (props.password) {
      params.password = props.password
    }
    const res = await getClothesList(params)
    const rows = res.rows ?? []
    totalCount = typeof res.count === 'number' ? res.count : all.length + rows.length
    all.push(...rows)
    if (rows.length < batch || all.length >= totalCount) break
    page += 1
    if (page > 200) break
  }
  if (props.timelineMode && !props.filterList) {
    /* noop */
  }
  if (props.timelineMode) {
    return sortListByAddTimeAsc(all)
  }
  return all
}

watch(
  () => [props.wardrobeId, props.timelineMode, props.info?.wardrobe_id],
  () => {
    serverRelativeUrl.value = ''
    errorMsg.value = ''
  }
)

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

function drawImageCoverFull(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height
  const cr = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (ir > cr) {
    sw = sh * cr
    sx = (img.width - sw) / 2
  } else {
    sh = sw / cr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: ShareCanvasTheme,
  bgImg: HTMLImageElement | null
) {
  if (bgImg) {
    drawImageCoverFull(ctx, bgImg, 0, 0, w, h)
    if (theme.bgOverlay) {
      ctx.fillStyle = theme.bgOverlay
      ctx.fillRect(0, 0, w, h)
    }
  } else {
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)
  }
}

/** 拟态相框：对齐 wardrobe-neu-photo */
function drawNeuPhotoFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  theme: ShareCanvasTheme
) {
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.13)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetX = 3
  ctx.shadowOffsetY = 4
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.07)')
  grad.addColorStop(0.35, 'rgba(0, 0, 0, 0)')
  grad.addColorStop(0.65, 'rgba(255, 255, 255, 0)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.28)')
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  ctx.strokeStyle = theme.photoBorder
  ctx.lineWidth = 1
  ctx.save()
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()
  ctx.restore()
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  theme: ShareCanvasTheme
) {
  drawNeuPhotoFrame(ctx, x, y, w, h, radius, theme)
  const inset = 1
  ctx.save()
  roundRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(0, radius - 1))
  ctx.clip()
  drawImageCoverFull(ctx, img, x + inset, y + inset, w - inset * 2, h - inset * 2)
  ctx.restore()
}

function drawStatusBadgePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  maxW: number
) {
  const style = getStatusBadgeStyle(text)
  ctx.font = '600 11px system-ui, "Microsoft YaHei", sans-serif'
  const tw = ctx.measureText(text).width
  const bw = Math.min(maxW, tw + 16)
  const bh = 22
  ctx.fillStyle = style.bg
  roundRectPath(ctx, x + BADGE_INSET, y + BADGE_INSET, bw, bh, 999)
  ctx.fill()
  ctx.strokeStyle = style.border
  ctx.lineWidth = 1
  roundRectPath(ctx, x + BADGE_INSET + 0.5, y + BADGE_INSET + 0.5, bw - 1, bh - 1, 999)
  ctx.stroke()
  ctx.fillStyle = style.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + BADGE_INSET + 8, y + BADGE_INSET + bh / 2)
}

function drawFavoriteBadgePill(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellW: number,
  level: number
) {
  const bh = 22
  const label = String(level)
  ctx.font = '700 10px system-ui, "Microsoft YaHei", sans-serif'
  const numW = ctx.measureText(label).width
  ctx.font = '600 10px system-ui, sans-serif'
  const starW = ctx.measureText('★').width
  const bw = numW + starW + 14
  const bx = cellX + cellW - bw - BADGE_INSET
  const by = cellY + BADGE_INSET

  ctx.fillStyle = 'rgba(245, 158, 11, 0.14)'
  roundRectPath(ctx, bx, by, bw, bh, 999)
  ctx.fill()
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)'
  ctx.lineWidth = 1
  roundRectPath(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 999)
  ctx.stroke()

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#b45309'
  ctx.font = '700 10px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText(label, bx + 7, by + bh / 2)
  ctx.fillStyle = '#d97706'
  ctx.font = '600 10px system-ui, sans-serif'
  ctx.fillText('★', bx + 7 + numW + 2, by + bh / 2)
}

function drawCellBadges(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  item: WardrobeClothes,
  prefs: ShareLayoutPrefs
) {
  const status = item.wardrobe_status?.trim()
  if (prefs.showStatus && status) {
    drawStatusBadgePill(ctx, x, y, status, cellW - BADGE_INSET * 2 - 4)
  }
  const fav = getFavoriteLevel(item)
  if (prefs.showFavorite && fav > 0) {
    drawFavoriteBadgePill(ctx, x, y, cellW, fav)
  }
}

function measureCellMeta(
  ctx: CanvasRenderingContext2D,
  item: WardrobeClothes,
  info: Wardrobe,
  cellW: number,
  prefs: ShareLayoutPrefs
): CellMetaMeasure {
  const textW = Math.max(0, cellW - META_H_PAD * 2)
  ctx.font = '500 13px system-ui, "Microsoft YaHei", sans-serif'

  let noteLines: string[] = []
  const note = item.clothes_note?.trim()
  if (prefs.showNote && note) {
    noteLines = wrapLines(ctx, note, textW).slice(0, 2)
  }

  const showPrice = prefs.showPrice && hasClothesPrice(item)

  let metaH = 0
  if (noteLines.length || showPrice) {
    if (noteLines.length) {
      metaH = NOTE_TOP + noteLines.length * LINE_H
      if (showPrice) metaH += NOTE_PRICE_GAP + LINE_H
    } else {
      metaH = META_TOP + LINE_H
    }
  }

  return { noteLines, showPrice, metaH }
}

function computeRowBlockHeights(
  ctx: CanvasRenderingContext2D,
  items: WardrobeClothes[],
  cols: number,
  imgH: number,
  cellW: number,
  info: Wardrobe,
  prefs: ShareLayoutPrefs
): number[] {
  const rowCount = Math.ceil(items.length / cols) || 1
  const blocks: number[] = []
  for (let r = 0; r < rowCount; r++) {
    let maxMeta = 0
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx >= items.length) break
      maxMeta = Math.max(maxMeta, measureCellMeta(ctx, items[idx], info, cellW, prefs).metaH)
    }
    blocks.push(imgH + maxMeta + ROW_GAP)
  }
  return blocks
}

function drawCellMeta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  imgH: number,
  cellW: number,
  item: WardrobeClothes,
  info: Wardrobe,
  prefs: ShareLayoutPrefs,
  theme: ShareCanvasTheme
) {
  const meta = measureCellMeta(ctx, item, info, cellW, prefs)
  const textX = x + cellW / 2
  let ty = y + imgH + (meta.noteLines.length ? NOTE_TOP : META_TOP)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  if (meta.noteLines.length) {
    ctx.fillStyle = theme.text
    ctx.font = '500 13px system-ui, "Microsoft YaHei", sans-serif'
    for (const nl of meta.noteLines) {
      ctx.fillText(truncate(nl, 40), textX, ty)
      ty += LINE_H
    }
  }

  if (meta.showPrice) {
    if (meta.noteLines.length) ty += NOTE_PRICE_GAP
    ctx.font = '500 13px system-ui, "Microsoft YaHei", sans-serif'
    ctx.fillStyle = theme.primary
    ctx.fillText(`￥ ${formatClothesPrice(info, item.price)}`, textX, ty)
  }

  ctx.textAlign = 'left'
}

function headerTextX(showCover: boolean): number {
  return showCover ? PAD + COVER_HEADER + COVER_HEAD_GAP : PAD
}

function headerTextMaxW(showCover: boolean): number {
  return CW - headerTextX(showCover) - PAD - HEADER_BRAND_RESERVE
}

/** 仅在头部右上角绘制 Lo研社 标识 */
function drawHeaderBrandMark(ctx: CanvasRenderingContext2D, top: number, theme: ShareCanvasTheme) {
  const rx = CW - PAD
  const ty = top + 6
  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = theme.footer
  ctx.font = 'bold 16px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.fillText('Lo研社', rx, ty)
  ctx.font = '600 11px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillText('Lolita图书馆', rx, ty + 20)
  ctx.restore()
}

/**
 * 绘制或度量头部：左侧封面 + 右侧文案；度量时不绘制封面图。
 * @returns 头部底部 y（含分隔线以下留白）
 */
function layoutWardrobeHeader(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  coverImg: HTMLImageElement | null,
  mode: 'draw' | 'measure',
  showCover: boolean,
  theme: ShareCanvasTheme
): number {
  const textX = headerTextX(showCover)
  const maxTextW = headerTextMaxW(showCover)
  const top = startY + 20
  let y = top

  if (mode === 'draw') {
    if (showCover && coverImg) {
      drawImageCover(ctx, coverImg, PAD, top, COVER_HEADER, COVER_HEADER, COVER_RADIUS, theme)
    }
    drawHeaderBrandMark(ctx, top, theme)
  }

  ctx.fillStyle = theme.title
  ctx.font = 'bold 22px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  const titleLines = wrapLines(ctx, info.wardrobe_name || '衣柜', maxTextW)
  for (const line of titleLines.slice(0, 3)) {
    if (mode === 'draw') ctx.fillText(line, textX, y)
    y += 30
  }
  if (titleLines.length > 3) {
    if (mode === 'draw') ctx.fillText('…', textX, y)
    y += 30
  }
  y += 4
  ctx.font = '14px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = theme.text
  if (info.wardrobe_desc?.trim()) {
    const dl = wrapLines(ctx, info.wardrobe_desc.trim(), maxTextW)
    for (const line of dl.slice(0, 4)) {
      if (mode === 'draw') ctx.fillText(line, textX, y)
      y += 22
    }
    if (dl.length > 4) {
      if (mode === 'draw') ctx.fillText('…', textX, y)
      y += 22
    }
  }
  y += 2
  if (mode === 'draw') ctx.fillText(`衣柜收纳: ${info.total_count ?? 0} 条`, textX, y)
  y += 24
  const priceShown = info.show_price !== 1 ? '***' : String(info.total_price ?? 0)
  if (mode === 'draw') ctx.fillText(`衣柜总价: ￥${priceShown}`, textX, y)
  y += 24
  if (mode === 'draw') ctx.fillText(`穿着次数: ${info.total_times ?? 0}`, textX, y)
  y += 24
  if (mode === 'draw')
    ctx.fillText(`共有 ${info.total_community ?? 0} 条与小裙子间美好的回忆 (*^▽^*)`, textX, y)
  y += 28

  if (showCover) {
    y = Math.max(y, top + COVER_HEADER + 8)
  }

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(CW - PAD, y)
  if (mode === 'draw') ctx.stroke()
  y += 24
  return y
}

function measureHeaderEndY(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  showCover: boolean,
  theme: ShareCanvasTheme
): number {
  return layoutWardrobeHeader(ctx, info, startY, null, 'measure', showCover, theme)
}

function gridCellWidth(cols: number, gap: number): number {
  const availW = CW - PAD * 2
  return (availW - gap * (cols - 1)) / cols
}

function maxMetaHeightEstimate(): number {
  return NOTE_TOP + LINE_H * 2 + NOTE_PRICE_GAP + LINE_H
}

function pickColsForHeight(
  itemCount: number,
  headH: number,
  gap: number,
  imgHForCols: (cols: number) => number
): number {
  let cols = 3
  while (cols <= 6) {
    const imgH = imgHForCols(cols)
    const rowBlock = imgH + maxMetaHeightEstimate() + ROW_GAP
    const rows = Math.ceil(itemCount / cols) || 1
    const needH = headH + rows * rowBlock + PAD + 56
    if (needH <= MAX_CANVAS_H || cols >= 6) return cols
    cols += 1
  }
  return 6
}

function sumRowBlocks(blocks: number[]): number {
  return blocks.reduce((a, b) => a + b, 0)
}

async function drawLongCanvas(
  info: Wardrobe,
  items: WardrobeClothes[]
): Promise<{ canvas: HTMLCanvasElement; drawnCount: number; sourceCount: number }> {
  const theme = buildShareTheme(info)
  const prefs = readShareLayoutPrefs()
  progressLabel.value = '加载封面…'
  const coverUrl = resolveImgUrl(info.wardrobe_cover)
  const bgUrl = resolveImgUrl(info.background)
  const [coverImg, bgImg] = await Promise.all([
    coverUrl ? loadImageCors(coverUrl) : Promise.resolve(null),
    bgUrl ? loadImageCors(bgUrl) : Promise.resolve(null),
  ])
  const showCover = Boolean(coverImg)

  const measureCv = document.createElement('canvas')
  measureCv.width = CW
  measureCv.height = 1200
  const mctx = measureCv.getContext('2d')
  if (!mctx) throw new Error('canvas')
  const headH = measureHeaderEndY(mctx, info, PAD, showCover, theme)

  const colGap = 10
  const cols = pickColsForHeight(items.length, headH, colGap, (c) => gridCellWidth(c, colGap))
  const cellW = gridCellWidth(cols, colGap)
  const imgH = cellW

  let drawItems = items
  let rowBlocks = computeRowBlockHeights(mctx, drawItems, cols, imgH, cellW, info, prefs)
  let gridH = sumRowBlocks(rowBlocks)

  while (headH + gridH + PAD + 56 > MAX_CANVAS_H && drawItems.length > cols) {
    const maxRows = Math.max(1, Math.floor((MAX_CANVAS_H - headH - PAD - 56) / (imgH + maxMetaHeightEstimate() + ROW_GAP)))
    const maxItems = maxRows * cols
    if (drawItems.length <= maxItems) break
    drawItems = drawItems.slice(0, maxItems)
    rowBlocks = computeRowBlockHeights(mctx, drawItems, cols, imgH, cellW, info, prefs)
    gridH = sumRowBlocks(rowBlocks)
  }

  if (drawItems.length < items.length) {
    console.warn(
      `[wardrobe-long-share] 画布高度上限，仅绘制前 ${drawItems.length}/${items.length} 件，可缩小筛选范围后重试`
    )
  }

  const H = Math.min(MAX_CANVAS_H, headH + gridH + PAD + 56)

  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')

  drawPageBackground(ctx, CW, H, theme, bgImg)

  progressLabel.value = '加载服饰图片…'

  const gridTop = layoutWardrobeHeader(ctx, info, PAD, coverImg, 'draw', showCover, theme)

  const urls = [...new Set(drawItems.map((it) => resolveImgUrl(it.clothes_img)).filter(Boolean))]
  const imgCache = new Map<string, HTMLImageElement | null>()
  const chunk = 20
  for (let i = 0; i < urls.length; i += chunk) {
    const part = urls.slice(i, i + chunk)
    await Promise.all(
      part.map(async (u) => {
        if (imgCache.has(u)) return
        imgCache.set(u, await loadImageCors(u))
      })
    )
  }

  let gridY = gridTop
  const rowCount = rowBlocks.length
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx >= drawItems.length) break
      const el = drawItems[idx]
      const x = PAD + c * (cellW + colGap)
      const y = gridY
      const u = resolveImgUrl(el.clothes_img)
      const im = u ? imgCache.get(u) ?? null : null

      if (im) {
        drawImageCover(ctx, im, x, y, cellW, imgH, PHOTO_RADIUS, theme)
      } else {
        drawNeuPhotoFrame(ctx, x, y, cellW, imgH, PHOTO_RADIUS, theme)
        ctx.fillStyle = theme.textMuted
        ctx.font = '13px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('无图', x + cellW / 2, y + imgH / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      drawCellBadges(ctx, x, y, cellW, el, prefs)
      drawCellMeta(ctx, x, y, imgH, cellW, el, info, prefs, theme)
    }
    gridY += rowBlocks[r] ?? imgH + ROW_GAP
  }

  ctx.fillStyle = theme.footer
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 我的衣柜', CW / 2, H - 20)

  return { canvas, drawnCount: drawItems.length, sourceCount: items.length }
}

async function generateAndUpload() {
  if (!import.meta.client || generating.value || !canGenerate.value) return
  errorMsg.value = ''
  serverRelativeUrl.value = ''
  showSharePreviewModal.value = false

  generating.value = true
  progressLabel.value = '拉取服饰列表…'
  try {
    const items = await fetchAllClothesForShare()
    if (!items.length) {
      errorMsg.value = '当前筛选下没有可生成的服饰'
      return
    }
    progressLabel.value = `绘制中（${items.length} 件）…`
    const { canvas, drawnCount, sourceCount } = await drawLongCanvas(props.info, items)
    if (drawnCount < sourceCount) {
      toast.add({
        title: `长图仅包含前 ${drawnCount} 件（共 ${sourceCount} 件），超出部分未绘制`,
        color: 'amber',
        icon: 'i-heroicons-information-circle',
      })
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    )
    if (!blob) {
      errorMsg.value = '生成图片失败（可能被跨域图片污染画布，请稍后重试）'
      return
    }
    progressLabel.value = '上传中…'
    const file = new File([blob], `wardrobe-long-${Date.now()}.jpg`, { type: 'image/jpeg' })
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
</script>

<style scoped>
.wardrobe-long-share {
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
  --neu-raised: #ebe3e8;
  background-color: #ebe3e8;
  box-shadow:
    10px 10px 26px rgba(150, 110, 130, 0.24),
    -8px -8px 22px rgba(255, 252, 254, 0.94),
    inset 1px 1px 0 rgba(255, 255, 255, 0.55);
}

.dark .share-preview-modal {
  --neu-raised: #241d26;
  background-color: #241d26;
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

.share-preview-app-hint {
  background: rgba(214, 170, 190, 0.35);
  border: 1px solid rgba(180, 120, 145, 0.35);
}

.dark .share-preview-app-hint {
  background: rgba(80, 45, 60, 0.45);
  border-color: rgba(200, 140, 165, 0.25);
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

/*
 * Android / iOS WebView：祖先上的 user-select:none（如 select-none）会继承到 img，
 * 导致长按不出现「保存图片」。预览区单独放开选择与系统长按菜单。
 */
.share-preview-modal__img {
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}
</style>
