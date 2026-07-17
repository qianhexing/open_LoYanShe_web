<script lang="ts">
definePageMeta({ name: 'gallery-walkthrough' })
</script>

<script setup lang="ts">
import gsap from 'gsap'
import GalleryJoystick from '@/components/gallery/GalleryJoystick.vue'
import GalleryMinimap from '@/components/gallery/GalleryMinimap.vue'
import GalleryShopPanel from '@/components/gallery/GalleryShopPanel.vue'
import GalleryLibraryPanel from '@/components/gallery/GalleryLibraryPanel.vue'
import GalleryMessagePanel from '@/components/gallery/GalleryMessagePanel.vue'
import GalleryLeaveMessageButton from '@/components/gallery/GalleryLeaveMessageButton.vue'
import GalleryCommentTicker from '@/components/gallery/GalleryCommentTicker.vue'
import UserBox from '@/components/UserBox.vue'
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue'
import type CommunityCommentModalType from '@/components/community/CommentModal.vue'
import CommunityCommentModal from '@/components/community/CommentModal.vue'
import type { Comment } from '@/types/api'
import { isComment } from '@/api/comment'
import { useGalleryWalkthrough } from '@/composables/useGalleryWalkthrough'
import {
  GALLERY_COMMENT_TYPE,
  buildGalleryCommentJsonData,
  roundGalleryCoord,
  useGalleryMessages
} from '@/composables/useGalleryMessages'
import { useGalleryWebSocket } from '@/composables/useGalleryWebSocket'
import { fetchGalleryConfigById } from '@/utils/fetchGalleryConfig'
import { BASE_IMG } from '@/utils/ipConfig'

const route = useRoute()
const toast = useToast()
const userStore = useUserStore()
const { user } = storeToRefs(userStore)

const showLoginModal = ref(false)
const showControlsHelp = ref(false)
const sceneReady = ref(false)
const pageRootRef = ref<HTMLElement | null>(null)
let helpHideTimer: ReturnType<typeof setTimeout> | null = null
let gsapCtx: gsap.Context | null = null

const avatarUrl = computed(() => {
  const face = user.value?.user_face?.trim()
  if (!face) return ''
  return /^https?:\/\//i.test(face) ? face : `${BASE_IMG}${face.replace(/^\/+/, '')}`
})

const displayUserName = computed(() => user.value?.user_name?.trim() || '点击登录')

const openLoginModal = () => {
  showLoginModal.value = true
}

const galleryId = computed(() => String(route.params.id ?? ''))

const containerRef = ref<HTMLElement | null>(null)
const configLoading = ref(true)
const configError = ref<string | null>(null)
const showCommentModal = ref(false)
const commentModalRef = ref<InstanceType<typeof CommunityCommentModalType> | null>(null)
/** 打开评论框时锁定的世界坐标，接口未回写 json_data 时作兜底 */
const pendingLeavePosition = ref<[number, number, number] | null>(null)

const {
  loading,
  loadProgress,
  error,
  playerX,
  playerZ,
  cameraYaw,
  isMobile,
  galleryName,
  init,
  dispose,
  setJoystickInput,
  clearJoystickInput,
  nearbyShop,
  selectedShop,
  shopPanelOpen,
  selectedShopDetail,
  shopDetailLoading,
  shopDetailError,
  selectedLibrary,
  selectedLibraryTitle,
  libraryLoading,
  shopVideosLoading,
  nearbyMessage,
  selectedMessage,
  messagePanelOpen,
  setMessageMarkers,
  addMessageMarker,
  removeMessageMarkers,
  activateMessage,
  closeMessagePanel,
  syncRemotePlayers,
  config,
  closeShopPanel
} = useGalleryWalkthrough()

const {
  fetchMessages,
  rememberMessage,
  forgetMessages
} = useGalleryMessages(galleryId)

const onCommentsReplaced = (commentIds: number[]) => {
  if (!commentIds.length) return
  removeMessageMarkers(commentIds)
  forgetMessages(commentIds)
}

const onWsGalleryComment = (comment: Comment) => {
  const marker = rememberMessage(comment)
  if (marker) addMessageMarker(marker)
}

/** 本地位置上报：x/z 水平面，y 高度，rotation 角度 */
const localPosition = computed(() => ({
  x: roundGalleryCoord(playerX.value),
  y: 0,
  z: roundGalleryCoord(playerZ.value),
  rotation: Math.round((cameraYaw.value * 180) / Math.PI)
}))

const { tickerItems, remoteUsers } = useGalleryWebSocket({
  galleryId,
  token: computed(() => userStore.token),
  position: localPosition,
  onComment: onWsGalleryComment
})

watch(
  remoteUsers,
  (list) => {
    syncRemotePlayers(list)
  },
  { deep: true }
)

const closeLibraryPanel = () => {
  selectedLibrary.value = null
  selectedLibraryTitle.value = ''
}

useHead({
  title: () => (galleryName.value ? `${galleryName.value} - 云看展` : '云看展 - Lo研社'),
  meta: [{ name: 'description', content: '3D 线上展馆，自由漫步浏览' }]
})

const onJoystickMove = (x: number, y: number) => setJoystickInput(x, y)
const onJoystickEnd = () => clearJoystickInput()

const syncMessageMarkers = async () => {
  const markers = await fetchMessages()
  setMessageMarkers(markers)
  if (import.meta.dev) {
    console.info(`[gallery] 讯息点位 ${markers.length} 个`)
  }
}

const loadGallery = async (id: string) => {
  configLoading.value = true
  configError.value = null
  sceneReady.value = false

  try {
    const file = await fetchGalleryConfigById(id)

    if (containerRef.value) {
      await init(containerRef.value, file)
      await syncMessageMarkers()
      // 场景就绪后补同步 WS 已收到的在线用户
      syncRemotePlayers(remoteUsers.value)
      sceneReady.value = true
      scheduleControlsHelp()
    }
  } catch (e) {
    console.error('展馆配置加载失败:', e)
    configError.value = e instanceof Error ? e.message : '展馆配置加载失败'
  } finally {
    configLoading.value = false
  }
}

const onOpenNearbyMessage = () => {
  if (nearbyMessage.value) activateMessage(nearbyMessage.value)
}

const openLeaveMessage = async () => {
  if (!userStore.token) {
    openLoginModal()
    return
  }

  const id = Number(galleryId.value)
  if (!Number.isFinite(id) || id <= 0) {
    toast.add({
      title: '展馆参数无效',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  let existingIds: number[] = []
  try {
    existingIds = await isComment({ type: GALLERY_COMMENT_TYPE, id })
  } catch (e) {
    console.error('[gallery] 查询是否已留言失败', e)
    toast.add({
      title: '无法确认留言状态',
      description: e instanceof Error ? e.message : '请稍后重试',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  if (existingIds.length > 0) {
    const ok = window.confirm('您已留下过讯息，再次发布将删除之前的留言，是否继续？')
    if (!ok) return
  }

  // 当前点位世界坐标；玩家贴地行走，y 记地面高度 0
  const x = roundGalleryCoord(playerX.value)
  const y = 0
  const z = roundGalleryCoord(playerZ.value)
  pendingLeavePosition.value = [x, y, z]
  showCommentModal.value = true
  nextTick(() => {
    commentModalRef.value?.showModel({
      id,
      type: GALLERY_COMMENT_TYPE,
      json_data: buildGalleryCommentJsonData(x, y, z),
      replaceCommentIds: existingIds
    })
  })
}

const onCommentSuccess = (comment: Comment) => {
  // 插入接口常不回写 user，用当前登录用户补全
  if ((!comment.user || !comment.user.user_id) && userStore.user) {
    comment = {
      ...comment,
      user: {
        ...userStore.user,
        user_id: userStore.user.user_id,
        user_name: userStore.user.user_name,
        user_face: userStore.user.user_face
      }
    }
  }

  const marker = rememberMessage(comment, pendingLeavePosition.value)
  pendingLeavePosition.value = null
  if (marker) {
    addMessageMarker(marker)
    toast.add({
      title: '讯息已留下',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  }
}

const clearHelpTimer = () => {
  if (helpHideTimer) {
    clearTimeout(helpHideTimer)
    helpHideTimer = null
  }
}

const scheduleControlsHelp = () => {
  clearHelpTimer()
  showControlsHelp.value = true
  helpHideTimer = setTimeout(() => {
    showControlsHelp.value = false
    helpHideTimer = null
  }, 7000)
}

const toggleControlsHelp = () => {
  clearHelpTimer()
  showControlsHelp.value = !showControlsHelp.value
  if (showControlsHelp.value) {
    helpHideTimer = setTimeout(() => {
      showControlsHelp.value = false
      helpHideTimer = null
    }, 8000)
  }
}

onMounted(() => {
  if (galleryId.value) {
    loadGallery(galleryId.value)
  }

  if (pageRootRef.value) {
    gsapCtx = gsap.context(() => {
      gsap.from('.gallery-page__corner', {
        opacity: 0,
        scale: 0.85,
        duration: 1.1,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.2
      })
    }, pageRootRef.value)
  }
})

watch(galleryId, async (newId, oldId) => {
  if (!newId || newId === oldId) return
  dispose()
  await loadGallery(newId)
})

onBeforeUnmount(() => {
  clearHelpTimer()
  gsapCtx?.revert()
  gsapCtx = null
  dispose()
})

const isPageLoading = computed(() => configLoading.value || loading.value)
const pageError = computed(() => configError.value || error.value)

/** 配置阶段约占 10%，场景加载占剩余进度 */
const loadingPercent = computed(() => {
  if (configLoading.value) return 10
  return Math.min(100, Math.round(10 + (loadProgress.value / 100) * 90))
})

const loadingLabel = computed(() => {
  if (configLoading.value) return '解析展馆配置'
  if (loadProgress.value < 40) return '构建场景空间'
  if (loadProgress.value < 75) return '载入展品资产'
  return '校准光照与镜头'
})

const onlineCount = computed(() => remoteUsers.value.length + (user.value ? 1 : 0))

const statusLine = computed(() => {
  const name = galleryName.value || '数字展馆'
  return `${name} · 在线 ${onlineCount.value}`
})

const controlHints = computed(() => {
  if (isMobile.value) {
    return [
      { key: '摇杆', label: '移动' },
      { key: '单指', label: '旋转' },
      { key: '双指', label: '缩放' },
      { key: '靠近', label: '查看讯息' }
    ]
  }
  return [
    { key: 'WASD', label: '移动' },
    { key: '拖拽', label: '视角' },
    { key: '滚轮', label: '缩放' },
    { key: '点击', label: '交互' }
  ]
})
</script>

<template>
  <div ref="pageRootRef" class="gallery-page select-none touch-callout-none">
    <div ref="containerRef" class="gallery-page__canvas" />

    <!-- 电影感遮罩层：暗角 / 胶片颗粒 / 四角准星 -->
    <div class="gallery-page__fx" aria-hidden="true">
      <div class="gallery-page__vignette" />
      <div class="gallery-page__grain" />
      <div class="gallery-page__letterbox gallery-page__letterbox--top" />
      <div class="gallery-page__letterbox gallery-page__letterbox--bottom" />
      <span class="gallery-page__corner gallery-page__corner--tl" />
      <span class="gallery-page__corner gallery-page__corner--tr" />
      <span class="gallery-page__corner gallery-page__corner--bl" />
      <span class="gallery-page__corner gallery-page__corner--br" />
    </div>

    <!-- 入场黑幕 -->
    <div
      class="gallery-page__veil"
      :class="{ 'gallery-page__veil--clear': sceneReady && !isPageLoading && !pageError }"
      aria-hidden="true"
    />

    <Transition name="gallery-load">
      <div v-if="isPageLoading" class="gallery-page__loading" role="status" aria-live="polite">
        <div class="gallery-page__loading-frame">
          <p class="gallery-page__loading-eyebrow">Lo研社 · 云看展</p>
          <h1 class="gallery-page__loading-title">
            {{ galleryName || '正在进入展馆' }}
          </h1>
          <p class="gallery-page__loading-phase">{{ loadingLabel }}</p>

          <div class="gallery-page__loading-bar" aria-hidden="true">
            <div
              class="gallery-page__loading-bar-fill"
              :style="{ width: `${loadingPercent}%` }"
            />
            <div class="gallery-page__loading-bar-glow" :style="{ left: `${loadingPercent}%` }" />
          </div>

          <div class="gallery-page__loading-meta">
            <span>{{ loadingPercent }}%</span>
            <span class="gallery-page__loading-dots">
              <i /><i /><i />
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="pageError" class="gallery-page__error">
      <div class="gallery-page__error-frame">
        <p class="gallery-page__error-eyebrow">连接中断</p>
        <p class="gallery-page__error-text">{{ pageError }}</p>
      </div>
    </div>

    <template v-if="!pageError">
      <div class="gallery-page__header">
        <UserBox v-if="user">
          <template #trigger>
            <button type="button" class="gallery-page__user" aria-label="打开用户菜单">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                :alt="displayUserName"
                class="gallery-page__user-face"
                loading="lazy"
              >
              <span v-else class="gallery-page__user-face gallery-page__user-face--placeholder">
                {{ displayUserName.slice(0, 1) }}
              </span>
              <span class="gallery-page__user-meta">
                <span class="gallery-page__user-name">{{ displayUserName }}</span>
                <span class="gallery-page__user-sub">{{ statusLine }}</span>
              </span>
            </button>
          </template>
        </UserBox>
        <button
          v-else
          type="button"
          class="gallery-page__user"
          aria-label="登录"
          @click="openLoginModal"
        >
          <span class="gallery-page__user-face gallery-page__user-face--guest">?</span>
          <span class="gallery-page__user-meta">
            <span class="gallery-page__user-name">点击登录</span>
            <span class="gallery-page__user-sub">{{ statusLine }}</span>
          </span>
        </button>
      </div>

      <div class="gallery-page__ticker">
        <GalleryCommentTicker :items="tickerItems" />
      </div>

      <div class="gallery-page__minimap">
        <GalleryMinimap
          :config="config"
          :player-x="playerX"
          :player-z="playerZ"
          :camera-yaw="cameraYaw"
          :remote-users="remoteUsers"
        />
      </div>

      <div class="gallery-page__hud-right">
        <button
          type="button"
          class="gallery-page__help-btn"
          :aria-pressed="showControlsHelp"
          :aria-label="showControlsHelp ? '隐藏操作提示' : '显示操作提示'"
          @click="toggleControlsHelp"
        >
          <span class="gallery-page__help-btn-key">?</span>
          <span class="gallery-page__help-btn-label">操作</span>
        </button>
      </div>

      <Transition name="gallery-hint">
        <div
          v-if="showControlsHelp && sceneReady && !isPageLoading"
          class="gallery-page__hints"
          role="note"
        >
          <span class="gallery-page__hints-label">CONTROLS</span>
          <div class="gallery-page__hints-row">
            <span
              v-for="hint in controlHints"
              :key="hint.key"
              class="gallery-page__hint-chip"
            >
              <kbd>{{ hint.key }}</kbd>
              <span>{{ hint.label }}</span>
            </span>
          </div>
        </div>
      </Transition>

      <div
        v-if="sceneReady && !isPageLoading"
        class="gallery-page__crosshair"
        aria-hidden="true"
      >
        <span />
        <span />
      </div>

      <div v-if="isMobile" class="gallery-page__joystick">
        <GalleryJoystick @move="onJoystickMove" @end="onJoystickEnd" />
      </div>
    </template>

    <GalleryShopPanel
      :open="shopPanelOpen"
      :shop="selectedShop"
      :shop-detail="selectedShopDetail"
      :loading="shopDetailLoading"
      :error="shopDetailError"
      :nearby="!!nearbyShop"
      :objects-loading="shopVideosLoading"
      @close="closeShopPanel"
    />

    <GalleryLibraryPanel
      :library="selectedLibrary"
      :loading="libraryLoading"
      :title="selectedLibraryTitle"
      @close="closeLibraryPanel"
    />

    <GalleryMessagePanel
      :open="messagePanelOpen"
      :message="selectedMessage"
      :nearby="!!nearbyMessage"
      @close="closeMessagePanel"
      @open-nearby="onOpenNearbyMessage"
    />

    <GalleryLeaveMessageButton @click="openLeaveMessage" />

    <ClientOnly>
      <CommunityCommentModal
        ref="commentModalRef"
        v-model="showCommentModal"
        @replaced="onCommentsReplaced"
        @success="onCommentSuccess"
      />
      <YearlySummaryLoginModal v-model="showLoginModal" />
    </ClientOnly>
  </div>
</template>

<style scoped>
.gallery-page {
  --g-bg: #0c0a10;
  --g-ink: #f2e8ec;
  --g-mute: rgba(242, 232, 236, 0.48);
  --g-accent: #e8a4b4;
  --g-accent-dim: rgba(232, 164, 180, 0.35);
  --g-panel: rgba(10, 8, 14, 0.72);
  --g-line: rgba(255, 255, 255, 0.14);
  --g-line-strong: rgba(232, 164, 180, 0.45);

  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--g-bg);
  color: var(--g-ink);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.gallery-page :is(input, textarea, [contenteditable='true']) {
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
}

.gallery-page__canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}

/* —— 电影感叠加层 —— */
.gallery-page__fx {
  position: absolute;
  inset: 0;
  z-index: 12;
  pointer-events: none;
}

.gallery-page__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 78% 74% at 50% 46%, transparent 55%, rgba(0, 0, 0, 0.22) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, transparent 16%, transparent 84%, rgba(0, 0, 0, 0.14) 100%);
}

.gallery-page__grain {
  position: absolute;
  inset: 0;
  opacity: 0.045;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  animation: gallery-grain 0.8s steps(2) infinite;
}

.gallery-page__letterbox {
  position: absolute;
  left: 0;
  right: 0;
  height: clamp(10px, 1.6vh, 18px);
  background: #050408;
}

.gallery-page__letterbox--top {
  top: 0;
}

.gallery-page__letterbox--bottom {
  bottom: 0;
}

.gallery-page__corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: var(--g-accent-dim);
  border-style: solid;
  opacity: 0.85;
}

.gallery-page__corner--tl {
  top: 22px;
  left: 18px;
  border-width: 2px 0 0 2px;
}

.gallery-page__corner--tr {
  top: 22px;
  right: 18px;
  border-width: 2px 2px 0 0;
}

.gallery-page__corner--bl {
  bottom: 22px;
  left: 18px;
  border-width: 0 0 2px 2px;
}

.gallery-page__corner--br {
  bottom: 22px;
  right: 18px;
  border-width: 0 2px 2px 0;
}

.gallery-page__veil {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: #050408;
  opacity: 1;
  pointer-events: none;
  transition: opacity 1.1s cubic-bezier(0.22, 1, 0.36, 1);
}

.gallery-page__veil--clear {
  opacity: 0;
}

/* —— 加载 —— */
.gallery-page__loading {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse 60% 50% at 50% 40%, rgba(60, 28, 40, 0.55), transparent 70%),
    #08060c;
}

.gallery-page__loading-frame {
  width: min(420px, calc(100vw - 48px));
  padding: 8px 4px;
  text-align: center;
}

.gallery-page__loading-eyebrow {
  margin: 0 0 12px;
  color: var(--g-accent);
  font-size: 11px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.gallery-page__loading-title {
  margin: 0;
  color: var(--g-ink);
  font-size: clamp(22px, 4vw, 30px);
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 1.25;
}

.gallery-page__loading-phase {
  margin: 14px 0 28px;
  color: var(--g-mute);
  font-size: 13px;
  letter-spacing: 0.12em;
}

.gallery-page__loading-bar {
  position: relative;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  overflow: visible;
}

.gallery-page__loading-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8a4a5c, var(--g-accent), #f0d0d8);
  box-shadow: 0 0 12px rgba(232, 164, 180, 0.55);
  transition: width 0.25s ease-out;
}

.gallery-page__loading-bar-glow {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 16px 4px rgba(232, 164, 180, 0.7);
  transition: left 0.25s ease-out;
  pointer-events: none;
}

.gallery-page__loading-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  color: rgba(242, 232, 236, 0.55);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.16em;
}

.gallery-page__loading-dots {
  display: inline-flex;
  gap: 5px;
}

.gallery-page__loading-dots i {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--g-accent);
  opacity: 0.35;
  animation: gallery-dot 1.2s ease-in-out infinite;
}

.gallery-page__loading-dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.gallery-page__loading-dots i:nth-child(3) {
  animation-delay: 0.4s;
}

.gallery-load-enter-active,
.gallery-load-leave-active {
  transition: opacity 0.55s ease;
}

.gallery-load-enter-from,
.gallery-load-leave-to {
  opacity: 0;
}

/* —— 错误 —— */
.gallery-page__error {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08060c;
}

.gallery-page__error-frame {
  max-width: 360px;
  padding: 28px 24px;
  border: 1px solid rgba(255, 100, 100, 0.35);
  background: rgba(30, 10, 14, 0.85);
  text-align: center;
}

.gallery-page__error-eyebrow {
  margin: 0 0 10px;
  color: #ff8a8a;
  font-size: 11px;
  letter-spacing: 0.28em;
}

.gallery-page__error-text {
  margin: 0;
  color: #ffb4b4;
  font-size: 14px;
  line-height: 1.6;
}

/* —— HUD —— */
.gallery-page__header {
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 20;
  pointer-events: auto;
}

.gallery-page__ticker {
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 21;
}

.gallery-page__user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 5px 14px 5px 5px;
  border: 1px solid var(--g-line);
  border-radius: 2px;
  background: var(--g-panel);
  backdrop-filter: blur(12px) saturate(1.15);
  color: inherit;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.gallery-page__user:hover {
  transform: translateY(-1px);
  border-color: var(--g-line-strong);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(232, 164, 180, 0.12);
}

.gallery-page__user-face {
  width: 34px;
  height: 34px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.gallery-page__user-face--placeholder,
.gallery-page__user-face--guest {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(216, 136, 152, 0.22);
  color: var(--g-accent);
  font-size: 13px;
  font-weight: 600;
}

.gallery-page__user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  gap: 2px;
}

.gallery-page__user-name {
  max-width: 148px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--g-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.gallery-page__user-sub {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--g-mute);
  font-size: 10px;
  line-height: 1.2;
  letter-spacing: 0.06em;
}

.gallery-page__minimap {
  position: absolute;
  top: 28px;
  right: 28px;
  z-index: 20;
}

.gallery-page__hud-right {
  position: absolute;
  top: 188px;
  right: 28px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gallery-page__help-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 7px 12px 7px 8px;
  border: 1px solid var(--g-line);
  border-radius: 2px;
  background: var(--g-panel);
  backdrop-filter: blur(12px);
  color: var(--g-mute);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.gallery-page__help-btn:hover,
.gallery-page__help-btn[aria-pressed='true'] {
  border-color: var(--g-line-strong);
  color: var(--g-ink);
}

.gallery-page__help-btn-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  color: var(--g-accent);
  font-size: 12px;
  font-weight: 600;
}

.gallery-page__help-btn-label {
  font-size: 11px;
  letter-spacing: 0.14em;
}

.gallery-page__hints {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 14px;
  background: var(--g-panel);
  border: 1px solid var(--g-line);
  backdrop-filter: blur(14px) saturate(1.1);
  pointer-events: none;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
}

.gallery-page__hints-label {
  color: var(--g-accent);
  font-size: 9px;
  letter-spacing: 0.36em;
}

.gallery-page__hints-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 14px;
}

.gallery-page__hint-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: rgba(242, 232, 236, 0.62);
  font-size: 12px;
}

.gallery-page__hint-chip kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-bottom-width: 2px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--g-ink);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.gallery-hint-enter-active,
.gallery-hint-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.gallery-hint-enter-from,
.gallery-hint-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.gallery-page__crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 13;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  pointer-events: none;
  opacity: 0.35;
}

.gallery-page__crosshair span {
  position: absolute;
  background: rgba(242, 232, 236, 0.85);
}

.gallery-page__crosshair span:first-child {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  margin-left: -0.5px;
}

.gallery-page__crosshair span:last-child {
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  margin-top: -0.5px;
}

.gallery-page__joystick {
  position: absolute;
  bottom: 88px;
  left: 28px;
  z-index: 25;
}

@media (max-width: 767px) {
  .gallery-page__vignette {
    background:
      radial-gradient(ellipse 82% 78% at 50% 46%, transparent 62%, rgba(0, 0, 0, 0.12) 100%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, transparent 12%, transparent 88%, rgba(0, 0, 0, 0.08) 100%);
  }

  .gallery-page__header {
    top: 20px;
    left: 16px;
  }

  .gallery-page__ticker {
    top: 20px;
    width: calc(100% - 200px);
  }

  .gallery-page__minimap {
    top: 20px;
    right: 16px;
  }

  .gallery-page__hud-right {
    top: auto;
    bottom: 168px;
    right: 16px;
  }

  .gallery-page__hints {
    bottom: 20px;
    max-width: calc(100vw - 32px);
    padding: 10px 12px 12px;
  }

  .gallery-page__corner--tl,
  .gallery-page__corner--tr {
    top: 14px;
  }

  .gallery-page__corner--bl,
  .gallery-page__corner--br {
    bottom: 14px;
  }

  .gallery-page__corner--tl,
  .gallery-page__corner--bl {
    left: 12px;
  }

  .gallery-page__corner--tr,
  .gallery-page__corner--br {
    right: 12px;
  }

  .gallery-page__letterbox {
    height: 8px;
  }

  .gallery-page__crosshair {
    opacity: 0.2;
  }
}

@keyframes gallery-grain {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-2%, 1%);
  }
}

@keyframes gallery-dot {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gallery-page__grain,
  .gallery-page__loading-dots i {
    animation: none;
  }

  .gallery-page__veil {
    transition-duration: 0.01ms;
  }
}
</style>
