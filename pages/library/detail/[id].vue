<script setup lang="ts">
import type { Library, LibrarySimilarItem, PaginationResponse, Shop, LibraryVideo, LibraryPipe, Community, User, Compilations, SenceForeign, Comment, WardrobeClothes } from '@/types/api';
import { getMatchingListListVisitor, type MatchingListItem } from '@/api/matching_list'
import type MatchingAddEditType from '@/components/matching/MatchingAddEdit.vue'
import { getLibraryDetail, getLibraryList, getLibraryVideo, getLibraryPipeListAll, getLibrarySimilar, updateStateMultiple, updatePatternElementsMultiple, updateSaleTimeMultiple } from '@/api/library'
import QhxTag from '~/components/Qhx/Tag.vue';
import type LibraryTypeColorChooseType from '@/components/library/LibraryTypeColorChoose.vue'
import type ClothesAddType from '@/components/Clothes/ClothesAdd.vue'
import { librarySeedFromTypeColorChoose, type LibraryTypeColorChooseResult } from '@/utils/libraryClothesSeed'
import { getWardrobeListOptions } from '@/api/wardrobe'
import { useToast } from '#imports'
import type { Wiki } from '@/types/api'
import dayjs from 'dayjs'
import { getWikiDetail, type WikiDetailParams } from '@/api/wiki'
import { insertCompDetail } from '@/api/compilations'
import type LibraryChooseType from '@/components/library/LibraryChoose.vue'
import type CompilationsChooseType from '@/components/compilations/CompilationsChoose.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import type CommunityCommentModalType from '@/components/community/CommentModal.vue'
import type WikiOptionsChooseType from '@/components/wiki/wikiOptionsChoose.vue'
import { insertCommunityForeign, getCommunityForeignList } from '@/api/community'
import { getEventRedblackList } from '@/api/event_redblack'
import { getScoreOne, insertScore, type ScoreRecord } from '@/api/score'
import {
  clampUserLibraryScore,
  formatLibraryScoreLabel,
  getScoreCaption,
  normalizeAggregateScore,
  starFillRatio
} from '@/utils/libraryScore'
import type { CommunityPostForeignContext } from '@/utils/communityPost'
import { isHtml5PlusWebview, openLibraryWebPath, openLibraryDetailTab, libraryDetailPageHref, openMatchingDetailTab } from '@/composables/useLibraryDetailNavigation'
import { BASE_IMG } from '@/utils/ipConfig'
import { deleteSenceForeign, getSenceForeignList, getSceneId, insertScene } from '@/api/scene'
import type { SceneJSON } from '@/utils/threeCore'
import { getCommentList } from '@/api/comment'
import {
  communityCommentSectionRefreshKey,
  type CommentOpenReplyPayload,
  type RefreshCommentRepliesFn,
} from '@/composables/communityCommentSection'
import { useCommentUiStore } from '@/stores/commentUi'
import type { LibrarySharePayload, LibraryRecommendPayload } from '@/utils/libraryShareCanvas'
import { plainTextFromHtml } from '@/utils/libraryShareCanvas'
import CommentSection from '@/components/comment/CommentSection.vue'
import CommunityCommentModal from '@/components/community/CommentModal.vue'
import LibraryShareImage from '@/components/library/LibraryShareImage.vue'
import LibrarySimilarRecommendImage from '@/components/library/LibrarySimilarRecommendImage.vue'

const CommunityChoose = defineAsyncComponent(
  () => import('@/components/community/CommunityChoose.vue'),
)
const CommunityPostModal = defineAsyncComponent(
  () => import('@/components/community/CommunityPostModal.vue'),
)
const SPZModelViewer = defineAsyncComponent(
  () => import('@/components/ModelViewer/SPZModelViewer.vue'),
)
const PhysicsDrop = defineAsyncComponent(
  () => import('@/components/PhysicsDrop.client.vue'),
)
const WikiOptionsChoose = defineAsyncComponent(
  () => import('@/components/wiki/wikiOptionsChoose.vue'),
)
const MatchingAddEdit = defineAsyncComponent(
  () => import('@/components/matching/MatchingAddEdit.vue'),
)
const ClothesAdd = defineAsyncComponent(
  () => import('@/components/Clothes/ClothesAdd.vue'),
)
const CompilationsChoose = defineAsyncComponent(
  () => import('@/components/compilations/CompilationsChoose.vue'),
)
const LibraryChoose = defineAsyncComponent(
  () => import('@/components/library/LibraryChoose.vue'),
)
const LibraryTypeColorChoose = defineAsyncComponent(
  () => import('@/components/library/LibraryTypeColorChoose.vue'),
)

const customInput = defineAsyncComponent(() => import('~/components/Clothes/customInput.vue'))
const user = useUserStore()
const config = useConfigStore()
const isMobile = computed(() => config.isMobile)
const route = useRoute()
const toast = useToast()

/** 图鉴返图 community foreign（pk_type 见 types/api CommunityForeign） */
const LIBRARY_RETURN_GRAPH_PK_TYPE = 7 as const
/** 图鉴关联场景 sence_foreign pk_type（与 good/collect、event_redblack 一致） */
const LIBRARY_SENCE_FOREIGN_PK_TYPE = 2 as const
const SENCE_FOREIGN_PAGE_SIZE = 10

const libraryForeignRefreshKey = ref(0)
const libraryForeignLinkLoading = ref(false)
const libraryCommunityChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const libraryReturnPostModalRef = ref<{
  open: (e?: MouseEvent) => void
  close: () => void
} | null>(null)
const showLibraryReturnPostModal = ref(false)

const id = route.params.id as string
const libraryId = Number.parseInt(id, 10)

type LibraryDetailPageData = {
  detail: Awaited<ReturnType<typeof getLibraryDetail>>
  commentCount: Awaited<ReturnType<typeof getCommentList>>
  children: Library[]
}

const { data: pageData, refresh: refreshPageData } = await useAsyncData(
  `library-detail-${id}`,
  async (): Promise<LibraryDetailPageData> => {
    const detailRes = await getLibraryDetail({ library_id: libraryId })
    const lid = detailRes.library?.library_id ?? libraryId
    const [commentRes, childListRes] = await Promise.all([
      getCommentList({ type: 'library', id: lid, page: 1, pageSize: 1 }),
      detailRes.library?.library_type === '系列'
        ? getLibraryList({
            filter_list: [{
              field: 'parent_id',
              op: 'and',
              value: id,
            }],
            page: 1,
            pageSize: 999,
          })
        : Promise.resolve(null),
    ])
    return {
      detail: detailRes,
      commentCount: commentRes,
      children: childListRes?.rows ?? [],
    }
  },
)

const library = ref<Library | null>(null)
const libraryRef = ref(null)
const shop = ref<Shop | null>(null)
const uploadUser = ref<User | null>(null)
const style_list = ref<Wiki[]>([])
const parent = ref<Library | null>(null)
const child_list = ref<Library[]>([])

function applyPageData(payload: LibraryDetailPageData | null) {
  if (!payload) return
  library.value = payload.detail.library ?? null
  style_list.value = payload.detail.style_list ?? []
  parent.value = payload.detail.parent ?? null
  shop.value = payload.detail.shop ?? null
  uploadUser.value = payload.detail.upload_user ?? null
  child_list.value = payload.children
}

watch(pageData, (val) => applyPageData(val), { immediate: true })

const library_video = ref<LibraryVideo[]>([])
const library_pipe = ref<LibraryPipe[]>([])
const spzModelViewerRef = ref<{ showModel: (models: Array<{ url: string; type?: 'splat' | 'model'; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; options?: Record<string, unknown> }>) => Promise<void> } | null>(null)

interface LibrarySkuItem {
  library_pattern: string
  library_price?: number
  cover?: string
}

interface LibrarySkuRaw {
  library_pattern: string
  library_price?: unknown
  cover?: unknown
}

const parseLibraryJsonData = (jsonData: unknown): Record<string, unknown> => {
  if (jsonData == null) return {}
  if (typeof jsonData === 'string') {
    try {
      const parsed = JSON.parse(jsonData)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    return jsonData as Record<string, unknown>
  }
  return {}
}

const resolveSkuRawList = (jsonData: Record<string, unknown>): LibrarySkuRaw[] => {
  const raw = jsonData.sku
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return []
    }
  }
  return list
    .filter((item): item is LibrarySkuRaw =>
      !!item
      && typeof item === 'object'
      && 'library_pattern' in item
      && String((item as LibrarySkuRaw).library_pattern).trim() !== ''
    )
    .map((item) => ({
      library_pattern: String(item.library_pattern).trim(),
      library_price: item.library_price,
      cover: item.cover
    }))
}

const normalizeSkuCoverPath = (cover: string | undefined) => {
  if (!cover?.trim()) return ''
  let path = cover.trim().split('?')[0]
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    path = path.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '')
  }
  return path.replace(BASE_IMG, '').replace(/^\//, '')
}

const librarySkuCoverThumb = (cover: string | undefined) => {
  const path = normalizeSkuCoverPath(cover)
  if (!path) return ''
  return `${path}?x-oss-process=image/quality,q_80/resize,w_300,h_300`
}

const librarySkuCoverPreview = (cover: string | undefined) => normalizeSkuCoverPath(cover)

const librarySkuList = computed((): LibrarySkuItem[] => {
  const lib = library.value
  if (!lib) return []

  const skuItems = resolveSkuRawList(parseLibraryJsonData(lib.json_data))
  const metaByPattern = new Map<string, { library_price?: number; cover?: string }>()
  for (const item of skuItems) {
    const cover = item.cover != null && String(item.cover).trim() !== ''
      ? String(item.cover).trim()
      : undefined
    metaByPattern.set(item.library_pattern, {
      library_price: item.library_price != null ? Number(item.library_price) : undefined,
      cover
    })
  }

  const patternNames = (lib.library_pattern
    ? lib.library_pattern.split(',').map((s) => s.trim()).filter(Boolean)
    : skuItems.map((item) => item.library_pattern)
  ).filter((name, index, arr) => arr.indexOf(name) === index)

  if (!patternNames.length) return []

  return patternNames.map((name) => {
    const meta = metaByPattern.get(name)
    return {
      library_pattern: name,
      library_price: meta?.library_price,
      cover: meta?.cover
    }
  })
})

const hasSku = computed(() => librarySkuList.value.length > 0)

const libraryReturnForeignPk = computed((): CommunityPostForeignContext | null => {
  const lid = library.value?.library_id
  if (lid == null) return null
  return { pk_id: lid, pk_type: LIBRARY_RETURN_GRAPH_PK_TYPE }
})

const libraryReturnTabCount = ref<number | undefined>(undefined)
const libraryEventTabCount = ref<number | undefined>(undefined)
const libraryCommentTabCount = ref<number | undefined>(undefined)

const showReturnModal = ref(false)
const showEventModal = ref(false)
const showMatchingModal = ref(false)

const MATCHING_LIST_PAGE_SIZE = 20
const libraryMatchingTabCount = ref<number | undefined>(undefined)
const matchingListLoading = ref(false)
const matchingListItems = ref<MatchingListItem[]>([])
const matchingListPage = ref(1)
const matchingListTotal = ref(0)
const matchingListRefreshKey = ref(0)
const matchingAddEditRef = ref<InstanceType<typeof MatchingAddEditType> | null>(null)

const FAB_ACTIONS_STORAGE_KEY = 'library-detail-fab-actions-expanded'
const fabActionsExpanded = ref(true)
const fabTotalBadgeCount = computed(() => {
  const returnCount = libraryReturnTabCount.value ?? 0
  const eventCount = libraryEventTabCount.value ?? 0
  const matchingCount = libraryMatchingTabCount.value ?? 0
  return returnCount + eventCount + matchingCount
})

const libraryMatchingFilterList = computed(() => {
  const lid = library.value?.library_id
  if (lid == null) return undefined
  return [{ field: 'library_id', value: lid }]
})

function getMatchingCover(item: MatchingListItem): string {
  if (item.cover) return item.cover
  if (item.clothes_list?.length && item.clothes_list[0].clothes_img) {
    return item.clothes_list[0].clothes_img
  }
  if (item.library_list?.length) {
    const lib = item.library_list[0]
    return lib.cover ?? lib.square_cover ?? ''
  }
  return ''
}

function parseMatchingSeasons(season?: string | null): string[] {
  if (!season) return []
  return season.split(',').map((s) => s.trim()).filter(Boolean)
}

const MATCHING_SEASON_THEME_CLASS: Record<string, string> = {
  春: 'matching-season-badge--spring',
  夏: 'matching-season-badge--summer',
  秋: 'matching-season-badge--autumn',
  冬: 'matching-season-badge--winter'
}

function getMatchingSeasonThemeClass(season: string): string {
  return MATCHING_SEASON_THEME_CLASS[season] ?? 'matching-season-badge--default'
}

function getMatchingSingleSeasonClass(season: string): string {
  return `matching-season-badge matching-season-badge--single ${getMatchingSeasonThemeClass(season)}`
}

function getMatchingMultiSeasonClass(season: string): string {
  return `matching-season-badge matching-season-badge--multi ${getMatchingSeasonThemeClass(season)}`
}

const fetchMatchingListCount = async () => {
  const lid = library.value?.library_id
  if (lid == null) return
  try {
    const res = await getMatchingListListVisitor({
      page: 1,
      pageSize: 1,
      keyword: '',
      filter_list: libraryMatchingFilterList.value as unknown as Record<string, unknown>
    })
    libraryMatchingTabCount.value = res.count ?? 0
  } catch {
    /* 保持原数量 */
  }
}

const fetchMatchingList = async (reset = false) => {
  const lid = library.value?.library_id
  if (lid == null || matchingListLoading.value) return
  if (reset) {
    matchingListPage.value = 1
    matchingListItems.value = []
  }
  matchingListLoading.value = true
  try {
    const res = await getMatchingListListVisitor({
      page: matchingListPage.value,
      pageSize: MATCHING_LIST_PAGE_SIZE,
      keyword: '',
      filter_list: libraryMatchingFilterList.value as unknown as Record<string, unknown>
    })
    matchingListTotal.value = res.count ?? 0
    libraryMatchingTabCount.value = res.count ?? 0
    const rows = res.rows ?? []
    if (reset || matchingListPage.value === 1) {
      matchingListItems.value = rows
    } else {
      matchingListItems.value.push(...rows)
    }
  } catch {
    toast.add({
      title: '加载搭配列表失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    matchingListLoading.value = false
  }
}

const loadMoreMatchingList = () => {
  if (matchingListLoading.value) return
  if (matchingListItems.value.length >= matchingListTotal.value) return
  matchingListPage.value += 1
  void fetchMatchingList()
}

const jumpToMatchingDetail = (item: MatchingListItem) => {
  if (!item.matching_id) return
  openMatchingDetailTab(item.matching_id)
}

function openNewMatching() {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const lib = library.value
  if (!lib?.library_id) return
  showMatchingModal.value = false
  matchingAddEditRef.value?.showModel([{
    library_id: lib.library_id,
    clothes_img: lib.cover,
    clothes_note: lib.name
  } as WardrobeClothes])
}

function onMatchingAddSuccess() {
  matchingListRefreshKey.value += 1
  void fetchMatchingListCount()
  if (showMatchingModal.value) {
    void fetchMatchingList(true)
  }
}

function restoreFabActionsExpanded() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const v = localStorage.getItem(FAB_ACTIONS_STORAGE_KEY)
    if (v !== null) fabActionsExpanded.value = v === '1'
  } catch {
    /* 忽略读取失败 */
  }
}

function persistFabActionsExpanded(expanded: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FAB_ACTIONS_STORAGE_KEY, expanded ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function toggleFabActions() {
  fabActionsExpanded.value = !fabActionsExpanded.value
}

restoreFabActionsExpanded()

watch(fabActionsExpanded, (expanded) => {
  persistFabActionsExpanded(expanded)
})

/** 地址栏 `?comment_id=`：定位该条主楼评论 */
const focusCommentId = computed(() => {
  const raw = route.query.comment_id
  if (raw == null) return undefined
  const s = Array.isArray(raw) ? raw[0] : raw
  const n = Number.parseInt(String(s), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

const commentTotal = computed(() => pageData.value?.commentCount?.count ?? 0)

const showCommentModal = ref(false)
const commentModalRef = ref<InstanceType<typeof CommunityCommentModalType> | null>(null)
const commentSectionKey = ref(0)
const commentSectionRefreshFn = shallowRef<RefreshCommentRepliesFn | null>(null)
provide(communityCommentSectionRefreshKey, commentSectionRefreshFn)
const commentUiStore = useCommentUiStore()

const openCommentComposer = () => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  const lid = library.value?.library_id
  if (lid == null) return
  showCommentModal.value = true
  nextTick(() => {
    commentModalRef.value?.showModel({
      id: lid,
      type: 'library',
    })
  })
}

const openReplyComposer = (payload: CommentOpenReplyPayload) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
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

async function refreshCommentCount() {
  const commentRes = await getCommentList({
    type: 'library',
    id: libraryId,
    page: 1,
    pageSize: 1,
  })
  if (pageData.value) {
    pageData.value = { ...pageData.value, commentCount: commentRes }
  }
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

const onCommentTotalChange = (count: number) => {
  libraryCommentTabCount.value = count
}

const libraryCommentMyAvatar = computed(() => {
  const face = user.user?.user_face
  if (!face) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user?.user_name || 'guest'}`
  }
  const trimmed = face.trim()
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    return trimmed
  }
  return `${BASE_IMG}${trimmed.replace(/^\//, '')}`
})

async function prefetchLibraryTabCounts() {
  const lid = library.value?.library_id
  if (lid == null) return
  try {
    const [foreignRes, eventRes, matchingRes] = await Promise.all([
      getCommunityForeignList({
        page: 1,
        pageSize: 1,
        pk_id: lid,
        pk_type: LIBRARY_RETURN_GRAPH_PK_TYPE
      }),
      getEventRedblackList({
        page: 1,
        pageSize: 1,
        pk_id: lid,
        pk_type: 2
      }),
      getMatchingListListVisitor({
        page: 1,
        pageSize: 1,
        keyword: '',
        filter_list: [{ field: 'library_id', value: lid }] as unknown as Record<string, unknown>
      })
    ])
    libraryReturnTabCount.value = foreignRes.count ?? 0
    libraryEventTabCount.value = eventRes.count ?? 0
    libraryMatchingTabCount.value = matchingRes.count ?? 0
  } catch {
    // 角标预取失败时保持不显示
  }
}

function openLibraryReturnChooseCommunity(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (!library.value?.library_id) return
  libraryCommunityChooseRef.value?.showModel(e)
}

async function onLibraryReturnCommunityChosen(item: Community) {
  const lid = library.value?.library_id
  if (lid == null) return
  libraryForeignLinkLoading.value = true
  try {
    await insertCommunityForeign({
      pk_type: LIBRARY_RETURN_GRAPH_PK_TYPE,
      community_id: item.community_id,
      pk_id: lid
    })
    toast.add({
      title: '已关联到本图鉴返图',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    libraryForeignRefreshKey.value += 1
  } catch (error: unknown) {
    console.error('关联返图帖子失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '关联失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    libraryForeignLinkLoading.value = false
  }
}

function goLibraryReturnNewPost(e?: MouseEvent) {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (!library.value?.library_id) return
  libraryReturnPostModalRef.value?.open(e)
}

function onLibraryReturnPostSuccess() {
  libraryForeignRefreshKey.value += 1
}

const formateState = (state: number) => {
  // 0 预约中 1尾款中 2截团制作 3现货在售
  switch (state) {
    case 0:
      return '预约中'
    case 1:
      return '尾款中'
    case 2:
      return '截团制作'
    case 3:
      return '现货在售'
    case 4:
      return '上新图透'
    default:
      return '未知'
  }
}

// 根据状态返回对应的背景颜色
const getStateColor = (state: number): string => {
  switch (state) {
    case 0: // 预约中
      return '#096e00' // 蓝色
    case 1: // 尾款中
      return '#f59e0b' // 橙色
    case 2: // 截团制作
      return '#8b5cf6' // 紫色
    case 3: // 现货在售
      return '#10b981' // 绿色
    case 4: // 上新图透
      return '#ff9eb5' // 粉色
    default:
      return '#6b7280' // 灰色（未知状态）
  }
}

const showSaleHistoryModal = ref(false)

/** 未发生或正在进行的贩售阶段（结束日不早于今天） */
const isLibraryPipeUpcomingOrActive = (pipe: LibraryPipe) => {
  if (!pipe.end_time) return true
  return !dayjs(pipe.end_time).isBefore(dayjs(), 'day')
}

const sortLibraryPipesDesc = (pipes: LibraryPipe[]) =>
  [...pipes].sort((a, b) => dayjs(b.start_time).valueOf() - dayjs(a.start_time).valueOf())

const hasLibraryPipe = computed(() => library_pipe.value.length > 0)
const activeLibraryPipes = computed(() =>
  sortLibraryPipesDesc(library_pipe.value.filter(isLibraryPipeUpcomingOrActive))
)
const sortedAllLibraryPipes = computed(() => sortLibraryPipesDesc(library_pipe.value))
const hasPastLibraryPipes = computed(() =>
  library_pipe.value.some((pipe) => !isLibraryPipeUpcomingOrActive(pipe))
)
const fetchLibraryVideo = async () => {
  const params = {
    pk_id: libraryId,
  }
  library_video.value = await getLibraryVideo(params)
}

// 处理人台图点击事件
function jumpToHumanPlatform(item: LibraryVideo) {
  const vid = item.video_id
  if (vid == null) return
  const lid = library.value?.library_id
  const path =
    lid != null
      ? `/humanPlatform/${vid}?library_id=${lid}`
      : `/humanPlatform/${vid}`
  const fullUrl = `https://lolitalibrary.com${path}`

  if (isHtml5PlusWebview()) {
    void ensureUniWebview().then((u) => {
      if (u?.navigateTo) {
        u.navigateTo({
          url: `/pages/common/outerLink2?fullScreen=true&url=${fullUrl}`,
          fail: () => {
            console.log('跳转人台图失败')
          },
        })
      } else {
        void navigateTo(path)
      }
    })
    return
  }

  const p = config.getPort()
  if (p) {
    p.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: fullUrl },
      }),
    )
    return
  }

  void navigateTo(path)
}

const handleVideoClick = (item: LibraryVideo) => {
  // 点云类型：手机端跳转人台图页，桌面端弹窗查看
  if (item.pk_type === 2 && item.addr) {
    if (isMobile.value) {
      jumpToHumanPlatform(item)
      return
    }
    const modelUrls = item.addr.split(',').filter(url => url.trim())
    const modelList = modelUrls.map((url, index) => ({
      url: url.trim(),
      type: 'splat' as const,
      position: [index * 3, 0, 0] as [number, number, number],
      options: {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/'
      }
    }))
    spzModelViewerRef.value?.showModel(modelList)
  }
}
const fetchLibraryPipe = async () => {
  let pk_id = libraryId
  if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
    pk_id = library.value?.parent_id as number
  }
  const res = await getLibraryPipeListAll({
    pk_id,
    pk_type: 0,
  })
  if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
    library_pipe.value = res.filter((item) => item.library_list?.some((child) => child.library_id === libraryId))
  } else {
    library_pipe.value = res
  }
}
const LIBRARY_DETAIL_SIMILAR_RECOMMEND_KEY = 'library-detail-similar-recommend-enabled'
const similarRows = ref<LibrarySimilarItem[]>([])
const similarLoading = ref(false)
const similarRecommendEnabled = ref(true)
/** onMounted 读取缓存后再响应开关变更，避免初始化时重复请求 */
const similarRecommendPrefsHydrated = ref(false)

function restoreSimilarRecommendEnabled() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const v = localStorage.getItem(LIBRARY_DETAIL_SIMILAR_RECOMMEND_KEY)
    if (v !== null) similarRecommendEnabled.value = v === '1'
  } catch {
    /* 忽略读取失败 */
  }
}

function persistSimilarRecommendEnabled(enabled: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LIBRARY_DETAIL_SIMILAR_RECOMMEND_KEY, enabled ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

const senceForeignRows = ref<SenceForeign[]>([])
const senceForeignLoading = ref(false)
const senceForeignPage = ref(1)
const senceForeignTotal = ref(0)
const senceForeignHasMore = computed(() => senceForeignRows.value.length < senceForeignTotal.value)

const resolveSenceForeignSceneId = (item: SenceForeign) => item.sence?.sence_id ?? item.sence_id

async function fetchSenceForeignList(reset = false) {
  const lid = library.value?.library_id
  if (lid == null) return
  if (senceForeignLoading.value) return
  if (reset) {
    senceForeignPage.value = 1
  }
  senceForeignLoading.value = true
  try {
    const res = await getSenceForeignList({
      page: senceForeignPage.value,
      pageSize: SENCE_FOREIGN_PAGE_SIZE,
      where: {
        pk_id: lid,
        pk_type: LIBRARY_SENCE_FOREIGN_PK_TYPE
      }
    })
    const rows = (res.rows ?? []).filter((item) => resolveSenceForeignSceneId(item) != null)
    senceForeignTotal.value = res.count ?? 0
    if (reset || senceForeignPage.value === 1) {
      senceForeignRows.value = rows
    } else {
      senceForeignRows.value.push(...rows)
    }
  } catch {
    if (reset || senceForeignPage.value === 1) {
      senceForeignRows.value = []
      senceForeignTotal.value = 0
    }
  } finally {
    senceForeignLoading.value = false
  }
}

function loadMoreSenceForeign() {
  if (!senceForeignHasMore.value || senceForeignLoading.value) return
  senceForeignPage.value += 1
  void fetchSenceForeignList()
}

const cloneSceneLoading = ref(false)
const showCloneSceneConfirm = ref(false)
const cloneTargetSceneId = ref<number | null>(null)
const cloneTargetSceneName = ref('')

const deleteSenceForeignLoading = ref(false)
const showDeleteSenceForeignConfirm = ref(false)
const deleteSenceForeignTarget = ref<SenceForeign | null>(null)

function isSenceForeignSceneOwner(item: SenceForeign) {
  const myId = user.user?.user_id
  if (myId == null) return false
  return item.user_id === myId
}

function jumpToSceneEdit(senceId: number) {
  const sceneUrl = `/scene/detail/${senceId}?edit=1`
  const fullUrl = `https://lolitalibrary.com${sceneUrl}`

  if (isHtml5PlusWebview()) {
    void ensureUniWebview().then((u) => {
      if (u?.navigateTo) {
        u.navigateTo({
          url: `/pages/common/outerLink2?fullScreen=true&url=${fullUrl}`,
          fail: () => {
            console.log('跳转错误')
          },
        })
      } else {
        window.open(sceneUrl, '_blank', 'noopener,noreferrer')
      }
    })
    return
  }

  if (port.value) {
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: { url: fullUrl },
    }))
    return
  }

  window.open(sceneUrl, '_blank', 'noopener,noreferrer')
}

function openCloneSenceForeignConfirm(item: SenceForeign) {
  if (!user.user?.user_id) {
    toast.add({
      title: '请先登录',
      description: '登录后可克隆场景到自己的账号',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const sourceId = resolveSenceForeignSceneId(item)
  if (sourceId == null) return
  if (cloneSceneLoading.value) return

  cloneTargetSceneId.value = sourceId
  cloneTargetSceneName.value = item.sence?.sence_desc || '未命名场景'
  showCloneSceneConfirm.value = true
}

async function confirmCloneSenceForeign() {
  const sourceId = cloneTargetSceneId.value
  if (sourceId == null || cloneSceneLoading.value) return

  cloneSceneLoading.value = true
  try {
    const detail = await getSceneId({ sence_id: sourceId })
    const json = detail.json_data
    if (json == null || !Array.isArray(json.objects)) {
      toast.add({
        title: '无法克隆',
        description: '场景数据无效',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      return
    }

    const json_data = JSON.parse(JSON.stringify(json)) as SceneJSON
    json_data.origin = sourceId
    const res = await insertScene({ json_data })
    toast.add({
      title: '克隆成功',
      description: '正在打开新场景',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showCloneSceneConfirm.value = false
    jumpToSceneEdit(res.sence_id)
  } catch (error) {
    console.error('克隆场景失败:', error)
    toast.add({
      title: '克隆失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    cloneSceneLoading.value = false
  }
}

function openDeleteSenceForeignConfirm(item: SenceForeign) {
  if (!isSenceForeignSceneOwner(item)) return
  if (deleteSenceForeignLoading.value) return
  deleteSenceForeignTarget.value = item
  showDeleteSenceForeignConfirm.value = true
}

async function confirmDeleteSenceForeign() {
  const item = deleteSenceForeignTarget.value
  const lid = library.value?.library_id
  const sourceId = item ? resolveSenceForeignSceneId(item) : null
  if (item == null || lid == null || sourceId == null || deleteSenceForeignLoading.value) return
  if (!isSenceForeignSceneOwner(item)) return

  deleteSenceForeignLoading.value = true
  try {
    const detail = await getSceneId({ sence_id: sourceId })
    if (detail.user_id !== user.user?.user_id) {
      toast.add({
        title: '无法删除',
        description: '仅场景拥有者可移除投稿',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      return
    }

    await deleteSenceForeign({
      sence_id: sourceId,
      pk_type: LIBRARY_SENCE_FOREIGN_PK_TYPE,
      pk_id: lid
    })
    toast.add({
      title: '已移除投稿',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showDeleteSenceForeignConfirm.value = false
    deleteSenceForeignTarget.value = null
    senceForeignPage.value = 1
    await fetchSenceForeignList(true)
  } catch (error) {
    console.error('移除场景投稿失败:', error)
    toast.add({
      title: '移除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    deleteSenceForeignLoading.value = false
  }
}

const routeLibraryId = computed(() => {
  const n = Number.parseInt(String(route.params.id), 10)
  return Number.isNaN(n) ? null : n
})
const formatSimilarityScore = (score: number) => {
  if (score >= 0 && score <= 1) {
    return `${(score * 100).toFixed(0)}%`
  }
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}
const fetchSimilarLibraries = async (lid: number) => {
  similarLoading.value = true
  try {
    const res = await getLibrarySimilar({ library_id: lid, pageSize: 20 })
    const rows = res.rows ?? []
    similarRows.value = rows.filter((r) => r.library_id !== lid)
  } catch {
    similarRows.value = []
  } finally {
    similarLoading.value = false
  }
}

onMounted(async () => {
  if (!library.value) {
    try {
      await refreshPageData()
    } catch {
      // SSR 或首次 useAsyncData 异常时客户端补拉失败则保持空状态
    }
  }

  restoreSimilarRecommendEnabled()
  similarRecommendPrefsHydrated.value = true

  const lid = routeLibraryId.value
  const clientTasks: Promise<unknown>[] = [
    fetchLibraryVideo(),
    fetchLibraryPipe(),
    prefetchLibraryTabCounts(),
  ]
  if (lid != null) {
    clientTasks.push(fetchSenceForeignList(true))
    if (similarRecommendEnabled.value) {
      clientTasks.push(fetchSimilarLibraries(lid))
    }
  }
  await Promise.all(clientTasks)

  await nextTick()
  detailImageLayout.value = readDetailImageLayoutPref()
  detailImageLayoutReady.value = true
})

onUnmounted(() => {
  commentUiStore.clearNewCommentHighlight()
})

watch(routeLibraryId, (lid) => {
  if (!import.meta.client) {
    return
  }
  if (lid == null) {
    similarRows.value = []
    senceForeignRows.value = []
    senceForeignTotal.value = 0
    senceForeignPage.value = 1
    libraryMatchingTabCount.value = undefined
    matchingListItems.value = []
    matchingListTotal.value = 0
    return
  }
  libraryMatchingTabCount.value = undefined
  matchingListItems.value = []
  matchingListTotal.value = 0
  void prefetchLibraryTabCounts()
  if (similarRecommendEnabled.value) {
    void fetchSimilarLibraries(lid)
  } else {
    similarRows.value = []
    similarLoading.value = false
  }
  void fetchSenceForeignList(true)
})

watch(showMatchingModal, (open) => {
  if (open) {
    void fetchMatchingList(true)
  } else {
    void fetchMatchingListCount()
  }
})

watch(similarRecommendEnabled, (enabled) => {
  if (!similarRecommendPrefsHydrated.value) return
  persistSimilarRecommendEnabled(enabled)
  const lid = routeLibraryId.value
  if (lid == null) return
  if (enabled) {
    void fetchSimilarLibraries(lid)
  } else {
    similarRows.value = []
    similarLoading.value = false
  }
})
interface WikiParams {
  wiki_name: string
  type_id: number
}

// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any

async function ensureUniWebview() {
  if (uni) return uni
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
    return undefined
  })
  return uni
}

const port = computed(() => config.getPort())
const jumpToWiki = async (params: WikiParams) => {
  const { wiki_name, type_id } = params
  if (!wiki_name) return
  
  try {
    // 调用接口查询 wiki，获取 wiki_id
    const wikiParams: WikiDetailParams = {
      wiki_name: wiki_name.trim(),
      type_id: type_id
    }
    const wikiDetail = await getWikiDetail(wikiParams)
    
    if (!wikiDetail || !wikiDetail.wiki_id) {
      toast.add({
        title: '未找到对应的百科词条',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      return
    }
    
    const wikiId = typeof wikiDetail.wiki_id === 'number' 
      ? wikiDetail.wiki_id 
      : Number.parseInt(String(wikiDetail.wiki_id))
    
    if (Number.isNaN(wikiId)) {
      toast.add({
        title: '百科ID无效',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }
    
    // 根据 wiki_id 跳转
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')

    if (isInUniApp) {
      void ensureUniWebview().then((u) => {
        if (u?.navigateTo) {
          u.navigateTo({
            url: `/pages/lolitaWiki/detail/${wikiId}`,
            fail: () => {
              console.log('跳转错误')
            },
          })
        } else {
          void navigateTo(`/lolitaWiki/detail/${wikiId}`)
        }
      })
    } else if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com/lolitaWiki/detail/${wikiId}`
        }
      }))
    } else {
      // 普通网页环境
      navigateTo(`/lolitaWiki/detail/${wikiId}`)
    }
  } catch (error) {
    console.error('查询wiki失败:', error)
    toast.add({
      title: '查询百科失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
useHead({
  title: library.value ? library.value.name : 'Lolita图鉴',
  meta: [
    {
      name: 'keywords',
      content: `${library.value?.name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
const exchangeRate = (shop_country: number, price: number) => {
  if (!config.config) {
    return false
  }
  const index = config.config.money_type.findIndex((item) => {
    return item.value === shop_country
  })
  if (!price) {
    return false
  }
  if (index !== -1 && config.config.money_type[index].exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (price / config.config.exchange_rate[exchange_rate]).toFixed(2)
  }
  return false
}

// 加入衣柜相关
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChooseType> | null>(null)
const clothesAddRef = ref<InstanceType<typeof ClothesAddType> | null>(null)
const wardrobeCount = ref(0)
const isInWardrobe = ref(false)
const wardrobeLoading = ref(false)

// 检查是否已加入衣柜
const checkWardrobeStatus = async () => {
  if (!library.value?.library_id || !user.token) {
    return
  }
  
  wardrobeLoading.value = true
  try {
    const data = await getWardrobeListOptions({
      library_id: library.value.library_id
    })
    // 检查是否有至少一个衣柜包含该图鉴
    isInWardrobe.value = data.some(item => item.is_wardrobe !== 0 && !!item.is_wardrobe)
    // 统计已加入的衣柜数量
    // wardrobeCount.value = data.filter(item => item.is_wardrobe !== 0 && !!item.is_wardrobe).length
  } catch (error) {
    console.error('检查衣柜状态失败:', error)
  } finally {
    wardrobeLoading.value = false
  }
}

// 监听衣柜添加成功事件
const handleClothesAddSuccess = () => {
  // 重新检查状态
  checkWardrobeStatus()
  // 更新总数
  if (library.value) {
    wardrobeCount.value = (wardrobeCount.value || 0) + 1
    isInWardrobe.value = true
  }
}

// 打开加入衣柜流程 - 第一步：选择图鉴颜色
const handleAddToWardrobe = () => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  if (!library.value) {
    toast.add({
      title: '图鉴信息不存在',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  libraryTypeColorChooseRef.value?.showModel(library.value)
}

// 图鉴颜色选择完成 → 打开新增服饰
const handleLibraryTypeColorChoose = async (data: LibraryTypeColorChooseResult) => {
  await clothesAddRef.value?.showModel(librarySeedFromTypeColorChoose(data))
}

// 初始化时检查状态
watch(() => library.value, (newLibrary) => {
  if (newLibrary) {
    console.log(newLibrary,'newLibrary')
    wardrobeCount.value = newLibrary.wardrobe_count || 0
    checkWardrobeStatus()
  }
}, { immediate: true })

const jumpToLibraryHistory = () => {
  if (!library.value?.library_id) return
  openLibraryWebPath(`/library/history?library_id=${library.value.library_id}`)
}
const handleEditLibrary = () => {
  if (!library.value?.library_id) return
  openLibraryWebPath(`/addLibrary?library_id=${library.value.library_id}`)
}
const jumpToLibraryVideoManage = () => {
  if (!library.value?.library_id) return
  openLibraryWebPath(`/library/manageVideo/${library.value.library_id}`)
}
const jumpToManagePipeline = () => {
  if (!library.value?.library_id) return
  openLibraryWebPath(`/library/managePipeline/${library.value.library_id}`)
}
const jumpToAddChildLibrary = () => {
  if (!library.value?.library_id) return
  const params = new URLSearchParams({
    parent_id: String(library.value.library_id),
    parent_name: library.value.name || ''
  })
  if (library.value.shop_id != null) {
    params.set('shop_id', String(library.value.shop_id))
  }
  if (shop.value?.shop_name) {
    params.set('shop_name', shop.value.shop_name)
  }
  openLibraryWebPath(`/addLibrary?${params.toString()}`)
}

const canUpdateLibrary = computed(() => user.hasPermi('library:detail:update'))
const canInsertComp = computed(() => user.hasPermi('comp:detail:insert'))
const isSeriesWithChildren = computed(
  () => library.value?.library_type === '系列' && child_list.value.length > 0
)
const MAX_SIDE_CHILD_COUNT = 4
const BELOW_CHILD_ROW_COUNT = 4
const sideChildList = computed(() => child_list.value.slice(0, MAX_SIDE_CHILD_COUNT))
const belowChildList = computed(() => child_list.value.slice(MAX_SIDE_CHILD_COUNT))
const childListExpanded = ref(false)
const belowFirstRowList = computed(() => belowChildList.value.slice(0, BELOW_CHILD_ROW_COUNT))
const belowExtraList = computed(() => belowChildList.value.slice(BELOW_CHILD_ROW_COUNT))
const canToggleBelowChildList = computed(() => belowExtraList.value.length > 0)

const toggleChildListExpanded = () => {
  childListExpanded.value = !childListExpanded.value
}

const childTypeFilter = ref('')

const childTypeTagOptions = computed(() => {
  const types: string[] = []
  const seen = new Set<string>()
  for (const item of child_list.value) {
    const type = item.library_type?.trim()
    if (type && !seen.has(type)) {
      seen.add(type)
      types.push(type)
    }
  }
  return types
})

const filteredChildList = computed(() => {
  if (!childTypeFilter.value) return child_list.value
  return child_list.value.filter((item) => item.library_type?.trim() === childTypeFilter.value)
})

const LIBRARY_DETAIL_CHILD_LIST_SECTION_KEY = 'libraryDetailChildListSectionExpanded'
const childListSectionExpanded = ref(true)

function restoreChildListSectionExpanded() {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    const v = localStorage.getItem(LIBRARY_DETAIL_CHILD_LIST_SECTION_KEY)
    if (v !== null) childListSectionExpanded.value = v === '1'
  } catch {
    /* 忽略读取失败 */
  }
}

function persistChildListSectionExpanded(expanded: boolean) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LIBRARY_DETAIL_CHILD_LIST_SECTION_KEY, expanded ? '1' : '0')
  } catch {
    /* 忽略写入失败 */
  }
}

function toggleChildListSectionExpanded() {
  childListSectionExpanded.value = !childListSectionExpanded.value
}

restoreChildListSectionExpanded()

watch(childListSectionExpanded, (expanded) => {
  persistChildListSectionExpanded(expanded)
})

watch(routeLibraryId, () => {
  childListExpanded.value = false
  childTypeFilter.value = ''
})
const canManagePipeline = computed(
  () => canUpdateLibrary.value && library.value?.parent_id === 0
)

const compilationsChooseRef = ref<InstanceType<typeof CompilationsChooseType> | null>(null)
const libraryChooseForBatchRef = ref<InstanceType<typeof LibraryChooseType> | null>(null)
const compInsertLoading = ref(false)

const showCompChoose = (e?: MouseEvent) => {
  compilationsChooseRef.value?.showModel(e)
}

const onCompChoose = async (items: Compilations[]) => {
  if (!library.value?.library_id || !items.length || compInsertLoading.value) return
  compInsertLoading.value = true
  try {
    for (const item of items) {
      await insertCompDetail({
        comp_id: item.comp_id,
        library_id: library.value.library_id
      })
    }
    toast.add({ title: '已添加进合集', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '添加失败', color: 'red' })
  } finally {
    compInsertLoading.value = false
  }
}

const batchStateIds = ref('')
const showBatchStateModal = ref(false)
const batchStateValue = ref<string | undefined>(undefined)
const batchStateStartDate = ref<string | null>(null)
const batchStateEndDate = ref<string | null>(null)
const batchStateSaving = ref(false)
const batchStateSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

type BatchOperationType = 'state' | 'pattern' | 'saleTime'
const showBatchTypeModal = ref(false)
const pendingBatchType = ref<BatchOperationType | null>(null)

const batchTypeOptions: { type: BatchOperationType; label: string; desc: string }[] = [
  { type: 'state', label: '批量修改状态', desc: '统一修改选中图鉴的贩售状态' },
  { type: 'pattern', label: '批量修改柄图', desc: '统一修改选中图鉴的柄图元素' },
  { type: 'saleTime', label: '批量修改初贩时间', desc: '统一修改选中图鉴的初次贩售时间' }
]

const openBatchOperation = () => {
  pendingBatchType.value = null
  showBatchTypeModal.value = true
}

const selectBatchType = (type: BatchOperationType) => {
  pendingBatchType.value = type
  showBatchTypeModal.value = false
  nextTick(() => {
    libraryChooseForBatchRef.value?.showModel()
  })
}

const libraryStateQhxOptions = computed(() =>
  (config.config?.library_state || []).map((item) => ({
    label: item.label,
    value: item.value
  }))
)

const openBatchStateSelect = (e: MouseEvent) => {
  batchStateSelectRef.value?.showPicker(e)
}

const onBatchStateSelect = (option: { label: string; value: string | number }) => {
  batchStateValue.value = option.label
}

const onLibraryBatchChoose = (items: Library[]) => {
  const ids = [
    ...items.map((item) => item.library_id),
    library.value?.library_id
  ].filter((id): id is number => id != null)
  if (!ids.length || !pendingBatchType.value) return

  const idsStr = ids.join(',')
  const batchType = pendingBatchType.value
  pendingBatchType.value = null

  if (batchType === 'state') {
    batchStateIds.value = idsStr
    batchStateValue.value = undefined
    batchStateStartDate.value = null
    batchStateEndDate.value = null
    showBatchStateModal.value = true
    return
  }

  if (batchType === 'pattern') {
    batchPatternIds.value = idsStr
    const current = library.value?.pattern_elements
    selectedPatternElements.value = current
      ? String(current).split(',').map((s) => s.trim()).filter(Boolean).map((item) => ({
          wiki_name: item,
          wiki_id: item
        }))
      : []
    showBatchPatternModal.value = true
    return
  }

  batchSaleTimeIds.value = idsStr
  batchSaleTimeValue.value = library.value?.sale_time
    ? dayjs(library.value.sale_time).format('YYYY-MM-DD')
    : null
  showBatchSaleTimeModal.value = true
}

const confirmBatchStateUpdate = async () => {
  if (!batchStateIds.value || !batchStateValue.value || batchStateSaving.value) return
  const params: Parameters<typeof updateStateMultiple>[0] = {
    ids: batchStateIds.value,
    state: batchStateValue.value
  }
  if (batchStateValue.value === '预约中' || batchStateValue.value === '尾款中') {
    if (!batchStateStartDate.value || !batchStateEndDate.value) {
      toast.add({ title: '请选择时间范围', color: 'orange' })
      return
    }
    if (batchStateValue.value === '预约中') {
      params.start_time = `${dayjs(batchStateStartDate.value).format('YYYY-MM-DD')} 00:00:00`
      params.end_time = `${dayjs(batchStateEndDate.value).format('YYYY-MM-DD')} 23:59:59`
    } else {
      params.arrears_start = `${dayjs(batchStateStartDate.value).format('YYYY-MM-DD')} 00:00:00`
      params.arrears_end = `${dayjs(batchStateEndDate.value).format('YYYY-MM-DD')} 23:59:59`
    }
  }
  batchStateSaving.value = true
  try {
    await updateStateMultiple(params)
    toast.add({ title: '修改成功', color: 'green' })
    showBatchStateModal.value = false
    await refreshLibraryData()
  } catch (error) {
    console.error(error)
    toast.add({ title: '修改失败', color: 'red' })
  } finally {
    batchStateSaving.value = false
  }
}

const batchPatternIds = ref('')
const showBatchPatternModal = ref(false)
const selectedPatternElements = ref<Wiki[]>([])
const batchPatternSaving = ref(false)
const batchPatternWikiOptionsChooseRef = ref<InstanceType<typeof WikiOptionsChooseType> | null>(null)
const batchPatternElementsCustomInputRef = ref<{ showModel: (e: MouseEvent) => void } | null>(null)

const showBatchPatternChooseWiki = () => {
  batchPatternWikiOptionsChooseRef.value?.showModel({ type_id: '3' })
}

const onBatchPatternWikiChoose = (wiki_list: Array<{ wiki_id?: number | string; wiki_name?: string }>) => {
  for (const item of wiki_list) {
    if (!item.wiki_name) continue
    const index = selectedPatternElements.value.findIndex((child) => child.wiki_name === item.wiki_name)
    if (index === -1) {
      selectedPatternElements.value.push({
        wiki_name: item.wiki_name,
        wiki_id: item.wiki_id ?? item.wiki_name
      })
    }
  }
}

const insertBatchPatternCustomTag = (tag: string) => {
  const index = selectedPatternElements.value.findIndex((child) => child.wiki_name === tag)
  if (index === -1) {
    selectedPatternElements.value.push({
      wiki_name: tag,
      wiki_id: tag
    })
  }
}

const openBatchPatternElementsCustomInput = (e: MouseEvent) => {
  batchPatternElementsCustomInputRef.value?.showModel(e)
}

const confirmBatchPatternUpdate = async () => {
  if (!batchPatternIds.value || batchPatternSaving.value) return
  if (selectedPatternElements.value.length === 0) {
    toast.add({ title: '请选择柄图元素', color: 'orange' })
    return
  }
  batchPatternSaving.value = true
  try {
    await updatePatternElementsMultiple({
      ids: batchPatternIds.value,
      pattern_elements: selectedPatternElements.value.map((item) => item.wiki_name).join(',')
    })
    toast.add({ title: '修改成功', color: 'green' })
    showBatchPatternModal.value = false
    await refreshLibraryData()
  } catch (error) {
    console.error(error)
    toast.add({ title: '修改失败', color: 'red' })
  } finally {
    batchPatternSaving.value = false
  }
}

const batchSaleTimeIds = ref('')
const showBatchSaleTimeModal = ref(false)
const batchSaleTimeValue = ref<string | null>(null)
const batchSaleTimeSaving = ref(false)

const confirmBatchSaleTimeUpdate = async () => {
  if (!batchSaleTimeIds.value || !batchSaleTimeValue.value || batchSaleTimeSaving.value) return
  const saleTime = dayjs(batchSaleTimeValue.value).format('YYYY-MM-DD')
  if (!dayjs(saleTime, 'YYYY-MM-DD', true).isValid()) {
    toast.add({ title: '初次贩售时间格式错误', color: 'orange' })
    return
  }
  batchSaleTimeSaving.value = true
  try {
    await updateSaleTimeMultiple({
      ids: batchSaleTimeIds.value,
      sale_time: saleTime
    })
    toast.add({ title: '修改成功', color: 'green' })
    showBatchSaleTimeModal.value = false
    await refreshLibraryData()
  } catch (error) {
    console.error(error)
    toast.add({ title: '修改失败', color: 'red' })
  } finally {
    batchSaleTimeSaving.value = false
  }
}

async function refreshLibraryData() {
  const lid = library.value?.library_id
  if (lid == null) return
  const detail = await getLibraryDetail({ library_id: lid })
  library.value = detail.library ?? library.value
  style_list.value = detail.style_list ?? style_list.value
  parent.value = detail.parent ?? parent.value
  shop.value = detail.shop ?? shop.value
  uploadUser.value = detail.upload_user ?? uploadUser.value
  if (library.value?.library_type === '系列') {
    const childRes = await getLibraryList({
      filter_list: [{ field: 'parent_id', op: 'and', value: String(lid) }],
      page: 1,
      pageSize: 999
    })
    child_list.value = childRes.rows ?? []
  }
  fetchLibraryPipe()
}

// PhysicsDrop 组件相关 - 从接口返回的 model_list 动态生成
interface LibraryModelItem {
  foreign_id: number
  pk_type: number
  pk_id: number
  materia_id: number
  create_time: string
  is_enable: number
  material_box?: {
    materia_id: number
    user_id: number
    pk_type: number
    pk_id: number
    create_time: string
    is_enable: number
    is_private: number
    materia_url: string
    materia_title: string
    cover: string | null
    options?: {
      useDracoLoader?: boolean
      [key: string]: unknown
    }
  }
}

const physicsDropModels = computed(() => {
  // 没有图鉴或没有模型列表时不展示
  const modelList = (library.value as Library & { model_list?: LibraryModelItem[] })?.model_list
  if (!library.value || !Array.isArray(modelList)) {
    return []
  }

  // model_list 示例：
  // [
  //   {
  //     foreign_id: 1,
  //     pk_type: 0,
  //     pk_id: 43,
  //     materia_id: 13,
  //     create_time: '2026-02-03T08:48:09.000Z',
  //     is_enable: 0,
  //     material_box: {
  //       materia_id: 13,
  //       user_id: 1,
  //       pk_type: 1,
  //       pk_id: 0,
  //       create_time: '2026-01-01T05:46:51.000Z',
  //       is_enable: 0,
  //       is_private: 0,
  //       materia_url: '/sence/13.glb',
  //       materia_title: '叶子',
  //       cover: null,
  //       options: { useDracoLoader: true }
  //     }
  //   }
  // ]

  return modelList
    // 只取启用并且有 material_box 的数据
    .filter((item): item is LibraryModelItem & { material_box: NonNullable<LibraryModelItem['material_box']> } => {
      return !!item && item.is_enable === 0 && !!item.material_box && !!item.material_box.materia_url
    })
    // 格式化成 PhysicsDrop 组件需要的结构
    .map((item) => ({
      url: item.material_box.materia_url,
      id: item.materia_id ?? item.material_box.materia_id,
      name: item.material_box.materia_title,
      options: item.material_box.options || { useDracoLoader: true }
    }))
})

const handleObjectClick = (data: { url: string; name: string; id: string | number }) => {
  console.log('点击了物体:', data)
  toast.add({
    title: `点击了: ${data.name}`,
    description: `ID: ${data.id}`,
    icon: 'i-heroicons-information-circle',
    color: 'blue'
  })
}

// PhysicsDrop 显示/隐藏控制
const PHYSICS_DROP_VISIBLE_KEY = 'physicsDropVisible'
// 从 localStorage 读取初始状态，默认显示
const getInitialVisibility = (): boolean => {
  if (import.meta.client) {
    const savedState = localStorage.getItem(PHYSICS_DROP_VISIBLE_KEY)
    return savedState !== null ? savedState === 'true' : true
  }
  return true
}
const isPhysicsDropVisible = ref(getInitialVisibility())

// 切换显示/隐藏状态
const togglePhysicsDrop = () => {
  isPhysicsDropVisible.value = !isPhysicsDropVisible.value
  if (import.meta.client) {
    localStorage.setItem(PHYSICS_DROP_VISIBLE_KEY, String(isPhysicsDropVisible.value))
  }
}

const userLibraryScore = ref<number | null>(null)
const userScoreRecord = ref<ScoreRecord | null>(null)
const userScoreLoading = ref(false)
const scoreSaving = ref(false)
const scoreHoverPreview = ref<number | null>(null)

const fetchMyLibraryScore = async () => {
  const lid = library.value?.library_id
  if (!user.token || lid == null) {
    userLibraryScore.value = null
    userScoreRecord.value = null
    return
  }
  userScoreLoading.value = true
  try {
    const res = await getScoreOne({ id: lid, type: 'library' })
    if (res === false) {
      userLibraryScore.value = null
      userScoreRecord.value = null
      if (library.value) {
        library.value.is_score = 0
      }
    } else {
      userScoreRecord.value = res
      userLibraryScore.value = clampUserLibraryScore(res.score)
      if (library.value) {
        library.value.is_score = 1
      }
    }
  } catch (error) {
    console.error('获取我的评分失败:', error)
    userLibraryScore.value = null
    userScoreRecord.value = null
  } finally {
    userScoreLoading.value = false
  }
}

watch(
  () => [user.token, library.value?.library_id] as const,
  ([token, lid]) => {
    if (!import.meta.client) return
    if (token && lid != null) {
      void fetchMyLibraryScore()
    } else {
      userLibraryScore.value = null
      userScoreRecord.value = null
    }
  },
  { immediate: true }
)

const scoreDisplay = computed(() => userLibraryScore.value ?? 0)
const scoreUiValue = computed(() => scoreHoverPreview.value ?? scoreDisplay.value)
const scoreCaption = computed(() =>
  scoreUiValue.value >= 1 ? getScoreCaption(scoreUiValue.value) : ''
)

const libraryScoreStats = computed(() => {
  const lib = library.value
  if (!lib) return { total: null as number | null, count: 0 }
  const count = Number(lib.score_number) || 0
  const total = lib.score
  if (total == null || !Number.isFinite(Number(total)) || count <= 0) {
    return { total: null, count }
  }
  return { total: normalizeAggregateScore(Number(total)), count }
})

const applyLibraryScoreFields = (src: Library) => {
  if (!library.value) return
  library.value.score = src.score
  library.value.score_number = src.score_number
  if (src.is_score !== undefined) {
    library.value.is_score = src.is_score
  }
}

const setLibraryScore = async (score: number) => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const lid = library.value?.library_id
  if (lid == null || scoreSaving.value) return
  const next = clampUserLibraryScore(score)
  scoreHoverPreview.value = null
  scoreSaving.value = true
  try {
    await insertScore({ id: lid, type: 'library', score: next })
    userLibraryScore.value = next
    if (library.value) {
      library.value.is_score = 1
    }
    await fetchMyLibraryScore()
    const refreshed = await getLibraryDetail({ library_id: lid })
    if (refreshed.library) {
      applyLibraryScoreFields(refreshed.library)
    }
    if (refreshed.upload_user !== undefined) {
      uploadUser.value = refreshed.upload_user ?? null
    }
    // toast.add({
    //   title: `已评为 ${formatLibraryScoreLabel(next)} 星 · ${getScoreCaption(next)}`,
    //   icon: 'i-heroicons-check-circle',
    //   color: 'green'
    // })
  } catch (error: unknown) {
    console.error('评分失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '评分失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    scoreSaving.value = false
  }
}

const { copyCurrentUrl } = useCopyCurrentUrl()

const handleShareLink = async () => {
  try {
    const result = await copyCurrentUrl()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '可将本页链接分享给他人',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制地址栏链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange',
      })
    }
  } catch {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  }
}

const splitLibraryCsv = (value?: string | null) =>
  value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []

const librarySharePayload = computed((): LibrarySharePayload | null => {
  const lib = library.value
  if (!lib) return null

  let priceText = ''
  let priceRmbText = ''
  if (lib.library_price) {
    const currency = formatLabel(lib.shop_country || 0, config.config?.money_type)
    priceText = `参考价 ${lib.library_price} ${currency}`
    const rmb = exchangeRate(lib.shop_country ?? 0, lib.library_price)
    if (rmb) priceRmbText = `≈ ${rmb} 元`
  }

  const stats = libraryScoreStats.value
  let scoreText = ''
  let scoreCaptionText = ''
  if (stats.total != null && stats.count > 0) {
    scoreText = `${formatLibraryScoreLabel(stats.total)} · ${stats.count} 人评分`
    scoreCaptionText = getScoreCaption(stats.total)
  }

  const infoSections: LibrarySharePayload['infoSections'] = []

  const themes = splitLibraryCsv(lib.theme)
  if (themes.length) infoSections.push({ title: '主题', tags: themes })

  if (!hasSku.value && lib.library_pattern) {
    infoSections.push({ title: '版型/部位', tags: splitLibraryCsv(lib.library_pattern) })
  }

  if (lib.sale_time?.trim()) {
    infoSections.push({ title: '发售时间', text: lib.sale_time.trim() })
  }

  const styles = style_list.value.map((item) => item.wiki_name).filter(Boolean)
  if (styles.length) infoSections.push({ title: '主要风格', tags: styles })

  const colors = splitLibraryCsv(lib.color)
  if (colors.length) infoSections.push({ title: '颜色', tags: colors })

  if (lib.state === '预约中' && lib.start_time && lib.end_time) {
    infoSections.push({
      title: '预约时间',
      text: `${dayjs(lib.start_time).format('YYYY-MM-DD HH:mm')} - ${dayjs(lib.end_time).format('YYYY-MM-DD HH:mm')}`,
    })
  } else if (lib.state === '尾款中' && lib.arrears_start && lib.arrears_end) {
    infoSections.push({
      title: '尾款时间',
      text: `${dayjs(lib.arrears_start).format('YYYY-MM-DD HH:mm')} - ${dayjs(lib.arrears_end).format('YYYY-MM-DD HH:mm')}`,
    })
  } else if (lib.state) {
    infoSections.push({ title: '状态', text: lib.state })
  }

  if (lib.size?.trim()) {
    const sizeLines = plainTextFromHtml(lib.size)
    if (sizeLines.length) infoSections.push({ title: '尺码', lines: sizeLines })
  }

  const patternElements = splitLibraryCsv(lib.pattern_elements)
  if (patternElements.length) infoSections.push({ title: '柄图元素', tags: patternElements })

  const designElements = splitLibraryCsv(lib.design_elements)
  if (designElements.length) infoSections.push({ title: '设计元素', tags: designElements })

  const fabric = splitLibraryCsv(lib.fabric_composition)
  if (fabric.length) infoSections.push({ title: '面料成分', tags: fabric })

  const clothElements = splitLibraryCsv(lib.cloth_elements)
  if (clothElements.length) infoSections.push({ title: '主料', tags: clothElements })

  const secondaryCloth = splitLibraryCsv(lib.secondary_cloth)
  if (secondaryCloth.length) infoSections.push({ title: '辅料/里衬', tags: secondaryCloth })

  if (lib.notes?.trim()) {
    const noteLines = plainTextFromHtml(lib.notes)
    if (noteLines.length) infoSections.push({ title: '笔记', lines: noteLines })
  }

  const childItems = child_list.value.map((item) => ({
    name: item.name,
    cover: item.cover,
    libraryType: item.library_type || '图鉴',
  }))

  const similarList = similarRows.value.slice(0, 4).map((item) => ({
    name: item.name,
    cover: item.cover,
    libraryType: item.library_type || '图鉴',
    similarityText:
      item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))
        ? formatSimilarityScore(Number(item.similarity_score))
        : undefined,
    shopName: item.shop?.shop_name?.trim() || undefined,
  }))

  const skuList = hasSku.value
    ? librarySkuList.value.map((item) => {
        const currency = formatLabel(lib.shop_country || 0, config.config?.money_type)
        let skuPriceText = ''
        let skuPriceRmb = ''
        if (item.library_price) {
          skuPriceText = `${item.library_price} ${currency}`
          const rmb = exchangeRate(lib.shop_country ?? 0, item.library_price)
          if (rmb) skuPriceRmb = `≈${rmb}元`
        }
        return {
          pattern: item.library_pattern,
          priceText: skuPriceText || undefined,
          priceRmbText: skuPriceRmb || undefined,
          cover: item.cover || undefined,
        }
      })
    : undefined

  return {
    name: lib.name,
    cover: lib.cover,
    libraryType: lib.library_type || '图鉴',
    libraryId: lib.library_id,
    shopName: shop.value?.shop_name?.trim() || lib.shop?.shop_name?.trim() || undefined,
    shopLogo: shop.value?.shop_logo?.trim() || lib.shop?.shop_logo?.trim() || undefined,
    parent: parent.value
      ? {
          name: parent.value.name,
          cover: parent.value.cover,
          libraryType: parent.value.library_type || '图鉴',
        }
      : undefined,
    childList: childItems,
    scoreText: scoreText || undefined,
    scoreCaption: scoreCaptionText || undefined,
    priceText: !hasSku.value ? priceText || undefined : undefined,
    priceRmbText: !hasSku.value ? priceRmbText || undefined : undefined,
    skuList,
    infoSections,
    similarList: similarList.length ? similarList : undefined,
    uploadUserName: uploadUser.value?.user_name?.trim() || undefined,
  }
})

const libraryRecommendPayload = computed((): LibraryRecommendPayload | null => {
  const lib = library.value
  if (!lib || !similarRows.value.length) return null

  const similarList = similarRows.value.slice(0, 8).map((item) => ({
    name: item.name,
    cover: item.cover,
    libraryType: item.library_type || '图鉴',
    similarityText:
      item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))
        ? formatSimilarityScore(Number(item.similarity_score))
        : undefined,
    shopName: item.shop?.shop_name?.trim() || undefined,
  }))

  return {
    name: lib.name,
    cover: lib.cover,
    libraryType: lib.library_type || '图鉴',
    libraryId: lib.library_id,
    shopName: shop.value?.shop_name?.trim() || lib.shop?.shop_name?.trim() || undefined,
    shopLogo: shop.value?.shop_logo?.trim() || lib.shop?.shop_logo?.trim() || undefined,
    similarList,
  }
})

/** 图鉴缩略图：手机端三列等宽网格，桌面端保持原 flex + 固定尺寸 */
const libraryThumbGridClass =
  'library-thumb-grid flex flex-wrap my-2 max-md:grid max-md:grid-cols-3 max-md:gap-2'
const libraryThumbImgClass =
  'cursor-pointer ml-3 w-[100px] h-[100px] aspect-square object-cover object-center rounded-[10px] shadow-lg border border-gray-200 max-md:ml-0 max-md:w-full'

const LIBRARY_DETAIL_IMAGE_LAYOUT_KEY = 'libraryDetailImageLayout'
type LibraryDetailImageLayout = 'thumb' | 'long'

function readDetailImageLayoutPref(): LibraryDetailImageLayout {
  if (!import.meta.client || typeof localStorage === 'undefined') return 'thumb'
  return localStorage.getItem(LIBRARY_DETAIL_IMAGE_LAYOUT_KEY) === 'long' ? 'long' : 'thumb'
}

function persistDetailImageLayoutPref(layout: LibraryDetailImageLayout) {
  if (!import.meta.client || typeof localStorage === 'undefined') return
  localStorage.setItem(LIBRARY_DETAIL_IMAGE_LAYOUT_KEY, layout)
}

const detailImageLayout = ref<LibraryDetailImageLayout>('thumb')
/** 客户端 onMounted 读取缓存后再展示详情图，避免首屏误渲染 */
const detailImageLayoutReady = ref(false)

function setDetailImageLayout(layout: LibraryDetailImageLayout) {
  detailImageLayout.value = layout
  persistDetailImageLayoutPref(layout)
}

const detailImageUrls = computed(() => {
  const raw = library.value?.detail_image
  if (!raw) return [] as string[]
  return raw.split(',').map(item => item.trim()).filter(Boolean)
})

const detailImageThumbList = computed(() =>
  detailImageUrls.value.map(image => ({
    src: `${image}?x-oss-process=image/quality,q_80/resize,w_300,h_300`,
  })),
)

const libraryDetailImageLongImgClass =
  'cursor-pointer w-full h-auto object-contain rounded-[10px] shadow-lg border border-gray-200'

const libraryVideoGridClass =
  'library-thumb-grid flex flex-wrap pb-3 max-md:grid max-md:grid-cols-3 max-md:gap-2'
const libraryVideoItemClass = 'w-[100px] mr-3 mb-2 max-md:w-full max-md:mr-0'
/** 子图鉴超出侧栏部分：与主图+侧栏同宽，桌面/手机均一排 4 个等比正方形 */
const libraryChildBelowWrapClass =
  'mt-2 ml-3 w-[412px] max-md:ml-0 max-md:w-full flex flex-col gap-[10px] max-md:gap-1.5'
const libraryChildBelowGridClass =
  'library-child-below-grid grid grid-cols-4 gap-[10px] max-md:gap-1.5 w-full'
const libraryChildThumbLinkClass = 'relative block aspect-square cursor-pointer'
const libraryChildThumbImgClass =
  'w-full h-full object-cover object-center rounded-[10px] shadow-lg'
</script>
<template>
  <div>
    <!-- 状态栏高度占位（WebView 通过 query statusbar 注入，见 layouts/default） -->
    <div
      v-if="config.statusBarHeight > 0"
      class="shrink-0"
      aria-hidden="true"
      :style="{ height: `${config.statusBarHeight}px` }"
    />
    <div class="container mx-auto p-4 max-md:p-2">
    <div
      v-if="library"
      class="library-fab-anchor fixed top-20 max-md:top-16 inset-x-0 z-[60] pointer-events-none"
    >
      <div class="container mx-auto px-4 max-md:px-0">
        <div class="library-fab-stack flex w-fit max-w-full flex-col items-end gap-1 ml-auto mt-2 mr-3 max-md:fixed max-md:top-16 max-md:right-2 max-md:mt-0 max-md:mr-0 max-md:ml-0">
      <button
        type="button"
        class="library-fab-btn library-fab-btn--toggle"
        :aria-expanded="fabActionsExpanded"
        :aria-label="fabActionsExpanded ? '收起返图、大事记与搭配' : '展开返图、大事记与搭配'"
        @click="toggleFabActions"
      >
        <UIcon
          name="i-heroicons-chevron-down-20-solid"
          class="library-fab-toggle-icon h-3 w-3 shrink-0"
          :class="{ 'library-fab-toggle-icon--expanded': fabActionsExpanded }"
        />
        <span
          v-if="!fabActionsExpanded && fabTotalBadgeCount > 0"
          class="library-fab-badge"
        >{{ fabTotalBadgeCount > 99 ? '99+' : fabTotalBadgeCount }}</span>
      </button>
      <Transition name="library-fab-panel">
        <div
          v-if="fabActionsExpanded"
          class="library-fab-actions-panel flex flex-col items-end gap-1"
        >
          <button
            type="button"
            class="library-fab-btn library-fab-btn--action"
            @click="showReturnModal = true"
          >
            <span class="library-fab-btn__inner">
              <UIcon name="i-heroicons-photo" class="library-fab-btn__icon" />
              <span class="library-fab-btn__label">返图</span>
              <span
                v-if="libraryReturnTabCount != null && libraryReturnTabCount > 0"
                class="library-fab-badge library-fab-badge--corner"
              >{{ libraryReturnTabCount > 99 ? '99+' : libraryReturnTabCount }}</span>
            </span>
          </button>
          <button
            type="button"
            class="library-fab-btn library-fab-btn--action"
            @click="showEventModal = true"
          >
            <span class="library-fab-btn__inner">
              <UIcon name="i-heroicons-clipboard-document-list" class="library-fab-btn__icon" />
              <span class="library-fab-btn__label">大事记</span>
              <span
                v-if="libraryEventTabCount != null && libraryEventTabCount > 0"
                class="library-fab-badge library-fab-badge--corner"
              >{{ libraryEventTabCount > 99 ? '99+' : libraryEventTabCount }}</span>
            </span>
          </button>
          <button
            type="button"
            class="library-fab-btn library-fab-btn--action"
            @click="showMatchingModal = true"
          >
            <span class="library-fab-btn__inner">
              <UIcon name="material-symbols:style" class="library-fab-btn__icon" />
              <span class="library-fab-btn__label">搭配</span>
              <span
                v-if="libraryMatchingTabCount != null && libraryMatchingTabCount > 0"
                class="library-fab-badge library-fab-badge--corner"
              >{{ libraryMatchingTabCount > 99 ? '99+' : libraryMatchingTabCount }}</span>
            </span>
          </button>
        </div>
      </Transition>
        </div>
      </div>
    </div>

    <div v-if="library" ref="libraryRef" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="library.library_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full flex-col">
          <div class="flex relative">
            <div
              class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]"
              :class="child_list.length > 0 || parent ? 'ml-3' : ''">
              {{ library.library_type }}</div>
            <QhxPreviewImage :key="library.library_id" :list="[{ src: library.cover, alt: library.name }]" :className="child_list.length > 0 || parent ? 'cursor-pointer ml-3 w-[300px] max-md:w-0 max-md:flex-1 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'
              : 'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
            </QhxPreviewImage>
            <div class="w-[100px] h-[430px] ml-3 shrink-0" v-if="child_list.length > 0 || parent">
              <div class="w-[100px]" v-if="child_list && child_list.length > 0">
                <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in sideChildList"
                  :key="item.library_id" class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                  <div
                    class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                    {{ item.library_type }}</div>
                  <img :src="`${BASE_IMG}${item.cover}`" :alt="item.name"
                    class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
                </nuxt-link>
              </div>
              <div class="w-[100px]" v-else-if="parent">
                <nuxt-link :to="`/library/detail/${parent.library_id}`"
                  class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                  <div
                    class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                    {{ parent.library_type }}</div>
                  <img :src="`${BASE_IMG}${parent.cover}`" :alt="parent.name"
                    class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
                </nuxt-link>
              </div>
            </div>
          </div>
          <div :class="libraryChildBelowWrapClass" v-if="belowChildList.length > 0">
            <div :class="libraryChildBelowGridClass">
              <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in belowFirstRowList"
                :key="item.library_id" :class="libraryChildThumbLinkClass">
                <div
                  class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                  {{ item.library_type }}</div>
                <img :src="`${BASE_IMG}${item.cover}`" :alt="item.name" :class="libraryChildThumbImgClass"
                  loading="lazy" />
              </nuxt-link>
            </div>
            <Transition name="library-child-expand">
              <div v-if="childListExpanded && belowExtraList.length > 0" :class="libraryChildBelowGridClass">
                <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in belowExtraList"
                  :key="item.library_id" :class="libraryChildThumbLinkClass">
                  <div
                    class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                    {{ item.library_type }}</div>
                  <img :src="`${BASE_IMG}${item.cover}`" :alt="item.name" :class="libraryChildThumbImgClass"
                    loading="lazy" />
                </nuxt-link>
              </div>
            </Transition>
            <button
              v-if="canToggleBelowChildList"
              type="button"
              class="flex w-full items-center justify-center gap-1 rounded-[10px] py-1.5 text-xs text-gray-500 transition-colors duration-300 hover:text-qhx-primary"
              :aria-expanded="childListExpanded"
              @click="toggleChildListExpanded"
            >
              <UIcon
                name="i-heroicons-chevron-down-20-solid"
                class="text-base transition-transform duration-300 ease-in-out"
                :class="childListExpanded ? 'rotate-180' : ''"
              />
              <span>{{ childListExpanded ? '收起' : `展开更多（${belowExtraList.length}）` }}</span>
            </button>
          </div>
        </div>
        <div class="m-2 flex-1">
          <div class="library-info">
            <h1 class="mb-3 text-lg font-semibold">{{ library.name }}</h1>
          </div>
          <div class="flex flex-wrap gap-1">
            <QhxTag
              v-if="library.examin !== 1 && canUpdateLibrary"
              class="cursor-pointer"
              @click="handleEditLibrary"
              :active="true"
              color="blue"
            >
              修改图鉴
            </QhxTag>
            <QhxTag
              v-else-if="library.examin !== 1"
              class="cursor-pointer"
              @click="handleEditLibrary"
              :active="true"
              color="blue"
            >
              申请纠错
            </QhxTag>
            <QhxTag v-else :active="true" color="blue">
              已被锁定
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="jumpToLibraryHistory" :active="true" color="blue">
              修改历史
            </QhxTag>
            <QhxTag
              v-if="library.library_type === '系列'"
              class="cursor-pointer"
              @click="jumpToAddChildLibrary"
              :active="true"
              color="blue"
            >
              添加下级图鉴
            </QhxTag>
            <QhxTag
              v-if="canInsertComp"
              class="cursor-pointer"
              @click="showCompChoose($event)"
              :active="true"
              color="blue"
            >
              添加进合集
            </QhxTag>
            <QhxTag
              v-if="isSeriesWithChildren && canUpdateLibrary"
              class="cursor-pointer"
              @click="openBatchOperation"
              :active="true"
              color="blue"
            >
              批量操作
            </QhxTag>
            <QhxTag
              v-if="canUpdateLibrary"
              class="cursor-pointer"
              @click="jumpToLibraryVideoManage"
              :active="true"
              color="blue"
            >
              管理人台图
            </QhxTag>
            <QhxTag
              v-if="canManagePipeline"
              class="cursor-pointer"
              @click="jumpToManagePipeline"
              :active="true"
              color="blue"
            >
              状态流水线
            </QhxTag>
          </div>
          <div v-if="hasSku" class="mb-1">
            <h3 class="text-sm m-1">版型/参考价</h3>
            <div class="flex gap-2 overflow-x-auto pb-1 m-2 -mx-1 px-1">
              <div
                v-for="(item, index) in librarySkuList"
                :key="index"
                class="flex-shrink-0 w-[108px] max-md:w-[96px] rounded-[10px] border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900/40 shadow-sm"
              >
                <div class="w-full h-[108px] max-md:h-[96px] overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <QhxPreviewImage
                    v-if="item.cover"
                    :list="[{ src: librarySkuCoverThumb(item.cover), alt: item.library_pattern }]"
                    :preview="[librarySkuCoverPreview(item.cover)]"
                    className="block w-full h-full object-cover cursor-pointer"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-[10px] leading-tight text-center text-gray-400 dark:text-gray-500 px-1"
                  >
                    暂无封面
                  </div>
                </div>
                <div class="p-1.5 flex flex-col gap-1 min-h-[52px]">
                  <p
                    class="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2"
                    :title="item.library_pattern"
                  >
                    <!-- @click="jumpToWiki({ wiki_name: item.library_pattern, type_id: 1 })" -->
                    {{ item.library_pattern }}
                  </p>
                  <div v-if="item.library_price" class="mt-auto text-qhx-primary font-semibold text-[11px] leading-tight">
                    <p>
                      {{ item.library_price }} {{ formatLabel(library.shop_country || 0, config.config?.money_type) }}
                    </p>
                    <p
                      v-if="library.shop_country !== undefined && exchangeRate(library.shop_country, item.library_price)"
                      class="text-[10px] font-normal mt-0.5"
                      style="color: #ffaa7f;"
                    >
                      ≈{{ exchangeRate(library.shop_country, item.library_price) }}元
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="library.library_price" class="text-qhx-primary m-2 font-semibold">
            <div>
              参考价 {{ library.library_price }} {{ formatLabel(library.shop_country || 0, config.config?.money_type) }}
            </div>
            <div class=" text-sm" v-if="library.shop_country !== undefined && exchangeRate(library.shop_country, library.library_price)">
              汇率换算参考 <p style="color: #ffaa7f;">{{ exchangeRate(library.shop_country, library.library_price) +
                '元' }}
              </p>
            </div>
          </div>

          <!-- 评分（状态上方，样式参考数字展馆铭牌） -->
          <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p
              v-if="libraryScoreStats.count > 0 && libraryScoreStats.total != null"
              class="text-[18px] font-serif ml-[10px] tracking-wide text-amber-800/80 dark:text-amber-200/80"
            >
              总分
              <span class="font-semibold text-amber-600 dark:text-amber-400">{{ formatLibraryScoreLabel(libraryScoreStats.total) }}</span>
              <span class="text-amber-700/40 dark:text-amber-300/40 mx-1">·</span>
              {{ libraryScoreStats.count }} 人评分
            </p>
            <p v-else class="text-xs font-serif text-gray-500 dark:text-gray-500">暂无评分</p>
            <p
              v-if="libraryScoreStats.count > 0 && libraryScoreStats.total != null"
              class="text-[18px] font-serif ml-[10px] tracking-wide text-amber-800/80 dark:text-amber-200/80"
            >
            <!-- 评分评语 夯爆了  -->
            {{ getScoreCaption(libraryScoreStats.total) }}
            </p>
          </div>
          <div
              v-if="user.token"
              class="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/[0.06] px-2 py-1.5 shadow-[0_0_12px_rgba(212,175,55,0.08)] dark:border-amber-400/25 dark:bg-amber-500/10"
              :class="(scoreSaving || userScoreLoading) ? 'pointer-events-none opacity-60' : ''"
            >
              <div class="inline-flex items-center gap-0.5">
                <div
                  v-for="s in 5"
                  :key="s"
                  class="relative inline-flex h-7 w-7 shrink-0 items-center justify-center"
                  @mouseleave="scoreHoverPreview = null"
                >
                  <UIcon name="i-heroicons-star" class="h-7 w-7 text-amber-200/70 dark:text-stone-500" />
                  <UIcon
                    v-if="starFillRatio(s, scoreUiValue) > 0"
                    name="i-heroicons-star-solid"
                    class="pointer-events-none absolute inset-0 h-7 w-7 text-amber-500 dark:text-amber-400"
                    :style="starFillRatio(s, scoreUiValue) === 0.5 ? { clipPath: 'inset(0 50% 0 0)' } : undefined"
                  />
                  <button
                    v-if="s > 1"
                    type="button"
                    class="absolute left-0 top-0 z-10 h-full w-1/2 rounded-l focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                    :aria-label="`设为 ${formatLibraryScoreLabel(s - 0.5)} 星`"
                    @mouseenter="scoreHoverPreview = s - 0.5"
                    @focus="scoreHoverPreview = s - 0.5"
                    @blur="scoreHoverPreview = null"
                    @click="setLibraryScore(s - 0.5)"
                  />
                  <button
                    type="button"
                    class="absolute top-0 z-10 h-full rounded-r focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                    :class="s > 1 ? 'right-0 w-1/2' : 'inset-0 w-full'"
                    :aria-label="`设为 ${s} 星`"
                    @mouseenter="scoreHoverPreview = s"
                    @focus="scoreHoverPreview = s"
                    @blur="scoreHoverPreview = null"
                    @click="setLibraryScore(s)"
                  />
                </div>
              </div>
              <span
                v-if="scoreCaption"
                class="shrink-0 px-1.5 py-0.5 text-[11px] font-serif tracking-wider rounded border border-amber-400/35 text-amber-800/90 bg-amber-400/5 dark:border-amber-400/30 dark:text-amber-100/90"
              >
                {{ scoreCaption }}
              </span>
            </div>
            <div
              v-else-if="scoreDisplay >= 1"
              class="inline-flex items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/[0.06] px-2 py-1.5 dark:border-amber-400/25 dark:bg-amber-500/10"
            >
              <div class="inline-flex items-center gap-0.5">
                <div
                  v-for="s in 5"
                  :key="s"
                  class="relative inline-flex h-6 w-6 items-center justify-center"
                >
                  <UIcon name="i-heroicons-star" class="h-6 w-6 text-amber-200/70 dark:text-stone-500" />
                  <UIcon
                    v-if="starFillRatio(s, scoreDisplay) > 0"
                    name="i-heroicons-star-solid"
                    class="absolute inset-0 h-6 w-6 text-amber-500 dark:text-amber-400"
                    :style="starFillRatio(s, scoreDisplay) === 0.5 ? { clipPath: 'inset(0 50% 0 0)' } : undefined"
                  />
                </div>
              </div>
            </div>

          <!-- 贩售历史（有数据才显示；仅展示未发生或进行中的阶段） -->
          <div v-if="hasLibraryPipe" class="mb-3">
            <div class="flex items-center justify-between m-1">
              <h3 class="text-sm">贩售历史</h3>
              <button
                v-if="hasPastLibraryPipes"
                type="button"
                class="text-xs text-qhx-primary hover:opacity-80 transition-opacity"
                @click="showSaleHistoryModal = true"
              >
                查看全部
              </button>
            </div>
            <div v-if="activeLibraryPipes.length > 0" class="space-y-2 m-2">
              <div
                v-for="pipe in activeLibraryPipes"
                :key="pipe.pipe_id"
                class="rounded-xl border border-gray-100 dark:border-gray-700 bg-gradient-to-r from-white to-gray-50/60 dark:from-gray-900/40 dark:to-gray-800/40 shadow-sm overflow-hidden"
              >
                <div class="px-2 py-2 flex flex-wrap items-center gap-2 border-b border-gray-50 dark:border-gray-700/60">
                  <QhxTag :active="true" :backgroundColor="getStateColor(pipe.state || 0)">
                    <span class="text-xs">{{ formateState(pipe.state || 0) }}</span>
                  </QhxTag>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ dayjs(pipe.start_time).format('YY-MM-DD') }} - {{ dayjs(pipe.end_time).format('YY-MM-DD') }}
                  </span>
                </div>
                <p v-if="pipe.note" class="text-xs px-2 py-2 text-gray-600 dark:text-gray-400 line-clamp-2">
                  备注：{{ pipe.note }}
                </p>
              </div>
            </div>
            <p v-else-if="hasPastLibraryPipes" class="text-xs text-gray-500 dark:text-gray-400 m-2">
              暂无进行中的贩售阶段
            </p>
          </div>

          <!-- 主题 -->
          <div v-if="library.theme" class="mb-1">
            <h3 class="text-sm m-1">主题</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.theme.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 14 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 版型/部位 -->
          <div v-if="!hasSku && library.library_pattern" class="mb-1">
            <h3 class="text-sm m-1">版型/部位</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.library_pattern.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 1 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 发售时间 -->
          <div v-show="library.sale_time" class="mb-1">
            <h3 class="text-sm m-1">发售时间</h3>
            <p class="text-xs p-2">{{ library.sale_time }}</p>
          </div>
          <div v-if="style_list" class="mb-1">
            <h3 class="text-sm m-1">主要风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 颜色 -->
          <div v-if="library.color" class="mb-1">
            <h3 class="text-sm m-1">颜色</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.color.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <div v-if="library.state === '预约中'" class="mb-4">
            <h3 class="text-sm m-1">预约时间</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ dayjs(library.start_time).format('YYYY-MM-DD HH:mm') }}</QhxTag>
              <span>-</span>
              <QhxTag :active="true">{{ dayjs(library.end_time).format('YYYY-MM-DD HH:mm') }}</QhxTag>
            </p>
          </div>
          <div v-else-if="library.state === '尾款中'" class="mb-4">
            <h3 class="text-sm m-1">尾款时间</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ dayjs(library.arrears_start).format('YYYY-MM-DD HH:mm') }}</QhxTag>
              <span>-</span>
              <QhxTag :active="true">{{ dayjs(library.arrears_end).format('YYYY-MM-DD HH:mm') }}</QhxTag>
            </p>
          </div>
          <div v-else class="mb-4">
            <h3 class="text-sm m-1">状态</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ library.state }}</QhxTag>
            </p>
          </div>
          <div v-if="library.size" class="mb-4">
            <h3 class="text-sm m-1">尺码</h3>
            <p class="text-xs p-2">
              <ClientOnly>
                <SafeRichText :nodes="parseRichText(library.size.replace(/\n/g, '<br>'))" />
              </ClientOnly>
            </p>
          </div>
          <!-- 信息表 -->
          <div v-if="library.size_image" class="mb-4">
            <h3 class="text-sm m-1">信息表</h3>
            <div :class="libraryThumbGridClass">
              <QhxPreviewImage
                :list="library.size_image.split(',').map((image) => { return { src: image + '?x-oss-process=image/quality,q_80/resize,w_300,h_300' } })"
                :preview="library.size_image.split(',')"
                :className="libraryThumbImgClass">
              </QhxPreviewImage>
            </div>
          </div>

          <!-- 柄图元素 -->
          <div v-if="library.pattern_elements" class="mb-1">
            <h3 class="text-sm m-1">柄图元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.pattern_elements.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 3 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- Design Elements -->
          <div v-if="library.design_elements" class="mb-4">
            <h3 class="text-sm m-1">设计元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.design_elements.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 2 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>
          <!-- Fabric Composition -->
          <div v-if="library.fabric_composition" class="mb-4">
            <h3 class="text-sm m-1">面料成分</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.fabric_composition.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: tags.split('%').length > 1 ? tags.split('%')[1] : tags, type_id: 15 })"
                class="cursor-pointer">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 主料 -->
          <div v-if="library.cloth_elements" class="mb-4">
            <h3 class="text-sm m-1">主料</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.cloth_elements.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: tags, type_id: 5 })" class="cursor-pointer">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 辅料/里衬 -->
          <div v-if="library.secondary_cloth" class="mb-4">
            <h3 class="text-sm m-1">辅料/里衬</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(item, index) in library.secondary_cloth.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: item, type_id: 5 })" class="cursor-pointer">
                {{ item }}
              </QhxTag>
            </div>
          </div>

          <!-- 笔记 -->
          <div v-show="library.notes" class="mb-4">
            <h3 class="text-sm m-1">笔记</h3>
            <!-- <div class="text-xs p-2" v-html="library.notes"></div> -->
            <ClientOnly>
              <SafeRichText v-if="library.notes" :nodes="parseRichText(library.notes.replace(/\n/g, '<br>'))" />
            </ClientOnly>
          </div>


          <div class="flex justify-center">
            <div class=" flex-1 text-center">
              <UserGoodBtn :pk_type="2" :pk_id="library.library_id" :good_count="library.good_count" :need_judge="true">
              </UserGoodBtn>
            </div>
            <div class=" flex-1 text-center">
              <UserCollectBtn :collect_count="library.collect_count" :pk_type="2" :pk_id="library.library_id"
                :need_judge="true"></UserCollectBtn>
            </div>
            <div class=" flex-1 text-center">
              <div @click="handleAddToWardrobe" class="cursor-pointer inline-block">
                <div class="flex items-center">
                  <UIcon 
                    name="hugeicons:wardrobe-04" 
                    class="text-[26px]"
                    :class="isInWardrobe ? 'text-[#409EFF]' : 'text-gray-500'" 
                  />
                  <div class="text-base ml-1">{{ wardrobeCount }}</div>
                </div>
              </div>
            </div>
            <div class="flex-1 text-center">
              <button
                type="button"
                class="cursor-pointer inline-block"
                title="复制链接"
                aria-label="分享：复制当前页链接"
                @click="handleShareLink"
              >
                <UIcon name="ic:round-share" class="text-[26px] text-gray-500" />
              </button>
            </div>
            <div class="flex-1 text-center">
              <LibraryShareImage :payload="librarySharePayload" variant="inline" />
            </div>
            <!-- <div class=" flex-1 text-center">
              <UIcon :name="'i-heroicons-heart-20-solid'" class=" text-[26px] text-[#409EFF] cursor-pointer" @click="captureScreen()"/>
            </div> -->
          </div>
        </div>
      </div>
      <div v-if="library?.detail_image && detailImageLayoutReady" class="my-2">
        <div class="flex items-center justify-end gap-1 px-3 max-md:px-2 mb-1.5">
          <div
            class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs"
            role="group"
            aria-label="详情图布局"
          >
            <button
              type="button"
              class="px-2.5 py-1 transition-colors"
              :class="detailImageLayout === 'thumb'
                ? 'bg-qhx-primary text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'"
              @click="setDetailImageLayout('thumb')"
            >
              缩略图
            </button>
            <button
              type="button"
              class="px-2.5 py-1 transition-colors border-l border-gray-200 dark:border-gray-700"
              :class="detailImageLayout === 'long'
                ? 'bg-qhx-primary text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'"
              @click="setDetailImageLayout('long')"
            >
              长图
            </button>
          </div>
        </div>
        <div v-if="detailImageLayout === 'long'" class="flex flex-col gap-2 px-3 max-md:px-2">
          <QhxPreviewImage
            v-for="(img, index) in detailImageUrls"
            :key="`detail-long-${index}`"
            :list="[{ src: `${img}?x-oss-process=image/quality,q_80/resize,w_750` }]"
            :preview="detailImageUrls"
            :className="libraryDetailImageLongImgClass"
          />
        </div>
        <div v-else :class="libraryThumbGridClass">
          <QhxPreviewImage
            :list="detailImageThumbList"
            :preview="detailImageUrls"
            :className="libraryThumbImgClass"
          />
        </div>
      </div>
      <div v-if="shop" class="p-3 px-6">
        <ShopItem v-if="shop" :item="shop" size="small" />
      </div>
      <div
        v-if="library && (senceForeignLoading && senceForeignRows.length === 0 || senceForeignRows.length > 0)"
        class="p-3 px-8"
      >
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">关联场景</p>
        <div v-if="senceForeignLoading && senceForeignRows.length === 0" class="text-sm text-gray-500 py-2">
          加载中…
        </div>
        <div v-else class="flex gap-3 overflow-x-auto pb-1">
          <div
            v-for="item in senceForeignRows"
            :key="item.foreign_id"
            class="flex-shrink-0 w-[120px] max-md:w-[100px] rounded-[10px] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-900/40"
          >
            <nuxt-link
              :to="`/scene/detail/${resolveSenceForeignSceneId(item)}`"
              class="block"
            >
              <div class="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800">
                <img
                  :src="`${BASE_IMG}${item.sence?.sence_cover || 'static/plan_cover/default.jpg'}?x-oss-process=image/quality,q_80/resize,w_300,h_225`"
                  :alt="item.sence?.sence_desc || '场景封面'"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <p
                class="px-2 pt-1.5 pb-1 text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2"
                :title="item.sence?.sence_desc || '未命名场景'"
              >
                {{ item.sence?.sence_desc || '未命名场景' }}
              </p>
            </nuxt-link>
            <div class="flex border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                class="flex-1 flex items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] text-qhx-primary hover:bg-qhx-primary/5 transition-colors disabled:opacity-50"
                :disabled="cloneSceneLoading && cloneTargetSceneId === resolveSenceForeignSceneId(item)"
                @click.stop="openCloneSenceForeignConfirm(item)"
              >
                <UIcon
                  :name="cloneSceneLoading && cloneTargetSceneId === resolveSenceForeignSceneId(item) ? 'i-heroicons-arrow-path' : 'i-heroicons-document-duplicate'"
                  class="text-sm"
                  :class="{ 'animate-spin': cloneSceneLoading && cloneTargetSceneId === resolveSenceForeignSceneId(item) }"
                />
                <span>克隆</span>
              </button>
              <button
                v-if="isSenceForeignSceneOwner(item)"
                type="button"
                class="flex-1 flex items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] text-red-500 border-l border-gray-100 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                :disabled="deleteSenceForeignLoading && deleteSenceForeignTarget?.foreign_id === item.foreign_id"
                @click.stop="openDeleteSenceForeignConfirm(item)"
              >
                <UIcon
                  :name="deleteSenceForeignLoading && deleteSenceForeignTarget?.foreign_id === item.foreign_id ? 'i-heroicons-arrow-path' : 'i-heroicons-trash'"
                  class="text-sm"
                  :class="{ 'animate-spin': deleteSenceForeignLoading && deleteSenceForeignTarget?.foreign_id === item.foreign_id }"
                />
                <span>删除</span>
              </button>
            </div>
          </div>
          <button
            v-if="senceForeignHasMore"
            type="button"
            class="flex-shrink-0 w-[88px] max-md:w-[72px] self-stretch min-h-[120px] rounded-[10px] border border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:border-qhx-primary hover:text-qhx-primary transition-colors disabled:opacity-60"
            :disabled="senceForeignLoading"
            @click="loadMoreSenceForeign"
          >
            <UIcon
              :name="senceForeignLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'"
              class="text-lg"
              :class="{ 'animate-spin': senceForeignLoading }"
            />
            <span>{{ senceForeignLoading ? '加载中' : '加载更多' }}</span>
          </button>
        </div>
      </div>
      <div
          v-if="uploadUser"
          class="p-3 px-8"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">上传用户</p>
          <UserInfo :user="uploadUser" :need-jump="true" size="mini" />
        </div>
    </div>
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3 p-3 max-md:p-2">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">相似推荐</h2>
        <div class="flex shrink-0 items-center gap-3">
          <LibrarySimilarRecommendImage
            v-if="similarRecommendEnabled && !similarLoading && similarRows.length > 0"
            :payload="libraryRecommendPayload"
          />
          <label class="flex shrink-0 items-center gap-2 cursor-pointer">
            <span class="text-xs text-gray-500 dark:text-gray-400">开启</span>
            <UToggle v-model="similarRecommendEnabled" color="primary" />
          </label>
        </div>
      </div>
      <template v-if="similarRecommendEnabled">
      <div v-if="similarLoading" class="text-sm text-gray-500 py-4 text-center">加载中…</div>
      <div v-else-if="similarRows.length > 0" class="flex gap-3 overflow-x-auto pb-1">
        <a
          v-for="item in similarRows"
          :key="item.library_id"
          :href="libraryDetailPageHref(item.library_id)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-shrink-0 w-[120px] max-md:w-[100px] block rounded-[10px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-900/40 no-underline"
          :title="item.name"
          @click.prevent="openLibraryDetailTab(item.library_id)"
        >
          <div class="relative aspect-[3/4] w-full">
            <img
              :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_300,h_400`"
              :alt="item.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <span
              v-if="item.similarity_score != null && !Number.isNaN(Number(item.similarity_score))"
              class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white"
            >
              {{ formatSimilarityScore(Number(item.similarity_score)) }}
            </span>
          </div>
          <div class="p-2 pt-1.5">
            <p class="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2" :title="item.name">{{ item.name }}</p>
            <p v-if="item.shop?.shop_name" class="text-[10px] text-gray-500 truncate mt-0.5" :title="item.shop.shop_name">{{ item.shop.shop_name }}</p>
          </div>
        </a>
      </div>
      </template>
    </div>
    <div v-if="library && child_list.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3 p-3 max-md:p-2">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 mb-2 text-left"
        :aria-expanded="childListSectionExpanded"
        @click="toggleChildListSectionExpanded"
      >
        <h2 class="text-lg font-semibold">
          子图鉴
          <span class="text-sm font-normal text-gray-400 dark:text-gray-500">（{{ filteredChildList.length }}）</span>
        </h2>
        <span class="flex shrink-0 items-center gap-1 text-xs text-gray-500 transition-colors hover:text-qhx-primary">
          <UIcon
            name="i-heroicons-chevron-down-20-solid"
            class="text-base transition-transform duration-300 ease-in-out"
            :class="childListSectionExpanded ? 'rotate-180' : ''"
          />
          <span>{{ childListSectionExpanded ? '收起' : '展开' }}</span>
        </span>
      </button>
      <Transition name="library-child-expand">
        <div v-if="childListSectionExpanded">
          <div v-if="childTypeTagOptions.length > 0" class="flex flex-wrap gap-1.5 mb-3">
            <QhxTag
              class="cursor-pointer"
              :active="childTypeFilter === ''"
              @click="childTypeFilter = ''"
            >
              全部
            </QhxTag>
            <QhxTag
              v-for="tag in childTypeTagOptions"
              :key="tag"
              class="cursor-pointer"
              :active="childTypeFilter === tag"
              @click="childTypeFilter = tag"
            >
              {{ tag }}
            </QhxTag>
          </div>
          <div
            v-if="filteredChildList.length > 0"
            class="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <nuxt-link
              v-for="item in filteredChildList"
              :key="item.library_id"
              :to="`/library/detail/${item.library_id}`"
              class="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div class="relative w-14 h-14 shrink-0 rounded-[10px] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                <img
                  :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_80/resize,w_200,h_200`"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div
                  class="absolute left-0 top-0 px-1 py-0.5 bg-qhx-primary text-qhx-inverted text-[10px] rounded-br-[6px] leading-none"
                >
                  {{ item.library_type }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" :title="item.name">
                  {{ item.name }}
                </p>
                <div class="flex flex-wrap items-center gap-1 mt-1">
                  <QhxTag v-if="item.library_pattern">{{ item.library_pattern }}</QhxTag>
                  <QhxTag v-if="item.state">{{ item.state }}</QhxTag>
                  <QhxTag v-if="item.library_price" :active="true">
                    参考价 {{ item.library_price }} {{ formatLabel(item.shop_country || library?.shop_country || 0, config.config?.money_type) }}
                  </QhxTag>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right-20-solid" class="text-gray-400 shrink-0" />
            </nuxt-link>
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            暂无匹配子图鉴
          </p>
        </div>
      </Transition>
    </div>
    <div v-if="library && library_video.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <div class="p-3 max-md:block">
        <h1 class="mb-3 text-lg font-semibold">人台图</h1>
        <div :class="libraryVideoGridClass">
          <div v-for="(item) in library_video" :key="item.video_id" :class="libraryVideoItemClass">
            <div class="relative">
              <!-- 点云类型：点击打开点云弹窗 -->
              <div
                v-if="item.pk_type === 2"
                @click="handleVideoClick(item)"
                :class="`${libraryThumbImgClass} relative overflow-hidden`"
              >
                <img
                  v-if="item.cover"
                  :src="BASE_IMG + item.cover + '?x-oss-process=image/quality,q_80/resize,w_300,h_300'"
                  :alt="item.title || library.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <UIcon name="i-heroicons-cube" class="w-8 h-8 text-gray-400" />
                </div>
                <div class="absolute left-[0px] top-[0px] px-1.5 py-0.5 flex justify-center items-center bg-qhx-primary text-[10px] text-qhx-inverted rounded-[4px] font-semibold">
                  3D
                </div>
                <div v-if="item.addr" class="absolute right-[-20px] top-[-10px] max-md:right-1 max-md:top-1 w-[20px] h-[20px] flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-[50%]">
                  {{ item.addr.split(',').length }}
                </div>
              </div>
              <!-- 普通类型：使用预览图片组件，优先使用 cover 字段 -->
              <QhxPreviewImage
                v-else
                :list="[{ src: (item.cover || item.addr?.split(',')[0] || '') + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: item.title || library.name }]"
                :preview="(item.json_data?.laxian_list?.length && item.addr)
                  ? item.addr.split(',').map((image) => ({ src: image.trim(), title: item.title }))
                  : (item.cover ? [item.cover] : (item.addr ? item.addr.split(',').map((image) => ({ src: image.trim(), title: item.title })) : []))"
                :laxian-list="item.json_data?.laxian_list ?? []"
                :className="`${libraryThumbImgClass} relative`">
                <div v-if="item.addr" class="absolute right-[-20px] top-[-10px] max-md:right-1 max-md:top-1 w-[20px] h-[20px] flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-[50%]">{{ item.addr.split(',').length }}</div>
              </QhxPreviewImage>
            </div>
            <div v-if="item.title" class="ml-3 max-md:ml-0 mt-2 text-xs text-gray-600 dark:text-gray-400 truncate" :title="item.title">{{ item.title }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- SPZ模型查看器弹窗 -->
    <ClientOnly>
      <SPZModelViewer ref="spzModelViewerRef" />
    </ClientOnly>
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">评论</h3>
        <span class="text-xs text-gray-500 dark:text-gray-400">共 {{ commentTotal }} 条</span>
      </div>
      <div class="bg-white dark:bg-gray-900 min-h-[min(50vh,480px)]">
        <div class="px-4 pt-4 pb-2">
          <div class="flex items-center gap-3 mb-3">
            <UAvatar
              :src="libraryCommentMyAvatar"
              :alt="user.user?.user_name || '未登录'"
              size="sm"
              class="bg-gray-100 flex-shrink-0"
            />
            <button
              type="button"
              class="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-10 flex items-center px-4 text-gray-400 text-sm text-left hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              @click="openCommentComposer"
            >
              <span class="i-heroicons-pencil w-4 h-4 mr-2"></span>
              说点什么…
            </button>
          </div>
        </div>
        <CommentSection
          v-if="library.library_id"
          :key="commentSectionKey"
          :type="'library'"
          :id="library.library_id"
          :focus-comment-id="focusCommentId"
          @open-reply="openReplyComposer"
          @total="onCommentTotalChange"
        />
      </div>
    </div>
    
    <!-- 加入衣柜相关组件 -->
    <ClientOnly>
      <CommunityCommentModal
        ref="commentModalRef"
        v-model="showCommentModal"
        @success="onCommentSuccess"
      />
      <CommunityChoose
        ref="libraryCommunityChooseRef"
        :only-mine="true"
        title="选择要关联的返图帖子"
        placeholder="搜索我的帖子..."
        @choose="onLibraryReturnCommunityChosen"
      />
      <CommunityPostModal
        ref="libraryReturnPostModalRef"
        v-model="showLibraryReturnPostModal"
        :foreign-pk="libraryReturnForeignPk"
        modal-title="投稿返图"
        :skip-summary-link="true"
        :success-redirect="false"
        @success="onLibraryReturnPostSuccess"
      />
      <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
      <ClothesAdd ref="clothesAddRef" enable-wardrobe-picker @success="handleClothesAddSuccess" />
      <CompilationsChoose ref="compilationsChooseRef" @choose="onCompChoose" />
      <LibraryChoose
        ref="libraryChooseForBatchRef"
        :multiple="true"
        :need-parent="false"
        :filter_list="library?.library_id ? [{ field: 'parent_id', op: 'and', value: library.library_id }] : []"
        @choose="onLibraryBatchChoose"
      />
    </ClientOnly>
    
    <QhxModal v-model="showBatchTypeModal" :close-on-backdrop="true">
      <div class="w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="text-base font-semibold text-gray-800 dark:text-gray-100">批量操作</div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">选择要执行的批量修改类型</p>
        </div>
        <div class="p-3 space-y-2">
          <button
            v-for="option in batchTypeOptions"
            :key="option.type"
            type="button"
            class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-600 px-4 py-3 hover:border-qhx-primary/50 hover:bg-qhx-primary/5 transition-colors"
            @click="selectBatchType(option.type)"
          >
            <div class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ option.label }}</div>
            <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ option.desc }}</div>
          </button>
        </div>
        <div class="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            @click="showBatchTypeModal = false"
          >
            取消
          </button>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showReturnModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-pink-50/90 to-purple-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">返图</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showReturnModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="overflow-y-auto flex-1 min-h-0 bg-white dark:bg-gray-900">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center px-4 pt-4 pb-2">
            分享你与这条图鉴相关的返图，或关联已有帖子
          </p>
          <div class="flex flex-wrap gap-2 justify-center px-4 pb-4">
            <QhxJellyButton>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5 disabled:opacity-50"
                :disabled="libraryForeignLinkLoading || !library?.library_id"
                @click="openLibraryReturnChooseCommunity($event)"
              >
                <UIcon name="i-heroicons-link" class="w-4 h-4" />
                {{ libraryForeignLinkLoading ? '处理中…' : '关联已有帖子' }}
              </button>
            </QhxJellyButton>
            <QhxJellyButton>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
                :disabled="!library?.library_id"
                @click="goLibraryReturnNewPost($event)"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                投稿返图
              </button>
            </QhxJellyButton>
          </div>
          <ClientOnly>
            <CommunityForeignList
              v-if="showReturnModal && library"
              :key="libraryForeignRefreshKey"
              :pk_type="LIBRARY_RETURN_GRAPH_PK_TYPE"
              :pk_id="library.library_id"
              allow-delete-foreign
              :can_load="showReturnModal"
              @count-change="libraryReturnTabCount = $event"
            />
            <template #fallback>
              <div class="text-center text-gray-500 py-8">加载中…</div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showEventModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-rose-50/90 to-orange-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">大事记</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showEventModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="overflow-y-auto flex-1 min-h-0">
          <EventRedblack
            v-if="showEventModal && library"
            :pk_id="library.library_id"
            :pk_type="2"
            :can_load="showEventModal"
            @load="libraryEventTabCount = $event"
          />
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showMatchingModal">
      <div
        class="w-[95vw] max-w-3xl h-[90vh] max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-purple-50/90 to-pink-50/80 dark:from-gray-800 dark:to-gray-800"
        >
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">搭配</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showMatchingModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-2 md:p-6 overflow-y-auto flex-1 min-h-0">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
            包含本款图鉴的搭配清单
          </p>
          <div class="flex flex-wrap gap-2 justify-center mb-4">
            <UButton
              color="primary"
              size="sm"
              icon="i-heroicons-plus"
              :disabled="!library?.library_id"
              @click="openNewMatching"
            >
              新建搭配
            </UButton>
          </div>
          <div
            v-if="matchingListLoading && matchingListItems.length === 0"
            class="flex flex-col items-center justify-center gap-3 py-16 text-gray-500"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin" />
            <span class="text-sm">加载中…</span>
          </div>
          <div
            v-else-if="matchingListItems.length === 0"
            class="text-center py-12 text-sm text-gray-500 dark:text-gray-400"
          >
            暂无包含本款图鉴的搭配
          </div>
          <div v-else :key="matchingListRefreshKey" class="space-y-3">
            <div
              v-for="item in matchingListItems"
              :key="item.matching_id"
              class="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 cursor-pointer transition hover:ring-2 hover:ring-qhx-primary/30"
              @click="jumpToMatchingDetail(item)"
            >
              <div class="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  v-if="getMatchingCover(item)"
                  :src="`${BASE_IMG}${getMatchingCover(item)}?x-oss-process=image/quality,q_80/resize,w_200`"
                  :alt="item.note || '搭配'"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-gray-400"
                >
                  <UIcon name="material-symbols:style" class="text-2xl" />
                </div>
                <div
                  v-if="parseMatchingSeasons(item.season).length > 0"
                  class="absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-wrap gap-0.5"
                >
                  <span
                    v-if="parseMatchingSeasons(item.season).length === 1"
                    :class="getMatchingSingleSeasonClass(parseMatchingSeasons(item.season)[0])"
                  >
                    {{ parseMatchingSeasons(item.season)[0] }}
                  </span>
                  <span
                    v-for="(seasonItem, seasonIndex) in parseMatchingSeasons(item.season)"
                    v-else
                    :key="`${item.matching_id}-season-${seasonIndex}`"
                    :class="getMatchingMultiSeasonClass(seasonItem)"
                  >
                    {{ seasonItem }}
                  </span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                  {{ item.note || '未命名搭配' }}
                </div>
                <div v-if="item.main_style" class="mt-1 text-xs text-qhx-primary dark:text-pink-300 line-clamp-1">
                  {{ item.main_style.split(',').map((s) => `★${s}`).join(' ') }}
                </div>
              </div>
            </div>
            <div v-if="matchingListItems.length < matchingListTotal" class="flex justify-center pt-2">
              <UButton
                variant="soft"
                color="gray"
                size="sm"
                :loading="matchingListLoading"
                @click="loadMoreMatchingList"
              >
                加载更多
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showSaleHistoryModal">
      <div
        class="w-[95vw] max-w-2xl max-h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">贩售历史</h3>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="关闭"
            @click="showSaleHistoryModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>
        <div class="overflow-y-auto flex-1 min-h-0 p-4 space-y-3">
          <div
            v-for="pipe in sortedAllLibraryPipes"
            :key="pipe.pipe_id"
            class="rounded-xl border border-gray-100 dark:border-gray-700 bg-gradient-to-r from-white to-gray-50/60 dark:from-gray-900/40 dark:to-gray-800/40 shadow-sm overflow-hidden"
          >
            <div class="px-2 py-3 flex items-center justify-between border-b border-gray-50 dark:border-gray-700/60">
              <div class="flex items-center gap-2">
                <QhxTag :active="true" :backgroundColor="getStateColor(pipe.state || 0)">
                  <span class="text-xs">{{ formateState(pipe.state || 0) }}</span>
                </QhxTag>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ dayjs(pipe.start_time).format('YY-MM-DD') }} - {{ dayjs(pipe.end_time).format('YY-MM-DD') }}
                </span>
              </div>
            </div>
            <div class="px-4 py-3 flex gap-3 items-start">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-[36px] h-[36px] rounded-[50%] flex-shrink-0">
                    <QhxPreviewImage
                      v-if="pipe.library?.cover"
                      :list="[{ src: pipe.library.cover + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: pipe.library.name }]"
                      :preview="[pipe.library.cover]"
                      :className="'w-[36px] h-[36px] rounded-xl object-cover shadow-sm border border-gray-200 cursor-pointer'"
                    />
                  </div>
                  <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {{ pipe.library?.name || library?.name }}
                  </span>
                </div>
                <p v-if="pipe.note" class="text-xs p-2 text-gray-600 dark:text-gray-400 line-clamp-2">
                  备注：{{ pipe.note }}
                </p>
                <div v-if="pipe.library_list && pipe.library_list.length > 0" class="mt-2">
                  <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">包含版型</div>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="child in pipe.library_list"
                      :key="child.library_id"
                      class="flex items-center gap-2 rounded-full px-2 py-1 shadow-sm border border-gray-100 dark:border-gray-700"
                      :class="child.library_id === Number.parseInt(id) ? 'bg-qhx-primary text-qhx-inverted' : 'bg-white/80 dark:bg-gray-800/80'"
                    >
                      <div class="w-[24px] h-[24px] rounded-full overflow-hidden flex-shrink-0">
                        <QhxPreviewImage
                          v-if="child.cover"
                          :list="[{ src: child.cover + '?x-oss-process=image/quality,q_80/resize,w_200,h_200', alt: child.name }]"
                          :preview="[child.cover]"
                          :className="'w-[24px] h-[24px] rounded-full object-cover cursor-pointer'"
                        />
                      </div>
                      <span class="text-[11px]">
                        {{ child.library_type }}
                        <span v-if="child.library_pattern">· {{ child.library_pattern }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showBatchStateModal" :close-on-backdrop="false">
      <div class="w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="text-base font-semibold text-gray-800 dark:text-gray-100">批量修改状态</div>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状态 <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap items-center gap-2">
              <QhxTag v-if="batchStateValue" :active="true">{{ batchStateValue }}</QhxTag>
              <button
                type="button"
                class="px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                @click="openBatchStateSelect($event)"
              >
                {{ batchStateValue ? '重新选择' : '选择状态' }}
              </button>
            </div>
            <QhxSelect ref="batchStateSelectRef" :options="libraryStateQhxOptions" @select="onBatchStateSelect" />
          </div>
          <div v-if="batchStateValue === '预约中' || batchStateValue === '尾款中'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ batchStateValue === '预约中' ? '预约时间' : '尾款时间' }} <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QhxDateTimePicker
                v-model="batchStateStartDate"
                placeholder="开始日期"
                :enable-time-picker="false"
                format="YYYY-MM-DD"
              />
              <QhxDateTimePicker
                v-model="batchStateEndDate"
                placeholder="结束日期"
                :enable-time-picker="false"
                format="YYYY-MM-DD"
              />
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            @click="showBatchStateModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
            :disabled="batchStateSaving"
            @click="confirmBatchStateUpdate"
          >
            {{ batchStateSaving ? '提交中…' : '确定' }}
          </button>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showBatchPatternModal" :close-on-backdrop="false">
      <div class="w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="text-base font-semibold text-gray-800 dark:text-gray-100">批量修改柄图元素</div>
        </div>
        <div class="p-4 space-y-4">
          <div class="flex items-center m-1 flex-wrap gap-1" v-if="selectedPatternElements.length > 0">
            <QhxTag v-for="(item, index) in selectedPatternElements" :key="`${item.wiki_id}-${index}`">
              {{ item.wiki_name }}
              <UIcon
                name="ant-design:close-outlined"
                class="ml-1 text-sm cursor-pointer"
                @click="selectedPatternElements.splice(index, 1)"
              />
            </QhxTag>
          </div>
          <div class="flex gap-2 flex-wrap">
            <UButton color="primary" size="sm" @click="showBatchPatternChooseWiki">选择柄图元素</UButton>
            <customInput ref="batchPatternElementsCustomInputRef" @insert="insertBatchPatternCustomTag" />
            <UButton color="primary" size="sm" @click="(e: MouseEvent) => openBatchPatternElementsCustomInput(e)">
              添加自定义标签
            </UButton>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            @click="showBatchPatternModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
            :disabled="batchPatternSaving"
            @click="confirmBatchPatternUpdate"
          >
            {{ batchPatternSaving ? '提交中…' : '确定' }}
          </button>
        </div>
      </div>
    </QhxModal>

    <QhxModal v-model="showBatchSaleTimeModal" :close-on-backdrop="false">
      <div class="w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="text-base font-semibold text-gray-800 dark:text-gray-100">批量修改初贩时间</div>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">初贩时间 <span class="text-red-500">*</span></label>
            <QhxDateTimePicker
              v-model="batchSaleTimeValue"
              placeholder="选择贩售年月"
              mode="yearmonth"
              format="YYYY-MM-DD"
              :enable-time-picker="false"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            @click="showBatchSaleTimeModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
            :disabled="batchSaleTimeSaving"
            @click="confirmBatchSaleTimeUpdate"
          >
            {{ batchSaleTimeSaving ? '提交中…' : '确定' }}
          </button>
        </div>
      </div>
    </QhxModal>

    <QhxModal
      v-model="showDeleteSenceForeignConfirm"
      :close-on-backdrop="!deleteSenceForeignLoading"
    >
      <div class="w-[min(calc(100vw-2rem),360px)] rounded-[12px] bg-white p-4 shadow-lg dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          确认移除投稿
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          将把「{{ deleteSenceForeignTarget?.sence?.sence_desc || '未命名场景' }}」从本图鉴关联场景中移除，场景本身不会被删除。是否继续？
        </p>
        <div class="mt-4 flex flex-col gap-2 sm:flex-row">
          <UButton
            variant="outline"
            color="gray"
            class="w-full min-w-0 justify-center sm:flex-1"
            :disabled="deleteSenceForeignLoading"
            @click="showDeleteSenceForeignConfirm = false"
          >
            取消
          </UButton>
          <UButton
            color="red"
            class="w-full min-w-0 justify-center sm:flex-1"
            :loading="deleteSenceForeignLoading"
            :disabled="deleteSenceForeignLoading"
            @click="confirmDeleteSenceForeign"
          >
            确认删除
          </UButton>
        </div>
      </div>
    </QhxModal>

    <QhxModal
      v-model="showCloneSceneConfirm"
      :close-on-backdrop="!cloneSceneLoading"
    >
      <div class="w-[min(calc(100vw-2rem),360px)] rounded-[12px] bg-white p-4 shadow-lg dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          确认克隆场景
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          将把「{{ cloneTargetSceneName }}」完整复制到你的账号下，并进入编辑模式。是否继续？
        </p>
        <div class="mt-4 flex flex-col gap-2 sm:flex-row">
          <UButton
            variant="outline"
            color="gray"
            class="w-full min-w-0 justify-center sm:flex-1"
            :disabled="cloneSceneLoading"
            @click="showCloneSceneConfirm = false"
          >
            取消
          </UButton>
          <UButton
            class="w-full min-w-0 justify-center bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover sm:flex-1"
            :loading="cloneSceneLoading"
            :disabled="cloneSceneLoading"
            @click="confirmCloneSenceForeign"
          >
            确认克隆
          </UButton>
        </div>
      </div>
    </QhxModal>
    <ClientOnly>
      <WikiOptionsChoose ref="batchPatternWikiOptionsChooseRef" @choose="onBatchPatternWikiChoose" />
      <MatchingAddEdit ref="matchingAddEditRef" @success="onMatchingAddSuccess" />
    </ClientOnly>
    <!-- 物理掉落组件 -->
    <!-- <ClientOnly>
      <PhysicsDrop 
        v-if="isPhysicsDropVisible && physicsDropModels.length > 0"
        :models="physicsDropModels"
        @object-click="handleObjectClick"
      />
    </ClientOnly> -->
    
    <!-- 悬浮开关按钮 -->
    <!-- <div class="fixed bottom-8 left-8 z-50 pointer-events-none" v-if="library && physicsDropModels.length > 0">
      <button
        @click="togglePhysicsDrop"
        class="pointer-events-auto bg-gray-900/80 dark:bg-white/80 backdrop-blur-md text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <UIcon
          :name="isPhysicsDropVisible ? 'weui:eyes-on-filled' : 'weui:eyes-off-filled'"
          class="text-[16px] group-hover:rotate-12 transition-transform"
        />
        <span class="text-sm font-semibold">{{ isPhysicsDropVisible ? '关闭掉落' : '开启掉落' }}</span>
      </button>
    </div> -->
    </div>
  </div>
</template>

<style scoped>
.library-child-expand-enter-active,
.library-child-expand-leave-active {
  overflow: hidden;
  transition:
    max-height 0.3s ease-in-out,
    opacity 0.3s ease-in-out;
}

.library-child-expand-enter-from,
.library-child-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.library-child-expand-enter-to,
.library-child-expand-leave-from {
  max-height: 1200px;
  opacity: 1;
}

/* 缩略图 1:1，避免手机端网格内因原图尺寸导致高度不齐 */
.library-thumb-grid :deep(img),
.library-child-below-grid :deep(img) {
  aspect-ratio: 1 / 1;
  object-fit: cover;
  object-position: center;
}

.library-fab-stack {
  transform-origin: top right;
}

.library-fab-actions-panel {
  pointer-events: none;
}

.library-fab-btn {
  pointer-events: auto;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 2px solid color-mix(in srgb, var(--primary-color, #ff9eb5) 55%, transparent);
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 5%, #fff);
  color: var(--primary-color, #ff9eb5);
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.07em;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 2px 8px rgba(0, 0, 0, 0.06);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.16s ease;
}

.library-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 9%, #fff);
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 68%, transparent);
}

.library-fab-btn:active {
  transform: scale(0.97);
}

.dark .library-fab-btn {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 10%, rgba(17, 24, 39, 0.72));
  border-color: color-mix(in srgb, var(--primary-color, #ff9eb5) 58%, rgba(255, 255, 255, 0.12));
  color: color-mix(in srgb, var(--primary-color, #ff9eb5) 78%, #fce7f3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 10px rgba(0, 0, 0, 0.28);
}

.dark .library-fab-btn:hover {
  background: color-mix(in srgb, var(--primary-color, #ff9eb5) 16%, rgba(17, 24, 39, 0.78));
}

.library-fab-btn--toggle {
  padding: 0.22rem 0.38rem;
}

.library-fab-btn--action {
  padding: 0.24rem 0.48rem 0.24rem 0.42rem;
}

.library-fab-btn__inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.library-fab-btn__icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.library-fab-btn__label {
  line-height: 1.2;
}

.library-fab-badge {
  position: absolute;
  top: -0.45rem;
  right: -0.55rem;
  z-index: 10;
  display: flex;
  min-height: 1rem;
  min-width: 1rem;
  align-items: center;
  justify-content: center;
  padding: 0 0.2rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: #ef4444;
  color: #fff;
  font-family: ui-serif, Georgia, 'Times New Roman', 'Songti SC', 'STSong', serif;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.library-fab-badge--corner {
  top: -0.45rem;
  right: -0.55rem;
}

.library-fab-panel-enter-active,
.library-fab-panel-leave-active {
  transition:
    opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  transform-origin: top right;
}

.library-fab-panel-enter-from,
.library-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.94);
  max-height: 0;
}

.library-fab-panel-enter-to,
.library-fab-panel-leave-from {
  max-height: 7rem;
}

.library-fab-panel-enter-active .library-fab-btn--action {
  transition:
    opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.library-fab-panel-leave-active .library-fab-btn--action {
  transition:
    opacity 0.18s ease,
    transform 0.2s ease;
}

.library-fab-panel-enter-from .library-fab-btn--action,
.library-fab-panel-leave-to .library-fab-btn--action {
  opacity: 0;
  transform: translateY(-6px);
}

.library-fab-panel-enter-active .library-fab-btn--action:nth-child(1) {
  transition-delay: 0.04s;
}

.library-fab-panel-enter-active .library-fab-btn--action:nth-child(2) {
  transition-delay: 0.08s;
}

.library-fab-panel-enter-active .library-fab-btn--action:nth-child(3) {
  transition-delay: 0.12s;
}

.library-fab-panel-leave-active .library-fab-btn--action:nth-child(3) {
  transition-delay: 0s;
}

.library-fab-panel-leave-active .library-fab-btn--action:nth-child(2) {
  transition-delay: 0.04s;
}

.library-fab-panel-leave-active .library-fab-btn--action:nth-child(1) {
  transition-delay: 0.08s;
}

.library-fab-toggle-icon {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.library-fab-toggle-icon--expanded {
  transform: rotate(180deg);
}

@media (max-width: 767px) {
  .library-thumb-grid :deep(img),
  .library-child-below-grid :deep(img) {
    display: block;
    width: 100%;
    height: auto;
  }
}

.matching-season-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  border-radius: 9999px;
  backdrop-filter: blur(4px);
}

.matching-season-badge--single {
  padding: 2px 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.matching-season-badge--multi {
  padding: 1px 4px;
  font-size: 9px;
}

.matching-season-badge--spring {
  background: rgba(236, 253, 245, 0.92);
  color: #047857;
}

.matching-season-badge--summer {
  background: rgba(254, 243, 199, 0.92);
  color: #b45309;
}

.matching-season-badge--autumn {
  background: rgba(255, 237, 213, 0.92);
  color: #c2410c;
}

.matching-season-badge--winter {
  background: rgba(239, 246, 255, 0.92);
  color: #1d4ed8;
}

.matching-season-badge--default {
  background: rgba(255, 255, 255, 0.88);
  color: #6b7280;
}

</style>
