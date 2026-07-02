import { BASE_IMG } from '@/utils/ipConfig'
import { loadImageCors } from '@/utils/libraryShareCanvas'

export interface AlbumCoverShareItem {
  title: string
  coverUrl: string
  achieved: boolean
}

export interface AlbumCoverSharePayload {
  albumTitle: string
  coverUrl: string
  count: number
  countAchieve: number
  progress: number
  userName?: string
  items: AlbumCoverShareItem[]
}

export interface AlbumShareRenderOptions {
  /** 4K 高清：画布宽度 2160px，并加载更高分辨率素材 */
  highQuality?: boolean
}

export const ALBUM_SHARE_BASE_WIDTH = 750
/** 4K UHD 宽度（相对默认 750 等比缩放） */
export const ALBUM_SHARE_4K_WIDTH = 2160
export const ALBUM_SHARE_4K_SCALE = ALBUM_SHARE_4K_WIDTH / ALBUM_SHARE_BASE_WIDTH

const CW = ALBUM_SHARE_BASE_WIDTH
const P = 36
const CONTENT_W = CW - P * 2
const PRIMARY = '#ff9eb5'
const PRIMARY_SOFT = '#fce4f0'
const COVER_W = 280
const COVER_H = Math.round(COVER_W * (4 / 3))
const STAT_H = 72
const ITEM_COLS = 4
const ITEM_GAP = 10
const ITEM_LABEL_H = 34
const FOOTER_H = 36
const FONT =
  'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'

function resolveImgUrl(path: string, resize = 600): string {
  const p = (path?.trim() || 'static/plan_cover/default.jpg').trim()
  if (/^https?:\/\//i.test(p)) return p
  const rel = p.replace(/^\//, '')
  const quality = resize >= 2000 ? 'q_92' : 'q_85'
  return `${BASE_IMG}${rel}?x-oss-process=image/quality,${quality}/resize,w_${resize}`
}

function getItemGridMetrics() {
  const cellW = (CONTENT_W - ITEM_GAP * (ITEM_COLS - 1)) / ITEM_COLS
  const thumbH = Math.round(cellW * (4 / 3))
  const rowH = thumbH + ITEM_LABEL_H
  return { cellW, thumbH, rowH }
}

interface AlbumShareLayout {
  totalHeight: number
  coverY: number
  titleLines: string[]
  titleBaseY: number
  statY: number
  barY: number
  itemsGridY: number
  itemRows: number
  itemRowH: number
  footerY: number
}

function createMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const mc = document.createElement('canvas')
  return mc.getContext('2d')
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
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

/** 与绘制逻辑共用同一套纵向布局计算，避免 canvas 高度不足被截断 */
function computeLayout(payload: AlbumCoverSharePayload): AlbumShareLayout {
  const ctx = createMeasureCtx()
  const coverY = P + 40
  let y = coverY + COVER_H + 28

  let titleLines: string[] = [payload.albumTitle || '成就相册']
  if (ctx) {
    ctx.font = `bold 28px ${FONT}`
    titleLines = wrapLines(ctx, payload.albumTitle || '成就相册', CONTENT_W - 40).slice(0, 2)
  }
  const titleBaseY = y
  y += titleLines.length * 34

  if (payload.userName) y += 28
  else y += 8

  const statY = y + 12
  const barY = statY + STAT_H + 24
  let contentBottom = barY + 12 + 30

  const items = payload.items.slice(0, 12)
  const { rowH } = getItemGridMetrics()
  const itemRows = items.length > 0 ? Math.ceil(items.length / ITEM_COLS) : 0
  let itemsGridY = 0

  if (items.length > 0) {
    itemsGridY = barY + 48 + 24
    contentBottom = itemsGridY + itemRows * rowH
  }

  const footerY = contentBottom + 20
  const totalHeight = Math.max(480, footerY + FOOTER_H)

  return {
    totalHeight,
    coverY,
    titleLines,
    titleBaseY,
    statY,
    barY,
    itemsGridY,
    itemRows,
    itemRowH: rowH,
    footerY
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

function drawBackground(ctx: CanvasRenderingContext2D, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#fff5fa')
  grad.addColorStop(0.45, '#ffffff')
  grad.addColorStop(1, '#fdf2f8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CW, h)
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save()
  drawRoundedRect(ctx, x, y, w, h, 18)
  ctx.clip()
  if (img) {
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = PRIMARY_SOFT
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()

  ctx.save()
  drawRoundedRect(ctx, x, y, w, h, 18)
  ctx.strokeStyle = 'rgba(233, 30, 140, 0.12)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

export async function drawAlbumCoverShareCanvas(
  payload: AlbumCoverSharePayload,
  options?: AlbumShareRenderOptions
): Promise<HTMLCanvasElement> {
  const highQuality = options?.highQuality !== false
  const scale = highQuality ? ALBUM_SHARE_4K_SCALE : 1
  const layout = computeLayout(payload)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CW * scale)
  canvas.height = Math.round(layout.totalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  if (scale !== 1) {
    ctx.scale(scale, scale)
  }

  drawBackground(ctx, layout.totalHeight)

  const coverResize = highQuality ? 3840 : 800
  const itemResize = highQuality ? 960 : 240

  ctx.fillStyle = '#9ca3af'
  ctx.font = `13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 成就相册', CW / 2, P + 18)

  const coverX = (CW - COVER_W) / 2
  const coverImg = await loadImageCors(resolveImgUrl(payload.coverUrl, coverResize))
  drawCoverImage(ctx, coverImg, coverX, layout.coverY, COVER_W, COVER_H)

  ctx.fillStyle = '#111827'
  ctx.font = `bold 28px ${FONT}`
  ctx.textAlign = 'center'
  let y = layout.titleBaseY
  for (const line of layout.titleLines) {
    ctx.fillText(line, CW / 2, y)
    y += 34
  }

  if (payload.userName) {
    ctx.fillStyle = '#6b7280'
    ctx.font = `14px ${FONT}`
    ctx.fillText(`${payload.userName} 的打卡目标`, CW / 2, y + 8)
  }

  const statY = layout.statY
  const statW = (CONTENT_W - 12) / 2
  drawRoundedRect(ctx, P, statY, statW, STAT_H, 14)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#9ca3af'
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('目标总数', P + 18, statY + 28)
  ctx.fillStyle = '#111827'
  ctx.font = `bold 28px ${FONT}`
  ctx.fillText(String(payload.count), P + 18, statY + 58)

  drawRoundedRect(ctx, P + statW + 12, statY, statW, STAT_H, 14)
  ctx.fillStyle = PRIMARY
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `12px ${FONT}`
  ctx.fillText('已打卡', P + statW + 30, statY + 28)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 28px ${FONT}`
  ctx.fillText(String(payload.countAchieve), P + statW + 30, statY + 58)

  const barY = layout.barY
  drawRoundedRect(ctx, P, barY, CONTENT_W, 12, 6)
  ctx.fillStyle = '#f3f4f6'
  ctx.fill()
  const progressW = Math.max(0, Math.min(CONTENT_W, (CONTENT_W * payload.progress) / 100))
  if (progressW > 0) {
    drawRoundedRect(ctx, P, barY, progressW, 12, 6)
    ctx.fillStyle = PRIMARY
    ctx.fill()
  }
  ctx.fillStyle = '#6b7280'
  ctx.font = `13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`${payload.progress}%`, P + CONTENT_W, barY + 30)

  const items = payload.items.slice(0, 12)
  if (items.length > 0) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#374151'
    ctx.font = `bold 16px ${FONT}`
    ctx.fillText('打卡目标', P, layout.barY + 48)

    const { cellW, thumbH } = getItemGridMetrics()
    const itemImages = await Promise.all(
      items.map((item) => loadImageCors(resolveImgUrl(item.coverUrl, itemResize)))
    )

    for (let i = 0; i < items.length; i++) {
      const col = i % ITEM_COLS
      const row = Math.floor(i / ITEM_COLS)
      const x = P + col * (cellW + ITEM_GAP)
      const cellY = layout.itemsGridY + row * layout.itemRowH

      drawCoverImage(ctx, itemImages[i], x, cellY, cellW, thumbH)
      if (!items[i].achieved) {
        ctx.save()
        drawRoundedRect(ctx, x, cellY, cellW, thumbH, 10)
        ctx.fillStyle = 'rgba(0,0,0,0.42)'
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `11px ${FONT}`
        ctx.textAlign = 'center'
        ctx.fillText('未打卡', x + cellW / 2, cellY + thumbH / 2 + 4)
        ctx.restore()
      }

      ctx.fillStyle = '#4b5563'
      ctx.font = `11px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(truncateText(ctx, items[i].title, cellW - 4), x + cellW / 2, cellY + thumbH + 18)
    }
  }

  ctx.fillStyle = '#d1d5db'
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('lolitalibrary.com', CW / 2, layout.footerY)

  return canvas
}
