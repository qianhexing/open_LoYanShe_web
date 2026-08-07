<!-- pk_type=0 随手记/评论 -->
<script setup lang="ts">
import type { Journal } from '@/types/api'
import CommentItem from '@/components/comment/CommentItem.vue'
import TypeInvalid from '@/components/journal/carousel/TypeInvalid.vue'

defineProps<{
  journal: Journal
}>()
</script>

<template>
  <CommentItem
    v-if="journal.comment"
    :item="journal.comment"
    :ui="'p-0'"
    :need_bottom="false"
  />
  <TypeInvalid v-else />
</template>
