import { BASE_IMG } from '@/utils/ipConfig'

/** 解析店铺 logo 为可加载的完整 URL */
export function resolveShopLogoUrl(logo?: string | null): string {
  if (!logo?.trim()) return ''
  const s = logo.trim()
  if (/^(https?:|blob:|data:)/i.test(s)) return s
  if (s.startsWith('//')) return s
  const base = BASE_IMG.endsWith('/') ? BASE_IMG.slice(0, -1) : BASE_IMG
  const path = s.startsWith('/') ? s.slice(1) : s
  return `${base}/${path}`
}
