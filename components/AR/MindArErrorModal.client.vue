<template>
  <Modal :model-value="modelValue" :close-on-backdrop="true" @update:model-value="onUpdate">
    <div
      class="mind-ar-error-card max-w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-white/15 bg-neutral-900/95 px-4 py-3 shadow-2xl ring-1 ring-white/10"
    >
      <div
        class="text-[15px] font-semibold leading-snug"
        :class="kind === 'warn' ? 'text-amber-300' : 'text-red-400'"
      >
        {{ title }}
      </div>
      <pre
        class="mt-2 max-h-[min(50vh,16rem)] overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 px-2 py-2 text-[12px] leading-relaxed text-neutral-100"
        >{{ message }}</pre>
      <div class="mt-3 flex justify-end">
        <button
          type="button"
          class="rounded-lg bg-white/15 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/25 active:bg-white/20"
          @click="$emit('update:modelValue', false)"
        >
          确定
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/Qhx/Modal.vue'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		title?: string
		message: string
		kind?: 'error' | 'warn'
	}>(),
	{ title: '提示', kind: 'error' }
)

const emit = defineEmits<{
	'update:modelValue': [open: boolean]
}>()

function onUpdate(open: boolean) {
	emit('update:modelValue', open)
}
</script>

<style scoped>
.mind-ar-error-card {
	box-sizing: border-box;
	min-width: 16rem;
}
</style>
