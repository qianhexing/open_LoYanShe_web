<script setup lang="ts">
import dayjs from 'dayjs'
import { BASE_IMG } from '@/utils/ipConfig'
import { parseRichText } from '@/utils/public'
import { getUserMy } from '@/api/user'
import {
  getIsSignIn,
  getSignInStatisticsByDay,
  type SignInDayComment,
  type SignInDayStat,
} from '@/api/sign_in'
import { getWordCloudRandom, insertWordcloud } from '@/api/word_cloud'
import { getDecoList } from '@/api/deco'
import { getCommentById, getCommentList } from '@/api/comment'
import CommentSection from '@/components/comment/CommentSection.vue'
import CommentItem from '@/components/comment/CommentItem.vue'
import CommunityCommentModal from '@/components/community/CommentModal.vue'
import SignInCalendar from '@/components/signIn/SignInCalendar.vue'
import SignInCommentModal from '@/components/signIn/SignInCommentModal.vue'
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue'
import type { Comment } from '@/types/api'
import { setGardenFlowerDecoRegistry } from '@/utils/gardenFlowerDeco'
import {
  buildGardenFlowerMeta,
  getMaxGardenFlowerCount,
  parseCommentFlowerType,
} from '@/utils/gardenPlants'
import type { CommentOpenReplyPayload } from '@/composables/communityCommentSection'
import type CommentSectionType from '@/components/comment/CommentSection.vue'
import type CommunityCommentModalType from '@/components/community/CommentModal.vue'

interface WordCloudDatum {
  name: string
  value: number
}

definePageMeta({
  ssr: false,
})

const { setLayoutStyle } = useLayoutStyle()
setLayoutStyle(1)

const configStore = useConfigStore()
const userStore = useUserStore()
const toast = useToast()
const layoutReady = inject('layoutReady') as Ref<boolean>
const isMobile = computed(
  () => configStore.isMobile || configStore.windowWidth < 768
)

const maxFlowerCount = computed(() => getMaxGardenFlowerCount(isMobile.value))

const drawerDirection = computed<'bottom' | 'right'>(() =>
  isMobile.value ? 'bottom' : 'right'
)

const drawerDefaultSize = computed(() => {
  if (typeof window === 'undefined') return isMobile.value ? 360 : 480
  return isMobile.value
    ? Math.round(window.innerHeight * 0.52)
    : 480
})

const drawerSafeArea = computed(
  () => (configStore.statusBarHeight || 0) + (isMobile.value ? 12 : 48)
)

const tabs = [
  { key: 'wordcloud', label: '花语园' },
  { key: 'calendar', label: '日历' },
] as const

type TabKey = (typeof tabs)[number]['key']

const activeTab = ref<TabKey>('wordcloud')
const showLoginModal = ref(false)
const showSignInModal = ref(false)
const showCommentModal = ref(false)
const showWordAction = ref(false)

const chartData = ref<WordCloudDatum[]>([])
const dayCount = ref<SignInDayStat[]>([])
const commentByDay = ref<Record<number, SignInDayComment>>({})
const daily = ref<string | null>(null)
const dailyIndex = ref<number | null>(null)
const total = ref(0)
const countSignin = ref(0)
const flowerTypes = ref<string[]>([])
const flowerCommentIds = ref<number[]>([])
const showFlowerCommentModal = ref(false)
const flowerCommentLoading = ref(false)
const selectedFlowerComment = ref<Comment | null>(null)
const isSignedIn = ref(false)
const wordCloudLoading = ref(false)
const selectedWord = ref<string | null>(null)
const commentsReady = ref(false)
const scene3dReady = ref(false)
let scene3dIdleId: ReturnType<typeof requestIdleCallback> | null = null
let scene3dTimeoutId: ReturnType<typeof setTimeout> | null = null
let syncFlowerMetaTimer: ReturnType<typeof setTimeout> | null = null
let syncFlowerMetaRequest = 0

const filterList = reactive({
  unlimited: false,
  just_my: false,
})

const commentSectionRef = ref<InstanceType<typeof CommentSectionType> | null>(null)
const signInCommentModalRef = ref<InstanceType<typeof SignInCommentModal> | null>(null)
const commentModalRef = ref<InstanceType<typeof CommunityCommentModalType> | null>(null)

const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref<string[]>([])

const selectedDayComment = computed(() => {
  if (dailyIndex.value == null) return null
  return commentByDay.value[dailyIndex.value] ?? null
})

const selectedDayImages = computed(() => {
  const mountImg = selectedDayComment.value?.mount_img
  if (!mountImg) return []
  return mountImg.split(',').filter(Boolean)
})

type CalendarDayMeta = {
  count: number
  coverUrl: string | null
  hasCover: boolean
}

const emptyCalendarDayMeta: CalendarDayMeta = {
  count: 0,
  coverUrl: null,
  hasCover: false,
}

/** 日历格子的展示数据（仅计算有数据的日期） */
const calendarDayMeta = computed(() => {
  const meta: Record<number, CalendarDayMeta> = {}
  for (let i = 0; i < dayCount.value.length; i++) {
    const count = dayCount.value[i]?.total_count ?? 0
    if (count > 0) {
      const day = i + 1
      meta[day] = { ...(meta[day] ?? emptyCalendarDayMeta), count }
    }
  }
  for (const [dayKey, comment] of Object.entries(commentByDay.value)) {
    const day = Number(dayKey)
    if (!Number.isFinite(day)) continue
    const firstImg = comment?.mount_img?.split(',')[0]
    const prev = meta[day] ?? emptyCalendarDayMeta
    meta[day] = {
      count: prev.count || (dayCount.value[day - 1]?.total_count ?? 0),
      coverUrl: firstImg ? toImageUrl(firstImg, 'w_200,h_200') : null,
      hasCover: Boolean(firstImg),
    }
  }
  return meta
})

function getCalendarDayMeta(day: number | ''): CalendarDayMeta {
  if (typeof day !== 'number') return emptyCalendarDayMeta
  return calendarDayMeta.value[day] ?? emptyCalendarDayMeta
}

function pad2(value: number) {
  return value >= 10 ? String(value) : `0${value}`
}

function toImageUrl(path: string, resize = 'w_200,h_200') {
  return `${BASE_IMG}${path}?x-oss-process=image/quality,q_100/resize,${resize}`
}

async function fetchGardenFlowerDecos() {
  try {
    const res = await getDecoList({ page: 1, pageSize: 100, type: 1 })
    setGardenFlowerDecoRegistry(res.rows ?? [])
  } catch (error) {
    console.error('获取花园花朵配置失败:', error)
  }
}

async function fetchWordCloud() {
  try {
    const res = await getWordCloudRandom()
    chartData.value = (res.rows ?? []).map((item) => ({
      name: item.word,
      value: item.count,
    }))
  } catch (error) {
    console.error('获取词云失败:', error)
  }
}

async function fetchSignInStatus() {
  try {
    isSignedIn.value = await getIsSignIn()
  } catch (error) {
    console.error('获取签到状态失败:', error)
    isSignedIn.value = false
  }
}

async function fetchMonthStatistics(startDate: string) {
  try {
    const res = await getSignInStatisticsByDay({ start_date: startDate })
    dayCount.value = res.rows ?? []
    const nextComments: Record<number, SignInDayComment> = {}
    for (const item of res.comment_list ?? []) {
      const day = Number.parseInt(dayjs(item.date).format('DD'), 10)
      if (Number.isFinite(day)) {
        nextComments[day] = item
      }
    }
    commentByDay.value = nextComments
  } catch (error) {
    console.error('获取签到日历数据失败:', error)
  }
}

async function ensureLogin() {
  const token =
    useCookie('token').value ||
    (import.meta.client ? localStorage.getItem('token') : null)

  if (!token) {
    showLoginModal.value = true
    return false
  }

  if (!userStore.user?.user_id) {
    try {
      const userInfo = await getUserMy()
      if (userInfo?.user_id) {
        userStore.setUserInfo(userInfo)
        return true
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
    showLoginModal.value = true
    return false
  }

  return true
}

function scheduleScene3d() {
  if (scene3dReady.value || !import.meta.client) return

  const activate = () => {
    scene3dReady.value = true
    scene3dIdleId = null
    scene3dTimeoutId = null
  }

  void import('@/components/signIn/WordCloudBubble3D.client.vue')

  if (typeof requestIdleCallback !== 'undefined') {
    scene3dIdleId = requestIdleCallback(activate, {
      timeout: isMobile.value ? 1400 : 900,
    })
  } else {
    scene3dTimeoutId = setTimeout(activate, isMobile.value ? 500 : 300)
  }
}

const WordCloudBubble3D = defineAsyncComponent(
  () => import('@/components/signIn/WordCloudBubble3D.client.vue')
)

async function initPage() {
  const loggedIn = await ensureLogin()
  if (!loggedIn) return

  const now = dayjs()
  daily.value = now.format('YYYY-MM-DD')
  dailyIndex.value = Number.parseInt(now.format('DD'), 10)

  commentsReady.value = true
  scheduleScene3d()

  const monthStart = `${now.format('YYYY')}-${now.format('MM')}-01`
  void fetchMonthStatistics(monthStart)
  void fetchGardenFlowerDecos()
  void Promise.all([fetchWordCloud(), fetchSignInStatus()]).then(() => {
    if (!isSignedIn.value) {
      showSignInModal.value = true
      nextTick(() => signInCommentModalRef.value?.open())
    }
  })
}

function switchTab(key: TabKey) {
  activeTab.value = key
}

function onChooseDay(parts: { y: number; m: number; d: number }) {
  daily.value = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`
  dailyIndex.value = Number.parseInt(dayjs(daily.value).format('DD'), 10)
}

function onChangeMonth(startDate: string) {
  void fetchMonthStatistics(startDate)
}

function openSignInModal() {
  if (isSignedIn.value) return
  showSignInModal.value = true
  nextTick(() => signInCommentModalRef.value?.open())
}

function appendFlowerMeta(typeId?: string, commentId?: number) {
  flowerTypes.value = [...flowerTypes.value, typeId ?? '']
  flowerCommentIds.value = [
    ...flowerCommentIds.value,
    commentId && commentId > 0 ? commentId : 0,
  ]
}

function applyGardenFlowerMeta(meta: { types: string[]; commentIds: number[] }) {
  const limit = maxFlowerCount.value
  flowerTypes.value = meta.types.slice(0, limit)
  flowerCommentIds.value = meta.commentIds.slice(0, limit)
}

async function syncFlowerMetaFromComments(forceApi = false) {
  if (!daily.value || total.value <= 0) {
    flowerTypes.value = []
    flowerCommentIds.value = []
    return
  }

  const needCount = Math.min(total.value, maxFlowerCount.value)
  const section = commentSectionRef.value

  if (!forceApi && section) {
    const loaded = section.getLoadedCommentCount?.() ?? 0
    if (loaded >= needCount) {
      const meta = section.getLoadedGardenMeta?.()
      if (meta) {
        applyGardenFlowerMeta(meta)
        return
      }
    }
  }

  const requestId = ++syncFlowerMetaRequest
  try {
    const response = await getCommentList({
      type: 'daily',
      id: 0,
      daily: daily.value,
      page: 1,
      pageSize: needCount,
      filter_list: { ...filterList },
    })
    if (requestId !== syncFlowerMetaRequest) return
    applyGardenFlowerMeta(
      buildGardenFlowerMeta(
        response.rows ?? [],
        total.value,
        response.pinned ?? null,
        maxFlowerCount.value
      )
    )
  } catch (error) {
    console.error('同步花朵元数据失败:', error)
  }
}

function scheduleSyncFlowerMeta(forceApi = false) {
  if (syncFlowerMetaTimer) clearTimeout(syncFlowerMetaTimer)
  syncFlowerMetaTimer = setTimeout(() => {
    syncFlowerMetaTimer = null
    void syncFlowerMetaFromComments(forceApi)
  }, 200)
}

function onCommentTotalChange(count: number) {
  total.value = count
  scheduleSyncFlowerMeta()
}

function onSignInReload(payload?: { word_cloud?: string; flower_types?: string }) {
  isSignedIn.value = true
  if (payload?.word_cloud) {
    const index = chartData.value.findIndex((item) => item.name === payload.word_cloud)
    if (index !== -1) {
      chartData.value[index] = {
        ...chartData.value[index],
        value: chartData.value[index].value + 1,
      }
    } else {
      chartData.value.push({ name: payload.word_cloud, value: 1 })
    }
  }
  total.value += 1
  if (payload?.flower_types) {
    appendFlowerMeta(payload.flower_types)
  } else {
    appendFlowerMeta()
  }
  void commentSectionRef.value?.refreshList?.()
  void fetchSignInStatus()
}

function onFilterChange() {
  syncFlowerMetaRequest += 1
  nextTick(() => {
    void commentSectionRef.value?.refreshList?.()
    scheduleSyncFlowerMeta(true)
  })
}

function onWordClick(word: string) {
  selectedWord.value = word
  showWordAction.value = true
}

async function onFlowerClick(commentId: number) {
  if (commentId <= 0) return

  showFlowerCommentModal.value = true
  flowerCommentLoading.value = true
  selectedFlowerComment.value = null

  try {
    selectedFlowerComment.value = await getCommentById({ comment_id: commentId })
  } catch (error) {
    console.error('拉取评论失败:', error)
    toast.add({
      title: '评论加载失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    flowerCommentLoading.value = false
  }
}

async function confirmInsertWordCloud() {
  if (!selectedWord.value || wordCloudLoading.value) return
  wordCloudLoading.value = true
  try {
    await insertWordcloud({ word: selectedWord.value })
    const index = chartData.value.findIndex((item) => item.name === selectedWord.value)
    if (index !== -1) {
      chartData.value[index] = {
        ...chartData.value[index],
        value: chartData.value[index].value + 1,
      }
    }
    toast.add({
      title: '已 +1',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
  } catch (error) {
    console.error('词库 +1 失败:', error)
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    wordCloudLoading.value = false
    showWordAction.value = false
    selectedWord.value = null
  }
}

function openPreview(images: string[], index: number) {
  previewImages.value = images.map((img) => toImageUrl(img, 'w_900'))
  previewIndex.value = index
  previewVisible.value = true
}

function openReplyComposer(payload: CommentOpenReplyPayload) {
  if (!userStore.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  showCommentModal.value = true
  nextTick(() => {
    commentModalRef.value?.showModel({
      id: payload.comment.comment_id,
      type: 'reply',
      reply_to: payload.subReply?.reply_to,
      reply_to_user: payload.subReply?.replyToUser,
      reply_to_name:
        payload.subReply?.replyToUser?.user_name ??
        payload.comment.user?.user_name ??
        '',
      threadRootCommentId: payload.threadRootCommentId,
    })
  })
}

function onCommentSuccess(comment: Comment) {
  total.value += 1
  appendFlowerMeta(parseCommentFlowerType(comment.json_data), comment.comment_id)
  void commentSectionRef.value?.refreshList?.()
}

const handleLoginSuccess = async () => {
  await initPage()
}

watch(
  () => layoutReady?.value,
  (ready) => {
    if (ready) {
      void initPage()
    }
  },
  { immediate: true }
)

watch(maxFlowerCount, (limit) => {
  if (flowerTypes.value.length > limit) {
    flowerTypes.value = flowerTypes.value.slice(0, limit)
    flowerCommentIds.value = flowerCommentIds.value.slice(0, limit)
  }
})

onMounted(() => {
  if (import.meta.client) {
    configStore.updateWindowWidth(window.innerWidth)
  }
})

onBeforeUnmount(() => {
  if (syncFlowerMetaTimer) {
    clearTimeout(syncFlowerMetaTimer)
    syncFlowerMetaTimer = null
  }
  if (scene3dIdleId != null && typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(scene3dIdleId)
    scene3dIdleId = null
  }
  if (scene3dTimeoutId != null) {
    clearTimeout(scene3dTimeoutId)
    scene3dTimeoutId = null
  }
})

useHead({
  title: '签到花园 - Lo研社',
  meta: [
    {
      name: 'description',
      content: 'Lo研社签到花园，种下花语，记录穿 Lo 的日常',
    },
  ],
})
</script>

<template>
  <div class="relative min-h-[100dvh] w-full overflow-hidden bg-white dark:bg-black">
    <!-- 3D 加载前的轻量占位背景，避免首屏白屏 -->
    <div
      v-if="layoutReady && !scene3dReady"
      class="fixed left-0 right-0 bottom-0 z-0"
      :style="{
        top: `${configStore.statusBarHeight}px`,
        height: `calc(100dvh - ${configStore.statusBarHeight}px)`,
      }"
    >
      <div
        class="h-full w-full bg-gradient-to-b from-[#a8d8ff] via-[#f5fbff] to-[#e8f4ef] dark:from-gray-950 dark:via-gray-900 dark:to-black"
      />
    </div>

    <!-- 全屏 3D 词云背景（空闲时延迟挂载，切换 Tab 不隐藏） -->
    <ClientOnly>
      <div
        v-if="layoutReady && scene3dReady"
        class="fixed left-0 right-0 bottom-0 z-0"
        :style="{
          top: `${configStore.statusBarHeight}px`,
          height: `calc(100dvh - ${configStore.statusBarHeight}px)`,
        }"
      >
        <WordCloudBubble3D
          fullscreen
          :prefer-web-gpu="!isMobile"
          :mobile-optimized="isMobile"
          :paused="activeTab !== 'wordcloud'"
          :chart-data="chartData"
          :flower-count="total"
          :flower-types="flowerTypes"
          :flower-comment-ids="flowerCommentIds"
          @word-click="onWordClick"
          @flower-click="onFlowerClick"
        />
      </div>
    </ClientOnly>

    <!-- 其余内容：BottomDrawer -->
    <Transition :name="`drawer-${drawerDirection}`">
      <QhxBottomDrawer
        v-if="layoutReady"
        :direction="drawerDirection"
        :default-size="drawerDefaultSize"
        :safe-area="drawerSafeArea"
        :content-padding="false"
      >
        <div class="px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-1">
          <div class="mb-3">
            <h1 class="text-lg font-bold text-qhx-text dark:text-white">签到花园</h1>
            <p class="text-xs text-qhx-text-muted mt-0.5">
              在这里种下花语，记录穿 Lo 的每一天
            </p>
          </div>

          <div
            class="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3 bg-white dark:bg-gray-800"
          >
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="flex-1 px-2 py-2 text-sm font-medium transition-colors"
              :class="
                activeTab === tab.key
                  ? 'bg-qhx-primary text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
              "
              @click="switchTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <SignInCalendar
            v-if="activeTab === 'calendar'"
            :get-day-meta="getCalendarDayMeta"
            @choose-day="onChooseDay"
            @change-month="onChangeMonth"
          />

          <div v-if="selectedDayComment" class="mb-3 space-y-3">
            <div
              v-if="selectedDayComment.comment_content"
              class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
            >
              <SafeRichText :nodes="parseRichText(selectedDayComment.comment_content)" />
            </div>

            <div
              v-if="selectedDayImages.length > 0"
              class="grid grid-cols-3 gap-2"
            >
              <button
                v-for="(img, index) in selectedDayImages.slice(0, 9)"
                :key="`${img}-${index}`"
                type="button"
                class="relative aspect-square overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                @click="openPreview(selectedDayImages, index)"
              >
                <img
                  :src="toImageUrl(img, 'w_200,h_200')"
                  alt=""
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
                <div
                  v-if="index === 8 && selectedDayImages.length > 9"
                  class="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-lg font-semibold"
                >
                  +{{ selectedDayImages.length - 9 }}
                </div>
              </button>
            </div>
          </div>

          <div
            class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5"
          >
            <div class="flex-1 text-sm text-gray-700 dark:text-gray-200">
              今日装扮楼 <span class="font-semibold text-qhx-primary">{{ total }}</span> 层
              <span class="mx-2 text-gray-300">|</span>
              签到总数 <span class="font-semibold text-qhx-primary">{{ countSignin }}</span>
            </div>
            <UButton
              size="sm"
              :color="isSignedIn ? 'gray' : 'primary'"
              :disabled="isSignedIn"
              @click="openSignInModal"
            >
              {{ isSignedIn ? '已签到' : '签到' }}
            </UButton>
          </div>

          <div class="mb-3 flex flex-wrap items-center gap-4 px-1">
            <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <UCheckbox v-model="filterList.unlimited" @update:model-value="onFilterChange" />
              <span>不限日期</span>
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <UCheckbox v-model="filterList.just_my" @update:model-value="onFilterChange" />
              <span>只看自己</span>
            </label>
          </div>

          <div
            v-if="daily"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <CommentSection
              v-if="commentsReady"
              ref="commentSectionRef"
              :type="'daily'"
              :id="0"
              :daily="daily"
              :filter-list="filterList"
              @total="onCommentTotalChange"
              @count-signin="countSignin = $event"
              @open-reply="openReplyComposer"
            />
          </div>
        </div>
      </QhxBottomDrawer>
    </Transition>

    <div
      v-if="!layoutReady"
      class="fixed inset-0 z-40 flex items-center justify-center text-qhx-text-muted bg-white dark:bg-black"
    >
      加载中...
    </div>

    <UModal v-model="showFlowerCommentModal">
      <div class="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">装扮评论</h3>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="showFlowerCommentModal = false"
          />
        </div>

        <div
          v-if="flowerCommentLoading"
          class="py-10 text-center text-sm text-qhx-text-muted"
        >
          加载中...
        </div>
        <CommentItem
          v-else-if="selectedFlowerComment"
          :item="selectedFlowerComment"
          :need_bottom="false"
          ui="p-0"
        />
        <div v-else class="py-10 text-center text-sm text-qhx-text-muted">
          暂无评论内容
        </div>
      </div>
    </UModal>

    <UModal v-model="showWordAction" prevent-close>
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          「{{ selectedWord }}」
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">为这朵花浇灌一点鼓励</p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="showWordAction = false">取消</UButton>
          <UButton color="primary" :loading="wordCloudLoading" @click="confirmInsertWordCloud">
            +1
          </UButton>
        </div>
      </div>
    </UModal>

    <SignInCommentModal
      ref="signInCommentModalRef"
      v-model="showSignInModal"
      @reload="onSignInReload"
      @fail="fetchSignInStatus"
    />

    <CommunityCommentModal
      ref="commentModalRef"
      v-model="showCommentModal"
      @success="onCommentSuccess"
    />

    <ClientOnly>
      <YearlySummaryLoginModal
        v-model="showLoginModal"
        @success="handleLoginSuccess"
      />
      <QhxImageLightbox
        :visible="previewVisible"
        :imgs="previewImages.map((src) => ({ src }))"
        :index="previewIndex"
        @hide="previewVisible = false"
      />
    </ClientOnly>
  </div>
</template>

