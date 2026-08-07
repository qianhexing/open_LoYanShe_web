<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    /** sm：调参等紧凑场景；md：默认 */
    size?: 'sm' | 'md'
  }>(),
  {
    min: 0,
    step: 1,
    disabled: false,
    size: 'md'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

const isSm = computed(() => props.size === 'sm')

const rootClass = computed(() => (isSm.value ? 'gap-1' : 'gap-1.5'))

const inputWidthClass = computed(() => (isSm.value ? 'w-[4.75rem]' : 'w-16'))

const inputUi = computed(() => ({
  base: `focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary text-center ${
    isSm.value ? 'text-xs' : ''
  }`,
  rounded: 'rounded-full',
  padding: { xs: isSm.value ? 'px-1.5 py-1' : 'px-2 py-2' },
  color: {
    white: {
      outline:
        'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
    }
  }
}))

const stepBtnClass = computed(
  () =>
    `inline-flex shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-300 transition-colors hover:bg-gray-100 hover:text-qhx-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700 dark:hover:text-qhx-primary ${
      isSm.value ? 'h-6 w-6' : 'h-8 w-8'
    }`
)

const iconClass = computed(() => (isSm.value ? 'size-3' : 'size-4'))

const stepDecimals = computed(() => {
  const s = String(props.step ?? 1)
  if (s.includes('e') || s.includes('E')) return 6
  const i = s.indexOf('.')
  return i >= 0 ? s.length - i - 1 : 0
})

const clamp = (raw: number) => {
  let v = Number(raw)
  if (Number.isNaN(v)) v = props.min ?? 0
  const step = props.step || 1
  const base = props.min ?? 0
  if (step > 0) {
    v = Math.round((v - base) / step) * step + base
  }
  v = Number(v.toFixed(stepDecimals.value))
  if (props.min !== undefined) v = Math.max(props.min, v)
  if (props.max !== undefined) v = Math.min(props.max, v)
  return v
}

const commit = (raw: number) => {
  const next = clamp(raw)
  emit('update:modelValue', next)
  emit('change', next)
}

const canDecrement = computed(() => {
  if (props.disabled) return false
  const floor = props.min ?? Number.NEGATIVE_INFINITY
  return clamp(props.modelValue) > floor
})

const canIncrement = computed(() => {
  if (props.disabled) return false
  if (props.max === undefined) return true
  return clamp(props.modelValue) < props.max
})

const decrement = () => {
  if (!canDecrement.value) return
  commit(clamp(props.modelValue) - props.step)
}

const increment = () => {
  if (!canIncrement.value) return
  commit(clamp(props.modelValue) + props.step)
}

const onBlur = () => {
  commit(props.modelValue)
}
</script>

<template>
  <div class="inline-flex items-center" :class="rootClass">
    <button
      type="button"
      :class="stepBtnClass"
      :disabled="!canDecrement"
      aria-label="减少"
      @click="decrement"
    >
      <UIcon name="i-heroicons-minus" :class="iconClass" />
    </button>

    <UInput
      :model-value="modelValue"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :class="inputWidthClass"
      :ui="inputUi"
      @update:model-value="emit('update:modelValue', Number($event))"
      @blur="onBlur"
    />

    <button
      type="button"
      :class="stepBtnClass"
      :disabled="!canIncrement"
      aria-label="增加"
      @click="increment"
    >
      <UIcon name="i-heroicons-plus" :class="iconClass" />
    </button>
  </div>
</template>
