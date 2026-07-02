<script setup lang="ts">
import type { Album } from '@/types/api'
import type AlbumAddEdit from '@/components/Album/AlbumAddEdit.vue'
import { unsubscribeAlbum } from '@/api/album'
import { BASE_IMG } from '@/utils/ipConfig'
import useScrollBottom from '@/composables/useScrollBottom'
import {
  getAlbumItemProgress,
  isAlbumItemCompleted,
  useAlbumIndexPage,
} from '@/composables/useAlbumIndexPage'
import { openAlbumDetail } from '@/composables/useLibraryDetailNavigation'

const configStore = useConfigStore()
const userStore = useUserStore()
const toast = useToast()
const layoutReady = inject('layoutReady') as Ref<boolean> | undefined

const albumAddEditRef = ref<InstanceType<typeof AlbumAddEdit> | null>(null)

const {
  PAGE_SIZE,
  displayBadgeStr,
  achievementStats,
  statsLoading,
  list,
  total,
  page,
  listLoading,
  listLoadingMore,
  displayBadges,
  hasDisplayBadges,
  badgesLoaded,
  displayBadgesKey,
  hasMoreAlbums,
  fetchUserBadges,
  loadMoreAlbums,
  refreshPage,
  fetchAchievementStats,
} = useAlbumIndexPage()

const decoConfigModalOpen = ref(false)
const decoModalPosition = ref({ x: 0, y: 0 })
const marketModalOpen = ref(false)
const marketModalPosition = ref({ x: 0, y: 0 })
const showUnsubscribeConfirm = ref(false)
const pendingUnsubscribeItem = ref<Album | null>(null)
const unsubscribeConfirmPosition = ref({ x: 0, y: 0 })
const unsubscribingId = ref<number | null>(null)

const decoInitialSelectedIds = computed(() =>
  displayBadgeStr.value
    ? displayBadgeStr.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : [],
)

const openDecoConfig = (event?: MouseEvent) => {
  if (event) {
    decoModalPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    decoModalPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
  decoConfigModalOpen.value = true
}

const onDecoSaved = () => {
  fetchUserBadges()
}

const openMarketModal = (event?: MouseEvent) => {
  if (event) {
    marketModalPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    marketModalPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
  marketModalOpen.value = true
}

const onMarketSubscribed = () => {
  refreshPage()
}

const onMarketUnsubscribed = () => {
  refreshPage()
}

const isAlbumSubscribed = (item: Album) => item.source_type === 'subscribed'

const openUnsubscribeConfirm = (item: Album, event: MouseEvent) => {
  event.stopPropagation()
  if (!ensureLoggedIn()) return
  if (!isAlbumSubscribed(item)) return

  pendingUnsubscribeItem.value = item
  unsubscribeConfirmPosition.value = { x: event.clientX, y: event.clientY }
  showUnsubscribeConfirm.value = true
}

const cancelUnsubscribe = () => {
  showUnsubscribeConfirm.value = false
  pendingUnsubscribeItem.value = null
}

const confirmUnsubscribe = async () => {
  const item = pendingUnsubscribeItem.value
  if (!item || !isAlbumSubscribed(item)) {
    cancelUnsubscribe()
    return
  }

  unsubscribingId.value = item.album_id
  try {
    await unsubscribeAlbum({ album_id: item.album_id })
    list.value = list.value.filter((album) => album.album_id !== item.album_id)
    total.value = Math.max(0, total.value - 1)
    toast.add({
      title: '已取消订阅',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    cancelUnsubscribe()
    await fetchAchievementStats()
  } catch {
    // 错误提示由 http 拦截器统一处理
  } finally {
    unsubscribingId.value = null
  }
}

const goAlbumDetail = (item: Album) => {
  openAlbumDetail({ albumId: item.album_id })
}

const isAlbumOwned = (item: Album) => item.source_type === 'owned'

const isAlbumPublic = (item: Album) => (item.is_private ?? 1) === 0

const canEditAlbum = (item: Album) => isAlbumOwned(item)

const ensureLoggedIn = () => {
  if (userStore.token) return true
  toast.add({
    title: '请先登录',
    icon: 'i-heroicons-exclamation-circle',
    color: 'orange',
  })
  return false
}

const openAddAlbum = (event?: MouseEvent) => {
  if (!ensureLoggedIn()) return
  albumAddEditRef.value?.showModel(undefined, event)
}

const openEditAlbum = (item: Album, event: MouseEvent) => {
  event.stopPropagation()
  if (!ensureLoggedIn()) return
  albumAddEditRef.value?.showModel(item.album_id, event)
}

const onAlbumSaved = () => {
  refreshPage()
}

useScrollBottom(
  async () => {
    if (hasMoreAlbums.value) {
      await loadMoreAlbums()
    }
  },
  { distance: 300, immediate: false },
)

watch(
  () => layoutReady?.value ?? true,
  (ready) => {
    if (ready) refreshPage()
  },
  { immediate: true },
)

useHead({
  title: '成就相册',
  meta: [
    { name: 'keywords', content: 'Lo研社,成就相册,Lolita相册' },
    { name: 'description', content: 'Lolita成就相册' },
  ],
})
</script>

<template>
  <div class="album-page container mx-auto min-h-screen overflow-hidden bg-qhx-bg pb-20 safe-area-page">
    <div
      v-if="configStore.statusBarHeight > 0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

    <!-- 徽章 + 成就统计 Hero 卡（布局参考用户空间） -->
    <section
      class="album-hero-card relative mx-4 mt-2 overflow-visible rounded-3xl border border-white/60 bg-white/55 shadow-xl backdrop-blur-xl dark:border-gray-700/70 dark:bg-gray-800/55"
    >
      <!-- 顶部 Banner：有徽章时展示物理动画，否则渐变装饰 -->
      <div
        class="hero-banner relative w-full overflow-hidden rounded-t-3xl"
        :class="hasDisplayBadges ? 'h-[120px] md:h-[150px]' : 'h-[96px] md:h-[120px]'"
      >
        <template v-if="hasDisplayBadges">
          <div class="hero-banner-bg absolute inset-0">
            <AchievementBadgePhysics
              :key="displayBadgesKey"
              :badges="displayBadges"
              :badge-size="40"
              :spawn-interval="400"
              motion-preset="wallBounce"
            />
          </div>
        </template>
        <template v-else-if="badgesLoaded">
          <div class="absolute inset-0 bg-gradient-to-br from-pink-300/70 via-rose-200/60 to-purple-300/70 dark:from-pink-800/40 dark:via-rose-900/30 dark:to-purple-800/40" />
          <div class="absolute inset-0 bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.08]" />
          <span class="hero-spark absolute left-[12%] top-[28%] select-none text-2xl">✨</span>
          <span class="hero-spark absolute right-[16%] top-[20%] select-none text-xl">🎀</span>
          <span class="hero-spark absolute bottom-[18%] right-[34%] select-none text-lg">💗</span>
        </template>
        <div v-else class="absolute inset-0 flex items-center justify-center">
          <UIcon name="i-heroicons-arrow-path" class="h-10 w-10 animate-spin text-qhx-primary" />
        </div>

        <!-- 渐隐遮罩，衔接下方统计区 -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/70 to-transparent dark:from-gray-800/70" />

        <button
          type="button"
          class="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-gray-200/60 bg-white/85 py-1.5 pl-2 pr-3 text-qhx-primary shadow-md backdrop-blur-sm transition-colors hover:bg-pink-50 dark:border-gray-600/60 dark:bg-gray-800/85 dark:hover:bg-gray-700/85"
          @click="openDecoConfig"
        >
          <UIcon name="i-heroicons-cog-6-tooth" class="h-5 w-5 flex-shrink-0" />
          <span class="text-sm font-medium">配置徽章</span>
        </button>
      </div>

      <!-- 下方统计区：与徽章 Banner 连成一体 -->
      <div class="hero-body px-4 pb-4 pt-3 md:px-5">
        <div v-if="statsLoading" class="flex justify-center py-6">
          <div class="flex items-center gap-1.5">
            <span class="stats-loading-dot" />
            <span class="stats-loading-dot" />
            <span class="stats-loading-dot" />
          </div>
        </div>
        <div v-else-if="achievementStats" class="achievement-stats-panel">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <span>✨</span>
            成就进度
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div class="stat-item rounded-2xl border border-white/50 bg-white/45 px-1 py-2.5 dark:border-gray-600/40 dark:bg-gray-700/40">
              <div class="text-lg font-bold tabular-nums text-qhx-primary dark:text-pink-300">
                {{ achievementStats.points }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">成就点</div>
            </div>
            <div class="stat-item rounded-2xl border border-white/50 bg-white/45 px-1 py-2.5 dark:border-gray-600/40 dark:bg-gray-700/40">
              <div class="text-lg font-bold tabular-nums text-gray-800 dark:text-gray-100">
                {{ achievementStats.achieved_count }}<span class="text-gray-400">/</span>{{ achievementStats.total_count }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">已达成</div>
            </div>
            <div class="col-span-2">
              <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                <div
                  class="progress-fill h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 dark:from-pink-400 dark:to-purple-400"
                  :style="{ width: `${achievementStats.progress}%` }"
                />
              </div>
              <div class="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                {{ achievementStats.progress }}% 完成
              </div>
            </div>
          </div>
        </div>
        <div
          v-else-if="badgesLoaded"
          class="py-4 text-center text-sm text-gray-400 dark:text-gray-500"
        >
          暂无成就统计数据
        </div>
      </div>
    </section>

    <AchievementDecoConfigModal
      v-model="decoConfigModalOpen"
      :trigger-position="decoModalPosition"
      :initial-selected-ids="decoInitialSelectedIds"
      @saved="onDecoSaved"
    />

    <AlbumMarketModal
      v-model="marketModalOpen"
      :trigger-position="marketModalPosition"
      @subscribed="onMarketSubscribed"
      @unsubscribed="onMarketUnsubscribed"
    />

    <!-- 成就相册列表 -->
    <section class="album-content px-4 pt-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">成就相册</h2>
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            variant="soft"
            icon="i-heroicons-building-storefront"
            class="border-qhx-primary/30 bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20"
            @click="openMarketModal"
          >
            成就市场
          </UButton>
          <UButton
            size="sm"
            icon="i-heroicons-plus"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            @click="openAddAlbum"
          >
            新建相册
          </UButton>
        </div>
      </div>

      <div v-if="listLoading" class="flex justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-qhx-primary" />
      </div>

      <div
        v-else-if="list.length > 0"
        class="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
      >
        <article
          v-for="item in list"
          :key="item.album_id"
          class="album-card group"
          @click="goAlbumDetail(item)"
        >
          <div class="album-card-inner">
            <div class="album-cover">
              <img
                :src="`${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`"
                :alt="item.album_title"
                class="album-img"
                loading="lazy"
              />

              <div
                v-if="isAlbumItemCompleted(item)"
                class="album-complete-badge"
                :class="{ 'album-complete-badge--stacked': isAlbumSubscribed(item) || canEditAlbum(item) }"
              >
                <UIcon name="i-heroicons-check-circle" class="h-3.5 w-3.5" />
                已完成
              </div>

              <div v-if="isAlbumSubscribed(item)" class="album-subscribed-badge">
                <UIcon name="i-heroicons-bookmark" class="h-3 w-3" />
                已订阅
              </div>

              <div
                v-else-if="isAlbumOwned(item) && isAlbumPublic(item)"
                class="album-public-badge"
              >
                <UIcon name="i-heroicons-globe-alt" class="h-3 w-3" />
                公开
              </div>

              <button
                v-if="canEditAlbum(item)"
                type="button"
                class="album-edit-btn"
                aria-label="编辑相册"
                @click="openEditAlbum(item, $event)"
              >
                <UIcon name="i-heroicons-pencil-square" class="h-3.5 w-3.5" />
              </button>

              <button
                v-if="isAlbumSubscribed(item)"
                type="button"
                class="album-unsubscribe-btn"
                title="取消订阅"
                aria-label="取消订阅"
                @click="openUnsubscribeConfirm(item, $event)"
              >
                <UIcon name="i-heroicons-bookmark-slash" class="h-3.5 w-3.5" />
              </button>

              <div class="album-overlay">
                <div class="album-overlay-content">
                  <h3 class="album-title">{{ item.album_title }}</h3>
                  <div v-if="item.count" class="album-progress-wrap">
                    <div class="album-progress-meta">
                      <span>{{ item.count_achieve ?? 0 }}/{{ item.count }}</span>
                      <span>{{ getAlbumItemProgress(item) }}%</span>
                    </div>
                    <div class="album-progress-bar">
                      <div
                        class="album-progress-fill"
                        :style="{ width: `${getAlbumItemProgress(item)}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <UIcon name="i-heroicons-photo" class="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
        <p class="text-gray-500 dark:text-gray-400">暂无成就相册</p>
        <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">创建你的第一个打卡成就簿吧</p>
        <UButton
          class="mt-4 bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          icon="i-heroicons-plus"
          @click="openAddAlbum"
        >
          新建相册
        </UButton>
      </div>

      <QhxLoading
        v-if="!listLoading"
        :loading="listLoadingMore"
        :page="page"
        :total="total"
        :page-size="PAGE_SIZE"
        @load-more="loadMoreAlbums"
      />
    </section>

    <AlbumAddEdit ref="albumAddEditRef" @success="onAlbumSaved" />

    <QhxModal
      v-model="showUnsubscribeConfirm"
      :trigger-position="unsubscribeConfirmPosition"
      :close-on-backdrop="false"
      @close="cancelUnsubscribe"
    >
      <div class="w-[90vw] max-w-md overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <UIcon name="i-heroicons-bookmark-slash" class="h-5 w-5 text-amber-500" />
            取消订阅
          </h3>
        </div>
        <div class="space-y-4 px-6 py-4">
          <div class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              此操作不是删除成就簿
            </p>
            <p class="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300/90">
              仅从「我的打卡目标」中移除订阅关系，原作者的成就簿仍会保留，之后可在成就市场重新添加。
            </p>
          </div>
          <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            确定取消订阅
            <span class="font-medium text-gray-900 dark:text-gray-100">
              「{{ pendingUnsubscribeItem?.album_title }}」
            </span>
            吗？
          </p>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <UButton color="gray" variant="outline" @click="cancelUnsubscribe">暂不取消</UButton>
          <UButton
            color="amber"
            variant="soft"
            icon="i-heroicons-bookmark-slash"
            :loading="unsubscribingId === pendingUnsubscribeItem?.album_id"
            @click="confirmUnsubscribe"
          >
            确认取消订阅
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<style scoped>
.album-page {
  min-height: 100vh;
}

.safe-area-page {
  padding-top: env(safe-area-inset-top, 0px);
}

.album-hero-card {
  isolation: isolate;
}

.hero-banner-bg {
  background: linear-gradient(
    180deg,
    rgba(255, 248, 248, 0.95) 0%,
    rgba(254, 242, 242, 0.85) 50%,
    rgba(255, 250, 250, 0.95) 100%
  );
}

.dark .hero-banner-bg {
  background: linear-gradient(
    180deg,
    rgba(30, 30, 30, 0.95) 0%,
    rgba(40, 35, 40, 0.85) 50%,
    rgba(35, 30, 35, 0.95) 100%
  );
}

.hero-spark {
  animation: floatSpark 4s ease-in-out infinite;
}

.hero-spark:nth-child(4) {
  animation-delay: 0.8s;
}

.hero-spark:nth-child(5) {
  animation-delay: 1.6s;
}

@keyframes floatSpark {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-8px) rotate(6deg);
  }
}

.stats-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color);
  opacity: 0.8;
  animation: stats-bounce 0.8s ease-in-out infinite alternate;
}

.stats-loading-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.stats-loading-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes stats-bounce {
  to {
    transform: translateY(-4px);
    opacity: 0.5;
  }
}

.progress-fill {
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.album-card {
  cursor: pointer;
  transition: transform 0.3s ease;
}

.album-card:hover {
  transform: translateY(-4px);
}

.album-card-inner {
  overflow: hidden;
  border: 1px solid rgba(243, 243, 243, 0.8);
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08), 0 1.5px 4px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
}

.album-card:hover .album-card-inner {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08);
}

.album-cover {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

.album-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.album-card:hover .album-img {
  transform: scale(1.05);
}

.album-complete-badge {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.92);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
}

.album-complete-badge--stacked {
  top: 2.55rem;
}

.album-edit-btn {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  transition: background 0.2s ease;
}

.album-edit-btn:hover {
  background: rgba(0, 0, 0, 0.72);
}

.album-subscribed-badge {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: rgba(14, 165, 233, 0.92);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
}

.album-public-badge {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: rgba(139, 92, 246, 0.92);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.35);
}

.album-unsubscribe-btn {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  background: rgba(217, 119, 6, 0.92);
  color: #fff;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.35);
  transition: background 0.2s ease;
}

.album-unsubscribe-btn:hover {
  background: rgba(180, 83, 9, 0.96);
}

.album-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  padding: 1rem 1.25rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 50%);
}

.album-overlay-content {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.5rem;
}

.album-title {
  display: -webkit-box;
  overflow: hidden;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.album-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.album-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
}

.album-progress-bar {
  height: 4px;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.25);
}

.album-progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--primary-color, #ff9eb5);
  transition: width 0.4s ease;
}

.dark .album-card-inner {
  border-color: rgba(51, 65, 85, 0.6);
  background: rgb(31 41 55);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}

.dark .album-unsubscribe-btn {
  background: rgba(217, 119, 6, 0.88);
}

.dark .album-unsubscribe-btn:hover {
  background: rgba(180, 83, 9, 0.95);
}

@media (prefers-reduced-motion: reduce) {
  .hero-spark,
  .stats-loading-dot {
    animation: none !important;
  }
}
</style>
