import type { LaxianItem } from '@/types/api'

/** 2D 人台图标点：position = [归一化 x, 归一化 y, 图片下标] */
export const LAXIAN_2D_TYPE_THEME = {
  0: {
    dot: 'rgba(147, 51, 234, 0.85)',
    ring: 'rgba(147, 51, 234, 0.35)',
    label: '设计元素',
  },
  1: {
    dot: 'rgba(20, 184, 166, 0.85)',
    ring: 'rgba(20, 184, 166, 0.35)',
    label: '柄图元素',
  },
} as const

export function getLaxian2dImageIndex(item: LaxianItem): number {
  const idx = item.position?.[2]
  return Number.isFinite(idx) ? Math.max(0, Math.round(idx as number)) : 0
}

export function getLaxian2dNormPos(item: LaxianItem): { x: number; y: number } {
  return {
    x: clamp01(item.position?.[0] ?? 0),
    y: clamp01(item.position?.[1] ?? 0),
  }
}

export function setLaxian2dPosition(
  item: LaxianItem,
  x: number,
  y: number,
  imageIndex: number,
): LaxianItem {
  return {
    ...item,
    position: [clamp01(x), clamp01(y), imageIndex],
  }
}

export function filterLaxianByImageIndex(list: LaxianItem[], imageIndex: number): LaxianItem[] {
  return list.filter((item) => getLaxian2dImageIndex(item) === imageIndex)
}

export function normalizeLaxian2dList(raw: unknown): LaxianItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const src = item as LaxianItem
      const pos = src.position
      return {
        ...src,
        type: src.type === 1 ? 1 : 0,
        position: pos && pos.length >= 2
          ? [clamp01(pos[0]), clamp01(pos[1]), Number.isFinite(pos[2]) ? Math.max(0, Math.round(pos[2])) : 0] as [number, number, number]
          : [0.5, 0.5, 0] as [number, number, number],
      }
    })
}

export interface ImageContentRect {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

/** object-contain 下图片实际绘制区域（相对容器） */
export function computeImageContentRect(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageContentRect {
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
    return { offsetX: 0, offsetY: 0, width: containerWidth, height: containerHeight }
  }
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  return {
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2,
    width,
    height,
  }
}

export function normToPixel(
  normX: number,
  normY: number,
  rect: ImageContentRect,
): { x: number; y: number } {
  return {
    x: rect.offsetX + clamp01(normX) * rect.width,
    y: rect.offsetY + clamp01(normY) * rect.height,
  }
}

export function pixelToNorm(
  pixelX: number,
  pixelY: number,
  rect: ImageContentRect,
): { x: number; y: number } | null {
  if (!rect.width || !rect.height) return null
  const x = (pixelX - rect.offsetX) / rect.width
  const y = (pixelY - rect.offsetY) / rect.height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function drawLaxian2dMarkers(
  ctx: CanvasRenderingContext2D,
  list: LaxianItem[],
  rect: ImageContentRect,
  selectedId?: string | null,
  /** 图片 CSS scale，传入后圆点视觉尺寸不随缩放变化 */
  imageScale = 1,
) {
  const s = imageScale > 0 ? imageScale : 1
  for (const item of list) {
    const { x, y } = getLaxian2dNormPos(item)
    const { x: px, y: py } = normToPixel(x, y, rect)
    const theme = LAXIAN_2D_TYPE_THEME[item.type === 1 ? 1 : 0]
    const selected = Boolean(selectedId && item.laxian_id === selectedId)

    ctx.beginPath()
    ctx.arc(px, py, (selected ? 10 : 7) / s, 0, Math.PI * 2)
    ctx.fillStyle = theme.ring
    ctx.fill()

    ctx.beginPath()
    ctx.arc(px, py, 5 / s, 0, Math.PI * 2)
    ctx.strokeStyle = theme.dot
    ctx.lineWidth = (selected ? 3 : 2) / s
    ctx.stroke()
  }
}
