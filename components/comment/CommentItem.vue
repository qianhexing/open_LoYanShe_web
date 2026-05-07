<script setup lang="ts">
import type { Comment } from '@/types/api'
import dayjs from 'dayjs'

function formatCommentDateForDisplay(raw: Comment['date'] | undefined): string {
  if (raw == null) return '未知'
  const d = dayjs(raw as string | Date)
  if (!d.isValid()) return '未知'
  const now = dayjs()
  const diffMs = now.diff(d)
  if (diffMs < 0) return d.format('YY-MM-DD HH:mm')
  const oneDayMs = 24 * 60 * 60 * 1000
  if (diffMs < oneDayMs) {
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    return `${hours}小时前`
  }
  return d.format('YY-MM-DD HH:mm')
}

interface Props {
  className?: string,
  item: Comment
  need_bottom?: boolean
  ui?: string
  /** 刚发布成功：条目高亮几秒方便定位 */
  isNewHighlight?: boolean
}
const emit = defineEmits<{
  load: []
  showReply: [item: Comment]
  reply: [item: Comment, event?: MouseEvent]
  delete: [item: Comment, event?: MouseEvent]
}>()
const props = withDefaults(defineProps<Props>(), {
  need_bottom: true,
  ui: 'p-3',
  isNewHighlight: false
})

const commentTimeDisplay = computed(() => formatCommentDateForDisplay(props.item.date))
const commentIpDisplay = computed(() => {
  const s = props.item.ip_location?.trim()
  return s || '未知'
})

const richText = ref<RichNode[] | null>(null)
const { item, need_bottom, ui } = props
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
const reply = (e: MouseEvent) => {
  emit('reply', item, e)
}

const isOwnComment = computed(() => {
  const uid = user.user?.user_id
  const authorId = props.item.user?.user_id
  return !!user.token && uid != null && authorId != null && Number(uid) === Number(authorId)
})

const onDelete = (e: MouseEvent) => {
  e.stopPropagation()
  emit('delete', props.item, e)
}
onMounted(() => {
  if (item.comment_content) {
    richText.value = parseRichText(text.value)
  }
})
</script>
<template>
  <div
    :class="[
      props.className ? props.className : 'w-full',
      isNewHighlight
        ? 'comment-item-new rounded-xl ring-2 ring-qhx-primary/55 bg-qhx-primary/[0.08] shadow-sm dark:bg-qhx-primary/12 dark:ring-qhx-primary/45'
        : '',
    ]"
  >
    <div>
      <div :class="ui">
        <UserInfo :user="item.user" need-jump v-if="item.user"></UserInfo>
        <div class="p-3 leading-[1.8]" v-if="richText">
          <SafeRichText :nodes="richText"></SafeRichText>
        </div>
        <div class="flex flex-wrap w-full md:max-w-md">
          <QhxPreviewImage :list="image.map((img) => { return { src: img + '?x-oss-process=image/quality,q_100/resize,w_200,h_200', alt: 'Lo研社' }})"
            :preview="image.map((img) => { return img })"
            :className="'w-[calc(100%/3-8px)] shadow-lg m-1 object-cover aspect-[1/1] rounded-[10px]'">
          </QhxPreviewImage>
        </div>
        <div class="mb-2 flex w-full justify-end" v-show="!item.isCheck && need_bottom">
          <div
            v-if="item.r_count && item.r_count > 0"
            class="text-qhx-primary cursor-pointer inline-block text-xs leading-snug"
            @click="showReply()"
          >
            共 {{ item.r_count }} 条回复
          </div>
        </div>
        <div
          class="flex w-full items-center justify-between gap-2 text-xs leading-snug"
          v-show="need_bottom"
        >
          <div class="min-w-0 text-gray-500 dark:text-gray-400">
            <span>{{ commentTimeDisplay }}</span>
            <span class="mx-1.5 opacity-50" aria-hidden="true">·</span>
            <span>IP：{{ commentIpDisplay }}</span>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-3">
            <div
              v-if="isOwnComment"
              class="cursor-pointer text-red-500 hover:underline dark:text-red-400"
              @click="onDelete($event)"
            >
              删除
            </div>
            <div
              class="cursor-pointer text-qhx-primary hover:underline"
              @click.stop="reply($event)"
            >
              回复
            </div>
            <div class="text-gray-500 dark:text-gray-400">{{ item.floor }} 楼</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 高亮主依赖 Tailwind ring/bg；此处仅做一次轻微强调 */
.comment-item-new {
  animation: comment-new-nudge 1.6s ease-out 1;
}

@keyframes comment-new-nudge {
  0%,
  100% {
    transform: scale(1);
  }
  8% {
    transform: scale(1.008);
  }
}
</style>