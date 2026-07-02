<script setup lang="ts">
import * as THREE from 'three'
import type ThreeCore from '@/utils/threeCore'
import type { TransformState } from '@/composables/useSceneUndo'

type Vec3 = { x: number; y: number; z: number }

const props = defineProps<{
  modelValue: boolean
  target: THREE.Object3D | null
  threeCore: ThreeCore | null
  triggerPosition: { x: number; y: number }
  cloneTransformState: (obj: THREE.Object3D) => TransformState
  pushTransformUndo: (uuid: string, state: TransformState, description?: string) => void
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const position = reactive<Vec3>({ x: 0, y: 0, z: 0 })
const rotationDeg = reactive<Vec3>({ x: 0, y: 0, z: 0 })
const scale = reactive<Vec3>({ x: 1, y: 1, z: 1 })

const inputClass =
  'w-full min-w-0 rounded-lg bg-gray-50 px-2 py-1.5 text-center text-sm font-mono tabular-nums ring-1 ring-gray-300 focus:ring-2 focus:ring-qhx-primary dark:bg-gray-800 dark:ring-gray-600'

const formatNum = (n: number, digits = 3) => {
  if (!Number.isFinite(n)) return '0'
  const rounded = Number(n.toFixed(digits))
  return String(rounded)
}

const parseNum = (raw: string | number, fallback: number) => {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

const syncFromTarget = (obj: THREE.Object3D) => {
  position.x = obj.position.x
  position.y = obj.position.y
  position.z = obj.position.z
  rotationDeg.x = THREE.MathUtils.radToDeg(obj.rotation.x)
  rotationDeg.y = THREE.MathUtils.radToDeg(obj.rotation.y)
  rotationDeg.z = THREE.MathUtils.radToDeg(obj.rotation.z)
  scale.x = obj.scale.x
  scale.y = obj.scale.y
  scale.z = obj.scale.z
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.target) syncFromTarget(props.target)
  }
)

watch(
  () => props.target?.uuid,
  () => {
    if (props.modelValue && props.target) syncFromTarget(props.target)
  }
)

const close = () => emit('update:modelValue', false)

const EPS = 1e-5

const isNearlyEqual = (a: number, b: number) => Math.abs(a - b) < EPS

const hasTransformChanged = (obj: THREE.Object3D) => {
  if (!isNearlyEqual(obj.position.x, position.x)) return true
  if (!isNearlyEqual(obj.position.y, position.y)) return true
  if (!isNearlyEqual(obj.position.z, position.z)) return true
  if (!isNearlyEqual(THREE.MathUtils.radToDeg(obj.rotation.x), rotationDeg.x)) return true
  if (!isNearlyEqual(THREE.MathUtils.radToDeg(obj.rotation.y), rotationDeg.y)) return true
  if (!isNearlyEqual(THREE.MathUtils.radToDeg(obj.rotation.z), rotationDeg.z)) return true
  if (!isNearlyEqual(obj.scale.x, scale.x)) return true
  if (!isNearlyEqual(obj.scale.y, scale.y)) return true
  if (!isNearlyEqual(obj.scale.z, scale.z)) return true
  return false
}

const applyTransform = () => {
  const obj = props.target
  const core = props.threeCore
  if (!obj || !core) return
  if (!hasTransformChanged(obj)) {
    close()
    return
  }

  const prevState = props.cloneTransformState(obj)
  obj.position.set(position.x, position.y, position.z)
  obj.rotation.set(
    THREE.MathUtils.degToRad(rotationDeg.x),
    THREE.MathUtils.degToRad(rotationDeg.y),
    THREE.MathUtils.degToRad(rotationDeg.z)
  )
  obj.scale.set(scale.x, scale.y, scale.z)

  props.pushTransformUndo(obj.uuid, prevState, '精确变换')
  core.onObjectTransformManuallyChanged(obj)

  const tc = core.transformControls
  if (tc.object === obj) {
    tc.updateMatrixWorld()
  }
  close()
}

const onAxisBlur = (
  group: 'position' | 'rotationDeg' | 'scale',
  axis: keyof Vec3,
  raw: string
) => {
  const fallback = group === 'scale' ? 1 : 0
  const bucket = group === 'position' ? position : group === 'rotationDeg' ? rotationDeg : scale
  bucket[axis] = parseNum(raw, bucket[axis] ?? fallback)
}
</script>

<template>
  <QhxModal :model-value="modelValue" :trigger-position="triggerPosition" @update:model-value="emit('update:modelValue', $event)">
    <div class="w-[min(92vw,420px)] rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xl dark:border-gray-700/80 dark:bg-gray-800">
      <div class="mb-5 flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/[0.11] ring-1 ring-inset ring-sky-500/15 dark:bg-sky-400/10 dark:ring-sky-400/20">
          <UIcon name="material-symbols:straighten-rounded" class="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">精确变换</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">旋转单位为角度，保存时自动转换为弧度</p>
        </div>
      </div>

      <div class="space-y-4">
        <section>
          <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">位置</div>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`p-${axis}`" class="space-y-1">
              <span class="block text-center text-[10px] uppercase text-gray-400">{{ axis }}</span>
              <input
                :value="formatNum(position[axis])"
                type="number"
                step="0.01"
                :class="inputClass"
                @input="position[axis] = parseNum(($event.target as HTMLInputElement).value, position[axis])"
                @blur="onAxisBlur('position', axis, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </section>

        <section>
          <div class="mb-2 flex items-baseline justify-between gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">旋转</span>
            <span class="text-[10px] text-gray-400">°</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`r-${axis}`" class="space-y-1">
              <span class="block text-center text-[10px] uppercase text-gray-400">{{ axis }}</span>
              <input
                :value="formatNum(rotationDeg[axis], 2)"
                type="number"
                step="0.1"
                :class="inputClass"
                @input="rotationDeg[axis] = parseNum(($event.target as HTMLInputElement).value, rotationDeg[axis])"
                @blur="onAxisBlur('rotationDeg', axis, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </section>

        <section>
          <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">缩放</div>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="axis in (['x', 'y', 'z'] as const)" :key="`s-${axis}`" class="space-y-1">
              <span class="block text-center text-[10px] uppercase text-gray-400">{{ axis }}</span>
              <input
                :value="formatNum(scale[axis])"
                type="number"
                step="0.01"
                min="0.001"
                :class="inputClass"
                @input="scale[axis] = Math.max(0.001, parseNum(($event.target as HTMLInputElement).value, scale[axis]))"
                @blur="onAxisBlur('scale', axis, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </section>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <UButton color="gray" variant="outline" @click="close">取消</UButton>
        <UButton color="primary" @click="applyTransform">应用</UButton>
      </div>
    </div>
  </QhxModal>
</template>
