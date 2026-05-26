<script setup lang="ts">
import type ThreeCore from '@/utils/threeCore'
import { ViewCube } from '@/utils/viewCube'

const props = defineProps<{
	core: ThreeCore | null | undefined
	/** 仅编辑模式下显示并启用 */
	enabled?: boolean
}>()

const hostRef = ref<HTMLElement | null>(null)
let viewCube: ViewCube | null = null

const mountViewCube = () => {
	if (!import.meta.client || !props.enabled || !props.core || !hostRef.value || viewCube) {
		return
	}
	viewCube = new ViewCube(props.core, hostRef.value)
}

const disposeViewCube = () => {
	viewCube?.dispose()
	viewCube = null
}

const syncViewCube = () => {
	disposeViewCube()
	if (props.enabled && props.core) {
		nextTick(() => mountViewCube())
	}
}

watch(() => [props.core, props.enabled] as const, syncViewCube, { immediate: true })

onBeforeUnmount(disposeViewCube)
</script>

<template>
	<div
		v-if="core && enabled"
		ref="hostRef"
		class="scene-view-cube fixed left-0 bottom-0 z-[15] pointer-events-none"
		aria-hidden="true"
	/>
</template>

<style scoped>
.scene-view-cube {
	width: 0;
	height: 0;
	overflow: visible;
}

:global(.scene-view-cube-host) {
	border-radius: 14px;
	backdrop-filter: blur(8px);
	box-shadow:
		6px 6px 18px rgba(0, 0, 0, 0.18),
		-3px -3px 10px rgba(255, 255, 255, 0.08),
		inset 0 1px 0 rgba(255, 255, 255, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.28);
	background: rgba(255, 255, 255, 0.12);
	padding: 4px;
	box-sizing: border-box;
}

:global(.dark .scene-view-cube-host) {
	background: rgba(38, 40, 48, 0.55);
	border-color: rgba(255, 255, 255, 0.1);
	box-shadow:
		6px 6px 18px rgba(0, 0, 0, 0.45),
		inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
</style>
