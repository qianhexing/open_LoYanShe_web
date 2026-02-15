<template>
  <div class="space-y-4">
    <!-- 上传按钮 -->
    <UButton v-if="!props.disabled" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
      icon="i-heroicons-photo" @click="triggerInput" color="primary">
      选择图片
    </UButton>

    <input ref="fileInput" type="file" accept="image/*" :multiple="multiple" class="hidden" @change="handleFiles" />

    <!-- 拖拽上传区 -->
    <div v-if="!props.disabled && !isMobile"
      class="w-full border-2 border-dashed border-gray-300 p-4 text-center rounded-lg" @dragover.prevent
      @drop.prevent="handleDrop">
      拖拽图片到这里上传
    </div>

    <!-- 预览区 -->
    <div class=" w-full">
      <!-- <div
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
      </div> -->

      <Draggable :scroll="true" :scroll-sensitivity="150" :scroll-speed="15" :fallback-tolerance="0"
        :forceFallback="true" :delay="150" :disabled="!props.multiple || props.disabled"
        item-key="id" animation="300"
        v-model="previewImages"
        ghost-class="drag-ghost" chosen-class="drag-chosen" drag-class="dragging" class=" flex flex-wrap">
        <template #item="{ element, index }">
          <transition-group tag="div"
            class="[@media(min-width:1920px)]:w-[calc(100%/10)] xl:w-1/4 md:w-1/4 max-md:w-1/3" name="list">
            <div
              class="group drag-handle flex flex-col items-center transition-transform duration-300 ease-out hover:scale-105 py-[10px] px-[15px] max-md:px-[5px]">
              <div class="w-full aspect-[1/1] relative shadow-xl">
                <img :src="element.url" draggable="false"
                  class="object-cover w-full aspect-[1/1] max-md:aspect-[1/1] rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing"
                  style="-webkit-touch-callout: none; -webkit-user-select: none; user-select: none;"
                  loading="lazy">
                </img>
                <UButton v-if="!props.disabled" icon="i-heroicons-x-mark" color="red" size="2xs" variant="soft"
                  class="absolute top-1 right-1 z-10" @click="removeImage(index)" />
                <!-- 透明遮罩层，防止移动端长按事件 -->
                <div class="absolute z-[1] w-full h-full inset-0 rounded-xl" 
                  style="background: transparent;">
                </div>
              </div>
            </div>
          </transition-group>
        </template>
      </Draggable>
      <!-- <Draggable :forceFallback="true" :disabled="!props.multiple || props.disabled" :delay="150"
        v-model="previewImages" item-key="id" animation="250" ghost-class="drag-ghost" chosen-class="drag-chosen"
        drag-class="dragging" class="grid grid-cols-3 gap-4">
        <template #item="{ element, index }">

          <div class="relative group aspect-square">
            <img :src="element.url" alt="预览图" class="w-full h-full aspect-square object-cover rounded no-long-press" />
            <UButton v-if="!props.disabled" icon="i-heroicons-x-mark" color="red" size="2xs" variant="soft"
              class="absolute top-1 right-1 z-10" @click="removeImage(index)" />
          </div>
        </template>
      </Draggable> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import Draggable from "vuedraggable"
const emit = defineEmits<(e: 'update:files', value: File[]) => void>()

const props = defineProps<{
  multiple?: boolean
  max?: number  // 最大图片数量
  disabled?: boolean  // 是否禁用
}>()

// 移动端检测
const configStore = useConfigStore()
const isMobile = computed(() => configStore.isMobile)

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const previewImages = ref<{ id?: string; file?: File; url?: string }[]>([])

let idCounter = 0
const generateId = () => `img_${Date.now()}_${++idCounter}`

const triggerInput = () => {
  if (!props.disabled) {
    fileInput.value?.click()
  }
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
    input.value = '' // 清空 input 避免同图重复上传
  }
}

function handleDrop(event: DragEvent) {
  if (!props.disabled && event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files))
  }
}

const addFiles = (newFiles: File[]) => {
  if (props.disabled) return
  const imageFiles = newFiles.filter((f) => f.type.startsWith('image/'))
  const newPreviews = imageFiles.map((file) => ({
    id: generateId(),
    file,
    url: URL.createObjectURL(file)
  }))
  if (props.multiple) {
    // 如果有最大数量限制
    if (props.max && props.max > 0) {
      const remaining = props.max - previewImages.value.length
      if (remaining > 0) {
        const toAdd = newPreviews.slice(0, remaining)
        previewImages.value.push(...toAdd)
        files.value.push(...imageFiles.slice(0, remaining))
      }
    } else {
      previewImages.value.push(...newPreviews)
      files.value.push(...imageFiles)
    }
  } else {
    // 单选模式
    previewImages.value = newPreviews.slice(0, 1)
    files.value = imageFiles.slice(0, 1)
  }
  emit('update:files', files.value)
}

const removeImage = (index: number) => {
  // 删除弹出提示
  console.log(index)
  const toast = useToast()
  toast.add({
    title: '删除图片',
    icon: 'i-heroicons-exclamation-circle',
    color: 'orange'
  })
  if (props.disabled) return
  if (previewImages.value[index].url) {
    URL.revokeObjectURL(previewImages.value[index].url)
  }
  previewImages.value.splice(index, 1)
  files.value.splice(index, 1)
  emit('update:files', files.value)
}
const clear = () => {
  files.value = []
  previewImages.value = []
}

defineExpose({
  triggerInput, clear, previewImages
})
</script>

<style scoped>
/* 禁止手机浏览器的长按事件 */
.no-long-press {
  /* -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  pointer-events: none;
  touch-action: manipulation; */
}
</style>
