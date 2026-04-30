<script setup lang="ts">
import { watch, ref } from 'vue'
import type { Comment, PaginationResponse } from '@/types/api';
import { deleteComment, getReplyList } from '@/api/comment'
import { useCommentUiStore } from '@/stores/commentUi'
import type { CommentSubReplyMeta } from '@/composables/communityCommentSection'
import QhxModal from '@/components/Qhx/Modal.vue'

interface Props {
  comment_id: number
  className?: string
  /** 递增时重新拉取子评论（不整表刷新） */
  refreshNonce?: number
}
const props = withDefaults(defineProps<Props>(), {
  refreshNonce: 0,
})

const { comment_id } = props
const user = useUserStore()
const commentUiStore = useCommentUiStore()
const pageSize = 10
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(1)
const isLoading = ref(true)
const isServer = useState('isServer', () => false)
// 使用`use$Post`请求函数
const fetchList = async (): Promise<PaginationResponse<Comment>> => {
  if (import.meta.server) {
    console.log('在服务端运行并且没有token', user.token)
    if (!user.token) {
      isServer.value = true
    }
  }
  try {
    const response = await getReplyList({
      page: page.value,
      pageSize: pageSize,
      comment_id
    })
    isLoading.value = false
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取失败:', error)
    }
    return {
      rows: [],
      count: 0
    }
  }
}

const { data, refresh } = await useAsyncData(`replyList${comment_id}`, fetchList,
  {
    watch: [page]
  }
)
const list = ref<Comment[]>([])
list.value = data.value?.rows.map((item) => { return {...item, isCheck: false} }) ?? []
watch(data, () => {
  if (page.value === 1) {
    list.value = data.value?.rows ?? []
  } else {
    list.value = [...list.value, ...(data.value?.rows ?? [])]
  }
})
const total = computed(() => data.value?.count ?? 0)
const refreshList = async () => {
  isLoading.value = true
  try {
    const response = await getReplyList({
      page: page.value,
      pageSize: pageSize,
      comment_id
    })
    isLoading.value = false
    list.value = response.rows
  } catch (error) { }
  isLoading.value = false
}
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
}

const loadMore = () => {
  
  if (isLoading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize)) {
    isLoading.value = true
    handlePageChange(page.value + 1)
    console.log('加载更多')
  }
}

const emit = defineEmits<{
  load: []
  /** 删除子回复成功后通知父级刷新主评论列表（更新回复数等） */
  replyDeleted: []
  /**
   * 子评论上点「回复」：item 为被回复条；meta 含 reply_to=user_id 与完整 user 供上级 / 弹窗使用
   */
  reply: [item: Comment, event?: MouseEvent, meta?: CommentSubReplyMeta]
}>()

const onReplyInSubList = (sub: Comment, e?: MouseEvent) => {
  const uid = sub.user?.user_id
  if (sub.user != null && uid != null) {
    emit('reply', sub, e, { reply_to: uid, replyToUser: sub.user })
  } else {
    emit('reply', sub, e)
  }
}

const showDeleteReplyModal = ref(false)
const deleteReplyModalTrigger = ref<{ x: number; y: number } | undefined>(undefined)
const pendingDeleteReply = ref<Comment | null>(null)
const deleteReplyLoading = ref(false)

const onDeleteReply = (sub: Comment, e?: MouseEvent) => {
  if (!user.token) {
    useToast().add({
      title: '请登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  pendingDeleteReply.value = sub
  deleteReplyModalTrigger.value =
    e && import.meta.client ? { x: e.clientX, y: e.clientY } : undefined
  showDeleteReplyModal.value = true
}

const closeDeleteReplyModal = () => {
  showDeleteReplyModal.value = false
  pendingDeleteReply.value = null
}

const confirmDeleteReply = async () => {
  const sub = pendingDeleteReply.value
  if (!sub || deleteReplyLoading.value) return
  deleteReplyLoading.value = true
  try {
    const ok = await deleteComment({ comment_id: Number(sub.comment_id) })
    if (ok) {
      useToast().add({
        title: '已删除',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
      closeDeleteReplyModal()
      page.value = 1
      await refresh()
      emit('replyDeleted')
    }
  } catch {
    useToast().add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  } finally {
    deleteReplyLoading.value = false
  }
}

const load = () => {
  emit('load')
}
const showReply = () => {

}

const lastRefreshNonce = ref(0)
watch(
  () => props.refreshNonce ?? 0,
  (n) => {
    if (n > lastRefreshNonce.value) {
      lastRefreshNonce.value = n
      page.value = 1
      refresh()
    }
  },
  { immediate: true }
)
</script>
<template>
  <div :class="props.className ? props.className : 'w-full'">
    <div v-if="total > 0">
      <div v-for="item in list" :key="item.comment_id">
        <CommentItem
          :item="item"
          :is-new-highlight="
            commentUiStore.newCommentHighlightId != null &&
            Number(commentUiStore.newCommentHighlightId) === Number(item.comment_id)
          "
          @reply="onReplyInSubList"
          @delete="onDeleteReply"
        />
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>
    <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>

    <QhxModal
      v-model="showDeleteReplyModal"
      :trigger-position="deleteReplyModalTrigger"
      @close="closeDeleteReplyModal"
    >
      <div class="p-6 w-[400px] max-md:w-[90vw] bg-white dark:bg-gray-800 rounded-xl">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">操作确认</h3>
        <p class="text-gray-600 dark:text-gray-300 mb-6">确定删除这条回复吗？此操作不可恢复。</p>
        <div class="flex gap-3 justify-end">
          <UButton color="gray" variant="ghost" class="px-4" @click="closeDeleteReplyModal">
            取消
          </UButton>
          <UButton
            color="red"
            class="px-4"
            :loading="deleteReplyLoading"
            @click="confirmDeleteReply"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<style scoped></style>