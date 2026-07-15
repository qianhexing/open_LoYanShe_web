<script setup lang="ts">
import { EZ_TREE_PRESETS, type EzTreePresetKind } from '@/utils/ezTree'
import {
	beginScenePlantPointerDrag,
	shouldSuppressPlantClick,
	type ScenePlantDragItem
} from '@/utils/scenePlantDrag'
import { useSceneStore } from '@/stores/sence'

const props = withDefaults(
	defineProps<{
		/** 与点云冲突时禁用选择/拖拽 */
		blocked?: boolean
		blockedReason?: string
	}>(),
	{
		blocked: false,
		blockedReason: '当前不可添加植物'
	}
)

const sceneStore = useSceneStore()

const emit = defineEmits<{
	choose: [presetId: string]
}>()

const kindIcon: Record<EzTreePresetKind, string> = {
	ash: 'material-symbols:park-rounded',
	aspen: 'material-symbols:forest',
	bush: 'material-symbols:grass',
	oak: 'material-symbols:park-rounded',
	pine: 'material-symbols:forest',
	maple: 'material-symbols:emoji-nature',
	cherry: 'material-symbols:local-florist',
	willow: 'material-symbols:water',
	birch: 'material-symbols:forest',
	cypress: 'material-symbols:spa',
	spruce: 'material-symbols:forest',
	ginkgo: 'material-symbols:eco',
	olive: 'material-symbols:psychiatry',
	dogwood: 'material-symbols:local-florist-rounded',
	lavender: 'material-symbols:filter-vintage',
	autumn: 'material-symbols:temp-preferences-eco',
	trellis: 'material-symbols:grid-view',
	acacia: 'material-symbols:landscape',
	dead: 'material-symbols:nature'
}

const kindTone: Record<EzTreePresetKind, string> = {
	ash: 'from-emerald-400 to-emerald-700',
	aspen: 'from-lime-300 to-green-600',
	bush: 'from-green-400 to-teal-700',
	oak: 'from-green-500 to-emerald-800',
	pine: 'from-teal-500 to-green-900',
	maple: 'from-orange-400 to-red-700',
	cherry: 'from-pink-300 to-rose-500',
	willow: 'from-lime-400 to-emerald-700',
	birch: 'from-stone-200 to-emerald-600',
	cypress: 'from-emerald-600 to-teal-900',
	spruce: 'from-sky-400 to-slate-700',
	ginkgo: 'from-amber-300 to-yellow-600',
	olive: 'from-lime-600 to-yellow-800',
	dogwood: 'from-rose-100 to-pink-400',
	lavender: 'from-violet-300 to-purple-700',
	autumn: 'from-amber-400 to-orange-700',
	trellis: 'from-green-400 to-stone-600',
	acacia: 'from-yellow-300 to-lime-700',
	dead: 'from-stone-400 to-stone-700'
}

function toDragItem(preset: (typeof EZ_TREE_PRESETS)[number]): ScenePlantDragItem {
	return {
		presetId: preset.id,
		label: preset.label,
		kind: preset.kind
	}
}

function handleClick(presetId: string) {
	if (props.blocked) return
	if (shouldSuppressPlantClick()) return
	emit('choose', presetId)
}

function onPointerDown(preset: (typeof EZ_TREE_PRESETS)[number], e: PointerEvent) {
	if (props.blocked) return
	if (e.button !== 0) return
	beginScenePlantPointerDrag(toDragItem(preset), e)
}
</script>

<template>
	<div class="p-1 pb-4 space-y-1">
		<div
			v-if="blocked"
			class="rounded-lg border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 px-2 py-2 mb-1"
		>
			<p class="text-[10px] leading-snug text-amber-800 dark:text-amber-200 font-medium">
				与点云冲突
			</p>
			<p class="text-[10px] leading-snug text-amber-700/90 dark:text-amber-300/90 mt-0.5">
				{{ blockedReason }}
			</p>
		</div>
		<p
			v-else
			class="px-0.5 pb-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400"
		>
			点击放到视野中心，或拖到地面松手放置
		</p>
		<div
			v-for="preset in EZ_TREE_PRESETS"
			:key="preset.id"
			class="w-full relative flex flex-col items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-md transition-colors"
			:class="
				blocked
					? 'opacity-45 cursor-not-allowed'
					: 'cursor-grab active:cursor-grabbing touch-none hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-95'
			"
			:title="blocked ? blockedReason : `${preset.label} · 拖到场景地面松手放置`"
			@click="handleClick(preset.id)"
			@pointerdown="onPointerDown(preset, $event)"
		>
			<div
				class="w-[50px] h-[50px] rounded-md border border-white/30 shadow-sm flex items-center justify-center bg-gradient-to-br pointer-events-none ring-1 ring-black/5"
				:class="kindTone[preset.kind] || kindTone.oak"
			>
				<UIcon
					:name="kindIcon[preset.kind] || kindIcon.oak"
					class="text-2xl text-white drop-shadow"
				/>
			</div>
			<div class="w-full px-0.5">
				<h3 class="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate text-center leading-tight">
					{{ preset.label }}
				</h3>
			</div>
			<div
				v-if="sceneStore.loading"
				class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-md"
			>
				<span class="text-[10px] text-gray-600 dark:text-gray-400">生成中…</span>
			</div>
		</div>
	</div>
</template>
