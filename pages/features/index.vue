<script setup lang="ts">
import dayjs from 'dayjs'
import { getBrowTimeOne, insertBrowTime } from '~/api/brow_time'
import { getUserMy } from '~/api/user'
import FeatureNavIcon from '~/components/features/FeatureNavIcon.vue'
import FeaturePinnedTools from '~/components/features/FeaturePinnedTools.vue'
import YearlySummaryLoginModal from '~/components/yearlySummary/LoginModal.vue'
import {
  featuresNavIntro,
  featureNavSections,
  featuresNavManifest
} from '~/data/featuresNav'
import { featureNavToneClasses, useFeaturesPlatformNav } from '~/composables/useFeaturesPlatformNav'
import { useFeaturePinnedMenu } from '~/composables/useFeaturePinnedMenu'
import type { FeatureNavItem, FeatureNavSection } from '~/types/featuresNav'

const configStore = useConfigStore()
const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { pinnedOnlineIdSet } = useFeaturePinnedMenu()
const { go } = useFeaturesPlatformNav(featuresNavManifest)
const toast = useToast()
const { copyCurrentUrl } = useCopyCurrentUrl()

/**
 * 「功能导航本页设为首页」：`message_config.home_page` **仅在为 `2` 时表示开启**。
 * `0`、`1`、未定义或其它任意数字均视为关闭（与 AI 会话页的 `1` 区分）。
 */
const FEATURES_NAV_HOME_PAGE = 2
const HOME_PAGE_OFF = 0

function isFeaturesNavHomeEnabled(homePage: unknown): boolean {
  if (typeof homePage === 'boolean') return false
  const n = Number(homePage)
  return Number.isFinite(n) && n === FEATURES_NAV_HOME_PAGE
}

function getMessageConfigBase(): Record<string, unknown> {
  const mc = user.value?.message_config
  if (!mc || typeof mc !== 'object') return {}
  return { ...(mc as Record<string, unknown>) }
}

const showLoginModal = ref(false)

function isFeaturesUserLoggedIn(): boolean {
  const uid = user.value?.user_id
  return !(uid == null || !Number.isFinite(Number(uid)))
}

function openLoginModal() {
  showLoginModal.value = true
}

const featuresNavAsHomeToggle = ref(false)
const savingFeaturesNavHome = ref(false)

function syncFeaturesNavAsHomeToggleFromUser() {
  featuresNavAsHomeToggle.value = isFeaturesNavHomeEnabled(
    getMessageConfigBase().home_page
  )
}

watch(
  () => user.value?.message_config,
  () => {
    syncFeaturesNavAsHomeToggleFromUser()
  },
  { immediate: true, deep: true }
)

async function handleFeaturesNavAsHomeChange(value: boolean) {
  if (!isFeaturesUserLoggedIn()) {
    featuresNavAsHomeToggle.value = false
    openLoginModal()
    return
  }
  savingFeaturesNavHome.value = true
  try {
    const raw = getMessageConfigBase()
    const merged: Record<string, unknown> = value
      ? { ...raw, home_page: FEATURES_NAV_HOME_PAGE }
      : { ...raw, home_page: HOME_PAGE_OFF }
    await userStore.updateUserInfo({
      message_config: merged
    })
    featuresNavAsHomeToggle.value = value
    toast.add({
      title: value ? '已设为首页' : '已取消设为首页',
      icon: value ? 'i-heroicons-check-circle' : 'i-heroicons-information-circle',
      color: value ? 'green' : 'gray'
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '保存失败'
    featuresNavAsHomeToggle.value = !value
    toast.add({
      title: '保存失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    savingFeaturesNavHome.value = false
    syncFeaturesNavAsHomeToggleFromUser()
  }
}

async function onFeaturesLoginSuccess() {
  try {
    const userInfo = await getUserMy()
    if (userInfo?.user_id != null) {
      userStore.setUserInfo(userInfo)
    }
  } catch {
    /** login() 已写过 store 时可忽略 */
  }
}

async function copyShareLink() {
  try {
    const result = await copyCurrentUrl()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '可将本页链接分享给他人',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message ?? '请手动复制地址栏链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

/** 顶置入口在下方列表中仍保留节点，仅用 v-show 隐藏（不占布局） */
function itemPinnedHidden(item: FeatureNavItem): boolean {
  return pinnedOnlineIdSet.value.has(item.id)
}

function sectionHasVisibleItem(section: FeatureNavSection): boolean {
  const hide = pinnedOnlineIdSet.value
  return section.items.some((it) => !hide.has(it.id))
}

/** 今日访问（连续停留满 5 秒触发一次上报，与图鉴查询等页同一套 brow_time） */
const visitCount = ref(0)
let visitRecordTimer: ReturnType<typeof setTimeout> | null = null

const browTimeDayId = () => dayjs(new Date()).format('YYYYMMDD')
const BROW_TIME_FEATURES_NAV = 'features_nav'

async function loadFeaturesNavVisitStat() {
  try {
    const row = await getBrowTimeOne({
      id: browTimeDayId(),
      type: BROW_TIME_FEATURES_NAV
    })
    visitCount.value = row.count_times ?? 0
  } catch (e) {
    if (import.meta.client) {
      console.error('功能导航访问统计读取失败:', e)
    }
  }
}

async function recordFeaturesNavVisit() {
  try {
    await insertBrowTime({
      id: browTimeDayId(),
      type: BROW_TIME_FEATURES_NAV
    })
    await loadFeaturesNavVisitStat()
  } catch (e) {
    if (import.meta.client) {
      console.error('功能导航访问统计上报失败:', e)
    }
  }
}

onMounted(() => {
  loadFeaturesNavVisitStat()
  visitRecordTimer = setTimeout(() => {
    visitRecordTimer = null
    if (user.value?.user_id === 1) return
    recordFeaturesNavVisit()
  }, 5000)
})

onBeforeUnmount(() => {
  if (visitRecordTimer != null) {
    clearTimeout(visitRecordTimer)
    visitRecordTimer = null
  }
})

useHead({
  title: `${featuresNavIntro.title} | Lo研社`,
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,功能导航,图鉴,店铺,社区,衣柜'
    },
    {
      name: 'description',
      content: 'Lo研社站点功能导览：图书馆、店铺、社区、可视化与个人中心等入口一览。'
    }
  ]
})
</script>

<template>
  <div class="features-page relative min-h-screen w-full overflow-x-hidden">
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
      aria-hidden="true"
    />
    <div class="container mx-auto max-w-4xl min-w-0 flex-1 p-2 pb-28 md:pb-32">
      <div class="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          class="features-chip-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#4f3f43] outline-none transition-all duration-200 hover:bg-qhx-primary/10 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.98]"
          aria-label="分享：复制当前页链接"
          @click="copyShareLink"
        >
          <UIcon
            name="i-heroicons-share"
            class="size-3.5 shrink-0 text-qhx-primary"
          />
          分享
        </button>
        <div class="features-chip-btn inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[#4f3f43]">
          <span class="whitespace-nowrap text-[#9a858a]">设为首页</span>
          <UToggle
            v-model="featuresNavAsHomeToggle"
            color="primary"
            :disabled="savingFeaturesNavHome"
            @update:model-value="handleFeaturesNavAsHomeChange"
          />
        </div>
      </div>

      <header class="mb-6 px-1">
        <h1 class="features-hero-title">{{ featuresNavIntro.title }}</h1>
        <p class="mt-1.5 text-xs leading-relaxed text-[#9a858a]">
          常用功能入口一站直达
        </p>
      </header>

      <FeaturePinnedTools />

      <section
        v-for="section in featureNavSections"
        v-show="sectionHasVisibleItem(section)"
        :key="section.id"
        class="mb-8 min-w-0"
      >
        <h2 class="features-section-title mb-3 px-1">
          {{ section.title }}
        </h2>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="(item, itemIdx) in section.items"
            v-show="!itemPinnedHidden(item)"
            :key="`${section.id}-${itemIdx}`"
            type="button"
            class="features-tile group flex w-full cursor-pointer flex-col gap-2 p-3 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.99] sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
            @click="go(item)"
          >
            <div class="flex min-w-0 w-full items-center gap-2.5 sm:w-auto sm:shrink-0">
              <div class="features-icon-well flex h-9 w-9 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-[1.03] sm:h-10 sm:w-10">
                <FeatureNavIcon
                  :key="`${section.id}-${itemIdx}-${item.icon}-${item.path}`"
                  :name="item.icon"
                  :icon-class="featureNavToneClasses[item.tone]?.iconText ?? featureNavToneClasses.pink!.iconText"
                />
              </div>
              <div class="min-w-0 flex-1 sm:hidden">
                <div class="line-clamp-2 text-sm font-medium leading-snug text-[#4f3f43]">
                  {{ item.title }}<span
                    v-if="item.requiresUserId && !user"
                    class="whitespace-nowrap text-[10px] font-normal text-[#9a858a]"
                  >（需登录）</span>
                </div>
              </div>
            </div>
            <div class="min-w-0 sm:flex-1 sm:text-left">
              <div class="mb-0 hidden font-medium text-[#4f3f43] sm:mb-0.5 sm:block">
                {{ item.title }}
                <span
                  v-if="item.requiresUserId && !user"
                  class="text-xs font-normal text-[#9a858a]"
                >（需登录）</span>
              </div>
              <div class="text-[11px] leading-relaxed text-[#9a858a] sm:text-xs">
                {{ item.desc }}
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>

    <div
      class="features-page-footer fixed bottom-0 left-0 right-0 z-30 min-w-0 border-t border-qhx-primary/15 bg-[#fff9fb]/92 backdrop-blur-sm"
      style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom, 0px))"
    >
      <div class="mx-auto flex max-w-4xl min-w-0 flex-col items-center gap-2 px-3 py-2.5">
        <div class="flex items-center justify-center gap-2 text-sm text-[#9a858a]">
          <UIcon
            name="i-heroicons-eye"
            class="size-4 shrink-0"
          />
          <span>今日访问</span>
          <span class="tabular-nums text-[#4f3f43]">{{ visitCount }}</span>
        </div>
        <div class="flex w-full items-center justify-center border-t border-qhx-primary/12 pt-2">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 break-words text-[#9a858a] transition-colors hover:text-[#4f3f43]"
          >
            <img
              src="https://lolitalibrary.com/ali/static/batb.png"
              alt="备案图标"
              class="h-4 w-auto"
            />
            <span class="text-xs">闽ICP备19007279号-1</span>
          </a>
        </div>
      </div>
    </div>

    <YearlySummaryLoginModal
      v-model="showLoginModal"
      @success="onFeaturesLoginSuccess"
    />
  </div>
</template>

<style scoped>
.features-page {
  color: #4f3f43;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, color-mix(in srgb, var(--primary-color) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 70% 40% at 100% 0%, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 50%),
    linear-gradient(180deg, #fff9fb 0%, #fff5f8 45%, #fff2f6 100%);
}

.features-hero-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.7rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.features-section-title {
  font-family: 'Cormorant Garamond', 'Songti SC', Georgia, serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: #4f3f43;
  letter-spacing: 0.02em;
}

.features-chip-btn {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.features-tile {
  background: linear-gradient(165deg, #fffbfc 0%, #fff7f9 100%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 1.15rem;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--primary-color) 9%, transparent);
}

.features-tile:hover {
  border-color: color-mix(in srgb, var(--primary-color) 36%, transparent);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--primary-color) 14%, transparent);
  background: linear-gradient(165deg, #ffffff 0%, #fff8fa 100%);
}

.features-icon-well {
  border-radius: 0.7rem;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, white);
}
</style>
