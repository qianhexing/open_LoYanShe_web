<script setup lang="ts">
import type { Comment, Community, User, UserDeco } from '@/types/api'
import { getCommunityDetail } from '@/api/community'
import { getCommentList } from '@/api/comment'
import { getUserDecoBadges } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import UserGoodBtn from '@/components/user/GoodBtn.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'
import {
  communityCommentSectionRefreshKey,
  type CommentOpenReplyPayload,
  type RefreshCommentRepliesFn,
} from '@/composables/communityCommentSection'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import { useLayoutStyle } from '@/composables/useLayoutStyle'
import { useCommentUiStore } from '@/stores/commentUi'
import { BASE_IMG } from '@/utils/ipConfig'

/** 互动接口：与店铺(1)、图鉴(2)、搭配(4) 对齐，社区帖使用 3 */
const PK_TYPE_COMMUNITY = 3
/** 关注楼主：collect 表 pk_type 与 userSpace 一致为 0 */
const PK_TYPE_USER_COLLECT = 0

const { setLayoutStyle } = useLayoutStyle()
const { copyCurrentUrl } = useCopyCurrentUrl()
const user = useUserStore()
const config = useConfigStore()
const isMobile = computed(() => config.isMobile)
const route = useRoute()
const id = route.params.id as string
const communityId = Number.parseInt(id, 10)

/** 地址栏 `?comment_id=`：定位该条主楼评论（传给评论区与列表接口） */
const focusCommentId = computed(() => {
  const raw = route.query.comment_id
  if (raw == null) return undefined
  const s = Array.isArray(raw) ? raw[0] : raw
  const n = Number.parseInt(String(s), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

const { data } = await useAsyncData('communityDeatil', () => {
  return getCommunityDetail({ community_id: communityId })
}, {})

const { data: commentCountData, refresh: refreshCommentCount } = await useAsyncData(
  `community-detail-comment-count-${id}`,
  () => getCommentList({ type: 'community', id: communityId, page: 1, pageSize: 1 })
)

/** 楼主已拥有徽章 + 帖子 display_badge 顺序解析（与衣柜页一致） */
function badgeToUserDeco(item: UserDecoBadgeItem): UserDeco {
  const cover = item.cover || item.url || 'static/plan_cover/default.jpg'
  const name = item.title ?? `徽章${item.deco_id}`
  return {
    deco_id: item.deco_id,
    pk_type: 1,
    pk_id: item.deco_id,
    foreign: { cover, name },
  }
}

const detail = ref<Community | null>(null)
const authorBadgeRows = ref<UserDecoBadgeItem[]>([])

const fetchAuthorBadges = async () => {
  const uid = detail.value?.user_id ?? detail.value?.user?.user_id
  if (!uid) {
    authorBadgeRows.value = []
    return
  }
  try {
    const res = await getUserDecoBadges({ user_id: uid })
    authorBadgeRows.value = res.rows ?? []
  } catch (e) {
    console.error('获取楼主徽章失败:', e)
    authorBadgeRows.value = []
  }
}

const postDisplayBadgeStr = computed(() => detail.value?.display_badge ?? '')

const decorationBadges = computed<UserDeco[]>(() => {
  const ids = postDisplayBadgeStr.value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
  if (!ids.length) return []
  const byId = new Map(authorBadgeRows.value.map((b) => [b.deco_id, b]))
  const out: UserDeco[] = []
  for (const decoId of ids) {
    const item = byId.get(decoId)
    if (item) out.push(badgeToUserDeco(item))
  }
  return out
})

const hasPostDisplayBadges = computed(() => decorationBadges.value.length > 0)

const decorationBadgesKey = computed(
  () =>
    `${postDisplayBadgeStr.value}:${decorationBadges.value.map((b) => b.deco_id).join(',') || 'empty'}`
)

const isCommunityAuthor = computed(
  () =>
    !!user.user?.user_id &&
    !!detail.value &&
    (detail.value.user_id === user.user.user_id ||
      detail.value.user?.user_id === user.user.user_id)
)

/** 楼主 user_id，用于关注按钮 */
const authorUserId = computed(() => {
  if (!detail.value) return null
  const uid = detail.value.user_id ?? detail.value.user?.user_id
  if (uid == null || Number.isNaN(Number(uid))) return null
  return Number(uid)
})

/** 详情接口若带楼主粉丝/收藏数，用于展示；否则为 0 */
const authorCollectCount = computed(() => {
  const u = detail.value?.user as { collect_count?: number } | undefined
  return u?.collect_count ?? 0
})

const authorCollectInitial = computed(() => {
  const u = detail.value?.user as { is_collect?: number | boolean } | undefined
  const v = u?.is_collect
  return v === true || v === 1
})

const communityDecoModalOpen = ref(false)
const communityDecoModalPosition = ref({ x: 0, y: 0 })
const communityDecoInitialSelectedIds = computed(() =>
  postDisplayBadgeStr.value
    ? postDisplayBadgeStr.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : []
)
const openCommunityDecoConfig = (e?: MouseEvent) => {
  if (e) communityDecoModalPosition.value = { x: e.clientX, y: e.clientY }
  else if (typeof window !== 'undefined')
    communityDecoModalPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  communityDecoModalOpen.value = true
}

const onCommunityDecoSaved = (payload?: { display_badge?: string | null }) => {
  if (!detail.value || !payload) return
  const s = payload.display_badge
  if (s == null || String(s).trim() === '') detail.value.display_badge = undefined
  else detail.value.display_badge = String(s).trim()
}
const richText = ref<RichNode[] | null>(null)
detail.value = data.value

const communityCarouselItems = computed(() => {
  const raw = detail.value?.img_list
  if (!raw?.trim()) return []
  const alt = detail.value?.title || 'Lo研社'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((path) => ({ src: BASE_IMG + path, alt }))
})

/** 轮播当前索引，与 QhxCarousel v-model 同步 */
const communityCarouselIndex = ref(0)
watch(
  () => detail.value?.community_id,
  () => {
    communityCarouselIndex.value = 0
    void fetchAuthorBadges()
  },
  { immediate: true }
)

/** 关联场景 iframe 全屏时隐藏全局顶栏/底栏 */
watch(
  () => detail.value?.sence_id,
  (sid) => {
    setLayoutStyle(sid ? 1 : 0)
  },
  { immediate: true }
)

const commentTotal = computed(() => commentCountData.value?.count ?? 0)

const showCommentModal = ref(false)
const commentModalRef = ref<{
  showModel: (e: {
    id: number | string
    type: string
    reply_to?: number
    reply_to_name?: string
    reply_to_user?: User
    threadRootCommentId?: number
  }) => void
} | null>(null)
/** 仅顶层评论成功时整表重挂载；回复成功通过 inject 注册的子评论刷新函数处理（避免模板 ref 拿不到 defineExpose） */
const commentSectionKey = ref(0)
const commentSectionRefreshFn = shallowRef<RefreshCommentRepliesFn | null>(null)
provide(communityCommentSectionRefreshKey, commentSectionRefreshFn)

const commentUiStore = useCommentUiStore()

onUnmounted(() => {
  commentUiStore.clearNewCommentHighlight()
})

const openCommentComposer = () => {
  if (!user.token) {
    useToast().add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  showCommentModal.value = true
  nextTick(() => {
    commentModalRef.value?.showModel({
      id: communityId,
      type: 'community'
    })
  })
}

/** 回复某条评论：insert 使用 type reply、id 为被回复的 comment_id */
const openReplyComposer = (payload: CommentOpenReplyPayload) => {
  if (!user.token) {
    useToast().add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  const { comment, threadRootCommentId, subReply } = payload
  showCommentModal.value = true
  nextTick(() => {
    commentModalRef.value?.showModel({
      id: comment.comment_id,
      type: 'reply',
      reply_to: subReply?.reply_to,
      reply_to_user: subReply?.replyToUser,
      reply_to_name:
        subReply?.replyToUser?.user_name ?? comment.user?.user_name ?? '',
      threadRootCommentId,
    })
  })
}

const onCommentSuccess = async (
  comment: Comment,
  meta?: { parentCommentId: number }
) => {
  await refreshCommentCount()
  commentUiStore.flashNewCommentHighlight(comment.comment_id)
  if (meta?.parentCommentId != null) {
    await nextTick()
    commentSectionRefreshFn.value?.(meta.parentCommentId)
  } else {
    commentSectionKey.value += 1
  }
}

onMounted(() => {
  if (detail.value?.content) {
    richText.value = parseRichText(detail.value.content.replace('60vh', '70vh'))
  }
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}

const handleShareLink = async () => {
  try {
    const result = await copyCurrentUrl()
    const toast = useToast()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch (error) {
    console.error('复制链接失败:', error)
    useToast().add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

useHead({
  title: detail.value ? detail.value.title : 'Lolita图鉴',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.title} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
</script>
<template>
  <div
    class="community-detail-page relative mx-auto px-4 pb-4 max-md:px-0 max-md:pb-2"
    :class="detail ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : ''"
  >
    <!-- 状态栏高度占位（WebView 通过 query statusbar 注入，见 layouts/default） -->
    <!-- <div
      v-if="config.statusBarHeight > 0"
      :style="{ height: `${config.statusBarHeight}px` }"
    /> -->

    <div class="relative">
      <!-- 关联场景：与服饰详情一致，全屏场景 iframe + 可拖拽抽屉承载正文与评论 -->
      <template v-if="detail && detail.sence_id">
        <div class="fixed inset-0 w-screen h-screen z-0">
          <iframe
            :src="`https://lolitalibrary.com/scene/detail/${detail.sence_id}?from_iframe=true`"
            class="w-full h-full border-0"
            frameborder="0"
            title="场景预览"
          />
        </div>
        <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
          <QhxBottomDrawer v-if="detail" :direction="isMobile ? 'bottom' : 'right'">
            <div class="bg-qhx-bg-card">
              <div
                v-if="detail.user"
                class="mx-3 max-md:mx-0 mb-1 rounded-lg bg-qhx-bg-card/95 backdrop-blur-sm shadow-sm"
              >
                <div class="flex items-center justify-between gap-3 p-2">
                  <UserInfo
                    class="min-w-0 flex-1"
                    :need-jump="true"
                    :user="detail.user"
                  />
                  <UserCollectBtn
                    v-if="!isCommunityAuthor && authorUserId"
                    variant="follow"
                    class="shrink-0"
                    :pk_type="PK_TYPE_USER_COLLECT"
                    :pk_id="authorUserId"
                    :collect_count="authorCollectCount"
                    :is_collect="authorCollectInitial"
                    :need_judge="true"
                  />
                </div>
              </div>
              <div class="p-3 flex flex-row items-start justify-between gap-3 max-md:px-1">
                <div class="font-semibold flex-1 min-w-0">
                  {{ detail.title }}
                </div>
                <div v-if="isCommunityAuthor" class="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    class="inline-flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-full border border-qhx-primary/40 text-qhx-primary bg-qhx-bg-card hover:bg-qhx-primary/10 transition-colors"
                    @click="openCommunityDecoConfig"
                  >
                    配置徽章
                  </button>
                  <NuxtLink
                    :to="`/community/edit/${detail.community_id}`"
                    class="inline-flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover transition-colors"
                  >
                    编辑
                  </NuxtLink>
                </div>
              </div>
              <div class="p-3 max-md:px-1">
                <div v-if="richText" class="leading-[1.8]">
                  <SafeRichText :nodes="richText"></SafeRichText>
                </div>
              </div>
              <div class="rounded-lg shadow-inner mt-1 border border-gray-100/80 overflow-hidden bg-white">
                <CommentSection
                  :key="commentSectionKey"
                  :type="'community'"
                  :id="detail.community_id"
                  :focus-comment-id="focusCommentId"
                  reserve-bottom-for-fixed-bar
                  @open-reply="openReplyComposer"
                />
              </div>
            </div>
          </QhxBottomDrawer>
        </Transition>
      </template>

      <template v-else>
        <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg flex max-md:block" :key="detail.community_id">
          <div
            class="relative w-[700px] max-md:w-full p-3 aspect-[3/4] min-h-0"
            v-if="communityCarouselItems.length"
          >
            <QhxCarousel
              v-model="communityCarouselIndex"
              :items="communityCarouselItems"
              :autoplay="0"
              :arrows="false"
              indicators
              root-class="!shadow-none rounded-lg bg-transparent h-full max-h-full [&_.qhx-carousel-track]:h-full [&_.qhx-carousel-slide]:h-full"
            >
              <template #item="{ item }">
                <img
                  :src="item.src"
                  :alt="item.alt"
                  class="h-full w-full max-h-full object-contain left-cover"
                  draggable="false"
                />
              </template>
            </QhxCarousel>
            <div
              class="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-black/55 px-2 py-1 text-xs font-medium tabular-nums text-white shadow-sm backdrop-blur-[2px] max-md:right-3 max-md:top-3"
              aria-live="polite"
              :title="`第 ${communityCarouselIndex + 1} 张，共 ${communityCarouselItems.length} 张`"
              :aria-label="`第 ${communityCarouselIndex + 1} 张，共 ${communityCarouselItems.length} 张`"
            >
              {{ communityCarouselIndex + 1 }} / {{ communityCarouselItems.length }}
            </div>
          </div>
          <div class="flex-1">
            <div
              v-if="detail.user"
              class="mx-3 max-md:mx-1 mb-1 rounded-lg bg-qhx-bg-card/95 backdrop-blur-sm shadow-sm"
            >
              <div class="flex items-center justify-between gap-3 p-2">
                <UserInfo
                  class="min-w-0 flex-1"
                  :need-jump="true"
                  :user="detail.user"
                />
                <UserCollectBtn
                  v-if="!isCommunityAuthor && authorUserId"
                  variant="follow"
                  class="shrink-0"
                  :pk_type="PK_TYPE_USER_COLLECT"
                  :pk_id="authorUserId"
                  :collect_count="authorCollectCount"
                  :is_collect="authorCollectInitial"
                  :need_judge="true"
                />
              </div>
            </div>
            <div class="p-3 flex flex-row items-start justify-between gap-3 max-md:px-3">
              <div class="font-semibold flex-1 min-w-0">
                {{ detail.title }}
              </div>
              <div v-if="isCommunityAuthor" class="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  class="inline-flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-full border border-qhx-primary/40 text-qhx-primary bg-qhx-bg-card hover:bg-qhx-primary/10 transition-colors"
                  @click="openCommunityDecoConfig"
                >
                  配置徽章
                </button>
                <NuxtLink
                  :to="`/community/edit/${detail.community_id}`"
                  class="inline-flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover transition-colors"
                >
                  编辑
                </NuxtLink>
              </div>
            </div>
            <div class="p-3 max-md:px-3" >
              <div v-if="richText" class=" leading-[1.8]">
                <SafeRichText :nodes="richText"></SafeRichText>
              </div>
            </div>
          </div>
        </div>

        <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
          <div class="bg-white">
            <CommentSection
              :key="commentSectionKey"
              :type="'community'"
              :id="detail.community_id"
              :focus-comment-id="focusCommentId"
              reserve-bottom-for-fixed-bar
              @open-reply="openReplyComposer"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- 底部互动栏：内层与详情/评论区同 container 对齐（PC 与评论区同宽），纯色底 -->
    <div
      v-if="detail"
      class="fixed inset-x-0 bottom-0 z-[100]"
    >
      <div class="container mx-auto px-4 pt-2 max-md:px-2">
        <div
          class="rounded-t-lg border border-b-0 border-gray-200 bg-qhx-bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 max-md:px-2 max-md:rounded-none max-md:border-x-0"
        >
          <div class="flex items-center gap-2 sm:gap-4">
            <div class="flex shrink-0 items-center gap-3 text-gray-600 sm:gap-4">
              <UserGoodBtn
                :pk_type="PK_TYPE_COMMUNITY"
                :pk_id="detail.community_id"
                :good_count="detail.good_count ?? 0"
                :need_judge="true"
              />
              <UserCollectBtn
                :pk_type="PK_TYPE_COMMUNITY"
                :pk_id="detail.community_id"
                :collect_count="detail.collect_count ?? 0"
                :need_judge="true"
              />
              <div
                class="flex items-center gap-1 text-gray-500"
                title="评论"
                aria-label="评论数"
              >
                <UIcon name="i-heroicons-chat-bubble-left-right" class="text-[22px] text-gray-500" />
                <span class="min-w-[1ch] text-sm tabular-nums">{{ commentTotal }}</span>
              </div>
              <button
                type="button"
                class="flex shrink-0 items-center gap-1 text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
                title="复制链接"
                aria-label="分享：复制当前页链接"
                @click="handleShareLink"
              >
                <UIcon name="ic:round-share" class="text-[22px] text-gray-500" />
                <!-- <span class="text-sm">分享</span> -->
              </button>
            </div>
            <button
              type="button"
              class="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-400 shadow-sm transition hover:border-qhx-primary/40 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary max-h-[44px]"
              @click="openCommentComposer"
            >
              写评论…
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 全屏徽章：仅当帖子配置了 display_badge 且能解析出已拥有徽章；底部让出互动栏 -->
    <div
      v-if="hasPostDisplayBadges"
      class="pointer-events-none fixed inset-x-0 top-0 z-[110] overflow-hidden"
      :class="
        detail
          ? 'bottom-[calc(5.5rem+1.5rem+env(safe-area-inset-bottom,0px))]'
          : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]'
      "
      aria-hidden="true"
    >
      <ClientOnly>
        <AchievementBadgePhysics
          :key="decorationBadgesKey"
          class="h-full w-full"
          :badges="decorationBadges"
        />
      </ClientOnly>
    </div>

    <AchievementDecoConfigModal
      v-if="isCommunityAuthor && detail"
      v-model="communityDecoModalOpen"
      :trigger-position="communityDecoModalPosition"
      :initial-selected-ids="communityDecoInitialSelectedIds"
      :community-id="detail.community_id"
      @saved="onCommunityDecoSaved"
    />

    <CommunityCommentModal
      ref="commentModalRef"
      v-model="showCommentModal"
      @success="onCommentSuccess"
    />
  </div>
</template>

<style scoped>
/* 顶部 = 原 p-4 / max-md p-2 + 安全区，避免覆盖 Tailwind 上内边距 */
.community-detail-page {
  padding-top: calc(1rem + env(safe-area-inset-top, 0px));
}
@media (max-width: 767px) {
  .community-detail-page {
    padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
  }
}
</style>
