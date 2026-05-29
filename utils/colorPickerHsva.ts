/** HSVA：h 0–360，s/v/a 0–1 */
export type Hsva = {
  h: number
  s: number
  v: number
  a: number
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function clampHue(h: number): number {
  const n = h % 360
  return n < 0 ? n + 360 : n
}

export function hsvaToRgb(hsva: Hsva): { r: number; g: number; b: number } {
  const h = clampHue(hsva.h)
  const s = clamp01(hsva.s)
  const v = clamp01(hsva.v)
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) {
    rp = c
    gp = x
  } else if (h < 120) {
    rp = x
    gp = c
  } else if (h < 180) {
    gp = c
    bp = x
  } else if (h < 240) {
    gp = x
    bp = c
  } else if (h < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255)
  }
}

export function rgbToHsva(r: number, g: number, b: number, a = 1, fallbackHue = 0): Hsva {
  const rn = clamp01(r / 255)
  const gn = clamp01(g / 255)
  const bn = clamp01(b / 255)
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = fallbackHue
  if (d > 1e-10) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max <= 1e-10 ? 0 : d / max
  const v = max
  return { h: clampHue(h), s, v, a: clamp01(a) }
}

function componentToHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0')
}

export function hsvaToHex(hsva: Hsva, includeAlpha: boolean): string {
  const { r, g, b } = hsvaToRgb(hsva)
  const hex = `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
  if (!includeAlpha) return hex.toUpperCase()
  const a = componentToHex(hsva.a * 255)
  return `${hex}${a}`.toUpperCase()
}

export function parseColorInput(raw: string | null | undefined, fallbackHue = 0): Hsva | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null

  if (!s.startsWith('#') && /^[0-9a-fA-F]{3,8}$/.test(s)) {
    s = `#${s}`
  }

  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (!/^[0-9a-fA-F]{3,8}$/.test(hex)) return null
    let r = 0
    let g = 0
    let b = 0
    let a = 255
    if (hex.length === 3 || hex.length === 4) {
      r = Number.parseInt(hex[0] + hex[0], 16)
      g = Number.parseInt(hex[1] + hex[1], 16)
      b = Number.parseInt(hex[2] + hex[2], 16)
      if (hex.length === 4) a = Number.parseInt(hex[3] + hex[3], 16)
    } else if (hex.length === 6 || hex.length === 8) {
      r = Number.parseInt(hex.slice(0, 2), 16)
      g = Number.parseInt(hex.slice(2, 4), 16)
      b = Number.parseInt(hex.slice(4, 6), 16)
      if (hex.length === 8) a = Number.parseInt(hex.slice(6, 8), 16)
    } else {
      return null
    }
    return rgbToHsva(r, g, b, a / 255, fallbackHue)
  }

  const rgbMatch = s.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
  )
  if (rgbMatch) {
    const r = Number(rgbMatch[1])
    const g = Number(rgbMatch[2])
    const b = Number(rgbMatch[3])
    let a = 1
    if (rgbMatch[4] != null) {
      const alphaRaw = rgbMatch[4].trim()
      a = alphaRaw.endsWith('%') ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw)
    }
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null
    return rgbToHsva(r, g, b, a, fallbackHue)
  }

  return null
}

export function normalizeHexOutput(hex: string, includeAlpha: boolean): string {
  const parsed = parseColorInput(hex)
  if (!parsed) return includeAlpha ? '#000000FF' : '#000000'
  return hsvaToHex(parsed, includeAlpha)
}

/** 将 client 坐标映射到 0–1，支持在元素外拖动 */
export function clientToRatio(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  axis: 'x' | 'y' | 'xy'
): { x: number; y: number } {
  const x = clamp01((clientX - rect.left) / Math.max(rect.width, 1))
  const y = clamp01((clientY - rect.top) / Math.max(rect.height, 1))
  if (axis === 'x') return { x, y: 0 }
  if (axis === 'y') return { x: 0, y }
  return { x, y }
}
