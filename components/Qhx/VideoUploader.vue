<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ label }}
    </label>
    <!-- 文件选择器 -->
    <div class="space-y-2">
      <input
        ref="videoFileInput"
        type="file"
        :accept="accept"
        class="hidden"
        @change="handleVideoFileSelect"
      />
      <div
        v-if="!modelValue"
        class="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-qhx-primary transition-colors"
        @click="videoFileInput?.click()"
        @dragover.prevent
        @drop.prevent="handleVideoFileDrop"
      >
        <div class="flex flex-col items-center gap-2">
          <UIcon name="i-heroicons-video-camera" class="text-4xl text-gray-400" />
          <p class="text-sm text-gray-600 dark:text-gray-400">
            点击选择或拖拽视频文件
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500">
            {{ acceptText }}
          </p>
        </div>
      </div>
      <!-- 已选择文件显示 -->
      <div
        v-if="modelValue"
        class="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex-shrink-0 w-10 h-10 bg-qhx-primary/10 rounded-lg flex items-center justify-center">
              <UIcon name="i-heroicons-video-camera" class="text-xl text-qhx-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ selectedVideoFileName || '视频文件' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatFileSize(selectedVideoFileSize) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="!uploading"
              size="xs"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="clearVideoFile"
            >
              移除
            </UButton>
            <UButton
              v-else
              size="xs"
              variant="ghost"
              disabled
            >
              <span class="flex items-center gap-1">
                <span class="w-4 h-4 border-2 border-qhx-primary border-t-transparent rounded-full animate-spin"></span>
                上传中...
              </span>
            </UButton>
          </div>
        </div>
        <!-- 上传进度条 -->
        <div v-if="uploading && uploadProgress > 0" class="mt-3">
          <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>上传进度</span>
            <span>{{ Math.round(uploadProgress * 100) }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              class="bg-qhx-primary h-2 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${uploadProgress * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { uploadFileToOSS } from '@/utils/ossUpload'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  accept?: string
  acceptText?: string
  uploadPath?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  label: '视频文件',
  accept: '.mp4,.webm,.mov,.avi,.mkv,.flv,.wmv',
  acceptText: '支持 .mp4, .webm, .mov, .avi, .mkv, .flv, .wmv 格式',
  uploadPath: 'video',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'upload-success': [fileUrl: string, fileId?: number]
  'upload-error': [error: Error]
  'upload-progress': [progress: number]
  'file-selected': [file: File]
  'file-cleared': []
}>()

const toast = useToast()

// 组件引用
const videoFileInput = ref<HTMLInputElement | null>(null)

// 视频文件相关
const uploading = ref(false)
const uploadProgress = ref(0) // 上传进度 (0-1)
const selectedVideoFileName = ref('')
const selectedVideoFileSize = ref(0)

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / (k ** i)).toFixed(2)} ${sizes[i]}`
}

// 检查文件类型
const isValidVideoFile = (fileName: string): boolean => {
  const lowerFileName = fileName.toLowerCase()
  const acceptedExtensions = props.accept.split(',').map(ext => ext.trim().replace('.', ''))
  return acceptedExtensions.some(ext => lowerFileName.endsWith(`.${ext}`))
}

// 处理视频文件选择
const handleVideoFileSelect = async (event: Event) => {
  if (props.disabled) return
  
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await uploadVideoFile(input.files[0])
  }
}

// 处理拖拽上传
const handleVideoFileDrop = async (event: DragEvent) => {
  if (props.disabled) return
  
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    // 检查文件类型
    if (isValidVideoFile(file.name)) {
      await uploadVideoFile(file)
    } else {
      toast.add({
        title: '文件格式错误',
        description: props.acceptText,
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  }
}

// 上传视频文件
const uploadVideoFile = async (file: File) => {
  // 检查文件类型
  if (!isValidVideoFile(file.name)) {
    toast.add({
      title: '文件格式错误',
      description: props.acceptText,
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  selectedVideoFileName.value = file.name
  selectedVideoFileSize.value = file.size

  // 触发文件选择事件
  emit('file-selected', file)

  try {
    // 使用 OSS 上传，传入进度回调
    const result = await uploadFileToOSS(file, props.uploadPath, undefined, (progress) => {
      uploadProgress.value = progress
      // 触发进度更新事件
      emit('upload-progress', progress)
    })
    emit('update:modelValue', result.file_url)
    emit('upload-success', result.file_url, result.file_id)
    toast.add({
      title: '文件上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('文件上传失败:', error)
    const errorMessage = error instanceof Error ? error.message : '请稍后重试'
    emit('upload-error', error instanceof Error ? error : new Error(errorMessage))
    toast.add({
      title: '文件上传失败',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    // 清除选择
    selectedVideoFileName.value = ''
    selectedVideoFileSize.value = 0
    uploadProgress.value = 0
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

// 清除视频文件
const clearVideoFile = () => {
  if (props.disabled) return
  
  emit('update:modelValue', null)
  emit('file-cleared')
  selectedVideoFileName.value = ''
  selectedVideoFileSize.value = 0
  uploadProgress.value = 0
  if (videoFileInput.value) {
    videoFileInput.value.value = ''
  }
}

// 暴露方法供父组件调用
defineExpose({
  clear: clearVideoFile,
  selectFile: () => {
    if (!props.disabled) {
      videoFileInput.value?.click()
    }
  },
  // 暴露上传状态（使用 getter 函数以保持响应性）
  get uploading() {
    return uploading.value
  },
  get uploadProgress() {
    return uploadProgress.value
  },
  get isUploading() {
    return uploading.value
  }
})
</script>

<style scoped>
</style>

