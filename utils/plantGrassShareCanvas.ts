import type { PlantGrassCartItem } from '@/stores/plantGrassCart'
import { FAVORITE_SHARE_ROW_DEFS, groupItemsByFavoriteScore } from '@/utils/clothesFavoriteLevel'
import {
  drawImageCover,
  drawNeuPhotoFrame,
  drawPageBackground,
  drawShareAvatar,
  loadImageCors,
  resolveImgUrl,
  shareFont,
  shareFontSans,
  SHARE_FOOTER_PAD,
  spx,
  WARDROBE_SHARE_CANVAS,
  WARDROBE_SHARE_DEFAULT_AVATAR,
  type ShareCanvasTheme,
} from '@/utils/wardrobeClothesShareCanvas'

const { CW, PAD, MAX_CANVAS_H, PHOTO_RADIUS } = WARDROBE_SHARE_CANVAS

const LABEL_COL_W = spx(92)
const TABLE_INNER_PAD = spx(10)
const THUMB = spx(66)
const THUMB_GAP = spx(8)
const MIN_TABLE_ROW_H = spx(76)
const LABEL_STAR_SIZE = spx(11)
const LABEL_STAR_GAP = spx(1)
const COMPACT_AVATAR_R = spx(22)
const COMPACT_USER_ROW_GAP = spx(10)

export function buildPlantGrassShareTheme(): ShareCanvasTheme {
  return {
    bg: '#f5eef2',
    bgOverlay: null,
    text: '#4a2f3d',
    textMuted: '#8a6f7d',
    title: '#4a2f3d',
    primary: '#c4849a',
    photoBorder: 'rgba(150, 110, 130, 0.2)',
    divider: 'rgba(150, 110, 130, 0.28)',
    footer: '#a8949c',
    photoBg: '#ebe3e8',
  }
}

function contentAreaLeft(): number {
  return PAD + LABEL_COL_W + TABLE_INNER_PAD
}

function contentAreaWidth(): number {
  return CW - PAD - contentAreaLeft()
}

function thumbsPerLine(): number {
  return Math.max(1, Math.floor((contentAreaWidth() + THUMB_GAP) / (THUMB + THUMB_GAP)))
}

interface TableRowLayout {
  defIndex: number
  label: string
  level: number
  items: PlantGrassCartItem[]
  rowH: number
}

function computeTableRowHeight(itemCount: number): number {
  if (itemCount <= 0) return MIN_TABLE_ROW_H
  const perLine = thumbsPerLine()
  const lines = Math.ceil(itemCount / perLine)
  const contentH = lines * THUMB + Math.max(0, lines - 1) * THUMB_GAP + TABLE_INNER_PAD * 2
  return Math.max(MIN_TABLE_ROW_H, contentH)
}

function computeTableRowLayouts(rowItems: PlantGrassCartItem[][]): TableRowLayout[] {
  return FAVORITE_SHARE_ROW_DEFS.map((def, i) => {
    const items = rowItems[i] ?? []
    return {
      defIndex: i,
      label: def.label,
      level: def.level,
      items,
      rowH: computeTableRowHeight(items.length),
    }
  })
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawLabelStars(ctx: CanvasRenderingContext2D, cx: number, y: number, level: number) {
  if (level <= 0) return
  ctx.font = `${LABEL_STAR_SIZE}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const starW = ctx.measureText('★').width
  const totalW = 5 * starW + 4 * LABEL_STAR_GAP
  let sx = cx - totalW / 2 + starW / 2
  for (let s = 1; s <= 5; s++) {
    ctx.fillStyle = s <= level ? '#d97706' : 'rgba(120, 113, 108, 0.45)'
    ctx.fillText('★', sx, y)
    sx += starW + LABEL_STAR_GAP
  }
}

function drawTableLabelCell(
  ctx: CanvasRenderingContext2D,
  y: number,
  rowH: number,
  label: string,
  level: number,
  theme: ShareCanvasTheme
) {
  const x = PAD
  ctx.fillStyle = hexToRgba(theme.primary, 0.08)
  ctx.fillRect(x, y, LABEL_COL_W, rowH)
  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(x + 0.5, y + 0.5, LABEL_COL_W - 1, rowH - 1)
  const cx = x + LABEL_COL_W / 2
  const hasStars = level > 0
  const captionY = hasStars ? y + rowH / 2 + spx(10) : y + rowH / 2
  ctx.fillStyle = theme.title
  ctx.font = shareFont(13, 'bold')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, captionY)
  if (hasStars) drawLabelStars(ctx, cx, y + rowH / 2 - spx(12), level)
}

function resolveLibraryImg(item: PlantGrassCartItem): string {
  return resolveImgUrl(item.square_cover || item.cover)
}

function drawTableContentCell(
  ctx: CanvasRenderingContext2D,
  rowY: number,
  rowH: number,
  items: PlantGrassCartItem[],
  theme: ShareCanvasTheme,
  imgCache: Map<string, HTMLImageElement | null>
) {
  const contentLeft = PAD + LABEL_COL_W
  const contentWidth = CW - PAD - contentLeft
  const thumbLeft = contentLeft + TABLE_INNER_PAD
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fillRect(contentLeft, rowY, contentWidth, rowH)
  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(contentLeft + 0.5, rowY + 0.5, contentWidth - 1, rowH - 1)
  if (!items.length) {
    ctx.fillStyle = theme.textMuted
    ctx.font = shareFontSans(13)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('—', thumbLeft, rowY + rowH / 2)
    return
  }
  const perLine = thumbsPerLine()
  let x = thumbLeft
  let cy = rowY + TABLE_INNER_PAD
  for (let i = 0; i < items.length; i++) {
    const col = i % perLine
    if (col === 0 && i > 0) {
      x = thumbLeft
      cy += THUMB + THUMB_GAP
    } else if (i > 0) {
      x += THUMB + THUMB_GAP
    }
    const el = items[i]
    const u = resolveLibraryImg(el)
    const im = u ? imgCache.get(u) ?? null : null
    if (im) {
      drawImageCover(ctx, im, x, cy, THUMB, THUMB, PHOTO_RADIUS, theme)
    } else {
      drawNeuPhotoFrame(ctx, x, cy, THUMB, THUMB, PHOTO_RADIUS, theme)
      ctx.fillStyle = theme.textMuted
      ctx.font = shareFontSans(11)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('无图', x + THUMB / 2, cy + THUMB / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
  }
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  layout: TableRowLayout,
  theme: ShareCanvasTheme,
  imgCache: Map<string, HTMLImageElement | null>
) {
  drawTableLabelCell(ctx, y, layout.rowH, layout.label, layout.level, theme)
  drawTableContentCell(ctx, y, layout.rowH, layout.items, theme, imgCache)
  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.beginPath()
  ctx.moveTo(PAD, y + layout.rowH)
  ctx.lineTo(CW - PAD, y + layout.rowH)
  ctx.stroke()
}

function measureHeaderEndY(
  ctx: CanvasRenderingContext2D,
  title: string,
  dateLabel: string,
  userName: string
): number {
  const top = PAD + spx(16)
  ctx.font = shareFont(20, 'bold')
  const titleLineH = spx(26)
  const titleH = titleLineH
  const userRowTop = top + titleH + COMPACT_USER_ROW_GAP
  const userRowH = COMPACT_AVATAR_R * 2
  void dateLabel
  void userName
  return top + titleH + COMPACT_USER_ROW_GAP + userRowH + spx(12)
}

function layoutHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  dateLabel: string,
  userName: string,
  avatarImg: HTMLImageElement | null,
  theme: ShareCanvasTheme
): number {
  const top = PAD + spx(16)
  ctx.fillStyle = theme.title
  ctx.font = shareFont(20, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(title, PAD, top + spx(18))

  ctx.font = shareFontSans(14)
  ctx.fillStyle = theme.textMuted
  ctx.fillText(dateLabel, PAD, top + spx(44))

  const userRowTop = top + spx(56) + COMPACT_USER_ROW_GAP
  const avatarCy = userRowTop + COMPACT_AVATAR_R
  drawShareAvatar(ctx, avatarImg, PAD + COMPACT_AVATAR_R, avatarCy, COMPACT_AVATAR_R, theme)
  ctx.font = shareFontSans(14)
  ctx.fillStyle = theme.textMuted
  ctx.textBaseline = 'middle'
  ctx.fillText(userName.trim() || '用户', PAD + COMPACT_AVATAR_R * 2 + spx(12), avatarCy)
  return userRowTop + COMPACT_AVATAR_R * 2 + spx(12)
}

export async function drawPlantGrassShareCanvas(options: {
  items: PlantGrassCartItem[]
  title: string
  dateLabel: string
  userName: string
  userFace: string
  onProgress?: (label: string) => void
}): Promise<{ canvas: HTMLCanvasElement; drawnCount: number; sourceCount: number }> {
  const { items, title, dateLabel, userName, userFace, onProgress } = options
  const theme = buildPlantGrassShareTheme()
  onProgress?.('加载头像…')
  const avatarUrl = resolveImgUrl(userFace || WARDROBE_SHARE_DEFAULT_AVATAR)
  const avatarImg = await loadImageCors(avatarUrl)

  const measureCv = document.createElement('canvas')
  measureCv.width = CW
  measureCv.height = 1200
  const mctx = measureCv.getContext('2d')
  if (!mctx) throw new Error('canvas')
  const headH = measureHeaderEndY(mctx, title, dateLabel, userName)

  const buckets = groupItemsByFavoriteScore(items, (item) => item.score)
  const rowItems = buckets.map((b) => [...b])
  let layouts = computeTableRowLayouts(rowItems)

  let bodyH = layouts.reduce((a, s) => a + s.rowH, 0)
  const totalItems = items.length
  let drawnCount = totalItems

  while (headH + bodyH + PAD + SHARE_FOOTER_PAD > MAX_CANVAS_H && drawnCount > 0) {
    let trimmed = false
    for (let i = rowItems.length - 1; i >= 0 && headH + bodyH + PAD + SHARE_FOOTER_PAD > MAX_CANVAS_H; i--) {
      if (rowItems[i].length > 0) {
        rowItems[i] = rowItems[i].slice(0, -1)
        trimmed = true
        drawnCount -= 1
        break
      }
    }
    if (!trimmed) break
    layouts = computeTableRowLayouts(rowItems)
    bodyH = layouts.reduce((a, s) => a + s.rowH, 0)
  }

  const H = Math.min(MAX_CANVAS_H, headH + bodyH + PAD + SHARE_FOOTER_PAD)
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')

  drawPageBackground(ctx, CW, H, theme, null)
  onProgress?.('绘制中…')
  const tableTop = layoutHeader(ctx, title, dateLabel, userName, avatarImg, theme)

  const drawItems = rowItems.flat()
  const urls = [...new Set(drawItems.map((it) => resolveLibraryImg(it)).filter(Boolean))]
  const imgCache = new Map<string, HTMLImageElement | null>()
  const chunk = 20
  for (let i = 0; i < urls.length; i += chunk) {
    onProgress?.(`加载图片 ${Math.min(i + chunk, urls.length)}/${urls.length}…`)
    const part = urls.slice(i, i + chunk)
    await Promise.all(
      part.map(async (u) => {
        if (imgCache.has(u)) return
        imgCache.set(u, await loadImageCors(u))
      })
    )
  }

  ctx.strokeStyle = theme.divider
  ctx.lineWidth = spx(1)
  ctx.strokeRect(PAD + 0.5, tableTop + 0.5, CW - PAD * 2 - 1, bodyH - 1)
  ctx.beginPath()
  ctx.moveTo(PAD + LABEL_COL_W, tableTop)
  ctx.lineTo(PAD + LABEL_COL_W, tableTop + bodyH)
  ctx.stroke()

  let rowY = tableTop
  for (const layout of layouts) {
    drawTableRow(ctx, rowY, layout, theme, imgCache)
    rowY += layout.rowH
  }

  ctx.fillStyle = theme.footer
  ctx.font = shareFontSans(13)
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 上新日历 · 种草单', CW / 2, H - spx(20))

  return { canvas, drawnCount, sourceCount: totalItems }
}
