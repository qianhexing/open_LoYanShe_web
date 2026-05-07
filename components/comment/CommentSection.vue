<script setup lang="ts">
import { computed, reactive, inject, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { Comment } from '@/types/api'
import { deleteComment, getCommentList } from '@/api/comment'
import {
  communityCommentSectionRefreshKey,
  type CommentOpenReplyPayload,
} from '@/composables/communityCommentSection'
import { storeToRefs } from 'pinia'
import { useCommentUiStore } from '@/stores/commentUi'
import QhxModal from '@/components/Qhx/Modal.vue'

interface Props {
  type: string
  id: number
  className?: string
  /**
   * 为底部固定栏（写评论条等）预留空间，避免最后几条评论被挡住。
   * 无固定底栏的页面不必开启。
   */
  reserveBottomForFixedBar?: boolean
  /**
   * 详情页 URL `?comment_id=` 传入时：列表请求带 comment_id，目标评论置顶、展开回复、滚动到可视区。
   */
  focusCommentId?: number
}
const props = withDefaults(defineProps<Props>(), {
  reserveBottomForFixedBar: false,
})

const user = useUserStore()
const commentUiStore = useCommentUiStore()
const { newCommentHighlightId } = storeToRefs(commentUiStore)

/** URL 定位高亮：不依赖 store 追踪，避免 Pinia shallowRef 在部分场景下未驱动子组件更新 */
let pinnedUrlHighlightTimer: ReturnType<typeof setTimeout> | null = null
const pinnedUrlHighlightActive = ref(false)

function clearPinnedUrlHighlight() {
  if (pinnedUrlHighlightTimer) {
    clearTimeout(pinnedUrlHighlightTimer)
    pinnedUrlHighlightTimer = null
  }
  pinnedUrlHighlightActive.value = false
}

/** 接口可能用 comment_id 或 id 与 URL `comment_id` 对齐 */
function commentMatchesFocus(row: Comment, focusId: number | undefined): boolean {
  if (focusId == null || focusId <= 0) return false
  const fid = Number(focusId)
  const cid = Number(row.comment_id)
  const rid = Number(row.id)
  return (
    (Number.isFinite(cid) && cid === fid) ||
    (Number.isFinite(rid) && rid === fid)
  )
}

function commentMatchesHighlightId(
  row: Comment,
  hid: number | null | undefined
): boolean {
  if (hid == null) return false
  return commentMatchesFocus(row, Number(hid))
}

const pageSize = 20
const page = ref(1)
const isLoading = ref(false)
const list = ref<Comment[]>([])
const total = ref(0)
const pinnedComment = ref<Comment | null>(null)

const expandedReplyById = reactive<Record<number, boolean>>({})

/** 置顶评论锚点：`?comment_id=` 首屏定位后滚动到该区域 */
const pinnedCommentAnchorRef = ref<HTMLElement | null>(null)

const mapRows = (rows: Comment[] | undefined) =>
  (rows ?? []).map((item) => ({ ...item, isCheck: false }))

/** 主评唯一 id：优先 comment_id，与列表/回复接口一致 */
function mainCommentRowId(row: Comment): number | null {
  const cid = Number(row.comment_id)
  if (Number.isFinite(cid) && cid > 0) return cid
  const rid = Number(row.id)
  if (Number.isFinite(rid) && rid > 0) return rid
  return null
}

const pinnedMainCommentId = computed(() => {
  const p = pinnedComment.value
  return p ? mainCommentRowId(p) : null
})

/** 有置顶主评时默认展开其回复区 */
watch(pinnedComment, (p) => {
  if (!p) return
  const id = mainCommentRowId(p)
  if (id != null) expandedReplyById[id] = true
})

/** 浏览器刷新（F5）时不自动滚动，避免打断用户阅读位置 */
function isDocumentReloadNavigation(): boolean {
  if (!import.meta.client) return false
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

/** 首屏请求完成且带 `focusCommentId`、当前为第一页时，滚动到置顶评论块（刷新页除外） */
async function scrollToPinnedCommentIfFocused() {
  if (!props.focusCommentId || page.value !== 1) return
  if (isDocumentReloadNavigation()) return
  console.log('scrollToPinnedCommentIfFocused触发滚动=========', props.focusCommentId, page.value)
  const pinned = pinnedComment.value
  if (!pinned || !commentMatchesFocus(pinned, props.focusCommentId)) {
    return
  }
  clearPinnedUrlHighlight()
  pinnedUrlHighlightActive.value = true
  pinnedUrlHighlightTimer = setTimeout(clearPinnedUrlHighlight, 5000)
  commentUiStore.flashNewCommentHighlight(Number(props.focusCommentId))
  await nextTick()
  await nextTick()
  pinnedCommentAnchorRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

/** 仅客户端请求首屏，不参与 SSR */
const fetchInitial = async () => {
  if (!import.meta.client) return
  isLoading.value = true
  page.value = 1
  let fetchOk = false
  try {
    const response = await getCommentList({
      page: 1,
      pageSize,
      type: props.type,
      id: props.id,
      pinned: props.focusCommentId,
    })
    list.value = mapRows(response.rows)
    total.value = response.count ?? 0
    pinnedComment.value = response.pinned ?? null
    fetchOk = true
  } catch (error) {
    if (import.meta.client) {
      console.error('获取失败:', error)
    }
    list.value = []
    total.value = 0
    pinnedComment.value = null
  } finally {
    isLoading.value = false
  }
  if (fetchOk) {
    await scrollToPinnedCommentIfFocused()
  }
}

const refreshList = async () => {
  isLoading.value = true
  try {
    const response = await getCommentList({
      page: 1,
      pageSize: pageSize * page.value,
      type: props.type,
      id: props.id,
      pinned: props.focusCommentId,
    })
    list.value = mapRows(response.rows)
    total.value = response.count ?? 0
    if (response.pinned) {
      pinnedComment.value = response.pinned
    }
  } catch (error) {
    // ignore
  } finally {
    isLoading.value = false
  }
}

const loadMore = async () => {
  if (isLoading.value) return
  const totalPages = Math.ceil(total.value / pageSize)
  if (total.value <= 0 || page.value >= totalPages) return

  isLoading.value = true
  try {
    const nextPage = page.value + 1
    const response = await getCommentList({
      page: nextPage,
      pageSize,
      type: props.type,
      id: props.id,
      pinned: props.focusCommentId,
    })
    page.value = nextPage
    list.value = [
      ...list.value,
      ...(response.rows?.map((item) => ({ ...item, isCheck: false })) ?? []),
    ]
  } catch (error) {
    if (import.meta.client) {
      console.error('加载更多评论失败:', error)
    }
  } finally {
    isLoading.value = false
  }
}

const { isFinished, setFinished } = useScrollBottom(
  async () => {
    if (page.value < Math.ceil(total.value / pageSize)) {
      await loadMore()
    }
  },
  {
    distance: 300,
    immediate: false,
  }
)

const emit = defineEmits<{
  load: []
  openReply: [payload: CommentOpenReplyPayload]
}>()

const load = () => {
  emit('load')
}

watch(
  () => [props.type, props.id, props.focusCommentId] as const,
  () => {
    void fetchInitial()
  }
)

const showReply = () => {}

const reply = (item: Comment, e?: MouseEvent) => {
  if (!user.token) {
    useToast().add({
      title: '请登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  emit('openReply', { comment: item, event: e })
}

const showDeleteMainModal = ref(false)
const deleteMainModalTrigger = ref<{ x: number; y: number } | undefined>(undefined)
const pendingDeleteMain = ref<Comment | null>(null)
const deleteMainLoading = ref(false)

const onDeleteMainComment = (item: Comment, e?: MouseEvent) => {
  if (!user.token) {
    useToast().add({
      title: '请登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  pendingDeleteMain.value = item
  deleteMainModalTrigger.value =
    e && import.meta.client ? { x: e.clientX, y: e.clientY } : undefined
  showDeleteMainModal.value = true
}

const closeDeleteMainModal = () => {
  showDeleteMainModal.value = false
  pendingDeleteMain.value = null
}

const confirmDeleteMainComment = async () => {
  const item = pendingDeleteMain.value
  if (!item || deleteMainLoading.value) return
  deleteMainLoading.value = true
  try {
    const ok = await deleteComment({ comment_id: Number(item.comment_id) })
    if (ok) {
      useToast().add({
        title: '已删除',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
      delete expandedReplyById[Number(item.comment_id)]
      closeDeleteMainModal()
      await refreshList()
      load()
    }
  } catch {
    useToast().add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  } finally {
    deleteMainLoading.value = false
  }
}

const onReplyDeletedFromThread = async () => {
  await refreshList()
  load()
}

const replyRefreshNonce = ref<Record<number, number>>({})

const setMainCommentExpanded = (commentId: number, open: boolean) => {
  if (open) {
    expandedReplyById[commentId] = true
  } else {
    delete expandedReplyById[commentId]
  }
}

const refreshRepliesFor = (parentCommentId: number) => {
  const pid = Number(parentCommentId)
  expandedReplyById[pid] = true
  const idx = list.value.findIndex((c) => Number(c.comment_id) === pid)
  if (idx >= 0) {
    const row = list.value[idx]
    list.value.splice(idx, 1, {
      ...row,
      r_count: (row.r_count ?? 0) + 1,
    })
  }
  const pin = pinnedComment.value
  if (pin && commentMatchesFocus(pin, pid)) {
    pinnedComment.value = {
      ...pin,
      r_count: (pin.r_count ?? 0) + 1,
    }
  }
  const next = (replyRefreshNonce.value[pid] ?? 0) + 1
  replyRefreshNonce.value = { ...replyRefreshNonce.value, [pid]: next }
}

defineExpose({ refreshRepliesFor, setMainCommentExpanded })

const communityRefreshHolder = inject(communityCommentSectionRefreshKey, null)

onMounted(() => {
  /** 等路由 query 与父级 props 落到子组件后再拉首屏，避免首包未带 `focusCommentId` */
  nextTick(() => {
    void fetchInitial()
  })
  if (communityRefreshHolder) {
    communityRefreshHolder.value = refreshRepliesFor
  }
})

onUnmounted(() => {
  clearPinnedUrlHighlight()
  if (communityRefreshHolder) {
    communityRefreshHolder.value = null
  }
})

</script>
<template>
  <ClientOnly>
    <div
      class="pt-4"
      :class="[
        props.className ? props.className : 'w-full',
        reserveBottomForFixedBar
          ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
          : 'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
      ]"
    >
    <div v-if="pinnedComment" ref="pinnedCommentAnchorRef">
      <CommentItem
        ui="p-2"
        @show-reply="
          pinnedMainCommentId != null && setMainCommentExpanded(pinnedMainCommentId, true)
        "
        @reply="reply"
        @delete="onDeleteMainComment"
        :item="pinnedComment"
        :is-new-highlight="
          pinnedUrlHighlightActive ||
          commentMatchesHighlightId(pinnedComment, newCommentHighlightId)
        "
      />
      <Transition name="comment-reply-expand">
        <div
          v-if="pinnedMainCommentId != null && expandedReplyById[pinnedMainCommentId]"
          :key="`reply-wrap-pinned-${pinnedMainCommentId}`"
          class="m-2 mx-1 p-2 px-1 shadow-sm polaroid-card"
        >
          <CommentReplyList
            :comment_id="pinnedMainCommentId ?? pinnedComment.comment_id"
            :refresh-nonce="
              pinnedMainCommentId != null ? (replyRefreshNonce[pinnedMainCommentId] ?? 0) : 0
            "
            @reply-deleted="onReplyDeletedFromThread"
            @reply="
              (sub, e, meta) => {
                sub.comment_id = sub.id
                const root = pinnedComment
                if (!root) return
                emit('openReply', {
                  comment: sub,
                  event: e,
                  threadRootCommentId: root.comment_id,
                  subReply: meta,
                })
              }
            "
          />
        </div>
      </Transition>
    </div>
      <div v-if="total > 0" class="divide-y divide-gray-100/90 dark:divide-gray-800/80">
        <div v-for="item in list" v-show="item.comment_id !== pinnedComment?.comment_id" :key="item.comment_id" class="py-1 first:pt-0 last:pb-0">
          <CommentItem
            ui="p-2"
            @show-reply="setMainCommentExpanded(item.comment_id, true)"
            @reply="reply"
            @delete="onDeleteMainComment"
            :item="item"
            :is-new-highlight="commentMatchesHighlightId(item, newCommentHighlightId)"
          />

          <Transition name="comment-reply-expand">
            <div
              v-if="expandedReplyById[item.comment_id]"
              :key="`reply-wrap-${item.comment_id}`"
              class="m-2 mx-1 p-2 px-1 shadow-sm polaroid-card"
            >
              <CommentReplyList
                :comment_id="item.comment_id"
                :refresh-nonce="replyRefreshNonce[item.comment_id] ?? 0"
                @reply-deleted="onReplyDeletedFromThread"
                @reply="
                  (sub, e, meta) => {
                    sub.comment_id = sub.id
                    emit('openReply', {
                      comment: sub,
                      event: e,
                      threadRootCommentId: item.comment_id,
                      subReply: meta,
                    })
                  }
                "
              />
            </div>
          </Transition>
        </div>
      </div>
      <div v-else-if="!isLoading" class="text-center text-gray-500 py-8">暂无数据</div>
      <QhxLoading :loading="isLoading"></QhxLoading>

      <QhxModal
        v-model="showDeleteMainModal"
        :trigger-position="deleteMainModalTrigger"
        @close="closeDeleteMainModal"
      >
        <div class="p-6 w-[400px] max-md:w-[90vw] bg-white dark:bg-gray-800 rounded-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">操作确认</h3>
          <p class="text-gray-600 dark:text-gray-300 mb-6">确定删除这条评论吗？此操作不可恢复。</p>
          <div class="flex gap-3 justify-end">
            <UButton color="gray" variant="ghost" class="px-4" @click="closeDeleteMainModal">
              取消
            </UButton>
            <UButton
              color="red"
              class="px-4"
              :loading="deleteMainLoading"
              @click="confirmDeleteMainComment"
            >
              确认删除
            </UButton>
          </div>
        </div>
      </QhxModal>
    </div>
    <template #fallback>
      <div
        :class="[
          props.className ? props.className : 'w-full',
          reserveBottomForFixedBar
            ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
            : 'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
        ]"
        class="min-h-[120px]"
      >
        <QhxLoading :loading="true" />
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.comment-reply-expand-enter-active,
.comment-reply-expand-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
  transform-origin: top center;
}

.comment-reply-expand-enter-from,
.comment-reply-expand-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem) scaleY(0.96);
}
</style>
