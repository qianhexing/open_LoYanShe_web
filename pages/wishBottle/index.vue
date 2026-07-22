<script setup lang="ts">
import { getUserDecoBadges } from '@/api/user'
import type { UserDecoBadgeItem } from '@/api/user'
import type { UserDeco } from '@/types/api'
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue'
import WishBottle from '@/components/wishBottle/WishBottle.vue'

definePageMeta({
  name: 'wish-bottle',
})

useHead({
  title: '许愿瓶 | Lo研社',
  meta: [
    { name: 'keywords', content: 'Lo研社,许愿瓶,徽章' },
    { name: 'description', content: '把收集的徽章装满许愿瓶' },
  ],
})

const userStore = useUserStore()
const configStore = useConfigStore()
const { user, token } = storeToRefs(userStore)

const showLoginModal = ref(false)
const loading = ref(true)
const badges = ref<UserDecoBadgeItem[]>([])
const displayBadgeStr = ref('')

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

/**
 * 与用户空间一致：按展示配置加载徽章。
 * 优先按 display_badge 顺序；否则取 is_displayed === 1。
 */
const bottleBadges = computed<UserDeco[]>(() => {
  const list = badges.value
  const byId = new Map(list.map((b) => [b.deco_id, b]))
  const ids = displayBadgeStr.value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0)

  if (ids.length) {
    const out: UserDeco[] = []
    for (const decoId of ids) {
      const item = byId.get(decoId)
      if (item) out.push(badgeToUserDeco(item))
    }
    return out
  }

  return list.filter((d) => d.is_displayed === 1).map(badgeToUserDeco)
})

const badgesLoaded = computed(() => !loading.value)
const isLoggedIn = computed(() => {
  const uid = user.value?.user_id
  return Boolean(token.value && uid != null && Number.isFinite(Number(uid)))
})

async function fetchBadges() {
  if (!isLoggedIn.value) {
    badges.value = []
    displayBadgeStr.value = ''
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await getUserDecoBadges()
    badges.value = res.rows ?? []
    displayBadgeStr.value = res.display_badge ?? ''
  } catch (error) {
    console.error('获取用户徽章失败:', error)
    badges.value = []
    displayBadgeStr.value = ''
  } finally {
    loading.value = false
  }
}

function openLogin() {
  showLoginModal.value = true
}

function onLoginSuccess() {
  showLoginModal.value = false
  fetchBadges()
}

watch(
  isLoggedIn,
  (loggedIn) => {
    if (loggedIn) fetchBadges()
    else {
      badges.value = []
      displayBadgeStr.value = ''
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="wish-page relative flex min-h-[100dvh] flex-col overflow-hidden">
    <!-- 氛围背景 -->
    <div class="wish-page__bg pointer-events-none fixed inset-0 z-0">
      <div class="wish-page__bg-wash" />
      <div class="wish-page__blob wish-page__blob--a" />
      <div class="wish-page__blob wish-page__blob--b" />
      <div class="wish-page__blob wish-page__blob--c" />
      <div class="wish-page__sparkles" aria-hidden="true" />
    </div>

    <div
      v-if="configStore.statusBarHeight > 0"
      class="relative z-10 shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

    <!-- 未登录 -->
    <div
      v-if="!isLoggedIn"
      class="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center"
    >
      <h1 class="wish-page__brand">许愿瓶</h1>
      <p class="mt-3 max-w-xs text-sm leading-relaxed text-rose-400/90">
        登录后，把你收集的徽章装满这只瓶子
      </p>
      <button
        type="button"
        class="wish-page__cta mt-8"
        @click="openLogin"
      >
        去登录
      </button>
    </div>

    <!-- 已登录 -->
    <div
      v-else
      class="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6"
    >
      <header class="wish-page__header mb-6 text-center">
        <h1 class="wish-page__brand">许愿瓶</h1>
        <p class="wish-page__sub">
          <template v-if="badgesLoaded">
            空间展示 {{ bottleBadges.length }} 枚徽章
          </template>
          <template v-else>
            正在装瓶…
          </template>
        </p>
      </header>

      <WishBottle
        :badges="bottleBadges"
        :loaded="badgesLoaded"
      />

      <p class="wish-page__tip mt-8">
        轻触瓶中徽章；可用下方切换掉落 / 碰壁
      </p>
    </div>

    <YearlySummaryLoginModal
      v-model="showLoginModal"
      @success="onLoginSuccess"
    />
  </div>
</template>

<style scoped>
.wish-page {
  font-family: 'Georgia', 'Songti SC', 'Noto Serif SC', serif;
  background: #fff5f7;
}

:global(.dark) .wish-page {
  background: #1a1216;
}

.wish-page__bg-wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 200, 210, 0.45), transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(200, 220, 255, 0.25), transparent 65%),
    url('https://lolitalibrary.com/assets/img/pattern-dot.png');
  opacity: 0.5;
  background-size: auto, auto, 24px 24px;
}

:global(.dark) .wish-page__bg-wash {
  opacity: 0.25;
}

.wish-page__blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  animation: wish-blob 14s ease-in-out infinite;
}

.wish-page__blob--a {
  top: -10%;
  right: -8%;
  width: min(70vw, 420px);
  height: min(70vw, 420px);
  background: rgba(251, 182, 206, 0.45);
}

.wish-page__blob--b {
  top: 35%;
  left: -12%;
  width: min(55vw, 340px);
  height: min(55vw, 340px);
  background: rgba(186, 210, 255, 0.35);
  animation-delay: -4s;
}

.wish-page__blob--c {
  bottom: -15%;
  right: 15%;
  width: min(60vw, 380px);
  height: min(60vw, 380px);
  background: rgba(255, 214, 220, 0.4);
  animation-delay: -8s;
}

.wish-page__sparkles {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 22%, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 78% 18%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 64% 48%, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1.5px 1.5px at 28% 72%, rgba(255, 255, 255, 0.65), transparent),
    radial-gradient(1px 1px at 88% 68%, rgba(255, 255, 255, 0.75), transparent);
  animation: wish-twinkle 5s ease-in-out infinite alternate;
}

.wish-page__brand {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: 0.28em;
  color: #c45c7a;
  text-indent: 0.28em;
}

:global(.dark) .wish-page__brand {
  color: #f0a8bc;
}

.wish-page__sub {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: rgba(180, 110, 130, 0.85);
}

:global(.dark) .wish-page__sub {
  color: rgba(230, 180, 195, 0.75);
}

.wish-page__tip {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(170, 120, 140, 0.65);
}

.wish-page__cta {
  padding: 0.75rem 2rem;
  border-radius: 9999px;
  border: none;
  background: #e8799a;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.1em;
  box-shadow: 0 10px 28px rgba(232, 121, 154, 0.35);
  transition: background 0.2s ease, transform 0.15s ease;
}

.wish-page__cta:hover {
  background: #d96588;
}

.wish-page__cta:active {
  transform: scale(0.98);
}

@keyframes wish-blob {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(12px, -18px) scale(1.05);
  }
  66% {
    transform: translate(-10px, 10px) scale(0.96);
  }
}

@keyframes wish-twinkle {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 0.9;
  }
}
</style>
