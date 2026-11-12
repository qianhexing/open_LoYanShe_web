/**
 * SSR 专用：用 linkedom/worker（纯 ESM，无 canvas.cjs / require）注册 HTML 解析器。
 */
import { parseHTML } from 'linkedom/worker'

export default defineNuxtPlugin(() => {
	globalThis.__loyansheParseHtmlDocument = (html: string) => {
		const { document } = parseHTML(
			`<!DOCTYPE html><html><body>${html}</body></html>`,
		)
		return document as unknown as Document
	}
})
