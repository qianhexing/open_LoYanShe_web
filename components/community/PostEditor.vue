<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <!-- 标题 -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-4">📝</div>
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">发帖分享</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">分享您的想法到社区</p>
      </div>

      <!-- 表单 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
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
              @click="handleCancel"
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

  </div>
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
  userId?: number
  skipSummaryLink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  userId: undefined,
  skipSummaryLink: false
})

const emit = defineEmits<{
  'success': [value: Community]
}>()

const toast = useToast()
const router = useRouter()
const userStore = useUserStore()

const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const richTextEditorRef = ref<InstanceType<typeof QhxRichTextEditor> | null>(null)

const formData = ref({
  title: '',
  content: ''
})

// Upload & Submit Logic (Similar to before)
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
}

const handleCancel = () => {
  router.back()
}

const handleSubmit = async () => {
  if (!formData.value.title.trim()) {
    toast.add({
      title: '请输入标题',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (!richTextEditorRef.value || richTextEditorRef.value.isEmpty) {
    toast.add({
      title: '请输入内容',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  submitting.value = true

  try {
    const currentUserId = props.userId || userStore.user?.user_id
    if (!currentUserId) {
      toast.add({
        title: '请先登录',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      submitting.value = false
      return
    }

    let finalContent = richTextEditorRef.value.getContent()
    if (!props.skipSummaryLink) {
      const summaryLink = `<a href="lolitalibrary.com/yearlySummary?user_id=${currentUserId}">#2025年终总结</a>`
      finalContent = `${summaryLink}<br><br>${finalContent}`
    }

    let imgList: string[] = []
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages
          .filter((img): img is { file?: File; url: string } => typeof img === 'object' && 'url' in img && typeof img.url === 'string')
          .map(img => fetchUpload(img))
        imgList = await Promise.all(uploadPromises)
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

    const params: CommunityInterface = {
      title: formData.value.title,
      content: finalContent,
      type: '日常交流',
      img_list: imgList.length > 0 ? imgList.join() : null
    }

    const community = await insertCommunity(params)

    toast.add({
      title: '发布成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    emit('success', community)
    router.push('/community')
  } catch (error: unknown) {
    console.error('发布失败:', error)
    const errorMessage = error instanceof Error ? error.message : '请稍后重试'
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
