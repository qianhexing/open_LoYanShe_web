<script setup lang="ts">
import type { TemplateInterface } from '@/types/api';
const configStore = useConfigStore()
import { uploadImage } from '@/api';
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
const imagePicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const show = ref(false)
interface Props {
  className?: string,
  needJump?: boolean // 是否需要跳转
}
const addImage = () => {
  if (imagePicker.value) {
    imagePicker.value.triggerInput()
  }
}
const showModel = () => {
  show.value = true
}
const closeModel = () => {
  show.value = false
}
const props = withDefaults(defineProps<Props>(), {
})
const emit = defineEmits(['addImage', 'saveScene'])
const saveScene = () => {
  emit('saveScene')
}
const onUpdateFiles = (file: File[]) => {
  console.log('选择的文件', file)
  uploadImage(file[0])
    .then(async (res) => {
      console.log('上传返回', res)
      emit('addImage', res)
      if (imagePicker.value) {
        imagePicker.value.clear()
      }
    })
}
const { needJump } = props
defineExpose({
  showModel
})
</script>
<template>
  <QhxImagePicker :multiple="true" @update:files="onUpdateFiles" class="hidden" ref="imagePicker" />
  <div class="w-full fixed transition-all bottom-0 left-0 z-20 h-[170px] bg-qhx-bg"
    :class="show ? '' : 'bottom-[-170px]'">
    <div class="fun-head h-[40px] border-b flex">
      <div class="flex flex-1">
        <QhxJellyButton>
          <div
            class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
            @click="saveScene()">
            保存
          </div>
        </QhxJellyButton>
        <QhxJellyButton>
          <div
            class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
            @click="addImage()">
            <UIcon name="ant-design:star-filled" class="text-[26px] text-[#ffffff]" />
          </div>
        </QhxJellyButton>
      </div>
      <QhxJellyButton>
          <div
            class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
            @click="closeModel()">
            <UIcon name="ant-design:star-filled" class="text-[26px] text-[#ffffff]" />
          </div>
        </QhxJellyButton>
    </div>
    111
  </div>
</template>

<style scoped></style>
