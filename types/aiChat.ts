import type { AiIntentAnalysisResult } from '@/types/aiAssistant'
import type { Library, LibrarySimilarItem, PlanList, WardrobeClothes } from '@/types/api'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
	id: string
	role: ChatRole
	text?: string
	analysis?: AiIntentAnalysisResult
	libraries?: Library[]
	intentHint?: string
	similarRecommendAwaitPick?: boolean
	similarPickResolved?: boolean
	sharedClothes?: WardrobeClothes[]
	similarItems?: LibrarySimilarItem[]
	echoClothes?: WardrobeClothes
	/** 从该服饰气泡「添加定尾计划」并成功提交后设为 true */
	tailPlanAdded?: boolean
	/** AI 会话里刚提交的攒钱/定尾计划回显 */
	echoPlan?: PlanList
	error?: string
	intentStreaming?: boolean
	intentStreamReasoning?: string
	intentStreamContent?: string
}
