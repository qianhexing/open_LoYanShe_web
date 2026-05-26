<script setup lang="ts">
import type ThreeCore from '@/utils/threeCore'
import {
	idsFromMembers,
	labelForStepGroupRoot,
	listSceneObjectsForSteps,
	membersFromStepIds,
	sceneStepLabel,
	type SceneStepMember
} from '@/utils/sceneSteps'

const props = withDefaults(
	defineProps<{
		core: ThreeCore
		activeIndex: number
		hiddenStepIndex: number | null
		objectRevision: number
		compact?: boolean
	}>(),
	{ compact: true, hiddenStepIndex: null }
)

const emit = defineEmits<{
	'update:activeIndex': [index: number]
	'update:hiddenStepIndex': [index: number | null]
	change: []
}>()

const stepIntros = ref<string[]>([])
const stepMembers = ref<SceneStepMember[][]>([])
const labelByObjectId = ref<Record<string, string>>({})

function getRoots() {
	if (props.core.options.enableAR && props.core.arContentGroup) {
		return props.core.arContentGroup.children
	}
	return props.core.scene.children
}

function refreshLabels() {
	const map: Record<string, string> = {}
	for (const item of listSceneObjectsForSteps(getRoots())) {
		map[item.id] = item.label
	}
	labelByObjectId.value = map
}

function syncFromCore() {
	const steps = props.core.sceneSteps
	stepIntros.value = steps.map(s => s.intro || '')
	stepMembers.value = steps.map((step, i) => membersFromStepIds(i, step.id))
	refreshLabels()
}

function commit() {
	stepMembers.value = stepMembers.value.map((members, stepIndex) =>
		members.map((member, memberIndex) => ({
			...member,
			uid: `s${stepIndex}-i${memberIndex}-${member.objectId}`
		}))
	)
	props.core.sceneSteps = stepMembers.value.map((members, i) => ({
		id: idsFromMembers(members),
		...(stepIntros.value[i]?.trim() ? { intro: stepIntros.value[i].trim() } : {})
	}))
	emit('change')
}

function addStep() {
	stepIntros.value.push('')
	stepMembers.value.push([])
	const nextIndex = stepMembers.value.length - 1
	emit('update:activeIndex', nextIndex)
	commit()
}

function removeStep(index: number) {
	if (!import.meta.client) return
	if (!window.confirm(`确定删除「${sceneStepLabel({ id: [], intro: stepIntros.value[index] }, index)}」？`)) {
		return
	}
	stepIntros.value.splice(index, 1)
	stepMembers.value.splice(index, 1)
	let nextIndex = props.activeIndex
	if (nextIndex >= stepMembers.value.length) {
		nextIndex = Math.max(0, stepMembers.value.length - 1)
	}
	emit('update:activeIndex', nextIndex)
	const hidden = props.hiddenStepIndex
	if (hidden === index) {
		emit('update:hiddenStepIndex', null)
	} else if (hidden !== null && hidden > index) {
		emit('update:hiddenStepIndex', hidden - 1)
	}
	commit()
}

function activateStep(index: number) {
	emit('update:activeIndex', index)
}

function toggleStepVisibility(stepIndex: number) {
	if (props.hiddenStepIndex === stepIndex) {
		emit('update:hiddenStepIndex', null)
	} else {
		emit('update:hiddenStepIndex', stepIndex)
	}
}

function removeMember(stepIndex: number, memberIndex: number) {
	stepMembers.value[stepIndex]?.splice(memberIndex, 1)
	commit()
}

function memberLabel(objectId: string) {
	return labelByObjectId.value[objectId] || objectId
}

/** 将场景对象加入当前激活分组（由页面在分组模式下点击场景时调用） */
function addObjectToActiveStep(objectId: string): boolean {
	if (!objectId) return false
	let stepIndex = props.activeIndex
	if (stepMembers.value.length === 0) {
		addStep()
		stepIndex = 0
	}
	if (!stepMembers.value[stepIndex]) return false
	stepMembers.value[stepIndex].push({
		uid: `m-${objectId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		objectId
	})
	commit()
	return true
}

function addObjectFromSceneObject(obj: import('three').Object3D): boolean {
	const root = obj
	const id = root.userData?.id
	if (typeof id !== 'string' || !id.length) return false
	labelByObjectId.value[id] = labelForStepGroupRoot(root)
	return addObjectToActiveStep(id)
}

watch(
	() => props.objectRevision,
	() => {
		refreshLabels()
	}
)

watch(
	() => props.core.sceneSteps.length,
	() => {
		if (stepMembers.value.length !== props.core.sceneSteps.length) {
			syncFromCore()
		}
	}
)

onMounted(() => {
	syncFromCore()
})

defineExpose({
	syncFromCore,
	addObjectToActiveStep,
	addObjectFromSceneObject
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[10px] leading-relaxed text-emerald-700/90 dark:text-emerald-300/90">
        分组模式：点击场景物体加入当前分组
      </p>
      <UButton
        size="xs"
        color="emerald"
        variant="soft"
        icon="i-heroicons-plus"
        class="shrink-0"
        @click="addStep"
      >
        添加
      </UButton>
    </div>

    <div
      v-if="stepMembers.length === 0"
      class="rounded-lg border border-dashed border-gray-300/90 px-2 py-4 text-center dark:border-gray-600/80"
    >
      <p class="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
        暂无分组，点击「添加」后点选场景物体
      </p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(_, stepIndex) in stepMembers"
        :key="`step-editor-${stepIndex}`"
        class="relative rounded-lg border p-2 pt-6 transition-colors cursor-pointer"
        :class="activeIndex === stepIndex
          ? 'border-emerald-400/70 bg-emerald-50/80 ring-1 ring-emerald-400/30 dark:border-emerald-500/40 dark:bg-emerald-950/30'
          : 'border-gray-200/90 bg-white/60 hover:border-emerald-200 dark:border-gray-600/70 dark:bg-gray-900/30'"
        @click="activateStep(stepIndex)"
      >
        <button
          type="button"
          class="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md transition-colors"
          :class="hiddenStepIndex === stepIndex
            ? 'bg-gray-200/90 text-gray-500 dark:bg-gray-700/90 dark:text-gray-400'
            : 'text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-emerald-950/50'"
          :title="hiddenStepIndex === stepIndex ? '显示组内物体' : '隐藏组内物体'"
          @click.stop="toggleStepVisibility(stepIndex)"
        >
          <UIcon
            :name="hiddenStepIndex === stepIndex
              ? 'material-symbols:visibility-off-outline'
              : 'material-symbols:visibility-outline'"
            class="text-[14px]"
          />
        </button>

        <div class="mb-1 flex items-center gap-1 pr-5">
          <span
            class="text-[10px] font-semibold truncate"
            :class="activeIndex === stepIndex
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-gray-700 dark:text-gray-300'"
          >
            {{ sceneStepLabel({ id: [], intro: stepIntros[stepIndex] }, stepIndex) }}
          </span>
          <span class="text-[9px] text-gray-400 shrink-0">
            {{ stepMembers[stepIndex]?.length ?? 0 }} 项
          </span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
            @click.stop="removeStep(stepIndex)"
          >
            删除
          </button>
        </div>

        <UInput
          v-model="stepIntros[stepIndex]"
          placeholder="分组介绍"
          size="xs"
          color="white"
          class="mb-1.5"
          @click.stop
          @blur="commit"
        />

        <div
          v-if="stepMembers[stepIndex]?.length"
          class="flex flex-wrap gap-1"
          @click.stop
        >
          <span
            v-for="(member, memberIndex) in stepMembers[stepIndex]"
            :key="member.uid"
            class="scene-neu-chip inline-flex max-w-full items-center gap-0.5 truncate px-1.5 py-0.5 text-[9px] text-gray-700 dark:text-gray-200"
            :title="memberLabel(member.objectId)"
          >
            <span class="truncate">{{ memberLabel(member.objectId) }}</span>
            <button
              type="button"
              class="shrink-0 text-gray-400 hover:text-red-500"
              aria-label="移出"
              @click.stop="removeMember(stepIndex, memberIndex)"
            >
              ×
            </button>
          </span>
        </div>
        <p
          v-else
          class="text-[9px] text-gray-400 dark:text-gray-500"
        >
          点击激活后，在场景中点选物体加入
        </p>
      </div>
    </div>
  </div>
</template>
