<script setup lang="ts">
import type { Comment, PaginationResponse } from '@/types/api';
import { insertComment } from '@/api/comment'

interface Props {
  className?: string
}
const emit = defineEmits(['load', 'showReply', 'reply'])
const props = withDefaults(defineProps<Props>(), {
})
const id = ref<number | null>(null)
const type = ref<number | null>(null)
const richText = ref<RichNode[] | null>(null)

const user = useUserStore()

</script>
<template>
  <div :class="props.className ? props.className :'w-full'">v>
  </div>
</template>

<style scoped>
</style>