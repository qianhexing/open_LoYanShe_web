import { BASE_IMG } from '@/utils/ipConfig'
import { loadImageCors } from '@/utils/libraryShareCanvas'

export interface JournalCalendarDayCell {
  day: number
  count: number
  firstImage?: string | null
}

export interface JournalCalendarSharePayload {
  userName: string
  year: number
  month: number
  /** 筛选标签；空数组表示全部 */
  tags: string[]
  totalCount: number
  days: JournalCalendarDayCell[]
}

/** 设计稿宽度 750，输出 4K（3840px） */
const DESIGN_WIDTH = 750
const CW = 3840
const SCALE = CW / DESIGN_WIDTH

function spx(n: number): number {
  return Math.round(n * SCALE)
}

const FONT_FAMILY = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
const FONT_FAMILY_SANS = 'system-ui, "Microsoft YaHei", sans-serif'

function jFont(size: number, weight: string | number = '400'): string {
  return `${weight} ${spx(size)}px ${FONT_FAMILY}`
}

function jFontSans(size: number, weight: string | number = '400'): string {
  return `${weight} ${spx(size)}px ${FONT_FAMILY_SANS}`
}

const P = spx(36)
const GAP = spx(8)
const FOOTER_PAD = spx(40)
const MIN_CANVAS_H = spx(520)
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

const PAGE = {
  title: '#3d3429',
  secondary: '#5c4f42',
  muted: '#8a7b6a',
  faint: '#b5a898',
  cellBg: '#fefcf9',
  cellDent: '#f5efe6',
  cellBorder: 'rgba(120, 95, 70, 0.14)',
  accent: '#8a7355',
  badge: '#b85c48',
  tagBg: '#f5efe6',
  tagText: '#5c4f42',
}

function truncateName(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
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

function drawJapaneseBookPageBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#fefcf9')
  grad.addColorStop(0.48, '#faf6f2')
  grad.addColorStop(1, '#f7f0e8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.15, w * 0.5, h * 0.55, w * 0.82)
  vignette.addColorStop(0, 'rgba(255, 252, 248, 0)')
  vignette.addColorStop(1, 'rgba(210, 190, 170, 0.12)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  const marginX = Math.min(spx(52), w * 0.09)
  const marginGrad = ctx.createLinearGradient(0, 0, 0, h)
  marginGrad.addColorStop(0, 'rgba(184, 160, 130, 0)')
  marginGrad.addColorStop(0.08, 'rgba(184, 160, 130, 0.22)')
  marginGrad.addColorStop(0.92, 'rgba(184, 160, 130, 0.22)')
  marginGrad.addColorStop(1, 'rgba(184, 160, 130, 0)')
  ctx.fillStyle = marginGrad
  ctx.fillRect(marginX, 0, spx(1), h)

  ctx.save()
  ctx.globalAlpha = 0.35
  for (let ly = spx(80); ly < h - spx(40); ly += spx(28)) {
    ctx.strokeStyle = 'rgba(200, 180, 160, 0.18)'
    ctx.lineWidth = spx(1)
    ctx.beginPath()
    ctx.moveTo(P, ly)
    ctx.lineTo(w - P, ly)
    ctx.stroke()
  }
  ctx.restore()
}

function resolveImgUrl(path: string | null | undefined): string {
  const p = (path?.trim() || '').trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  const ossW = Math.min(2048, spx(400))
  return `${BASE_IMG}${p.replace(/^\//, '')}?x-oss-process=image/quality,q_90/resize,w_${ossW}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function measureHeaderHeight(ctx: CanvasRenderingContext2D, payload: JournalCalendarSharePayload): number {
  let y = P + spx(56) + spx(36) + spx(32)
  ctx.font = jFontSans(14)
  const tagText = payload.tags.length > 0
    ? `标签：${payload.tags.join('、')}`
    : '标签：全部'
  y += wrapLines(ctx, tagText, CW - P * 2).length * spx(20) + spx(12)
  y += spx(24) + spx(32)
  return y
}

function measureCanvasHeight(payload: JournalCalendarSharePayload): number {
  const mc = document.createElement('canvas')
  const ctx = mc.getContext('2d')
  if (!ctx) return MIN_CANVAS_H
  const dim = daysInMonth(payload.year, payload.month)
  const offset = new Date(payload.year, payload.month - 1, 1).getDay()
  const rows = Math.ceil((offset + dim) / 7)
  const contentW = CW - P * 2
  const cellSize = (contentW - GAP * 6) / 7
  const headerH = measureHeaderHeight(ctx, payload)
  const gridH = rows * (cellSize + GAP) - GAP
  return Math.max(MIN_CANVAS_H, headerH + gridH + P + FOOTER_PAD)
}

function drawTagPills(
  ctx: CanvasRenderingContext2D,
  tags: string[],
  startY: number
): number {
  const maxW = CW - P * 2
  let y = startY
  ctx.font = jFontSans(14)

  if (tags.length === 0) {
    ctx.fillStyle = PAGE.muted
    ctx.textAlign = 'left'
    ctx.fillText('标签：全部', P, y + spx(16))
    return y + spx(28)
  }

  ctx.fillStyle = PAGE.muted
  ctx.fillText('标签：', P, y + spx(16))
  const labelW = ctx.measureText('标签：').width
  let x = P + labelW + spx(4)
  const pillH = spx(24)
  const pillPadX = spx(10)
  y += spx(4)

  for (const tag of tags) {
    const text = truncateName(tag, 12)
    const tw = ctx.measureText(text).width
    const pw = tw + pillPadX * 2
    if (x + pw > P + maxW && x > P + labelW + spx(4)) {
      x = P + labelW + spx(4)
      y += pillH + spx(6)
    }
    drawRoundedRect(ctx, x, y, pw, pillH, spx(12))
    ctx.fillStyle = PAGE.tagBg
    ctx.fill()
    ctx.strokeStyle = PAGE.cellBorder
    ctx.lineWidth = spx(1)
    ctx.stroke()
    ctx.fillStyle = PAGE.tagText
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + pillPadX, y + pillH / 2)
    x += pw + spx(6)
  }
  ctx.textBaseline = 'alphabetic'
  return y + pillH + spx(12)
}

function drawDayCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  day: number,
  count: number,
  img: HTMLImageElement | null
) {
  const radius = spx(10)
  drawRoundedRect(ctx, x, y, size, size, radius)
  ctx.save()
  ctx.clip()

  if (img) {
    const scale = Math.max(size / img.width, size / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = PAGE.cellBg
    ctx.fillRect(x, y, size, size)
  }
  ctx.restore()

  ctx.strokeStyle = PAGE.cellBorder
  ctx.lineWidth = spx(1)
  drawRoundedRect(ctx, x, y, size, size, radius)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = jFontSans(13, 'bold')
  ctx.fillStyle = img ? '#ffffff' : PAGE.muted
  if (img) {
    ctx.shadowColor = 'rgba(0,0,0,0.75)'
    ctx.shadowBlur = spx(4)
  }
  ctx.fillText(`${day}`, x + size / 2, y + size / 2)
  ctx.shadowBlur = 0

  if (count > 0) {
    const badge = count > 99 ? '99+' : String(count)
    ctx.font = jFontSans(10, 'bold')
    const bw = Math.max(spx(18), ctx.measureText(badge).width + spx(8))
    const bh = spx(16)
    const bx = x + size - bw + spx(2)
    const by = y - spx(2)
    drawRoundedRect(ctx, bx, by, bw, bh, spx(8))
    ctx.fillStyle = PAGE.badge
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(badge, bx + bw / 2, by + bh / 2)
    ctx.textBaseline = 'alphabetic'
  }
  ctx.textAlign = 'left'
}

export async function drawJournalCalendarShareCanvas(
  payload: JournalCalendarSharePayload
): Promise<HTMLCanvasElement> {
  const dim = daysInMonth(payload.year, payload.month)
  const offset = new Date(payload.year, payload.month - 1, 1).getDay()
  const rows = Math.ceil((offset + dim) / 7)
  const contentW = CW - P * 2
  const cellSize = (contentW - GAP * 6) / 7
  const H = measureCanvasHeight(payload)

  const dayMap = new Map(payload.days.map((d) => [d.day, d]))
  const imageEntries = await Promise.all(
    Array.from({ length: dim }, (_, i) => i + 1).map(async (day) => {
      const cell = dayMap.get(day)
      const url = resolveImgUrl(cell?.firstImage)
      const img = url ? await loadImageCors(url) : null
      return [day, img] as const
    })
  )
  const imageMap = new Map(imageEntries)

  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  drawJapaneseBookPageBackground(ctx, CW, H)

  let y = P
  ctx.fillStyle = PAGE.title
  ctx.font = jFont(28, 'bold')
  ctx.textAlign = 'center'
  ctx.fillText('Lolita手账', CW / 2, y + spx(26))
  y += spx(56)

  ctx.font = jFont(22)
  ctx.fillText(truncateName(payload.userName, 16), CW / 2, y + spx(24))
  y += spx(36)

  ctx.font = jFontSans(20, 'bold')
  ctx.fillText(`${payload.year}年${payload.month}月`, CW / 2, y + spx(22))
  y += spx(32)

  y = drawTagPills(ctx, payload.tags, y)

  ctx.fillStyle = PAGE.muted
  ctx.font = jFontSans(14)
  ctx.textAlign = 'center'
  ctx.fillText(`共 ${payload.totalCount} 条记录`, CW / 2, y + spx(16))
  y += spx(28)

  ctx.font = jFontSans(12)
  ctx.fillStyle = PAGE.faint
  for (let c = 0; c < 7; c++) {
    const cx = P + c * (cellSize + GAP) + cellSize / 2
    ctx.fillText(WEEK_LABELS[c], cx, y + spx(14))
  }
  y += spx(32)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 7; c++) {
      const slot = r * 7 + c
      const dayNum = slot - offset + 1
      const x = P + c * (cellSize + GAP)
      const cy = y + r * (cellSize + GAP)
      if (dayNum < 1 || dayNum > dim) {
        drawRoundedRect(ctx, x, cy, cellSize, cellSize, spx(10))
        ctx.fillStyle = 'rgba(245, 239, 230, 0.45)'
        ctx.fill()
        continue
      }
      const cell = dayMap.get(dayNum)
      const count = cell?.count ?? 0
      const img = imageMap.get(dayNum) ?? null
      drawDayCell(ctx, x, cy, cellSize, dayNum, count, img)
    }
  }

  y += rows * (cellSize + GAP) - GAP + spx(16)
  ctx.fillStyle = PAGE.accent
  ctx.font = jFont(13)
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 手账分享', CW / 2, y + spx(18))

  return canvas
}

export { CW as JOURNAL_SHARE_4K_WIDTH, SCALE as JOURNAL_SHARE_SCALE }
