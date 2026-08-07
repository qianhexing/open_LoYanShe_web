<script setup lang="ts">
import type * as THREE from 'three'
import type { ComponentPublicInstance } from 'vue'
import {
	SCENE_ANIMATION_PRESETS,
	SCENE_ANIMATION_TIMING_PARAMS,
	getPresetIcon,
	type AnimationParamDef
} from '@/utils/sceneAnimationPresets'
import { useSceneObjectAnimation } from '@/composables/useSceneObjectAnimation'
import type ThreeCore from '@/utils/threeCore'
import { useConfigStore } from '@/stores/config'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type { optionsInterface } from '@/components/Qhx/Select.vue'

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

const TIMING_KEYS = new Set(SCENE_ANIMATION_TIMING_PARAMS.map((d) => d.key))

const paramSections = computed(() => {
	const defs = expandedPreset.value?.paramDefs ?? []
	const feature = defs.filter((d) => !TIMING_KEYS.has(d.key))
	const timing = defs.filter((d) => TIMING_KEYS.has(d.key))
	return [
		{ title: '参数', defs: feature },
		{ title: '时间轴', defs: timing }
	].filter((s) => s.defs.length > 0)
})

const selectRefMap = new Map<string, InstanceType<typeof QhxSelect>>()

function bindSelectRef(key: string, el: Element | ComponentPublicInstance | null) {
	if (el) selectRefMap.set(key, el as InstanceType<typeof QhxSelect>)
	else selectRefMap.delete(key)
}

function openParamSelect(key: string, e: MouseEvent) {
	selectRefMap.get(key)?.showPicker(e)
}

function selectOptions(def: AnimationParamDef): optionsInterface[] {
	return (def.options ?? []).map((o) => ({ label: o.label, value: o.value }))
}

function selectDefault(def: AnimationParamDef): optionsInterface | null {
	const opts = selectOptions(def)
	const val = editingParams.value[def.key] ?? def.default
	return opts.find((o) => String(o.value) === String(val)) ?? opts[0] ?? null
}

function selectLabel(def: AnimationParamDef): string {
	return selectDefault(def)?.label ?? String(editingParams.value[def.key] ?? def.default ?? '')
}

function onSelectParam(key: string, opt: optionsInterface) {
	onParamChange(key, opt.value)
}

function paramHint(def: AnimationParamDef): string | null {
	if (def.key === 'startTime') return '已推进进度，用于错落；不是延迟'
	if (def.key === 'delay') return '开始前等待'
	if (def.key === 'repeat') return '-1 为无限循环'
	return null
}

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
				class="fixed z-[120] flex flex-col bg-white shadow-2xl dark:bg-gray-800"
				:class="
					isMobile
						? 'inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl'
						: 'right-0 top-0 h-full w-[min(100%,320px)] border-l border-gray-200 dark:border-gray-700'
				"
			>
				<div
					class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"
				>
					<div class="flex min-w-0 items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-qhx-primary/[0.12] ring-1 ring-inset ring-qhx-primary/20"
						>
							<UIcon
								name="material-symbols:animation"
								class="h-5 w-5 text-qhx-primary"
							/>
						</div>
						<div class="min-w-0">
							<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
								动效
							</h3>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								点击预设添加，展开调参
							</p>
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<button
							v-if="objectEffects.length"
							type="button"
							class="rounded-full px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
							@click="togglePlayback"
						>
							{{ isAnimationsPaused ? '继续' : '停止' }}
						</button>
						<button
							type="button"
							class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
							aria-label="关闭"
							@click="closePanel"
						>
							<UIcon name="ant-design:close-outlined" class="text-lg" />
						</button>
					</div>
				</div>

				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
					<section
						class="space-y-3 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-3.5 dark:border-gray-600/80 dark:bg-gray-900/40"
					>
						<div class="flex items-center justify-between gap-2">
							<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
								预设
							</h4>
							<span class="text-[11px] text-gray-400">可重复添加</span>
						</div>
						<div class="grid grid-cols-3 gap-2">
							<button
								v-for="preset in SCENE_ANIMATION_PRESETS"
								:key="preset.id"
								type="button"
								class="relative flex flex-col items-center gap-1.5 rounded-xl border bg-white py-2.5 transition active:scale-[0.97] dark:bg-gray-900/50"
								:class="
									isPresetApplied(preset.id)
										? 'border-qhx-primary ring-2 ring-qhx-primary/35 shadow-sm'
										: 'border-gray-200 hover:border-qhx-primary/45 hover:shadow-sm dark:border-gray-600 dark:hover:border-qhx-primary/40'
								"
								:title="preset.label"
								@click="applyPreset(preset.id)"
							>
								<span
									v-if="appliedPresetCounts.get(preset.id)"
									class="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-qhx-primary px-1 text-[9px] font-bold text-white"
								>
									{{ appliedPresetCounts.get(preset.id) }}
								</span>
								<UIcon
									:name="preset.icon"
									class="text-2xl text-qhx-primary"
								/>
								<span class="text-[11px] font-medium text-gray-700 dark:text-gray-200">
									{{ preset.label }}
								</span>
							</button>
						</div>
					</section>

					<section
						class="space-y-3 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-3.5 dark:border-gray-600/80 dark:bg-gray-900/40"
					>
						<div class="flex items-center justify-between gap-2">
							<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
								已应用
							</h4>
							<span
								v-if="objectEffects.length"
								class="rounded-full bg-qhx-primary/15 px-2 py-0.5 text-[11px] font-medium text-qhx-primary"
							>
								{{ objectEffects.length }}
							</span>
						</div>

						<p
							v-if="!objectEffects.length"
							class="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400 dark:border-gray-600"
						>
							暂无动效，点上方预设添加
						</p>

						<ul v-else class="space-y-2">
							<li
								v-for="(eff, index) in objectEffects"
								:key="eff.id ?? `anim-${index}-${eff.preset}`"
								class="overflow-hidden rounded-xl border bg-white transition dark:bg-gray-900/55"
								:class="
									expandedEffectId === eff.id
										? 'border-qhx-primary/50 shadow-sm ring-1 ring-qhx-primary/25'
										: 'border-gray-200 dark:border-gray-600'
								"
							>
								<div class="flex items-center gap-2 px-2.5 py-2">
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-qhx-primary/[0.1]"
									>
										<UIcon
											v-if="eff.preset"
											:name="getPresetIcon(eff.preset)"
											class="text-lg text-qhx-primary"
										/>
									</div>
									<span
										class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100"
									>
										{{ eff.preset ? presetLabel(eff.preset) : '动效' }}
									</span>
									<button
										type="button"
										class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
										:class="
											expandedEffectId === eff.id
												? 'bg-qhx-primary/15 text-qhx-primary'
												: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
										"
										@click="toggleEffectExpand(eff.id)"
									>
										{{ expandedEffectId === eff.id ? '收起' : '调参' }}
									</button>
									<button
										type="button"
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
										title="移除"
										@click="removeEffect(eff.id)"
									>
										<UIcon name="ant-design:close-outlined" class="text-sm" />
									</button>
								</div>

								<div
									v-if="expandedEffectId === eff.id && expandedPreset"
									class="space-y-4 border-t border-gray-100 px-3 py-3 dark:border-gray-700"
								>
									<section
										v-for="section in paramSections"
										:key="section.title"
										class="space-y-3"
									>
										<p class="text-[11px] font-medium uppercase tracking-wide text-gray-400">
											{{ section.title }}
										</p>

										<template v-for="def in section.defs" :key="def.key">
											<div
												v-if="def.type === 'boolean'"
												class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-800/50"
											>
												<label class="text-sm font-medium text-gray-700 dark:text-gray-200">
													{{ def.label }}
												</label>
												<UToggle
													:model-value="Boolean(editingParams[def.key])"
													@update:model-value="onParamChange(def.key, $event)"
												/>
											</div>

											<div
												v-else-if="def.type === 'select'"
												class="space-y-1.5"
											>
												<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
													{{ def.label }}
												</label>
												<button
													type="button"
													class="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900/50 dark:hover:bg-gray-900/80"
													@click="openParamSelect(def.key, $event)"
												>
													<span class="text-sm text-gray-800 dark:text-gray-200">
														{{ selectLabel(def) }}
													</span>
													<span class="text-xs text-gray-400">选择</span>
												</button>
												<QhxSelect
													:ref="(el) => bindSelectRef(def.key, el)"
													:options="selectOptions(def)"
													:default-value="selectDefault(def)"
													@select="onSelectParam(def.key, $event)"
												/>
											</div>

											<div v-else class="space-y-1.5">
												<div class="flex items-center justify-between gap-3">
													<div class="min-w-0">
														<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
															{{ def.label }}
														</label>
														<p
															v-if="paramHint(def)"
															class="mt-0.5 text-[10px] leading-snug text-gray-400"
														>
															{{ paramHint(def) }}
														</p>
													</div>
													<QhxNumberStepper
														size="sm"
														:model-value="Number(editingParams[def.key] ?? def.default)"
														:min="def.min"
														:max="def.max"
														:step="def.step ?? 0.1"
														@update:model-value="onParamChange(def.key, $event)"
													/>
												</div>
											</div>
										</template>
									</section>
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
