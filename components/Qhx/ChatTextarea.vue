<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    disabled?: boolean
    /** 初始最少行数（用于最小高度） */
    rows?: number
    /**
     * 当浏览器未能解析 maxHeightClass 时的行数上限兜底（一般不需改）
     */
    maxRows?: number
    /**
     * 最大高度（Tailwind 任意值类名），超出后在输入框内滚动；随 dvh 自适应
     * @example 'max-h-[min(40dvh,10.5rem)]'
     */
    maxHeightClass?: string
  }>(),
  {
    placeholder: '',
    disabled: false,
    rows: 2,
    maxRows: 12,
    maxHeightClass: 'max-h-[min(42dvh,11rem)]'
  }
)

const emit = defineEmits<{
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
  keydown: [e: KeyboardEvent]
}>()

const taRef = ref<HTMLTextAreaElement | null>(null)

function syncHeight() {
  const el = taRef.value
  if (!el || typeof window === 'undefined') return

  el.style.height = 'auto'
  const contentH = el.scrollHeight

  const cs = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(cs.lineHeight)
  const lh = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 22
  const paddingY =
    Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom) || 24
  const minH = props.rows * lh + paddingY

  const maxHResolved = cs.maxHeight
  let maxPx = Number.POSITIVE_INFINITY
  if (maxHResolved && maxHResolved !== 'none') {
    const parsed = Number.parseFloat(maxHResolved)
    if (Number.isFinite(parsed) && parsed > 0) maxPx = parsed
  }
  if (maxPx === Number.POSITIVE_INFINITY) {
    maxPx = props.maxRows * lh + paddingY
  }

  const next = Math.min(maxPx, Math.max(minH, contentH))
  el.style.height = `${next}px`
  el.style.overflowY = contentH > maxPx + 0.5 ? 'auto' : 'hidden'
}

function onInput() {
  nextTick(syncHeight)
}

watch(model, () => nextTick(syncHeight))

function onWindowResize() {
  nextTick(syncHeight)
}

onMounted(() => {
  nextTick(syncHeight)
  window.addEventListener('resize', onWindowResize)
  window.visualViewport?.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.visualViewport?.removeEventListener('resize', onWindowResize)
})

/** 在光标处插入文案（无光标则在末尾）；插入后拉高、聚焦并将光标移到插入片段之后 */
function insertText(text: string) {
  if (!text) return
  const el = taRef.value
  if (!el) {
    model.value = `${model.value ?? ''}${text}`
    return
  }
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const v = model.value ?? ''
  model.value = v.slice(0, start) + text + v.slice(end)
  nextTick(() => {
    syncHeight()
    const ta = taRef.value
    if (!ta || props.disabled) return
    const pos = start + text.length
    ta.focus()
    ta.setSelectionRange(pos, pos)
  })
}

/** 清空并替换为整段文案，再拉高、聚焦，光标在末尾 */
function replaceAndFocus(text: string) {
  model.value = text
  nextTick(() => {
    syncHeight()
    const ta = taRef.value
    if (!ta || props.disabled) return
    const len = text.length
    ta.focus()
    ta.setSelectionRange(len, len)
  })
}

defineExpose({
  focus: () => taRef.value?.focus(),
  blur: () => taRef.value?.blur(),
  insertText,
  replaceAndFocus,
  textareaRef: taRef
})
</script>

<template>
  <div
    class="qhx-chat-textarea-wrap neo-chat-textarea group relative min-h-0 min-w-0 flex-1 rounded-2xl bg-qhx-bg shadow-[inset_5px_5px_12px_var(--neo-inset-d),inset_-5px_-5px_12px_var(--neo-inset-l)] transition-shadow duration-200 focus-within:shadow-[inset_6px_6px_14px_var(--neo-inset-d),inset_-4px_-4px_12px_var(--neo-inset-l)] focus-within:ring-1 focus-within:ring-qhx-primary/45 dark:focus-within:ring-qhx-primary/40"
  >
    <textarea
      ref="taRef"
      v-model="model"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      :class="[
        'qhx-chat-textarea-field box-border min-h-[2.75rem] w-full resize-none bg-transparent px-3.5 py-2.5 text-[15px] leading-relaxed text-qhx-text caret-qhx-primary outline-none placeholder:text-qhx-primary/50 disabled:cursor-not-allowed disabled:opacity-55 dark:placeholder:text-qhx-primary/45',
        maxHeightClass
      ]"
      autocomplete="off"
      autocapitalize="sentences"
      spellcheck="false"
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @keydown="emit('keydown', $event)"
    />
  </div>
</template>
