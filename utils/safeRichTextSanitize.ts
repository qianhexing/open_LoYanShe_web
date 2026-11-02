/**
 * 富文本渲染用的标签/属性消毒（deny-by-default 属性白名单）。
 * 供 SafeRichText 等渲染路径共用，避免 srcdoc / on* / javascript: 等绕过。
 */

/** 去掉空白与控制字符后再做协议判断，防 `java\nscript:` 一类绕过 */
function normalizeUrlForProtocolCheck(val: string): string {
  let out = ''
  for (const ch of String(val).trim()) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f || code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      continue
    }
    out += ch.toLowerCase()
  }
  return out
}

export function isDangerousUrl(val: string): boolean {
  const n = normalizeUrlForProtocolCheck(val)
  if (!n) return true
  if (/^(?:javascript|vbscript|data|blob):/i.test(n)) return true
  if (n.includes('javascript:')) return true
  return false
}

export function toAbsoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) {
    if (typeof window !== 'undefined') return `${window.location.protocol}${href}`
    return `https:${href}`
  }
  if (href.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${href}`
    return `https://lolitalibrary.com${href}`
  }
  return href
}

/** 仅允许同站/主站子域的 iframe 嵌入；含站内以 / 开头的 path-only URL */
export function isAllowedIframeSrc(val: string): boolean {
  const v = String(val).trim()
  if (v === '' || isDangerousUrl(v)) return false
  if (/^\/(?!\/)/.test(v)) return true
  try {
    const abs = toAbsoluteUrl(v)
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return host === 'lolitalibrary.com' || host.endsWith('.lolitalibrary.com')
  } catch {
    return false
  }
}

/** 媒体 src：http(s) + 安全扩展名；不含 svg（可嵌脚本面） */
const MEDIA_SRC_EXT = /\.(jpg|jpeg|png|gif|webp|mp4|mp3|webm)(?:\?[^#]*)?(?:#.*)?$/i

export function isAllowedMediaSrc(val: string): boolean {
  const v = String(val).trim()
  if (!v || isDangerousUrl(v)) return false
  if (!/^https?:\/\//i.test(v)) return false
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return MEDIA_SRC_EXT.test(u.pathname)
  } catch {
    return false
  }
}

/** a[href]：相对路径或 http(s) */
export function isAllowedAnchorHref(val: string): boolean {
  const v = String(val).trim()
  if (!v || isDangerousUrl(v)) return false
  if (v.startsWith('/') && !v.startsWith('//')) return true
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }
  return false
}

const STYLE_PROP_ALLOW =
  /^(color|font-size|text-align|margin|padding|background-color|width|height)(-[a-z]+)?\s*:/i

export function sanitizeStyle(style = ''): string {
  return style
    .split(';')
    .map((s) => s.trim())
    .filter(
      (rule) =>
        STYLE_PROP_ALLOW.test(rule) &&
        !/url\s*\(|expression\s*\(|-moz-binding|behavior\s*:|@import/i.test(rule)
    )
    .join(';')
}

/** 标签允许的属性（不含事件；iframe 不含 srcdoc） */
const ATTR_ALLOW_BY_TAG: Record<string, ReadonlySet<string>> = {
  div: new Set(['class', 'style', 'title']),
  p: new Set(['class', 'style', 'title']),
  span: new Set([
    'class',
    'style',
    'title',
    'data-type',
    'data-id',
    'data-label',
    'data-emoji-id',
  ]),
  strong: new Set(['class', 'style']),
  em: new Set(['class', 'style']),
  b: new Set(['class', 'style']),
  i: new Set(['class', 'style']),
  h3: new Set(['class', 'style', 'title']),
  ul: new Set(['class', 'style']),
  ol: new Set(['class', 'style']),
  li: new Set(['class', 'style']),
  br: new Set([]),
  a: new Set(['href', 'class', 'style', 'title']),
  img: new Set(['src', 'alt', 'class', 'style', 'title', 'width', 'height']),
  video: new Set(['src', 'controls', 'poster', 'class', 'style', 'width', 'height', 'preload']),
  audio: new Set(['src', 'controls', 'class', 'style', 'preload']),
  source: new Set(['src', 'type']),
  iframe: new Set([
    'src',
    'width',
    'height',
    'title',
    'class',
    'allow',
    'allowfullscreen',
    'loading',
    'referrerpolicy',
  ]),
  /** 自定义标签映射为 div 前仍按原名取白名单 */
  library: new Set(['class', 'style', 'title']),
  shop: new Set(['class', 'style', 'title']),
  emoji: new Set(['href', 'class', 'data-emoji-id']),
  vote: new Set(['href']),
}

const DEFAULT_ATTR_ALLOW = new Set(['class', 'style', 'title'])

function isAttrAllowed(tag: string, key: string): boolean {
  const allow = ATTR_ALLOW_BY_TAG[tag] ?? DEFAULT_ATTR_ALLOW
  return allow.has(key)
}

export type SafeAttrMap = Record<string, string | boolean | number>

/**
 * 按标签属性白名单过滤；危险协议 / on* / srcdoc 等一律丢弃。
 */
export function getSafeAttrs(
  tag: string,
  attrs: Record<string, string> | undefined | null,
  options?: { rewriteImgSrc?: (src: string) => string }
): SafeAttrMap {
  const safe: SafeAttrMap = {}
  if (!attrs) return finalizeTagAttrs(tag, safe)

  for (const rawKey of Object.keys(attrs)) {
    const key = rawKey.toLowerCase()
    let val = attrs[rawKey]
    if (val == null) continue
    val = String(val)

    // 事件与明确禁止项
    if (key.startsWith('on')) continue
    if (key === 'srcdoc' || key === 'srcset' || key === 'formaction' || key === 'xlink:href') {
      continue
    }
    if (!isAttrAllowed(tag, key)) continue

    if (key === 'style') {
      const clean = sanitizeStyle(val)
      if (clean) safe.style = clean
      continue
    }

    if (tag === 'a' && key === 'href') {
      if (isAllowedAnchorHref(val)) safe.href = val
      continue
    }

    if (key === 'src') {
      if (tag === 'iframe') {
        if (isAllowedIframeSrc(val)) safe.src = val.trim()
        continue
      }
      let mediaSrc = val
      if (tag === 'img' && options?.rewriteImgSrc) {
        mediaSrc = options.rewriteImgSrc(mediaSrc)
      }
      if (isAllowedMediaSrc(mediaSrc)) safe.src = mediaSrc
      continue
    }

    if (key === 'poster') {
      if (isAllowedMediaSrc(val)) safe.poster = val
      continue
    }

    if (key === 'allowfullscreen') {
      safe.allowfullscreen = true
      continue
    }

    // 非 URL 属性也拒绝夹带危险协议串
    if (isDangerousUrl(val)) continue

    // data-* / 其余白名单属性：限制长度，避免异常载荷
    if (val.length > 2000) continue
    safe[key] = val
  }

  return finalizeTagAttrs(tag, safe)
}

function finalizeTagAttrs(tag: string, safe: SafeAttrMap): SafeAttrMap {
  if (tag === 'a') {
    if (safe.href) {
      safe.target = '_blank'
      safe.rel = 'noopener noreferrer'
    }
  }
  if (tag === 'img') {
    safe.loading = 'lazy'
    if (!safe.alt) safe.alt = 'image'
  }
  if (tag === 'video' || tag === 'audio') {
    const { autoplay: _a, muted: _m, ...rest } = safe
    void _a
    void _m
    return { ...rest, controls: true }
  }
  if (tag === 'iframe') {
    // 无合法 src 则整段丢弃（调用方应不渲染）；srcdoc 已在白名单外
    if (!safe.src) return {}
    const { name: _n, ...rest } = safe
    void _n
    return {
      ...rest,
      referrerpolicy: rest.referrerpolicy || 'strict-origin-when-cross-origin',
    }
  }
  return safe
}

/** iframe 是否有可渲染的安全 src */
export function hasSafeIframeSrc(attrs: Record<string, string> | undefined | null): boolean {
  const safe = getSafeAttrs('iframe', attrs)
  return typeof safe.src === 'string' && safe.src.length > 0
}
