import { openInNativeShell } from '@/utils/nativeShell'

/** 小工具静态容器（独立项目） */
export const MINI_TOOL_CONTAINER_BASE = 'https://lolitalibrary.com/pc/tool/'

export function buildMiniToolUrl(toolId: number): string {
  return `${MINI_TOOL_CONTAINER_BASE}?id=${toolId}`
}

type UniNavigate = {
  navigateTo?: (opts: { url: string; fail?: (err?: unknown) => void }) => void
}

/**
 * UniApp outerLink2 / 鸿蒙·iOS Outlink / 浏览器新开。
 * 明文传 url，不要 encodeURIComponent（uni-webview-js 会再 encodeURI）。
 */
export function openMiniToolUrl(
  toolId: number,
  opts: {
    uni?: UniNavigate | null
    /** @deprecated 已统一走 nativeShell MessagePort，可省略 */
    port?: { postMessage: (data: unknown) => void } | null
  } = {}
): void {
  if (!Number.isFinite(toolId) || toolId <= 0) return
  openInNativeShell(buildMiniToolUrl(toolId), { uni: opts.uni })
}
