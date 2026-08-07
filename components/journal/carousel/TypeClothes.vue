<!-- pk_type=2 服饰 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'

defineProps<{
  journal: Journal
}>()
</script>

<template>
  <div v-if="journal.wardrobe_clothes" class="space-y-1">
    <div class="text-base font-semibold text-[#3d2833] dark:text-[var(--ink-primary)]">
      {{ journal.wardrobe_clothes.clothes_note || '暂无笔记' }}
    </div>
    <div
      v-if="journal.wardrobe_clothes.wardrobe_status"
      class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]"
    >
      状态：{{ journal.wardrobe_clothes.wardrobe_status }}
    </div>
    <div
      v-if="journal.wardrobe_clothes.clothes_part"
      class="text-xs text-[#8a6f7d] dark:text-[var(--ink-muted)]"
    >
      部位：{{ journal.wardrobe_clothes.clothes_part }}
    </div>
  </div>
  <TypeInvalid v-else />
</template>
