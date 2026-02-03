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
            <div class="text-5xl mb-4">📝</div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">发帖分享</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ senceId ? '分享您的3D手账到社区' : '分享您的年度总结到社区' }}</p>
          </div>

          <!-- 表单 -->
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- 标题输入 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                标题 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.title"
                type="text"
                placeholder="请输入标题"
                required
                maxlength="100"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200 placeholder-gray-400"
              />
            </div>

            <!-- 富文本编辑器 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容 <span class="text-red-500">*</span>
              </label>
              <QhxRichTextEditor
                v-model="formData.content"
                placeholder="请输入内容..."
                :min-height="300"
                :max-height="400"
                :enable-topic="true"
                :enable-emoji="true"
                :enable-mention="true"
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
                :disabled="submitting || !formData.title.trim()"
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
import { ref } from 'vue'
// QhxRichTextEditor 在模板中使用，需要作为值导入
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import QhxRichTextEditor from '@/components/Qhx/RichTextEditor.vue'
import { insertCommunity, type CommunityInterface } from '@/api/community'
import { useUserStore } from '@/stores/user'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'
interface Props {
  modelValue: boolean
  userId?: number
  skipSummaryLink?: boolean // 是否跳过添加年终总结链接
  senceId?: number // 场景ID，如果提供则发场景帖子
}

const props = withDefaults(defineProps<Props>(), {
  userId: undefined,
  skipSummaryLink: false,
  senceId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [value: Community]
}>()

const toast = useToast()
const userStore = useUserStore()
const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const richTextEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)

const formData = ref({
  title: '',
  content: ''
})

// 图片上传处理函数
const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  try {
    const res = await uploadImageOSS(file)
    const url = res
    return url
  } catch (error) {
    console.error('图片上传失败:', error)
    throw error
  }
}

// 处理图片文件更新
const onUpdateFiles = (files: File[]) => {
  // 检查是否超过最大数量限制
  if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 9) {
    toast.add({
      title: '最多只能上传9张图片',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    // 移除超出限制的图片
    imagePickerRef.value.previewImages = imagePickerRef.value.previewImages.slice(0, 9)
  }
}

// 关闭弹窗
const handleClose = () => {
  emit('update:modelValue', false)
  // 重置表单
  formData.value = {
    title: '',
    content: ''
  }
  // 清空编辑器内容
  if (richTextEditorRef.value) {
    richTextEditorRef.value.clearContent()
  }
  // 清空图片
  if (imagePickerRef.value) {
    imagePickerRef.value.clear()
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formData.value.title.trim()) {
    toast.add({
      title: '请输入标题',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (!richTextEditorRef.value) {
    toast.add({
      title: '编辑器未初始化',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  // 获取编辑器内容
  const content = richTextEditorRef.value.getContent()

  if (!content || content.trim() === '<p></p>' || content.trim() === '<p><br></p>') {
    toast.add({
      title: '请输入内容',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  submitting.value = true

  try {
    // 获取当前用户ID
    const currentUserId = props.userId || userStore.user?.user_id
    if (!currentUserId) {
      toast.add({
        title: '请先登录',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }

    // 在内容头部拼接链接或场景iframe
    let finalContent = content
    if (props.senceId) {
      // 场景发帖：添加场景iframe
      const sceneUrl = `https://lolitalibrary.com/scene/detail/${props.senceId}`
      const sceneIframe = `<p><iframe style="width:100%; height:60vh" frameborder="0" allowfullscreen mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking" xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share src="${sceneUrl}"> </iframe></p>`
      finalContent = `${sceneIframe}<br><br>${content}`
    } else if (!props.skipSummaryLink) {
      // 年度总结发帖：添加年度总结链接
      const summaryLink = `<a href="lolitalibrary.com/yearlySummary?user_id=${currentUserId}">#2025年终总结</a>`
      finalContent = `${summaryLink}<br><br>${content}`
    }

    // 处理图片上传
    let imgList: string[] = []
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages
          .filter((img): img is { file?: File; url: string } => typeof img === 'object' && 'url' in img && typeof img.url === 'string')
          .map(img => fetchUpload(img))
        imgList = await Promise.all(uploadPromises)
      } catch (error) {
        console.error('图片上传失败:', error)
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

    // 调用API发帖
    const params: CommunityInterface & { sence_id?: number } = {
      title: formData.value.title,
      content: finalContent,
      type: props.senceId ? '3D' : '日常交流', // 场景帖子类型为3D，年度总结为日常交流
      img_list: imgList.length > 0 ? imgList.join() : null,
      ...(props.senceId ? { sence_id: props.senceId } : {})
    }

    const community = await insertCommunity(params as CommunityInterface)

    toast.add({
      title: '发布成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    emit('success' , community)
    handleClose()
  } catch (error: unknown) {
    console.error('发布失败:', error)
    // 安全地提取错误信息，避免访问可能为 null 的对象
    let errorMessage = '请稍后重试'
    try {
      if (error instanceof Error) {
        errorMessage = error.message || '请稍后重试'
      } else if (typeof error === 'object' && error !== null) {
        const err = error as Record<string, unknown>
        if (err.message && typeof err.message === 'string') {
          errorMessage = err.message
        }
      }
    } catch (e) {
      // 如果提取错误信息时出错，使用默认消息
      console.error('提取错误信息失败:', e)
    }
    toast.add({
      title: '发布失败',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}
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

