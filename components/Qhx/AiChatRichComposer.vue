<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

import { Extension, useEditor, EditorContent, VueRenderer } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

import { getLibraryMentionList } from '@/api/library'
import MentionList from '@/components/community/MentionList.vue'
import type { MentionListItem } from '@/components/community/MentionList.vue'


function escapeHtmlFlat(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type JsonFrag = Record<string, unknown> & {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: JsonFrag[]
}

/** `@tiptap/suggestion` 选中项触发命令时编辑器 API 的子集（项目未直连 @tiptap/core types） */
type MentionCommandEditor = {
  chain: () => {
    focus: () => {
      deleteRange: (range: { from: number; to: number }) => { run: () => boolean }
      insertContentAt: (
        range: { from: number; to: number },
        content: unknown
      ) => { run: () => boolean }
    }
  }
  state: {
    selection: {
      $to: {
        nodeAfter?: null | { isText?: boolean; text?: string | undefined }
      }
    }
  }
}

function inlineFragmentsToOutbound(nodes: JsonFrag[] | undefined): string {
  if (!nodes?.length) return ''
  const chunks: string[] = []
  for (const n of nodes) {
    const t = n.type ?? ''
    if (t === 'text') {
      chunks.push(String(n.text ?? ''))
      continue
    }
    if (t === 'hardBreak') {
      chunks.push('\n')
      continue
    }
    if (t === 'mention') {
      const id = String(n.attrs?.id ?? '').trim()
      const label = String(n.attrs?.label ?? '').trim()
      chunks.push(label ? `@${label}` : '@')
      if (id && /^\d+$/.test(id)) chunks.push(`[#${id}]`)
    }
  }
  return chunks.join('')
}

function composeAiChatOutboundPlain(editor: {
  getJSON: () => unknown
}): string {
  const root = editor.getJSON() as JsonFrag
  const blocks = root.content ?? []
  const rows: string[] = []
  for (const block of blocks) {
    const t = block.type ?? ''
    if (t === 'paragraph' || t === 'heading') {
      rows.push(inlineFragmentsToOutbound(block.content))
    }
  }
  return rows.join('\n').replace(/\n+$/, '').trim()
}

const props = withDefaults(
  defineProps<{
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '输入消息…',
    disabled: false
  }
)

const emit = defineEmits<{
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
  submit: []
  outboundPlainChange: [v: string]
}>()


function emitOutboundPlain(
  editorInstance: { getJSON: () => unknown } | null
) {
  if (!editorInstance) {
    emit('outboundPlainChange', '')
    return
  }
  emit('outboundPlainChange', composeAiChatOutboundPlain(editorInstance))
}

function asTippyInstance(raw: unknown): null | {
  destroy: () => void
  hide?: () => void
  setProps: (patch: Record<string, unknown>) => void
} {
  if (!raw) return null
  if (Array.isArray(raw)) return (raw[0] as never) ?? null
  return raw as never
}

const LIBRARY_MENTION_MENU_UI = {
  emptyHint: '请输入图鉴关键词以搜索',
  panelAriaLabel: '@ 插入图鉴',
  variant: 'library' as const
} as const

/** Tiptap Mention 联想弹出层（与发帖富文本里 @ 用户的 Tippy + MentionList 模式一致） */
function createMentionListPopupRenderer() {
  type MtProps = {
    editor?: unknown
    clientRect?: (() => DOMRect | null) | null
    event?: KeyboardEvent
    items: MentionListItem[]
    command: (item: MentionListItem) => void
    emptyHint?: string
    panelAriaLabel?: string
    variant?: 'user' | 'library'
  }

  return () => {
    let component: InstanceType<typeof VueRenderer> | null = null
    let popupRaw: unknown

    return {
      onStart: (p: MtProps) => {
        const propsForList: MtProps = { ...p, ...LIBRARY_MENTION_MENU_UI }
        component = new VueRenderer(MentionList, {
          props: propsForList as never,
          editor: p.editor as never
        })

        if (!p.clientRect) return
        const clientRect = p.clientRect
        if (typeof document === 'undefined') return

        const el = component.element
        if (!(el instanceof HTMLElement)) return

        popupRaw = tippy(document.body, {
          theme: 'qhx-mention',
          arrow: false,
          getReferenceClientRect: () => clientRect() ?? new DOMRect(0, 0, 0, 0),
          appendTo: () => document.body,
          content: el,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'top-start',
          popperOptions: {
            modifiers: [{ name: 'flip', enabled: false }]
          },
          zIndex: 40,
          moveTransition: 'transform 0.12s ease'
        })
      },
      onUpdate(p: MtProps) {
        component?.updateProps?.({ ...p, ...LIBRARY_MENTION_MENU_UI } as never)
        const popup = asTippyInstance(popupRaw)
        const clientRect = p.clientRect
        if (!popup || !clientRect) return
        popup.setProps({
          getReferenceClientRect: () => clientRect() ?? new DOMRect(0, 0, 0, 0)
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
      }
    }
  }
}

async function buildLibraryMentionItems(rawQuery: string): Promise<MentionListItem[]> {
  const q = rawQuery.trim()
  if (!q) return []

  try {
    const data = await getLibraryMentionList({
      page: 1,
      pageSize: 12,
      keyword: q
    })
    const rows = data.rows ?? []
    const out: MentionListItem[] = []
    for (const lib of rows) {
      const idRaw = lib.library_id
      if (idRaw == null) continue
      const id = Number(idRaw)
      if (!Number.isFinite(id)) continue
      out.push({
        id: String(id),
        label: (lib.name ?? '').trim() || `图鉴 #${id}`,
        thumbnail: lib.cover ?? null
      })
    }
    return out
  } catch {
    return []
  }
}

function suggestionProps() {
  return {
    char: '@' as const,
    allowSpaces: true,
    /** `null`：不限制前缀，任意字符后可触发 @（默认仅空格/行首） */
    allowedPrefixes: null,
    items: async ({ query }: { query: string }) =>
      await buildLibraryMentionItems(typeof query === 'string' ? query : ''),
    render: createMentionListPopupRenderer(),
    command: ({
      editor,
      range,
      props: incoming
    }: {
      editor: MentionCommandEditor
      range: { from: number; to: number }
      props: Record<string, unknown>
    }) => {
        const rawId = incoming.id != null ? String(incoming.id) : ''
        const idRaw = rawId.trim()
        if (!idRaw) return

        const labelRaw = String(incoming.label ?? '').trim()
        const safeLabel = labelRaw || `图鉴 #${idRaw}`

        const insertRange = { ...range }
        const nodeAfter = editor.state.selection.$to.nodeAfter
        if (nodeAfter?.isText && nodeAfter?.text?.startsWith(' ')) {
          insertRange.to += 1
        }

        editor
          .chain()
          .focus()
          .insertContentAt(insertRange, [
            {
              type: 'mention',
              attrs: {
                id: idRaw,
                label: safeLabel,
                mentionSuggestionChar: '@'
              }
            },
            { type: 'text', text: ' ' }
          ])
          .run()
      },
  }
}

const AiChatEnterSubmit = Extension.create({
  name: 'aiChatEnterSubmit',
  /** 建议在激活时会由 `@tiptap/suggestion` 先消费按键；仅在未弹出 @ 时使用 Enter 发送 */
  priority: 10_000,
  addKeyboardShortcuts(this) {
    const parentEmitSubmit = (): void => {
      emit('submit')
    }
    return {
      Enter: (): boolean => {
        const ed = this.editor
        if (ed.view?.composing) return false
        parentEmitSubmit()
        return true
      },
      'Shift-Enter': (): boolean =>
        this.editor.chain().focus().setHardBreak().run()
    }
  }
})

const editor = useEditor({
  editable: !props.disabled,
  content: '',
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      horizontalRule: false,
      blockquote: false,
      codeBlock: false,
      link: false
    }),
    Placeholder.configure({
      placeholder: props.placeholder
    }),
    Mention.configure({
      HTMLAttributes: {
        class:
          'ai-chat-library-tag rounded-md px-1 py-px font-semibold text-qhx-primary bg-qhx-primary/12 outline-none ring-0'
      },
      suggestion: suggestionProps() as never
    }),
    AiChatEnterSubmit
  ],
  editorProps: {
    attributes: {
      autocomplete: 'off',
      autocapitalize: 'sentences',
      spellcheck: 'false',
      class:
        'qhx-ai-chat-prose prose prose-sm dark:prose-invert max-w-none min-h-[4.5rem] w-full px-3.5 py-2.5 text-[15px] leading-relaxed text-qhx-text caret-qhx-primary outline-none'
    }
  },
  onUpdate({ editor: ed }) {
    emitOutboundPlain(ed)
  },
  onBlur: ({ event }) => {
    emit('blur', event as FocusEvent)
  },
  onFocus: ({ event }) => {
    emit('focus', event as FocusEvent)
  }
})

watch(
  () => props.disabled,
  (d) => {
    editor.value?.setEditable(!d)
  }
)

onMounted(() => {
  emitOutboundPlain(editor.value ?? null)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function replaceAndFocus(text: string) {
  const ed = editor.value
  if (!ed) return
  const safeLine = escapeHtmlFlat(text ?? '').replace(/\r?\n/g, '<br>')
  ed.chain().focus().setContent(`<p>${safeLine}</p>`).run()
  emitOutboundPlain(ed)
}

function insertTextSnippet(text: string) {
  if (!text || !editor.value) return
  editor.value.chain().focus().insertContent(text).run()
}

function clear() {
  const ed = editor.value
  if (!ed) return
  ed.commands.clearContent(true)
  emitOutboundPlain(ed)
}

function getOutboundPlain(): string {
  return editor.value ? composeAiChatOutboundPlain(editor.value) : ''
}

function focusComposer() {
  editor.value?.chain().focus().run()
}

defineExpose({
  replaceAndFocus,
  insertText: insertTextSnippet,
  clear,
  getOutboundPlain,
  focus: focusComposer,
  editor
})
</script>

<template>
  <div
    class="qhx-ai-chat-rich-wrap neo-chat-textarea group relative min-h-0 min-w-0 flex-1 rounded-2xl bg-qhx-bg shadow-[inset_5px_5px_12px_var(--neo-inset-d),inset_-5px_-5px_12px_var(--neo-inset-l)] transition-shadow duration-200 focus-within:shadow-[inset_6px_6px_14px_var(--neo-inset-d),inset_-4px_-4px_12px_var(--neo-inset-l)] focus-within:ring-1 focus-within:ring-qhx-primary/45 dark:focus-within:ring-qhx-primary/40"
  >
    <editor-content
      v-if="editor"
      :editor="editor"
      class="qhx-ai-chat-editor-shell max-h-[min(42dvh,11rem)] min-h-[4.5rem] w-full overflow-y-auto overscroll-contain"
    />
  </div>
</template>

<style scoped>
.qhx-ai-chat-editor-shell :deep(.tiptap),
.qhx-ai-chat-editor-shell :deep(.ProseMirror) {
  outline: none;
  min-height: 4.5rem;
}

.qhx-ai-chat-editor-shell
  :deep(.tiptap p.is-editor-empty:first-child::before),
.qhx-ai-chat-editor-shell
  :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: color-mix(in srgb, var(--primary-color), transparent 50%);
  pointer-events: none;
  height: 0;
}
.qhx-ai-chat-editor-shell :deep(span[data-type='mention']),
.qhx-ai-chat-editor-shell :deep(.mention),
.qhx-ai-chat-editor-shell :deep(.ai-chat-library-tag) {
  white-space: nowrap;
}
</style>
