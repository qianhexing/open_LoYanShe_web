<script setup lang="ts">
/**
 * 衣柜「逛逛」：随机翻看公开衣柜。
 * 参考旧 APP wardrobeSquare，UI 对齐新项目；仅挂载相邻卡片，GSAP 翻页。
 */
import gsap from 'gsap'
import dayjs from 'dayjs'
import { useEventListener } from '@vueuse/core'
import {
  getWardrobeRandom,
  type WardrobeRandomItem,
} from '@/api/wardrobe'
import { BASE_IMG } from '@/utils/ipConfig'
import {
  openUserSpaceTab,
  openWardrobeDetail,
} from '@/composables/useLibraryDetailNavigation'

const toast = useToast()
const configStore = useConfigStore()
const router = useRouter()

const list = shallowRef<WardrobeRandomItem[]>([])
const current = shallowRef(0)
const totalCount = shallowRef(0)
const loading = shallowRef(false)
const animating = shallowRef(false)
const initialLoading = shallowRef(false)

const stageRef = shallowRef<HTMLElement | null>(null)
const cardEls = new Map<number, HTMLElement>()

const SWIPE_THRESHOLD = 72
const FLIP_DURATION = 0.52
const PREFETCH_REMAINING = 3

let pointerStartX = 0
let pointerStartY = 0
let pointerActive = false
let swipeLocked = false
let gsapCtx: gsap.Context | null = null

const squareImgParams = computed(
  () => configStore.config?.image_params_square || '?x-oss-process=image/resize,m_fill,w_300,h_300',
)

const canGoPrev = computed(() => current.value > 0)
const canGoNext = computed(
  () => current.value < list.value.length - 1 || loading.value || list.value.length < totalCount.value,
)
const progressText = computed(() => {
  if (!list.value.length) return ''
  const shown = current.value + 1
  const total = totalCount.value > 0 ? totalCount.value : list.value.length
  return `${shown} / ${total}`
})

/** 仅挂载相邻卡片，避免列表增长时 DOM 膨胀 */
const mountedCards = computed(() => {
  const c = current.value
  const rows = list.value
  const out: { index: number; item: WardrobeRandomItem }[] = []
  for (const index of [c - 1, c, c + 1]) {
    const item = rows[index]
    if (item) out.push({ index, item })
  }
  return out
})

function setCardEl(index: number, el: Element | null) {
  if (el instanceof HTMLElement) cardEls.set(index, el)
  else cardEls.delete(index)
}

function cardZIndex(index: number) {
  if (index === current.value) return 3
  if (index === current.value + 1) return 2
  if (index === current.value - 1) return 1
  return 0
}

function coverUrl(path: string | null | undefined) {
  const p = path?.trim() ? path.trim() : 'static/plan_cover/default.jpg'
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

function faceUrl(path: string | null | undefined) {
  return coverUrl(path || 'static/plan_cover/default.jpg')
}

function clothesImgUrl(path: string | null | undefined) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${BASE_IMG}${path.replace(/^\//, '')}${squareImgParams.value}`
}

function formatCreateDate(date: Date | string | null | undefined) {
  if (!date) return ''
  const d = dayjs(date)
  return d.isValid() ? d.format('YYYY-MM-DD') : ''
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === '已拥有') return 'ws-status--emerald'
  if (status === '待补款') return 'ws-status--amber'
  return 'ws-status--violet'
}

function clothesCount(item: WardrobeRandomItem) {
  return item.wardrobe_clothes?.count ?? item.count_clothes ?? item.total_count ?? 0
}

function clothesRows(item: WardrobeRandomItem) {
  return item.wardrobe_clothes?.rows ?? []
}

function resetState() {
  gsapCtx?.revert()
  gsapCtx = null
  cardEls.clear()
  list.value = []
  current.value = 0
  totalCount.value = 0
  loading.value = false
  animating.value = false
  initialLoading.value = false
  pointerActive = false
  swipeLocked = false
}

async function ensureConfig() {
  if (!configStore.config) {
    try {
      await configStore.getConfig()
    } catch {
      /* 图片参数走默认 */
    }
  }
}

async function fetchMore() {
  if (loading.value) return
  if (totalCount.value > 0 && list.value.length >= totalCount.value) return

  loading.value = true
  try {
    const exclude = list.value
      .map((w) => w.wardrobe_id)
      .filter((id): id is number => typeof id === 'number' && id > 0)

    const res = await getWardrobeRandom({ exclude })
    if (exclude.length === 0) {
      totalCount.value = res.count
    }
    if (res.rows.length) {
      list.value = [...list.value, ...res.rows]
    } else if (exclude.length === 0) {
      totalCount.value = 0
    }
  } catch (e) {
    console.error(e)
    toast.add({ title: '加载失败，请稍后重试', color: 'red' })
  } finally {
    loading.value = false
  }
}

function maybePrefetch() {
  if (loading.value) return
  if (list.value.length - current.value < PREFETCH_REMAINING) {
    void fetchMore()
  }
}

async function bootBrowse() {
  resetState()
  initialLoading.value = true
  await ensureConfig()
  await nextTick()
  if (stageRef.value) {
    gsapCtx = gsap.context(() => {}, stageRef.value)
  }
  await fetchMore()
  initialLoading.value = false
  if (!list.value.length) {
    toast.add({ title: '暂时没有可逛的衣柜', color: 'amber' })
  }
}

function closeBrowse() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
  } else {
    void navigateTo('/')
  }
}

onMounted(() => {
  void bootBrowse()
})

onUnmounted(() => {
  gsapCtx?.revert()
  gsapCtx = null
})

function getCard(index: number) {
  return cardEls.get(index) ?? null
}

async function flipNext() {
  if (animating.value) return
  if (current.value >= list.value.length - 1) {
    if (loading.value) {
      toast.add({ title: '正在加载…', color: 'amber' })
    } else if (totalCount.value > 0 && list.value.length >= totalCount.value) {
      toast.add({ title: '没有更多了', color: 'amber' })
    } else {
      await fetchMore()
      if (current.value < list.value.length - 1) {
        await flipNext()
      } else {
        toast.add({ title: '没有更多了', color: 'amber' })
      }
    }
    return
  }

  const fromEl = getCard(current.value)
  animating.value = true

  if (fromEl && !prefersReducedMotion()) {
    gsap.set(fromEl, { willChange: 'transform, opacity' })
    await gsap.to(fromEl, {
      rotateY: -92,
      opacity: 0,
      duration: FLIP_DURATION,
      ease: 'power2.inOut',
      transformOrigin: 'left center',
      force3D: true,
    })
  }

  current.value += 1
  await nextTick()

  const prevEl = getCard(current.value - 1)
  if (prevEl) gsap.set(prevEl, { clearProps: 'transform,opacity,willChange' })

  const curEl = getCard(current.value)
  if (curEl) gsap.set(curEl, { rotateY: 0, opacity: 1, clearProps: 'transform,opacity,willChange' })

  animating.value = false
  maybePrefetch()
}

async function flipPrev() {
  if (animating.value || current.value <= 0) return

  const target = current.value - 1
  animating.value = true
  await nextTick()

  const incoming = getCard(target)
  if (incoming && !prefersReducedMotion()) {
    gsap.set(incoming, {
      rotateY: -92,
      opacity: 0,
      transformOrigin: 'left center',
      force3D: true,
      zIndex: 4,
      willChange: 'transform, opacity',
    })
    current.value = target
    await nextTick()
    await gsap.to(incoming, {
      rotateY: 0,
      opacity: 1,
      duration: FLIP_DURATION,
      ease: 'power2.inOut',
      transformOrigin: 'left center',
      force3D: true,
    })
    gsap.set(incoming, { clearProps: 'transform,opacity,zIndex,willChange' })
  } else {
    current.value = target
  }

  animating.value = false
}

function prefersReducedMotion() {
  if (!import.meta.client) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onPointerDown(e: PointerEvent) {
  if (animating.value || e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select')) return
  // 纵向滚动区域优先
  if (target?.closest('.ws-clothes-scroll')) {
    pointerActive = true
    pointerStartX = e.clientX
    pointerStartY = e.clientY
    swipeLocked = false
    return
  }
  pointerActive = true
  pointerStartX = e.clientX
  pointerStartY = e.clientY
  swipeLocked = false
}

function onPointerMove(e: PointerEvent) {
  if (!pointerActive || swipeLocked) return
  const dx = e.clientX - pointerStartX
  const dy = e.clientY - pointerStartY
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
    pointerActive = false
    return
  }
  if (Math.abs(dx) > SWIPE_THRESHOLD) {
    swipeLocked = true
    pointerActive = false
    if (dx < 0) void flipNext()
    else void flipPrev()
  }
}

function onPointerUp() {
  pointerActive = false
}

function onKeydown(e: KeyboardEvent) {
  if (animating.value) return
  if (e.key === 'Escape') {
    closeBrowse()
    return
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    void flipPrev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    void flipNext()
  }
}

if (import.meta.client) {
  useEventListener(window, 'keydown', onKeydown)
}

function enterWardrobe(item: WardrobeRandomItem) {
  if (!item.wardrobe_id || !item.user_id) {
    toast.add({ title: '无法打开该衣柜', color: 'amber' })
    return
  }
  openWardrobeDetail({
    userId: item.user_id,
    wardrobeId: item.wardrobe_id,
  })
}

function openOwner(item: WardrobeRandomItem) {
  const uid = item.user?.user_id ?? item.user_id
  if (uid == null) return
  openUserSpaceTab(uid)
}
</script>

<template>
  <div
    class="ws-root relative flex h-[100dvh] min-h-0 flex-col overflow-hidden"
    role="main"
    aria-label="逛逛衣柜"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="ws-backdrop absolute inset-0" />

    <header class="ws-header relative z-10 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
      <button
        type="button"
        class="ws-icon-btn"
        aria-label="返回"
        @click="closeBrowse"
      >
        <UIcon name="i-heroicons-arrow-left" class="text-xl" />
      </button>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-bold text-gray-900 dark:text-gray-100 truncate">逛逛</h2>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          左右滑动切换 · {{ progressText || '随机公开衣柜' }}
        </p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          class="ws-icon-btn"
          :disabled="!canGoPrev || animating"
          aria-label="上一个"
          @click="flipPrev"
        >
          <UIcon name="i-heroicons-chevron-left" class="text-lg" />
        </button>
        <button
          type="button"
          class="ws-icon-btn"
          :disabled="!canGoNext || animating"
          aria-label="下一个"
          @click="flipNext"
        >
          <UIcon name="i-heroicons-chevron-right" class="text-lg" />
        </button>
      </div>
    </header>

    <div class="relative z-10 flex-1 min-h-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
      <div
        ref="stageRef"
        class="ws-stage relative mx-auto h-full w-full max-w-[560px] [perspective:1400px]"
      >
        <div
          v-if="initialLoading"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-white/80 dark:bg-gray-900/80"
        >
          <div class="ws-spinner" aria-hidden="true" />
          <p class="text-sm text-gray-500 dark:text-gray-400">正在找有趣的衣柜…</p>
        </div>

        <div
          v-else-if="!list.length"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-white dark:bg-gray-900 shadow-lg"
        >
          <UIcon name="material-symbols:travel-explore" class="text-4xl text-gray-300 dark:text-gray-600" />
          <p class="text-sm text-gray-500 dark:text-gray-400">暂时没有可逛的衣柜</p>
          <UButton color="primary" size="sm" @click="fetchMore">再试一次</UButton>
        </div>

        <template v-else>
          <article
            v-for="{ index, item } in mountedCards"
            :key="item.wardrobe_id ?? index"
            :ref="(el) => setCardEl(index, el as Element | null)"
            class="ws-card absolute inset-0 flex flex-col overflow-hidden rounded-[14px] bg-white dark:bg-gray-900 shadow-xl"
            :style="{ zIndex: cardZIndex(index) }"
            :aria-hidden="index !== current"
          >
            <div class="ws-clothes-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div
                class="ws-hero relative w-full aspect-[2/1] bg-cover bg-center"
                :style="{ backgroundImage: `url(${coverUrl(item.wardrobe_cover)})` }"
              >
                <div class="ws-hero-mask absolute inset-0" />
                <div class="relative z-[1] flex h-full flex-col justify-between p-4">
                  <div class="min-w-0">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white truncate drop-shadow-sm">
                      {{ item.wardrobe_name || '未命名衣柜' }}
                    </h3>
                    <div class="mt-1 flex items-center gap-3 text-xs text-gray-700 dark:text-gray-200">
                      <span>收录 {{ clothesCount(item) }}</span>
                      <span v-if="formatCreateDate(item.create_date)" class="opacity-80">
                        {{ formatCreateDate(item.create_date) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-end justify-between gap-3">
                    <button
                      v-if="item.user || item.user_id"
                      type="button"
                      class="flex items-center gap-2 min-w-0 rounded-full bg-white/70 dark:bg-black/35 backdrop-blur-md px-2 py-1 pr-3 hover:bg-white/90 dark:hover:bg-black/50 transition-colors"
                      @click.stop="openOwner(item)"
                    >
                      <img
                        :src="faceUrl(item.user?.user_face)"
                        alt=""
                        class="h-7 w-7 rounded-full object-cover shrink-0"
                        loading="lazy"
                        decoding="async"
                      >
                      <span class="text-xs font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                        {{ item.user?.user_name || '用户' }}
                      </span>
                    </button>
                    <UButton
                      size="xs"
                      color="primary"
                      class="shrink-0 shadow-sm"
                      @click.stop="enterWardrobe(item)"
                    >
                      进入衣柜
                    </UButton>
                  </div>
                </div>
              </div>

              <p
                v-if="item.wardrobe_desc"
                class="px-4 pt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2"
              >
                {{ item.wardrobe_desc }}
              </p>

              <div class="px-2.5 py-3 sm:px-3">
                <div
                  v-if="clothesRows(item).length"
                  class="grid grid-cols-3 gap-2 sm:gap-2.5"
                >
                  <div
                    v-for="clothes in clothesRows(item)"
                    :key="clothes.clothes_id"
                    class="ws-clothes-cell"
                  >
                    <div class="relative mx-auto w-full overflow-hidden rounded-[10px] bg-gray-100 dark:bg-gray-800 shadow-sm ws-clothes-cover">
                      <img
                        v-if="clothes.clothes_img"
                        :src="clothesImgUrl(clothes.clothes_img)"
                        :alt="clothes.clothes_note || ''"
                        class="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
                        loading="lazy"
                        decoding="async"
                        draggable="false"
                      >
                      <span
                        v-if="clothes.wardrobe_status"
                        class="ws-status absolute left-1 top-1 z-[1] max-w-[calc(100%-0.5rem)] truncate"
                        :class="statusBadgeClass(clothes.wardrobe_status)"
                      >
                        {{ clothes.wardrobe_status }}
                      </span>
                    </div>
                    <p class="mt-1 px-0.5 text-center text-[11px] leading-tight text-gray-600 dark:text-gray-300 line-clamp-1 min-h-[1rem]">
                      {{ clothes.clothes_note || ' ' }}
                    </p>
                    <p
                      v-if="clothes.price"
                      class="text-center text-[11px] font-medium text-rose-500"
                    >
                      ¥{{ clothes.price }}
                    </p>
                  </div>
                </div>
                <div
                  v-else
                  class="flex min-h-[120px] items-center justify-center text-sm text-gray-400"
                >
                  暂无服饰预览
                </div>
              </div>
            </div>
          </article>
        </template>

        <div
          v-if="list.length && !initialLoading"
          class="pointer-events-none absolute bottom-3 left-0 right-0 z-20 flex justify-center"
        >
          <div
            class="rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/90 backdrop-blur-sm dark:bg-white/15"
          >
            <span v-if="loading && current >= list.length - 2">加载中…</span>
            <span v-else>左滑下一个 · 右滑上一个</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-root {
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.ws-backdrop {
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--color-qhx-primary, #f472b6) 28%, transparent), transparent 55%),
    linear-gradient(165deg, #fff0f5 0%, #f7f8fc 48%, #eef2ff 100%);
}

.dark .ws-backdrop {
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--color-qhx-primary, #f472b6) 22%, transparent), transparent 55%),
    linear-gradient(165deg, #1a1520 0%, #12141c 50%, #151820 100%);
}

.ws-header {
  color: inherit;
}

.ws-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgb(55 65 81);
  box-shadow:
    2px 2px 8px rgba(0, 0, 0, 0.06),
    -1px -1px 6px rgba(255, 255, 255, 0.7);
  transition: transform 0.18s ease, background 0.18s ease, opacity 0.18s ease;
}

.ws-icon-btn:hover:not(:disabled) {
  transform: scale(1.06);
  background: rgba(255, 255, 255, 0.92);
}

.ws-icon-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.ws-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ws-spinner {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  border: 2px solid rgba(244, 114, 182, 0.25);
  border-top-color: color-mix(in srgb, var(--color-qhx-primary, #f472b6) 90%, #fff);
  animation: ws-spin 0.7s linear infinite;
}

@keyframes ws-spin {
  to { transform: rotate(360deg); }
}

.dark .ws-icon-btn {
  background: rgba(40, 42, 52, 0.78);
  color: rgb(229 231 235);
  box-shadow:
    2px 2px 10px rgba(0, 0, 0, 0.35),
    -1px -1px 4px rgba(255, 255, 255, 0.04);
}

.ws-card {
  transform-style: preserve-3d;
  backface-visibility: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
}

.dark .ws-card {
  border-color: rgba(255, 255, 255, 0.06);
}

.ws-hero-mask {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.78) 0%,
    rgba(255, 255, 255, 0.55) 45%,
    rgba(255, 255, 255, 0.7) 100%
  );
}

.dark .ws-hero-mask {
  background: linear-gradient(
    180deg,
    rgba(17, 18, 24, 0.55) 0%,
    rgba(17, 18, 24, 0.42) 45%,
    rgba(17, 18, 24, 0.62) 100%
  );
}

.ws-clothes-cell {
  content-visibility: auto;
  contain-intrinsic-size: auto 140px;
}

.ws-clothes-cover {
  aspect-ratio: 1 / 1;
}

.ws-status {
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.14rem 0.4rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  backdrop-filter: blur(8px) saturate(1.08);
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.ws-status--emerald {
  color: rgb(6 95 70);
  background: color-mix(in srgb, #10b981 14%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #10b981 26%, transparent);
}

.ws-status--amber {
  color: rgb(146 64 14);
  background: color-mix(in srgb, #f59e0b 16%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #f59e0b 30%, transparent);
}

.ws-status--violet {
  color: rgb(91 33 182);
  background: color-mix(in srgb, #8b5cf6 14%, rgba(255, 255, 255, 0.78));
  border-color: color-mix(in srgb, #8b5cf6 24%, transparent);
}

.dark .ws-status--emerald {
  color: rgb(167 243 208);
  background: color-mix(in srgb, #059669 28%, rgba(44, 46, 54, 0.82));
}

.dark .ws-status--amber {
  color: rgb(253 230 138);
  background: color-mix(in srgb, #d97706 28%, rgba(44, 46, 54, 0.82));
}

.dark .ws-status--violet {
  color: rgb(216 180 254);
  background: color-mix(in srgb, #6d28d9 30%, rgba(44, 46, 54, 0.82));
}
</style>
