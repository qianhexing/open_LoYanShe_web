<script setup lang="ts">
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import GardenFlowerTypePicker from '@/components/signIn/GardenFlowerTypePicker.vue'
import { signInDaily } from '@/api/sign_in'
import {
  getDefaultGardenFlowerDecoId,
  getGardenFlowerDecoMeta,
  isGardenFlowerDecoId,
} from '@/utils/gardenFlowerDeco'
import { uploadImageOSS } from '@/utils/ossUpload'

const modelValue = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  reload: [payload?: { word_cloud?: string; flower_types?: string }]
  fail: []
}>()

const toast = useToast()
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const content = ref('')
const addToWordCloud = ref(false)
const selectedFlowerType = ref('')
const submitting = ref(false)

const resetForm = () => {
  content.value = ''
  addToWordCloud.value = false
  selectedFlowerType.value = getDefaultGardenFlowerDecoId()
  imagePickerRef.value?.clear?.()
}

const handleClose = () => {
  modelValue.value = false
  resetForm()
}

const onModalClose = () => {
  resetForm()
}

const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  return uploadImageOSS(file)
}

const handleSubmit = async () => {
  if (submitting.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }

  const trimmed = content.value.trim()
  if (
    !selectedFlowerType.value ||
    !isGardenFlowerDecoId(selectedFlowerType.value) ||
    !getGardenFlowerDecoMeta(selectedFlowerType.value)?.hasOwn
  ) {
    toast.add({
      title: '请选择已解锁的花朵',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }

  if (addToWordCloud.value && (trimmed.length <= 0 || trimmed.length > 8)) {
    toast.add({
      title: '加入词库应在 1-8 个字符',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }

  submitting.value = true

  try {
    const params: {
      comment_content: string
      word_cloud: boolean
      mount_img?: string
      json_data: { flower_types: string }
    } = {
      comment_content: trimmed,
      word_cloud: addToWordCloud.value,
      json_data: {
        flower_types: selectedFlowerType.value,
      },
    }

    if (imagePickerRef.value?.previewImages.length) {
      const uploadPromises = imagePickerRef.value.previewImages
        .filter(
          (img): img is { file?: File; url: string } =>
            typeof img === 'object' && 'url' in img && typeof img.url === 'string'
        )
        .map((img) => fetchUpload(img))
      const imgList = await Promise.all(uploadPromises)
      if (imgList.length > 0) {
        params.mount_img = imgList.join(',')
      }
    }

    await signInDaily(params)

    emit('reload', {
      word_cloud: addToWordCloud.value && trimmed ? trimmed : undefined,
      flower_types: selectedFlowerType.value,
    })
    handleClose()
  } catch (error) {
    console.error('签到失败:', error)
    emit('fail')
    toast.add({
      title: '签到失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    submitting.value = false
  }
}

watch(modelValue, (open) => {
  if (open && !selectedFlowerType.value) {
    selectedFlowerType.value = getDefaultGardenFlowerDecoId()
  }
})

defineExpose({
  open: () => {
    if (!selectedFlowerType.value) {
      selectedFlowerType.value = getDefaultGardenFlowerDecoId()
    }
    modelValue.value = true
  },
})
</script>

<template>
  <QhxModal v-model="modelValue" @close="onModalClose">
    <div
      class="flex max-h-[90vh] w-[95vw] max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl backdrop-blur-xl dark:border-gray-600/60 dark:bg-gray-800"
    >
      <div
        class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700"
      >
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="handleClose"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
        <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">今日签到</div>
        <UButton size="sm" color="primary" :loading="submitting" @click="handleSubmit">
          签到
        </UButton>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <GardenFlowerTypePicker v-model="selectedFlowerType" />

        <QhxImagePicker ref="imagePickerRef" :multiple="true" :max="9" />

        <UTextarea
          v-model="content"
          :rows="4"
          autoresize
          placeholder="给予大家穿 Lo 的勇气"
          :ui="{ rounded: 'rounded-xl' }"
        />

        <label
          class="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
        >
          <UCheckbox v-model="addToWordCloud" />
          <span>添加进鼓励词库</span>
        </label>
      </div>
    </div>
  </QhxModal>
</template>
