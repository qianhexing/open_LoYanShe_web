<!-- 未知类型或无关联实体时的纯笔记兜底 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'

defineProps<{
  journal: Journal
}>()
</script>

<template>
  <p class="text-sm leading-relaxed text-[#4a2f3d] dark:text-[var(--ink-secondary)]">
    {{ journal.note || '无笔记' }}
  </p>
</template>
