<!-- 安全的富文本解析器：属性白名单 + 协议过滤，见 utils/safeRichTextSanitize -->
<script setup lang="ts">
import { openLibraryWebPath } from '@/composables/useLibraryDetailNavigation'
import { BASE_IMG } from '~/utils/ipConfig'
import {
  getSafeAttrs,
  hasSafeIframeSrc,
  isAllowedAnchorHref,
  toAbsoluteUrl,
  type SafeAttrMap,
} from '@/utils/safeRichTextSanitize'

defineProps<{
  nodes: RichNode[]
}>()

interface RichNode {
  name: string
  text: string
  children: RichNode[]
  attrs: Record<string, string>
}

function parseVoteIdFromNode(node: RichNode): number | null {
  const raw = node.attrs?.href
  if (raw == null || String(raw).trim() === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 社区正文内 @用户：`data-id` 为数字 user_id 时跳转个人主页 */
function userSpacePathForMentionSpan(node: RichNode): string | null {
  if (node.name !== 'span') return null
  if (node.attrs?.['data-type'] !== 'mention') return null
  const uid = String(node.attrs?.['data-id'] ?? '').trim()
  if (!/^\d+$/.test(uid)) return null
  return `/userSpace/${uid}`
}

function mentionSpanDisplay(node: RichNode): string {
  const lb = String(node.attrs?.['data-label'] ?? '').trim()
  if (lb) return `@${lb}`
  const t = node.text?.trim()
  if (t) return t.startsWith('@') ? t : `@${t}`
  return '@用户'
}

function isTopicSpan(node: RichNode): boolean {
  if (node.name !== 'span') return false
  if (node.attrs?.['data-type'] === 'topic') return true
  const cls = String(node.attrs?.class ?? '')
  return cls.split(/\s+/).includes('topic-mention')
}

/** 话题展示统一带 #（兼容历史正文无前缀） */
function topicSpanDisplay(node: RichNode): string {
  const fromAttr = String(node.attrs?.['data-label'] ?? node.attrs?.['data-id'] ?? '')
    .trim()
    .replace(/^#+/, '')
  if (fromAttr) return `#${fromAttr}`
  const t = node.text?.trim() ?? ''
  if (!t) return '#'
  return t.startsWith('#') ? t : `#${t}`
}

/** 富文中站内图床域名统一走 CDN（与 CommentItem、Community 等处一致） */
function rewriteAliImageSrc(src: string): string {
  const prefixes = [
    'https://www.lolitalibrary.com/ali/',
    'https://lolitalibrary.com/ali/',
  ] as const
  for (const prefix of prefixes) {
    if (src.startsWith(prefix)) {
      return BASE_IMG + src.slice(prefix.length)
    }
  }
  return src
}

function safeAttrsFor(tag: string, attrs: Record<string, string>): SafeAttrMap {
  return getSafeAttrs(tag, attrs, { rewriteImgSrc: rewriteAliImageSrc })
}

function getAnchorHref(node: RichNode): string | null {
  const safe = safeAttrsFor('a', node.attrs)
  const h = safe.href
  return typeof h === 'string' && h.length > 0 ? h : null
}

function onSafeLinkClick(ev: MouseEvent, href: string | null) {
  if (import.meta.server) return
  if (ev.defaultPrevented) return
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
  if (ev.button !== 0) return

  if (!href || !isAllowedAnchorHref(href)) {
    ev.preventDefault()
    return
  }

  ev.preventDefault()
  openLibraryWebPath(toAbsoluteUrl(href))
}

function onRichLinkClick(ev: MouseEvent, node: RichNode) {
  onSafeLinkClick(ev, getAnchorHref(node))
}

// 合法标签
const ALLOWED_TAGS = new Set([
  'div', 'p', 'span', 'strong', 'em', 'a', 'ul', 'ol', 'li',
  'br', 'img', 'b', 'i', 'video', 'audio', 'source', 'h3', 'iframe',
])

// 自定义标签映射
const CUSTOM_TAGS: Record<string, string> = {
  library: 'div',
  shop: 'div',
  emoji: 'span',
}

function isSafeTag(tag: string) {
  return ALLOWED_TAGS.has(tag) || tag in CUSTOM_TAGS
}
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <!-- 文本节点 -->
    <template v-if="node.name === 'text'">
      {{ node.text }}
    </template>
    <template v-else-if="node.name === 'library'">
      图鉴标签
    </template>
    <template v-else-if="node.name === 'emoji'">
      <QhxEmoji :id="Number.parseInt(node.attrs.href)"></QhxEmoji>
    </template>

    <a
      v-else-if="node.name === 'a'"
      v-bind="safeAttrsFor('a', node.attrs)"
      class="text-qhx-primary underline rich-inline-link"
      @click="onRichLinkClick($event, node)"
    >
      <SafeRichText v-if="node.children?.length" :nodes="node.children" />
      <template v-else>{{ node.text }}</template>
    </a>

    <a
      v-else-if="userSpacePathForMentionSpan(node)"
      :href="userSpacePathForMentionSpan(node)!"
      target="_blank"
      rel="noopener noreferrer"
      class="inline font-medium rounded px-1 text-sky-600 underline-offset-2 hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300 bg-sky-500/[0.09]"
      @click="onSafeLinkClick($event, userSpacePathForMentionSpan(node))"
    >
      {{ mentionSpanDisplay(node) }}
    </a>

    <span
      v-else-if="isTopicSpan(node)"
      class="topic-mention inline font-bold rounded px-1 text-[#ff9eb5] bg-pink-500/10"
    >
      {{ topicSpanDisplay(node) }}
    </span>

    <div
      v-else-if="node.name === 'vote'"
      class="my-2 w-full max-w-full"
    >
      <VoteBlock
        v-if="parseVoteIdFromNode(node) != null"
        :vote-id="parseVoteIdFromNode(node)!"
        wrap-class="w-full"
      />
    </div>

    <!-- iframe：无合法 src（含仅 srcdoc）时不渲染 -->
    <iframe
      v-else-if="node.name === 'iframe' && hasSafeIframeSrc(node.attrs)"
      v-bind="safeAttrsFor('iframe', node.attrs)"
    />

    <!-- 允许标签或自定义标签 -->
    <component
      v-else-if="isSafeTag(node.name) && node.name !== 'iframe'"
      :is="CUSTOM_TAGS[node.name] || node.name"
      v-bind="safeAttrsFor(node.name, node.attrs)"
    >
      <SafeRichText v-if="node.children?.length" :nodes="node.children" />
      <template v-else>{{ node.text }}</template>
    </component>
  </template>
</template>
<style scoped>
/* 与 RichTextEditor 一致：链接按块排布，相邻下划线不粘连（含历史内容仅带 text-qhx-primary） */
:deep(a.text-qhx-primary) {
  display: inline-block;
  padding: 0 0.2em;
  margin: 0 0.12em;
  text-underline-offset: 0.15em;
  text-decoration-thickness: 1px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* 正文内嵌图片与文字留出间距，避免贴边 */
:deep(img) {
  margin: 0.35em 0.45em;
  vertical-align: middle;
}

.quill-lib-wrap{
  display: flex;
  padding: 5px;
  img{
    width: 70px;
    height: 70px;
    border-radius: 50%;
    margin-right: 10px;
  }

}
.lib-title{
  font-weight: bolder;
}
.quill-lib{
  font-size: 12px;
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 70px;
  box-shadow: 2px 2px 10px #ccc;
}
.info-item{
  display: flex;
}
</style>
