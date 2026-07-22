<script setup lang="ts">
definePageMeta({
  ssr: false,
})

import type { Comment, Community, UserDeco } from '@/types/api'
import { getCommunityDetail, deleteCommunity } from '@/api/community'
import { getBrowTimeOne, insertBrowTime } from '@/api/brow_time'
import { getCommentList } from '@/api/comment'
import { getUserDecoBadges } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import UserGoodBtn from '@/components/user/GoodBtn.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'
import type CommunityCommentModalType from '@/components/community/CommentModal.vue'
import {
  communityCommentSectionRefreshKey,
  type CommentOpenReplyPayload,
  type RefreshCommentRepliesFn,
} from '@/composables/communityCommentSection'
import { useCommunityDetailTheme } from '@/composables/useCommunityDetailTheme'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import { useLayoutStyle } from '@/composables/useLayoutStyle'
import { useCommentUiStore } from '@/stores/commentUi'
import {
  parseCommunityImgList,
  toAbsoluteMediaUrl,
} from '@/utils/communityLiveMedia'
import CommunityLiveThumb from '@/components/community/CommunityLiveThumb.vue'

const CommentSection = defineAsyncComponent(
  () => import('@/components/comment/CommentSection.vue'),
)
const CommunityCommentModal = defineAsyncComponent(
  () => import('@/components/community/CommentModal.vue'),
)
const CommunityDetailForeignSection = defineAsyncComponent(
  () => import('@/components/community/CommunityDetailForeignSection.vue'),
)
const AchievementDecoConfigModal = defineAsyncComponent(
  () => import('@/components/achievement/DecoConfigModal.vue'),
)
const AchievementBadgePhysics = defineAsyncComponent(
  () => import('@/components/achievement/BadgePhysics.client.vue'),
)

/** 空闲时执行，避免挡住首屏（WebView 友好） */
function runWhenIdle(fn: () => void, timeout = 2000): number {
  if (!import.meta.client) return 0
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(fn, { timeout }) as unknown as number
  }
  return window.setTimeout(fn, Math.min(timeout, 900))
}

function cancelIdle(handle: number) {
  if (!import.meta.client || !handle) return
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle)
  } else {
    clearTimeout(handle)
  }
}

/** 互动接口：与店铺(1)、图鉴(2)、搭配(4) 对齐，社区帖使用 3 */
const PK_TYPE_COMMUNITY = 3
/** 关注楼主：collect 表 pk_type 与 userSpace 一致为 0 */
const PK_TYPE_USER_COLLECT = 0

const { setLayoutStyle } = useLayoutStyle()
const { copyCurrentUrl } = useCopyCurrentUrl()
const user = useUserStore()
const config = useConfigStore()
const port = computed(() => config.getPort())
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

const { data: pageData, pending: pageLoading } = useAsyncData(
  `community-detail-${id}`,
  async () => {
    // 首屏只拉详情；评论数由 CommentSection @total 回填，避免重复 comment/list
    const detailRes = await getCommunityDetail({ community_id: communityId })
    return { detail: detailRes }
  },
  { server: false, lazy: true },
)

const detail = ref<Community | null>(null)
watch(
  () => pageData.value?.detail,
  (val) => {
    detail.value = val ?? null
  },
  { immediate: true },
)

/** 底栏评论数：评论区加载后回填；发评成功时刷新 */
const commentTotal = ref(0)
const onCommentSectionTotal = (count: number) => {
  commentTotal.value = count ?? 0
}

async function refreshCommentCount() {
  const commentRes = await getCommentList({
    type: 'community',
    id: communityId,
    page: 1,
    pageSize: 1,
  })
  commentTotal.value = commentRes.count ?? 0
}

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

const { customStyle, customBtnStyle, pageBackgroundStyle, pageContentStyle } =
  useCommunityDetailTheme(detail)
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

/** 徽章物理（Three/Ammo/Spark）延后挂载，避免抢首屏 */
const badgePhysicsReady = ref(false)
let badgePhysicsIdleHandle = 0
watch(
  hasPostDisplayBadges,
  (has) => {
    cancelIdle(badgePhysicsIdleHandle)
    badgePhysicsIdleHandle = 0
    if (!has) {
      badgePhysicsReady.value = false
      return
    }
    badgePhysicsIdleHandle = runWhenIdle(() => {
      badgePhysicsReady.value = true
      badgePhysicsIdleHandle = 0
    }, 2800)
  },
  { immediate: true },
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

type CommunityAuthorMoreMenuItem = {
  key: string
  label: string
  desc: string
  icon: string
  iconBgClass: string
  run: (e?: MouseEvent) => void
}

const communityAuthorMoreMenuOpen = ref(false)
const communityAuthorMoreMenuPosition = ref({ x: 0, y: 0 })

const communityAuthorMoreMenuItems = computed((): CommunityAuthorMoreMenuItem[] => [
  {
    key: 'deco',
    label: '配置徽章',
    desc: '选择要展示的成就徽章',
    icon: 'i-heroicons-cog-6-tooth',
    iconBgClass: 'from-purple-500 to-pink-500',
    run: (e) => openCommunityDecoConfig(e),
  },
  {
    key: 'edit',
    label: '编辑',
    desc: '修改帖子内容',
    icon: 'i-heroicons-pencil-square',
    iconBgClass: 'from-amber-500 to-orange-500',
    run: () => {
      const cid = detail.value?.community_id
      if (cid) void navigateTo(`/community/edit/${cid}`)
    },
  },
  {
    key: 'delete',
    label: '删除',
    desc: '永久删除此帖子',
    icon: 'i-heroicons-trash',
    iconBgClass: 'from-red-500 to-red-600',
    run: () => {
      communityDeleteModalOpen.value = true
    },
  },
])

const openCommunityAuthorMoreMenu = (e: MouseEvent) => {
  communityAuthorMoreMenuPosition.value = {
    x: e.clientX + 50,
    y: e.clientY,
  }
  communityAuthorMoreMenuOpen.value = true
}

const onCommunityAuthorMoreItemClick = (item: CommunityAuthorMoreMenuItem, e: MouseEvent) => {
  communityAuthorMoreMenuOpen.value = false
  item.run(e)
}

const communityDeleteModalOpen = ref(false)
const communityDeleteLoading = ref(false)

function navigateAfterCommunityDelete() {
  const isInUniApp =
    typeof window !== 'undefined' && navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateBack) {
    if (typeof uni.postMessage === 'function') {
      uni.postMessage({ data: { type: 'BackAndReload' } })
    }
    uni.navigateBack()
    return
  }

  if (port.value) {
    port.value.postMessage(JSON.stringify({ type: 'BackAndReload' }))
    return
  }

  void navigateTo('/community', { replace: true })
}

async function handleCommunityDelete() {
  const cid = detail.value?.community_id
  if (!cid) return
  communityDeleteLoading.value = true
  try {
    await deleteCommunity({ community_id: cid })
    useToast().add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    communityDeleteModalOpen.value = false
    navigateAfterCommunityDelete()
  } catch (e) {
    console.error('删除帖子失败:', e)
    useToast().add({
      title: '删除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    communityDeleteLoading.value = false
  }
}

const communityAuthorMoreBtnClass = computed(() => [
  'inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-full shadow-md transition-all hover:scale-105 active:scale-95',
  detail.value?.sence_id && 'ring-2 ring-white/60 dark:ring-white/20',
  !customStyle.value?.btnColor && 'bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover',
  customStyle.value?.btnColor && 'hover:opacity-90',
])
const richText = ref<RichNode[] | null>(null)

watch(
  () => detail.value?.content,
  (content) => {
    richText.value = content ? parseRichText(content.replace('60vh', '70vh')) : null
  },
  { immediate: true },
)

const communityCarouselItems = computed(() => {
  const alt = detail.value?.title || 'Lo研社'
  return parseCommunityImgList(detail.value?.img_list).map((m) => ({
    /** Lightbox / 封面：Live 为同名 jpg */
    src: toAbsoluteMediaUrl(m.displayPath),
    alt,
    /** Live mp4；普通图无此字段 */
    videoSrc: m.videoPath ? toAbsoluteMediaUrl(m.videoPath) : undefined,
  }))
})

/** 轮播当前索引，与 QhxCarousel v-model 同步 */
const communityCarouselIndex = ref(0)

const communityLightboxVisible = ref(false)

let communityCarouselPressX = 0
let communityCarouselPressY = 0
let communityCarouselMoved = false

function onCommunityCarouselPressStart(e: MouseEvent | TouchEvent) {
  const point = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e
  if (!point) return
  communityCarouselPressX = point.clientX
  communityCarouselPressY = point.clientY
  communityCarouselMoved = false
}

function onCommunityCarouselPressMove(e: MouseEvent | TouchEvent) {
  const point = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e
  if (!point) return
  if (
    Math.hypot(point.clientX - communityCarouselPressX, point.clientY - communityCarouselPressY) >
    10
  ) {
    communityCarouselMoved = true
  }
}

function openCommunityCarouselLightbox() {
  if (communityCarouselMoved) return
  communityLightboxVisible.value = true
}
watch(
  () => detail.value?.community_id,
  () => {
    communityCarouselIndex.value = 0
    void fetchAuthorBadges()
  },
  { immediate: true }
)

/** 关联场景 iframe：延后设 src，避免与详情首屏抢带宽 */
const sceneIframeSrc = ref('')
let sceneIframeIdleHandle = 0
watch(
  () => detail.value?.sence_id,
  (sid) => {
    setLayoutStyle(sid ? 1 : 0)
    cancelIdle(sceneIframeIdleHandle)
    sceneIframeIdleHandle = 0
    sceneIframeSrc.value = ''
    if (!sid) return
    const targetSid = sid
    sceneIframeIdleHandle = runWhenIdle(() => {
      if (detail.value?.sence_id === targetSid) {
        sceneIframeSrc.value = `https://lolitalibrary.com/scene/detail/${targetSid}?from_iframe=true`
      }
      sceneIframeIdleHandle = 0
    }, 1600)
  },
  { immediate: true },
)

const BROW_TIME_TYPE_COMMUNITY = 'community'
const browTimeViewCount = ref(0)
let communityViewRecordTimer: ReturnType<typeof setTimeout> | null = null

async function loadCommunityViewStat() {
  if (!communityId) return
  try {
    const row = await getBrowTimeOne({ id: communityId, type: BROW_TIME_TYPE_COMMUNITY })
    browTimeViewCount.value = row.count_times ?? 0
  } catch (e) {
    if (import.meta.client) {
      console.error('帖子浏览统计读取失败:', e)
    }
  }
}

async function recordCommunityView() {
  if (!communityId) return
  try {
    await insertBrowTime({ id: communityId, type: BROW_TIME_TYPE_COMMUNITY })
    await loadCommunityViewStat()
  } catch (e) {
    if (import.meta.client) {
      console.error('帖子浏览统计上报失败:', e)
    }
  }
}

/** 优先用详情接口字段，否则用 /times 统计 */
const communityViewCount = computed(
  () => detail.value?.times_count ?? detail.value?.brows_times ?? browTimeViewCount.value
)

const showCommentModal = ref(false)
/** 首次打开后再挂载评论弹窗（含 RichTextEditor），避免进页即拉重包 */
const commentModalEverOpened = ref(false)
const commentModalRef = ref<InstanceType<typeof CommunityCommentModalType> | null>(null)
/** 仅顶层评论成功时整表重挂载；回复成功通过 inject 注册的子评论刷新函数处理（避免模板 ref 拿不到 defineExpose） */
const commentSectionKey = ref(0)
const commentSectionRefreshFn = shallowRef<RefreshCommentRepliesFn | null>(null)
provide(communityCommentSectionRefreshKey, commentSectionRefreshFn)

/** 评论区延后挂载；带 ?comment_id= 时立即挂载以便定位 */
const commentSectionReady = ref(false)
let commentSectionIdleHandle = 0

async function waitCommentModalRef(maxTries = 40) {
  for (let i = 0; i < maxTries; i++) {
    if (commentModalRef.value) return commentModalRef.value
    await new Promise<void>((r) => setTimeout(r, 25))
  }
  return commentModalRef.value
}

async function openCommentModalWithParams(
  params: Parameters<InstanceType<typeof CommunityCommentModalType>['showModel']>[0]
) {
  commentModalEverOpened.value = true
  await nextTick()
  const modal = await waitCommentModalRef()
  modal?.showModel(params)
}

const commentUiStore = useCommentUiStore()

onMounted(() => {
  // 浏览统计延后，不挡首屏
  runWhenIdle(() => {
    void loadCommunityViewStat()
  }, 2500)
  communityViewRecordTimer = setTimeout(() => {
    communityViewRecordTimer = null
    if (user.user?.user_id === 1) return
    void recordCommunityView()
  }, 5000)

  if (focusCommentId.value) {
    commentSectionReady.value = true
  } else {
    commentSectionIdleHandle = runWhenIdle(() => {
      commentSectionReady.value = true
      commentSectionIdleHandle = 0
    }, 1200)
  }
})
onUnmounted(() => {
  if (communityViewRecordTimer) clearTimeout(communityViewRecordTimer)
  cancelIdle(badgePhysicsIdleHandle)
  cancelIdle(sceneIframeIdleHandle)
  cancelIdle(commentSectionIdleHandle)
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
  void openCommentModalWithParams({
    id: communityId,
    type: 'community',
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
  void openCommentModalWithParams({
    id: comment.comment_id,
    type: 'reply',
    reply_to: subReply?.reply_to,
    reply_to_user: subReply?.replyToUser,
    reply_to_name:
      subReply?.replyToUser?.user_name ?? comment.user?.user_name ?? '',
    threadRootCommentId,
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
    class="community-detail-page bg-qhx-bg-card relative mx-auto px-4 pb-4 max-md:px-0 max-md:pb-2 text-qhx-text"
    :class="detail ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : ''"
    :style="pageContentStyle"
  >
    <div
      v-if="pageLoading && !detail"
      class="relative z-[1] flex min-h-[40vh] flex-col items-center justify-center py-16"
    >
      <div class="relative">
        <div class="h-12 w-12 rounded-full border-4 border-pink-100" />
        <div class="absolute left-0 top-0 h-12 w-12 animate-spin rounded-full border-4 border-pink-400 border-t-transparent" />
      </div>
      <p class="mt-4 text-sm tracking-widest text-pink-400">加载中...</p>
    </div>

    <!-- 主题背景：固定铺满视口，不随内容滚动（关联场景全屏 iframe 时不展示） -->
    <div
      v-if="customStyle && !(detail && detail.sence_id)"
      class="pointer-events-none fixed inset-0 z-0"
      :style="pageBackgroundStyle"
      aria-hidden="true"
    />

    <!-- 状态栏高度占位（WebView 通过 query statusbar 注入，见 layouts/default） -->
    <!-- <div
      v-if="config.statusBarHeight > 0"
      :style="{ height: `${config.statusBarHeight}px` }"
    /> -->

    <div class="relative z-[1]">
      <!-- 关联场景：与服饰详情一致，全屏场景 iframe + 可拖拽抽屉承载正文与评论 -->
      <template v-if="detail && detail.sence_id">
        <div class="fixed inset-0 w-screen h-screen z-0 bg-qhx-bg-card">
          <iframe
            v-if="sceneIframeSrc"
            :src="sceneIframeSrc"
            class="w-full h-full border-0"
            frameborder="0"
            title="场景预览"
          />
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-gray-400"
            aria-busy="true"
          >
            <div class="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-400" />
            <span>场景加载中…</span>
          </div>
        </div>
        <Transition :name="`drawer-${isMobile ? 'bottom' : 'right'}`">
          <QhxBottomDrawer v-if="detail" glass :direction="isMobile ? 'bottom' : 'right'">
            <div>
              <div
                v-if="detail.user"
                class="community-scene-glass-panel mx-3 max-md:mx-0 mb-1 rounded-lg shadow-sm"
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
                <button
                  v-if="isCommunityAuthor"
                  type="button"
                  :class="communityAuthorMoreBtnClass"
                  :style="customBtnStyle"
                  aria-label="更多选项"
                  @click="openCommunityAuthorMoreMenu"
                >
                  <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4" />
                </button>
              </div>
              <div class="p-3 max-md:px-1">
                <div v-if="richText" class="leading-[1.8]">
                  <SafeRichText :nodes="richText"></SafeRichText>
                </div>
                <CommunityDetailForeignSection
                  v-if="detail.foreign_list?.length"
                  :items="detail.foreign_list"
                />
              </div>
              <div class="community-scene-glass-panel rounded-lg shadow-inner mt-1 border border-white/50 dark:border-white/10 overflow-hidden">
                <CommentSection
                  v-if="commentSectionReady"
                  :key="commentSectionKey"
                  :type="'community'"
                  :id="detail.community_id"
                  :focus-comment-id="focusCommentId"
                  reserve-bottom-for-fixed-bar
                  @open-reply="openReplyComposer"
                  @total="onCommentSectionTotal"
                />
                <div
                  v-else
                  class="flex min-h-[120px] items-center justify-center py-8 text-sm text-gray-400"
                  aria-busy="true"
                >
                  评论加载中…
                </div>
              </div>
            </div>
          </QhxBottomDrawer>
        </Transition>
      </template>

      <template v-else>
        <div v-if="detail" class="rounded-lg shadow-lg flex max-md:block" :key="detail.community_id">
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
              root-class="!shadow-none rounded-[18px] h-full max-h-full [&_.qhx-carousel-track]:h-full [&_.qhx-carousel-slide]:h-full"
            >
              <template #item="{ item, index }">
                <div
                  class="h-full w-full"
                  role="button"
                  tabindex="0"
                  aria-label="查看大图"
                  @mousedown="onCommunityCarouselPressStart"
                  @mousemove="onCommunityCarouselPressMove"
                  @touchstart.passive="onCommunityCarouselPressStart"
                  @touchmove.passive="onCommunityCarouselPressMove"
                  @keydown.enter.prevent="openCommunityCarouselLightbox"
                  @keydown.space.prevent="openCommunityCarouselLightbox"
                >
                  <CommunityLiveThumb
                    :poster-src="item.src"
                    :video-src="item.videoSrc"
                    :active="index === communityCarouselIndex"
                    :alt="item.alt"
                    :show-badge="Boolean(item.videoSrc)"
                    media-class="h-full w-full max-h-full cursor-pointer object-contain left-cover"
                    @click="openCommunityCarouselLightbox"
                  />
                </div>
              </template>
            </QhxCarousel>
            <div
              class="pointer-events-none absolute right-4 top-4 z-10 rounded-md px-2 py-1 text-xs font-medium tabular-nums shadow-sm backdrop-blur-[2px] max-md:right-3 max-md:top-3"
              :class="[
                !customStyle?.btnColor && 'bg-black/55 hover:bg-black/65 dark:bg-white/20 dark:hover:bg-white/30',
                !customStyle?.btnFontColor && 'text-white',
              ]"
              :style="customBtnStyle"
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
              class="mx-3 max-md:mx-1 mb-1"
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
              <button
                v-if="isCommunityAuthor"
                type="button"
                :class="communityAuthorMoreBtnClass"
                :style="customBtnStyle"
                aria-label="更多选项"
                @click="openCommunityAuthorMoreMenu"
              >
                <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4" />
              </button>
            </div>
            <div class="p-3 max-md:px-3" >
              <div v-if="richText" class=" leading-[1.8]">
                <SafeRichText :nodes="richText"></SafeRichText>
              </div>
              <CommunityDetailForeignSection
                v-if="detail.foreign_list?.length"
                :items="detail.foreign_list"
              />
            </div>
          </div>
        </div>

        <div v-if="detail" class="rounded-lg shadow-lg mt-3">
          <div>
            <CommentSection
              v-if="commentSectionReady"
              :key="commentSectionKey"
              :type="'community'"
              :id="detail.community_id"
              :focus-comment-id="focusCommentId"
              reserve-bottom-for-fixed-bar
              @open-reply="openReplyComposer"
              @total="onCommentSectionTotal"
            />
            <div
              v-else
              class="flex min-h-[120px] items-center justify-center py-8 text-sm text-gray-400"
              aria-busy="true"
            >
              评论加载中…
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部互动栏：内层与详情/评论区同 container 对齐（PC 与评论区同宽）；手机端半透明毛玻璃 -->
    <div
      v-if="detail"
      class="community-detail-bottom-bar-wrap max-md:bg-[rgba(255,255,255,0.2)] fixed inset-x-0 bottom-0 z-[100]"
    >
      <div class="container mx-auto px-4 pt-2 max-md:px-2">
        <div
          class="community-detail-bottom-bar rounded-t-lg border border-b-0 border-gray-200 bg-qhx-bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 max-md:px-2 max-md:rounded-none max-md:border-x-0 max-md:border-gray-200/60 max-md:shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
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
                title="浏览"
                aria-label="浏览数"
              >
                <UIcon name="i-heroicons-eye" class="text-[22px] text-gray-500" />
                <span class="min-w-[1ch] text-sm tabular-nums">{{ communityViewCount }}</span>
              </div>
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
              class="community-detail-bottom-comment min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-400 shadow-sm transition hover:border-qhx-primary/40 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-qhx-primary max-h-[44px]"
              @click="openCommentComposer"
            >
              写评论…
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 全屏徽章：idle 后再挂载物理引擎，避免抢首屏 -->
    <div
      v-if="hasPostDisplayBadges && badgePhysicsReady"
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

    <QhxModal v-model="communityAuthorMoreMenuOpen" :trigger-position="communityAuthorMoreMenuPosition">
      <div class="p-4 w-[200px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-sm font-bold mb-3 text-gray-800 dark:text-gray-200">更多选项</h3>

        <button
          v-for="(item, index) in communityAuthorMoreMenuItems"
          :key="item.key"
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
          :class="index > 0 ? 'mt-2' : ''"
          @click="onCommunityAuthorMoreItemClick(item, $event)"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br"
            :class="item.iconBgClass"
          >
            <UIcon :name="item.icon" class="text-base text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ item.label }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.desc }}</div>
          </div>
        </button>
      </div>
    </QhxModal>

    <QhxModal
      v-model="communityDeleteModalOpen"
      :trigger-position="communityAuthorMoreMenuPosition"
      :close-on-backdrop="false"
    >
      <div class="p-6 w-[400px] max-md:w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">操作确认</h3>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          确定要删除帖子「{{ detail?.title || '未命名' }}」吗？此操作不可恢复。
        </p>
        <div class="flex gap-3 justify-end">
          <UButton
            color="gray"
            variant="ghost"
            class="px-4"
            @click="communityDeleteModalOpen = false"
          >
            取消
          </UButton>
          <UButton
            color="red"
            class="px-4"
            :loading="communityDeleteLoading"
            @click="handleCommunityDelete"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </QhxModal>

    <AchievementDecoConfigModal
      v-if="isCommunityAuthor && detail"
      v-model="communityDecoModalOpen"
      :trigger-position="communityDecoModalPosition"
      :initial-selected-ids="communityDecoInitialSelectedIds"
      :community-id="detail.community_id"
      @saved="onCommunityDecoSaved"
    />

    <CommunityCommentModal
      v-if="commentModalEverOpened"
      ref="commentModalRef"
      v-model="showCommentModal"
      @success="onCommentSuccess"
    />

    <ClientOnly>
      <QhxImageLightbox
        v-if="communityLightboxVisible && communityCarouselItems.length"
        :visible="communityLightboxVisible"
        :imgs="communityCarouselItems"
        :index="communityCarouselIndex"
        @hide="communityLightboxVisible = false"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
/* 顶部 = 原 p-4 / max-md p-2 + 安全区，避免覆盖 Tailwind 上内边距 */
.community-detail-page {
  padding-top: calc(1rem + env(safe-area-inset-top, 0px));
}
/* 关联场景 iframe：抽屉内子块统一毛玻璃材质 */
.community-scene-glass-panel {
  background-color: rgba(255, 255, 255, 0.22);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.community-scene-glass-chip {
  background-color: rgba(255, 255, 255, 0.35);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

:root.dark .community-scene-glass-panel,
.dark .community-scene-glass-panel {
  background-color: rgba(38, 38, 38, 0.38);
}

:root.dark .community-scene-glass-chip,
.dark .community-scene-glass-chip {
  background-color: rgba(38, 38, 38, 0.45);
}

@media (max-width: 767px) {
  .community-detail-page {
    padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
  }

  /* 底部互动栏：写死白色半透明，避免 bg-qhx-bg-card / Tailwind 透明度修饰符无效 */
  .community-detail-bottom-bar {
    background-color: rgba(255, 255, 255, 0.28) !important;
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }

  .community-detail-bottom-comment {
    background-color: rgba(255, 255, 255, 0.92);
    border-color: rgba(229, 231, 235, 0.85);
  }
}
</style>
