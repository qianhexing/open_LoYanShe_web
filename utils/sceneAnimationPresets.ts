import type { SceneEffectJSON } from '@/utils/threeCore'
import type * as THREE from 'three'

export type AnimationParamType = 'number' | 'select' | 'boolean'

export interface AnimationParamOption {
	value: string
	label: string
}

export interface AnimationParamDef {
	key: string
	label: string
	type: AnimationParamType
	default: number | string | boolean
	min?: number
	max?: number
	step?: number
	options?: AnimationParamOption[]
}

/** 展开「详细参数」时显示的时间轴项 */
export const SCENE_ANIMATION_TIMING_PARAMS: AnimationParamDef[] = [
	{ key: 'duration', label: '时长(秒)', type: 'number', default: 2, min: 0.1, max: 120, step: 0.1 },
	{
		key: 'ease',
		label: '缓动',
		type: 'select',
		default: 'power2.inOut',
		options: [
			{ value: 'none', label: '线性' },
			{ value: 'power1.inOut', label: 'power1' },
			{ value: 'power2.inOut', label: 'power2' },
			{ value: 'power3.inOut', label: 'power3' },
			{ value: 'back.inOut', label: '回弹' },
			{ value: 'elastic.inOut', label: '弹性' },
			{ value: 'bounce.out', label: '弹跳' }
		]
	},
	{ key: 'delay', label: '延迟(秒)', type: 'number', default: 0, min: 0, max: 60, step: 0.1 },
	{
		key: 'repeat',
		label: '重复',
		type: 'number',
		default: -1,
		min: -1,
		max: 100,
		step: 1
	},
	{ key: 'yoyo', label: '往返', type: 'boolean', default: false },
	{
		key: 'repeatDelay',
		label: '重复间隔(秒)',
		type: 'number',
		default: 0,
		min: 0,
		max: 30,
		step: 0.1
	}
]

const TAU = Math.PI * 2

export interface SceneAnimationPreset {
	id: string
	label: string
	/** Material Symbols 图标名 */
	icon: string
	category: 'translate' | 'rotate'
	paramDefs: AnimationParamDef[]
	buildEffect: (
		params: Record<string, number | string | boolean>,
		obj: THREE.Object3D
	) => SceneEffectJSON
}

function num(params: Record<string, number | string | boolean>, key: string, fallback = 0) {
	const v = params[key]
	const n = typeof v === 'number' ? v : Number(v)
	return Number.isFinite(n) ? n : fallback
}

function timingFromParams(
	params: Record<string, number | string | boolean>,
	overrides?: Partial<Pick<SceneEffectJSON, 'duration' | 'ease' | 'repeat' | 'yoyo'>>
): Pick<
	SceneEffectJSON,
	'duration' | 'ease' | 'delay' | 'repeat' | 'yoyo' | 'repeatDelay'
> {
	const repeat = Math.round(num(params, 'repeat', overrides?.repeat ?? 0))
	return {
		duration: overrides?.duration ?? num(params, 'duration', 2),
		ease: overrides?.ease ?? String(params.ease ?? 'power2.inOut'),
		delay: num(params, 'delay', 0),
		repeat: repeat === -1 ? -1 : Math.max(0, repeat),
		yoyo: overrides?.yoyo ?? Boolean(params.yoyo),
		repeatDelay: num(params, 'repeatDelay', 0)
	}
}

function mergeParamDefs(...groups: AnimationParamDef[]): AnimationParamDef[] {
	const seen = new Set<string>()
	const result: AnimationParamDef[] = []
	for (const def of [...groups, ...SCENE_ANIMATION_TIMING_PARAMS]) {
		if (seen.has(def.key)) continue
		seen.add(def.key)
		result.push(def)
	}
	return result
}

/** 旧版预设 id 兼容 */
const LEGACY_PRESET_ALIASES: Record<string, string> = {
	rotateLoop: 'rotate360',
	translateBy: 'swayX',
	translateTo: 'riseOnce',
	rotateBy: 'rotate360',
	rotateTo: 'rotate360'
}

function axisRotationProp(axis: string): 'rotation.x' | 'rotation.y' | 'rotation.z' {
	if (axis === 'x') return 'rotation.x'
	if (axis === 'z') return 'rotation.z'
	return 'rotation.y'
}

/** 将弧度归一到 [0, 2π)，避免持续旋转动效把多圈累计值写入场景 JSON */
export function normalizeEulerRad(angle: number): number {
	const v = angle % TAU
	return v < 0 ? v + TAU : v
}

function rotate360AxisFromEffect(effect: SceneEffectJSON): 'x' | 'y' | 'z' | null {
	const id = LEGACY_PRESET_ALIASES[effect.preset ?? ''] ?? effect.preset
	if (id !== 'rotate360') return null
	const axis = String(effect.options?.axis ?? 'y')
	if (axis === 'x' || axis === 'z') return axis
	return 'y'
}

/** 保存场景时，对带 rotate360 的轴去掉动画累计的整圈数 */
export function normalizeRotationForStorage(
	rotation: [number, number, number],
	effects: SceneEffectJSON[] | undefined
): [number, number, number] {
	if (!effects?.length) return rotation
	const out: [number, number, number] = [...rotation]
	for (const e of effects) {
		const axis = rotate360AxisFromEffect(e)
		if (!axis) continue
		const idx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1
		out[idx] = normalizeEulerRad(out[idx])
	}
	return out
}

/** 场景编辑器内置动效预设（点击即应用默认参数） */
export const SCENE_ANIMATION_PRESETS: SceneAnimationPreset[] = [
	{
		id: 'rotate360',
		label: '旋转',
		icon: 'material-symbols:360',
		category: 'rotate',
		paramDefs: mergeParamDefs(
			{
				key: 'axis',
				label: '旋转轴',
				type: 'select',
				default: 'y',
				options: [
					{ value: 'x', label: 'X' },
					{ value: 'y', label: 'Y' },
					{ value: 'z', label: 'Z' }
				]
			},
			{
				key: 'duration',
				label: '单圈时长(秒)',
				type: 'number',
				default: 4,
				min: 0.5,
				max: 60,
				step: 0.5
			},
			{
				key: 'repeat',
				label: '重复',
				type: 'number',
				default: -1,
				min: -1,
				max: 100,
				step: 1
			}
		),
		buildEffect(params, obj) {
			const axis = String(params.axis ?? 'y')
			const propKey = axisRotationProp(axis)
			return {
				type: 'animation',
				preset: 'rotate360',
				options: { ...params },
				// 相对增量：从当前姿态每圈 +2π，避免与保存的欧拉角绝对目标冲突
				properties: { [propKey]: `+=${TAU}` },
				duration: num(params, 'duration', 4),
				ease: 'none',
				repeat: Math.round(num(params, 'repeat', -1)) === -1 ? -1 : Math.max(0, num(params, 'repeat', 0)),
				yoyo: false,
				delay: num(params, 'delay', 0)
			}
		}
	},
	{
		id: 'floatUp',
		label: '上浮',
		icon: 'material-symbols:arrow-circle-up',
		category: 'translate',
		paramDefs: mergeParamDefs(
			{ key: 'distance', label: '距离', type: 'number', default: 0.4, min: 0.05, max: 20, step: 0.05 },
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 1.5, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: true }
		),
		buildEffect(params, obj) {
			const d = num(params, 'distance', 0.4)
			return {
				type: 'animation',
				preset: 'floatUp',
				options: { ...params },
				properties: {
					'position.y': obj.position.y + d
				},
				...timingFromParams(params, { duration: num(params, 'duration', 1.5), repeat: -1, yoyo: true })
			}
		}
	},
	{
		id: 'floatDown',
		label: '下沉',
		icon: 'material-symbols:arrow-circle-down',
		category: 'translate',
		paramDefs: mergeParamDefs(
			{ key: 'distance', label: '距离', type: 'number', default: 0.4, min: 0.05, max: 20, step: 0.05 },
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 1.5, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: true }
		),
		buildEffect(params, obj) {
			const d = num(params, 'distance', 0.4)
			return {
				type: 'animation',
				preset: 'floatDown',
				options: { ...params },
				properties: {
					'position.y': obj.position.y - d
				},
				...timingFromParams(params, { duration: num(params, 'duration', 1.5), repeat: -1, yoyo: true })
			}
		}
	},
	{
		id: 'swayRotateZ',
		label: '左右摇摆',
		icon: 'material-symbols:screen-rotation-alt',
		category: 'rotate',
		paramDefs: mergeParamDefs(
			{
				key: 'angle',
				label: '角度(°)',
				type: 'number',
				default: 12,
				min: 1,
				max: 90,
				step: 1
			},
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 1.5, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: true }
		),
		buildEffect(params, obj) {
			const deg = num(params, 'angle', 12)
			const rad = (deg * Math.PI) / 180
			return {
				type: 'animation',
				preset: 'swayRotateZ',
				options: { ...params },
				properties: { 'rotation.z': obj.rotation.z + rad },
				...timingFromParams(params, { duration: num(params, 'duration', 1.5), repeat: -1, yoyo: true })
			}
		}
	},
	{
		id: 'swayX',
		label: '左右',
		icon: 'material-symbols:swap-horiz',
		category: 'translate',
		paramDefs: mergeParamDefs(
			{ key: 'distance', label: '幅度', type: 'number', default: 0.5, min: 0.05, max: 20, step: 0.05 },
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 2, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: true }
		),
		buildEffect(params, obj) {
			const d = num(params, 'distance', 0.5)
			return {
				type: 'animation',
				preset: 'swayX',
				options: { ...params },
				properties: { 'position.x': obj.position.x + d },
				...timingFromParams(params, { repeat: -1, yoyo: true })
			}
		}
	},
	{
		id: 'swayZ',
		label: '前后',
		icon: 'material-symbols:swap-vert',
		category: 'translate',
		paramDefs: mergeParamDefs(
			{ key: 'distance', label: '幅度', type: 'number', default: 0.5, min: 0.05, max: 20, step: 0.05 },
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 2, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: -1, min: -1, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: true }
		),
		buildEffect(params, obj) {
			const d = num(params, 'distance', 0.5)
			return {
				type: 'animation',
				preset: 'swayZ',
				options: { ...params },
				properties: { 'position.z': obj.position.z + d },
				...timingFromParams(params, { repeat: -1, yoyo: true })
			}
		}
	},
	{
		id: 'riseOnce',
		label: '升起',
		icon: 'material-symbols:keyboard-double-arrow-up',
		category: 'translate',
		paramDefs: mergeParamDefs(
			{ key: 'distance', label: '高度', type: 'number', default: 1, min: 0.1, max: 30, step: 0.1 },
			{ key: 'duration', label: '时长(秒)', type: 'number', default: 2, min: 0.2, max: 30, step: 0.1 },
			{ key: 'repeat', label: '重复', type: 'number', default: 0, min: 0, max: 100, step: 1 },
			{ key: 'yoyo', label: '往返', type: 'boolean', default: false }
		),
		buildEffect(params, obj) {
			const d = num(params, 'distance', 1)
			return {
				type: 'animation',
				preset: 'riseOnce',
				options: { ...params },
				properties: { 'position.y': obj.position.y + d },
				...timingFromParams(params, { repeat: 0, yoyo: false })
			}
		}
	}
]

const presetMap = new Map(SCENE_ANIMATION_PRESETS.map(p => [p.id, p]))

export function getSceneAnimationPreset(id: string): SceneAnimationPreset | undefined {
	return presetMap.get(LEGACY_PRESET_ALIASES[id] ?? id)
}

export function getDefaultPresetParams(
	preset: SceneAnimationPreset
): Record<string, number | string | boolean> {
	const params: Record<string, number | string | boolean> = {}
	for (const def of preset.paramDefs) {
		params[def.key] = def.default
	}
	return params
}

export function getPresetIcon(presetId: string): string {
	return getSceneAnimationPreset(presetId)?.icon ?? 'material-symbols:animation'
}

export function resolveAnimationEffect(
	effect: SceneEffectJSON,
	obj: THREE.Object3D
): SceneEffectJSON {
	if (!effect.preset) {
		return effect
	}
	const preset = getSceneAnimationPreset(effect.preset)
	if (!preset) {
		return effect
	}
	const params = (effect.options ?? {}) as Record<string, number | string | boolean>
	return preset.buildEffect(params, obj)
}

export function presetLabel(presetId: string): string {
	return getSceneAnimationPreset(presetId)?.label ?? presetId
}

export function toStoredAnimationEffect(effect: SceneEffectJSON): SceneEffectJSON {
	const { properties: _p, ...stored } = effect
	return stored
}

export function nextAnimationEffectId(effects: SceneEffectJSON[]): number {
	let max = 0
	for (const e of effects) {
		if (e.type === 'animation' && typeof e.id === 'number' && e.id > max) {
			max = e.id
		}
	}
	return max + 1
}
