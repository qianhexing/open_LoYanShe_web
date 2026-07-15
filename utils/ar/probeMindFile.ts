import { decode } from '@msgpack/msgpack'

export interface MindFileProbe {
	ok: boolean
	bytes: number
	version?: number
	targetCount: number
	dimensions: Array<{ width: number; height: number }>
	/** 粗略特征点数（maxima+minima） */
	featureCountApprox: number
	error?: string
}

/**
 * 拉取并校验 .mind（msgpack v2），用于排除 OSS 损坏 / HTML 错误页 / 空数据。
 */
export async function probeMindFile(url: string): Promise<MindFileProbe> {
	try {
		const res = await fetch(url, {
			mode: 'cors',
			cache: 'no-cache',
			credentials: 'omit'
		})
		if (!res.ok) {
			return {
				ok: false,
				bytes: 0,
				targetCount: 0,
				dimensions: [],
				featureCountApprox: 0,
				error: `HTTP ${res.status} 下载失败`
			}
		}
		const contentType = res.headers.get('content-type') || ''
		const buf = new Uint8Array(await res.arrayBuffer())
		if (buf.byteLength < 16) {
			return {
				ok: false,
				bytes: buf.byteLength,
				targetCount: 0,
				dimensions: [],
				featureCountApprox: 0,
				error: '文件过小，不像有效 .mind'
			}
		}
		// 常见：CDN/鉴权失败返回 HTML
		if (
			contentType.includes('text/html') ||
			(buf[0] === 0x3c /* < */ && buf[1] === 0x21 /* ! */)
		) {
			return {
				ok: false,
				bytes: buf.byteLength,
				targetCount: 0,
				dimensions: [],
				featureCountApprox: 0,
				error: `返回了 HTML 而非二进制（Content-Type=${contentType || 'unknown'}）`
			}
		}

		const content = decode(buf) as {
			v?: number
			dataList?: Array<{
				targetImage?: { width?: number; height?: number }
				matchingData?: Array<{
					maximaPoints?: unknown[]
					minimaPoints?: unknown[]
				}>
			}>
		}

		if (!content?.v || content.v !== 2) {
			return {
				ok: false,
				bytes: buf.byteLength,
				version: content?.v,
				targetCount: 0,
				dimensions: [],
				featureCountApprox: 0,
				error: `mind 版本不兼容（v=${String(content?.v)}，需要 2）`
			}
		}

		const list = content.dataList || []
		if (list.length === 0) {
			return {
				ok: false,
				bytes: buf.byteLength,
				version: 2,
				targetCount: 0,
				dimensions: [],
				featureCountApprox: 0,
				error: 'dataList 为空'
			}
		}

		let featureCountApprox = 0
		const dimensions = list.map(item => {
			for (const m of item.matchingData || []) {
				featureCountApprox +=
					(m.maximaPoints?.length || 0) + (m.minimaPoints?.length || 0)
			}
			return {
				width: item.targetImage?.width || 0,
				height: item.targetImage?.height || 0
			}
		})

		return {
			ok: true,
			bytes: buf.byteLength,
			version: 2,
			targetCount: list.length,
			dimensions,
			featureCountApprox
		}
	} catch (e) {
		return {
			ok: false,
			bytes: 0,
			targetCount: 0,
			dimensions: [],
			featureCountApprox: 0,
			error: e instanceof Error ? e.message : '解析 .mind 失败'
		}
	}
}

/** 给 mind URL 加 cache-bust，避免 CDN 缓存旧坏文件 */
export function withMindCacheBust(url: string, bust?: string | number | null): string {
	if (!url) return url
	if (bust == null || bust === '') return url
	const join = url.includes('?') ? '&' : '?'
	return `${url}${join}v=${encodeURIComponent(String(bust))}`
}
