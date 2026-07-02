<script setup lang="ts">
import {
  getAlbumDiscover,
  subscribeAlbum,
  unsubscribeAlbum,
} from '@/api/album'
import {
  getAlbumItemProgress,
  isAlbumItemCompleted,
} from '@/composables/useAlbumIndexPage'
import { openAlbumDetail } from '@/composables/useLibraryDetailNavigation'
import { BASE_IMG } from '@/utils/ipConfig'
import type { Album } from '@/types/api'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    triggerPosition?: { x: number; y: number }
  }>(),
  {},
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'subscribed'): void
  (e: 'unsubscribed'): void
}>()

const userStore = useUserStore()
const toast = useToast()

const PAGE_SIZE = 10
const list = ref<Album[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const subscribingId = ref<number | null>(null)
const unsubscribingId = ref<number | null>(null)
const showSubscribeConfirm = ref(false)
const pendingSubscribeItem = ref<Album | null>(null)
const subscribeConfirmPosition = ref({ x: 0, y: 0 })
const showUnsubscribeConfirm = ref(false)
const pendingUnsubscribeItem = ref<Album | null>(null)
const unsubscribeConfirmPosition = ref({ x: 0, y: 0 })

const hasMore = computed(() => list.value.length < total.value)

const canSubscribe = (item: Album) => {
  if (item.is_subscribed) return false
  if (item.source_type === 'subscribed') return false
  if (item.source_type === 'owned') return false
  if (item.source_type === 'system') return false
  return true
}

const isSubscribed = (item: Album) =>
  item.is_subscribed === true || item.source_type === 'subscribed'

const fetchList = async (isLoadMore = false) => {
  if (isLoadMore) {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  } else {
    loading.value = true
    page.value = 1
    list.value = []
  }

  try {
    const res = await getAlbumDiscover({
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    total.value = res.count ?? 0
    const rows = res.rows ?? []
    if (isLoadMore) {
      list.value.push(...rows)
    } else {
      list.value = rows
    }
  } catch (error) {
    console.error('获取成就市场失败:', error)
    if (!isLoadMore) {
      list.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loading.value || loadingMore.value) return
  page.value += 1
  await fetchList(true)
}

const close = () => {
  cancelSubscribeConfirm()
  cancelUnsubscribeConfirm()
  emit('update:modelValue', false)
}

const previewAlbum = (item: Album) => {
  openAlbumDetail({
    albumId: item.album_id,
    userId: item.user_id,
  })
}

const handleSubscribe = (item: Album, event: MouseEvent) => {
  event.stopPropagation()
  if (!userStore.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }
  if (!canSubscribe(item)) return

  pendingSubscribeItem.value = item
  subscribeConfirmPosition.value = { x: event.clientX, y: event.clientY }
  showSubscribeConfirm.value = true
}

const cancelSubscribeConfirm = () => {
  showSubscribeConfirm.value = false
  pendingSubscribeItem.value = null
}

const confirmSubscribe = async () => {
  const item = pendingSubscribeItem.value
  if (!item || !canSubscribe(item)) {
    cancelSubscribeConfirm()
    return
  }

  subscribingId.value = item.album_id
  try {
    await subscribeAlbum({ album_id: item.album_id, sort: 0 })
    item.is_subscribed = true
    item.source_type = 'subscribed'
    toast.add({
      title: '已添加到我的目标',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    emit('subscribed')
    cancelSubscribeConfirm()
  } catch {
    // 错误提示由 http 拦截器统一处理
  } finally {
    subscribingId.value = null
  }
}

const handleUnsubscribe = (item: Album, event: MouseEvent) => {
  event.stopPropagation()
  if (!userStore.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }
  if (!isSubscribed(item)) return

  pendingUnsubscribeItem.value = item
  unsubscribeConfirmPosition.value = { x: event.clientX, y: event.clientY }
  showUnsubscribeConfirm.value = true
}

const cancelUnsubscribeConfirm = () => {
  showUnsubscribeConfirm.value = false
  pendingUnsubscribeItem.value = null
}

const confirmUnsubscribe = async () => {
  const item = pendingUnsubscribeItem.value
  if (!item || !isSubscribed(item)) {
    cancelUnsubscribeConfirm()
    return
  }

  unsubscribingId.value = item.album_id
  try {
    await unsubscribeAlbum({ album_id: item.album_id })
    item.is_subscribed = false
    item.source_type = 'public'
    toast.add({
      title: '已取消订阅',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    emit('unsubscribed')
    cancelUnsubscribeConfirm()
  } catch {
    // 错误提示由 http 拦截器统一处理
  } finally {
    unsubscribingId.value = null
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) fetchList(false)
  },
)
</script>

<template>
  <QhxModal
    :model-value="modelValue"
    :trigger-position="triggerPosition"
    @update:model-value="emit('update:modelValue', $event)"
    @close="close"
  >
    <div
      class="market-modal flex max-h-[85vh] w-[95vw] max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-2xl backdrop-blur-xl dark:border-gray-600/60 dark:bg-gray-800"
    >
      <div
        class="flex shrink-0 items-center justify-between border-b border-gray-200/60 px-5 py-4 dark:border-gray-600/60"
      >
        <h2 class="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
          <UIcon name="i-heroicons-building-storefront" class="h-5 w-5 text-qhx-primary" />
          成就市场
        </h2>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="关闭"
          @click="close"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
          浏览其他用户公开的成就簿，添加后可加入你的打卡目标
        </p>

        <div v-if="loading" class="flex justify-center py-16">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-qhx-primary" />
        </div>

        <div
          v-else-if="list.length > 0"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <article
            v-for="item in list"
            :key="item.album_id"
            class="market-card group cursor-pointer"
            @click="previewAlbum(item)"
          >
            <div class="market-card-inner">
              <div class="market-cover">
                <img
                  :src="`${BASE_IMG}${item.album_cover || 'static/plan_cover/default.jpg'}`"
                  :alt="item.album_title"
                  class="market-img"
                  loading="lazy"
                />

                <div
                  v-if="isAlbumItemCompleted(item)"
                  class="market-complete-badge"
                  :class="{ 'market-complete-badge--stacked': isSubscribed(item) }"
                >
                  <UIcon name="i-heroicons-check-circle" class="h-3.5 w-3.5" />
                  已完成
                </div>

                <div v-if="isSubscribed(item)" class="market-subscribed-badge">
                  <UIcon name="i-heroicons-bookmark" class="h-3 w-3" />
                  已订阅
                </div>

                <button
                  v-if="isSubscribed(item)"
                  type="button"
                  class="market-unsubscribe-btn"
                  title="取消订阅"
                  aria-label="取消订阅"
                  :disabled="unsubscribingId === item.album_id"
                  @click="handleUnsubscribe(item, $event)"
                >
                  <UIcon
                    :name="unsubscribingId === item.album_id ? 'i-heroicons-arrow-path' : 'i-heroicons-bookmark-slash'"
                    :class="unsubscribingId === item.album_id ? 'animate-spin' : ''"
                    class="h-3.5 w-3.5"
                  />
                </button>

                <div class="market-overlay">
                  <h3 class="market-title">{{ item.album_title }}</h3>
                  <p
                    v-if="item.album_desc"
                    class="market-desc"
                  >
                    {{ item.album_desc }}
                  </p>
                  <div v-if="item.count" class="market-progress-wrap">
                    <div class="market-progress-meta">
                      <span>{{ item.count_achieve ?? 0 }}/{{ item.count }} 目标</span>
                      <span>{{ getAlbumItemProgress(item) }}%</span>
                    </div>
                    <div class="market-progress-bar">
                      <div
                        class="market-progress-fill"
                        :style="{ width: `${getAlbumItemProgress(item)}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="market-actions" @click.stop>
                <UButton
                  v-if="isSubscribed(item)"
                  size="xs"
                  variant="soft"
                  color="gray"
                  class="w-full cursor-default"
                  disabled
                >
                  已添加至我的目标
                </UButton>
                <UButton
                  v-else-if="canSubscribe(item)"
                  size="xs"
                  class="w-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
                  icon="i-heroicons-plus"
                  :loading="subscribingId === item.album_id"
                  @click="handleSubscribe(item, $event)"
                >
                  添加进我的目标
                </UButton>
                <UButton
                  v-else
                  size="xs"
                  variant="ghost"
                  color="gray"
                  class="w-full"
                  @click="previewAlbum(item)"
                >
                  查看详情
                </UButton>
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400"
        >
          <UIcon name="i-heroicons-building-storefront" class="mb-4 h-16 w-16 opacity-40" />
          <p>暂无公开成就簿</p>
          <p class="mt-1 text-sm opacity-80">创建成就簿并设为公开后即可出现在市场</p>
        </div>

        <QhxLoading
          v-if="!loading"
          :loading="loadingMore"
          :page="page"
          :total="total"
          :page-size="PAGE_SIZE"
          @load-more="loadMore"
        />
      </div>
    </div>
  </QhxModal>

  <QhxModal
    v-model="showSubscribeConfirm"
    :trigger-position="subscribeConfirmPosition"
    :close-on-backdrop="false"
    @close="cancelSubscribeConfirm"
  >
    <div class="w-[90vw] max-w-md overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">确认添加</h3>
      </div>
      <div class="px-6 py-4">
        <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          确定将
          <span class="font-medium text-gray-900 dark:text-gray-100">
            「{{ pendingSubscribeItem?.album_title }}」
          </span>
          添加进我的打卡目标吗？
        </p>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          添加后可在「成就相册」中查看并打卡，原作者删除或设为私有后将无法继续访问。
        </p>
      </div>
      <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
        <UButton color="gray" variant="outline" @click="cancelSubscribeConfirm">取消</UButton>
        <UButton
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          :loading="subscribingId === pendingSubscribeItem?.album_id"
          @click="confirmSubscribe"
        >
          确认添加
        </UButton>
      </div>
    </div>
  </QhxModal>

  <QhxModal
    v-model="showUnsubscribeConfirm"
    :trigger-position="unsubscribeConfirmPosition"
    :close-on-backdrop="false"
    @close="cancelUnsubscribeConfirm"
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
        <UButton color="gray" variant="outline" @click="cancelUnsubscribeConfirm">暂不取消</UButton>
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
</template>

<style scoped>
.market-modal {
  -webkit-overflow-scrolling: touch;
}

.market-card-inner {
  overflow: hidden;
  border: 1px solid rgba(243, 243, 243, 0.8);
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.market-card:hover .market-card-inner {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.market-cover {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

.market-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.market-card:hover .market-img {
  transform: scale(1.04);
}

.market-complete-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.92);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
}

.market-complete-badge--stacked {
  top: 2.4rem;
}

.market-subscribed-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  background: rgba(14, 165, 233, 0.92);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
}

.market-unsubscribe-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
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

.market-unsubscribe-btn:hover:not(:disabled) {
  background: rgba(180, 83, 9, 0.96);
}

.market-unsubscribe-btn:disabled {
  opacity: 0.75;
  cursor: wait;
}

.market-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.35rem;
  padding: 0.75rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.78) 0%, transparent 55%);
}

.market-title {
  display: -webkit-box;
  overflow: hidden;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.market-desc {
  display: -webkit-box;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.7rem;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.market-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.market-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.65rem;
}

.market-progress-bar {
  height: 3px;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.25);
}

.market-progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--primary-color, #ff9eb5);
}

.market-actions {
  padding: 0.65rem 0.75rem;
}

.dark .market-card-inner {
  border-color: rgba(51, 65, 85, 0.6);
  background: rgb(31 41 55);
}

.dark .market-unsubscribe-btn {
  background: rgba(217, 119, 6, 0.88);
}

.dark .market-unsubscribe-btn:hover:not(:disabled) {
  background: rgba(180, 83, 9, 0.95);
}
</style>
