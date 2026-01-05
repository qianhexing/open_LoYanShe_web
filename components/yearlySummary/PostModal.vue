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
              <div class="bg-white dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                <!-- 工具栏 -->
                <div :id="`toolbar-${editorId}`" class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2">
                  <!-- <button type="button" class="ql-bold" title="粗体"></button>
                  <button type="button" class="ql-italic" title="斜体"></button>
                  <button type="button" class="ql-underline" title="下划线"></button>
                  <button type="button" class="ql-strike" title="删除线"></button>
                  <button type="button" class="ql-blockquote" title="引用"></button>
                  <button type="button" class="ql-code-block" title="代码块"></button>
                  <button type="button" class="ql-header" value="1" title="标题1"></button>
                  <button type="button" class="ql-header" value="2" title="标题2"></button>
                  <button type="button" class="ql-list" value="ordered" title="有序列表"></button>
                  <button type="button" class="ql-list" value="bullet" title="无序列表"></button>
                  <button type="button" class="ql-link" title="链接"></button>
                  <button type="button" class="ql-image" title="图片"></button> -->
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
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { insertCommunity, type CommunityInterface } from '@/api/community'
import { useUserStore } from '@/stores/user'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadFileToOSS, uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
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
const editorId = ref(`editor-${Date.now()}`)
const quill = ref<Quill | null>(null)
const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const formData = ref({
  title: '',
  content: ''
})

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

// 关闭弹窗
const handleClose = () => {
  emit('update:modelValue', false)
  // 重置表单
  formData.value = {
    title: '',
    content: ''
  }
  // 安全地清空编辑器内容
  try {
    if (quill.value) {
      const editorContainer = document.getElementById(`editor-${editorId.value}`)
      if (editorContainer) {
        quill.value.setText('')
      }
    }
  } catch (error) {
    console.warn('清空编辑器内容时出错:', error)
  }
  // 清空图片
  if (imagePickerRef.value) {
    try {
      imagePickerRef.value.clear()
    } catch (error) {
      console.warn('清空图片时出错:', error)
    }
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
    // 确保 submitting 状态被重置，但不访问可能已销毁的 Quill 实例
    submitting.value = false
  }
}

// 监听弹窗显示状态
watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    await initEditor()
  } else {
    destroyEditor()
  }
})

onMounted(() => {
  if (props.modelValue) {
    initEditor()
  }
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
</style>

