import type { BaseResponse } from '@/types/api'
import type { SceneArTargetJSON } from '@/utils/threeCore'

export interface CompileMindOptions {
	maxEdge?: number
	uploadPath?: string
}

export interface CompileMindParams {
	imageUrl: string
	sceneId: number | string
	name?: string
	options?: CompileMindOptions
}

export interface CompileMindResult extends SceneArTargetJSON {
	meta?: {
		width: number
		height: number
		compileMs: number
	}
}

/**
 * 服务端编译识别图为 .mind，并写入场景 json_data.arTarget
 * POST /ar/compile-mind
 */
export async function compileSceneMind(
	params: CompileMindParams
): Promise<CompileMindResult> {
	const response = await use$Post<BaseResponse<CompileMindResult>>(
		'/ar/compile-mind',
		params
	)
	return response.data
}

export interface MatchScenesParams {
	/** 抽帧图 OSS 地址（相对路径或完整 URL） */
	url: string
	/** 聚合后返回条数，默认 10，最大 50 */
	topK?: number
	/** 默认 true：只搜当前用户；false 搜全库 ar_scene */
	onlyMine?: boolean
	/** onlyMine=false 时可按某用户过滤 */
	userId?: number | string
	/** 距离上限，超过的丢弃；越小越像 */
	distanceMax?: number
}

export interface MatchSceneItem {
	scene_id: number
	distance: number
	key?: string
	mind_url: string
	preview_url: string
	image_url?: string
	name?: string
	user_id?: string | number
	target_index?: number
}

export interface MatchScenesResult {
	items: MatchSceneItem[]
	requestId?: string
}

/**
 * 以图搜场景：抽帧 embedding 匹配用户向量索引中的 ar_scene
 * POST /ar/match-scenes（需登录）
 */
export async function matchScenes(
	params: MatchScenesParams
): Promise<MatchScenesResult> {
	const response = await use$Post<BaseResponse<MatchScenesResult>>(
		'/ar/match-scenes',
		params
	)
	return response.data
}
