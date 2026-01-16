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
            <!-- Tiptap 编辑器 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容 <span class="text-red-500">*</span>
              </label>
              <div class="bg-white dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 overflow-visible relative">
                <!-- 工具栏 -->
                <div v-if="editor" class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2 flex gap-2 flex-wrap items-center">
                  <button 
                    type="button" 
                    @click="editor.chain().focus().toggleBold().run()"
                    :class="{ 'bg-gray-200 dark:bg-gray-600': editor.isActive('bold') }"
                    class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="粗体"
                  >
                    <span class="font-bold text-gray-700 dark:text-gray-200">B</span>
                  </button>
                  <button 
                    type="button" 
                    @click="editor.chain().focus().toggleItalic().run()"
                    :class="{ 'bg-gray-200 dark:bg-gray-600': editor.isActive('italic') }"
                    class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="斜体"
                  >
                    <span class="italic text-gray-700 dark:text-gray-200">I</span>
                  </button>
                  <button 
                    type="button" 
                    @click="editor.chain().focus().toggleStrike().run()"
                    :class="{ 'bg-gray-200 dark:bg-gray-600': editor.isActive('strike') }"
                    class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="删除线"
                  >
                    <span class="line-through text-gray-700 dark:text-gray-200">S</span>
                  </button>

                  <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

                  <!-- 话题按钮 -->
                  <!-- <button 
                    type="button" 
                    class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                    @click="openTopicModal"
                  >
                    <span class="text-pink-500 font-bold">#</span> 话题
                  </button> -->

                  <!-- Emoji 按钮 -->
                  <!-- <div class="relative">
                    <button 
                      type="button" 
                      class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                      @click="showEmojiPicker = !showEmojiPicker"
                    >
                      <span>😊</span> 表情
                    </button>
                    
                    <div v-if="showEmojiPicker" class="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 max-h-80 overflow-y-auto p-4">
                      <div v-for="(category, index) in emojiConfig" :key="index" class="mb-4">
                        <h4 class="text-xs text-gray-500 mb-2">{{ category.name }}</h4>
                        <div class="grid grid-cols-6 gap-2">
                          <button 
                            v-for="emoji in category.list" 
                            :key="emoji.value"
                            type="button"
                            class="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                            @click="insertEmoji(emoji)"
                          >
                            <img :src="BASE_IMG + emoji.url" :alt="emoji.label" class="w-6 h-6 object-contain" />
                          </button>
                        </div>
                      </div>
                      <div class="fixed inset-0 -z-10" @click="showEmojiPicker = false"></div>
                    </div>
                  </div> -->

                  <!-- 用户按钮 -->
                  <!-- <button 
                    type="button" 
                    class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                    @click="insertUserMentionTrigger"
                  >
                    <span class="text-blue-500 font-bold">@</span> 用户
                  </button> -->
                </div>
                
                <!-- 编辑器内容 -->
                <editor-content :editor="editor" class="min-h-[200px] max-h-[300px] overflow-y-auto p-4 prose dark:prose-invert max-w-none focus:outline-none" />
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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { insertComment } from '@/api/comment'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import type { Comment } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import MentionList from './MentionList.vue'

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
const showTopicModal = ref(false)
const topicInput = ref('')
const showEmojiPicker = ref(false)

// 评论相关状态
const commentId = ref<number | string | null>(null)
const commentType = ref<string>('')
const replyTo = ref<number | undefined>(undefined)
const replyToName = ref<string>('')

// 缓存内容
const cachedContent = ref('')
const cachedImages = ref<string[]>([])

// Emoji Config
const emojiConfig = computed(() => configStore.config?.emoji_config || [])

// 检查是否有内容
const hasContent = computed(() => {
  if (!editor.value) return false
  const html = editor.value.getHTML()
  return html && html.trim() !== '<p></p>' && html.trim() !== '<p><br></p>'
})

// Mention Suggestion Logic
const suggestion = {
  items: ({ query }: { query: string }) => {
    const users = ['Lo研社', '管理员', '测试用户', userStore.user?.user_name].filter(Boolean) as string[]
    return users.filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
  },
  render: () => {
    let component: any
    let popup: any

    return {
      onStart: (props: any) => {
        component = new VueRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },
      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }
        return component.ref?.onKeyDown(props)
      },
      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}

// Custom Topic Mention Extension
const TopicMention = Mention.extend({
  name: 'topic',
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class: 'topic-mention',
      },
      renderLabel({ options, node }) {
        return `#${(node.attrs.id || node.attrs.label) ?? ''}`
      },
    }
  },
})

// Initialize Editor
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '请输入评论内容...',
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    // User Mention (@)
    // Mention.configure({
    //   HTMLAttributes: {
    //     class: 'mention',
    //   },
    //   suggestion,
    // }),
    // Topic Mention (#)
    // TopicMention.configure({
    //   suggestion: {
    //     char: '#',
    //     items: ({ query }: { query: string }) => {
    //       return ['日常', '提问', '晒图'].filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
    //     },
    //     render: suggestion.render
    //   }
    // }),
  ],
  onUpdate: () => {
    // 缓存内容
    if (editor.value) {
      cachedContent.value = editor.value.getHTML()
    }
  },
})

// Topic Modal Logic
const openTopicModal = () => {
  topicInput.value = ''
  showTopicModal.value = true
}

const confirmInsertTopic = () => {
  const value = topicInput.value.trim()
  if (!value || !editor.value) return

  editor.value.chain().focus().insertContent({
    type: 'topic',
    attrs: {
      id: value,
      label: value
    }
  }).insertContent(' ').run()

  showTopicModal.value = false
}

// Emoji Logic
const insertEmoji = (emoji: { url: string, label: string }) => {
  if (editor.value) {
    editor.value.chain().focus().setImage({ 
      src: BASE_IMG + emoji.url, 
      alt: emoji.label,
      title: emoji.label
    }).run()
    showEmojiPicker.value = false
  }
}

// User Mention Trigger
const insertUserMentionTrigger = () => {
  editor.value?.chain().focus().insertContent('@').run()
}

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
  if (cachedContent.value && editor.value) {
    editor.value.commands.setContent(cachedContent.value)
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
  if (editor.value) {
    cachedContent.value = editor.value.getHTML()
  }
  if (imagePickerRef.value) {
    cachedImages.value = imagePickerRef.value.previewImages.map(img => typeof img === 'string' ? img : img.url || '')
  }

  emit('update:modelValue', false)
}

// 提交评论
const handleSubmit = async () => {
  if (!editor.value || editor.value.isEmpty) {
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
    const content = editor.value.getHTML()

    // 上传图片
    let mountImg: string | undefined = undefined
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages.map(img => fetchUpload(img))
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
    if (editor.value) {
      editor.value.commands.clearContent()
      cachedContent.value = ''
    }
    if (imagePickerRef.value) {
      imagePickerRef.value.clear()
      cachedImages.value = []
    }

    emit('success', comment)
    handleClose()
  } catch (error: any) {
    console.error('评论失败:', error)
    toast.add({
      title: '评论失败',
      description: error.message || '请稍后重试',
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
    if (editor.value) {
      cachedContent.value = editor.value.getHTML()
    }
  }
})

onMounted(() => {
  configStore.getConfig() // Ensure config is loaded for emojis
})

onUnmounted(() => {
  editor.value?.destroy()
})

// 暴露方法给父组件
defineExpose({
  showModel
})
</script>

<style scoped>
/* Editor Styles */
:deep(.ProseMirror) {
  min-height: 200px;
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

:deep(.mention) {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  font-weight: 500;
}

:deep(.topic-mention) {
  color: #ec4899;
  background-color: rgba(236, 72, 153, 0.1);
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  font-weight: 700;
}

:deep(img.ProseMirror-selectednode) {
  outline: 2px solid #ec4899;
}

:deep(img) {
  display: inline-block;
  vertical-align: bottom;
  margin: 0 2px;
}

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

