<script setup lang="ts">
import { ref, defineProps, withDefaults, defineEmits, defineExpose } from 'vue'
import 'vue3-colorpicker/style.css'

interface Props {
  color?: string
  disableAlpha?: boolean
}

const ColorPicker = ref<any>(null) // 占位
const show = ref(false)
const clickPosition = ref({ x: 0, y: 0 })

const props = withDefaults(defineProps<Props>(), {
  color: '#000000',
  disableAlpha: true
})

const emit = defineEmits(['changeColor', 'openSucker', 'inputFocus', 'inputBlur', 'choose'])

const colorValue = ref(props.color)

const showModel = () => {
  show.value = true
}

defineExpose({ showModel })

const onChangeColor = (val: string) => {
  colorValue.value = val
  emit('changeColor', val)
}
onMounted(async () => {
  // 客户端动态导入
  const module = await import('vue3-colorpicker')
  ColorPicker.value = module.ColorPicker
})
const confirm = () => {
  emit('choose', colorValue.value)
  show.value = false
}
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div class="bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
      <div class="m-6 w-[400px]">
        <color-picker format="hex"  v-model:pureColor="colorValue" style="width: 100%;" :isWidget="true" :pickerType="'chrome'"/>
        <div class="flex justify-end">
          <UButton 
          type="submit"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mx-2"
          @click="confirm"
        >
          确认选择
        </UButton>
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<style>
/* 可根据需求自定义样式 */
.vc-colorpicker--container{
  width: 100%;
}
.vc-colorpicker{
  width: 100% !important;
}
.vc-alpha-slider{
  display: none !important;
}
.vc-alpha-input{
  display: none !important;
}
.vc-saturation.vc-saturation__chrome{
  height: 200px !important;

}
</style>
