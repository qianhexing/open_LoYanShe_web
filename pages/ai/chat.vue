<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import AiChatRichComposer from '@/components/Qhx/AiChatRichComposer.vue'
import { streamAiIntentAnalysis } from '@/api/aiAssistant'
import { getLibraryList, getLibrarySimilar } from '@/api/library'
import type { AiIntentAnalysisResult } from '@/types/aiAssistant'
import {
  AI_INTENT_LIBRARY_PREVIEW_MAX,
  runAiIntentHandlers
} from '@/utils/aiIntentDispatch'
import { BASE_IMG } from '@/utils/ipConfig'
import type { Library, PlanList, Shop, WardrobeClothes } from '@/types/api'
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue'
import type PlanAddEdit from '@/components/Plan/PlanAddEdit.vue'
import { getUserMy } from '@/api/user'
import { useUserStore } from '@/stores/user'
import type { ChatMessage } from '@/types/aiChat'

/** 相似推荐第二步：仅展示前 N 条 */
const AI_SIMILAR_SHOW_MAX = 5

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const configStore = useConfigStore()
/** 鸿蒙等原生容器桥接（与 `visualization/wardrobe.vue` 一致） */
const port = computed(() => configStore.getPort())
const toast = useToast()

/** UniApp WebView：`@dcloudio/uni-webview-js`（与衣柜可视化页异步加载方式一致） */
// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any

/** ClothesAdd.vue `defineExpose`：用于 AI 对话里打开「新增服饰」 */
type AiChatClothesAddExpose = {
  showModel: (
    item:
      | null
      | (Partial<WardrobeClothes> & {
        library?: Library
        origin_shop?: Shop
      }),
    isCopy?: boolean,
    event?: MouseEvent
  ) => Promise<void>
}

const clothesAddRef = ref<AiChatClothesAddExpose | null>(null)
const openingCustomClothes = ref(false)

const { copyCurrentUrl } = useCopyCurrentUrl()

const avatarUrl = computed(() => {
  const face = user.value?.user_face
  if (!face) return ''
  return /^https?:\/\//i.test(face) ? face : `${BASE_IMG}${face}`
})

const displayUserName = computed(() => user.value?.user_name?.trim() || '未登录')
const displayExp = computed(() =>
  user.value?.exp !== undefined && user.value?.exp !== null
    ? String(user.value.exp)
    : '—'
)
const displayStarCoin = computed(() =>
  user.value?.star_coin !== undefined && user.value?.star_coin !== null
    ? String(user.value.star_coin)
    : '—'
)

/** 与 userSpace 升级菜单一致：access_level >= 1 为正式居民 */
const isAiChatFormalResident = computed(
  () => (user.value?.access_level ?? 0) >= 1
)

async function onCopyAiChatShareLink() {
  try {
    const result = await copyCurrentUrl()
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
        description: result?.message ?? '请手动复制链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch (e) {
    console.error('复制链接失败:', e)
    toast.add({
      title: '复制失败',
      description: e instanceof Error ? e.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

/** 与富文本编辑器 outbound 同步（用于发送按钮可用态等） */
const composerPlainDraft = ref('')
const sending = ref(false)
/** 正在请求相似推荐的 (消息 id, 图鉴 id) */
const pickingSimilarPair = ref<{ messageId: string; libraryId: number } | null>(
  null
)
const messages = ref<ChatMessage[]>([])
/** 消息列表可滚动容器（直接设 scrollTop，避免 smooth 长时间跟滚） */
const messagesScrollEl = ref<HTMLElement | null>(null)
/** 与快捷栏一致：此前缀触发本地图鉴 keyword 查询，不走意图接口 */
const LIBRARY_QUICK_LOOKUP_PREFIX = '查裙子:' as const

/** 输入栏上方快捷句式：点击后写入输入框并聚焦 */
const COMPOSER_QUICK_ACTIONS: ReadonlyArray<{ label: string; text: string }> = [
  { label: '加衣柜', text: '加衣柜:' },
  { label: '相似推荐', text: '相似推荐:' },
  { label: '查裙子', text: LIBRARY_QUICK_LOOKUP_PREFIX },
]

type AiChatComposerExpose = {
  replaceAndFocus: (text: string) => void
  clear: () => void
  getOutboundPlain: () => string
}

const composerRef = ref<AiChatComposerExpose | null>(null)
const showLoginModal = ref(false)

/** 与用户中心、衣柜页等一致：有可解析的 user_id 即视为已登录 */
function isChatUserLoggedIn(): boolean {
  const uid = user.value?.user_id
  return !(uid == null || !Number.isFinite(Number(uid)))
}

function openLoginModal() {
  showLoginModal.value = true
}

/**
 * 「分享社本页设为首页」约定：`message_config.home_page` **仅在为 `1` 时表示开启**。
 * `0`、`2`、未定义或其它任意数字均视为关闭。
 * - 写入「关」时需显式设为 `SHARE_CLUB_HOME_PAGE_OFF`（0）。
 */
const SHARE_CLUB_AI_CHAT_HOME_PAGE = 1
const SHARE_CLUB_HOME_PAGE_OFF = 0

/** 是否与后端约定的「AI 会话页为首」取值一致（仅 `1`） */
function isAiChatShareClubHomeEnabled(homePage: unknown): boolean {
  if (typeof homePage === 'boolean') return false
  const n = Number(homePage)
  return Number.isFinite(n) && n === SHARE_CLUB_AI_CHAT_HOME_PAGE
}
const shareClubAsHomeToggle = ref(false)
const savingShareClubHome = ref(false)

function getMessageConfigBase(): Record<string, unknown> {
  const mc = user.value?.message_config
  if (!mc || typeof mc !== 'object') return {}
  return { ...(mc as Record<string, unknown>) }
}

function syncShareClubAsHomeToggleFromUser() {
  shareClubAsHomeToggle.value = isAiChatShareClubHomeEnabled(
    getMessageConfigBase().home_page
  )
}

watch(
  () => user.value?.message_config,
  () => {
    syncShareClubAsHomeToggleFromUser()
  },
  { immediate: true, deep: true }
)

async function handleShareClubAsHomeChange(value: boolean) {
  if (!isChatUserLoggedIn()) {
    shareClubAsHomeToggle.value = false
    openLoginModal()
    return
  }
  savingShareClubHome.value = true
  try {
    const raw = getMessageConfigBase()
    const merged: Record<string, unknown> = value
      ? { ...raw, home_page: SHARE_CLUB_AI_CHAT_HOME_PAGE }
      : { ...raw, home_page: SHARE_CLUB_HOME_PAGE_OFF }
    await userStore.updateUserInfo({
      message_config: merged
    })
    shareClubAsHomeToggle.value = value
    toast.add({
      title: value ? '已设为首页' : '已取消设为首页',
      icon: value ? 'i-heroicons-check-circle' : 'i-heroicons-information-circle',
      color: value ? 'green' : 'gray'
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '保存失败'
    shareClubAsHomeToggle.value = !value
    toast.add({
      title: '保存失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    savingShareClubHome.value = false
    syncShareClubAsHomeToggleFromUser()
  }
}

async function onAiChatLoginSuccess() {
  try {
    const userInfo = await getUserMy()
    if (userInfo?.user_id != null) {
      userStore.setUserInfo(userInfo)
    }
  } catch {
    /** login() 已写过 store 时可忽略 */
  }
}

function onComposerQuickAction(snippet: string) {
  console.log('onComposerQuickAction', snippet)
  if (!isAiChatFormalResident.value) {
    toast.add({
      title: '仅正式居民可用',
      description: '升级正式居民后即可使用 AI 对话发送',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    return
  }
  composerRef.value?.replaceAndFocus(snippet)
}

function onComposerOutboundPlainChange(v: string) {
  composerPlainDraft.value = v
}

function onComposerSubmit() {
  void onSend()
}

/**
 * 键盘与地址栏导致的「布局视口底部」与「可视视口底部」差值（px）。
 * 用于固定底栏粘在可视区域底边上方，而不是把整个页面高度缩成 vv.height（会整页被顶起）。
 */
const keyboardOverlapPx = ref(0)

/** 为 fixed 输入条预留的滚动区底部留白，避免最后几条消息被挡住 */
const messagesBottomPad = ref(104)

const composerDockEl = ref<HTMLElement | null>(null)
let composerDockResizeObserver: ResizeObserver | null = null

function updateKeyboardOverlap() {
  if (!import.meta.client) return
  const vv = window.visualViewport
  if (!vv) {
    keyboardOverlapPx.value = 0
    return
  }
  const overlap = window.innerHeight - vv.offsetTop - vv.height
  keyboardOverlapPx.value = Math.max(0, Math.round(overlap))
}

function updateMessagesBottomPad() {
  if (!import.meta.client) return
  const dock = composerDockEl.value
  if (!dock) return
  const h = dock.getBoundingClientRect().height
  messagesBottomPad.value = Math.ceil(h) + 12
}

/** 丢弃已过期的延迟同步（避免多次聚焦/失焦互相覆盖错误数值） */
let composerDockLayoutSyncGen = 0

/**
 * 键盘弹起/收起过程中 visualViewport 事件在部分机型上只触发一次或不触发，
 * 聚焦/失焦时主动按多帧、多时间点拉取 vv 与 dock 尺寸。
 */
function scheduleComposerDockLayoutSync() {
  if (!import.meta.client) return
  const gen = ++composerDockLayoutSyncGen
  const sync = () => {
    if (gen !== composerDockLayoutSyncGen) return
    updateKeyboardOverlap()
    updateMessagesBottomPad()
  }

  sync()
  void nextTick(sync)
  requestAnimationFrame(() => {
    requestAnimationFrame(sync)
  })
  window.setTimeout(sync, 50)
  window.setTimeout(sync, 150)
  window.setTimeout(sync, 320)
}

onMounted(async () => {
  // @ts-expect-error uni-webview-js 类型定义问题
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })

  updateKeyboardOverlap()
  window.visualViewport?.addEventListener('resize', updateKeyboardOverlap)
  window.visualViewport?.addEventListener('scroll', updateKeyboardOverlap)
  window.addEventListener('resize', updateKeyboardOverlap)

  nextTick(() => {
    updateMessagesBottomPad()
    const dock = composerDockEl.value
    if (dock && typeof ResizeObserver !== 'undefined') {
      composerDockResizeObserver = new ResizeObserver(() => {
        updateKeyboardOverlap()
        updateMessagesBottomPad()
      })
      composerDockResizeObserver.observe(dock)
    }
  })

  window.setTimeout(() => {
    if (!isChatUserLoggedIn()) openLoginModal()
  }, 500)
})

onBeforeUnmount(() => {
  composerDockLayoutSyncGen = Number.MAX_SAFE_INTEGER
  window.removeEventListener('resize', updateKeyboardOverlap)
  window.visualViewport?.removeEventListener('resize', updateKeyboardOverlap)
  window.visualViewport?.removeEventListener('scroll', updateKeyboardOverlap)
  composerDockResizeObserver?.disconnect()
  composerDockResizeObserver = null
})

const canSend = computed(
  () =>
    isAiChatFormalResident.value &&
    composerPlainDraft.value.trim().length > 0 &&
    !sending.value
)

function scrollMessagesToEnd() {
  if (!import.meta.client) return
  const el = messagesScrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

/** 对话更新后瞬间滚到最新消息（无平滑动画，并在布局稳定后再对齐一次） */
function scrollToBottom() {
  void nextTick(() => {
    scrollMessagesToEnd()
    requestAnimationFrame(() => {
      scrollMessagesToEnd()
      requestAnimationFrame(scrollMessagesToEnd)
    })
    window.setTimeout(scrollMessagesToEnd, 80)
    window.setTimeout(scrollMessagesToEnd, 280)
  })
}

async function onPickSimilarBase(messageId: string, lib: Library) {
  const lidRaw = lib.library_id
  if (lidRaw == null) return
  const lid = Number(lidRaw)
  if (!Number.isFinite(lid)) return

  const msg = messages.value.find((x) => x.id === messageId)
  if (!msg?.similarRecommendAwaitPick || msg.similarPickResolved) return

  pickingSimilarPair.value = { messageId, libraryId: lid }
  try {
    const data = await getLibrarySimilar({
      library_id: lid,
      pageSize: AI_SIMILAR_SHOW_MAX
    })
    const rows = (data.rows ?? []).filter((r) => r.library_id !== lid)
    msg.similarPickResolved = true
    messages.value.push({
      id: `a-sim-${Date.now()}`,
      role: 'assistant',
      intentHint:
        rows.length > 0
          ? `与「${lib.name ?? '该裙子'}」相似的图鉴（至多 ${AI_SIMILAR_SHOW_MAX} 条）：`
          : `暂未找到与「${lib.name ?? '该裙子'}」相似的其它图鉴。`,
      similarItems: rows.slice(0, AI_SIMILAR_SHOW_MAX)
    })
  } catch (e) {
    messages.value.push({
      id: `e-sim-${Date.now()}`,
      role: 'system',
      error: e instanceof Error ? e.message : '相似推荐加载失败'
    })
  } finally {
    pickingSimilarPair.value = null
    scrollToBottom()
  }
}

function formatAnalysis(a: AiIntentAnalysisResult): string {
  return JSON.stringify({ type: a.type, params: a.params }, null, 2)
}

/**
 * 与 ClothesAdd 内「选择图鉴」代入逻辑对齐：名称、封面、价格、店铺
 */
function librarySeedForClothesAdd(lib: Library): Partial<WardrobeClothes> & {
  library: Library
  origin_shop?: Shop
} {
  const seed: Partial<WardrobeClothes> & { library: Library; origin_shop?: Shop } = {
    library: lib,
    clothes_note: lib.name ?? '',
    clothes_img: lib.cover || undefined,
    price: lib.library_price ?? 0
  }
  if (lib.shop) {
    seed.origin_shop = lib.shop
  } else if (lib.shop_id) {
    seed.origin_shop = {
      shop_id: lib.shop_id,
      shop_name: `店铺 #${lib.shop_id}`,
      shop_logo: '',
      shop_country: 0
    }
  }
  return seed
}

/** 加衣柜：图鉴 / 共享卡片 → 打开「新增服饰」并代入（衣柜选择在 ClothesAdd 表单内操作） */
async function onJoinWardrobeIntentClick(
  source: 'library' | 'shared',
  item: Library | WardrobeClothes,
  event?: MouseEvent
) {
  if (!isChatUserLoggedIn()) {
    toast.add({
      title: '请先登录',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    openLoginModal()
    return
  }
  if (openingCustomClothes.value) return
  openingCustomClothes.value = true
  try {
    if (source === 'library') {
      const payload = librarySeedForClothesAdd(item as Library)
      await clothesAddRef.value?.showModel(payload, false, event)
    } else {
      await clothesAddRef.value?.showModel(item as WardrobeClothes, true, event)
    }
  } catch {
    toast.add({
      title: '无法打开添加服饰',
      description: '请稍后重试',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    openingCustomClothes.value = false
  }
}

function onClothesAddSuccessFromAiChat(payload?: WardrobeClothes) {
  toast.add({
    title: '服饰已保存',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
  const id = payload?.clothes_id
  const note = payload?.clothes_note?.trim()
  messages.value.push({
    id: `a-clothes-${Date.now()}`,
    role: 'assistant',
    intentHint:
      id != null && Number.isFinite(Number(id))
        ? note
          ? `已成功添加到衣柜：「${note}」。以下为刚才保存的服饰，可点击查看详情。`
          : `已成功添加到衣柜（服饰 ID：${id}）。可点击下方卡片查看详情。`
        : '服饰已保存。',
    echoClothes: payload
  })
  scrollToBottom()
}

/** 回显服饰卡片跳转（对齐 `pages/visualization/wardrobe.vue` goToDetail 中 cloth 分支） */
function openEchoClothesDetail(clothesId: number) {
  if (!Number.isFinite(clothesId) || clothesId <= 0) return
  if (!import.meta.client || typeof window === 'undefined') return

  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/wardrobe/clothesDetail/clothesDetail?id=${clothesId}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
  } else if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com/clothes/detail/${clothesId}`
        }
      })
    )
  } else {
    window.open(`/clothes/detail/${clothesId}`, '_blank')
  }
}

/** 打开「衣柜」页（可选 wardrobe_id）；与可视化衣柜 goToDetail(wardrobe) 环境分支对齐 */
function openEchoWardrobeView(item: WardrobeClothes) {
  if (!isChatUserLoggedIn()) {
    toast.add({
      title: '请先登录',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    openLoginModal()
    return
  }
  const uid = user.value?.user_id
  if (uid == null || !Number.isFinite(Number(uid))) return
  const wid = item.wardrobe_id
  if (!import.meta.client || typeof window === 'undefined') return

  const isInUniApp =
    typeof window !== 'undefined' && navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    const q = [`user_id=${uid}`]
    if (wid != null && Number.isFinite(Number(wid))) {
      q.push(`wardrobe_id=${wid}`)
    }
    uni.navigateTo({
      url: `/pages/wardrobe/wardrobe?${q.join('&')}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
    return
  }

  let path = `/wardrobe/detail/${uid}`
  if (wid != null && Number.isFinite(Number(wid))) {
    path += `?wardrobe_id=${wid}`
  }

  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: `https://lolitalibrary.com${path}` }
      })
    )
  } else {
    window.open(path, '_blank')
  }
}

/** 攒钱计划页：与 `pages/wardrobe/detail/[id].vue` 的 `jumpToPlan` 一致 */
function openEchoPlanPage() {
  if (!import.meta.client || typeof window === 'undefined') return
  const planUrl = '/user/plan'
  const outUrl = `https://lolitalibrary.com${planUrl}`

  const isInUniApp =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Html5Plus')

  const uniBridge =
    typeof globalThis !== 'undefined'
      ? (globalThis as unknown as {
          uni?: { navigateTo: (o: { url: string; fail?: () => void }) => void }
        }).uni
      : undefined

  if (isInUniApp && uniBridge?.navigateTo) {
    uniBridge.navigateTo({
      url: `/pages/common/outerLink?url=${outUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
    return
  }
  if (port.value) {
    port.value.postMessage(
      JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: outUrl }
      })
    )
    return
  }
  void navigateTo(planUrl)
}

const planEchoAddRef = ref<InstanceType<typeof PlanAddEdit> | null>(null)
const planEchoLinkedClothes = ref<WardrobeClothes | null>(null)
const planEchoInitialMoney = ref(0)

function openEchoTailPlanModal(item: WardrobeClothes, e: MouseEvent) {
  if (!isChatUserLoggedIn()) {
    toast.add({
      title: '请先登录',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    openLoginModal()
    return
  }
  const cid = item.clothes_id
  if (cid == null || !Number.isFinite(Number(cid))) return

  planEchoLinkedClothes.value = {
    clothes_id: cid,
    clothes_note: item.clothes_note,
    clothes_img: item.clothes_img,
    wardrobe_id: item.wardrobe_id,
    library_id: item.library_id,
    price: item.price,
    sum_price: item.sum_price
  }
  const preset = Number(item.price ?? item.sum_price ?? 0)
  planEchoInitialMoney.value =
    Number.isFinite(preset) && preset > 0 ? preset : 0

  void nextTick(() => planEchoAddRef.value?.showModel(e))
}

function markEchoClothesTailPlanDone(plan: PlanList) {
  const cid =
    plan.clothes_id ??
    plan.wardrobe_clothes?.clothes_id ??
    planEchoLinkedClothes.value?.clothes_id
  if (cid == null || !Number.isFinite(Number(cid))) return
  const n = Number(cid)
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if (
      m.role === 'assistant' &&
      m.echoClothes?.clothes_id != null &&
      Number(m.echoClothes.clothes_id) === n
    ) {
      m.tailPlanAdded = true
      break
    }
  }
}

function onEchoPlanInserted(plan: PlanList) {
  markEchoClothesTailPlanDone(plan)
  toast.add({
    title: '定尾计划已添加',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
  const name = plan.plan_name?.trim()
  messages.value.push({
    id: `a-plan-${Date.now()}`,
    role: 'assistant',
    intentHint: name
      ? `已定尾计划「${name}」已保存${plan.list_id != null ? `（#${plan.list_id}）` : ''}。`
      : '定尾计划已保存。',
    echoPlan: plan
  })
  scrollToBottom()
}

/**
 * 加衣柜意图：打开「新增服饰」；衣柜选择由 ClothesAdd 的 enableWardrobePicker 处理。
 */
async function openCustomClothesAdd(e: MouseEvent) {
  if (!isChatUserLoggedIn()) {
    toast.add({
      title: '请先登录',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    openLoginModal()
    return
  }
  if (openingCustomClothes.value) return
  openingCustomClothes.value = true
  try {
    await clothesAddRef.value?.showModel(null, false, e)
  } catch {
    toast.add({
      title: '无法打开添加服饰',
      description: '请稍后重试',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle'
    })
  } finally {
    openingCustomClothes.value = false
  }
}

/**
 * 「查裙子:」前缀后的文案按空白分段，合并为列表接口 `keyword`（与后端单一 keyword 字段对齐）。
 */
function keywordFromLibraryQuickLookup(trimmedMessage: string): string | null {
  if (!trimmedMessage.startsWith(LIBRARY_QUICK_LOOKUP_PREFIX)) return null
  const after = trimmedMessage.slice(LIBRARY_QUICK_LOOKUP_PREFIX.length).trim()
  const parts = after.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  return parts.join(' ')
}

async function onSend() {
  const textRaw =
    (composerRef.value?.getOutboundPlain() ?? '').trim() ||
    composerPlainDraft.value.trim()
  const text = textRaw
  if (!text || sending.value) return

  if (!isChatUserLoggedIn()) {
    toast.add({
      title: '请先登录',
      description: '登录后即可发送消息并开始对话',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    openLoginModal()
    return
  }

  if (!isAiChatFormalResident.value) {
    toast.add({
      title: '仅正式居民可用',
      description: '升级正式居民后即可发送消息',
      color: 'amber',
      icon: 'i-heroicons-information-circle'
    })
    return
  }

  messages.value.push({
    id: `u-${Date.now()}`,
    role: 'user',
    text
  })
  composerRef.value?.clear()
  composerPlainDraft.value = ''
  scrollToBottom()

  sending.value = true
  let streamAssistantId: string | null = null
  try {
    const quickKw = keywordFromLibraryQuickLookup(text)
    if (quickKw !== null) {
      const data = await getLibraryList({
        page: 1,
        pageSize: AI_INTENT_LIBRARY_PREVIEW_MAX,
        keyword: quickKw
      })
      const rows = (data.rows ?? []).slice(0, AI_INTENT_LIBRARY_PREVIEW_MAX)
      messages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        analysis: {
          type: 2,
          params: { keyword: quickKw, local_quick_lookup: true }
        },
        libraries: rows,
        intentHint:
          rows.length === 0
            ? `未找到与「${quickKw}」匹配的图鉴。`
            : `以下为关键词「${quickKw}」的图鉴结果；可左右滑动，点击查看详情。`
      })
      return
    }

    if (text.startsWith(LIBRARY_QUICK_LOOKUP_PREFIX)) {
      messages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        analysis: {
          type: 2,
          params: { local_quick_lookup: true, empty_keyword: true }
        },
        libraries: [],
        intentHint: `请在「${LIBRARY_QUICK_LOOKUP_PREFIX}」后输入关键词；多个词可用空格分隔，会合并为一次图鉴搜索。`
      })
      return
    }

    streamAssistantId = `a-${Date.now()}`
    messages.value.push({
      id: streamAssistantId,
      role: 'assistant',
      intentStreaming: true,
      intentStreamReasoning: '',
      intentStreamContent: ''
    })
    scrollToBottom()

    const analysis = await streamAiIntentAnalysis(
      { text },
      {
        onReasoningDelta(delta) {
          const m = messages.value.find((x) => x.id === streamAssistantId)
          if (!m) return
          m.intentStreamReasoning = (m.intentStreamReasoning ?? '') + delta
          scrollToBottom()
        },
        onContentDelta(delta) {
          const m = messages.value.find((x) => x.id === streamAssistantId)
          if (!m) return
          m.intentStreamContent = (m.intentStreamContent ?? '') + delta
          scrollToBottom()
        }
      }
    )
    const rich = await runAiIntentHandlers(analysis)
    const streamMsg = messages.value.find((x) => x.id === streamAssistantId)
    if (streamMsg) {
      streamMsg.intentStreaming = false
      streamMsg.intentStreamReasoning = undefined
      streamMsg.intentStreamContent = undefined
      streamMsg.analysis = rich.analysis
      streamMsg.libraries = rich.libraries
      streamMsg.sharedClothes = rich.sharedClothes
      streamMsg.intentHint = rich.hint
      streamMsg.similarRecommendAwaitPick = rich.similarRecommendAwaitPick === true
    }
  } catch (e) {
    if (streamAssistantId) {
      const i = messages.value.findIndex((x) => x.id === streamAssistantId)
      if (i !== -1) messages.value.splice(i, 1)
    }
    const message = e instanceof Error ? e.message : '请求失败'
    messages.value.push({
      id: `e-${Date.now()}`,
      role: 'system',
      error: message
    })
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function onComposerFocus() {
  scheduleComposerDockLayoutSync()
}

function onComposerBlur() {
  scheduleComposerDockLayoutSync()
}

useHead({
  title: 'AI 问答 | Lo研社'
})
</script>

<template>
  <div
    class="ai-chat-root neo-chat-root flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-qhx-bg text-qhx-text">
    <div class="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-3 md:px-6">
      <!-- WebView：与 default 布局一致，由 ?statusbar= 写入 configStore -->
      <!-- <div
        v-if="configStore.statusBarHeight > 0"
        class="shrink-0"
        :style="{ height: `${configStore.statusBarHeight}px` }"
        aria-hidden="true"
      /> -->

      <header
        class="neo-chat-header mb-2 flex shrink-0 items-center gap-3 rounded-2xl bg-qhx-bg-card px-3 py-3 pt-[max(0.35rem,env(safe-area-inset-top))] shadow-[6px_6px_16px_var(--neo-raise-d),-6px_-6px_18px_var(--neo-raise-l)] dark:bg-qhx-bg-card">
        <UserBox v-if="isChatUserLoggedIn()">
          <template #trigger>
            <div
              class="neo-chat-popover-trigger relative shrink-0 cursor-pointer rounded-2xl outline-none ring-offset-2 ring-offset-qhx-bg-card transition-[transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-qhx-primary/40"
              role="button" tabindex="0" aria-label="打开用户菜单">
              <img v-if="avatarUrl" :src="avatarUrl" :alt="displayUserName"
                class="pointer-events-none size-11 rounded-2xl border-0 object-cover shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]"
                loading="lazy" decoding="async" />
              <div v-else
                class="pointer-events-none flex size-11 items-center justify-center rounded-2xl text-xs font-semibold text-qhx-primary shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]">
                {{ displayUserName === '未登录' ? '?' : (displayUserName.slice(0, 1) || '?') }}
              </div>
            </div>
          </template>
        </UserBox>
        <button v-else type="button"
          class="relative shrink-0 rounded-2xl outline-none ring-offset-2 ring-offset-qhx-bg-card transition-[transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-qhx-primary/40"
          aria-label="登录" @click="openLoginModal()">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="displayUserName"
            class="size-11 rounded-2xl border-0 object-cover shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]"
            loading="lazy" decoding="async" />
          <div v-else
            class="flex size-11 items-center justify-center rounded-2xl text-xs font-semibold text-qhx-primary shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]">
            {{ displayUserName === '未登录' ? '?' : (displayUserName.slice(0, 1) || '?') }}
          </div>
        </button>

        <div class="flex min-w-0 flex-1 flex-col items-stretch gap-2">
          <div
            class="flex w-full flex-wrap items-center justify-start gap-x-2 gap-y-1 text-[11px] leading-tight sm:text-xs">
            <span
              class="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-0.5 text-qhx-text shadow-[inset_2px_2px_5px_var(--neo-inset-d),inset_-2px_-2px_5px_var(--neo-inset-l)]">
              <span class="text-qhx-primary">经验</span>
              <span class="font-semibold tabular-nums text-qhx-text">{{ displayExp }}</span>
            </span>
            <span
              class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-qhx-text shadow-[inset_2px_2px_5px_var(--neo-inset-d),inset_-2px_-2px_5px_var(--neo-inset-l)]">
              <UIcon name="i-heroicons-star" class="size-3.5 shrink-0 text-qhx-warning" />
              <span>星星币</span>
              <span class="font-semibold tabular-nums">{{ displayStarCoin }}</span>
            </span>
          </div>

          <div
            class="flex w-full flex-wrap items-center justify-start gap-x-2 gap-y-1.5 border-t border-qhx-border/25 pt-2 sm:gap-x-3">
            <span class="flex-1 inline-flex max-w-full items-center gap-0.5 text-[10px] leading-snug text-qhx-text/50" :title="isChatUserLoggedIn()
                ? '点击左侧头像可打开个人菜单（空间、衣柜、收藏夹等）。'
                : '点击左侧头像可快捷登录。'
              ">
              <UIcon name="i-heroicons-information-circle" class="size-3 shrink-0 opacity-65" aria-hidden="true" />
              <span class="whitespace-nowrap">
                {{ isChatUserLoggedIn() ? '点头像菜单' : '点头像登录' }}
              </span>
            </span>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-2">
              <span class="truncate text-[11px] text-qhx-text/80">
                设为首页
              </span>
              <UToggle v-model="shareClubAsHomeToggle" color="primary" :disabled="savingShareClubHome"
                @update:model-value="handleShareClubAsHomeChange" />
            </div>
            <button type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-qhx-border/40 bg-qhx-bg px-3 py-1.5 text-xs font-semibold text-qhx-primary shadow-[3px_3px_8px_var(--neo-raise-d),-2px_-2px_8px_var(--neo-raise-l)] transition-[transform,opacity] hover:brightness-[1.02] active:scale-[0.98] active:shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)]"
              aria-label="复制本页链接" @click="onCopyAiChatShareLink">
              <UIcon name="i-heroicons-share" class="size-4 shrink-0 opacity-90" aria-hidden="true" />
              分享
            </button>
            </div>
          </div>
        </div>
      </header>

      <div ref="messagesScrollEl" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain pt-2"
        role="log" aria-live="polite" :style="{ paddingBottom: `${messagesBottomPad}px` }">
        <div v-if="messages.length === 0" class="flex w-full min-w-0 justify-start px-1">
          <div
            class="max-w-[95%] rounded-2xl rounded-tl-md bg-qhx-bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-bg-card"
            role="status">
            这里是星星小助手，目前支持加衣柜，加定尾计划，找相似。不是完全的AI助手，没有记忆，如果是查裙子，关键词之间请用空格分割。
          </div>
        </div>
        <AiChatMessageRow
          v-for="m in messages"
          :key="m.id"
          :msg="m"
          :picking-similar-pair="pickingSimilarPair"
          :opening-custom-clothes="openingCustomClothes"
          :similar-show-max="AI_SIMILAR_SHOW_MAX"
          @pick-similar="onPickSimilarBase"
          @join-wardrobe="onJoinWardrobeIntentClick"
          @open-echo="openEchoClothesDetail"
          @open-wardrobe="openEchoWardrobeView"
          @add-tail-plan="openEchoTailPlanModal"
          @open-plan-page="openEchoPlanPage"
          @custom-add="openCustomClothesAdd"
          @continue="scrollToBottom" />

        <div v-if="sending" class="flex justify-start">
          <div
            class="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-qhx-text/70 shadow-[inset_3px_3px_8px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)]">
            <span class="inline-block size-3 animate-spin rounded-full border-2 border-qhx-border border-t-qhx-primary"
              aria-hidden="true" />
            分析中…
          </div>
        </div>

      </div>
    </div>

    <div ref="composerDockEl"
      class="ai-chat-composer-dock fixed left-0 right-0 z-30 bg-qhx-bg shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.45)]"
      :style="{ bottom: `${keyboardOverlapPx}px` }" role="region" aria-label="消息输入">
      <div class="neo-chat-composer mx-auto max-w-3xl px-3 pt-2 md:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div class="ai-chat-composer-toolbar mb-2 flex flex-wrap gap-2 rounded-xl px-0.5 py-0.5" role="toolbar"
          aria-label="快捷输入">
          <button v-for="a in COMPOSER_QUICK_ACTIONS" :key="a.text" type="button"
            class="inline-flex shrink-0 items-center rounded-xl border border-qhx-border/35 bg-qhx-bg px-3 py-1.5 text-xs font-medium text-qhx-text shadow-[3px_3px_8px_var(--neo-raise-d),-2px_-2px_8px_var(--neo-raise-l)] transition-[transform,opacity] hover:brightness-[1.02] active:scale-[0.98] active:shadow-[inset_2px_2px_6px_var(--neo-inset-d),inset_-2px_-2px_6px_var(--neo-inset-l)] disabled:pointer-events-none disabled:opacity-45"
            :disabled="sending"
            :title="`插入「${a.text}」并聚焦输入框`" @click="onComposerQuickAction(a.text)">
            {{ a.label }}:
          </button>
        </div>

        <div class="flex min-h-0 flex-col gap-2.5 sm:flex-row sm:items-end">
          <div class="relative min-h-0 min-w-0 flex-1">
            <ClientOnly>
              <AiChatRichComposer ref="composerRef" :disabled="sending || !isAiChatFormalResident"
                placeholder="输入消息@ 可搜索并插入图鉴" @focus="onComposerFocus" @blur="onComposerBlur"
                @submit="onComposerSubmit" @outbound-plain-change="onComposerOutboundPlainChange" />
              <template #fallback>
                <div
                  class="min-h-[4.5rem] flex-1 rounded-2xl bg-qhx-bg/60 shadow-[inset_5px_5px_12px_var(--neo-inset-d),inset_-5px_-5px_12px_var(--neo-inset-l)]"
                  aria-hidden="true" />
              </template>
            </ClientOnly>
            <div v-if="!isAiChatFormalResident"
              class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-qhx-bg/80 px-3 text-center backdrop-blur-[1px] dark:bg-qhx-bg/75">
              <span class="text-sm font-medium text-qhx-text/75">仅正式居民可用</span>
            </div>
          </div>
          <button type="button"
            class="neo-chat-send inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-qhx-bg px-5 text-sm font-semibold text-qhx-primary shadow-[6px_6px_16px_var(--neo-raise-d),-5px_-5px_16px_var(--neo-raise-l)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.03] active:shadow-[inset_4px_4px_10px_var(--neo-inset-d),inset_-3px_-3px_8px_var(--neo-inset-l)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:min-w-[5.5rem]"
            :disabled="!canSend" :aria-busy="sending" :aria-label="sending ? '发送中' : '发送'" @click="onSend">
            <span v-if="sending"
              class="size-4 shrink-0 animate-spin rounded-full border-2 border-qhx-border border-t-qhx-primary"
              aria-hidden="true" />
            {{ sending ? '发送中' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <ClientOnly>
      <ClothesAdd ref="clothesAddRef" enable-wardrobe-picker @success="onClothesAddSuccessFromAiChat($event)" />
    </ClientOnly>

    <PlanAddEdit
      ref="planEchoAddRef"
      :plan-list="null"
      :initial-need-money="planEchoInitialMoney"
      enable-link-clothes
      :linked-clothes="planEchoLinkedClothes"
      @insert="onEchoPlanInserted"
    />

    <ClientOnly>
      <YearlySummaryLoginModal v-model="showLoginModal" @success="onAiChatLoginSuccess" />
    </ClientOnly>
  </div>
</template>

<style>
/* 拟态阴影：由主题变量 --border-color / --card-color / --primary-color 等推导 */
.neo-chat-root {
  --neo-raise-d: color-mix(in srgb, var(--border-color) 58%, var(--text-color) 6%);
  --neo-raise-l: color-mix(in srgb, var(--card-color) 32%, white 94%);
  --neo-inset-d: color-mix(in srgb, var(--border-color) 48%, var(--text-color) 5%);
  --neo-inset-l: color-mix(in srgb, var(--card-color) 28%, white 92%);
}

html.dark .neo-chat-root {
  --neo-raise-d: color-mix(in srgb, black 58%, var(--primary-color) 22%);
  --neo-raise-l: color-mix(in srgb, white 14%, transparent);
  --neo-inset-d: color-mix(in srgb, black 52%, var(--primary-color) 12%);
  --neo-inset-l: color-mix(in srgb, white 10%, transparent);
}

/* 横向卡片：封面高:宽 = 4:3（CSS aspect-ratio 为 宽/高 = 3/4）+ 标题固定两行省略 */
.neo-chat-root .neo-chat-carousel-thumb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.neo-chat-root .neo-chat-carousel-title {
  flex-shrink: 0;
  width: 100%;
  min-height: 2.625rem;
  height: 2.625rem;
  padding: 0 1px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3125rem;
  text-align: center;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
</style>
