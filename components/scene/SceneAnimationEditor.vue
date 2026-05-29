<script setup lang="ts">
import type * as THREE from 'three'
import { SCENE_ANIMATION_PRESETS, getPresetIcon } from '@/utils/sceneAnimationPresets'
import { useSceneObjectAnimation } from '@/composables/useSceneObjectAnimation'
import type ThreeCore from '@/utils/threeCore'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{
	target: THREE.Object3D | null
	threeCore: ThreeCore | null
}>()

const emit = defineEmits<{ close: [] }>()

const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)
const show = ref(false)

const threeCoreRef = computed(() => props.threeCore)

const {
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
	togglePlayback,
	onPanelOpen
} = useSceneObjectAnimation(threeCoreRef, () => props.target)

function showPanel() {
	show.value = true
	nextTick(() => onPanelOpen())
}

function closePanel() {
	show.value = false
	emit('close')
}

defineExpose({ showPanel, closePanel })

watch(
	() => props.target?.uuid,
	() => {
		if (show.value) {
			nextTick(() => onPanelOpen())
		}
	}
)


let commitTimer: ReturnType<typeof setTimeout> | null = null
function scheduleCommit() {
	if (commitTimer) clearTimeout(commitTimer)
	commitTimer = setTimeout(() => {
		commitEditingParams()
		commitTimer = null
	}, 280)
}

function onParamChange(key: string, value: number | string | boolean) {
	setEditingParam(key, value)
	if (expandedEffectId.value != null) {
		scheduleCommit()
	}
}

function isPresetApplied(presetId: string) {
	return (appliedPresetCounts.value.get(presetId) ?? 0) > 0
}
</script>

<template>
	<Teleport to="body">
		<Transition :name="isMobile ? 'slide-bottom' : 'slide-right'">
			<div
				v-if="show && target"
				class="fixed z-[120] flex flex-col bg-white shadow-2xl dark:bg-gray-900"
				:class="
					isMobile
						? 'inset-x-0 bottom-0 max-h-[78vh] rounded-t-2xl border-t border-gray-200 dark:border-gray-700'
						: 'right-0 top-0 h-full w-[min(100%,280px)] border-l border-gray-200 dark:border-gray-700'
				"
			>
				<div
					class="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2.5 dark:border-gray-700"
				>
					<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">动效</h3>
					<div class="flex items-center gap-1">
						<button
							v-if="objectEffects.length"
							type="button"
							class="rounded-lg px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
							@click="togglePlayback"
						>
							{{ isAnimationsPaused ? '继续' : '停止' }}
						</button>
						<button
							type="button"
							class="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
							@click="closePanel"
						>
							<UIcon name="ant-design:close-outlined" class="text-lg" />
						</button>
					</div>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto p-3">
					<p class="mb-2 text-[10px] text-gray-400">点击图标添加动效</p>
					<div class="grid grid-cols-3 gap-2">
						<button
							v-for="preset in SCENE_ANIMATION_PRESETS"
							:key="preset.id"
							type="button"
							class="relative flex flex-col items-center gap-1 rounded-xl border py-2.5 transition active:scale-95"
							:class="
								isPresetApplied(preset.id)
									? 'border-violet-400 bg-violet-50 ring-2 ring-violet-400/60 dark:border-violet-600 dark:bg-violet-900/35 dark:ring-violet-500/50'
									: 'border-gray-100 bg-gray-50/90 hover:border-violet-300 hover:bg-violet-50/80 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:border-violet-700 dark:hover:bg-violet-900/25'
							"
							:title="preset.label"
							@click="applyPreset(preset.id)"
						>
							<span
								v-if="appliedPresetCounts.get(preset.id)"
								class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white"
							>
								{{ appliedPresetCounts.get(preset.id) }}
							</span>
							<UIcon
								:name="preset.icon"
								class="text-2xl"
								:class="
									isPresetApplied(preset.id)
										? 'text-violet-700 dark:text-violet-300'
										: 'text-violet-600 dark:text-violet-400'
								"
							/>
							<span class="text-[10px] font-medium text-gray-700 dark:text-gray-200">
								{{ preset.label }}
							</span>
						</button>
					</div>

					<section class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-[10px] font-medium text-gray-500">已应用</span>
							<span
								v-if="objectEffects.length"
								class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
							>
								{{ objectEffects.length }}
							</span>
						</div>

						<p
							v-if="!objectEffects.length"
							class="rounded-lg border border-dashed border-gray-200 px-2 py-3 text-center text-[10px] text-gray-400 dark:border-gray-600"
						>
							暂无动效
						</p>

						<ul v-else class="space-y-1.5">
							<li
								v-for="(eff, index) in objectEffects"
								:key="eff.id ?? `anim-${index}-${eff.preset}`"
								class="overflow-hidden rounded-lg border border-violet-200/80 bg-violet-50/50 dark:border-violet-800/60 dark:bg-violet-900/20"
								:class="expandedEffectId === eff.id ? 'ring-1 ring-violet-400' : ''"
							>
								<div class="flex items-center gap-1.5 px-2 py-1.5">
									<UIcon
										v-if="eff.preset"
										:name="getPresetIcon(eff.preset)"
										class="shrink-0 text-xl text-violet-600 dark:text-violet-400"
									/>
									<span class="min-w-0 flex-1 truncate text-[11px] font-medium text-violet-950 dark:text-violet-100">
										{{ eff.preset ? presetLabel(eff.preset) : '动效' }}
									</span>
									<button
										type="button"
										class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-violet-600 hover:bg-violet-100/80 dark:text-violet-300 dark:hover:bg-violet-800/40"
										@click="toggleEffectExpand(eff.id)"
									>
										{{ expandedEffectId === eff.id ? '收起' : '调参' }}
									</button>
									<button
										type="button"
										class="shrink-0 rounded p-0.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
										title="移除"
										@click="removeEffect(eff.id)"
									>
										<UIcon name="ant-design:close-outlined" class="text-sm" />
									</button>
								</div>

								<div
									v-if="expandedEffectId === eff.id && expandedPreset"
									class="space-y-2 border-t border-violet-200/60 bg-white/80 px-2 py-2 dark:border-violet-800/50 dark:bg-gray-900/60"
								>
									<template
										v-for="def in expandedPreset.paramDefs"
										:key="def.key"
									>
										<div
											v-if="def.type === 'boolean'"
											class="flex items-center justify-between gap-2"
										>
											<label class="text-[10px] text-gray-600 dark:text-gray-300">
												{{ def.label }}
											</label>
											<UToggle
												:model-value="Boolean(editingParams[def.key])"
												@update:model-value="onParamChange(def.key, $event)"
											/>
										</div>
										<div v-else-if="def.type === 'select'" class="space-y-0.5">
											<label class="text-[10px] text-gray-600 dark:text-gray-300">
												{{ def.label }}
											</label>
											<USelect
												:model-value="String(editingParams[def.key] ?? def.default)"
												:options="
													(def.options ?? []).map(o => ({
														label: o.label,
														value: o.value
													}))
												"
												size="xs"
												@update:model-value="onParamChange(def.key, $event)"
											/>
										</div>
										<div v-else class="space-y-0.5">
											<label class="text-[10px] text-gray-600 dark:text-gray-300">
												{{ def.label }}
											</label>
											<QhxNumberStepper
												:model-value="Number(editingParams[def.key] ?? def.default)"
												:min="def.min"
												:max="def.max"
												:step="def.step ?? 0.1"
												@update:model-value="onParamChange(def.key, $event)"
											/>
										</div>
									</template>
								</div>
							</li>
						</ul>
					</section>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
	transition:
		transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
		opacity 0.3s;
}
.slide-right-enter-from,
.slide-right-leave-to {
	transform: translateX(100%);
	opacity: 0;
}

.slide-bottom-enter-active,
.slide-bottom-leave-active {
	transition:
		transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
		opacity 0.3s;
}
.slide-bottom-enter-from,
.slide-bottom-leave-to {
	transform: translateY(100%);
	opacity: 0;
}
</style>
