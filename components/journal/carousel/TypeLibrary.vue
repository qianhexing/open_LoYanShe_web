<!-- pk_type=4 图鉴 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import LibraryItem from '@/components/library/LibraryItem.vue'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'

defineProps<{
  journal: Journal
}>()
</script>

<template>
  <LibraryItem
    v-if="journal.library"
    :need-jump="false"
    :size="'mini-list'"
    :item="journal.library"
  />
  <TypeInvalid v-else />
</template>
