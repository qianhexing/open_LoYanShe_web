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
