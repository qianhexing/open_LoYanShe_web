<script setup lang="ts">
import type { Library, LibrarySimilarItem, PaginationResponse, Shop, LibraryVideo, LibraryPipe, Community, User, Compilations, SenceForeign, Comment } from '@/types/api';
import { getLibraryDetail, getLibraryList, getLibraryVideo, getLibraryPipeListAll, getLibrarySimilar, updateStateMultiple, updatePatternElementsMultiple } from '@/api/library'
import html2canvas from 'html2canvas';
import QhxTag from '~/components/Qhx/Tag.vue';
import type { image } from 'html2canvas/dist/types/css/types/image';
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import { librarySeedFromTypeColorChoose, type LibraryTypeColorChooseResult } from '@/utils/libraryClothesSeed'
import { getWardrobeListOptions } from '@/api/wardrobe'
import { useToast } from '#imports'
import type { Wiki } from '@/types/api'
import dayjs from 'dayjs'
import PhysicsDrop from '@/components/PhysicsDrop.client.vue'
import { getWikiDetail, type WikiDetailParams } from '@/api/wiki'
import { insertCompDetail } from '@/api/compilations'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type CompilationsChoose from '@/components/compilations/CompilationsChoose.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import SPZModelViewer from '@/components/ModelViewer/SPZModelViewer.vue'
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
import { isHtml5PlusWebview, openLibraryWebPath, openLibraryDetailTab, libraryDetailPageHref } from '@/composables/useLibraryDetailNavigation'
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
const { data } = await useAsyncData('libraryDeatil', () => {
  return getLibraryDetail({ library_id: Number.parseInt(id) })
}, {})
const library = ref<Library | null>(null)
const libraryRef = ref(null)
const shop = ref<Shop | null>(null)
const uploadUser = ref<User | null>(null)
const style_list = ref<Wiki[]>([])
const parent = ref<Library | null>(null)
const child_list = ref<Library[]>([])
const library_video = ref<LibraryVideo[]>([])
const library_pipe = ref<LibraryPipe[]>([])
const spzModelViewerRef = ref<{ showModel: (models: Array<{ url: string; type?: 'splat' | 'model'; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; options?: Record<string, unknown> }>) => Promise<void> } | null>(null)
library.value = data.value?.library ?? null
style_list.value = data.value?.style_list ?? []
parent.value = data.value?.parent ?? null
shop.value = data.value?.shop ?? null
uploadUser.value = data.value?.upload_user ?? null

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

const librarySkuCoverSrc = (cover: string | undefined) => {
  if (!cover?.trim()) return ''
  const trimmed = cover.trim()
  const pathOnly = trimmed.split('?')[0]
  if (/^https?:\/\//i.test(pathOnly) || pathOnly.startsWith('//')) {
    return `${pathOnly}?x-oss-process=image/quality,q_80/resize,w_300,h_300`
  }
  const relative = pathOnly.replace(BASE_IMG, '').replace(/^\//, '')
  return `${BASE_IMG}${relative}?x-oss-process=image/quality,q_80/resize,w_300,h_300`
}

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

/** 地址栏 `?comment_id=`：定位该条主楼评论 */
const focusCommentId = computed(() => {
  const raw = route.query.comment_id
  if (raw == null) return undefined
  const s = Array.isArray(raw) ? raw[0] : raw
  const n = Number.parseInt(String(s), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

const { data: commentCountData, refresh: refreshCommentCount } = await useAsyncData(
  `library-detail-comment-count-${id}`,
  () => getCommentList({ type: 'library', id: Number.parseInt(id, 10), page: 1, pageSize: 1 })
)

const commentTotal = computed(() => commentCountData.value?.count ?? 0)

const libraryDetailTabCounts = computed(() => [
  libraryReturnTabCount.value,
  library_pipe.value.length > 0 ? library_pipe.value.length : undefined,
  libraryEventTabCount.value,
  libraryCommentTabCount.value ?? commentTotal.value,
])

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
    const [foreignRes, eventRes] = await Promise.all([
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
      })
    ])
    libraryReturnTabCount.value = foreignRes.count ?? 0
    libraryEventTabCount.value = eventRes.count ?? 0
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
if (library.value && library.value?.library_type === '系列') {
  const { data } = await useAsyncData('librarys', () => {
    return getLibraryList({
      filter_list: [{
        field: 'parent_id',
        op: 'and',
        value: id
      }],
      page: 1,
      pageSize: 999
    })
  }, {})
  child_list.value = data.value?.rows ?? []
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
      return '#ec4899' // 粉色
    default:
      return '#6b7280' // 灰色（未知状态）
  }
}
const fetchLibraryVideo = () => {
  const params = {
    pk_id: Number.parseInt(id)
  }
  getLibraryVideo(params)
    .then((res) => {
      library_video.value = res
    })
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

  if (isHtml5PlusWebview() && typeof uni !== 'undefined' && uni?.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?fullScreen=true&url=${fullUrl}`,
      fail: () => {
        console.log('跳转人台图失败')
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
        params: { url: fullUrl }
      })
    )
    return
  }

  navigateTo(path)
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
const fetchLibraryPipe = () => {
  let pk_id = Number.parseInt(id)
  if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
    pk_id = library.value?.parent_id as number
  }
  getLibraryPipeListAll({
    pk_id: pk_id,
    // end_time: dayjs().format('YYYY-MM-DD'),
    pk_type: 0
  }).then((res) => {
    if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
      library_pipe.value = res.filter((item) => { return item.library_list?.some((child) => child.library_id === Number.parseInt(id)) })
    } else {
      library_pipe.value = res
    }
  })
}
const similarRows = ref<LibrarySimilarItem[]>([])
const similarLoading = ref(false)

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

  if (isHtml5PlusWebview() && typeof uni !== 'undefined' && uni?.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?fullScreen=true&url=${fullUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
    return
  }

  if (port.value) {
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: { url: fullUrl }
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
      const detail = await getLibraryDetail({ library_id: Number.parseInt(id) })
      library.value = detail.library ?? null
      style_list.value = detail.style_list ?? []
      parent.value = detail.parent ?? null
      shop.value = detail.shop ?? null
      uploadUser.value = detail.upload_user ?? null
    } catch {
      // SSR 或首次 useAsyncData 异常时客户端补拉失败则保持空状态
    }
  }
  fetchLibraryVideo()
  fetchLibraryPipe()
  void prefetchLibraryTabCounts()
  const lid = routeLibraryId.value
  if (lid != null) {
    void fetchSimilarLibraries(lid)
    void fetchSenceForeignList(true)
  }
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
    return
  }
  void fetchSimilarLibraries(lid)
  void fetchSenceForeignList(true)
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
let uni: { navigateTo?: (options: { url: string; fail?: () => void }) => void } | undefined
onMounted(async () => {
  try {
    // @ts-ignore
    uni = await import('@dcloudio/uni-webview-js')
  } catch (err) {
    console.error('Failed to load uni-webview-js:', err)
    uni = undefined
  }
})
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
    
    if (isInUniApp && uni && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/lolitaWiki/detail/${wikiId}`,
        fail: () => {
          console.log('跳转错误')
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
const { captureElement: capture } = useScreenshot()
const captureScreen = async () => {
  if (libraryRef.value) {
    try {
      capture(libraryRef.value, 'my-screenshot.png')
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  }
};
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
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const clothesAddRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
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

onMounted(() => {
  if (library.value) {
    console.log(library.value.wardrobe_count,'初始化时检查状态')
    
    wardrobeCount.value = library.value.wardrobe_count || 0
    checkWardrobeStatus()
  }
})
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
const canManagePipeline = computed(
  () => canUpdateLibrary.value && library.value?.parent_id === 0
)

const compilationsChooseRef = ref<InstanceType<typeof CompilationsChoose> | null>(null)
const libraryChooseForStateRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const libraryChooseForPatternRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
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

const showLibraryStateChoose = (e?: MouseEvent) => {
  libraryChooseForStateRef.value?.showModel(e)
}

const onLibraryStateChoose = (items: Library[]) => {
  const ids = [
    ...items.map((item) => item.library_id),
    library.value?.library_id
  ].filter((id): id is number => id != null)
  if (!ids.length) return
  batchStateIds.value = ids.join(',')
  batchStateValue.value = undefined
  batchStateStartDate.value = null
  batchStateEndDate.value = null
  showBatchStateModal.value = true
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
const selectedPatternElements = ref<string[]>([])
const patternElementInput = ref('')
const batchPatternSaving = ref(false)

const showPatternElementsChoose = (e?: MouseEvent) => {
  libraryChooseForPatternRef.value?.showModel(e)
}

const onLibraryPatternChoose = (items: Library[]) => {
  const ids = [
    ...items.map((item) => item.library_id),
    library.value?.library_id
  ].filter((id): id is number => id != null)
  if (!ids.length) return
  batchPatternIds.value = ids.join(',')
  const current = library.value?.pattern_elements
  selectedPatternElements.value = current
    ? String(current).split(',').map((s) => s.trim()).filter(Boolean)
    : []
  patternElementInput.value = ''
  showBatchPatternModal.value = true
}

const addPatternElement = async () => {
  const val = patternElementInput.value.trim()
  if (!val || selectedPatternElements.value.includes(val)) return
  selectedPatternElements.value.push(val)
  patternElementInput.value = ''
}

const removePatternElement = (index: number) => {
  selectedPatternElements.value.splice(index, 1)
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
      pattern_elements: selectedPatternElements.value.join(',')
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

/** 图鉴缩略图：手机端三列等宽网格，桌面端保持原 flex + 固定尺寸 */
const libraryThumbGridClass =
  'library-thumb-grid flex flex-wrap my-2 max-md:grid max-md:grid-cols-3 max-md:gap-2'
const libraryThumbImgClass =
  'cursor-pointer ml-3 w-[100px] h-[100px] aspect-square object-cover object-center rounded-[10px] shadow-lg border border-gray-200 max-md:ml-0 max-md:w-full'
const libraryVideoGridClass =
  'library-thumb-grid flex flex-wrap pb-3 max-md:grid max-md:grid-cols-3 max-md:gap-2'
const libraryVideoItemClass = 'w-[100px] mr-3 mb-2 max-md:w-full max-md:mr-0'
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
    <div v-if="library" ref="libraryRef" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="library.library_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full relative">
          <div
            class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]"
            :class="child_list.length > 0 || parent ? 'ml-3' : ''">
            {{ library.library_type }}</div>
          <QhxPreviewImage :key="library.library_id" :list="[{ src: library.cover, alt: library.name }]" :className="child_list.length > 0 || parent ? 'cursor-pointer ml-3 w-[300px] max-md:w-0 max-md:flex-1 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'
            : 'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
          <!-- <img :src="`${BASE_IMG}${library.cover}`" :alt="library.name"
            class=" h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200"
            :class="child_list.length > 0 || parent ? 'ml-3 w-[300px] max-md:w-0 max-md:flex-1' : 'w-full ml-0'"
            loading="lazy" /> -->
          <div class="w-[110px] h-[430px] overflow-y-auto overflow-x-hidden library-list-wrap ml-3"
            v-if="child_list.length > 0 || parent">
            <div class="w-[100px]" v-if="child_list && child_list.length > 0">
              <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in child_list" :key="item.library_id"
                class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
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
              @click="showLibraryStateChoose($event)"
              :active="true"
              color="blue"
            >
              批量修改状态
            </QhxTag>
            <QhxTag
              v-if="isSeriesWithChildren && canUpdateLibrary"
              class="cursor-pointer"
              @click="showPatternElementsChoose($event)"
              :active="true"
              color="blue"
            >
              批量修改柄图
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
                  <img
                    v-if="item.cover"
                    :src="librarySkuCoverSrc(item.cover)"
                    :alt="item.library_pattern"
                    class="block w-full h-full object-cover"
                    loading="lazy"
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
          <div v-else-if="library.library_price" class="text-qhx-primary m-2 font-semibold">
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
            <!-- <div class=" flex-1 text-center">
              <UIcon :name="'i-heroicons-heart-20-solid'" class=" text-[26px] text-[#409EFF] cursor-pointer" @click="captureScreen()"/>
            </div> -->
          </div>
        </div>
      </div>
      <div v-if="library?.detail_image" :class="libraryThumbGridClass">
        <QhxPreviewImage
          :list="library.detail_image.split(',').map((image) => { return { src: image + '?x-oss-process=image/quality,q_80/resize,w_300,h_300' } })"
          :preview="library.detail_image.split(',')"
          :className="libraryThumbImgClass">
        </QhxPreviewImage>
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
    <div v-if="library && (similarLoading || similarRows.length > 0)" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3 p-3 max-md:p-2">
      <h2 class="mb-3 text-lg font-semibold">相似推荐</h2>
      <div v-if="similarLoading" class="text-sm text-gray-500 py-4 text-center">加载中…</div>
      <div v-else class="flex gap-3 overflow-x-auto pb-1">
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
                :preview="item.cover ? [item.cover] : (item.addr ? item.addr.split(',').map((image) => ({ src: image, title: item.title })) : [])"
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
    <SPZModelViewer ref="spzModelViewerRef" />
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs
        sticky
        panel-min-height="min(50vh, 480px)"
        :tabs="['返图', '贩售历史', '大事记', '评论']"
        :tab-counts="libraryDetailTabCounts"
      >
        <QhxTabPanel :index="0">
          <template #default="{ isActive }">
            <div class="bg-white dark:bg-gray-900">
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
                  v-if="isActive && library"
                  :key="libraryForeignRefreshKey"
                  :pk_type="LIBRARY_RETURN_GRAPH_PK_TYPE"
                  :pk_id="library.library_id"
                  allow-delete-foreign
                  :can_load="isActive"
                  @count-change="libraryReturnTabCount = $event"
                />
                <template #fallback>
                  <div class="text-center text-gray-500 py-8">加载中…</div>
                </template>
              </ClientOnly>
            </div>
          </template>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <div class="bg-white" v-if="isActive">
              <div v-if="library_pipe.length > 0" class="p-4 space-y-3">
                <h3 class="text-base font-semibold mb-1">图鉴状态流</h3>
                <div
                  v-for="pipe in library_pipe"
                  :key="pipe.pipe_id"
                  class="rounded-xl border border-gray-100 bg-gradient-to-r from-white to-gray-50/60 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div class="px-2 py-3 flex items-center justify-between border-b border-gray-50">
                    <div class="flex items-center gap-2">
                      <QhxTag :active="true" :backgroundColor="getStateColor(pipe.state || 0)">
                        <span class="text-xs">{{ formateState(pipe.state || 0) }}</span>
                      </QhxTag>
                      <span class="text-xs text-gray-500">
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
                        <span class="text-sm font-medium text-gray-800 truncate">
                          {{ pipe.library?.name || library.name }}
                        </span>
                      </div>
                      <p v-if="pipe.note" class="text-xs p-2 text-gray-600 line-clamp-2">
                        备注：{{ pipe.note }}
                      </p>
                      <div
                        v-if="pipe.library_list && pipe.library_list.length > 0"
                        class="mt-2"
                      >
                        <div class="text-xs font-medium text-gray-700 mb-1">
                          包含版型
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <div
                            v-for="child in pipe.library_list"
                            :key="child.library_id"
                            class="flex items-center gap-2  rounded-full px-2 py-1 shadow-sm border border-gray-100"
                            :class="child.library_id === Number.parseInt(id) ? 'bg-qhx-primary text-qhx-inverted' : 'bg-white/80'"
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
              <div v-else class="p-6 text-center text-gray-500 text-sm">
                暂无状态流
              </div>
            </div>
          </template>
        </QhxTabPanel>
        <QhxTabPanel :index="2">
          <template #default="{ isActive }">
            <EventRedblack
              v-if="isActive && library"
              :pk_id="library.library_id"
              :pk_type="2"
              :can_load="isActive"
              @load="libraryEventTabCount = $event"
            />
          </template>
        </QhxTabPanel>
        <QhxTabPanel :index="3">
          <template #default="{ isActive }">
            <div v-if="isActive && library" class="bg-white dark:bg-gray-900">
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
                <div class="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                  共 {{ commentTotal }} 条评论
                </div>
              </div>
              <CommentSection
                :key="commentSectionKey"
                :type="'library'"
                :id="library.library_id"
                :focus-comment-id="focusCommentId"
                @open-reply="openReplyComposer"
                @total="onCommentTotalChange"
              />
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    
    <!-- 加入衣柜相关组件 -->
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
      ref="libraryChooseForStateRef"
      :multiple="true"
      :need-parent="false"
      :filter_list="library?.library_id ? [{ field: 'parent_id', op: 'and', value: library.library_id }] : []"
      @choose="onLibraryStateChoose"
    />
    <LibraryChoose
      ref="libraryChooseForPatternRef"
      :multiple="true"
      :need-parent="false"
      :filter_list="library?.library_id ? [{ field: 'parent_id', op: 'and', value: library.library_id }] : []"
      @choose="onLibraryPatternChoose"
    />

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
          <div class="flex flex-wrap gap-2">
            <QhxTag
              v-for="(item, index) in selectedPatternElements"
              :key="`${item}-${index}`"
              :active="true"
              class="cursor-pointer"
              @click="removePatternElement(index)"
            >
              {{ item }} ×
            </QhxTag>
          </div>
          <div class="flex gap-2">
            <input
              v-model="patternElementInput"
              type="text"
              placeholder="输入柄图元素"
              class="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-qhx-primary/40"
              @keyup.enter="addPatternElement"
            />
            <button
              type="button"
              class="shrink-0 px-3 py-2 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
              @click="addPatternElement"
            >
              添加
            </button>
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
.library-list-wrap::-webkit-scrollbar {
  width: 6px;
  /* 垂直滚动条宽度 */
}

/* 滚动条轨道 */
.library-list-wrap::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
}

/* 滚动条滑块 */
.library-list-wrap::-webkit-scrollbar-thumb {
  background: #bbbbbb;
  border-radius: 10px;
}

/* 滚动条滑块悬停状态 */
.library-list-wrap::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

/* 缩略图 1:1，避免手机端网格内因原图尺寸导致高度不齐 */
.library-thumb-grid :deep(img) {
  aspect-ratio: 1 / 1;
  object-fit: cover;
  object-position: center;
}

@media (max-width: 767px) {
  .library-thumb-grid :deep(img) {
    display: block;
    width: 100%;
    height: auto;
  }
}

</style>
