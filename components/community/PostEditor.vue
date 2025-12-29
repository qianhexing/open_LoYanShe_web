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
                <button 
                  type="button" 
                  class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  @click="openTopicModal"
                >
                  <span class="text-pink-500 font-bold">#</span> 话题
                </button>

                <!-- Emoji 按钮 -->
                <div class="relative">
                  <button 
                    type="button" 
                    class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                    @click="showEmojiPicker = !showEmojiPicker"
                  >
                    <span>😊</span> 表情
                  </button>
                  
                  <!-- Emoji 选择器 -->
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
                    <!-- 关闭遮罩 -->
                    <div class="fixed inset-0 -z-10" @click="showEmojiPicker = false"></div>
                  </div>
                </div>

                <!-- 用户按钮 -->
                <button 
                  type="button" 
                  class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  @click="insertUserMentionTrigger"
                >
                  <span class="text-blue-500 font-bold">@</span> 用户
                </button>

              </div>
              
              <!-- 编辑器内容 -->
              <editor-content :editor="editor" class="min-h-[300px] max-h-[400px] overflow-y-auto p-4 prose dark:prose-invert max-w-none focus:outline-none" />
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { insertCommunity, type CommunityInterface } from '@/api/community'
import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import type { Community } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import MentionList from './MentionList.vue'

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
const configStore = useConfigStore()

const submitting = ref(false)
const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const showTopicModal = ref(false)
const topicInput = ref('')
const showEmojiPicker = ref(false)

const formData = ref({
  title: '',
  content: ''
})

// Emoji Config
const emojiConfig = computed(() => configStore.config?.emoji_config || [])

// Mention Suggestion Logic
const suggestion = {
  items: ({ query }: { query: string }) => {
    // Mock user list - in real app fetch from API
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
      placeholder: '请输入内容...',
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    // User Mention (@)
    Mention.configure({
      HTMLAttributes: {
        class: 'mention',
      },
      suggestion,
    }),
    // Topic Mention (#)
    TopicMention.configure({
      suggestion: {
        char: '#',
        // Mock topic suggestions or empty to allow creating new ones via typing
        items: ({ query }: { query: string }) => {
            return ['日常', '提问', '晒图'].filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
        },
        render: suggestion.render // Reuse same renderer
      }
    }),
  ],
  onUpdate: ({ editor }) => {
    formData.value.content = editor.getHTML()
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
      title: emoji.label // Use title to store extra info if needed, or stick to alt
    }).run()
    showEmojiPicker.value = false
  }
}

// User Mention Trigger
const insertUserMentionTrigger = () => {
  editor.value?.chain().focus().insertContent('@').run()
}

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

  if (!editor.value || editor.value.isEmpty) {
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

    let finalContent = editor.value.getHTML()
    if (!props.skipSummaryLink) {
      const summaryLink = `<a href="lolitalibrary.com/yearlySummary?user_id=${currentUserId}">#2025年终总结</a>`
      finalContent = `${summaryLink}<br><br>${finalContent}`
    }

    let imgList: string[] = []
    if (imagePickerRef.value && imagePickerRef.value.previewImages.length > 0) {
      try {
        const uploadPromises = imagePickerRef.value.previewImages.map(img => fetchUpload(img))
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
  } catch (error: any) {
    console.error('发布失败:', error)
    toast.add({
      title: '发布失败',
      description: error.message || '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  configStore.getConfig() // Ensure config is loaded for emojis
})

onUnmounted(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
/* Editor Styles */
:deep(.ProseMirror) {
  min-height: 300px;
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
  color: #3b82f6; /* blue-500 */
  background-color: rgba(59, 130, 246, 0.1);
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  font-weight: 500;
}

:deep(.topic-mention) {
  color: #ec4899; /* pink-500 */
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
  vertical-align: bottom; /* Adjust alignment for emojis */
  margin: 0 2px;
}
</style>