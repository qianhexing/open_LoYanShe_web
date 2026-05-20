import { useConfigStore } from '@/stores/config'

/** UniApp 内嵌 WebView（与项目内其它跳转一致） */
export function isHtml5PlusWebview(): boolean {
  return (
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Html5Plus')
  )
}

/**
 * 打开图鉴详情：浏览器新标签；Html5Plus 走原生页；鸿蒙等走 port 桥接。
 * 行为与 `components/library/LibraryItem.vue` 的 `handleJump` 对齐。
 */
export function openLibraryDetailTab(
  libraryId: number | string | null | undefined
): void {
  if (libraryId == null || libraryId === '') return
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return
  if (!import.meta.client || typeof window === 'undefined') return

  const configStore = useConfigStore()
  const uniApi = configStore.uniWebviewJs

  if (isHtml5PlusWebview() && uniApi?.navigateTo) {
    uniApi.navigateTo({
      url: `/pages/library/libraryDetail/libraryDetail?id=${idNum}`,
      fail: () => {
        const abs = new URL(
          `/library/detail/${idNum}`,
          window.location.origin
        ).href
        uniApi.navigateTo?.({
          url: `/pages/common/outerLink?url=${encodeURIComponent(abs)}`
        })
      }
    })
    return
  }

  const port = configStore.getPort()
  if (port) {
    try {
      port.postMessage(
        JSON.stringify({
          type: 'jump',
          path: 'LibraryDetail',
          params: { id: idNum }
        })
      )
    } catch {
      window.open(
        new URL(`/library/detail/${idNum}`, window.location.origin).href,
        '_blank',
        'noopener,noreferrer'
      )
    }
    return
  }

  window.open(
    new URL(`/library/detail/${idNum}`, window.location.origin).href,
    '_blank',
    'noopener,noreferrer'
  )
}

/** 用于 `<a href>` 的绝对地址（仅客户端能带 origin；SSR 回落为路径） */
export function libraryDetailPageHref(
  libraryId: number | string | null | undefined
): string {
  if (libraryId == null || libraryId === '') return '#'
  const idNum = Number(libraryId)
  if (!Number.isFinite(idNum)) return '#'
  if (import.meta.client && typeof window !== 'undefined') {
    try {
      return new URL(`/library/detail/${idNum}`, window.location.origin).href
    } catch {
      return `/library/detail/${idNum}`
    }
  }
  return `/library/detail/${idNum}`
}
