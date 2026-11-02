/** 小工具静态容器（独立项目） */
export const MINI_TOOL_CONTAINER_BASE = 'https://lolitalibrary.com/pc/tool/'

export function buildMiniToolUrl(toolId: number): string {
  return `${MINI_TOOL_CONTAINER_BASE}?id=${toolId}`
}

type UniNavigate = {
  navigateTo?: (opts: { url: string; fail?: (err?: unknown) => void }) => void
}

/**
 * UniApp outerLink2 / 鸿蒙 Outlink / 浏览器新开。
 * 明文传 url，不要 encodeURIComponent（uni-webview-js 会再 encodeURI）。
 */
export function openMiniToolUrl(
  toolId: number,
  opts: {
    uni?: UniNavigate | null
    port?: { postMessage: (data: unknown) => void } | null
  } = {}
): void {
  if (!Number.isFinite(toolId) || toolId <= 0) return
  const url = buildMiniToolUrl(toolId)

  const port = opts.port
  if (port && typeof port.postMessage === 'function') {
    try {
      port.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'Outlink',
          params: { url },
        })
      )
      return
    } catch {
      /* fall through */
    }
  }

  const uni = opts.uni
  if (uni?.navigateTo) {
    try {
      uni.navigateTo({
        url: `/pages/common/outerLink2?url=${url}`,
      })
      return
    } catch {
      /* fall through */
    }
  }

  if (import.meta.client) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
