import { getClothesList } from '@/api/wardrobe'
import { getLibraryDetail } from '@/api/library'
import type { Library, Wardrobe } from '@/types/api'
import type { SceneObjectLink } from '@/utils/sceneObjectLink'

export type SceneObjectLinkDetailRow = {
	link: SceneObjectLink
	loading: boolean
	error: string | null
	wardrobe: Wardrobe | null
	library: Library | null
}

export async function fetchSceneObjectLinkDetail(
	link: SceneObjectLink
): Promise<Pick<SceneObjectLinkDetailRow, 'error' | 'wardrobe' | 'library'>> {
	try {
		switch (link.type) {
			case 'wardrobe': {
				const wardrobeId = Number(link.id)
				if (!Number.isFinite(wardrobeId) || wardrobeId <= 0) {
					return {
						error: '无效的衣柜 ID',
						wardrobe: null,
						library: null
					}
				}
				const res = await getClothesList({
					wardrobe_id: wardrobeId,
					page: 1,
					pageSize: 1
				})
				return {
					error: res.info ? null : '未找到衣柜',
					wardrobe: res.info ?? null,
					library: null
				}
			}
			case 'library': {
				const libraryId = Number(link.id)
				if (!Number.isFinite(libraryId) || libraryId <= 0) {
					return {
						error: '无效的图鉴 ID',
						wardrobe: null,
						library: null
					}
				}
				const res = await getLibraryDetail({ library_id: libraryId })
				const library = res?.library ?? null
				if (library && res?.shop) {
					library.shop = res.shop
				}
				return {
					error: library ? null : '未找到图鉴',
					wardrobe: null,
					library
				}
			}
			case 'text':
			case 'url':
				return {
					error: '该类型详情暂未开放',
					wardrobe: null,
					library: null
				}
			default:
				return {
					error: '未知关联类型',
					wardrobe: null,
					library: null
				}
		}
	} catch (e) {
		const msg =
			e instanceof Error ? e.message : '加载失败'
		return { error: msg, wardrobe: null, library: null }
	}
}

export async function fetchSceneObjectLinkDetails(
	links: SceneObjectLink[]
): Promise<SceneObjectLinkDetailRow[]> {
	return Promise.all(
		links.map(async link => {
			const detail = await fetchSceneObjectLinkDetail(link)
			return {
				link,
				loading: false,
				...detail
			}
		})
	)
}
