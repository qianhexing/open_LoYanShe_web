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
            <div class="bg-white dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <!-- 工具栏 -->
              <div :id="`toolbar-${editorId}`" class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2 flex gap-2">
                <button 
                  type="button" 
                  class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  @click="openTopicModal"
                >
                  <span class="text-pink-500 font-bold">#</span> 话题
                </button>
              </div>
              <!-- 编辑器容器 -->
              <div :id="`editor-${editorId}`" class="min-h-[300px] max-h-[400px] overflow-y-auto"></div>
            </div>
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
    <!-- 话题输入弹窗 -->
    <UModal v-model="showTopicModal">
      <div class="p-6 bg-white dark:bg-gray-800 rounded-lg">
        <h3 class="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">插入话题</h3>
        <input
          v-model="topicInput"
          type="text"
          class="w-full px-4 py-2 mb-6 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-gray-200"
          placeholder="请输入话题内容"
          @keyup.enter="confirmInsertTopic"
        />
        <div class="flex justify-end gap-3">
          <button 
            @click="showTopicModal = false" 
            class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button 
            @click="confirmInsertTopic" 
            class="px-4 py-2 text-sm bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
          >
            确定
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

// 注册自定义话题 Blot
const Embed = Quill.import('blots/embed') as any
class TopicBlot extends Embed {
  static create(value: string) {
    const node = super.create()
    node.setAttribute('data-topic', value)
    node.innerText = `#${value}#`
    node.setAttribute('contenteditable', 'false')
    return node
  }

  static value(node: HTMLElement) {
    return node.getAttribute('data-topic')
  }
}
TopicBlot.blotName = 'topic'
TopicBlot.tagName = 'span'
TopicBlot.className = 'topic-tag'
Quill.register(TopicBlot)

import { insertCommunity, type CommunityInterface } from '@/api/community'
import { useUserStore } from '@/stores/user'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'

interface Props {
  userId?: number
  skipSummaryLink?: boolean // 是否跳过添加年终总结链接
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
const editorId = ref(`editor-${Date.now()}`)
const quill = ref<Quill | null>(null)
const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const showTopicModal = ref(false)
const topicInput = ref('')

const formData = ref({
  title: '',
  content: ''
})

// 打开话题弹窗
const openTopicModal = () => {
  topicInput.value = ''
  showTopicModal.value = true
}

// 确认插入话题
const confirmInsertTopic = () => {
  const value = topicInput.value.trim()
  if (!value || !quill.value) return

  try {
    // 永远插入到文档末尾（最安全）
    const length = quill.value.getLength()
    const index = Math.max(0, length - 1)

    // 插入 topic Blot
    quill.value.insertEmbed(index, 'topic', value, 'user')

    // 插入空格，方便继续输入
    quill.value.insertText(index + 1, ' ', 'user')

    // ⚠️ setSelection 也要安全
    quill.value.setSelection(index + 2, 0, 'silent')
  } catch (err) {
    console.error('插入 topic 失败，尝试降级 HTML:', err)

    // 最终兜底（绝不会炸）
    try {
      const html = `<span class="topic">#${value}</span>&nbsp;`
      const length = quill.value.getLength()
      quill.value.clipboard.dangerouslyPasteHTML(length - 1, html)
    } catch (e) {
      console.error('HTML 插入也失败:', e)
    }
  }

  showTopicModal.value = false
}


// 初始化编辑器
const initEditor = async () => {
  await nextTick()
  const editorContainer = document.getElementById(`editor-${editorId.value}`)
  const toolbarContainer = document.getElementById(`toolbar-${editorId.value}`)
  
  if (!editorContainer || !toolbarContainer) return

  quill.value = new Quill(editorContainer, {
    modules: {
      toolbar: toolbarContainer
    },
    placeholder: '请输入内容...',
    theme: 'snow'
  })

  // 监听内容变化
  quill.value.on('text-change', () => {
    if (quill.value) {
      formData.value.content = quill.value.root.innerHTML
    }
  })
}

// 清理编辑器
const destroyEditor = () => {
  if (quill.value) {
    const editorContainer = document.getElementById(`editor-${editorId.value}`)
    const toolbarContainer = document.getElementById(`toolbar-${editorId.value}`)
    if (editorContainer) {
      editorContainer.innerHTML = ''
    }
    if (toolbarContainer) {
      toolbarContainer.innerHTML = ''
    }
    quill.value = null
  }
}

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

// 取消操作
const handleCancel = () => {
  router.back()
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

  if (!quill.value) {
    toast.add({
      title: '编辑器未初始化',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  // 安全地获取编辑器内容
  let content = ''
  try {
    const editorContainer = document.getElementById(`editor-${editorId.value}`)
    if (!editorContainer || !quill.value.root) {
      toast.add({
        title: '编辑器DOM元素不存在',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }
    content = quill.value.root.innerHTML
  } catch (error) {
    console.error('获取编辑器内容失败:', error)
    toast.add({
      title: '获取编辑器内容失败',
      description: '请刷新页面后重试',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    submitting.value = false
    return
  }

  if (!content || content.trim() === '<p><br></p>') {
    toast.add({
      title: '请输入内容',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    submitting.value = false
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
      submitting.value = false
      return
    }

    // 在内容头部拼接链接（如果不需要跳过）
    let finalContent = content
    if (!props.skipSummaryLink) {
      const summaryLink = `<a href="lolitalibrary.com/yearlySummary?user_id=${currentUserId}">#2025年终总结</a>`
      finalContent = `${summaryLink}<br><br>${content}`
    }

    // 处理图片上传
    let imgList: string[] = []
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages.map(img => fetchUpload(img))
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
    const params: CommunityInterface = {
      title: formData.value.title,
      content: finalContent,
      type: '日常交流', // 根据实际需求设置类型
      img_list: imgList.length > 0 ? imgList.join() : null
    }

    const community = await insertCommunity(params)

    toast.add({
      title: '发布成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    emit('success', community)
    
    // 发布成功后跳转到社区页面
    router.push('/community')
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
    // 确保 submitting 状态被重置，但不访问可能已销毁的 Quill 实例
    submitting.value = false
  }
}

onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  destroyEditor()
})
</script>

<style scoped>
/* Quill 编辑器样式调整 */
:deep(.ql-container) {
  font-size: 14px;
  font-family: inherit;
}

:deep(.ql-editor) {
  min-height: 300px;
  max-height: 400px;
}

:deep(.ql-toolbar) {
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
}

:deep(.ql-container) {
  border-bottom-left-radius: 1rem;
  border-bottom-right-radius: 1rem;
}

:deep(.ql-editor.ql-blank::before) {
  color: #9ca3af;
  font-style: normal;
}

:deep(.topic-tag) {
  color: #ec4899;
  font-weight: bold;
  margin: 0 4px;
  cursor: pointer;
  user-select: all;
  display: inline-block;
}
</style>

