import type { QrCode, Wardrobe, WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { loadImageCors } from '@/utils/libraryShareCanvas'
import {
  hasCommunityCustomStyle,
  parseEntityCustomStyle,
} from '@/utils/communityCustomStyle'
import dayjs from 'dayjs'

export interface WardrobeQrcodeSharePayload {
  wardrobeName: string
  wardrobeDesc?: string
  wardrobeCover?: string | null
  totalCount?: number
  totalTimes?: number
  totalPrice?: number | string
  showPrice?: number
  userName: string
  userFace?: string | null
  qrCodeUrl: string
  expiresLabel: string
  clothesImages: string[]
  theme: WardrobeQrcodeShareTheme
}

/** 与衣柜长图分享 buildShareTheme 对齐 */
export interface WardrobeQrcodeShareTheme {
  bg: string
  bgMuted: string
  bgOverlay: string | null
  text: string
  textMuted: string
  title: string
  primary: string
  card: string
  cardSolid: string
  border: string
  photoBorder: string
  footer: string
  photoBg: string
  /** QhxTag 胶囊：白底 + 主题色描边/字色 */
  pillFill: string
  pillStroke: string
  pillText: string
  ribbonText: string
  hasCustomTheme: boolean
}

export interface WardrobeQrcodeShareImageBundle {
  bgCover: HTMLImageElement | null
  avatar: HTMLImageElement | null
  qr: HTMLImageElement | null
  clothes: (HTMLImageElement | null)[]
}

/** 固定 3:4 竖版海报 */
export const WARDROBE_QRCODE_SHARE_WIDTH = 750
export const WARDROBE_QRCODE_SHARE_HEIGHT = Math.round((WARDROBE_QRCODE_SHARE_WIDTH * 4) / 3)

const P = 36
const CONTENT_W = WARDROBE_QRCODE_SHARE_WIDTH - P * 2
const DEFAULT_AVATAR = 'static/plan_cover/default.jpg'
const DEFAULT_PRIMARY = '#ec4899'
const DEFAULT_TEXT = '#4b5563'
const BOOK_PAGE_BG = '#fefcf9'
const BOOK_PAGE_MUTED = '#faf6f2'

const FONT = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
const SERIF = 'ui-serif, Georgia, "Songti SC", "STSong", serif'

const GAP = 10
const QR_PAD = 14
const QR_SIZE = 128

function getCssVar(name: string, fallback: string): string {
  if (!import.meta.client || typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function colorToRgba(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length >= 7) return hexToRgba(color, alpha)
  return color
}

function resolveImgUrl(path: string | null | undefined, resize = 600): string {
  if (!path) return ''
  const p = path.startsWith('http') ? path : `${BASE_IMG}${path.replace(/^\//, '')}`
  if (p.includes('x-oss-process')) return p
  return `${p}?x-oss-process=image/quality,q_85/resize,w_${resize}`
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = text.trim().split('')
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const next = line + ch
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length >= maxLines) break
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines) {
    const last = lines[lines.length - 1] ?? ''
    if (ctx.measureText(last).width > maxWidth) {
      lines[lines.length - 1] = truncate(last, Math.max(4, last.length - 2))
    }
  }
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawImageCoverFull(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height
  const cr = w / h
  let sw = img.width
  let sh = img.height
  let sx = 0
  let sy = 0
  if (ir > cr) {
    sw = img.height * cr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / cr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** 与 WardrobeClothesLongShare.buildShareTheme 一致 */
export function buildWardrobeQrcodeShareTheme(wardrobe: Wardrobe | null | undefined): WardrobeQrcodeShareTheme {
  const parsed = parseEntityCustomStyle(wardrobe ?? undefined)
  const hasCustomTheme = hasCommunityCustomStyle(parsed)

  const fontColor = parsed.fontColor || getCssVar('--text-color', DEFAULT_TEXT)
  const primary = parsed.btnColor || getCssVar('--primary-color', DEFAULT_PRIMARY)
  const fontHex = fontColor.startsWith('#') ? fontColor : DEFAULT_TEXT
  const primaryHex = primary.startsWith('#') ? primary : DEFAULT_PRIMARY

  let bg = hasCustomTheme && parsed.backColor
    ? hexToRgba(parsed.backColor, parsed.back_opacity ?? 1)
    : BOOK_PAGE_BG
  let bgOverlay: string | null = null

  if (parsed.backColor) {
    const rgba = hexToRgba(parsed.backColor, parsed.back_opacity ?? 1)
    if (wardrobe?.wardrobe_cover || wardrobe?.background || parsed.background) {
      bgOverlay = rgba
    } else {
      bg = rgba
    }
  }

  const cardSolid = hasCustomTheme ? 'rgba(254, 252, 249, 0.96)' : BOOK_PAGE_BG
  const ribbonText = parsed.btnFontColor || '#ffffff'

  return {
    bg,
    bgMuted: hasCustomTheme ? colorToRgba(fontHex, 0.06) : BOOK_PAGE_MUTED,
    bgOverlay,
    text: fontColor,
    textMuted: hexToRgba(fontHex, 0.72),
    title: fontColor,
    primary,
    card: 'rgba(254, 252, 249, 0.94)',
    cardSolid,
    border: hexToRgba(primaryHex, 0.22),
    photoBorder: 'rgba(209, 213, 219, 0.95)',
    footer: hexToRgba(fontHex, 0.55),
    photoBg: '#f9fafb',
    pillFill: parsed.btnFontColor ? cardSolid : '#ffffff',
    pillStroke: primaryHex,
    pillText: primaryHex,
    ribbonText,
    hasCustomTheme,
  }
}

function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bgCover: HTMLImageElement | null,
  theme: WardrobeQrcodeShareTheme,
) {
  if (bgCover) {
    drawImageCoverFull(ctx, bgCover, 0, 0, w, h)
    if (theme.bgOverlay) {
      ctx.fillStyle = theme.bgOverlay
      ctx.fillRect(0, 0, w, h)
    } else {
      ctx.fillStyle = 'rgba(40, 24, 32, 0.48)'
      ctx.fillRect(0, 0, w, h)
    }
  } else {
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = hexToRgba(theme.primary.startsWith('#') ? theme.primary : DEFAULT_PRIMARY, 0.12)
    ctx.lineWidth = 2
    roundRect(ctx, 20, 20, w - 40, h - 40, 20)
    ctx.stroke()
  }
}

function getStatPills(payload: WardrobeQrcodeSharePayload): string[] {
  const pills: string[] = []
  if (payload.totalCount != null) pills.push(`收纳 ${payload.totalCount} 件`)
  if (payload.totalTimes != null) pills.push(`穿着 ${payload.totalTimes} 次`)
  if (payload.showPrice === 1 && payload.totalPrice != null) {
    pills.push(`总价 ¥${payload.totalPrice}`)
  }
  return pills
}

function layoutPillRows(
  ctx: CanvasRenderingContext2D,
  pills: string[],
  maxWidth: number,
): { label: string; width: number }[][] {
  if (!pills.length) return []
  ctx.font = `11px ${FONT}`
  const rows: { label: string; width: number }[][] = []
  let currentRow: { label: string; width: number }[] = []
  let rowWidth = 0

  for (const label of pills) {
    const width = ctx.measureText(label).width + 22
    const gap = rowWidth > 0 ? 6 : 0
    if (rowWidth + gap + width > maxWidth && rowWidth > 0) {
      rows.push(currentRow)
      currentRow = []
      rowWidth = 0
    }
    if (rowWidth > 0) rowWidth += 6
    currentRow.push({ label, width })
    rowWidth += width
  }
  if (currentRow.length) rows.push(currentRow)
  return rows
}

function countPillRows(ctx: CanvasRenderingContext2D, pills: string[], innerW: number): number {
  return layoutPillRows(ctx, pills, innerW).length
}

interface LayoutMetrics {
  ribbonH: number
  avatarBlockH: number
  userBlockH: number
  clothesH: number
  wardrobeInfoH: number
  qrCardH: number
  brandH: number
  totalH: number
  clothesCount: number
}

function measureLayout(
  ctx: CanvasRenderingContext2D,
  payload: WardrobeQrcodeSharePayload,
  bundle: WardrobeQrcodeShareImageBundle,
): LayoutMetrics {
  const innerW = CONTENT_W
  const clothesCount = bundle.clothes.filter(Boolean).length

  const ribbonH = 38
  const avatarBlockH = 28 * 2 + GAP
  const userBlockH = 22 + GAP + 18

  let clothesH = 0
  if (clothesCount > 0) {
    const gap = 8
    const cellW = (CONTENT_W - gap * (clothesCount - 1)) / clothesCount
    clothesH = Math.round(cellW * 1.08) + GAP
  }

  let wardrobeInfoH = 0
  ctx.font = `bold 22px ${SERIF}`
  wardrobeInfoH += wrapLines(ctx, payload.wardrobeName, innerW, 2).length * 28
  if (payload.wardrobeDesc) {
    wardrobeInfoH += 4
    ctx.font = `12px ${FONT}`
    wardrobeInfoH += wrapLines(ctx, payload.wardrobeDesc, innerW, 2).length * 18
  }
  const pillRows = countPillRows(ctx, getStatPills(payload), innerW)
  if (pillRows) wardrobeInfoH += 4 + pillRows * 30

  const qrTextBlockH = 10 + 14 + 4 + 12 + QR_PAD
  const qrCardH = QR_PAD + QR_SIZE + qrTextBlockH

  const brandH = 16 + GAP
  const sectionCount = 5 + (clothesCount > 0 ? 1 : 0)
  const gaps = GAP * sectionCount
  const totalH = ribbonH + avatarBlockH + userBlockH + clothesH + wardrobeInfoH + qrCardH + brandH + gaps

  return {
    ribbonH,
    avatarBlockH,
    userBlockH,
    clothesH,
    wardrobeInfoH,
    qrCardH,
    brandH,
    totalH,
    clothesCount,
  }
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  onDark: boolean,
  theme: WardrobeQrcodeShareTheme,
) {
  const text = '衣柜分享'
  ctx.font = `bold 20px ${SERIF}`
  const tw = ctx.measureText(text).width
  const padX = 22
  const rw = tw + padX * 2
  const rh = 38
  const rx = cx - rw / 2
  const primary = theme.primary.startsWith('#') ? theme.primary : DEFAULT_PRIMARY

  if (onDark) {
    ctx.fillStyle = 'rgba(254, 252, 249, 0.95)'
    roundRect(ctx, rx, y, rw, rh, 19)
    ctx.fill()
    ctx.fillStyle = theme.title
  } else {
    const g = ctx.createLinearGradient(rx, y, rx + rw, y + rh)
    g.addColorStop(0, primary)
    g.addColorStop(1, hexToRgba(primary, 0.82))
    ctx.fillStyle = g
    roundRect(ctx, rx, y, rw, rh, 19)
    ctx.fill()
    ctx.fillStyle = theme.ribbonText
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + rh / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = '#f0e8de'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

function drawClothesThumb(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: WardrobeQrcodeShareTheme,
) {
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = theme.photoBg
  ctx.fill()
  ctx.save()
  roundRect(ctx, x, y, w, h, 10)
  ctx.clip()
  if (img) drawImageCoverFull(ctx, img, x, y, w, h)
  ctx.restore()
  ctx.strokeStyle = theme.photoBorder
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10)
  ctx.stroke()
}

/** 对齐 QhxTag：白底 + 主题色描边/字色 */
function drawStatPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  theme: WardrobeQrcodeShareTheme,
): number {
  ctx.font = `11px ${FONT}`
  const tw = ctx.measureText(label).width
  const padX = 11
  const pw = tw + padX * 2
  const ph = 24
  roundRect(ctx, x, y, pw, ph, 12)
  ctx.fillStyle = theme.pillFill
  ctx.fill()
  ctx.strokeStyle = theme.pillStroke
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, pw - 1, ph - 1, 12)
  ctx.stroke()
  ctx.fillStyle = theme.pillText
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + pw / 2, y + ph / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  return pw
}

function drawSolidCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  onDark: boolean,
  theme: WardrobeQrcodeShareTheme,
) {
  ctx.save()
  ctx.shadowColor = onDark ? 'rgba(0,0,0,0.22)' : 'rgba(90, 70, 56, 0.1)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  ctx.fillStyle = onDark ? theme.card : theme.cardSolid
  roundRect(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, 16)
  ctx.stroke()
}

export function buildWardrobeQrcodeSharePayload(
  wardrobe: Wardrobe | null | undefined,
  qr: QrCode,
  userName: string,
  userFace?: string | null,
  previewClothes?: WardrobeClothes[],
): WardrobeQrcodeSharePayload | null {
  if (!qr.code_url) return null
  const clothesImages = (previewClothes ?? [])
    .slice(0, 3)
    .map((c) => c.clothes_img)
    .filter((img): img is string => !!img)
  const expiresLabel =
    qr.expires_time == null
      ? '永久有效'
      : `有效期至 ${dayjs(qr.expires_time).format('YYYY-MM-DD HH:mm')}`
  return {
    wardrobeName: wardrobe?.wardrobe_name?.trim() || '我的衣柜',
    wardrobeDesc: wardrobe?.wardrobe_desc?.trim() || '',
    wardrobeCover: wardrobe?.wardrobe_cover,
    totalCount: wardrobe?.total_count,
    totalTimes: wardrobe?.total_times,
    totalPrice: wardrobe?.total_price,
    showPrice: wardrobe?.show_price,
    userName: userName.trim() || 'Lo娘',
    userFace,
    qrCodeUrl: qr.code_url,
    expiresLabel,
    clothesImages,
    theme: buildWardrobeQrcodeShareTheme(wardrobe),
  }
}

export async function prepareWardrobeQrcodeShareImages(
  payload: WardrobeQrcodeSharePayload,
): Promise<WardrobeQrcodeShareImageBundle> {
  const coverPath = payload.wardrobeCover?.trim()
  const [bgCover, avatar, qr, ...clothes] = await Promise.all([
    coverPath ? loadImageCors(resolveImgUrl(coverPath, 900)) : Promise.resolve(null),
    loadImageCors(resolveImgUrl(payload.userFace || DEFAULT_AVATAR, 200)),
    loadImageCors(resolveImgUrl(payload.qrCodeUrl, 480)),
    ...payload.clothesImages.map((img) => loadImageCors(resolveImgUrl(img, 360))),
  ])
  return { bgCover, avatar, qr, clothes: clothes.slice(0, 3) }
}

export function drawWardrobeQrcodeShareCanvas(
  payload: WardrobeQrcodeSharePayload,
  bundle: WardrobeQrcodeShareImageBundle,
): HTMLCanvasElement {
  const W = WARDROBE_QRCODE_SHARE_WIDTH
  const H = WARDROBE_QRCODE_SHARE_HEIGHT
  const theme = payload.theme
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const onDarkBg = !!bundle.bgCover
  const heroTitle = onDarkBg ? '#fefcf9' : theme.title
  const heroSub = onDarkBg ? 'rgba(254, 252, 249, 0.88)' : theme.text

  drawPageBackground(ctx, W, H, bundle.bgCover, theme)

  const layout = measureLayout(ctx, payload, bundle)
  let y = Math.max(28, Math.round((H - layout.totalH) / 2))

  drawRibbon(ctx, W / 2, y, onDarkBg, theme)
  y += layout.ribbonH + GAP

  const avatarR = 28
  drawAvatar(ctx, bundle.avatar, W / 2, y + avatarR, avatarR)
  y += layout.avatarBlockH + GAP

  ctx.textAlign = 'center'
  ctx.fillStyle = heroTitle
  ctx.font = `bold 20px ${FONT}`
  ctx.fillText(truncate(payload.userName, 14), W / 2, y + 16)
  ctx.fillStyle = heroSub
  ctx.font = `13px ${FONT}`
  ctx.fillText('邀请你参观她的 Lolita 衣柜', W / 2, y + 16 + 22)
  y += layout.userBlockH + GAP

  if (layout.clothesCount > 0) {
    const gap = 8
    const cellW = (CONTENT_W - gap * (layout.clothesCount - 1)) / layout.clothesCount
    const cellH = layout.clothesH - GAP
    let cx = P
    for (let i = 0; i < layout.clothesCount; i++) {
      drawClothesThumb(ctx, bundle.clothes[i] ?? null, cx, y, cellW, cellH, theme)
      cx += cellW + gap
    }
    y += layout.clothesH + GAP
  }

  const innerW = CONTENT_W
  const infoTitle = onDarkBg ? '#fefcf9' : theme.title
  const infoSub = onDarkBg ? 'rgba(254, 252, 249, 0.88)' : theme.textMuted

  ctx.textAlign = 'center'
  ctx.fillStyle = infoTitle
  ctx.font = `bold 22px ${SERIF}`
  for (const line of wrapLines(ctx, payload.wardrobeName, innerW, 2)) {
    ctx.fillText(line, W / 2, y + 18)
    y += 28
  }

  if (payload.wardrobeDesc) {
    y += 4
    ctx.fillStyle = infoSub
    ctx.font = `12px ${FONT}`
    for (const line of wrapLines(ctx, payload.wardrobeDesc, innerW, 2)) {
      ctx.fillText(line, W / 2, y + 14)
      y += 18
    }
  }

  const pills = getStatPills(payload)
  const pillRows = layoutPillRows(ctx, pills, innerW)
  if (pillRows.length) {
    y += 4
    for (const row of pillRows) {
      const rowWidth = row.reduce((sum, pill, i) => sum + pill.width + (i > 0 ? 6 : 0), 0)
      let px = (W - rowWidth) / 2
      for (const pill of row) {
        const pw = drawStatPill(ctx, px, y, pill.label, theme)
        px += pw + 6
      }
      y += 30
    }
  }

  y += GAP

  const qrFrameW = QR_SIZE + QR_PAD * 2
  const qrBoxX = (W - qrFrameW) / 2
  drawSolidCard(ctx, qrBoxX, y, qrFrameW, layout.qrCardH, onDarkBg, theme)

  const qrX = qrBoxX + QR_PAD
  const qrY = y + QR_PAD
  ctx.save()
  roundRect(ctx, qrX, qrY, QR_SIZE, QR_SIZE, 6)
  ctx.clip()
  if (bundle.qr) {
    ctx.drawImage(bundle.qr, qrX, qrY, QR_SIZE, QR_SIZE)
  } else {
    ctx.fillStyle = theme.photoBg
    ctx.fillRect(qrX, qrY, QR_SIZE, QR_SIZE)
  }
  ctx.restore()

  const textStartY = qrY + QR_SIZE + 10
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = theme.title
  ctx.font = `bold 13px ${FONT}`
  ctx.fillText('扫码查看衣柜', W / 2, textStartY + 7)

  ctx.fillStyle = theme.textMuted
  ctx.font = `10px ${FONT}`
  ctx.fillText(truncate(payload.expiresLabel, 24), W / 2, textStartY + 7 + 14 + 4)

  ctx.textBaseline = 'alphabetic'
  y += layout.qrCardH + GAP

  ctx.fillStyle = onDarkBg ? 'rgba(254, 252, 249, 0.85)' : theme.primary
  ctx.font = `bold 11px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · lolitalibrary.com', W / 2, y + 12)

  return canvas
}
