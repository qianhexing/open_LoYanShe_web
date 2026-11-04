import type { Library, Wardrobe } from '@/types/api'
import {
	openLibraryDetailTab,
	openWardrobeDetail,
} from '@/composables/useLibraryDetailNavigation'
import { isHtml5PlusWebview } from '@/utils/nativeShell'
import type { SceneObjectLinkType } from '@/utils/sceneObjectLink'
import type { SceneObjectLinkDetailRow } from '@/utils/sceneObjectLinkDetails'

export interface SceneObjectLinkNavigateContext {
	defaultUserId?: number
	/** @deprecated 已统一走 nativeShell，可省略 */
	port?: { postMessage: (msg: string) => void } | null
}

export function isInUniAppShell(): boolean {
	return isHtml5PlusWebview()
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

	openWardrobeDetail({ userId, wardrobeId })
	return true
}

function navigateLibrary(
	library: Library,
	_ctx: SceneObjectLinkNavigateContext
): boolean {
	const libraryId = library.library_id
	if (!libraryId) return false

	openLibraryDetailTab(libraryId)
	return true
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
