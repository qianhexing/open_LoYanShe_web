<!-- 安全的富文本解析器！安全！（应该安全吧） -->
<script setup lang="ts">
import { BASE_IMG } from '~/utils/ipConfig'

defineProps<{
  nodes: RichNode[]
}>()

interface RichNode {
  name: string
  text: string
  children: RichNode[]
  attrs: Record<string, string>
}

const configStore = useConfigStore()

function parseVoteIdFromNode(node: RichNode): number | null {
  const raw = node.attrs?.href
  if (raw == null || String(raw).trim() === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 富文中站内图床域名统一走 CDN（与 CommentItem、Community 等处一致） */
function rewriteAliImageSrc(src: string): string {
  const prefixes = [
    'https://www.lolitalibrary.com/ali/',
    'https://lolitalibrary.com/ali/'
  ] as const
  for (const prefix of prefixes) {
    if (src.startsWith(prefix)) {
      return BASE_IMG + src.slice(prefix.length)
    }
  }
  return src
}

/** 是否允许跳转（域名/路径白名单等），当前空实现 */
function isSafeLinkHref(_href: string): boolean {
  void _href
  return true
}

function getAnchorHref(node: RichNode): string | null {
  const safe = getSafeAttrs('a', node.attrs)
  const h = safe.href
  return typeof h === 'string' && h.length > 0 ? h : null
}

function toAbsoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) {
    if (typeof window !== 'undefined') return `${window.location.protocol}${href}`
    return `https:${href}`
  }
  if (href.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${href}`
    return `https://lolitalibrary.com${href}`
  }
  return href
}

/** 仅允许同站/主站子域的 iframe 嵌入，避免 open redirect；含站内以 / 开头的 path-only URL */
function isAllowedIframeSrc(val: string): boolean {
  const v = String(val).trim()
  if (v === '') return false
  if (/^\/(?!\/)/.test(v)) return true
  if (/^javascript:/i.test(v) || /^data:/i.test(v)) return false
  try {
    const abs = toAbsoluteUrl(v)
    const u = new URL(abs)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return host === 'lolitalibrary.com' || host.endsWith('.lolitalibrary.com')
  } catch {
    return false
  }
}

async function onRichLinkClick(ev: MouseEvent, node: RichNode) {
  if (import.meta.server) return
  if (ev.defaultPrevented) return
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
  if (ev.button !== 0) return

  const href = getAnchorHref(node)
  if (!href) {
    ev.preventDefault()
    return
  }
  if (!isSafeLinkHref(href)) {
    ev.preventDefault()
    return
  }

  ev.preventDefault()

  const uni = configStore.uniWebviewJs
  const navigateToOuter = uni?.navigateTo
  const abs = toAbsoluteUrl(href)
  console.log(abs, 'abs')
  const toast = useToast()
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');

  if (isInUniApp && typeof uni !== 'undefined' && uni?.navigateTo) {
    // UniApp WebView 环境 - 使用 outerlink
    uni.navigateTo({
      url: `/pages/common/outerLink?url=${abs}`,
      fail: () => {
        console.log('跳转错误')
        toast.add({
          title: '路径调试',
          description: abs,
          icon: 'i-heroicons-exclamation-circle',
          color: 'red'
        })
      }
    });
    return
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    await navigateTo(href)
    return
  }
  if (/^https?:\/\//i.test(href)) {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.href = href
}

// 合法标签
const ALLOWED_TAGS = new Set([
  'div', 'p', 'span', 'strong', 'em', 'a', 'ul', 'ol', 'li',
  'br', 'img', 'b', 'i', 'video', 'audio', 'source', 'h3', 'iframe'
])

// 自定义标签映射
const CUSTOM_TAGS: Record<string, string> = {
  library: 'div',
  shop: 'div',
  emoji: 'span'
}

// 所有标签 = 合法标签 + 自定义
function isSafeTag(tag: string) {
  return ALLOWED_TAGS.has(tag) || tag in CUSTOM_TAGS
}

// 安全样式过滤（白名单）
function sanitizeStyle(style: string = ''): string {
  return style
    .split(';')
    .map(s => s.trim())
    .filter(rule =>
      /^(color|font-size|text-align|margin|padding|background-color|width|height)/i.test(rule) &&
      !/url\(|expression\(/i.test(rule)
    )
    .join(';')
}

// 安全属性过滤
function getSafeAttrs(tag: string, attrs: Record<string, string>): Record<string, any> {
  const safe: Record<string, string> = {}
  for (const key in attrs) {
    let val = attrs[key]
    if (tag === 'img' && key === 'src' && typeof val === 'string') {
      val = rewriteAliImageSrc(val)
    }
    if (key.startsWith('on') || val?.toLowerCase?.().includes('javascript:')) continue

    // 处理 style
    if (key === 'style') {
      const clean = sanitizeStyle(val)
      if (clean) safe.style = clean
      continue
    }

    // if (key === 'href' && !/^https?:\/\//.test(val)) continue
    if (tag === 'a' && key === 'href') {
      if (val.startsWith('/')) {
        safe.href = val
        continue
      }
      if (/^https?:\/\//.test(val)) {
        safe.href = val
        safe.target = '_blank'
        safe.rel = 'noopener noreferrer'
        continue
      }
      continue
    }
    if (key === 'src' && tag !== 'iframe') {
      const allowedExt = /\.(jpg|jpeg|png|gif|svg|webp|mp4|mp3|webm)$/i
      if (!/^https?:\/\//.test(val) || !allowedExt.test(val)) continue
    }
    if (key === 'src' && tag === 'iframe') {
      if (!isAllowedIframeSrc(val)) continue
    }
    safe[key] = val
  }

  // video/audio 额外安全属性
  if (tag === 'a') {
    safe.target = '_blank'
    safe.rel = 'noopener noreferrer'
  }
  if (tag === 'img') {
    safe.loading = 'lazy'
    safe.alt = safe.alt || 'image'
  }
  if (tag === 'video' || tag === 'audio') {
    safe.controls = true
    delete safe.autoplay
    delete safe.muted
  }

  return safe
}
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <!-- 文本节点 -->
    <template v-if="node.name === 'text'" >
      {{ node.text }}
    </template>
    <template v-if="node.name === 'library'">
      图鉴标签
    </template>
    <template v-if="node.name === 'emoji'">
      <QhxEmoji :id="Number.parseInt(node.attrs.href)"></QhxEmoji>
    </template>

    <a
      v-else-if="node.name === 'a'"
      v-bind="getSafeAttrs('a', node.attrs)"
      class="text-qhx-primary underline rich-inline-link"
      @click="onRichLinkClick($event, node)"
    >
      <SafeRichText v-if="node.children?.length" :nodes="node.children" />
      <template v-else>{{ node.text }}</template>
    </a>

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

    <!-- 允许标签或自定义标签 -->
    <component
      v-else-if="isSafeTag(node.name)"
      :is="CUSTOM_TAGS[node.name] || node.name"
      v-bind="getSafeAttrs(node.name, node.attrs)"
    >
      <!-- 递归渲染子节点 -->
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