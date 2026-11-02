import { parseHTML } from 'linkedom'

/**
 * 将 HTML 片段解析为 Document。
 * 优先原生 DOMParser；SSR（Node 无 DOMParser）回退到 linkedom。
 */
export function parseHtmlDocument(html: string): Document {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html')
  }
  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
  )
  return document as unknown as Document
}
