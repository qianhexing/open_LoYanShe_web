<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
    <div class="max-w-3xl mx-auto">
      <!-- 头部导航 -->
      <div class="flex items-center gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">发帖</h1>
        </div>
      </div>

      <!-- 表单 -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
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
              <div :id="`toolbar-${editorId}`" class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2 flex items-center gap-2">
                <button 
                  type="button" 
                  class="ql-topic-link px-3 py-1 text-sm bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 rounded hover:bg-pink-200 dark:hover:bg-pink-800 transition-colors"
                  title="插入话题链接"
                >
                  #话题
                </button>
              </div>
              <!-- 编辑器容器 -->
              <div :id="`editor-${editorId}`" class="min-h-[300px] max-h-[500px] overflow-y-auto"></div>
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
              @click="handleBack"
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { insertCommunity, type CommunityInterface } from '@/api/community'
import { useUserStore } from '@/stores/user'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'

// Quill 类型定义
interface QuillInstance {
  getSelection: (focus?: boolean) => { index: number; length: number } | null
  setSelection: (index: number, length?: number) => void
  getLength: () => number
  insertText: (index: number, text: string, source?: string | 'user' | 'api' | 'silent') => unknown
  formatText: (index: number, length: number, format: string, value: string) => unknown
  insertEmbed: (index: number, embedType: string, value: unknown) => unknown
  clipboard: {
    dangerouslyPasteHTML: (index: number, html: string) => void
  }
  root: {
    innerHTML: string
  }
  on: (event: string, handler: () => void) => void
}

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

const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const editorId = ref(`editor-${Date.now()}`)
// Quill 实例类型
const quill = ref<QuillInstance | null>(null)
const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const formData = ref({
  title: '',
  content: ''
})

// 插入话题链接
const insertTopicLink = () => {
  if (!quill.value) return

  const topicText = '#【周话题第二十七期】本周就是圣诞节了，大家来分享一下圣诞穿搭吧～🎄 '
  const topicUrl = '/community/detail/5092'

  try {
    // 1. 尝试聚焦，但不强制滚动
    try {
      quill.value.root.focus({ preventScroll: true })
    } catch (e) { /* ignore */ }
    
    // 2. 获取插入位置，使用 false 参数避免强制刷新 DOM 导致报错
    let index = 0
    try {
      const selection = quill.value.getSelection(false)
      const length = quill.value.getLength()
      
      if (selection) {
        index = selection.index
      } else {
        // 如果没有选区，默认插入到文档末尾
        index = Math.max(0, length - 1)
      }
      
      // 额外的边界检查
      if (index < 0) index = 0
      if (index > length) index = length
    } catch (e) {
      console.warn('获取选区失败，将插入到末尾', e)
      index = Math.max(0, quill.value.getLength() - 1)
    }

    // 3. 插入内容
    // 使用 'user' source 标记为用户操作
    quill.value.insertEmbed(index, 'editorTopic', {
      title: topicText.replace('#', '').trim(),
      url: topicUrl
    }, 'user')

    // 在话题后插入一个空格，方便用户继续输入
    quill.value.insertText(index + 1, ' ', 'user')

    // 4. 移动光标
    // 使用 setTimeout 确保 DOM 更新后再移动光标
    setTimeout(() => {
      if (quill.value) {
        // 移动到空格之后
        quill.value.setSelection(index + 2, 0)
        quill.value.root.focus()
      }
    }, 10)
  } catch (err) {
    console.error('插入话题失败:', err)
  }
}


// 初始化编辑器
const initEditor = async () => {
  // 确保只在客户端执行
  if (process.server) return
  const { default: Quill } = await import('quill')
  await import('quill/dist/quill.snow.css')
  await nextTick()
  const editorContainer = document.getElementById(`editor-${editorId.value}`)
  const toolbarContainer = document.getElementById(`toolbar-${editorId.value}`)
  
  if (!editorContainer || !toolbarContainer) return

  // 注册话题链接 Embed
  // @ts-ignore - Quill 类型定义不完善
  const Embed = Quill.import('blots/embed')
  // @ts-ignore - Quill 类型定义不完善
  class editorTopic extends Embed {
    static create(value: { title: string; url: string } | string) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const node = super.create()
      
      const data = typeof value === 'string' ? { title: value, url: '' } : value
      
      // 存储数据到 dataset
      node.setAttribute('data-title', data.title || '')
      node.setAttribute('data-url', data.url || '')
      node.setAttribute('contenteditable', 'false')

      // 直接设置内容，避免深层嵌套
      node.innerHTML = `#${data.title}`
      
      return node
    }
    // 返回节点自身的value值 用于撤销操作
    static value(node: HTMLElement) {
      return {
        title: node.getAttribute('data-title') || '',
        url: node.getAttribute('data-url') || ''
      }
    }
    static blotName = 'editorTopic'
    static tagName = 'span'
    static className = 'ql-topic-link-embed'
  }
  // @ts-ignore - Quill 类型定义不完善
  Quill.register(editorTopic)

  quill.value = new Quill(editorContainer, {
    modules: {
      toolbar: toolbarContainer
    },
    placeholder: '请输入内容...',
    theme: 'snow'
  }) as unknown as QuillInstance

  // 添加话题链接按钮点击事件
  const topicLinkButton = toolbarContainer.querySelector('.ql-topic-link')
  if (topicLinkButton) {
    topicLinkButton.addEventListener('click', (e) => {
      e.preventDefault()
      insertTopicLink()
    })
  }

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

// 返回上一页
const handleBack = () => {
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
    
    // 处理话题链接：将编辑器中的 span 转换为标准的 a 标签
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content
    const topics = tempDiv.querySelectorAll('.ql-topic-link-embed')
    topics.forEach(topic => {
      const url = topic.getAttribute('data-url') || ''
      const title = topic.getAttribute('data-title') || topic.textContent?.replace('#', '') || ''
      
      const link = document.createElement('a')
      link.href = url
      link.textContent = `#${title}`
      link.style.color = '#ec4899'
      link.style.textDecoration = 'none'
      
      topic.replaceWith(link)
    })
    content = tempDiv.innerHTML
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

    // 跳转到帖子详情页或社区列表
    if (community?.community_id) {
      router.push(`/community/detail/${community.community_id}`)
    } else {
      router.push('/community')
    }
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

onMounted(() => {
  setTimeout(() => {
    initEditor()
  })
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
  max-height: 500px;
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

/* 话题链接样式 */
:deep(.ql-topic-link-embed) {
  color: #ec4899;
  text-decoration: none;
  font-weight: 500;
  padding: 2px 4px;
  border-radius: 4px;
  background-color: rgba(236, 72, 153, 0.1);
  transition: all 0.2s;
}

:deep(.ql-topic-link-embed:hover) {
  background-color: rgba(236, 72, 153, 0.2);
  text-decoration: underline;
}
</style>

