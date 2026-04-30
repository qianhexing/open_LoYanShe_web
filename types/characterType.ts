import type { CharacterTypeConfig } from '@/utils/characterTypeController'

export type {
	CharacterTypeConfig,
	CharacterClickContext,
	CharacterStandAlternate
} from '@/utils/characterTypeController'

/**
 * 与 Material.options 联用：配置后走角色动画控制器
 * @example options: { characterType: { stand: { primary: 'Idle' }, extras: ['Wave'], dialogueTitle: 'NPC', dialogueLines: ['你好'] } }
 */
export type MaterialOptionsCharacterType = {
	/** 启用 `CharacterTypeController` 与点击交互 */
	characterType?: CharacterTypeConfig
}
