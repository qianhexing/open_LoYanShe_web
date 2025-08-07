<template>
  <div class="space-y-4">
    <!-- 上传按钮 -->
    <UButton icon="i-heroicons-photo" @click="triggerInput" color="primary">
      选择图片
    </UButton>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      :multiple="multiple"
      class="hidden"
      @change="handleFiles"
    />

    <!-- 拖拽上传区 -->
    <div
      class="w-full border-2 border-dashed border-gray-300 p-4 text-center rounded-lg"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      拖拽图片到这里上传
    </div>

    <!-- 预览区 -->
    <div class="grid grid-cols-3 gap-4">
      <div
        v-for="(img, index) in previewImages"
        :key="index"
        class="relative group"
      >
        <UCard>
          <img :src="img.url" alt="预览图" class="w-full h-32 object-cover rounded" />
        </UCard>

        <UButton
          icon="i-heroicons-x-mark"
          color="red"
          size="2xs"
          variant="soft"
          class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
          @click="removeImage(index)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'update:files', value: File[]): void
}>()

const props = defineProps<{
  multiple?: boolean
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const previewImages = ref<{ file: File; url: string }[]>([])

const triggerInput = () => {
  fileInput.value?.click()
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
    input.value = '' // 清空 input 避免同图重复上传
  }
}

function handleDrop(event: DragEvent) {
  if (event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files))
  }
}

const addFiles = (newFiles: File[]) => {
  const imageFiles = newFiles.filter((f) => f.type.startsWith('image/'))
  const newPreviews = imageFiles.map((file) => ({
    file,
    url: URL.createObjectURL(file)
  }))
  if (props.multiple) {
    previewImages.value.push(...newPreviews)
    files.value.push(...imageFiles)
  } else {
    // 单选模式
    previewImages.value = newPreviews.slice(0, 1)
    files.value = imageFiles.slice(0, 1)
  }
  emit('update:files', files.value)
}

const removeImage = (index: number) => {
  URL.revokeObjectURL(previewImages.value[index].url)
  previewImages.value.splice(index, 1)
  files.value.splice(index, 1)
  emit('update:files', files.value)
}
const clear = () => {
  files.value = []
}

defineExpose({
  triggerInput, clear
})
</script>
