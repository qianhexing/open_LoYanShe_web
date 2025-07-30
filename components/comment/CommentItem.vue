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
const image = ref<Array<string>>([])
const text = ref('')
if (item?.comment_content) {
  const rich_res = formatRich(item.comment_content)
  if (rich_res.image.length > 0) {
    image.value = rich_res.image.map((src) => { return src.replace('https://www.lolitalibrary.com/ali/', '')})
  }
  text.value = rich_res.text
}
if (item?.mount_img) {
  image.value = [...image.value, ...item.mount_img.split(',')]
}

const showReply = () => {
  emit('showReply', item)
}
const reply = () => {
  emit('reply', item)
} 
onMounted(() => {
  if (item.comment_content) {
    richText.value = parseRichText(text.value)
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
        <div class="flex flex-wrap w-full md:max-w-md">
          <QhxPreviewImage :list="image.map((img) => { return { src: img + '?x-oss-process=image/quality,q_100/resize,w_200,h_200', alt: item.title || 'Lo研社' }})"
            :preview="image.map((img) => { return img })"
            :className="'w-[calc(100%/3-8px)] shadow-lg m-1 object-cover aspect-[1/1] rounded-[10px]'">
          </QhxPreviewImage>
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