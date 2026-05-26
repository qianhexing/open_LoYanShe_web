import type { Library, Wardrobe } from '@/types/api'
import type { SceneObjectLinkType } from '@/utils/sceneObjectLink'
import type { SceneObjectLinkDetailRow } from '@/utils/sceneObjectLinkDetails'

export interface SceneObjectLinkNavigateContext {
	defaultUserId?: number
	port?: { postMessage: (msg: string) => void } | null
}

export function isInUniAppShell(): boolean {
	return (
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus')
	)
}

function buildWebUrl(path: string): string {
	if (!import.meta.client) return path
	if (path.includes('://')) return path
	return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
}

export function canNavigateSceneObjectLink(row: SceneObjectLinkDetailRow): boolean {
	if (row.error) return false
	switch (row.link.type) {
		case 'wardrobe':
			return Boolean(row.wardrobe?.wardrobe_id)
		case 'library':
			return Boolean(row.library?.library_id)
		default:
			return false
	}
}

function resolveWardrobeUserId(
	wardrobe: Wardrobe,
	ctx: SceneObjectLinkNavigateContext
): number {
	const uid = Number(wardrobe.user_id ?? ctx.defaultUserId ?? 0)
	return Number.isFinite(uid) && uid > 0 ? uid : 0
}

function navigateWardrobe(
	wardrobe: Wardrobe,
	ctx: SceneObjectLinkNavigateContext
): boolean {
	const wardrobeId = wardrobe.wardrobe_id
	if (!wardrobeId) return false
	const userId = resolveWardrobeUserId(wardrobe, ctx)
	if (!userId) return false

	const webPath = `/wardrobe/detail/${userId}?wardrobe_id=${wardrobeId}`
	const uniPath = `/pages/wardrobe/wardrobe?user_id=${userId}&wardrobe_id=${wardrobeId}`

	if (isInUniAppShell() && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({ url: uniPath })
		return true
	}
	if (ctx.port) {
		ctx.port.postMessage(
			JSON.stringify({
				type: 'jump',
				path: 'Outlink',
				params: { url: buildWebUrl(webPath) }
			})
		)
		return true
	}
	if (import.meta.client) {
		window.open(buildWebUrl(webPath), '_blank', 'noopener,noreferrer')
		return true
	}
	return false
}

function navigateLibrary(
	library: Library,
	ctx: SceneObjectLinkNavigateContext
): boolean {
	const libraryId = library.library_id
	if (!libraryId) return false

	const webPath = `/library/detail/${libraryId}`
	const uniPath = `/pages/library/libraryDetail/libraryDetail?id=${libraryId}`

	if (isInUniAppShell() && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({ url: uniPath })
		return true
	}
	if (ctx.port) {
		ctx.port.postMessage(
			JSON.stringify({
				type: 'jump',
				path: 'LibraryDetail',
				params: { id: libraryId }
			})
		)
		return true
	}
	if (import.meta.client) {
		window.open(buildWebUrl(webPath), '_blank', 'noopener,noreferrer')
		return true
	}
	return false
}

export function navigateSceneObjectLink(
	row: SceneObjectLinkDetailRow,
	ctx: SceneObjectLinkNavigateContext = {}
): boolean {
	if (!canNavigateSceneObjectLink(row)) return false
	switch (row.link.type) {
		case 'wardrobe':
			return row.wardrobe ? navigateWardrobe(row.wardrobe, ctx) : false
		case 'library':
			return row.library ? navigateLibrary(row.library, ctx) : false
		default:
			return false
	}
}

export function linkDetailButtonLabel(type: SceneObjectLinkType): string {
	switch (type) {
		case 'wardrobe':
			return '打开衣柜'
		case 'library':
			return '打开图鉴'
		default:
			return '查看详情'
	}
}

export function linkTypeOrbClass(type: SceneObjectLinkType): string {
	switch (type) {
		case 'wardrobe':
			return 'scene-neu-icon-orb--violet'
		case 'library':
			return 'scene-neu-icon-orb--amber'
		case 'text':
			return 'scene-neu-icon-orb--cyan'
		case 'url':
			return 'scene-neu-icon-orb--indigo'
		default:
			return 'scene-neu-icon-orb--gray'
	}
}
