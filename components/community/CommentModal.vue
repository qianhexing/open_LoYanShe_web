<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <!-- 背景遮罩 -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        
        <!-- 弹窗内容 -->
        <div class="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-[2rem] p-8 shadow-2xl border border-white/50 dark:border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <!-- 关闭按钮 -->
          <button
            @click="handleClose"
            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span class="text-xl">✕</span>
          </button>

          <!-- 标题 -->
          <div class="text-center mb-6">
            <div class="text-5xl mb-4">💬</div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {{ replyToName ? `回复 ${replyToName}` : '发表评论' }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">分享您的想法</p>
          </div>

          <!-- 表单 -->
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- 富文本编辑器 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容 <span class="text-red-500">*</span>
              </label>
              <QhxRichTextEditor
                v-model="editorContent"
                placeholder="请输入评论内容..."
                :min-height="200"
                :max-height="300"
                ref="richTextEditorRef"
              />
            </div>

            <!-- 图片选择 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                图片 <span class="text-gray-500 text-xs">(最多9张，支持拖拽排序)</span>
              </label>
              <QhxImagePicker 
                :multiple="true" 
                :max="9"
                @update:files="onUpdateFiles" 
                ref="imagePickerRef" 
              />
            </div>

            <!-- 按钮组 -->
            <div class="flex gap-4 pt-4">
              <button
                type="button"
                @click="handleClose"
                class="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full font-bold transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                :disabled="submitting || !hasContent"
                class="flex-1 px-6 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-full font-bold transition-colors shadow-lg shadow-qhx-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span v-if="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{{ submitting ? '发布中...' : '发布' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
// QhxRichTextEditor 在模板中使用，需要作为值导入
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'

import { insertComment } from '@/api/comment'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import type { Comment } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'

interface Props {
  modelValue: boolean
}

interface ShowModalParams {
  id: number | string
  type: string
  reply_to?: number
  reply_to_name?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [value: Comment]
}>()

const toast = useToast()
const userStore = useUserStore()
const configStore = useConfigStore()

const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const richTextEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)

// 评论相关状态
const commentId = ref<number | string | null>(null)
const commentType = ref<string>('')
const replyTo = ref<number | undefined>(undefined)
const replyToName = ref<string>('')

// 编辑器内容
const editorContent = ref('')

// 缓存内容
const cachedContent = ref('')
const cachedImages = ref<string[]>([])

// 检查是否有内容
const hasContent = computed(() => {
  if (!richTextEditorRef.value) return false
  const html = richTextEditorRef.value.getContent()
  return html && html.trim() !== '<p></p>' && html.trim() !== '<p><br></p>'
})

// Upload & Submit Logic
const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  try {
    const res = await uploadImageOSS(file)
    return res
  } catch (error) {
    console.error('图片上传失败:', error)
    throw error
  }
}

const onUpdateFiles = (files: File[]) => {
  if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 9) {
    toast.add({
      title: '最多只能上传9张图片',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    imagePickerRef.value.previewImages = imagePickerRef.value.previewImages.slice(0, 9)
  }
  // 缓存图片
  if (imagePickerRef.value) {
    cachedImages.value = imagePickerRef.value.previewImages.map(img => typeof img === 'string' ? img : img.url || '')
  }
}

// 显示弹窗方法
const showModel = async (e: ShowModalParams) => {
  // 设置参数
  commentId.value = e.id
  commentType.value = e.type
  replyTo.value = e.reply_to
  replyToName.value = e.reply_to_name || ''
  
  console.log(replyTo.value, '回复对象')

  // 恢复缓存内容
  if (cachedContent.value && richTextEditorRef.value) {
    richTextEditorRef.value.setContent(cachedContent.value)
    editorContent.value = cachedContent.value
  }
  if (cachedImages.value.length > 0 && imagePickerRef.value) {
    // 恢复图片（需要根据实际 ImagePicker 组件的 API 调整）
    // imagePickerRef.value.previewImages = cachedImages.value
  }

  // 显示弹窗
  emit('update:modelValue', true)
}

// 关闭弹窗
const handleClose = () => {
  // 保存当前内容到缓存
  if (richTextEditorRef.value) {
    cachedContent.value = richTextEditorRef.value.getContent()
  }
  if (imagePickerRef.value) {
    cachedImages.value = imagePickerRef.value.previewImages.map(img => typeof img === 'string' ? img : img.url || '')
  }

  emit('update:modelValue', false)
}

// 提交评论
const handleSubmit = async () => {
  if (!richTextEditorRef.value || richTextEditorRef.value.isEmpty) {
    toast.add({
      title: '请输入内容',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (commentId.value === undefined || !commentType.value) {
    console.log(commentId.value, commentType.value, '参数错误')
    toast.add({
      title: '参数错误',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  submitting.value = true

  try {
    const content = richTextEditorRef.value.getContent()

    // 上传图片
    let mountImg: string | undefined = undefined
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages
          .filter((img): img is { file?: File; url: string } => typeof img === 'object' && 'url' in img && typeof img.url === 'string')
          .map(img => fetchUpload(img))
        const imgList = await Promise.all(uploadPromises)
        mountImg = imgList.join(',')
        // 缓存图片
        cachedImages.value = imgList
      } catch (error) {
        toast.add({
          title: '图片上传失败',
          description: '请检查图片后重试',
          icon: 'i-heroicons-x-circle',
          color: 'red'
        })
        submitting.value = false
        return
      }
    }

    // 构建参数
    if (commentId.value === null) {
      toast.add({
        title: '参数错误',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      submitting.value = false
      return
    }

    const params: {
      page: number
      pageSize: number
      id: number
      type: string
      comment_content: string
      mount_img?: string
      reply_to?: number
    } = {
      page: 1,
      pageSize: 1,
      id: Number.parseInt(commentId.value.toString()),
      type: commentType.value,
      comment_content: content,
    }

    if (mountImg) {
      params.mount_img = mountImg
    }

    if (replyTo.value !== undefined) {
      params.reply_to = replyTo.value
    }

    const comment = await insertComment(params)

    toast.add({
      title: '评论成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    // 清空内容
    if (richTextEditorRef.value) {
      richTextEditorRef.value.clearContent()
      editorContent.value = ''
      cachedContent.value = ''
    }
    if (imagePickerRef.value) {
      imagePickerRef.value.clear()
      cachedImages.value = []
    }

    emit('success', comment)
    handleClose()
  } catch (error: unknown) {
    console.error('评论失败:', error)
    const errorMessage = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '评论失败',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

// 监听弹窗显示状态
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    // 弹窗关闭时保存内容
    if (richTextEditorRef.value) {
      cachedContent.value = richTextEditorRef.value.getContent()
    }
  }
})

// 监听编辑器内容变化，更新缓存
watch(() => editorContent.value, (newContent) => {
  cachedContent.value = newContent
})

// 暴露方法给父组件
defineExpose({
  showModel
})
</script>

<style scoped>
/* Modal Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

