<template>
  <div class="rich-text-editor">
    <div class="bg-white dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 overflow-visible relative">
      <!-- 工具栏 -->
      <div v-if="editor" class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2 flex gap-2 flex-wrap items-center">
        <!-- 基础格式化按钮 -->
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

        <!-- 分隔符 -->
        <div v-if="enableTopic || enableEmoji || enableMention" class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <!-- 话题按钮 -->
        <button 
          v-if="enableTopic"
          type="button" 
          class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          @click="openTopicModal"
        >
          <span class="text-pink-500 font-bold">#</span> 话题
        </button>

        <!-- Emoji 按钮 -->
        <div v-if="enableEmoji" class="relative">
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
          v-if="enableMention"
          type="button" 
          class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          @click="insertUserMentionTrigger"
        >
          <span class="text-blue-500 font-bold">@</span> 用户
        </button>
      </div>
      
      <!-- 编辑器内容 -->
      <editor-content 
        :editor="editor" 
        class="editor-content"
        :style="{
          minHeight: `${minHeight}px`,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          overflowY: maxHeight ? 'auto' : undefined
        }"
      />
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import { BASE_IMG } from '@/utils/ipConfig'
import MentionList from '@/components/community/MentionList.vue'

interface Props {
  modelValue?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  enableMention?: boolean
  enableTopic?: boolean
  enableEmoji?: boolean
  mentionUsers?: string[]
  topicSuggestions?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请输入内容...',
  minHeight: 200,
  maxHeight: 300,
  enableMention: false,
  enableTopic: false,
  enableEmoji: false,
  mentionUsers: () => [],
  topicSuggestions: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update': [value: string]
}>()

const userStore = useUserStore()
const configStore = useConfigStore()

const showTopicModal = ref(false)
const topicInput = ref('')
const showEmojiPicker = ref(false)

// Emoji Config
const emojiConfig = computed(() => configStore.config?.emoji_config || [])

// Mention Suggestion Logic
const createSuggestion = () => ({
  items: ({ query }: { query: string }) => {
    const defaultUsers = ['Lo研社', '管理员', '测试用户', userStore.user?.user_name].filter(Boolean) as string[]
    const users = props.mentionUsers.length > 0 ? props.mentionUsers : defaultUsers
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
})

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
  content: props.modelValue,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    // User Mention (@)
    ...(props.enableMention ? [
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: createSuggestion(),
      })
    ] : []),
    // Topic Mention (#)
    ...(props.enableTopic ? [
      TopicMention.configure({
        suggestion: {
          char: '#',
          items: ({ query }: { query: string }) => {
            const defaultTopics = ['日常', '提问', '晒图']
            const topics = props.topicSuggestions.length > 0 ? props.topicSuggestions : defaultTopics
            return topics.filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
          },
          render: createSuggestion().render
        }
      })
    ] : []),
  ],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    emit('update:modelValue', html)
    emit('update', html)
  },
})

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (editor.value && editor.value.getHTML() !== newValue) {
    editor.value.commands.setContent(newValue || '')
  }
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

// 获取内容
const getContent = () => {
  return editor.value?.getHTML() || ''
}

// 获取纯文本
const getText = () => {
  return editor.value?.getText() || ''
}

// 清空内容
const clearContent = () => {
  editor.value?.commands.clearContent()
}

// 设置内容
const setContent = (content: string) => {
  editor.value?.commands.setContent(content)
}

// 检查是否为空
const isEmpty = computed(() => {
  return editor.value?.isEmpty ?? true
})

onMounted(() => {
  configStore.getConfig() // Ensure config is loaded for emojis
})

onUnmounted(() => {
  editor.value?.destroy()
})

// 暴露方法和属性
defineExpose({
  editor,
  getContent,
  getText,
  clearContent,
  setContent,
  isEmpty
})
</script>

<style scoped>
/* Editor Styles */
:deep(.ProseMirror) {
  outline: none;
  padding: 1rem;
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

.editor-content {
  @apply prose dark:prose-invert max-w-none focus:outline-none;
}
</style>

