import { BASE_IMG } from '@/utils/ipConfig'

export const SCENE_CANVAS_DOC_VERSION = 1 as const

export type SceneCanvasElementType = 'image' | 'text'

export interface SceneCanvasElementBase {
	id: string
	type: SceneCanvasElementType
	x: number
	y: number
	width: number
	height: number
	/** 角度制 */
	rotation: number
	opacity: number
	zIndex: number
}

export interface SceneCanvasImageElement extends SceneCanvasElementBase {
	type: 'image'
	/** 相对路径（不含 BASE_IMG） */
	url: string
}

export interface SceneCanvasTextElement extends SceneCanvasElementBase {
	type: 'text'
	text: string
	fontSize: number
	fontFamily: string
	color: string
	fontWeight: string | number
	textAlign: 'left' | 'center' | 'right'
}

export type SceneCanvasElement = SceneCanvasImageElement | SceneCanvasTextElement

export interface SceneCanvasDocument {
	version: typeof SCENE_CANVAS_DOC_VERSION
	width: number
	height: number
	/** CSS 颜色，或 'transparent' */
	background: string
	elements: SceneCanvasElement[]
}

export function createEmptySceneCanvasDocument(
	width = 1024,
	height = 1024
): SceneCanvasDocument {
	return {
		version: SCENE_CANVAS_DOC_VERSION,
		width,
		height,
		background: 'transparent',
		elements: []
	}
}

export function cloneSceneCanvasDocument(
	doc: SceneCanvasDocument
): SceneCanvasDocument {
	return JSON.parse(JSON.stringify(doc)) as SceneCanvasDocument
}

export function normalizeSceneCanvasDocument(
	raw: unknown
): SceneCanvasDocument | null {
	if (!raw || typeof raw !== 'object') return null
	const o = raw as Record<string, unknown>
	const width = Number(o.width)
	const height = Number(o.height)
	if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
		return null
	}
	const elements = Array.isArray(o.elements) ? o.elements : []
	const normalized: SceneCanvasElement[] = []
	for (const item of elements) {
		if (!item || typeof item !== 'object') continue
		const el = item as Record<string, unknown>
		const id = typeof el.id === 'string' ? el.id : ''
		const type = el.type
		if (!id || (type !== 'image' && type !== 'text')) continue
		const base = {
			id,
			x: Number(el.x) || 0,
			y: Number(el.y) || 0,
			width: Math.max(1, Number(el.width) || 100),
			height: Math.max(1, Number(el.height) || 40),
			rotation: Number(el.rotation) || 0,
			opacity: clamp01(Number(el.opacity) ?? 1),
			zIndex: Number(el.zIndex) || 0
		}
		if (type === 'image') {
			const url = typeof el.url === 'string' ? el.url : ''
			if (!url) continue
			normalized.push({ ...base, type: 'image', url })
		} else {
			normalized.push({
				...base,
				type: 'text',
				text: typeof el.text === 'string' ? el.text : '',
				fontSize: Math.max(8, Number(el.fontSize) || 32),
				fontFamily:
					typeof el.fontFamily === 'string' && el.fontFamily
						? el.fontFamily
						: 'sans-serif',
				color: typeof el.color === 'string' ? el.color : '#111111',
				fontWeight: (el.fontWeight as string | number) ?? 'normal',
				textAlign:
					el.textAlign === 'center' || el.textAlign === 'right'
						? el.textAlign
						: 'left'
			})
		}
	}
	return {
		version: SCENE_CANVAS_DOC_VERSION,
		width,
		height,
		background:
			typeof o.background === 'string' && o.background
				? o.background
				: 'transparent',
		elements: normalized
	}
}

export function resolveCanvasAssetUrl(url: string): string {
	if (!url) return ''
	if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
		return url
	}
	const rel = url.replace(/^\//, '')
	return `${BASE_IMG}${rel}`
}

export function toRelativeCanvasAssetUrl(absUrl: string): string {
	if (!absUrl) return ''
	let u = absUrl.trim()
	if (u.startsWith(BASE_IMG)) {
		u = u.slice(BASE_IMG.length)
	} else if (/^https?:\/\//i.test(u)) {
		u = u.replace(/^https?:\/\/[^/]+\//i, '')
	}
	return u.replace(/^\//, '')
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 1
	return Math.min(1, Math.max(0, n))
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = () => reject(new Error(`图片加载失败: ${src}`))
		img.src = src
	})
}

function wrapTextLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string[] {
	const paragraphs = text.split(/\n/)
	const lines: string[] = []
	for (const paragraph of paragraphs) {
		if (!paragraph) {
			lines.push('')
			continue
		}
		let line = ''
		for (const ch of paragraph) {
			const test = line + ch
			if (ctx.measureText(test).width > maxWidth && line) {
				lines.push(line)
				line = ch
			} else {
				line = test
			}
		}
		if (line) lines.push(line)
	}
	return lines.length ? lines : ['']
}

/** 将画布文档光栅化为离屏 canvas（用于导出贴图） */
export async function renderSceneCanvasDocument(
	doc: SceneCanvasDocument
): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas')
	canvas.width = Math.max(1, Math.round(doc.width))
	canvas.height = Math.max(1, Math.round(doc.height))
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('无法创建画布上下文')

	ctx.clearRect(0, 0, canvas.width, canvas.height)
	if (doc.background && doc.background !== 'transparent') {
		ctx.fillStyle = doc.background
		ctx.fillRect(0, 0, canvas.width, canvas.height)
	}

	const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex)
	for (const el of sorted) {
		ctx.save()
		ctx.globalAlpha = clamp01(el.opacity)
		const cx = el.x + el.width / 2
		const cy = el.y + el.height / 2
		ctx.translate(cx, cy)
		ctx.rotate(((el.rotation || 0) * Math.PI) / 180)
		ctx.translate(-el.width / 2, -el.height / 2)

		if (el.type === 'image') {
			try {
				const img = await loadHtmlImage(resolveCanvasAssetUrl(el.url))
				ctx.drawImage(img, 0, 0, el.width, el.height)
			} catch (err) {
				console.warn(err)
				ctx.fillStyle = 'rgba(200,200,200,0.5)'
				ctx.fillRect(0, 0, el.width, el.height)
			}
		} else {
			ctx.fillStyle = el.color
			ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`
			ctx.textBaseline = 'top'
			ctx.textAlign = el.textAlign
			const lines = wrapTextLines(ctx, el.text || '', el.width)
			const lineHeight = el.fontSize * 1.25
			let x = 0
			if (el.textAlign === 'center') x = el.width / 2
			if (el.textAlign === 'right') x = el.width
			lines.forEach((line, i) => {
				ctx.fillText(line, x, i * lineHeight)
			})
		}
		ctx.restore()
	}

	return canvas
}

export function createCanvasElementId(): string {
	return `cve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
