<script setup lang="ts">
import { defineAsyncComponent, h, ref, watch } from 'vue'

import 'vue3-colorpicker/style.css'

const Vue3ChromePicker = defineAsyncComponent({
  loader: () => import('vue3-colorpicker').then((m) => m.ColorPicker),
  loadingComponent: {
    setup() {
      return () =>
        h(
          'div',
          { class: 'flex h-[240px] items-center justify-center text-sm text-gray-500 dark:text-gray-400' },
          '加载中…'
        )
    }
  }
})

const props = withDefaults(
  defineProps<{
    /** 打开弹窗时的默认颜色；若同时传入 modelValue，则以 modelValue 为准 */
    color?: string | null
    modelValue?: string | null
    disableAlpha?: boolean
    /** 与 vue3-colorpicker 一致：chrome | fk */
    pickerType?: 'chrome' | 'fk'
  }>(),
  {
    color: '#000000',
    disableAlpha: true,
    pickerType: 'chrome'
  }
)

const emit = defineEmits<{
  choose: [hex: string]
  'update:modelValue': [hex: string]
}>()

const show = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const draftColor = ref('#000000')

function resolveInitialHex(): string {
  const raw = props.modelValue ?? props.color
  if (raw == null || String(raw).trim() === '') return '#000000'
  return String(raw).trim()
}

/** 与 QhxSelect.showPicker 一致，可传入点击事件以贴近触发点展示弹层 */
function showModel(e?: MouseEvent) {
  if (e) {
    clickPosition.value = { x: e.clientX, y: e.clientY }
  }
  draftColor.value = resolveInitialHex()
  show.value = true
}

defineExpose({ showModel })

watch(
  () => [props.modelValue, props.color] as const,
  () => {
    if (!show.value) return
    draftColor.value = resolveInitialHex()
  }
)

function confirm() {
  const hex = draftColor.value?.trim() || '#000000'
  emit('update:modelValue', hex)
  emit('choose', hex)
  show.value = false
}
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div
      class="bg-white dark:bg-gray-900 rounded-[10px] max-h-[50vh] overflow-y-auto border border-gray-100 dark:border-gray-800 shadow-xl w-full min-w-0 max-w-[min(90vw,42rem)]"
    >
      <div class="p-6 w-full min-w-0 box-border">
        <Vue3ChromePicker
          format="hex"
          class="qhx-color-picker w-full"
          :class="{ 'qhx-color-picker--hex-only': disableAlpha }"
          :is-widget="true"
          :picker-type="pickerType"
          :disable-alpha="disableAlpha"
          v-model:pure-color="draftColor"
        />
        <div class="mt-4 flex justify-end">
          <UButton
            type="submit"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="confirm"
          >
            确认选择
          </UButton>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
.qhx-color-picker :deep(.vc-colorpicker--container) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.qhx-color-picker :deep(.vc-colorpicker) {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0;
  box-sizing: border-box;
}
.qhx-color-picker :deep(.vc-saturation.vc-saturation__chrome) {
  width: 100% !important;
  max-width: 100%;
  min-width: 0;
  height: 200px !important;
}
.qhx-color-picker--hex-only :deep(.vc-alpha-slider),
.qhx-color-picker--hex-only :deep(.vc-alpha-input) {
  display: none !important;
}
</style>
