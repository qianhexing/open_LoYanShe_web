import { BASE_IMG } from '@/utils/ipConfig'

/** img_list 中 `.mp4` 表示 Live；默认展示同名 `.jpg`，交互再播视频 */
export type CommunityMediaKind = 'image' | 'live'

export interface CommunityMediaItem {
  kind: CommunityMediaKind
  /** img_list 原始片段 */
  rawPath: string
  /** 展示用相对路径（Live 为同名 .jpg） */
  displayPath: string
  /** Live 视频相对路径（无 query） */
  videoPath?: string
}

const MP4_EXT_RE = /\.mp4$/i

/** 去掉 query / hash，便于判后缀 */
export function stripMediaQuery(path: string): string {
  const s = path.trim()
  const i = s.search(/[?#]/)
  return i >= 0 ? s.slice(0, i) : s
}

/** 去掉历史域名或 CDN 前缀，得到相对路径 */
export function normalizeRawImgPath(path: string): string {
  return path
    .trim()
    .replace(/^https?:\/\/www\.lolitalibrary\.com\/ali\//i, '')
    .replace(/^https?:\/\/image\.lolitalibrary\.com\//i, '')
    .replace(/^\/+/, '')
}

export function isCommunityLivePath(path: string): boolean {
  return MP4_EXT_RE.test(stripMediaQuery(normalizeRawImgPath(path)))
}

/**
 * Live：`.mp4` → 同名 `.jpg`（保留原 query/hash，若有）
 * 非 Live：原样返回
 */
export function toCommunityLivePosterPath(path: string): string {
  const trimmed = normalizeRawImgPath(path)
  const qIndex = trimmed.search(/[?#]/)
  const base = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed
  const suffix = qIndex >= 0 ? trimmed.slice(qIndex) : ''
  if (!MP4_EXT_RE.test(base)) return trimmed
  return `${base.replace(/\.mp4$/i, '.jpg')}${suffix}`
}

export function normalizeCommunityMediaPath(path: string): CommunityMediaItem {
  const rawPath = normalizeRawImgPath(path)
  if (isCommunityLivePath(rawPath)) {
    const videoPath = stripMediaQuery(rawPath)
    return {
      kind: 'live',
      rawPath,
      displayPath: toCommunityLivePosterPath(rawPath),
      videoPath,
    }
  }
  return {
    kind: 'image',
    rawPath,
    displayPath: rawPath,
  }
}

export function parseCommunityImgList(raw: string | null | undefined): CommunityMediaItem[] {
  if (raw == null || !String(raw).trim()) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeCommunityMediaPath)
}

/** 绝对 URL；已是 http(s) 则原样返回 */
export function toAbsoluteMediaUrl(path: string, base: string = BASE_IMG): string {
  const p = path.trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p) || p.startsWith('data:') || p.startsWith('blob:')) return p
  return `${base}${p.replace(/^\//, '')}`
}

/**
 * 为图片路径追加 OSS 处理参数。
 * 已有 x-oss-process、或非图片扩展（如 .mp4）时不追加。
 */
export function withOssImageProcess(path: string, process: string): string {
  const p = path.trim()
  if (!p || !process) return p
  if (p.includes('x-oss-process=')) return p
  if (isCommunityLivePath(p)) {
    return withOssImageProcess(toCommunityLivePosterPath(p), process)
  }
  const sep = p.includes('?') ? '&' : '?'
  return `${p}${sep}x-oss-process=${process}`
}

/** 取 img_list / small_img_list 首项的展示路径（Live → jpg） */
export function firstCommunityDisplayPath(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    const items = parseCommunityImgList(raw)
    if (items[0]?.displayPath) return items[0].displayPath
  }
  return null
}
