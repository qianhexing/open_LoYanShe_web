import { BASE_IMG } from '@/utils/ipConfig'
import { loadImageCors } from '@/utils/libraryShareCanvas'

export interface ClothesShareInfoSection {
  key: string
  title: string
  tags?: string[]
  text?: string
  lines?: string[]
}

export interface ClothesShareIncludeItem {
  name: string
  cover: string
  priceText?: string
}

export interface ClothesShareLibraryBlock {
  name: string
  cover: string
  libraryType?: string
  state?: string
  priceText?: string
  tagGroups?: { label: string; tags: string[] }[]
}

export interface ClothesShareSource {
  name: string
  cover: string
  clothesId?: number
  wardrobeName?: string
  favoriteStars?: number
  wardrobeStatus?: string
  infoSections: ClothesShareInfoSection[]
  includeList?: ClothesShareIncludeItem[]
  libraryBlock?: ClothesShareLibraryBlock
  planLines?: string[]
  outfitTotalText?: string
  shopName?: string
  shopLogo?: string
  detailImageList?: string[]
}

export type ClothesSharePayload = Omit<ClothesShareSource, 'infoSections'> & {
  infoSections: ClothesShareInfoSection[]
}

export interface ClothesShareRenderOptions {
  /** 4K 高清：画布宽度 2160px，并加载更高分辨率素材 */
  highQuality?: boolean
}

export const CLOTHES_SHARE_BASE_WIDTH = 750
/** 4K UHD 宽度（相对默认 750 等比缩放） */
export const CLOTHES_SHARE_4K_WIDTH = 2160
export const CLOTHES_SHARE_4K_SCALE = CLOTHES_SHARE_4K_WIDTH / CLOTHES_SHARE_BASE_WIDTH

export const CLOTHES_SHARE_FIELD_META: { key: string; label: string }[] = [
  { key: 'note', label: '笔记' },
  { key: 'favorite', label: '喜爱级别' },
  { key: 'wardrobe_status', label: '拥有状态' },
  { key: 'num', label: '拥有数量' },
  { key: 'main_style', label: '风格' },
  { key: 'price', label: '价格' },
  { key: 'size', label: '尺码' },
  { key: 'times', label: '穿着次数' },
  { key: 'cost_per_wear', label: '次均价格' },
  { key: 'color', label: '颜色' },
  { key: 'clothes_part', label: '部位' },
  { key: 'tags', label: '标签' },
  { key: 'position', label: '收纳' },
  { key: 'season', label: '季节' },
  { key: 'add_time', label: '购入时间' },
  { key: 'origin', label: '来源' },
  { key: 'wardrobe', label: '所属衣柜' },
  { key: 'library', label: '关联图鉴' },
  { key: 'origin_shop', label: '来源店铺' },
  { key: 'plan', label: '尾款计划' },
  { key: 'include', label: '关联服饰' },
  { key: 'detail_images', label: '详情图' },
]

export function getAvailableClothesShareFields(source: ClothesShareSource | null): { key: string; label: string }[] {
  if (!source) return []
  const keys = new Set<string>()
  for (const s of source.infoSections) keys.add(s.key)
  if (source.wardrobeName) keys.add('wardrobe')
  if (source.favoriteStars !== undefined) keys.add('favorite')
  if (source.wardrobeStatus) keys.add('wardrobe_status')
  if (source.includeList?.length) keys.add('include')
  if (source.libraryBlock) keys.add('library')
  if (source.planLines?.length) keys.add('plan')
  if (source.shopName) keys.add('origin_shop')
  if (source.detailImageList?.length) keys.add('detail_images')
  return CLOTHES_SHARE_FIELD_META.filter((m) => keys.has(m.key))
}

export function buildClothesSharePayload(source: ClothesShareSource, selectedKeys: string[]): ClothesSharePayload {
  const keys = new Set(selectedKeys)
  return {
    name: source.name,
    cover: source.cover,
    clothesId: source.clothesId,
    wardrobeName: keys.has('wardrobe') ? source.wardrobeName : undefined,
    favoriteStars: keys.has('favorite') ? source.favoriteStars : undefined,
    wardrobeStatus: keys.has('wardrobe_status') ? source.wardrobeStatus : undefined,
    infoSections: source.infoSections.filter((s) => keys.has(s.key)),
    includeList: keys.has('include') ? source.includeList : undefined,
    libraryBlock: keys.has('library') ? source.libraryBlock : undefined,
    planLines: keys.has('plan') ? source.planLines : undefined,
    outfitTotalText: keys.has('include') ? source.outfitTotalText : undefined,
    shopName: keys.has('origin_shop') ? source.shopName : undefined,
    shopLogo: keys.has('origin_shop') ? source.shopLogo : undefined,
    detailImageList: keys.has('detail_images') ? source.detailImageList : undefined,
  }
}

export interface ClothesShareImageBundle {
  cover: HTMLImageElement | null
  shopLogo: HTMLImageElement | null
  includeCovers: (HTMLImageElement | null)[]
  libraryCover: HTMLImageElement | null
  detailImages: (HTMLImageElement | null)[]
}

/** 服饰分享图：白底、大图、醒目价格 */
const CW = 750
const PAD = 20
const INNER_W = CW - PAD * 2
const FOOTER_H = 40
const HERO_H = Math.round(INNER_W * (3 / 4))
const SECTION_GAP = 14
const CHIP_GAP = 8
const CHIP_H = 30
const DETAIL_LABEL_W = 92
const DETAIL_ROW_PAD = 10
const DEFAULT_COVER = 'static/plan_cover/default.jpg'

const INCLUDE_COLS = 4
const INCLUDE_GAP = 8
const INCLUDE_CELL_W = (INNER_W - INCLUDE_GAP * (INCLUDE_COLS - 1)) / INCLUDE_COLS
const INCLUDE_THUMB_H = Math.round(INCLUDE_CELL_W * (4 / 3))
const INCLUDE_NAME_H = 28
const INCLUDE_MAX = 8

/** 详情图缩略图：与详情页关联服饰封面一致，1:1 方图 */
const DETAIL_IMAGE_COLS = INCLUDE_COLS
const DETAIL_IMAGE_GAP = INCLUDE_GAP
const DETAIL_IMAGE_CELL_W = INCLUDE_CELL_W
const DETAIL_IMAGE_THUMB_H = INCLUDE_CELL_W
const DETAIL_IMAGE_MAX = 12

const COLOR_SWATCH_SIZE = 28
const COLOR_SWATCH_GAP = 8
const COLOR_SWATCH_BORDER = '#D1D5DB'

const SHARE = {
  bg: '#FFFFFF',
  grayBg: '#F5F5F5',
  accent: '#ec4899',
  price: '#FF4F00',
  title: '#222222',
  body: '#444444',
  muted: '#999999',
  border: '#EEEEEE',
  chipBg: 'rgba(236, 72, 153, 0.08)',
  chipBorder: 'rgba(236, 72, 153, 0.22)',
  noteBg: '#F7F7F7',
  coverEmpty: '#EFEFEF',
}

const DETAIL_SKIP_KEYS = new Set(['price', 'note', 'size', 'color', 'times', 'num', 'main_style', 'cost_per_wear'])

/** 与详情页铭牌排版一致的衬线字体栈 */
const SHARE_FONT_FAMILY =
  'Georgia, "Times New Roman", "Songti SC", "STSong", "Microsoft YaHei", serif'

function shareFont(size: number, weight: 'normal' | 'bold' = 'normal'): string {
  return weight === 'bold' ? `bold ${size}px ${SHARE_FONT_FAMILY}` : `${size}px ${SHARE_FONT_FAMILY}`
}

function contentX(): number {
  return PAD
}

function resolveImgUrl(path: string | null | undefined, resize = 600): string {
  const p = (path?.trim() || DEFAULT_COVER).trim()
  if (/^https?:\/\//i.test(p)) return p
  const rel = p.replace(/^\//, '')
  return `${BASE_IMG}${rel}?x-oss-process=image/quality,q_85/resize,w_${resize}`
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

function drawRoundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
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
  bg = SHARE.grayBg,
) {
  ctx.save()
  drawRoundRectPath(ctx, x, y, w, h, radius)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.clip()
  if (img?.naturalWidth && img.naturalHeight) {
    drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = SHARE.coverEmpty
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
  ctx.strokeStyle = SHARE.border
  ctx.lineWidth = 1
  drawRoundRectPath(ctx, x, y, w, h, radius)
  ctx.stroke()
}

function measureMultilineBlock(ctx: CanvasRenderingContext2D, lines: string[], innerW: number, lineHeight = 22): number {
  ctx.font = shareFont(14)
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
  lineHeight = 22,
  color = SHARE.body,
): number {
  let curY = y
  ctx.fillStyle = color
  ctx.font = shareFont(14)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const line of lines) {
    if (!line) continue
    for (const wrapped of wrapLines(ctx, line, innerW)) {
      ctx.fillText(wrapped, x, curY + 16)
      curY += lineHeight
    }
  }
  return curY + 4
}

function findSection(payload: ClothesSharePayload, key: string): ClothesShareInfoSection | undefined {
  return payload.infoSections.find((s) => s.key === key)
}

function sectionDisplayText(section: ClothesShareInfoSection): string {
  if (section.text?.trim()) return section.text.trim()
  if (section.tags?.length) return section.tags.join(' · ')
  if (section.lines?.length) return section.lines.join('\n')
  return ''
}

function extractPriceText(payload: ClothesSharePayload): string | undefined {
  const section = findSection(payload, 'price')
  if (!section) return undefined
  const raw = sectionDisplayText(section)
  if (!raw) return undefined
  const num = raw.replace(/[^\d.]/g, '')
  if (num) return `¥${num}`
  return raw.startsWith('¥') || raw.startsWith('￥') ? raw.replace('￥', '¥') : raw
}

interface SpecChip {
  label: string
  value: string
}

function buildSpecChips(payload: ClothesSharePayload): SpecChip[] {
  const chips: SpecChip[] = []
  for (const key of ['size', 'times', 'num', 'main_style'] as const) {
    const section = findSection(payload, key)
    if (!section) continue
    const value = sectionDisplayText(section)
    if (!value) continue
    chips.push({ label: section.title, value: truncateName(value, 16) })
  }
  return chips
}

function getColorValues(payload: ClothesSharePayload): string[] {
  const section = findSection(payload, 'color')
  if (!section?.tags?.length) return []
  return section.tags.map((c) => c.trim()).filter(Boolean)
}

function measureColorSwatchRows(colors: string[], maxW: number): number {
  if (!colors.length) return 0
  const perRow = Math.max(1, Math.floor((maxW + COLOR_SWATCH_GAP) / (COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP)))
  const rows = Math.ceil(colors.length / perRow)
  return rows * COLOR_SWATCH_SIZE + (rows - 1) * COLOR_SWATCH_GAP
}

function drawColorSwatch(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  size = COLOR_SWATCH_SIZE,
): void {
  const r = size / 2
  const cx = x + r
  const cy = y + r
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
  ctx.fillStyle = color.trim()
  ctx.fill()
  ctx.strokeStyle = COLOR_SWATCH_BORDER
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawColorSwatchRows(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  x: number,
  y: number,
  maxW: number,
): number {
  if (!colors.length) return y
  let cx = x
  let cy = y
  for (const color of colors) {
    if (cx > x && cx + COLOR_SWATCH_SIZE > x + maxW) {
      cx = x
      cy += COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP
    }
    drawColorSwatch(ctx, color, cx, cy)
    cx += COLOR_SWATCH_SIZE + COLOR_SWATCH_GAP
  }
  return cy + COLOR_SWATCH_SIZE
}

function measureColorSpecRow(ctx: CanvasRenderingContext2D, colors: string[], maxW: number): number {
  if (!colors.length) return 0
  ctx.font = shareFont(13)
  const labelW = ctx.measureText('颜色').width + 10
  const swatchH = measureColorSwatchRows(colors, maxW - labelW)
  return Math.max(20, swatchH) + SECTION_GAP
}

function drawColorSpecRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: string[],
  maxW: number,
): number {
  if (!colors.length) return y
  ctx.fillStyle = SHARE.muted
  ctx.font = shareFont(13)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('颜色', x, y + 16)
  const labelW = ctx.measureText('颜色').width + 10
  const swatchY = y + Math.max(0, (20 - COLOR_SWATCH_SIZE) / 2)
  drawColorSwatchRows(ctx, colors, x + labelW, swatchY, maxW - labelW)
  return y + Math.max(20, COLOR_SWATCH_SIZE) + SECTION_GAP
}

function getDetailSections(payload: ClothesSharePayload): ClothesShareInfoSection[] {
  return payload.infoSections.filter((s) => !DETAIL_SKIP_KEYS.has(s.key))
}

function getTopLevelDetailSections(payload: ClothesSharePayload): ClothesShareInfoSection[] {
  const sections: ClothesShareInfoSection[] = []
  if (payload.wardrobeStatus?.trim()) {
    sections.push({ key: 'wardrobe_status', title: '拥有状态', text: payload.wardrobeStatus.trim() })
  }
  if (payload.favoriteStars !== undefined && payload.favoriteStars > 0) {
    sections.push({ key: 'favorite', title: '喜爱级别', text: `${payload.favoriteStars} 星` })
  }
  if (payload.wardrobeName?.trim()) {
    sections.push({ key: 'wardrobe', title: '所属衣柜', text: payload.wardrobeName.trim() })
  }
  return sections
}

function getAllDetailSections(payload: ClothesSharePayload): ClothesShareInfoSection[] {
  return [...getTopLevelDetailSections(payload), ...getDetailSections(payload)]
}

function measureTagChipRows(ctx: CanvasRenderingContext2D, tags: string[], maxW: number): number {
  if (!tags.length) return 0
  ctx.font = shareFont(12)
  const padX = 10
  const gap = 6
  const rowH = CHIP_H
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
  return rows * rowH + (rows - 1) * CHIP_GAP
}

function drawSpecChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  const padX = 10
  ctx.font = shareFont(12)
  const tw = ctx.measureText(text).width
  const w = tw + padX * 2
  drawRoundRectPath(ctx, x, y, w, CHIP_H, CHIP_H / 2)
  ctx.fillStyle = SHARE.chipBg
  ctx.fill()
  ctx.strokeStyle = SHARE.chipBorder
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = SHARE.title
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + CHIP_H / 2 + 0.5)
  return w
}

function drawSpecChipRows(ctx: CanvasRenderingContext2D, chips: SpecChip[], x: number, y: number, maxW: number): number {
  if (!chips.length) return y
  const gap = CHIP_GAP
  let cx = x
  let cy = y
  for (const chip of chips) {
    const label = `${chip.label} ${chip.value}`
    const padX = 10
    ctx.font = shareFont(12)
    const tw = ctx.measureText(label).width + padX * 2
    if (cx > x && cx + tw > x + maxW) {
      cx = x
      cy += CHIP_H + gap
    }
    drawSpecChip(ctx, label, cx, cy)
    cx += tw + gap
  }
  return cy + CHIP_H
}

function measureSpecChips(ctx: CanvasRenderingContext2D, chips: SpecChip[]): number {
  if (!chips.length) return 0
  const labels = chips.map((c) => `${c.label} ${c.value}`)
  return measureTagChipRows(ctx, labels, INNER_W) + SECTION_GAP
}

function measureTitleBlock(ctx: CanvasRenderingContext2D, payload: ClothesSharePayload): number {
  ctx.font = shareFont(22, 'bold')
  const lines = wrapLines(ctx, payload.name.trim(), INNER_W).slice(0, 2)
  return lines.length * 30 + 8
}

function measurePriceBlock(payload: ClothesSharePayload): number {
  return extractPriceText(payload) ? 52 : 0
}

function measureNoteBlock(ctx: CanvasRenderingContext2D, payload: ClothesSharePayload): number {
  const section = findSection(payload, 'note')
  if (!section) return 0
  const lines = section.lines ?? (section.text ? [section.text] : [])
  if (!lines.length) return 0
  const innerW = INNER_W - 24
  return 36 + measureMultilineBlock(ctx, lines, innerW) + 16 + SECTION_GAP
}

function measureDetailRow(ctx: CanvasRenderingContext2D, section: ClothesShareInfoSection, rowW: number): number {
  const valueW = rowW - DETAIL_LABEL_W - 16
  let h = DETAIL_ROW_PAD
  if (section.key === 'color' && section.tags?.length) {
    h += measureColorSwatchRows(section.tags, valueW) + DETAIL_ROW_PAD
  } else if (section.tags?.length) {
    h += measureTagChipRows(ctx, section.tags, valueW) + DETAIL_ROW_PAD
  } else if (section.lines?.length) {
    h += measureMultilineBlock(ctx, section.lines, valueW) - 4 + DETAIL_ROW_PAD
  } else if (section.text) {
    h += measureMultilineBlock(ctx, [section.text], valueW) - 4 + DETAIL_ROW_PAD
  } else {
    h += 24
  }
  return h + 8
}

function measureDetailBlock(ctx: CanvasRenderingContext2D, payload: ClothesSharePayload): number {
  const sections = getAllDetailSections(payload)
  if (!sections.length) return 0
  let h = 40 + SECTION_GAP
  for (const section of sections) {
    h += measureDetailRow(ctx, section, INNER_W)
  }
  return h
}

function measureShopBlock(payload: ClothesSharePayload): number {
  if (!payload.shopName?.trim()) return 0
  return 8 + 52 + SECTION_GAP
}

function measureLibraryBlock(payload: ClothesSharePayload): number {
  if (!payload.libraryBlock) return 0
  return 8 + 40 + 72 + SECTION_GAP
}

function measurePlanBlock(payload: ClothesSharePayload): number {
  if (!payload.planLines?.length) return 0
  return 8 + 40 + payload.planLines.length * 22 + SECTION_GAP
}

function measureIncludeSection(payload: ClothesSharePayload): number {
  const list = payload.includeList ?? []
  if (!list.length) return 0
  const count = Math.min(list.length, INCLUDE_MAX)
  const rows = Math.ceil(count / INCLUDE_COLS)
  let h = 8 + 40
  if (payload.outfitTotalText) h += 24
  h += rows * (INCLUDE_THUMB_H + INCLUDE_NAME_H + 8) + SECTION_GAP
  return h
}

function measureDetailImageSection(payload: ClothesSharePayload): number {
  const list = payload.detailImageList ?? []
  if (!list.length) return 0
  const count = Math.min(list.length, DETAIL_IMAGE_MAX)
  const rows = Math.ceil(count / DETAIL_IMAGE_COLS)
  return 8 + 40 + rows * (DETAIL_IMAGE_THUMB_H + 8) + SECTION_GAP
}

function measurePayloadHeight(payload: ClothesSharePayload): number {
  const mc = document.createElement('canvas')
  const ctx = mc.getContext('2d')
  if (!ctx) return 1000
  const chips = buildSpecChips(payload)
  const colors = getColorValues(payload)
  const bodyH =
    HERO_H +
    SECTION_GAP +
    measureTitleBlock(ctx, payload) +
    measurePriceBlock(payload) +
    measureSpecChips(ctx, chips) +
    measureColorSpecRow(ctx, colors, INNER_W) +
    measureNoteBlock(ctx, payload) +
    measureDetailBlock(ctx, payload) +
    measureShopBlock(payload) +
    measureLibraryBlock(payload) +
    measurePlanBlock(payload) +
    measureIncludeSection(payload) +
    measureDetailImageSection(payload) +
    FOOTER_H +
    PAD
  return Math.max(720, bodyH)
}

export async function prepareClothesShareImages(
  payload: ClothesSharePayload,
  options?: ClothesShareRenderOptions,
): Promise<ClothesShareImageBundle> {
  const hq = options?.highQuality === true
  const coverResize = hq ? 3840 : 1080
  const thumbResize = hq ? 800 : 300
  const logoResize = hq ? 512 : 200
  const cover = await loadImageCors(resolveImgUrl(payload.cover, coverResize))
  const shopLogo = payload.shopLogo ? await loadImageCors(resolveImgUrl(payload.shopLogo, logoResize)) : null
  const includeCovers = await Promise.all(
    (payload.includeList ?? []).slice(0, INCLUDE_MAX).map((item) => loadImageCors(resolveImgUrl(item.cover, thumbResize))),
  )
  const libraryCover = payload.libraryBlock?.cover
    ? await loadImageCors(resolveImgUrl(payload.libraryBlock.cover, thumbResize))
    : null
  const detailImages = await Promise.all(
    (payload.detailImageList ?? []).slice(0, DETAIL_IMAGE_MAX).map((src) => loadImageCors(resolveImgUrl(src, thumbResize))),
  )
  return { cover, shopLogo, includeCovers, libraryCover, detailImages }
}

function drawShareBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = SHARE.bg
  ctx.fillRect(0, 0, w, h)
}

function drawShareFooter(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = SHARE.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(CW - PAD, y)
  ctx.stroke()
  ctx.fillStyle = SHARE.muted
  ctx.font = shareFont(11)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('由 Lo研社 生成 · 仅供参考', CW / 2, y + FOOTER_H / 2 + 1)
}

function drawHeroImage(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
): number {
  const x = contentX()
  drawCoverFrame(ctx, x, y, INNER_W, HERO_H, bundle.cover, 12, SHARE.grayBg)

  return y + HERO_H + SECTION_GAP
}

function drawTitleBlock(ctx: CanvasRenderingContext2D, y: number, payload: ClothesSharePayload): number {
  ctx.fillStyle = SHARE.title
  ctx.font = shareFont(22, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let cy = y
  for (const line of wrapLines(ctx, payload.name.trim(), INNER_W).slice(0, 2)) {
    ctx.fillText(line, contentX(), cy + 24)
    cy += 30
  }
  return cy + 8
}

function drawPriceBlock(ctx: CanvasRenderingContext2D, y: number, payload: ClothesSharePayload): number {
  const price = extractPriceText(payload)
  if (!price) return y
  ctx.fillStyle = SHARE.price
  ctx.font = shareFont(36, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(price, contentX(), y + 36)
  const costSection = findSection(payload, 'cost_per_wear')
  if (costSection) {
    const costText = sectionDisplayText(costSection)
    if (costText) {
      ctx.fillStyle = SHARE.muted
      ctx.font = shareFont(13)
      ctx.fillText(`次均 ${costText.replace('￥', '¥')}`, contentX(), y + 56)
    }
  }
  return y + 52
}

function drawNoteBlock(ctx: CanvasRenderingContext2D, y: number, payload: ClothesSharePayload): number {
  const section = findSection(payload, 'note')
  if (!section) return y
  const lines = section.lines ?? (section.text ? [section.text] : [])
  if (!lines.length) return y
  const x = contentX()
  const boxPad = 12
  const innerW = INNER_W - boxPad * 2
  const textH = measureMultilineBlock(ctx, lines, innerW)
  const boxH = textH + boxPad * 2

  ctx.fillStyle = SHARE.noteBg
  drawRoundRectPath(ctx, x, y, INNER_W, boxH, 10)
  ctx.fill()

  ctx.fillStyle = SHARE.title
  ctx.font = shareFont(14, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('笔记', x + boxPad, y + 22)

  drawMultilineBlock(ctx, x + boxPad, y + 32, lines, innerW, 22, SHARE.body)
  return y + boxH + SECTION_GAP
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, x: number, y: number, title: string): number {
  ctx.fillStyle = SHARE.title
  ctx.font = shareFont(15, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(title, x, y + 18)
  ctx.fillStyle = SHARE.accent
  ctx.fillRect(x, y + 24, 36, 4)
  return y + 36
}

function drawDetailRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  startY: number,
  rowW: number,
  section: ClothesShareInfoSection,
): number {
  const valueX = x + DETAIL_LABEL_W + 12
  const valueW = rowW - DETAIL_LABEL_W - 12
  const rowStartY = startY + DETAIL_ROW_PAD

  ctx.fillStyle = SHARE.muted
  ctx.font = shareFont(13)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(truncateName(section.title, 8), x, rowStartY + 16)

  let contentY = rowStartY
  if (section.key === 'color' && section.tags?.length) {
    contentY = drawColorSwatchRows(ctx, section.tags, valueX, contentY, valueW)
  } else if (section.tags?.length) {
    let cx = valueX
    let cy = contentY
    for (const tag of section.tags) {
      const padX = 10
      ctx.font = shareFont(12)
      const tw = ctx.measureText(tag).width + padX * 2
      if (cx > valueX && cx + tw > valueX + valueW) {
        cx = valueX
        cy += CHIP_H + CHIP_GAP
      }
      drawSpecChip(ctx, tag, cx, cy)
      cx += tw + CHIP_GAP
    }
    contentY = cy + CHIP_H
  } else if (section.lines?.length) {
    contentY = drawMultilineBlock(ctx, valueX, contentY, section.lines, valueW)
  } else if (section.text) {
    contentY = drawMultilineBlock(ctx, valueX, contentY, [section.text], valueW)
  }

  const rowBottom = Math.max(rowStartY + 24, contentY) + DETAIL_ROW_PAD
  ctx.strokeStyle = SHARE.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, rowBottom)
  ctx.lineTo(x + rowW, rowBottom)
  ctx.stroke()
  return rowBottom + 1
}

function drawDetailBlock(ctx: CanvasRenderingContext2D, y: number, payload: ClothesSharePayload): number {
  const sections = getAllDetailSections(payload)
  if (!sections.length) return y
  let cy = drawSectionTitle(ctx, contentX(), y + 8, '详细信息')
  const x = contentX()
  for (const section of sections) {
    cy = drawDetailRow(ctx, x, cy, INNER_W, section)
  }
  return cy + SECTION_GAP
}

function drawShopBlock(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
): number {
  if (!payload.shopName?.trim()) return y
  const x = contentX()
  const cy = drawSectionTitle(ctx, x, y + 8, '来源店铺')
  const logoSize = 44
  drawCoverFrame(ctx, x, cy, logoSize, logoSize, bundle.shopLogo, 8, SHARE.bg)
  ctx.fillStyle = SHARE.title
  ctx.font = shareFont(15, 'bold')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncateName(payload.shopName.trim(), 28), x + logoSize + 12, cy + logoSize / 2 + 1)
  return cy + logoSize + SECTION_GAP
}

function drawLibraryBlock(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
): number {
  const block = payload.libraryBlock
  if (!block) return y
  const x = contentX()
  let cy = drawSectionTitle(ctx, x, y + 8, '关联图鉴')
  const thumb = 64
  drawCoverFrame(ctx, x, cy, thumb, thumb, bundle.libraryCover, 10, SHARE.grayBg)
  let ty = cy + 6
  const textX = x + thumb + 12
  const textW = INNER_W - thumb - 12
  ctx.fillStyle = SHARE.title
  ctx.font = shareFont(14, 'bold')
  ctx.textAlign = 'left'
  for (const line of wrapLines(ctx, block.name, textW).slice(0, 2)) {
    ctx.fillText(line, textX, ty + 14)
    ty += 20
  }
  if (block.libraryType) {
    drawSpecChip(ctx, block.libraryType, textX, ty)
    ty += CHIP_H + 6
  }
  if (block.state) {
    ctx.fillStyle = SHARE.muted
    ctx.font = shareFont(12)
    ctx.fillText(`状态 ${block.state}`, textX, ty + 14)
    ty += 20
  }
  if (block.priceText) {
    ctx.fillStyle = SHARE.price
    ctx.font = shareFont(13, 'bold')
    ctx.fillText(block.priceText.replace('￥', '¥'), textX, ty + 14)
    ty += 20
  }
  cy += Math.max(thumb, ty - cy) + SECTION_GAP
  return cy
}

function drawPlanBlock(ctx: CanvasRenderingContext2D, y: number, payload: ClothesSharePayload): number {
  const lines = payload.planLines ?? []
  if (!lines.length) return y
  const x = contentX()
  let cy = drawSectionTitle(ctx, x, y + 8, '尾款计划')
  ctx.fillStyle = SHARE.body
  ctx.font = shareFont(14)
  ctx.textAlign = 'left'
  for (const line of lines) {
    ctx.fillText(line, x, cy + 16)
    cy += 22
  }
  return cy + SECTION_GAP
}

function drawIncludeSection(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
): number {
  const list = (payload.includeList ?? []).slice(0, INCLUDE_MAX)
  if (!list.length) return y
  const x = contentX()
  let cy = drawSectionTitle(ctx, x, y + 8, '关联服饰')
  if (payload.outfitTotalText?.trim()) {
    ctx.fillStyle = SHARE.price
    ctx.font = shareFont(14, 'bold')
    ctx.textAlign = 'left'
    ctx.fillText(payload.outfitTotalText.trim().replace(/￥/g, '¥'), x, cy + 16)
    cy += 24
  }
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const col = i % INCLUDE_COLS
    const row = Math.floor(i / INCLUDE_COLS)
    const cellX = x + col * (INCLUDE_CELL_W + INCLUDE_GAP)
    const cellY = cy + row * (INCLUDE_THUMB_H + INCLUDE_NAME_H + 8)
    drawCoverFrame(ctx, cellX, cellY, INCLUDE_CELL_W, INCLUDE_THUMB_H, bundle.includeCovers[i], 8, SHARE.grayBg)
    ctx.fillStyle = SHARE.title
    ctx.font = shareFont(11)
    ctx.textAlign = 'left'
    const nameLines = wrapLines(ctx, item.name, INCLUDE_CELL_W - 4)
    let ny = cellY + INCLUDE_THUMB_H + 12
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, cellX + 2, ny)
      ny += 12
    }
    if (item.priceText) {
      ctx.fillStyle = SHARE.price
      ctx.font = shareFont(10, 'bold')
      ctx.fillText(item.priceText.replace('￥', '¥'), cellX + 2, ny + 2)
    }
  }
  const rows = Math.ceil(list.length / INCLUDE_COLS)
  return cy + rows * (INCLUDE_THUMB_H + INCLUDE_NAME_H + 8) + SECTION_GAP
}

function drawDetailImageSection(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
): number {
  const list = (payload.detailImageList ?? []).slice(0, DETAIL_IMAGE_MAX)
  if (!list.length) return y
  const x = contentX()
  const cy = drawSectionTitle(ctx, x, y + 8, '详情图')
  for (let i = 0; i < list.length; i++) {
    const col = i % DETAIL_IMAGE_COLS
    const row = Math.floor(i / DETAIL_IMAGE_COLS)
    const cellX = x + col * (DETAIL_IMAGE_CELL_W + DETAIL_IMAGE_GAP)
    const cellY = cy + row * (DETAIL_IMAGE_THUMB_H + 8)
    drawCoverFrame(ctx, cellX, cellY, DETAIL_IMAGE_CELL_W, DETAIL_IMAGE_THUMB_H, bundle.detailImages[i], 8, SHARE.grayBg)
  }
  const rows = Math.ceil(list.length / DETAIL_IMAGE_COLS)
  return cy + rows * (DETAIL_IMAGE_THUMB_H + 8) + SECTION_GAP
}

export function drawClothesShareCanvas(
  payload: ClothesSharePayload,
  bundle: ClothesShareImageBundle,
  options?: ClothesShareRenderOptions,
): HTMLCanvasElement {
  const scale = options?.highQuality ? CLOTHES_SHARE_4K_SCALE : 1
  const H = measurePayloadHeight(payload)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CW * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  if (scale !== 1) {
    ctx.scale(scale, scale)
  }

  drawShareBackground(ctx, CW, H)

  let y = PAD
  y = drawHeroImage(ctx, y, payload, bundle)
  y = drawTitleBlock(ctx, y, payload)
  y = drawPriceBlock(ctx, y, payload)

  const chips = buildSpecChips(payload)
  if (chips.length) {
    y = drawSpecChipRows(ctx, chips, contentX(), y, INNER_W) + SECTION_GAP
  }

  const colors = getColorValues(payload)
  if (colors.length) {
    y = drawColorSpecRow(ctx, contentX(), y, colors, INNER_W)
  }

  y = drawNoteBlock(ctx, y, payload)
  y = drawDetailBlock(ctx, y, payload)
  y = drawShopBlock(ctx, y, payload, bundle)
  y = drawLibraryBlock(ctx, y, payload, bundle)
  y = drawPlanBlock(ctx, y, payload)
  y = drawIncludeSection(ctx, y, payload, bundle)
  y = drawDetailImageSection(ctx, y, payload, bundle)

  drawShareFooter(ctx, H - FOOTER_H - PAD / 2)
  return canvas
}
