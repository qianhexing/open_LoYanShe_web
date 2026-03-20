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
        <div v-if="enableImageUpload || enableTopic || enableEmoji || enableMention || enableInternalLink" class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <!-- 插入图片（OSS 上传后插入可访问 URL，供 SafeRichText 展示） -->
        <button
          v-if="enableImageUpload"
          type="button"
          :disabled="imageUploading"
          class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
          title="上传并插入图片"
          @click="triggerImageUpload"
        >
          <UIcon
            :name="imageUploading ? 'i-heroicons-arrow-path' : 'material-symbols:add-photo-alternate-rounded'"
            class="text-base text-emerald-600 dark:text-emerald-400"
            :class="{ 'animate-spin': imageUploading }"
          />
          {{ imageUploading ? '上传中…' : '图片' }}
        </button>
        <input
          ref="imageFileInputRef"
          type="file"
          class="sr-only"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          @change="onRichTextImageSelected"
        >

        <div
          v-if="enableImageUpload && (enableTopic || enableEmoji || enableMention || enableInternalLink)"
          class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"
        />

        <!-- 站内链接：图鉴 / 百科等 -->
        <button
          v-if="enableInternalLink"
          type="button"
          class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          @click="openInternalLinkTypeModal($event)"
        >
          <UIcon name="material-symbols:link-rounded" class="text-base text-violet-500" />
          站内链接
        </button>

        <!-- 话题按钮 -->
        <button 
          v-if="enableTopic"
          type="button" 
          class="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          @click="openTopicModal($event)"
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

      {{ editor?.getHTML() }}
    </div>

    <!-- 话题输入弹窗 -->
    <QhxModal v-model="showTopicModal" :trigger-position="topicModalPosition">
      <div class="p-6 w-[min(100vw-2rem,420px)] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
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
            type="button"
            @click="showTopicModal = false" 
            class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button 
            type="button"
            @click="confirmInsertTopic" 
            class="px-4 py-2 text-sm bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
          >
            确定
          </button>
        </div>
      </div>
    </QhxModal>

    <!-- 站内链接：类型选择（样式参考场景/手账中的类型弹层） -->
    <ClientOnly>
      <div v-if="enableInternalLink">
        <QhxModal v-model="showInternalLinkTypeModal" :trigger-position="internalLinkTypeModalPosition">
          <div class="p-4 w-[220px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
            <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择链接类型</h3>

            <button
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
              @click="pickInternalLinkLibrary($event)"
            >
              <div
                class="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
              >
                <UIcon name="material-symbols:menu-book-rounded" class="text-base text-white" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">图鉴</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">链到图鉴详情页</div>
              </div>
            </button>

            <button
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group mt-2"
              @click="pickInternalLinkWiki($event)"
            >
              <div
                class="w-8 h-8 bg-pink-500 dark:bg-pink-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
              >
                <UIcon name="material-symbols:import-contacts-rounded" class="text-base text-white" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">百科词条</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">链到 Lolita 百科详情</div>
              </div>
            </button>
          </div>
        </QhxModal>

        <LibraryChoose
          ref="libraryChooseRef"
          :multiple="false"
          @choose="onLibraryInternalLinkChosen"
        />
        <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="onWikiInternalLinkChosen" />
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Node } from '@tiptap/core'
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
import { uploadImageOSS } from '@/utils/ossUpload'
import { contentToEditorFormat, type RichNode } from '@/utils/public'
import MentionList from '@/components/community/MentionList.vue'
import LibraryChoose from '@/components/library/LibraryChoose.vue'
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import type { Library } from '@/types/api'

interface Props {
  modelValue?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  enableMention?: boolean
  enableTopic?: boolean
  enableEmoji?: boolean
  /** 插入图鉴 / 百科等站内链接（图鉴、百科使用已有选择器） */
  enableInternalLink?: boolean
  /** 工具栏上传图片并插入编辑器（OSS 上传，src 为完整 https 地址以通过 SafeRichText 校验） */
  enableImageUpload?: boolean
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
  enableInternalLink: false,
  enableImageUpload: true,
  mentionUsers: () => [],
  topicSuggestions: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update': [value: string]
}>()

const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

const imageFileInputRef = ref<HTMLInputElement | null>(null)
const imageUploading = ref(false)

/** 将接口返回的相对路径转为带 CDN 域名的绝对地址（已是 http 则原样返回） */
function toAbsoluteImageSrc(storedPath: string): string {
  const p = storedPath.trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  const base = BASE_IMG.endsWith('/') ? BASE_IMG : `${BASE_IMG}/`
  const rest = p.replace(/^\//, '')
  return `${base}${rest}`
}

const showTopicModal = ref(false)
const topicModalPosition = ref({ x: 0, y: 0 })
const topicInput = ref('')
const showEmojiPicker = ref(false)
const showInternalLinkTypeModal = ref(false)
const internalLinkTypeModalPosition = ref({ x: 0, y: 0 })
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChoose> | null>(null)

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

// Emoji 标签节点：<a href="#emoji/{id}"><img /></a>，宽高 50px
const EmojiNode = Node.create({
  name: 'emoji',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      src: { default: null },
      alt: { default: null }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'emoji',
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          const img = el.querySelector('img')
          return {
            id: el.getAttribute('data-emoji-id'),
            src: img?.getAttribute('src'),
            alt: img?.getAttribute('alt')
          }
        }
      }
    ]
  },
  renderHTML({ node }) {
    const { id, src, alt } = node.attrs
    return [
      'emoji',
      {
        href: `${id ?? ''}`,
        'data-emoji-id': String(id ?? ''),
        class: 'rich-text-emoji',
      },
      ['img', { src: src ?? '', alt: alt ?? '', class: 'emoji-img' }],
    ]
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
    StarterKit.configure({
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-qhx-primary underline',
        },
      },
    }),
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
    // Emoji 标签（<emoji>，data-emoji-id 记录 id，50x50px）
    ...(props.enableEmoji ? [EmojiNode] : []),
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
const modalTriggerFromEvent = (e?: MouseEvent) => {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  if (e) return { x: e.clientX, y: e.clientY }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

const openTopicModal = (e?: MouseEvent) => {
  topicModalPosition.value = modalTriggerFromEvent(e)
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

// Emoji Logic - 插入 emoji 标签，href 记录 id
const insertEmoji = (emoji: { url: string, label: string, value: number }) => {
  if (editor.value) {
    editor.value.chain().focus().insertContent({
      type: 'emoji',
      attrs: {
        id: emoji.value,
        src: BASE_IMG + emoji.url,
        alt: emoji.label,
      },
    }).run()
    showEmojiPicker.value = false
  }
}

// User Mention Trigger
const insertUserMentionTrigger = () => {
  editor.value?.chain().focus().insertContent('@').run()
}

const triggerImageUpload = () => {
  imageFileInputRef.value?.click()
}

const onRichTextImageSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !editor.value) return
  if (!file.type.startsWith('image/')) {
    toast.add({ title: '请选择图片文件', color: 'orange', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  const maxBytes = 15 * 1024 * 1024
  if (file.size > maxBytes) {
    toast.add({ title: '图片请小于 15MB', color: 'orange', icon: 'i-heroicons-exclamation-circle' })
    return
  }
  imageUploading.value = true
  try {
    const path = await uploadImageOSS({ file })
    const src = toAbsoluteImageSrc(path)
    if (!src) {
      toast.add({ title: '上传未返回图片地址', color: 'red', icon: 'i-heroicons-x-circle' })
      return
    }
    editor.value.chain().focus().setImage({ src, alt: file.name.replace(/[<>"]/g, '') }).insertContent(' ').run()
  } catch (err) {
    console.error(err)
    toast.add({
      title: '图片上传失败',
      description: '请稍后重试',
      color: 'red',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    imageUploading.value = false
  }
}

const insertEditorLink = (href: string, label: string) => {
  const text = label.trim() || href
  editor.value?.chain().focus().insertContent({
    type: 'text',
    text,
    marks: [{ type: 'link', attrs: { href } }],
  }).insertContent(' ').run()
}

const openInternalLinkTypeModal = (e?: MouseEvent) => {
  internalLinkTypeModalPosition.value = modalTriggerFromEvent(e)
  showInternalLinkTypeModal.value = true
}

const pickInternalLinkLibrary = (e: MouseEvent) => {
  showInternalLinkTypeModal.value = false
  nextTick(() => libraryChooseRef.value?.showModel(e))
}

const pickInternalLinkWiki = (e: MouseEvent) => {
  showInternalLinkTypeModal.value = false
  nextTick(() => wikiOptionsChooseRef.value?.showModel({}, e))
}

const onLibraryInternalLinkChosen = (list: Library[]) => {
  const item = list[0]
  if (!item?.library_id) return
  const href = `/library/detail/${item.library_id}`
  insertEditorLink(href, item.name)
}

const onWikiInternalLinkChosen = (list: { wiki_id?: number | string; wiki_name?: string }[]) => {
  const item = list[0]
  if (item?.wiki_id === undefined || item?.wiki_id === null || item.wiki_id === '') return
  const href = `/lolitaWiki/detail/${item.wiki_id}`
  insertEditorLink(href, item.wiki_name || `词条${item.wiki_id}`)
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

/**
 * 将内容还原为编辑器可编辑格式后设置
 * 参考 SafeRichText 解析逻辑，支持 HTML 或 RichNode[]（如 parseRichText 结果）
 * emoji 会还原成 <emoji><img /></emoji> 以显示表情
 * @param content HTML 字符串 或 RichNode[]
 */
const setContentForEdit = (content: string | RichNode[]) => {
  const emojiConfig = configStore.config?.emoji_config ?? []
  const getEmojiUrl = (id: number) => {
    for (const cat of emojiConfig) {
      const emoji = cat.list?.find((e: { value: number }) => e.value === id)
      if (emoji?.url) return BASE_IMG + emoji.url
    }
    return ''
  }
  const editorHtml = contentToEditorFormat(content, { getEmojiUrl })
  console.log(editorHtml, 'editorHtml内容')
  editor.value?.commands.setContent(editorHtml)
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
  setContentForEdit,
  isEmpty
})
</script>

<style scoped>
/* Editor Styles */
:deep(.ProseMirror) {
  outline: none;
  padding: 1rem;
}
.rich-text-emoji{
  img{
    margin: 0 !important;
  }
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

/* Emoji 标签 <emoji>：宽高 50px，data-emoji-id 记录 id */
:deep(emoji.rich-text-emoji) {
  display: inline-block;
  width: 50px;
  height: 50px;
  vertical-align: bottom;
  /* margin: 0 2px; */
}

:deep(emoji.rich-text-emoji img) {
  width: 50px;
  height: 50px;
  object-fit: contain;
}

:deep(emoji.rich-text-emoji.ProseMirror-selectednode) {
  outline: 2px solid #ec4899;
}

.editor-content {
  @apply prose dark:prose-invert max-w-none focus:outline-none;
}
:deep(.editor-content img) {
  margin-top: 0;
  margin-bottom: 0;
}
</style>

