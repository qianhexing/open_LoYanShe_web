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
  <div
    class="features-neo-page flex min-h-screen w-full max-w-full min-w-0 flex-col overflow-x-hidden rounded-2xl px-3 md:px-5 pb-28 md:pb-32"
  >
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0"
      :style="{ height: `${configStore.statusBarHeight}px` }"
      aria-hidden="true"
    />
    <div class="container mx-auto max-w-5xl min-w-0 flex-1 pb-8 pt-6 md:pt-8">
      <div class="mb-8 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="neo-share-btn inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neo-page)] active:scale-[0.98] dark:text-gray-200"
          aria-label="分享：复制当前页链接"
          @click="copyShareLink"
        >
          <UIcon
            name="i-heroicons-share"
            class="size-4 shrink-0"
          />
          分享
        </button>
        <div class="neo-share-btn inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
          <span class="whitespace-nowrap text-xs font-medium sm:text-sm">设为首页</span>
          <UToggle
            v-model="featuresNavAsHomeToggle"
            color="primary"
            :disabled="savingFeaturesNavHome"
            @update:model-value="handleFeaturesNavAsHomeChange"
          />
        </div>
      </div>
      <FeaturePinnedTools />
      <section
        v-for="section in featureNavSections"
        v-show="sectionHasVisibleItem(section)"
        :key="section.id"
        class="mb-12 min-w-0"
      >
        <h2
          class="neo-section-title min-w-0 font-semibold text-gray-800 dark:text-gray-100 mb-5 break-words pl-4 pr-3 py-2.5"
        >
          <span
            class="mr-2 inline-block h-2 w-2 shrink-0 rounded-full bg-qhx-primary shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
            aria-hidden="true"
          />
          {{ section.title }}
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:gap-5">
          <button
            v-for="(item, itemIdx) in section.items"
            v-show="!itemPinnedHidden(item)"
            :key="`${section.id}-${itemIdx}`"
            type="button"
            class="neo-tile group flex w-full cursor-pointer flex-col gap-2 rounded-2xl p-2.5 text-left outline-none transition-[box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neo-page)] active:scale-[0.99] sm:flex-row sm:items-center sm:gap-3 sm:p-4"
            @click="go(item)"
          >
            <div class="flex min-w-0 w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:items-center sm:gap-3">
              <div
                class="neo-icon-well flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-[box-shadow,transform] duration-200 group-hover:scale-[1.02] sm:h-11 sm:w-11"
              >
                <FeatureNavIcon
                  :key="`${section.id}-${itemIdx}-${item.icon}-${item.path}`"
                  :name="item.icon"
                  :icon-class="featureNavToneClasses[item.tone]?.iconText ?? featureNavToneClasses.pink!.iconText"
                />
              </div>
              <div class="min-w-0 flex-1 sm:hidden">
                <div class="line-clamp-2 text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
                  {{ item.title }}<span
                    v-if="item.requiresUserId && !user"
                    class="whitespace-nowrap text-[10px] font-normal text-gray-500 dark:text-gray-400"
                  >（需登录）</span>
                </div>
              </div>
            </div>
            <div class="min-w-0 sm:flex-1 sm:text-left">
              <div class="mb-0 hidden font-medium text-gray-800 dark:text-gray-100 sm:mb-1 sm:block">
                {{ item.title }}
                <span
                  v-if="item.requiresUserId && !user"
                  class="text-xs font-normal text-gray-500 dark:text-gray-400"
                >（需登录）</span>
              </div>
              <div class="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400 sm:text-xs">
                {{ item.desc }}
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>

    <div
      class="features-page-footer fixed bottom-0 left-0 right-0 z-30 min-w-0 border-t border-gray-200/70 bg-[#e8ecf3]/95 backdrop-blur-sm dark:border-gray-600/50 dark:bg-[#2a2d34]/95"
      style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom, 0px))"
    >
      <div class="mx-auto flex max-w-5xl min-w-0 flex-col items-center gap-2 px-3 py-2.5 md:px-5">
        <div class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <UIcon
            name="i-heroicons-eye"
            class="size-4 shrink-0"
          />
          <span>今日访问</span>
          <span class="tabular-nums text-gray-700 dark:text-gray-300">{{ visitCount }}</span>
        </div>
        <div
          class="flex w-full items-center justify-center border-t border-gray-200/90 pt-2 dark:border-gray-700/90"
        >
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 break-words text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
.features-neo-page {
  --neo-page: #e8ecf3;
  --neo-tile: #e8ecf3;
  --neo-shadow-dark: rgba(130, 145, 166, 0.38);
  --neo-shadow-light: rgba(255, 255, 255, 0.92);
  --neo-inset-dark: rgba(130, 145, 166, 0.28);
  --neo-inset-light: rgba(255, 255, 255, 0.85);

  background-color: var(--neo-page);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 14px 40px rgba(34, 42, 56, 0.06);
}

:global(.dark) .features-neo-page {
  --neo-page: #2a2d34;
  --neo-tile: #2a2d34;
  --neo-shadow-dark: rgba(0, 0, 0, 0.48);
  --neo-shadow-light: rgba(255, 255, 255, 0.07);
  --neo-inset-dark: rgba(0, 0, 0, 0.45);
  --neo-inset-light: rgba(255, 255, 255, 0.06);

  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 42px rgba(0, 0, 0, 0.35);
}

.neo-section-title {
  display: flex;
  align-items: center;
  border-radius: 0.875rem;
  background: var(--neo-tile);
  box-shadow:
    6px 6px 14px var(--neo-shadow-dark),
    -6px -6px 14px var(--neo-shadow-light);
}

.neo-tile {
  background: var(--neo-tile);
  box-shadow:
    8px 8px 18px var(--neo-shadow-dark),
    -8px -8px 18px var(--neo-shadow-light);
}

.neo-tile:hover {
  box-shadow:
    10px 10px 22px var(--neo-shadow-dark),
    -10px -10px 22px var(--neo-shadow-light);
}

.neo-tile:active {
  box-shadow:
    inset 6px 6px 12px var(--neo-inset-dark),
    inset -6px -6px 12px var(--neo-inset-light);
}

.neo-icon-well {
  background: var(--neo-tile);
  box-shadow:
    inset 4px 4px 8px var(--neo-inset-dark),
    inset -4px -4px 8px var(--neo-inset-light);
}

.group:hover .neo-icon-well {
  box-shadow:
    inset 3px 3px 7px var(--neo-inset-dark),
    inset -3px -3px 7px var(--neo-inset-light);
}

.neo-share-btn {
  background: var(--neo-tile);
  box-shadow:
    5px 5px 12px var(--neo-shadow-dark),
    -5px -5px 12px var(--neo-shadow-light);
}

.neo-share-btn:hover {
  box-shadow:
    6px 6px 14px var(--neo-shadow-dark),
    -6px -6px 14px var(--neo-shadow-light);
}

.neo-share-btn:active {
  box-shadow:
    inset 4px 4px 8px var(--neo-inset-dark),
    inset -4px -4px 8px var(--neo-inset-light);
}
</style>
