import { BASE_IMG } from '@/utils/ipConfig'
import type { SceneArTargetJSON } from '@/utils/threeCore'

export function resolveSceneArAssetUrl(url: string): string {
	const u = url.trim()
	if (!u) return ''
	if (/^https?:\/\//i.test(u) || u.startsWith('blob:') || u.startsWith('data:')) {
		return u
	}
	return `${BASE_IMG}${u.replace(/^\//, '')}`
}

export function hasSceneArTarget(
	ar?: SceneArTargetJSON | null
): ar is SceneArTargetJSON {
	return Boolean(ar?.mindUrl?.trim() && ar?.previewUrl?.trim())
}

/** 兼容 camelCase / snake_case，以及值为 JSON 字符串的情况 */
export function normalizeSceneArTarget(
	raw: unknown
): SceneArTargetJSON | null {
	if (raw == null) return null
	let v: unknown = raw
	if (typeof v === 'string') {
		try {
			v = JSON.parse(v)
		} catch {
			return null
		}
	}
	if (!v || typeof v !== 'object') return null
	const o = v as Record<string, unknown>
	const mindUrl = String(o.mindUrl ?? o.mind_url ?? '').trim()
	const previewUrl = String(o.previewUrl ?? o.preview_url ?? '').trim()
	if (!mindUrl || !previewUrl) return null
	const targetIndexRaw = o.targetIndex ?? o.target_index
	const targetIndex =
		typeof targetIndexRaw === 'number'
			? targetIndexRaw
			: Number.parseInt(String(targetIndexRaw ?? 0), 10) || 0
	const name = o.name != null ? String(o.name) : undefined
	const updatedAt = o.updatedAt ?? o.updated_at
	return {
		mindUrl,
		previewUrl,
		targetIndex,
		...(name ? { name } : {}),
		...(updatedAt ? { updatedAt: String(updatedAt) } : {})
	}
}

export function pickArTargetFromSceneJson(json: unknown): SceneArTargetJSON | null {
	if (json == null) return null
	let data: unknown = json
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data)
		} catch {
			return null
		}
	}
	if (!data || typeof data !== 'object') return null
	return normalizeSceneArTarget((data as Record<string, unknown>).arTarget)
}

export function toSceneArTarget(
	data: SceneArTargetJSON
): SceneArTargetJSON {
	return {
		mindUrl: data.mindUrl,
		previewUrl: data.previewUrl,
		targetIndex: data.targetIndex ?? 0,
		...(data.name ? { name: data.name } : {}),
		...(data.updatedAt ? { updatedAt: data.updatedAt } : {})
	}
}
