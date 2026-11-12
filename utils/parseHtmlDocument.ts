/**
 * 将 HTML 片段解析为 Document。
 * 浏览器走 DOMParser；SSR 走 plugins/linkedom.server.ts 注入的 linkedom/worker。
 *
 * 勿在此文件静态 import `linkedom`：主入口会拉 commonjs/canvas.cjs（含 require），
 * 打进生产 SSR ESM 后会报 `require is not defined in ES module scope`。
 */

type ServerParser = (html: string) => Document

declare global {
	// eslint-disable-next-line no-var
	var __loyansheParseHtmlDocument: ServerParser | undefined
}

export function parseHtmlDocument(html: string): Document {
	if (typeof DOMParser !== 'undefined') {
		return new DOMParser().parseFromString(html, 'text/html')
	}
	const parse = globalThis.__loyansheParseHtmlDocument
	if (!parse) {
		throw new Error(
			'[parseHtmlDocument] SSR parser missing; ensure plugins/linkedom.server.ts is loaded',
		)
	}
	return parse(html)
}
