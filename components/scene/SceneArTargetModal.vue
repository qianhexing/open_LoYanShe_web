<script setup lang="ts">
import { compileSceneMind } from '@/api/ar'
import {
	hasSceneArTarget,
	resolveSceneArAssetUrl,
	toSceneArTarget
} from '@/utils/ar/sceneArTarget'
import type { SceneArTargetJSON } from '@/utils/threeCore'
import { uploadFileToOSS } from '@/utils/ossUpload'
import QhxModal from '@/components/Qhx/Modal.vue'

const props = defineProps<{
	modelValue: boolean
	arTarget: SceneArTargetJSON | null
	sceneId: string | number
	triggerPosition?: { x: number; y: number }
	editable?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [boolean]
	saved: [SceneArTargetJSON]
	cleared: []
}>()

const open = computed({
	get: () => props.modelValue,
	set: (v: boolean) => emit('update:modelValue', v)
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const progressText = ref('')
const errorMsg = ref('')
const localPreview = ref('')

const currentPreview = computed(() => {
	if (localPreview.value) return localPreview.value
	if (hasSceneArTarget(props.arTarget)) {
		return resolveSceneArAssetUrl(props.arTarget.previewUrl)
	}
	return ''
})

const canCompile = computed(() => {
	const sid = Number(props.sceneId)
	return Number.isFinite(sid) && sid > 0
})

watch(
	() => props.modelValue,
	v => {
		if (v) {
			errorMsg.value = ''
			progressText.value = ''
			localPreview.value = ''
		}
	}
)

function pickFile() {
	if (!props.editable || busy.value) return
	if (!canCompile.value) {
		errorMsg.value = '请先保存场景后再添加识别图'
		return
	}
	fileInputRef.value?.click()
}

async function onFileChange(e: Event) {
	const input = e.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (!file) return
	if (!canCompile.value) {
		errorMsg.value = '请先保存场景后再添加识别图'
		return
	}
	if (!file.type.startsWith('image/')) {
		errorMsg.value = '请上传图片文件（JPG / PNG）'
		return
	}
	if (file.size > 12 * 1024 * 1024) {
		errorMsg.value = '图片过大，请控制在 12MB 以内'
		return
	}

	busy.value = true
	errorMsg.value = ''
	progressText.value = '上传识别图…'
	localPreview.value = URL.createObjectURL(file)

	try {
		const stamp = Date.now()
		const uploaded = await uploadFileToOSS(
			file,
			'sence_ar',
			`scene_${props.sceneId}_${stamp}_src`
		)
		progressText.value = '服务端编译中，可能需要一两分钟…'
		const result = await compileSceneMind({
			imageUrl: uploaded.file_url,
			sceneId: props.sceneId,
			name: file.name.replace(/\.[^.]+$/, '') || '识别图',
			options: {
				maxEdge: 1024,
				uploadPath: 'sence_ar'
			}
		})
		const target = toSceneArTarget(result)
		emit('saved', target)
		progressText.value = '已写入场景识别图'
		localPreview.value = resolveSceneArAssetUrl(target.previewUrl)
	} catch (err) {
		errorMsg.value =
			err instanceof Error ? err.message : '编译失败，请稍后重试'
		localPreview.value = ''
	} finally {
		busy.value = false
	}
}

function clearTarget() {
	if (!props.editable || busy.value) return
	localPreview.value = ''
	emit('cleared')
}

function close() {
	if (busy.value) return
	open.value = false
}
</script>

<template>
	<QhxModal v-model="open" :trigger-position="triggerPosition">
		<div
			class="w-[min(92vw,420px)] rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xl dark:border-gray-700/80 dark:bg-gray-800"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-inset ring-violet-500/20"
				>
					<UIcon
						name="material-symbols:view-in-ar-rounded"
						class="h-5 w-5 text-violet-600 dark:text-violet-400"
					/>
				</div>
				<div class="min-w-0">
					<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
						AR 识别图
					</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						上传图片后由服务端编译为 MindAR 识别数据
					</p>
				</div>
			</div>

			<div
				class="mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/50"
			>
				<img
					v-if="currentPreview"
					:src="currentPreview"
					alt="识别图预览"
					class="h-full w-full object-contain"
				/>
				<div v-else class="px-4 text-center text-xs text-gray-400">
					尚未设置识别图<br />建议使用纹理丰富、对比清晰的平面图
				</div>
			</div>

			<p
				v-if="busy || progressText"
				class="mb-3 text-[11px] text-gray-500 dark:text-gray-400"
			>
				{{ progressText }}
			</p>

			<p
				v-if="errorMsg"
				class="mb-3 whitespace-pre-wrap break-all rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300"
			>
				{{ errorMsg }}
			</p>

			<input
				ref="fileInputRef"
				type="file"
				accept="image/jpeg,image/png,image/webp,image/jpg"
				class="hidden"
				@change="onFileChange"
			/>

			<div class="flex flex-wrap gap-2">
				<UButton
					v-if="editable"
					color="violet"
					:loading="busy"
					:disabled="busy"
					@click="pickFile"
				>
					{{ currentPreview ? '更换识别图' : '上传并编译' }}
				</UButton>
				<UButton
					v-if="editable && (currentPreview || arTarget)"
					color="gray"
					variant="soft"
					:disabled="busy"
					@click="clearTarget"
				>
					清除
				</UButton>
				<UButton color="gray" variant="ghost" :disabled="busy" @click="close">
					关闭
				</UButton>
			</div>

			<p class="mt-3 text-[11px] leading-relaxed text-gray-400">
				编译由服务端完成（约需数十秒至两分钟）。成功后会自动写入场景，有识别图时右上角显示「AR」。
			</p>
		</div>
	</QhxModal>
</template>
