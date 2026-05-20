<template>
  <div class="rich-text-editor">
    <div class="rte-editor-shell rounded-2xl border border-gray-100/90 dark:border-gray-500/45 overflow-visible relative">
      <!-- 工具栏：拟态风 + 图标；传 toolbar 则仅显示所列项 -->
      <div
        v-if="editor && showToolbar"
        class="rte-toolbar rounded-t-2xl px-3 py-2.5 flex gap-2.5 flex-wrap items-center border-b border-transparent"
        role="toolbar"
        aria-label="富文本格式"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="toolbarFlags.bold"
            type="button"
            class="rte-tb-btn"
            :class="{ 'rte-tb-btn--active': editor.isActive('bold') }"
            title="粗体"
            aria-label="粗体"
            :aria-pressed="editor.isActive('bold')"
            @click="editor.chain().focus().toggleBold().run()"
          >
            <UIcon name="material-symbols:format-bold-rounded" class="rte-tb-icon" />
          </button>
          <button
            v-if="toolbarFlags.italic"
            type="button"
            class="rte-tb-btn"
            :class="{ 'rte-tb-btn--active': editor.isActive('italic') }"
            title="斜体"
            aria-label="斜体"
            :aria-pressed="editor.isActive('italic')"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            <UIcon name="material-symbols:format-italic-rounded" class="rte-tb-icon" />
          </button>
          <button
            v-if="toolbarFlags.strike"
            type="button"
            class="rte-tb-btn"
            :class="{ 'rte-tb-btn--active': editor.isActive('strike') }"
            title="删除线"
            aria-label="删除线"
            :aria-pressed="editor.isActive('strike')"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            <UIcon name="material-symbols:format-strikethrough-rounded" class="rte-tb-icon" />
          </button>
        </div>

        <span
          v-if="hasBasicToolbar && (toolbarFlags.image || toolbarFlags.internalLink || toolbarFlags.topic || toolbarFlags.emoji || toolbarFlags.mention)"
          class="rte-toolbar-groove"
          aria-hidden="true"
        />

        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="toolbarFlags.emoji"
            type="button"
            class="rte-tb-btn rte-tb-btn--accent-amber"
            title="插入表情"
            aria-label="插入表情"
            @click="openEmojiModal($event)"
          >
            <UIcon name="material-symbols:sentiment-satisfied-rounded" class="rte-tb-icon" />
          </button>

          <button
            v-if="toolbarFlags.image"
            type="button"
            class="rte-tb-btn rte-tb-btn--accent-emerald"
            :class="{ 'rte-tb-btn--disabled': imageUploading }"
            :disabled="imageUploading"
            :title="imageUploading ? '上传中…' : '上传并插入图片'"
            :aria-label="imageUploading ? '上传中…' : '上传并插入图片'"
            @click="triggerImageUpload"
          >
            <UIcon
              :name="imageUploading ? 'i-heroicons-arrow-path' : 'material-symbols:image-rounded'"
              class="rte-tb-icon"
              :class="{ 'animate-spin': imageUploading }"
            />
          </button>
          <input
            ref="imageFileInputRef"
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            @change="onRichTextImageSelected"
          >

          <span
            v-if="toolbarFlags.image && (toolbarFlags.internalLink || toolbarFlags.topic || toolbarFlags.emoji || toolbarFlags.mention)"
            class="rte-toolbar-groove rte-toolbar-groove--narrow"
            aria-hidden="true"
          />

          <button
            v-if="toolbarFlags.internalLink"
            type="button"
            class="rte-tb-btn rte-tb-btn--accent-violet"
            title="插入站内链接"
            aria-label="插入站内链接"
            @click="openInternalLinkTypeModal($event)"
          >
            <UIcon name="material-symbols:link-rounded" class="rte-tb-icon" />
          </button>

          <button
            v-if="toolbarFlags.topic"
            type="button"
            class="rte-tb-btn rte-tb-btn--accent-pink"
            title="插入话题"
            aria-label="插入话题"
            @click="openTopicModal($event)"
          >
            <UIcon name="material-symbols:tag-rounded" class="rte-tb-icon" />
          </button>

          <button
            v-if="toolbarFlags.mention"
            type="button"
            class="rte-tb-btn rte-tb-btn--accent-sky"
            title="提及用户"
            aria-label="提及用户"
            @click="insertUserMentionTrigger"
          >
            <UIcon name="material-symbols:alternate-email-rounded" class="rte-tb-icon" />
          </button>
        </div>
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
    <QhxModal v-if="toolbarFlags.topic" v-model="showTopicModal" :trigger-position="topicModalPosition">
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

    <!-- 表情选择：QhxModal 居中展开 + trigger 位置动画，避免工具栏内绝对定位裁切/错位 -->
    <QhxModal v-if="toolbarFlags.emoji" v-model="showEmojiPicker" :trigger-position="emojiModalPosition">
      <div
        class="flex max-h-[min(24rem,70dvh)] w-[min(100vw-2rem,20rem)] flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">选择表情</h3>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <div v-for="(category, index) in emojiConfig" :key="index" class="mb-4 last:mb-0">
            <h4 class="mb-2 text-xs text-gray-500 dark:text-gray-400">{{ category.name }}</h4>
            <div class="grid grid-cols-5 gap-1.5 sm:grid-cols-6 sm:gap-2">
              <button
                v-for="emoji in category.list"
                :key="emoji.value"
                type="button"
                class="flex items-center justify-center rounded-lg p-1.5 outline-none ring-qhx-primary transition-colors hover:bg-gray-100 focus-visible:ring-2 dark:hover:bg-gray-700"
                @click="insertEmoji(emoji)"
              >
                <img :src="BASE_IMG + emoji.url" :alt="emoji.label" class="mx-auto h-6 w-6 object-contain" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </QhxModal>

    <!-- 站内链接：类型选择（样式参考场景/手账中的类型弹层） -->
    <ClientOnly>
      <div v-if="toolbarFlags.internalLink">
        <QhxModal v-model="showInternalLinkTypeModal" :trigger-position="internalLinkTypeModalPosition">
          <div
            class="p-4 w-[min(100vw-2rem,280px)] max-h-[min(70dvh,26rem)] overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 rounded-[10px] shadow-lg"
          >
            <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">选择站内链接类型</h3>

            <button
              v-for="opt in internalLinkPickerOptions"
              :key="opt.kind"
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group first:mt-0 mt-2"
              @click="pickInternalLinkKind(opt.kind, $event)"
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0"
                :class="opt.iconBg"
              >
                <UIcon :name="opt.icon" class="text-base text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ opt.title }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ opt.subtitle }}</div>
              </div>
            </button>
          </div>
        </QhxModal>

        <CommunityChoose ref="communityChooseRef" @choose="onCommunityInternalLinkChosen" />
        <LibraryChoose
          ref="libraryChooseRef"
          :multiple="false"
          @choose="onLibraryInternalLinkChosen"
        />
        <WardrobeChoose ref="wardrobeChooseRef" :multiple="false" @choose="onWardrobeInternalLinkChosen" :user_id="userStore.user?.user_id" />
        <WikiOptionsChoose ref="wikiOptionsChooseRef" @choose="onWikiInternalLinkChosen" />
        <ShopChoose ref="shopChooseRef" :multiple="false" @choose="onShopInternalLinkChosen" />
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Node, mergeAttributes } from '@tiptap/core'
import { useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'

import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { useUserStore } from '@/stores/user'
import { useConfigStore } from '@/stores/config'
import { searchUsersForMention } from '@/api/user'
import { BASE_IMG } from '@/utils/ipConfig'
import { uploadImageOSS } from '@/utils/ossUpload'
import { contentToEditorFormat, type RichNode } from '@/utils/public'
import MentionList from '@/components/community/MentionList.vue'
import type { MentionListItem } from '@/components/community/MentionList.vue'
import CommunityChoose from '@/components/community/CommunityChoose.vue'
import LibraryChoose from '@/components/library/LibraryChoose.vue'
import WikiOptionsChoose from '@/components/wiki/wikiOptionsChoose.vue'
import ShopChoose from '@/components/shop/ShopChoose.vue'
import WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import type { Community, Library, Shop, User, Wardrobe } from '@/types/api'

/** 工具栏按钮；传 `toolbar` 时仅渲染列表中的项（不传则粗体/斜体/删除线默认显示，其余由 enable* 控制） */
export type RichTextToolbarItem =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'image'
  | 'internalLink'
  | 'topic'
  | 'emoji'
  | 'mention'

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
  /** 仅显示所列工具项；与 enable* 二选一语义：传入后忽略各 enable*，且扩展按列表注册 */
  toolbar?: RichTextToolbarItem[]
  mentionUsers?: string[]
  /** 启用远程联想时请求 `POST /user/search/mention`；设为 false 则仅用本地昵称 + mentionUsers */
  mentionRemoteSearch?: boolean
  /** 远程联想每页条数（亦用于本地列表截断） */
  mentionRemotePageSize?: number
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
  enableImageUpload: false,
  mentionRemoteSearch: true,
  mentionRemotePageSize: 12,
  mentionUsers: () => [],
  topicSuggestions: () => []
})

const toolbarFlags = computed(() => {
  if (props.toolbar !== undefined) {
    const s = new Set(props.toolbar)
    return {
      bold: s.has('bold'),
      italic: s.has('italic'),
      strike: s.has('strike'),
      image: s.has('image'),
      internalLink: s.has('internalLink'),
      topic: s.has('topic'),
      emoji: s.has('emoji'),
      mention: s.has('mention'),
    }
  }
  return {
    bold: true,
    italic: true,
    strike: true,
    image: props.enableImageUpload,
    internalLink: props.enableInternalLink,
    topic: props.enableTopic,
    emoji: props.enableEmoji,
    mention: props.enableMention,
  }
})

const hasBasicToolbar = computed(
  () => toolbarFlags.value.bold || toolbarFlags.value.italic || toolbarFlags.value.strike
)

/** 未传 toolbar 时始终显示工具栏（含 B/I/S）；传了且为空数组则隐藏整栏 */
const showToolbar = computed(() => {
  if (props.toolbar !== undefined) {
    return props.toolbar.length > 0
  }
  return true
})

const initToolbarSet = props.toolbar !== undefined ? new Set(props.toolbar) : null
const extMentionEnabled = initToolbarSet ? initToolbarSet.has('mention') : props.enableMention
const extEmojiEnabled = initToolbarSet ? initToolbarSet.has('emoji') : props.enableEmoji
const extTopicEnabled = initToolbarSet ? initToolbarSet.has('topic') : props.enableTopic

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
const emojiModalPosition = ref({ x: 0, y: 0 })
const showInternalLinkTypeModal = ref(false)
const internalLinkTypeModalPosition = ref({ x: 0, y: 0 })
const communityChooseRef = ref<InstanceType<typeof CommunityChoose> | null>(null)
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const wikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChoose> | null>(null)
const shopChooseRef = ref<InstanceType<typeof ShopChoose> | null>(null)

/** 站内链接第一步：可选类型（按需在此数组末尾追加一项即可扩展） */
type RichTextInternalLinkKind = 'community' | 'library' | 'wardrobe' | 'shop' | 'wiki'

const internalLinkPickerOptions = [
  {
    kind: 'community' as const,
    title: '帖子',
    subtitle: '链到社区帖子详情',
    icon: 'i-heroicons-chat-bubble-left-right',
    iconBg: 'bg-rose-500 dark:bg-rose-600',
  },
  {
    kind: 'library' as const,
    title: '图鉴',
    subtitle: '链到图鉴详情页',
    icon: 'material-symbols:menu-book-rounded',
    iconBg: 'bg-blue-500 dark:bg-blue-600',
  },
  {
    kind: 'wardrobe' as const,
    title: '衣柜',
    subtitle: '链到衣柜详情页',
    icon: 'hugeicons:wardrobe-04',
    iconBg: 'bg-violet-500 dark:bg-violet-600',
  },
  {
    kind: 'shop' as const,
    title: '店铺',
    subtitle: '链到店铺详情页',
    icon: 'material-symbols:storefront-rounded',
    iconBg: 'bg-emerald-500 dark:bg-emerald-600',
  },
  {
    kind: 'wiki' as const,
    title: '百科词条',
    subtitle: '链到百科词条详情',
    icon: 'material-symbols:import-contacts-rounded',
    iconBg: 'bg-pink-500 dark:bg-pink-600',
  },
] satisfies readonly { kind: RichTextInternalLinkKind; title: string; subtitle: string; icon: string; iconBg: string }[]

// Emoji Config
const emojiConfig = computed(() => configStore.config?.emoji_config || [])

/** Tiptap 可能对 `targets` 返回单个实例或数组，统一成一项 */
function asTippyInstance(raw: unknown): null | {
  destroy: () => void
  hide?: () => void
  setProps: (patch: Record<string, unknown>) => void
} {
  if (!raw) return null
  if (Array.isArray(raw)) return (raw[0] as never) ?? null
  return raw as never
}

// Mention / #话题 联想弹出层（Tiptap VueRenderer）
function createMentionListPopupRenderer() {
  type MtProps = {
    editor?: unknown
    clientRect?: (() => DOMRect | null) | null
    event?: KeyboardEvent
    items: MentionListItem[]
    command: (item: MentionListItem) => void
  }

  return () => {
    let component: InstanceType<typeof VueRenderer> | null = null
    let popupRaw: unknown

    return {
      onStart: (p: MtProps) => {
        component = new VueRenderer(MentionList, {
          props: p as never,
          editor: p.editor as never,
        })

        if (!p.clientRect) return
        const clientRect = p.clientRect
        if (typeof document === 'undefined') return

        const el = component.element
        if (!(el instanceof HTMLElement)) return

        popupRaw = tippy(document.body, {
          theme: 'qhx-mention',
          arrow: false,
          getReferenceClientRect: () => {
            const r = clientRect()
            return r ?? new DOMRect(0, 0, 0, 0)
          },
          appendTo: () => document.body,
          content: el,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          zIndex: 40,
          moveTransition: 'transform 0.12s ease',
        })
      },
      onUpdate(p: MtProps) {
        component?.updateProps?.(p as never)
        const popup = asTippyInstance(popupRaw)
        const clientRect = p.clientRect
        if (!popup || !clientRect) return
        popup.setProps({
          getReferenceClientRect: () => {
            const r = clientRect()
            return r ?? new DOMRect(0, 0, 0, 0)
          },
        })
      },
      onKeyDown(p: MtProps) {
        const popup = asTippyInstance(popupRaw)
        const event = p.event as KeyboardEvent
        if (event?.key === 'Escape') {
          popup?.hide?.()
          return true
        }
        const refApi = component?.ref as { onKeyDown?: (payload: MtProps) => boolean } | undefined
        return refApi?.onKeyDown?.(p) ?? false
      },
      onExit() {
        const popup = asTippyInstance(popupRaw)
        popup?.destroy?.()
        component?.destroy?.()
        popupRaw = undefined
        component = null
      },
    }
  }
}

function mapUsersToMentionItems(rows: User[]): MentionListItem[] {
  const cap = props.mentionRemotePageSize ?? 12
  const out: MentionListItem[] = []
  for (const u of rows) {
    const name = u.user_name?.trim() ?? ''
    const rawUid = u.user_id
    const uidNum =
      rawUid != null && Number.isFinite(Number(rawUid)) ? Number(rawUid) : Number.NaN
    const id = Number.isFinite(uidNum) ? String(uidNum) : name
    if (!id || !name) continue
    const row: MentionListItem = { id, label: name }
    if (Number.isFinite(uidNum)) row.user_id = uidNum
    if (u.user_face?.trim()) row.user_face = u.user_face.trim()
    out.push(row)
  }
  return out.slice(0, cap)
}

function localFallbackMentionNicknames(query: string): MentionListItem[] {
  const cap = props.mentionRemotePageSize ?? 12
  const q = query.trim().toLowerCase()
  const defaultUsers = ['Lo研社', '管理员', '测试用户', userStore.user?.user_name].filter(Boolean) as string[]
  return defaultUsers
    .filter((n) => (q ? n.toLowerCase().includes(q) : true))
    .slice(0, cap)
    .map((n) => ({ id: n, label: n }))
}

async function buildMentionUserItems(query: string): Promise<MentionListItem[]> {
  const raw = query.trim()
  const cap = props.mentionRemotePageSize ?? 12
  if (props.mentionUsers.length > 0) {
    const q = raw.toLowerCase()
    return props.mentionUsers
      .filter((n) => !q || n.toLowerCase().includes(q))
      .slice(0, cap)
      .map((n) => ({ id: n, label: n }))
  }
  if (!props.mentionRemoteSearch) {
    return localFallbackMentionNicknames(raw)
  }
  try {
    const { rows } = await searchUsersForMention({
      keywords: raw,
      page: 1,
      pageSize: cap,
    })
    const mapped = mapUsersToMentionItems(rows ?? [])
    if (mapped.length) return mapped
  } catch (e) {
    if (import.meta.dev) console.warn('[mention] remote search fallback', e)
  }
  return localFallbackMentionNicknames(raw)
}

function buildTopicSuggestionRows(query: string): MentionListItem[] {
  const q = query.trim().toLowerCase()
  const defaultTopics = ['日常', '提问', '晒图']
  const topics = props.topicSuggestions.length > 0 ? props.topicSuggestions : defaultTopics
  return topics
    .filter((t) => (!q ? true : t.toLowerCase().includes(q)))
    .slice(0, 8)
    .map((t) => ({ id: t, label: t }))
}

const userMentionSuggestion = () => ({
  /** `null`：不限制前缀，任意字符后可触发 @（默认仅空格/行首） */
  allowedPrefixes: null,
  items: async ({ query }: { query: string }) => buildMentionUserItems(query),
  render: createMentionListPopupRenderer(),
})

const topicSuggestionConfig = () => ({
  char: '#' as const,
  items: ({ query }: { query: string }) => buildTopicSuggestionRows(query),
  render: createMentionListPopupRenderer(),
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
    const parent = this.parent?.()
    return {
      ...parent,
      suggestions: parent?.suggestions ?? [],
      deleteTriggerWithBackspace: parent?.deleteTriggerWithBackspace ?? false,
      HTMLAttributes: {
        class: 'topic-mention',
      },
      renderText({ node, suggestion }) {
        const ch = suggestion?.char ?? '#'
        const lb = (node.attrs.label || node.attrs.id) ?? ''
        return `${ch}${lb}`
      },
      renderHTML({ node, suggestion, options }) {
        const ch = suggestion?.char ?? '#'
        const lb = (node.attrs.label || node.attrs.id) ?? ''
        return [
          'span',
          mergeAttributes(
            { 'data-type': 'topic' },
            options.HTMLAttributes,
            {
              'data-id': String(node.attrs.id ?? lb),
              'data-label': String(node.attrs.label ?? lb),
            }
          ),
          `${ch}${lb}`,
        ]
      },
    } as any
  },
})

/**
 * 默认 Link 的 inclusive() 等于 autolink，为 true 时链接末尾继续输入会算进 <a>。
 * 固定为 false，与是否开启自动链 URL 无关。
 */
const EditorLink = Link.extend({
  inclusive: () => false,
}).configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'text-qhx-primary underline rich-inline-link',
  },
})

// Initialize Editor
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      link: false,
    }),
    EditorLink,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    // User Mention (@)
    ...(extMentionEnabled ? [
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: userMentionSuggestion() as never,
      })
    ] : []),
    // Emoji 标签（<emoji>，data-emoji-id 记录 id，50x50px）
    ...(extEmojiEnabled ? [EmojiNode] : []),
    // Topic Mention (#)
    ...(extTopicEnabled ? [
      TopicMention.configure({
        suggestion: topicSuggestionConfig() as never,
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

const openEmojiModal = (e?: MouseEvent) => {
  emojiModalPosition.value = modalTriggerFromEvent(e)
  showEmojiPicker.value = true
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
  editor.value
    ?.chain()
    .focus()
    .insertContent({
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href } }],
    })
    .insertContent(' ')
    .command(({ tr, dispatch }) => {
      if (dispatch) dispatch(tr.setStoredMarks(null))
      return true
    })
    .run()
}

const openInternalLinkTypeModal = (e?: MouseEvent) => {
  internalLinkTypeModalPosition.value = modalTriggerFromEvent(e)
  showInternalLinkTypeModal.value = true
}

/** 关掉类型面板后再打开对应选择器，避免双弹层叠在有问题的环境下错位 */
function afterCloseInternalLinkTypeModal(run: () => void) {
  showInternalLinkTypeModal.value = false
  nextTick(run)
}

function pickInternalLinkKind(kind: RichTextInternalLinkKind, e: MouseEvent) {
  afterCloseInternalLinkTypeModal(() => {
    switch (kind) {
      case 'community':
        communityChooseRef.value?.showModel(e)
        break
      case 'library':
        libraryChooseRef.value?.showModel(e)
        break
      case 'wardrobe':
        wardrobeChooseRef.value?.showModel()
        break
      case 'shop':
        shopChooseRef.value?.showModel(e)
        break
      case 'wiki':
        wikiOptionsChooseRef.value?.showModel({}, e)
        break
    }
  })
}

const onCommunityInternalLinkChosen = (item: Community) => {
  const id = item.community_id
  if (id == null || !Number.isFinite(Number(id))) return
  const label = (item.title ?? '').trim() || '帖子'
  insertEditorLink(`/community/detail/${id}`, label)
}

const onLibraryInternalLinkChosen = (list: Library[]) => {
  const item = list[0]
  if (!item?.library_id) return
  const href = `/library/detail/${item.library_id}`
  insertEditorLink(href, (item.name ?? '').trim() || '图鉴')
}

const onWardrobeInternalLinkChosen = (list: Wardrobe[]) => {
  const item = list[0]
  const id = item?.wardrobe_id
  if (id == null || !Number.isFinite(Number(id))) return
  const label = (item.wardrobe_name ?? '').trim() || '衣柜'
  insertEditorLink(`/wardrobe/detail/${id}`, label)
}

const onShopInternalLinkChosen = (list: Shop[]) => {
  const item = list[0]
  if (!item?.shop_id) return
  const href = `/shop/detail/${item.shop_id}`
  insertEditorLink(href, (item.shop_name ?? '').trim() || '店铺')
}

const onWikiInternalLinkChosen = (list: { wiki_id?: number | string; wiki_name?: string }[]) => {
  if (!list?.length || !editor.value) return
  const items = list.filter(
    (item) => item?.wiki_id !== undefined && item?.wiki_id !== null && item.wiki_id !== ''
  )
  if (items.length === 0) return
  let chain = editor.value.chain().focus()
  for (const item of items) {
    const href = `/lolitaWiki/detail/${item.wiki_id}`
    const text = (item.wiki_name || `词条${item.wiki_id}`).trim() || href
    chain = chain.insertContent({
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href } }],
    }).insertContent(' ')
  }
  chain
    .command(({ tr, dispatch }) => {
      if (dispatch) dispatch(tr.setStoredMarks(null))
      return true
    })
    .run()
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

/* 站内链接：每段独立「块」，下划线不连成一条（多词条 / 相邻链接） */
:deep(.ProseMirror a.rich-inline-link) {
  display: inline-block;
  padding: 0 0.2em;
  margin: 0 0.12em;
  text-underline-offset: 0.15em;
  text-decoration-thickness: 1px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
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

/* 外层：纯色底，与工具栏一体 */
.rte-editor-shell {
  background: #f5f8fc;
}

:root.dark .rte-editor-shell,
.dark .rte-editor-shell {
  background: #454c5e;
}

/* 拟态工具栏（纯色 + 阴影造型） */
.rte-toolbar {
  --rte-tb-bg: #f5f8fc;
  --rte-tb-raised-1: rgba(255, 255, 255, 0.96);
  --rte-tb-raised-2: rgba(163, 177, 198, 0.22);
  --rte-tb-pressed-1: rgba(163, 177, 198, 0.2);
  --rte-tb-pressed-2: rgba(255, 255, 255, 0.9);
  --rte-tb-icon: #6b7380;
  background: #f5f8fc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

:root.dark .rte-toolbar,
.dark .rte-toolbar {
  --rte-tb-bg: #454c5e;
  --rte-tb-raised-1: rgba(255, 255, 255, 0.1);
  --rte-tb-raised-2: rgba(0, 0, 0, 0.34);
  --rte-tb-pressed-1: rgba(0, 0, 0, 0.28);
  --rte-tb-pressed-2: rgba(255, 255, 255, 0.07);
  --rte-tb-icon: #c4cad8;
  background: #454c5e;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
}

.rte-toolbar-groove {
  width: 2px;
  align-self: stretch;
  min-height: 28px;
  margin: 0 2px;
  border-radius: 2px;
  flex-shrink: 0;
  background: transparent;
  box-shadow:
    inset 1px 0 2px rgba(0, 0, 0, 0.065),
    inset -1px 0 2px rgba(255, 255, 255, 0.65);
}

:root.dark .rte-toolbar-groove,
.dark .rte-toolbar-groove {
  box-shadow:
    inset 1px 0 2px rgba(0, 0, 0, 0.36),
    inset -1px 0 2px rgba(255, 255, 255, 0.06);
}

.rte-toolbar-groove--narrow {
  margin: 0 1px;
}

.rte-tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 0.625rem;
  background: var(--rte-tb-bg);
  color: var(--rte-tb-icon);
  cursor: pointer;
  transition:
    box-shadow 0.18s ease,
    transform 0.15s ease,
    color 0.15s ease;
  outline: none;
  box-shadow:
    4px 4px 10px var(--rte-tb-raised-2),
    -3px -3px 10px var(--rte-tb-raised-1);
}

.rte-tb-btn:hover:not(:disabled):not(.rte-tb-btn--disabled) {
  transform: translateY(-1px);
  box-shadow:
    5px 5px 12px var(--rte-tb-raised-2),
    -4px -4px 12px var(--rte-tb-raised-1);
}

.rte-tb-btn:focus-visible {
  box-shadow:
    3px 3px 8px var(--rte-tb-raised-2),
    -2px -2px 8px var(--rte-tb-raised-1),
    0 0 0 2px color-mix(in srgb, var(--rte-tb-icon) 45%, transparent);
}

.rte-tb-btn:active:not(:disabled):not(.rte-tb-btn--disabled) {
  transform: translateY(0);
  box-shadow:
    inset 3px 3px 7px var(--rte-tb-pressed-1),
    inset -2px -2px 7px var(--rte-tb-pressed-2);
}

.rte-tb-btn--active {
  background: var(--primary-color);
  color: var(--inverted-color);
  box-shadow:
    inset 3px 3px 8px var(--rte-tb-pressed-1),
    inset -2px -2px 8px var(--rte-tb-pressed-2);
}

.rte-tb-btn--active .rte-tb-icon {
  color: var(--inverted-color);
}

.rte-tb-btn:disabled,
.rte-tb-btn--disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow:
    inset 2px 2px 5px var(--rte-tb-raised-2),
    inset -2px -2px 5px var(--rte-tb-raised-1);
}

.rte-tb-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.rte-tb-btn--accent-amber .rte-tb-icon {
  color: #d97706;
}
:root.dark .rte-tb-btn--accent-amber .rte-tb-icon,
.dark .rte-tb-btn--accent-amber .rte-tb-icon {
  color: #fbbf24;
}

.rte-tb-btn--accent-emerald .rte-tb-icon {
  color: #059669;
}
:root.dark .rte-tb-btn--accent-emerald .rte-tb-icon,
.dark .rte-tb-btn--accent-emerald .rte-tb-icon {
  color: #34d399;
}

.rte-tb-btn--accent-violet .rte-tb-icon {
  color: #7c3aed;
}
:root.dark .rte-tb-btn--accent-violet .rte-tb-icon,
.dark .rte-tb-btn--accent-violet .rte-tb-icon {
  color: #c4b5fd;
}

.rte-tb-btn--accent-pink .rte-tb-icon {
  color: #db2777;
}
:root.dark .rte-tb-btn--accent-pink .rte-tb-icon,
.dark .rte-tb-btn--accent-pink .rte-tb-icon {
  color: #f9a8d4;
}

.rte-tb-btn--accent-sky .rte-tb-icon {
  color: #0284c7;
}
:root.dark .rte-tb-btn--accent-sky .rte-tb-icon,
.dark .rte-tb-btn--accent-sky .rte-tb-icon {
  color: #7dd3fc;
}
</style>

