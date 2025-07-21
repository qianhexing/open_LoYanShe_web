<script setup lang="ts">
defineProps<{
  nodes: RichNode[]
}>()

interface RichNode {
  name: string
  text: string
  children: RichNode[]
  attrs: Record<string, string>
}

// 合法标签
const ALLOWED_TAGS = new Set([
  'div', 'p', 'span', 'strong', 'em', 'a', 'ul', 'ol', 'li',
  'br', 'img', 'b', 'i', 'video', 'audio', 'source', 'h3'
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
      /^(color|font-size|text-align|margin|padding|background-color)/i.test(rule) &&
      !/url\(|expression\(/i.test(rule)
    )
    .join(';')
}

// 安全属性过滤
function getSafeAttrs(tag: string, attrs: Record<string, string>): Record<string, any> {
  const safe: Record<string, string> = {}
  for (const key in attrs) {
    const val = attrs[key]
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
    if (key === 'src') {
      const allowedExt = /\.(jpg|jpeg|png|gif|svg|webp|mp4|mp3|webm)$/i
      if (!/^https?:\/\//.test(val) || !allowedExt.test(val)) continue
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