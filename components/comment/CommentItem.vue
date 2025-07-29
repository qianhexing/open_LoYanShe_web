<script setup lang="ts">
import type { Comment, PaginationResponse } from '@/types/api';
import { getCommentList } from '@/api/comment'

interface Props {
  className?: string,
  item: Comment
}
const emit = defineEmits(['load', 'showReply', 'reply'])
const props = withDefaults(defineProps<Props>(), {
})
const richText = ref<RichNode[] | null>(null)
const { item } = props
const user = useUserStore()


const showReply = () => {
  emit('showReply', item)
}
const reply = () => {
  emit('reply', item)
} 
onMounted(() => {
  if (item.comment_content) {
    richText.value = parseRichText(item.comment_content)
  }
})
</script>
<template>
  <div :class="props.className ? props.className :'w-full'">
    <div>
      <div class="p-3">
        <UserInfo :user="item.user"></UserInfo>
        <div class="p-3 leading-[1.8]" v-if="richText">
          <SafeRichText :nodes="richText"></SafeRichText>
        </div>
        <div class="mb-2" v-show="!item.isCheck">
          <div v-if="item.r_count && item.r_count > 0" class=" text-qhx-primary cursor-pointer inline-block" @click="showReply()">
            共 {{ item.r_count }} 条回复
          </div>
        </div>
        <div class="flex items-center text-sm">
          <!-- <div @click="reply()" class=" cursor-pointer">回复</div> -->
          <div class=" ml-2">{{ item.floor }} 楼</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>