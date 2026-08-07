<!-- pk_type=3 搭配 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'

defineProps<{
  journal: Journal
}>()
</script>

<template>
  <div v-if="journal.matching_list" class="space-y-1">
    <div class="text-base font-semibold text-[#3d2833] dark:text-[var(--ink-primary)]">
      {{ journal.matching_list.note || '未命名搭配' }}
    </div>
    <div
      v-if="journal.matching_list.main_style"
      class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]"
    >
      风格：{{ journal.matching_list.main_style }}
    </div>
  </div>
  <TypeInvalid v-else />
</template>
