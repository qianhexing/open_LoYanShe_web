import * as THREE from 'three'
import { LoopOnce, LoopRepeat } from 'three'
import type { AnimationAction, AnimationClip } from 'three'
import type ThreeCore from './threeCore'

/** 与 glTF 中 AnimationClip.name 一致 */
export interface CharacterStandAlternate {
	name: string
	weight: number
}

export interface CharacterTypeConfig {
	id?: string
	stand: {
		primary: string
		/** 主站立权重，参与随机；默认 1 */
		primaryWeight?: number
		alternates?: CharacterStandAlternate[]
	}
	/** 主站立或当前站立每循环 / 定时间隔 时，按权随机换站立（不适用于播放扩展动作期间） */
	standResample?: {
		/** 当前站立动画每完整循环一次后重采样 */
		onPrimaryLoop?: boolean
		/** 定时间隔（秒）重采样，与 onPrimaryLoop 可同时存在 */
		intervalSec?: number
	}
	/** 扩展动作名；点击时轮播或指名播放，播完回到主站立；缺省为 [] */
	extras?: string[]
	crossFadeDuration?: number
	/** 未设置 onClick 为页面注入时：extraRoundRobin 为点击则播放下一个 extra；customOnly 则不自动 */
	defaultClickBehavior?: 'extraRoundRobin' | 'customOnly'
	/** 点击时弹窗标题 */
	dialogueTitle?: string
	/** 单段对话正文 */
	dialogueText?: string
	/** 多句中随机显示一句；非空时优先于 dialogueText */
	dialogueLines?: string[]
}

export interface CharacterClickContext {
	controller: CharacterTypeController
	/** 当前是否正在播扩展动作 */
	playingExtra: boolean
	/** 当前站立动画 clip 名 */
	currentStandName: string
	extraNames: string[]
	playNextExtra: () => void
	playExtraByName: (name: string) => void
	returnToStand: () => void
	/** 从 DOM 事件传递（若有） */
	domEvent?: MouseEvent
}

function buildClipNameMap(
	clips: AnimationClip[] | null
): Map<string, AnimationClip> {
	const m = new Map<string, AnimationClip>()
	if (!clips?.length) return m
	for (const c of clips) {
		m.set(c.name, c)
	}
	return m
}

function pickWeighted(choices: { name: string; weight: number }[]): string {
	if (choices.length === 0) {
		return ''
	}
	const sum = choices.reduce((a, c) => a + Math.max(0, c.weight), 0)
	if (sum <= 0) {
		const c0 = choices[0]
		return c0 ? c0.name : ''
	}
	let r = Math.random() * sum
	for (const c of choices) {
		r -= Math.max(0, c.weight)
		if (r <= 0) {
			return c.name
		}
	}
	const last = choices[choices.length - 1]
	return last ? last.name : ''
}

export class CharacterTypeController {
	public readonly config: CharacterTypeConfig
	public readonly root: THREE.Object3D
	private readonly core: ThreeCore
	/** 用于 UI 区分的资源 URL，与 getLoadedAnimationClips 的键一致 */
	public readonly modelUrl: string
	private readonly mixer: THREE.AnimationMixer
	private actions = new Map<string, AnimationAction>()

	private currentStandName: string
	private currentStandAction: AnimationAction
	private currentExtraAction: AnimationAction | null = null
	private playingExtra = false
	private extraRoundIndex = 0
	private standChoices: { name: string; weight: number }[] = []

	private crossFade: number
	private onClickHandler:
		| ((ctx: CharacterClickContext) => void | Promise<void>)
		| null = null

	private boundMixerLoop = (e: {
		action: AnimationAction
		loopDelta: number
	}) => {
		if (this.playingExtra) {
			return
		}
		if (!this.config.standResample?.onPrimaryLoop) {
			return
		}
		if (e.action !== this.currentStandAction) {
			return
		}
		this.tryResampleStand()
	}

	private boundMixerFinished = (e: {
		action: AnimationAction
		direction: number
	}) => {
		if (!this.playingExtra || !this.currentExtraAction) {
			return
		}
		if (e.action === this.currentExtraAction) {
			this.onExtraFinished()
		}
	}

	private resampleInterval: ReturnType<typeof setInterval> | null = null
	private clickDom: HTMLElement | null = null
	private clickCamera: THREE.Camera | null = null
	private boundClick: ((ev: MouseEvent) => void) | null = null

	private raycaster = new THREE.Raycaster()
	private pointer = new THREE.Vector2()

	constructor(options: {
		core: ThreeCore
		root: THREE.Object3D
		modelUrl: string
		config: CharacterTypeConfig
	}) {
		this.core = options.core
		this.root = options.root
		this.modelUrl = options.modelUrl
		this.config = options.config
		this.crossFade = options.config.crossFadeDuration ?? 0.35
		if (options.config.id) {
			this.root.userData.characterTypeId = options.config.id
		}

		const clips = this.core.getLoadedAnimationClips(this.modelUrl)
		const byName = buildClipNameMap(clips)
		if (!options.config.stand?.primary) {
			throw new Error('CharacterTypeConfig.stand.primary 必填')
		}
		if (!byName.get(options.config.stand.primary) && import.meta.env.DEV) {
			console.warn(
				'[CharacterTypeController] 未找到站立动画 clip:',
				options.config.stand.primary
			)
		}
		if (import.meta.env.DEV && options.config.extras) {
			for (const n of options.config.extras) {
				if (!byName.get(n)) {
					console.warn('[CharacterTypeController] 未找到扩展动作 clip:', n)
				}
			}
		}

		this.mixer = new THREE.AnimationMixer(this.root)
		this.core.mixers.push(this.mixer)
		this.mixer.addEventListener('loop', this.boundMixerLoop)
		this.mixer.addEventListener('finished', this.boundMixerFinished)

		const pw = options.config.stand.primaryWeight ?? 1
		this.standChoices = [
			{ name: options.config.stand.primary, weight: pw },
			...(options.config.stand.alternates ?? [])
		]

		// 预建配置中用到的 clip，并补全 glTF 中其余 clip，供面板枚举与切换
		const allNames = new Set<string>([
			options.config.stand.primary,
			...this.standChoices.map(s => s.name),
			...(options.config.extras ?? [])
		])
		for (const name of allNames) {
			const clip = byName.get(name)
			if (!clip) {
				continue
			}
			this.actions.set(name, this.mixer.clipAction(clip))
		}
		for (const [name, clip] of byName.entries()) {
			if (this.actions.has(name)) {
				continue
			}
			this.actions.set(name, this.mixer.clipAction(clip))
		}

		const pAct = this.actions.get(options.config.stand.primary)
		if (!pAct) {
			if (import.meta.env.DEV) {
				console.warn(
					'[CharacterTypeController] 主站立未解析，无动画可播:',
					options.config.stand.primary
				)
			}
		} else {
			pAct.setLoop(LoopRepeat, Number.POSITIVE_INFINITY)
			pAct.reset()
			pAct.setEffectiveWeight(1)
			pAct.play()
		}
		for (const { name } of this.standChoices) {
			if (name === options.config.stand.primary) {
				continue
			}
			const a = this.actions.get(name)
			if (!a) {
				continue
			}
			a.setLoop(LoopRepeat, Number.POSITIVE_INFINITY)
			a.reset()
			a.setEffectiveWeight(0)
			a.play()
		}
		for (const n of options.config.extras ?? []) {
			const a = this.actions.get(n)
			if (a) {
				a.setLoop(LoopOnce, 1)
				a.clampWhenFinished = true
			}
		}

		this.currentStandName = options.config.stand.primary
		const firstStand = this.actions.get(options.config.stand.primary) ?? pAct
		if (!firstStand) {
			throw new Error(
				'[CharacterTypeController] 无法解析主站立 Action，请检查模型动画名'
			)
		}
		this.currentStandAction = firstStand

		const interval = options.config.standResample?.intervalSec
		if (interval && interval > 0) {
			this.resampleInterval = setInterval(() => {
				if (this.playingExtra) {
					return
				}
				if (!this.config.standResample?.intervalSec) {
					return
				}
				this.tryResampleStand()
			}, interval * 1000)
		}
	}

	get isPlayingExtra(): boolean {
		return this.playingExtra
	}

	get currentStand(): string {
		return this.currentStandName
	}

	/** 该模型上全部已绑定 clip 名（与 glTF 中动画名一致） */
	getClipNameList(): string[] {
		return Array.from(this.actions.keys()).sort((a, b) => a.localeCompare(b))
	}

	/** 由 UI 选择名称切换：站立组循环，其余按一次性动作播完回主站立 */
	playUserSelectedAnimation(clipName: string): void {
		if (!this.actions.has(clipName)) {
			if (import.meta.env.DEV) {
				console.warn('[CharacterTypeController] 无此动画:', clipName)
			}
			return
		}
		const isStand = this.standChoices.some(s => s.name === clipName)
		if (isStand) {
			if (this.playingExtra && this.currentExtraAction) {
				this.currentExtraAction.stop()
				this.playingExtra = false
				this.currentExtraAction = null
			}
			this.crossfadeStandToName(clipName)
			return
		}
		this.playExtraByName(clipName)
	}

	/** 站立随机重采样，含主站立 + alternates 权重 */
	private tryResampleStand(): void {
		if (this.playingExtra) {
			return
		}
		if (this.standChoices.length <= 1) {
			return
		}
		const nextName = pickWeighted(this.standChoices)
		if (nextName === this.currentStandName) {
			return
		}
		this.crossfadeStandToName(nextName)
	}

	private crossfadeStandToName(nextName: string): void {
		const from = this.currentStandAction
		const to = this.actions.get(nextName)
		if (!to) {
			if (import.meta.env.DEV) {
				console.warn(
					'[CharacterTypeController] tryResampleStand: 无 action',
					nextName
				)
			}
			return
		}
		to.setLoop(LoopRepeat, Number.POSITIVE_INFINITY)
		to.setEffectiveWeight(0)
		to.play()
		if (from && from !== to) {
			from.crossFadeTo(to, this.crossFade, false)
		} else {
			to.setEffectiveWeight(1)
		}
		this.currentStandName = nextName
		this.currentStandAction = to
	}

	playExtraByName(name: string): void {
		const ex = this.actions.get(name)
		if (!ex) {
			if (import.meta.env.DEV) {
				console.warn('[CharacterTypeController] 无此扩展动作:', name)
			}
			return
		}
		// 若已有扩展，先切到新扩展
		if (this.currentExtraAction && this.currentExtraAction !== ex) {
			this.currentExtraAction.stop()
		}
		this.playingExtra = true
		ex.setLoop(LoopOnce, 1)
		ex.clampWhenFinished = true
		ex.reset()
		ex.setEffectiveWeight(0)
		ex.play()
		this.currentExtraAction = ex
		if (this.currentStandAction) {
			this.currentStandAction.crossFadeTo(ex, this.crossFade, false)
		} else {
			ex.setEffectiveWeight(1)
		}
	}

	playNextExtra(): void {
		const ex = this.config.extras
		if (!ex?.length) {
			return
		}
		const i = this.extraRoundIndex % ex.length
		const n = ex[i]
		if (n === undefined) {
			return
		}
		this.extraRoundIndex = (this.extraRoundIndex + 1) % ex.length
		this.playExtraByName(n)
	}

	/**
	 * 若正在播扩展动作则插值回主站立；否则从当前换姿站立回到主站立
	 */
	returnToStand = (): void => {
		if (this.playingExtra && this.currentExtraAction) {
			const ex = this.currentExtraAction
			const p = this.actions.get(this.config.stand.primary)
			if (ex && p) {
				this.playingExtra = false
				this.currentExtraAction = null
				p.setLoop(LoopRepeat, Number.POSITIVE_INFINITY)
				p.reset()
				p.setEffectiveWeight(0)
				p.play()
				ex.crossFadeTo(p, this.crossFade, false)
				this.currentStandName = this.config.stand.primary
				this.currentStandAction = p
			} else {
				this.playingExtra = false
				this.currentExtraAction = null
			}
			return
		}
		if (this.currentStandName !== this.config.stand.primary) {
			this.crossfadeStandToName(this.config.stand.primary)
		}
	}

	private onExtraFinished(): void {
		const ex = this.currentExtraAction
		const pName = this.config.stand.primary
		const p = this.actions.get(pName)
		if (!ex || !p) {
			this.playingExtra = false
			this.currentExtraAction = null
			return
		}
		this.playingExtra = false
		this.currentExtraAction = null
		p.setLoop(LoopRepeat, Number.POSITIVE_INFINITY)
		p.reset()
		p.setEffectiveWeight(0)
		p.play()
		ex.crossFadeTo(p, this.crossFade, false)
		this.currentStandName = pName
		this.currentStandAction = p
	}

	/**
	 * 在画布上绑定点击：命中 root 子网格时触发
	 */
	attachClick(dom: HTMLElement, camera: THREE.Camera): void {
		this.detachClick()
		this.clickDom = dom
		this.clickCamera = camera
		this.boundClick = (ev: MouseEvent) => {
			if (!this.clickCamera) {
				return
			}
			const rect = dom.getBoundingClientRect()
			this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
			this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
			this.raycaster.setFromCamera(this.pointer, this.clickCamera)
			const hits = this.raycaster.intersectObject(this.root, true)
			if (hits.length === 0) {
				return
			}
			this.runClick(ev)
		}
		dom.addEventListener('click', this.boundClick)
	}

	detachClick(): void {
		if (this.clickDom && this.boundClick) {
			this.clickDom.removeEventListener('click', this.boundClick)
		}
		this.clickDom = null
		this.clickCamera = null
		this.boundClick = null
	}

	/** 仅调用侧已有射线结果时，可直调此逻辑 */
	setOnClick(
		handler: ((ctx: CharacterClickContext) => void | Promise<void>) | null
	): void {
		this.onClickHandler = handler
	}

	private buildContext(ev?: MouseEvent): CharacterClickContext {
		return {
			controller: this,
			playingExtra: this.playingExtra,
			currentStandName: this.currentStandName,
			extraNames: [...(this.config.extras ?? [])],
			playNextExtra: () => this.playNextExtra(),
			playExtraByName: (n: string) => this.playExtraByName(n),
			returnToStand: () => this.returnToStand(),
			domEvent: ev
		}
	}

	private runClick(ev: MouseEvent): void {
		const ctx = this.buildContext(ev)
		const def = this.config.defaultClickBehavior ?? 'extraRoundRobin'
		if (this.onClickHandler) {
			const r = this.onClickHandler(ctx)
			if (r && typeof (r as Promise<void>).then === 'function') {
				;(r as Promise<void>).catch(() => {})
			}
			return
		}
		if (def === 'extraRoundRobin' && this.config.extras?.length) {
			ctx.playNextExtra()
		}
	}

	dispose(): void {
		this.detachClick()
		if (this.resampleInterval) {
			clearInterval(this.resampleInterval)
			this.resampleInterval = null
		}
		this.mixer.removeEventListener('loop', this.boundMixerLoop)
		this.mixer.removeEventListener('finished', this.boundMixerFinished)
		this.mixer.stopAllAction()
		const i = this.core.mixers.indexOf(this.mixer)
		if (i >= 0) {
			this.core.mixers.splice(i, 1)
		}
	}
}

/**
 * 应用侧可维护的「多角色类型」元数据；GLB 仍走 {@link ThreeCore.loadModel} 的 URL 缓存
 */
export function createCharacterTypeRegistry() {
	const list: CharacterTypeConfig[] = []
	return {
		register(c: CharacterTypeConfig) {
			list.push(c)
		},
		getAll(): CharacterTypeConfig[] {
			return [...list]
		},
		getById(id: string) {
			return list.find(t => t.id === id)
		}
	}
}
