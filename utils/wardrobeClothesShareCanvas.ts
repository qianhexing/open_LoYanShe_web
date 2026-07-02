import type { Wardrobe, WardrobeClothes } from '@/types/api'
import { getClothesList, type ClothesParams } from '@/api/wardrobe'
import { BASE_IMG } from '@/utils/ipConfig'
import { getClothesFavoriteLevel } from '@/utils/clothesFavoriteLevel'

/** 设计稿宽度 750，输出 4K（3840px） */
export const WARDROBE_SHARE_DESIGN_WIDTH = 750
export const WARDROBE_SHARE_4K_WIDTH = 3840
export const WARDROBE_SHARE_SCALE = WARDROBE_SHARE_4K_WIDTH / WARDROBE_SHARE_DESIGN_WIDTH

export function spx(n: number): number {
  return Math.round(n * WARDROBE_SHARE_SCALE)
}

const SHARE_FONT_FAMILY = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
const SHARE_FONT_FAMILY_SANS = 'system-ui, "Microsoft YaHei", sans-serif'

export function shareFont(size: number, weight: string | number = '400'): string {
  return `${weight} ${spx(size)}px ${SHARE_FONT_FAMILY}`
}

export function shareFontSans(size: number, weight: string | number = '400'): string {
  return `${weight} ${spx(size)}px ${SHARE_FONT_FAMILY_SANS}`
}

/** 画布底部留白（设计稿 56px） */
export const SHARE_FOOTER_PAD = spx(56)

export const WARDROBE_SHARE_CANVAS = {
  CW: WARDROBE_SHARE_4K_WIDTH,
  PAD: spx(28),
  HEADER_BRAND_RESERVE: spx(120),
  COVER_HEADER: spx(200),
  COVER_HEAD_GAP: spx(16),
  /** 浏览器单维高度上限内尽量保留长图空间 */
  MAX_CANVAS_H: Math.min(spx(16000), 16384),
  PHOTO_RADIUS: spx(12),
  COVER_RADIUS: spx(14),
  META_H_PAD: spx(12),
  META_TOP: spx(14),
  NOTE_TOP: spx(22),
  LINE_H: spx(20),
  NOTE_PRICE_GAP: spx(8),
  ROW_GAP: spx(12),
  BADGE_INSET: spx(6),
  COL_GAP: spx(10),
  SECTION_HEADER_H: spx(44),
  SECTION_GAP: spx(16),
} as const

const {
  CW,
  PAD,
  HEADER_BRAND_RESERVE,
  COVER_HEADER,
  COVER_HEAD_GAP,
  MAX_CANVAS_H,
  PHOTO_RADIUS,
  COVER_RADIUS,
  META_H_PAD,
  META_TOP,
  NOTE_TOP,
  LINE_H,
  NOTE_PRICE_GAP,
  ROW_GAP,
  BADGE_INSET,
} = WARDROBE_SHARE_CANVAS

const SHOW_CLOTHES_NOTE_KEY = 'wardrobe-detail-show-clothes-note'
const SHOW_CLOTHES_PRICE_KEY = 'wardrobe-detail-show-clothes-price'
const SHOW_CLOTHES_STATUS_KEY = 'wardrobe-detail-show-clothes-status'
const SHOW_CLOTHES_FAVORITE_KEY = 'wardrobe-detail-show-clothes-favorite'

export interface ShareLayoutPrefs {
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

export interface ShareCanvasTheme {
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

export interface WardrobeShareFetchParams {
  wardrobeId: number
  filterList: { tags: string[]; wardrobe_status: string[]; clothes_note: string; size: string[] }
  password: string
  timelineMode: boolean
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

export function buildShareTheme(info: Wardrobe): ShareCanvasTheme {
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

export function readShareLayoutPrefs(): ShareLayoutPrefs {
  return {
    showNote: readBoolPref(SHOW_CLOTHES_NOTE_KEY),
    showPrice: readBoolPref(SHOW_CLOTHES_PRICE_KEY),
    showStatus: readBoolPref(SHOW_CLOTHES_STATUS_KEY),
    showFavorite: readBoolPref(SHOW_CLOTHES_FAVORITE_KEY),
  }
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

export function resolveImgUrl(path: string | null | undefined): string {
  if (!path?.trim()) return ''
  const p = path.trim()
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

export function loadImageCors(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

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

export async function fetchAllClothesForShare(params: WardrobeShareFetchParams): Promise<WardrobeClothes[]> {
  const batch = 400
  const all: WardrobeClothes[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY
  while (all.length < totalCount) {
    const req: ClothesParams = {
      page,
      pageSize: batch,
      wardrobe_id: params.wardrobeId,
      filter_list: params.filterList,
    }
    if (params.timelineMode) {
      req.sort_list = 'add_time_asc'
    }
    if (params.password) {
      req.password = params.password
    }
    const res = await getClothesList(req)
    const rows = res.rows ?? []
    totalCount = typeof res.count === 'number' ? res.count : all.length + rows.length
    all.push(...rows)
    if (rows.length < batch || all.length >= totalCount) break
    page += 1
    if (page > 200) break
  }
  if (params.timelineMode) {
    return sortListByAddTimeAsc(all)
  }
  return all
}

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

export function drawPageBackground(
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

export function drawNeuPhotoFrame(
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
  ctx.shadowBlur = spx(10)
  ctx.shadowOffsetX = spx(3)
  ctx.shadowOffsetY = spx(4)
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
  ctx.lineWidth = spx(1)
  ctx.save()
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()
  ctx.restore()
}

export function drawImageCover(
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
  const inset = spx(1)
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
  maxW: number,
  compact = false
) {
  const style = getStatusBadgeStyle(text)
  const inset = compact ? spx(3) : BADGE_INSET
  const bh = compact ? spx(14) : spx(22)
  const padX = compact ? spx(5) : spx(8)
  ctx.font = compact ? shareFontSans(8, 600) : shareFontSans(11, 600)
  const tw = ctx.measureText(text).width
  const bw = Math.min(maxW, tw + padX * 2)
  ctx.fillStyle = style.bg
  roundRectPath(ctx, x + inset, y + inset, bw, bh, 999)
  ctx.fill()
  ctx.strokeStyle = style.border
  ctx.lineWidth = spx(1)
  roundRectPath(ctx, x + inset + 0.5, y + inset + 0.5, bw - 1, bh - 1, 999)
  ctx.stroke()
  ctx.fillStyle = style.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + inset + padX, y + inset + bh / 2)
}

function drawFavoriteBadgePill(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellW: number,
  level: number
) {
  const bh = spx(22)
  const label = String(level)
  ctx.font = shareFontSans(10, 700)
  const numW = ctx.measureText(label).width
  ctx.font = `${spx(10)}px system-ui, sans-serif`
  const starW = ctx.measureText('★').width
  const bw = numW + starW + spx(14)
  const bx = cellX + cellW - bw - BADGE_INSET
  const by = cellY + BADGE_INSET

  ctx.fillStyle = 'rgba(245, 158, 11, 0.14)'
  roundRectPath(ctx, bx, by, bw, bh, 999)
  ctx.fill()
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)'
  ctx.lineWidth = spx(1)
  roundRectPath(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 999)
  ctx.stroke()

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#b45309'
  ctx.font = shareFontSans(10, 700)
  ctx.fillText(label, bx + spx(7), by + bh / 2)
  ctx.fillStyle = '#d97706'
  ctx.font = `${spx(10)}px system-ui, sans-serif`
  ctx.fillText('★', bx + spx(7) + numW + spx(2), by + bh / 2)
}

export interface ShareBadgeOptions {
  compact?: boolean
}

export function drawCellBadges(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellW: number,
  item: WardrobeClothes,
  prefs: ShareLayoutPrefs,
  options?: ShareBadgeOptions
) {
  const compact = options?.compact === true
  const status = item.wardrobe_status?.trim()
  if (prefs.showStatus && status) {
    const inset = compact ? spx(3) : BADGE_INSET
    drawStatusBadgePill(ctx, x, y, status, cellW - inset * 2 - spx(2), compact)
  }
  const fav = getClothesFavoriteLevel(item)
  if (prefs.showFavorite && fav > 0) {
    drawFavoriteBadgePill(ctx, x, y, cellW, fav)
  }
}

export function measureCellMeta(
  ctx: CanvasRenderingContext2D,
  item: WardrobeClothes,
  info: Wardrobe,
  cellW: number,
  prefs: ShareLayoutPrefs
): CellMetaMeasure {
  const textW = Math.max(0, cellW - META_H_PAD * 2)
  ctx.font = shareFontSans(13, 500)

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

export function computeRowBlockHeights(
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

export function drawCellMeta(
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
    ctx.font = shareFontSans(13, 500)
    for (const nl of meta.noteLines) {
      ctx.fillText(truncate(nl, 40), textX, ty)
      ty += LINE_H
    }
  }

  if (meta.showPrice) {
    if (meta.noteLines.length) ty += NOTE_PRICE_GAP
    ctx.font = shareFontSans(13, 500)
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

function drawHeaderBrandMark(ctx: CanvasRenderingContext2D, top: number, theme: ShareCanvasTheme) {
  const rx = CW - PAD
  const ty = top + spx(6)
  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = theme.footer
  ctx.font = shareFont(16, 'bold')
  ctx.fillText('Lo研社', rx, ty)
  ctx.font = shareFontSans(11, 600)
  ctx.fillText('Lolita图书馆', rx, ty + spx(20))
  ctx.restore()
}

export function layoutWardrobeHeader(
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
  const top = startY + spx(20)
  let y = top

  if (mode === 'draw') {
    if (showCover && coverImg) {
      drawImageCover(ctx, coverImg, PAD, top, COVER_HEADER, COVER_HEADER, COVER_RADIUS, theme)
    }
    drawHeaderBrandMark(ctx, top, theme)
  }

  ctx.fillStyle = theme.title
  ctx.font = shareFont(22, 'bold')
  ctx.textAlign = 'left'
  const titleLines = wrapLines(ctx, info.wardrobe_name || '衣柜', maxTextW)
  for (const line of titleLines.slice(0, 3)) {
    if (mode === 'draw') ctx.fillText(line, textX, y)
    y += spx(30)
  }
  if (titleLines.length > 3) {
    if (mode === 'draw') ctx.fillText('…', textX, y)
    y += spx(30)
  }
  y += spx(4)
  ctx.font = shareFontSans(14)
  ctx.fillStyle = theme.text
  if (info.wardrobe_desc?.trim()) {
    const dl = wrapLines(ctx, info.wardrobe_desc.trim(), maxTextW)
    for (const line of dl.slice(0, 4)) {
      if (mode === 'draw') ctx.fillText(line, textX, y)
      y += spx(22)
    }
    if (dl.length > 4) {
      if (mode === 'draw') ctx.fillText('…', textX, y)
      y += spx(22)
    }
  }
  y += spx(2)
  if (mode === 'draw') ctx.fillText(`衣柜收纳: ${info.total_count ?? 0} 条`, textX, y)
  y += spx(24)
  const priceShown = info.show_price !== 1 ? '***' : String(info.total_price ?? 0)
  if (mode === 'draw') ctx.fillText(`衣柜总价: ￥${priceShown}`, textX, y)
  y += spx(24)
  if (mode === 'draw') ctx.fillText(`穿着次数: ${info.total_times ?? 0}`, textX, y)
  y += spx(24)
  if (mode === 'draw')
    ctx.fillText(`共有 ${info.total_community ?? 0} 条与小裙子间美好的回忆 (*^▽^*)`, textX, y)
  y += spx(28)

  if (showCover) {
    y = Math.max(y, top + COVER_HEADER + spx(8))
  }

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(CW - PAD, y)
  if (mode === 'draw') ctx.stroke()
  y += spx(24)
  return y
}

export function measureHeaderEndY(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  showCover: boolean,
  theme: ShareCanvasTheme
): number {
  return layoutWardrobeHeader(ctx, info, startY, null, 'measure', showCover, theme)
}

export const WARDROBE_SHARE_DEFAULT_AVATAR = 'static/plan_cover/default.jpg'

const COMPACT_AVATAR_R = spx(18)
const COMPACT_USER_ROW_GAP = spx(10)

export function drawShareAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number,
  theme: ShareCanvasTheme
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = theme.photoBg
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.restore()
  ctx.strokeStyle = theme.photoBorder
  ctx.lineWidth = spx(2)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

/** 评级分享图等场景：衣柜名在上，用户头像 + 用户名在下 */
export function layoutWardrobeCompactHeader(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  avatarImg: HTMLImageElement | null,
  userName: string,
  mode: 'draw' | 'measure',
  theme: ShareCanvasTheme
): number {
  const top = startY + spx(16)
  const maxTitleW = CW - PAD * 2
  const wardrobeName = info.wardrobe_name?.trim() || '衣柜'
  const displayName = userName.trim() || '用户'

  ctx.font = shareFont(20, 'bold')
  const titleLines = wrapLines(ctx, wardrobeName, maxTitleW).slice(0, 2)
  const titleLineH = spx(26)
  const titleH = titleLines.length * titleLineH

  const userRowTop = top + titleH + COMPACT_USER_ROW_GAP
  const userRowH = COMPACT_AVATAR_R * 2
  const blockH = titleH + COMPACT_USER_ROW_GAP + userRowH

  if (mode === 'draw') {
    ctx.fillStyle = theme.title
    ctx.font = shareFont(20, 'bold')
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    let ty = top + spx(18)
    for (const line of titleLines) {
      ctx.fillText(truncate(line, 40), PAD, ty)
      ty += titleLineH
    }

    const avatarCy = userRowTop + COMPACT_AVATAR_R
    drawShareAvatar(ctx, avatarImg, PAD + COMPACT_AVATAR_R, avatarCy, COMPACT_AVATAR_R, theme)

    ctx.font = shareFontSans(14)
    ctx.fillStyle = theme.textMuted
    ctx.textBaseline = 'middle'
    ctx.fillText(
      truncate(displayName, 42),
      PAD + COMPACT_AVATAR_R * 2 + spx(10),
      avatarCy
    )
  }

  let y = top + blockH + spx(20)
  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(CW - PAD, y)
  if (mode === 'draw') ctx.stroke()
  y += spx(20)
  return y
}

export function measureWardrobeCompactHeaderEndY(
  ctx: CanvasRenderingContext2D,
  info: Wardrobe,
  startY: number,
  userName: string,
  theme: ShareCanvasTheme
): number {
  return layoutWardrobeCompactHeader(ctx, info, startY, null, userName, 'measure', theme)
}

export function gridCellWidth(cols: number, gap: number): number {
  const availW = CW - PAD * 2
  return (availW - gap * (cols - 1)) / cols
}

function maxMetaHeightEstimate(): number {
  return NOTE_TOP + LINE_H * 2 + NOTE_PRICE_GAP + LINE_H
}

export function pickColsForHeight(
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
    const needH = headH + rows * rowBlock + PAD + SHARE_FOOTER_PAD
    if (needH <= MAX_CANVAS_H || cols >= 6) return cols
    cols += 1
  }
  return 6
}

export function sumRowBlocks(blocks: number[]): number {
  return blocks.reduce((a, b) => a + b, 0)
}

export { CW, PAD, MAX_CANVAS_H, PHOTO_RADIUS, ROW_GAP }
