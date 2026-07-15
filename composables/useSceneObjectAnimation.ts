import type { Ref } from 'vue'
import type * as THREE from 'three'
import type ThreeCore from '@/utils/threeCore'
import type { SceneEffectJSON } from '@/utils/threeCore'
import {
	getDefaultPresetParams,
	getSceneAnimationPreset,
	nextAnimationEffectId,
	presetLabel,
	toStoredAnimationEffect
} from '@/utils/sceneAnimationPresets'

const ANIMATABLE_TYPES = new Set([
	'model',
	'character',
	'box',
	'sphere',
	'image',
	'canvas',
	'3Dtext',
	'template',
	'splat',
	'eztree'
])

export function isAnimatableSceneObject(obj: THREE.Object3D | null | undefined): boolean {
	if (!obj?.userData?.type) return false
	return ANIMATABLE_TYPES.has(String(obj.userData.type))
}

export function ensureObjectEffectList(obj: THREE.Object3D): SceneEffectJSON[] {
	if (!Array.isArray(obj.userData.effect)) {
		obj.userData.effect = []
	}
	return obj.userData.effect as SceneEffectJSON[]
}

function replayAllAnimations(
	core: ThreeCore,
	obj: THREE.Object3D,
	_list: SceneEffectJSON[]
) {
	core.ensureAnimationBaseTransform(obj)
	core.reapplyGsapAnimations(obj)
	if (core.editMode) {
		core.syncSatelliteOrbitHelpers()
	}
}

function normalizeAnimationEffects(obj: THREE.Object3D) {
	const list = ensureObjectEffectList(obj)
	for (const e of list) {
		if (!isGsapAnimationEffect(e)) continue
		if (!e.type) e.type = 'animation'
		if (e.id === undefined) {
			e.id = nextAnimationEffectId(list)
		}
	}
}

function isGsapAnimationEffect(e: SceneEffectJSON): boolean {
	return e.type === 'animation' || Boolean(e.preset)
}

function listAnimationEffects(obj: THREE.Object3D): SceneEffectJSON[] {
	return ensureObjectEffectList(obj).filter(isGsapAnimationEffect)
}

export function useSceneObjectAnimation(
	threeCore: Ref<ThreeCore | null | undefined>,
	getTarget: () => THREE.Object3D | null
) {
	/** 展开详细参数编辑的动效 id */
	const expandedEffectId = ref<number | null>(null)
	const editingParams = ref<Record<string, number | string | boolean>>({})
	/** 触发 objectEffects 重新读取 userData.effect */
	const effectsRevision = ref(0)
	/** 已手动暂停动效的物体 uuid */
	const pausedObjectUuids = ref<Set<string>>(new Set())

	function bumpEffectsRevision() {
		effectsRevision.value++
	}

	function markObjectPlaying(obj: THREE.Object3D) {
		if (!pausedObjectUuids.value.has(obj.uuid)) return
		const next = new Set(pausedObjectUuids.value)
		next.delete(obj.uuid)
		pausedObjectUuids.value = next
	}

	function markObjectPaused(obj: THREE.Object3D) {
		if (pausedObjectUuids.value.has(obj.uuid)) return
		pausedObjectUuids.value = new Set([...pausedObjectUuids.value, obj.uuid])
	}

	const isAnimationsPaused = computed(() => {
		pausedObjectUuids.value
		const obj = getTarget()
		return obj ? pausedObjectUuids.value.has(obj.uuid) : false
	})

	const objectEffects = computed((): SceneEffectJSON[] => {
		effectsRevision.value
		const obj = getTarget()
		if (!obj) return []
		return listAnimationEffects(obj)
	})

	const appliedPresetCounts = computed(() => {
		const map = new Map<string, number>()
		for (const e of objectEffects.value) {
			if (!e.preset) continue
			map.set(e.preset, (map.get(e.preset) ?? 0) + 1)
		}
		return map
	})

	const expandedEffect = computed(() =>
		objectEffects.value.find(e => e.id === expandedEffectId.value)
	)

	const expandedPreset = computed(() => {
		const eff = expandedEffect.value
		if (!eff?.preset) return undefined
		return getSceneAnimationPreset(eff.preset)
	})

	function stopAll() {
		const obj = getTarget()
		const core = threeCore.value
		if (!obj || !core) return
		core.killObjectGsapAnimations(obj)
		markObjectPaused(obj)
	}

	function resumeAll() {
		const obj = getTarget()
		const core = threeCore.value
		if (!obj || !core) return
		const anims = listAnimationEffects(obj)
		if (anims.length > 0) {
			replayAllAnimations(core, obj, anims)
		}
		markObjectPlaying(obj)
	}

	function togglePlayback() {
		if (isAnimationsPaused.value) {
			resumeAll()
		} else {
			stopAll()
		}
	}

	/** 点击预设图标：默认参数立即应用到物体 */
	function applyPreset(presetId: string) {
		const obj = getTarget()
		const core = threeCore.value
		const preset = getSceneAnimationPreset(presetId)
		if (!obj || !core || !preset) return

		const params = getDefaultPresetParams(preset)
		const draft = preset.buildEffect(params, obj)
		const list = ensureObjectEffectList(obj)
		const stored = toStoredAnimationEffect({
			...draft,
			id: nextAnimationEffectId(list)
		})
		list.push(stored)
		bumpEffectsRevision()
		replayAllAnimations(core, obj, listAnimationEffects(obj))
		markObjectPlaying(obj)
	}

	function removeEffect(effectId: number | undefined) {
		const obj = getTarget()
		const core = threeCore.value
		if (!obj || effectId === undefined || !core) return
		const list = ensureObjectEffectList(obj)
		const idx = list.findIndex(
			e => isGsapAnimationEffect(e) && e.id === effectId
		)
		if (idx >= 0) {
			list.splice(idx, 1)
		}
		if (expandedEffectId.value === effectId) {
			expandedEffectId.value = null
		}
		bumpEffectsRevision()
		replayAllAnimations(core, obj, listAnimationEffects(obj))
		markObjectPlaying(obj)
	}

	function toggleEffectExpand(effectId: number | undefined) {
		if (effectId === undefined) return
		if (expandedEffectId.value === effectId) {
			expandedEffectId.value = null
			return
		}
		const eff = objectEffects.value.find(e => e.id === effectId)
		if (!eff?.preset) return
		const preset = getSceneAnimationPreset(eff.preset)
		if (!preset) return
		expandedEffectId.value = effectId
		editingParams.value = {
			...getDefaultPresetParams(preset),
			...(eff.options ?? {})
		}
	}

	function setEditingParam(key: string, value: number | string | boolean) {
		editingParams.value = { ...editingParams.value, [key]: value }
	}

	function commitEditingParams() {
		const obj = getTarget()
		const core = threeCore.value
		const eff = expandedEffect.value
		const preset = expandedPreset.value
		if (!obj || !core || !eff || eff.id === undefined || !preset) return

		const list = ensureObjectEffectList(obj)
		const idx = list.findIndex(e => e.id === eff.id)
		if (idx < 0) return

		const draft = preset.buildEffect(editingParams.value, obj)
		list[idx] = toStoredAnimationEffect({
			...draft,
			id: eff.id
		})
		bumpEffectsRevision()
		replayAllAnimations(core, obj, listAnimationEffects(obj))
		markObjectPlaying(obj)
	}

	/** 打开面板：规范化已存动效并回显、重播 */
	function onPanelOpen() {
		const obj = getTarget()
		const core = threeCore.value
		if (!obj || !core) return
		normalizeAnimationEffects(obj)
		bumpEffectsRevision()
		expandedEffectId.value = null
		const anims = listAnimationEffects(obj)
		if (anims.length > 0 && !pausedObjectUuids.value.has(obj.uuid)) {
			replayAllAnimations(core, obj, anims)
		}
	}

	watch(
		() => getTarget()?.uuid,
		(newId, oldId) => {
			expandedEffectId.value = null
			// 仅在切换到另一物体时停止，关闭面板清空 target 不停止
			if (
				oldId !== undefined
				&& newId !== undefined
				&& oldId !== newId
			) {
				stopAll()
			}
			bumpEffectsRevision()
		}
	)

	return {
		objectEffects,
		appliedPresetCounts,
		expandedEffectId,
		editingParams,
		expandedPreset,
		presetLabel,
		applyPreset,
		removeEffect,
		toggleEffectExpand,
		setEditingParam,
		commitEditingParams,
		isAnimationsPaused,
		stopAll,
		resumeAll,
		togglePlayback,
		onPanelOpen,
		isAnimatableSceneObject
	}
}
