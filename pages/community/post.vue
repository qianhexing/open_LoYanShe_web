<template>
  <div
    class="community-post-page min-h-[100dvh] bg-gradient-to-b from-slate-50 via-white to-slate-100/90 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">

    <main class="mx-auto max-w-3xl px-4 pb-safe pt-6 md:pb-12 md:pt-8" role="main">
      <!-- 上下文：从外链带来的关联物体 -->
      <div v-if="foreignContextLabel"
        class="mb-5 flex gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 px-4 py-3 text-sm dark:border-violet-800/60 dark:bg-violet-950/35">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 ring-1 ring-violet-200/70 dark:bg-gray-900/70 dark:ring-violet-700/45"
          aria-hidden="true">
          <UIcon name="i-heroicons-link" class="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div class="min-w-0 pt-0.5">
          <p class="font-semibold text-violet-900 dark:text-violet-100">关联内容</p>
          <p class="mt-0.5 text-xs leading-relaxed text-violet-800/85 dark:text-violet-200/85">
            {{ foreignContextLabel }}发布成功后会与该条目自动关联。
          </p>
        </div>
      </div>

      <ClientOnly>
        <div
          class="rounded-[1.35rem] border border-gray-200/95 bg-white p-6 shadow-xl shadow-gray-900/[0.06] md:p-8 dark:border-gray-700/85 dark:bg-gray-800 dark:shadow-gray-950/40">
          <CommunityPostEditor embedded :user-id="userId" :skip-summary-link="true"
            :foreign-pk="foreignPkFromQuery ?? null" :initial-type="initialTypeFromQuery"
            :initial-is-open="initialIsOpenFromQuery ?? 1" :editor-min-height-embedded="editorMin"
            :editor-max-height-embedded="editorMax" @success="onSuccess" @cancel="onCancel" />
        </div>
        <template #fallback>
          <div
            class="h-[420px] animate-pulse rounded-[1.35rem] border border-gray-200 bg-gray-100/90 dark:border-gray-700 dark:bg-gray-800/80"
            aria-hidden="true" />
          <p class="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            加载编辑器…
          </p>
        </template>
      </ClientOnly>

      <p class="mt-8 pb-8 text-center text-[11px] text-gray-400 dark:text-gray-500 md:text-xs">
        遵守社区规范，友善交流。如需返回列表，
        <NuxtLink to="/community"
          class="font-medium text-pink-600 underline-offset-2 hover:underline dark:text-pink-400">
          进入社区首页
        </NuxtLink>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Community } from '@/types/api'
import {
  parseCommunityPostForeignFromQuery,
  parseCommunityPostIsOpenFromQuery
} from '@/utils/communityPost'

definePageMeta({
  ssr: false
})
let uni: any;
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const route = useRoute()
const router = useRouter()

useHead({
  title: '发帖分享',
  meta: [
    {
      name: 'description',
      content: '在社区发布帖子，分享搭配与同好交流。'
    }
  ]
})

/** 单列页内给编辑器略大一点的可视高度 */
const editorMin = 340
const editorMax = 520

const userId = computed(() =>
  route.query.userId ? Number(route.query.userId) : undefined
)

const foreignPkFromQuery = computed(() => parseCommunityPostForeignFromQuery(route.query))

const foreignContextLabel = computed(() => {
  const fk = foreignPkFromQuery.value
  if (!fk) return null
  const { pk_type, pk_id } = fk
  const typeNames: Record<number, string> = {
    0: '店铺',
    1: '实体店',
    2: '衣柜服饰',
    3: '搭配场景',
    4: '搭配清单',
    5: '合集考据',
    6: '茶会返图',
    7: '图鉴返图'
  }
  const name = typeNames[pk_type] ?? '相关内容'
  return `${name} #${pk_id}`
})

const initialIsOpenFromQuery = computed(() =>
  parseCommunityPostIsOpenFromQuery(route.query)
)

const initialTypeFromQuery = computed(() => {
  const raw = route.query.type
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
})

function onCancel() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/community')
}

function onSuccess(community: Community) {
  const id = community.community_id
  if (id != null && Number.isFinite(Number(id))) {
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')
    if (isInUniApp && typeof uni !== 'undefined' && typeof uni.postMessage === 'function') {
      uni.postMessage({ data: { type: 'reloadBlackList' } })
    } else {
      void router.push(`/community/detail/${id}`)
    }
    return
  }
  void router.push('/community')
}
</script>

<style scoped>
.pb-safe {
  padding-bottom: max(2rem, env(safe-area-inset-bottom));
}
</style>
