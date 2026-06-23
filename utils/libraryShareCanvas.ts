import { BASE_IMG } from '@/utils/ipConfig'

export interface LibraryShareSimilarItem {
  name: string
  cover: string
  libraryType: string
  similarityText?: string
  shopName?: string
}

export interface LibraryShareChildItem {
  name: string
  cover: string
  libraryType: string
}

export interface LibraryShareSkuItem {
  pattern: string
  priceText?: string
  priceRmbText?: string
  cover?: string
}

export interface LibraryShareInfoSection {
  title: string
  tags?: string[]
  text?: string
  lines?: string[]
}

export interface LibrarySharePayload {
  name: string
  cover: string
  libraryType: string
  libraryId?: number
  shopName?: string
  shopLogo?: string
  parent?: LibraryShareChildItem
  childList: LibraryShareChildItem[]
  scoreText?: string
  scoreCaption?: string
  priceText?: string
  priceRmbText?: string
  skuList?: LibraryShareSkuItem[]
  infoSections: LibraryShareInfoSection[]
  similarList?: LibraryShareSimilarItem[]
  uploadUserName?: string
}

export interface LibraryShareImageBundle {
  cover: HTMLImageElement | null
  shopLogo: HTMLImageElement | null
  childList: HTMLImageElement[]
  skuCovers: HTMLImageElement[]
  similarCovers: HTMLImageElement[]
}

const CW = 750
const P = 36
const DEFAULT_COVER = 'static/plan_cover/default.jpg'
const CONTENT_W = CW - P * 2
const MAIN_COVER_W = 302
const HERO_GAP = 22
const INFO_INNER_PAD = 14
const INFO_COL_W = CONTENT_W - MAIN_COVER_W - HERO_GAP
const MAIN_COVER_H = coverHeight(MAIN_COVER_W)

function infoInnerWidth(): number {
  return INFO_COL_W - INFO_INNER_PAD * 2
}
const CHILD_COLS = 4
const CHILD_GAP = 10
const CHILD_CELL_W = (CONTENT_W - CHILD_GAP * (CHILD_COLS - 1)) / CHILD_COLS
const CHILD_THUMB_H = CHILD_CELL_W
const CHILD_NAME_H = 34
const SIMILAR_COLS = 4
const SIMILAR_GAP = 10
const SIMILAR_CELL_W = (CONTENT_W - SIMILAR_GAP * (SIMILAR_COLS - 1)) / SIMILAR_COLS
const SIMILAR_THUMB_H = coverHeight(SIMILAR_CELL_W)
const SIMILAR_NAME_H = 32
const SIMILAR_MAX = 4
const SKU_COLS = 3
const SKU_GAP = 10
const SKU_CELL_W = (CONTENT_W - SKU_GAP * (SKU_COLS - 1)) / SKU_COLS
const SKU_THUMB_H = coverHeight(SKU_CELL_W)
const SKU_META_H = 40

/** 信息区 QhxTag 胶囊 */
const TAG_PILL = {
  fill: 'rgba(236, 72, 153, 0.07)',
  stroke: 'rgba(236, 72, 153, 0.16)',
  text: '#9d6080',
}

/** 日式书页 / 和纸质感色板（更淡） */
const PAGE = {
  card: '#fefcf9',
  cardMuted: '#faf6f2',
  coverEmpty: '#f0e8de',
  title: '#5a4638',
  body: '#7a6656',
  muted: '#a89888',
  footer: '#b0a090',
}

/** 衣柜服饰角标配色（实底，封面/缩略图上可读） */
interface WardrobeBadgePalette {
  fill: string
  stroke: string
  text: string
}

const WARDROBE_STATUS_VIOLET: WardrobeBadgePalette = {
  fill: '#ede9fe',
  stroke: '#c4b5fd',
  text: '#5b21b6',
}

const WARDROBE_STATUS_AMBER: WardrobeBadgePalette = {
  fill: '#fef3c7',
  stroke: '#fcd34d',
  text: '#92400e',
}

const WARDROBE_STATUS_EMERALD: WardrobeBadgePalette = {
  fill: '#d1fae5',
  stroke: '#6ee7b7',
  text: '#065f46',
}

const WARDROBE_FAV_BADGE: WardrobeBadgePalette = {
  fill: '#ffedd5',
  stroke: '#fdba74',
  text: '#b45309',
}

/** 版型 / 类型角标随机配色池 */
const SKU_PATTERN_PALETTES: WardrobeBadgePalette[] = [
  WARDROBE_STATUS_VIOLET,
  WARDROBE_STATUS_AMBER,
  WARDROBE_STATUS_EMERALD,
  WARDROBE_FAV_BADGE,
  {
    fill: '#fce7f3',
    stroke: '#f9a8d4',
    text: '#be185d',
  },
  {
    fill: '#e0f2fe',
    stroke: '#7dd3fc',
    text: '#0369a1',
  },
  {
    fill: '#ffe4e6',
    stroke: '#fda4af',
    text: '#be123c',
  },
  {
    fill: '#f3e8ff',
    stroke: '#d8b4fe',
    text: '#7e22ce',
  },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getWardrobeBadgePalette(label: string, index: number): WardrobeBadgePalette {
  const key = label.trim() || `__badge_${index}`
  return SKU_PATTERN_PALETTES[hashString(key) % SKU_PATTERN_PALETTES.length]
}

function drawWardrobeBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  palette: WardrobeBadgePalette,
  fontSize = 10,
): number {
  const padX = 7
  const h = fontSize <= 10 ? 18 : 20
  ctx.font = `bold ${fontSize}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`
  const label = truncateName(text, fontSize <= 10 ? 14 : 18)
  const tw = ctx.measureText(label).width
  const w = tw + padX * 2
  drawRoundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = palette.fill
  ctx.fill()
  ctx.strokeStyle = palette.stroke
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = palette.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + padX, y + h / 2 + 0.5)
  return w
}

function coverHeight(width: number): number {
  return Math.round(width * (4 / 3))
}

function resolveImgUrl(path: string | null | undefined, resize = 600): string {
  const p = (path?.trim() || DEFAULT_COVER).trim()
  if (/^https?:\/\//i.test(p)) return p
  const rel = p.replace(/^\//, '')
  return `${BASE_IMG}${rel}?x-oss-process=image/quality,q_85/resize,w_${resize}`
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

export async function prepareLibraryShareImages(payload: LibrarySharePayload): Promise<LibraryShareImageBundle> {
  const cover = await loadImageCors(resolveImgUrl(payload.cover, 900))
  const shopLogo = payload.shopLogo
    ? await loadImageCors(resolveImgUrl(payload.shopLogo, 200))
    : null
  const childList = await Promise.all(
    payload.childList.map((item) => loadImageCors(resolveImgUrl(item.cover, 300))),
  )
  const skuCovers = await Promise.all(
    (payload.skuList ?? []).map((item) =>
      item.cover ? loadImageCors(resolveImgUrl(item.cover, 300)) : Promise.resolve(null),
    ),
  )
  const similarCovers = await Promise.all(
    (payload.similarList ?? []).slice(0, SIMILAR_MAX).map((item) =>
      loadImageCors(resolveImgUrl(item.cover, 300)),
    ),
  )

  return { cover, shopLogo, childList, skuCovers, similarCovers }
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

function drawJapaneseBookPageBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#fefcf9')
  grad.addColorStop(0.48, '#faf6f2')
  grad.addColorStop(1, '#f7f0e8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.15, w * 0.5, h * 0.55, w * 0.82)
  vignette.addColorStop(0, 'rgba(255, 252, 248, 0)')
  vignette.addColorStop(1, 'rgba(110, 88, 62, 0.02)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.01
  for (let i = 0; i < 2400; i++) {
    const px = (i * 97 + 17) % w
    const py = (i * 53 + 11) % h
    ctx.fillStyle = i % 3 === 0 ? '#d4c8b8' : '#ffffff'
    ctx.fillRect(px, py, 1, 1)
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.012
  ctx.strokeStyle = '#e8ddd2'
  ctx.lineWidth = 1
  for (let lineY = 6; lineY < h; lineY += 15) {
    const wave = Math.sin(lineY * 0.08) * 0.8
    ctx.beginPath()
    ctx.moveTo(0, lineY + wave)
    ctx.lineTo(w, lineY + wave + 0.4)
    ctx.stroke()
  }
  ctx.restore()

  const spine = ctx.createLinearGradient(0, 0, 40, 0)
  spine.addColorStop(0, 'rgba(120, 95, 70, 0.028)')
  spine.addColorStop(1, 'rgba(120, 95, 70, 0)')
  ctx.fillStyle = spine
  ctx.fillRect(0, 0, 40, h)
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
  ctx.beginPath()
  const r = radius
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
  ctx.fill()
  ctx.restore()
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

function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  img: HTMLImageElement | null | undefined,
  radius = 12,
) {
  drawCard(ctx, x, y, w, h, PAGE.cardMuted, radius)
  ctx.save()
  drawRoundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = PAGE.coverEmpty
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}

function drawRoundRectPath(
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

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  textColor: string,
): number {
  const padX = 8
  const h = 20
  ctx.font = 'bold 10px system-ui, "Microsoft YaHei", sans-serif'
  const tw = ctx.measureText(text).width
  const w = tw + padX * 2
  drawCard(ctx, x, y, w, h, fill, h / 2)
  ctx.fillStyle = textColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2 + 1)
  return w
}

function measureTagRows(ctx: CanvasRenderingContext2D, tags: string[], maxW: number): number {
  if (!tags.length) return 0
  ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  const padX = 12
  const gap = 8
  const rowH = 26
  let rows = 1
  let x = 0
  for (const tag of tags) {
    const tw = ctx.measureText(tag).width + padX * 2
    if (x > 0 && x + tw > maxW) {
      rows += 1
      x = 0
    }
    x += tw + gap
  }
  return rows * rowH + (rows - 1) * 6
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
  drawRoundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = TAG_PILL.fill
  ctx.fill()
  ctx.strokeStyle = TAG_PILL.stroke
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = TAG_PILL.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2)
  return w
}

function drawTagRows(
  ctx: CanvasRenderingContext2D,
  tags: string[],
  x: number,
  y: number,
  maxW: number,
): number {
  if (!tags.length) return y
  ctx.font = '12px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  const padX = 12
  const gap = 8
  const rowH = 26
  let cx = x
  let cy = y
  for (const tag of tags) {
    const tw = ctx.measureText(tag).width + padX * 2
    if (cx > x && cx + tw > x + maxW) {
      cx = x
      cy += rowH + 6
    }
    drawTagPill(ctx, tag, cx, cy)
    cx += tw + gap
  }
  return cy + rowH
}

function logicalLinesFromText(text: string): string[] {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function measureMultilineBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  innerW: number,
  lineHeight = 20,
): number {
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  let h = 0
  for (const line of lines) {
    if (!line) continue
    h += wrapLines(ctx, line, innerW).length * lineHeight
  }
  return h + 4
}

function drawMultilineBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: string[],
  innerW: number,
  lineHeight = 20,
): number {
  let curY = y
  ctx.fillStyle = PAGE.body
  ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const line of lines) {
    if (!line) continue
    for (const wrapped of wrapLines(ctx, line, innerW)) {
      ctx.fillText(wrapped, x, curY + 14)
      curY += lineHeight
    }
  }
  return curY + 4
}

function measureInfoSectionInColumn(
  ctx: CanvasRenderingContext2D,
  section: LibraryShareInfoSection,
  colW: number,
): number {
  let h = 8 + 28
  const innerW = colW - 8
  if (section.tags?.length) {
    h += measureTagRows(ctx, section.tags, innerW) + 8
  } else if (section.lines?.length) {
    h += measureMultilineBlock(ctx, section.lines, innerW) - 4
  } else if (section.text) {
    h += measureMultilineBlock(ctx, logicalLinesFromText(section.text), innerW) - 4
  }
  return h + 8
}

function drawInfoSectionInColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  colW: number,
  section: LibraryShareInfoSection,
): number {
  let y = startY + 8
  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 16px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(section.title, x, y + 18)
  y += 28

  const innerW = colW - 8

  if (section.tags?.length) {
    y = drawTagRows(ctx, section.tags, x, y, innerW) + 8
  } else if (section.lines?.length) {
    y = drawMultilineBlock(ctx, x, y, section.lines, innerW)
  } else if (section.text) {
    y = drawMultilineBlock(ctx, x, y, logicalLinesFromText(section.text), innerW)
  }
  return y + 8
}

function allSkusWithoutCover(list?: LibraryShareSkuItem[]): list is LibraryShareSkuItem[] {
  const items = list ?? []
  return items.length > 0 && items.every((item) => !item.cover?.trim())
}

function shouldSkipSkuGrid(list: LibraryShareSkuItem[]): boolean {
  return list.length > 0 && list.every((item) => !item.cover?.trim())
}

function skuInfoSectionForHero(list: LibraryShareSkuItem[]): LibraryShareInfoSection {
  return {
    title: '版型/参考价',
    lines: list.map((item) => {
      const parts = [item.pattern.trim()]
      if (item.priceText?.trim()) parts.push(item.priceText.trim())
      if (item.priceRmbText?.trim()) parts.push(item.priceRmbText.trim())
      return parts.join(' · ')
    }),
  }
}

function measureHeroInfoColumn(ctx: CanvasRenderingContext2D, payload: LibrarySharePayload): number {
  const textW = infoInnerWidth()
  let h = 0
  ctx.font = 'bold 17px system-ui, "Microsoft YaHei", sans-serif'
  h += wrapLines(ctx, payload.name.trim(), textW).slice(0, 3).length * 22 + 10
  if (payload.parent?.name) h += 24
  if (payload.shopName?.trim()) h += 52
  if (payload.scoreText?.trim()) h += 38 + 12
  if (!payload.skuList?.length && payload.priceText?.trim()) {
    h += 24
    if (payload.priceRmbText?.trim()) h += 20
    h += 8
  }
  if (allSkusWithoutCover(payload.skuList)) {
    h += measureInfoSectionInColumn(ctx, skuInfoSectionForHero(payload.skuList), textW)
  }
  for (const section of payload.infoSections) {
    h += measureInfoSectionInColumn(ctx, section, textW)
  }
  return h
}

function measureHeroSection(ctx: CanvasRenderingContext2D, payload: LibrarySharePayload): number {
  const infoH = measureHeroInfoColumn(ctx, payload) + INFO_INNER_PAD * 2
  return Math.max(MAIN_COVER_H, infoH) + 24
}

function measureSkuSection(payload: LibrarySharePayload): number {
  const list = payload.skuList ?? []
  if (!list.length || shouldSkipSkuGrid(list)) return 0
  const rows = Math.ceil(list.length / SKU_COLS)
  return 8 + 32 + rows * (SKU_THUMB_H + SKU_META_H + 8) + 12
}

function measureChildGridSection(payload: LibrarySharePayload): number {
  const list = payload.childList ?? []
  if (!list.length) return 0
  const rows = Math.ceil(list.length / CHILD_COLS)
  return 8 + 32 + rows * (CHILD_THUMB_H + CHILD_NAME_H + 8) + 12
}

function measureSimilarSection(payload: LibrarySharePayload): number {
  const list = payload.similarList ?? []
  if (!list.length) return 0
  return 8 + 32 + SIMILAR_THUMB_H + SIMILAR_NAME_H + 8 + 12
}

function measurePayloadHeight(payload: LibrarySharePayload): number {
  const mc = document.createElement('canvas')
  const ctx = mc.getContext('2d')
  if (!ctx) return 900

  let y = P + 44
  y += measureHeroSection(ctx, payload)
  y += measureSkuSection(payload)
  y += measureChildGridSection(payload)
  y += measureSimilarSection(payload)
  if (payload.uploadUserName?.trim()) y += 28

  return Math.max(520, y + P + 36)
}

function drawHeroInfoColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): number {
  const textW = infoInnerWidth()
  let y = startY

  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 17px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const nameLines = wrapLines(ctx, payload.name.trim(), textW)
  for (const line of nameLines.slice(0, 3)) {
    ctx.fillText(line, x, y + 18)
    y += 22
  }
  y += 10

  if (payload.parent?.name) {
    ctx.fillStyle = PAGE.muted
    ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'
    ctx.fillText(`上级：${truncateName(payload.parent.name, 22)}`, x, y + 14)
    y += 24
  }

  const shopName = payload.shopName?.trim()
  if (shopName) {
    const logoSize = 40
    drawCard(ctx, x, y, logoSize, logoSize, '#ffffff', 10)
    ctx.save()
    drawRoundRectPath(ctx, x, y, logoSize, logoSize, 10)
    ctx.clip()
    if (bundle.shopLogo?.naturalWidth && bundle.shopLogo.naturalHeight) {
      drawImageCover(ctx, bundle.shopLogo, x, y, logoSize, logoSize)
    } else {
      ctx.fillStyle = PAGE.coverEmpty
      ctx.fillRect(x, y, logoSize, logoSize)
    }
    ctx.restore()

    ctx.fillStyle = PAGE.title
    ctx.font = 'bold 14px system-ui, "Microsoft YaHei", sans-serif'
    const shopLines = wrapLines(ctx, shopName, textW - logoSize - 12)
    let ty = y + 16
    for (const line of shopLines.slice(0, 2)) {
      ctx.fillText(line, x + logoSize + 10, ty)
      ty += 18
    }
    y += Math.max(logoSize, shopLines.length * 18) + 12
  }

  const scoreText = payload.scoreText?.trim()
  if (scoreText) {
    drawCard(ctx, x, y, textW, 34, '#f8efe4', 10)
    ctx.fillStyle = '#b45309'
    ctx.font = 'bold 13px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const label = `★ ${truncateName(scoreText, 28)}`
    ctx.fillText(label, x + 10, y + 17)
    if (payload.scoreCaption?.trim()) {
      const captionX = x + 10 + ctx.measureText(label).width + 8
      drawBadge(
        ctx,
        truncateName(payload.scoreCaption.trim(), 10),
        captionX,
        y + 7,
        'rgba(245, 158, 11, 0.15)',
        '#b45309',
      )
    }
    y += 34 + 12
  }

  if (!payload.skuList?.length) {
    const priceText = payload.priceText?.trim()
    if (priceText) {
      ctx.fillStyle = '#c0567a'
      ctx.font = 'bold 14px system-ui, "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(truncateName(priceText, 32), x, y + 14)
      y += 24
    }
    if (payload.priceRmbText?.trim()) {
      ctx.fillStyle = '#ffaa7f'
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'
      ctx.fillText(payload.priceRmbText.trim(), x, y + 12)
      y += 20
    }
    if (priceText) y += 6
  }

  if (allSkusWithoutCover(payload.skuList)) {
    y = drawInfoSectionInColumn(ctx, x, y, textW, skuInfoSectionForHero(payload.skuList))
  }

  for (const section of payload.infoSections) {
    y = drawInfoSectionInColumn(ctx, x, y, textW, section)
  }

  return y
}

function drawHeroSection(
  ctx: CanvasRenderingContext2D,
  startY: number,
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): number {
  const coverX = P
  const coverY = startY
  const infoContentH = measureHeroInfoColumn(ctx, payload)
  const heroH = Math.max(MAIN_COVER_H, infoContentH + INFO_INNER_PAD * 2)

  drawCoverFrame(ctx, coverX, coverY, MAIN_COVER_W, MAIN_COVER_H, bundle.cover, 16)
  const mainType = payload.libraryType || '图鉴'
  drawWardrobeBadge(
    ctx,
    mainType,
    coverX + 6,
    coverY + 6,
    getWardrobeBadgePalette(mainType, 0),
  )

  const infoX = coverX + MAIN_COVER_W + HERO_GAP
  drawCard(ctx, infoX, coverY, INFO_COL_W, heroH, PAGE.card, 16)
  drawHeroInfoColumn(
    ctx,
    infoX + INFO_INNER_PAD,
    coverY + INFO_INNER_PAD,
    payload,
    bundle,
  )

  return startY + heroH + 24
}

function drawSkuSection(
  ctx: CanvasRenderingContext2D,
  startY: number,
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): number {
  const list = payload.skuList ?? []
  if (!list.length || shouldSkipSkuGrid(list)) return startY

  let y = startY + 8
  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 18px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('版型/参考价', P, y + 20)
  y += 32

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const col = i % SKU_COLS
    const row = Math.floor(i / SKU_COLS)
    const cellX = P + col * (SKU_CELL_W + SKU_GAP)
    const cellY = y + row * (SKU_THUMB_H + SKU_META_H + 8)

    drawCoverFrame(ctx, cellX, cellY, SKU_CELL_W, SKU_THUMB_H, bundle.skuCovers[i], 10)

    if (item.pattern?.trim()) {
      drawWardrobeBadge(
        ctx,
        item.pattern.trim(),
        cellX + 6,
        cellY + 6,
        getWardrobeBadgePalette(item.pattern, i),
      )
    }

    let ty = cellY + SKU_THUMB_H + 10
    if (item.priceText) {
      drawWardrobeBadge(ctx, item.priceText, cellX + 4, ty, WARDROBE_FAV_BADGE, 11)
      ty += 22
    }
    if (item.priceRmbText) {
      ctx.fillStyle = PAGE.muted
      ctx.font = '10px system-ui, "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(item.priceRmbText, cellX + 4, ty + 10)
    }
  }

  const rows = Math.ceil(list.length / SKU_COLS)
  return y + rows * (SKU_THUMB_H + SKU_META_H + 8) + 12
}

function drawChildGridSection(
  ctx: CanvasRenderingContext2D,
  startY: number,
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): number {
  const list = payload.childList ?? []
  if (!list.length) return startY

  let y = startY + 8
  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 18px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`子图鉴（${list.length}）`, P, y + 20)
  y += 32

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const col = i % CHILD_COLS
    const row = Math.floor(i / CHILD_COLS)
    const cellX = P + col * (CHILD_CELL_W + CHILD_GAP)
    const cellY = y + row * (CHILD_THUMB_H + CHILD_NAME_H + 8)

    drawCoverFrame(ctx, cellX, cellY, CHILD_CELL_W, CHILD_THUMB_H, bundle.childList[i], 10)
    const childType = item.libraryType || '图鉴'
    drawWardrobeBadge(
      ctx,
      childType,
      cellX + 4,
      cellY + 4,
      getWardrobeBadgePalette(childType, i),
    )

    ctx.fillStyle = PAGE.title
    ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    const nameLines = wrapLines(ctx, item.name, CHILD_CELL_W - 6)
    let ny = cellY + CHILD_THUMB_H + 14
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, cellX + 3, ny)
      ny += 14
    }
  }

  const rows = Math.ceil(list.length / CHILD_COLS)
  return y + rows * (CHILD_THUMB_H + CHILD_NAME_H + 8) + 12
}

function drawSimilarityScoreBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  thumbX: number,
  thumbY: number,
  thumbW: number,
  thumbH: number,
) {
  const padX = 5
  const h = 16
  ctx.font = 'bold 9px system-ui, "Microsoft YaHei", sans-serif'
  const tw = ctx.measureText(text).width
  const w = tw + padX * 2
  const x = thumbX + thumbW - w - 4
  const y = thumbY + thumbH - h - 4
  drawRoundRectPath(ctx, x, y, w, h, 4)
  ctx.fillStyle = '#525252'
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + h / 2 + 0.5)
}

function drawSimilarSection(
  ctx: CanvasRenderingContext2D,
  startY: number,
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): number {
  const list = (payload.similarList ?? []).slice(0, SIMILAR_MAX)
  if (!list.length) return startY

  let y = startY + 8
  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 18px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('相似推荐', P, y + 20)
  y += 32

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const cellX = P + i * (SIMILAR_CELL_W + SIMILAR_GAP)
    const cellY = y

    drawCoverFrame(ctx, cellX, cellY, SIMILAR_CELL_W, SIMILAR_THUMB_H, bundle.similarCovers[i], 10)

    const simType = item.libraryType || '图鉴'
    drawWardrobeBadge(
      ctx,
      simType,
      cellX + 4,
      cellY + 4,
      getWardrobeBadgePalette(simType, i),
    )

    if (item.similarityText?.trim()) {
      drawSimilarityScoreBadge(
        ctx,
        item.similarityText.trim(),
        cellX,
        cellY,
        SIMILAR_CELL_W,
        SIMILAR_THUMB_H,
      )
    }

    ctx.fillStyle = PAGE.title
    ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    const nameLines = wrapLines(ctx, item.name, SIMILAR_CELL_W - 6)
    let ny = cellY + SIMILAR_THUMB_H + 14
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, cellX + 3, ny)
      ny += 14
    }
    if (item.shopName?.trim()) {
      ctx.fillStyle = PAGE.muted
      ctx.font = '9px system-ui, "Microsoft YaHei", sans-serif'
      ctx.fillText(truncateName(item.shopName.trim(), 14), cellX + 3, ny + 2)
    }
  }

  return y + SIMILAR_THUMB_H + SIMILAR_NAME_H + 8 + 12
}

export function drawLibraryShareCanvas(
  payload: LibrarySharePayload,
  bundle: LibraryShareImageBundle,
): HTMLCanvasElement {
  const H = measurePayloadHeight(payload)
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  drawJapaneseBookPageBackground(ctx, CW, H)

  let y = P
  ctx.fillStyle = PAGE.title
  ctx.font = 'bold 28px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Lo研社 Lolita图鉴', CW / 2, y + 26)
  y += 44

  y = drawHeroSection(ctx, y, payload, bundle)
  y = drawSkuSection(ctx, y, payload, bundle)
  y = drawChildGridSection(ctx, y, payload, bundle)
  y = drawSimilarSection(ctx, y, payload, bundle)

  if (payload.uploadUserName?.trim()) {
    ctx.fillStyle = PAGE.muted
    ctx.font = '13px system-ui, "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`贡献者 ${truncateName(payload.uploadUserName.trim(), 20)}`, CW / 2, y + 16)
    y += 28
  }

  ctx.fillStyle = PAGE.footer
  ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Lo研社 · 图鉴分享', CW / 2, H - P + 4)

  return canvas
}

export function plainTextFromHtml(input: string): string[] {
  const text = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
  if (!text) return []
  return logicalLinesFromText(text)
}
