<script setup lang="ts">
import {
	formatTriangles,
	type SceneResourceSnapshot
} from '@/utils/sceneResourceMonitor'

const props = defineProps<{
	snapshot: SceneResourceSnapshot
	contextLost?: boolean
}>()

const emit = defineEmits<{
	close: []
}>()

const riskLabel = computed(() => {
	if (props.contextLost) return 'WebGL 已丢失'
	if (props.snapshot.risk === 'danger') return '危险'
	if (props.snapshot.risk === 'warn') return '偏高'
	return '正常'
})

const riskClass = computed(() => {
	if (props.contextLost || props.snapshot.risk === 'danger') {
		return 'border-rose-400/70 bg-rose-950/80 text-rose-50'
	}
	if (props.snapshot.risk === 'warn') {
		return 'border-amber-400/60 bg-amber-950/75 text-amber-50'
	}
	return 'border-white/15 bg-black/55 text-white'
})

const heapText = computed(() => {
	const u = props.snapshot.jsHeapUsedMb
	const l = props.snapshot.jsHeapLimitMb
	if (u == null || l == null) return '—'
	return `${u.toFixed(0)} / ${l} MB`
})
</script>

<template>
	<div
		class="pointer-events-auto fixed z-[45] w-[min(292px,calc(100vw-1.5rem))] rounded-xl border backdrop-blur-md shadow-xl select-none"
		:class="[
			riskClass,
			'right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-3'
		]"
	>
		<div class="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
			<div class="flex items-center gap-1.5 min-w-0">
				<UIcon name="material-symbols:memory-alt-rounded" class="text-base shrink-0 opacity-90" />
				<span class="text-[11px] font-semibold tracking-wide">资源占用</span>
				<span
					class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
					:class="
						contextLost || snapshot.risk === 'danger'
							? 'bg-rose-500/90 text-white'
							: snapshot.risk === 'warn'
								? 'bg-amber-400/90 text-amber-950'
								: 'bg-emerald-500/80 text-white'
					"
				>
					{{ riskLabel }}
				</span>
			</div>
			<button
				type="button"
				class="rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-white/10 transition"
				title="关闭"
				aria-label="关闭资源面板"
				@click="emit('close')"
			>
				<UIcon name="i-heroicons-x-mark" class="text-sm" />
			</button>
		</div>

		<p v-if="contextLost" class="px-3 pb-2 text-[10px] leading-snug text-rose-100/95">
			WebGL 上下文已丢失（通常因显存溢出）。请降低画质、减少点云/植物后刷新页面。
		</p>

		<div class="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2 text-[10px] leading-tight tabular-nums">
			<div class="flex justify-between gap-2"><span class="opacity-70">贴图</span><span>{{ snapshot.textures }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">几何</span><span>{{ snapshot.geometries }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">程序</span><span>{{ snapshot.programs }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">Draw</span><span>{{ snapshot.drawCalls }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">三角</span><span>{{ formatTriangles(snapshot.triangles) }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">Mesh</span><span>{{ snapshot.meshes }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">点云</span><span>{{ snapshot.splats }}</span></div>
			<div class="flex justify-between gap-2"><span class="opacity-70">植物</span><span>{{ snapshot.plants }}</span></div>
			<div class="flex justify-between gap-2 col-span-2">
				<span class="opacity-70">Spark</span>
				<span>{{ snapshot.sparkActive ? '占用中' : '未启用' }}</span>
			</div>
			<div class="flex justify-between gap-2 col-span-2">
				<span class="opacity-70">JS 堆</span>
				<span>{{ heapText }}</span>
			</div>
		</div>

		<ul
			v-if="snapshot.riskHints.length"
			class="border-t border-white/10 px-3 py-2 space-y-1"
		>
			<li
				v-for="(hint, i) in snapshot.riskHints.slice(0, 3)"
				:key="i"
				class="text-[10px] leading-snug opacity-90"
			>
				· {{ hint }}
			</li>
		</ul>
		<p v-else class="border-t border-white/10 px-3 py-2 text-[10px] opacity-60">
			非精确显存，作趋势预警；点云与高模植物请分批添加。
		</p>
	</div>
</template>
