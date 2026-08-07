/**
 * 手账卡片等站内 iframe 与场景详情页的轻量通信协议。
 * 卡片侧：from_iframe + from_card 仅初始化 WebGL/灯光；点「操作场景」后再发此消息加载内容。
 */
export const SCENE_IFRAME_LOAD_CONTENT = 'scene:loadContent' as const

export type SceneIframeMessage = {
  type: typeof SCENE_IFRAME_LOAD_CONTENT
}

export function isSceneLoadContentMessage(data: unknown): boolean {
  if (data == null) return false
  let payload: unknown = data
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (typeof payload !== 'object') return false
  return (payload as { type?: string }).type === SCENE_IFRAME_LOAD_CONTENT
}

/** 通知 iframe 内场景页加载模型等内容（同域） */
export function postSceneLoadContent(win: Window | null | undefined) {
  if (!win || typeof window === 'undefined') return
  const msg: SceneIframeMessage = { type: SCENE_IFRAME_LOAD_CONTENT }
  win.postMessage(msg, window.location.origin)
}
