<script setup lang="ts">
import type { Community, Library, User } from '@/types/api'
import { searchByKeyword, type SearchPkType } from '@/api/search'
import SearchCommunityResults from '@/components/search/SearchCommunityResults.vue'
import SearchLibraryResults from '@/components/search/SearchLibraryResults.vue'
import QhxTabs from '@/components/Qhx/Tabs.vue'
import QhxTabPanel from '@/components/Qhx/TabPanel.vue'
import { BASE_IMG } from '@/utils/ipConfig'

const PAGE_SIZE = 10
const TAB_LABELS = ['帖子', '图鉴'] as const

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { keywords: historyKeywords, add: addHistory, remove: removeHistory, clear: clearHistory } =
  useSearchHistory()

const inputValue = ref('')
const activeKeyword = ref('')
const confirmKeywords = ref<string[]>([])
const showHistory = ref(true)
const showDeleteHistory = ref(false)
const hasSearched = ref(false)

const communityList = ref<Community[]>([])
const libraryList = ref<Library[]>([])
const matchedUser = ref<User | null>(null)

const paging = reactive({
  0: { page: 1, total: 0, loading: false },
  1: { page: 1, total: 0, loading: false },
})

const isSearching = computed(() => paging[0].loading || paging[1].loading)

const tabCounts = computed(() => [paging[0].total, paging[1].total])

function resetResults() {
  communityList.value = []
  libraryList.value = []
  matchedUser.value = null
  paging[0].page = 1
  paging[1].page = 1
  paging[0].total = 0
  paging[1].total = 0
}

async function fetchByType(pkType: SearchPkType, page: number, append: boolean) {
  const keyword = activeKeyword.value.trim()
  if (!keyword) return

  paging[pkType].loading = true
  try {
    const res = await searchByKeyword({
      keyword,
      pk_type: pkType,
      page,
      pageSize: PAGE_SIZE,
    })

    if (pkType === 0) {
      matchedUser.value = page === 1 ? res.user ?? null : matchedUser.value
      communityList.value = append ? [...communityList.value, ...(res.rows as Community[])] : (res.rows as Community[])
    } else {
      libraryList.value = append ? [...libraryList.value, ...(res.rows as Library[])] : (res.rows as Library[])
    }
    paging[pkType].total = res.count ?? 0
    paging[pkType].page = page
  } catch (e) {
    if (import.meta.client) {
      console.error('搜索失败:', e)
    }
    if (!append) {
      if (pkType === 0) communityList.value = []
      else libraryList.value = []
    }
    toast.add({
      title: '搜索失败',
      description: '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    paging[pkType].loading = false
  }
}

async function runSearch(keyword: string) {
  const trimmed = keyword.trim()
  if (!trimmed) return

  inputValue.value = trimmed
  activeKeyword.value = trimmed
  confirmKeywords.value = trimmed.split(/\s+/).filter(Boolean)
  hasSearched.value = true
  showHistory.value = false
  resetResults()
  addHistory(trimmed)

  await router.replace({
    query: {
      ...route.query,
      q: trimmed,
    },
  })

  await Promise.all([fetchByType(0, 1, false), fetchByType(1, 1, false)])
}

function handleSearch() {
  void runSearch(inputValue.value)
}

function handleHistorySearch(keyword: string) {
  inputValue.value = keyword
  void runSearch(keyword)
}

function handleFocus() {
  if (!hasSearched.value) {
    showHistory.value = true
  }
}

function canLoadMore(pkType: SearchPkType): boolean {
  const state = paging[pkType]
  if (state.loading || !hasSearched.value) return false
  const maxPage = Math.ceil(state.total / PAGE_SIZE)
  return state.page < maxPage
}

async function loadMore(pkType: SearchPkType) {
  if (!canLoadMore(pkType)) return
  await fetchByType(pkType, paging[pkType].page + 1, true)
}

function openUser(userId?: number) {
  if (!userId) return
  window.open(`/userSpace/${userId}`, '_blank')
}

function applyRouteQuery() {
  const q = typeof route.query.q === 'string' ? route.query.q.trim() : ''
  if (!q) return
  inputValue.value = q
  void runSearch(q)
}

onMounted(() => {
  applyRouteQuery()
})

watch(
  () => route.query.q,
  (next, prev) => {
    if (next === prev) return
    applyRouteQuery()
  }
)

useHead({
  title: 'Lo研社搜索',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,搜索,Lolita图鉴,社区帖子',
    },
    {
      name: 'description',
      content: '检索 Lo研社 社区帖子与 Lolita 图鉴',
    },
  ],
})

definePageMeta({
  name: 'search',
})
</script>

<template>
  <div class="search-page min-h-screen bg-[#f4f1f6] pb-10 dark:bg-[#14161a]">
    <header
      class="sticky top-0 z-30 border-b border-gray-200/70 bg-[#f4f1f6]/95 backdrop-blur-md dark:border-gray-800 dark:bg-[#14161a]/95"
      style="padding-top: max(0.75rem, env(safe-area-inset-top, 0px))"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-3 pt-1">
        <NuxtLink
          to="/"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-700 shadow-sm transition hover:border-qhx-primary/40 hover:text-qhx-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          aria-label="返回首页"
        >
          <UIcon name="i-heroicons-arrow-left-20-solid" class="h-5 w-5" />
        </NuxtLink>

        <div class="search-input-shell min-w-0 flex-1 rounded-2xl px-3 py-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-magnifying-glass-20-solid" class="h-5 w-5 shrink-0 text-gray-400" />
            <input
              v-model="inputValue"
              type="search"
              enterkeyhint="search"
              placeholder="检索关键词，多条件用空格分割"
              class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
              @focus="handleFocus"
              @keyup.enter="handleSearch"
            />
            <button
              type="button"
              class="rounded-xl bg-qhx-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              :disabled="isSearching"
              @click="handleSearch"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 pt-4">
      <section
        v-if="showHistory && !hasSearched"
        class="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/90"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">搜索历史</h2>
          <div class="flex items-center gap-2">
            <button
              v-if="historyKeywords.length"
              type="button"
              class="text-xs text-gray-500 transition hover:text-red-500"
              @click="showDeleteHistory = !showDeleteHistory"
            >
              {{ showDeleteHistory ? '完成' : '管理' }}
            </button>
            <button
              v-if="historyKeywords.length && showDeleteHistory"
              type="button"
              class="text-xs text-red-500"
              @click="clearHistory"
            >
              清空
            </button>
          </div>
        </div>

        <div v-if="historyKeywords.length" class="flex flex-wrap gap-2">
          <div
            v-for="keyword in historyKeywords"
            :key="keyword"
            class="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <button type="button" class="truncate" @click="handleHistorySearch(keyword)">
              {{ keyword }}
            </button>
            <button
              v-if="showDeleteHistory"
              type="button"
              class="text-gray-400 hover:text-red-500"
              aria-label="删除"
              @click="removeHistory(keyword)"
            >
              <UIcon name="i-heroicons-x-mark-20-solid" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          输入关键词开始搜索社区帖子或图鉴
        </p>
      </section>

      <section v-else-if="hasSearched" class="space-y-4">
        <div
          v-if="matchedUser"
          class="search-card flex cursor-pointer items-center gap-3 rounded-2xl border border-qhx-primary/25 bg-white p-4 shadow-sm dark:bg-gray-900/90"
          @click="openUser(matchedUser.user_id)"
        >
          <img
            v-if="matchedUser.user_face"
            :src="`${BASE_IMG}${matchedUser.user_face}?x-oss-process=image/quality,q_80/resize,w_96,h_96`"
            :alt="matchedUser.user_name"
            class="h-12 w-12 rounded-full object-cover ring-2 ring-qhx-primary/20"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ matchedUser.user_name }}
              </span>
              <span
                v-if="matchedUser.level != null"
                class="rounded-md bg-qhx-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-qhx-primary"
              >
                LV{{ matchedUser.level }}
              </span>
            </div>
            <p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {{ matchedUser.signature?.trim() || '暂时没有签名' }}
            </p>
          </div>
          <UIcon name="i-heroicons-chevron-right-20-solid" class="h-5 w-5 text-gray-400" />
        </div>

        <QhxTabs
          :tabs="[...TAB_LABELS]"
          :tab_counts="tabCounts"
          sticky
          :sticky_offset="72"
        >
          <QhxTabPanel :index="0">
            <div class="pt-3">
              <div v-if="paging[0].loading && !communityList.length" class="py-16 text-center text-sm text-gray-500">
                正在搜索帖子…
              </div>
              <div
                v-else-if="!communityList.length"
                class="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
              >
                未找到相关帖子，试试调整关键词
              </div>
              <template v-else>
                <SearchCommunityResults :items="communityList" :keywords="confirmKeywords" />
                <div v-if="canLoadMore(0)" class="mt-4 flex justify-center">
                  <button
                    type="button"
                    class="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 transition hover:border-qhx-primary/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    :disabled="paging[0].loading"
                    @click="loadMore(0)"
                  >
                    {{ paging[0].loading ? '加载中…' : '加载更多' }}
                  </button>
                </div>
              </template>
            </div>
          </QhxTabPanel>

          <QhxTabPanel :index="1">
            <div class="pt-3">
              <div v-if="paging[1].loading && !libraryList.length" class="py-16 text-center text-sm text-gray-500">
                正在搜索图鉴…
              </div>
              <div
                v-else-if="!libraryList.length"
                class="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
              >
                未找到相关图鉴，试试调整关键词
              </div>
              <template v-else>
                <SearchLibraryResults :items="libraryList" :keywords="confirmKeywords" />
                <div v-if="canLoadMore(1)" class="mt-4 flex justify-center">
                  <button
                    type="button"
                    class="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 transition hover:border-qhx-primary/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    :disabled="paging[1].loading"
                    @click="loadMore(1)"
                  >
                    {{ paging[1].loading ? '加载中…' : '加载更多' }}
                  </button>
                </div>
              </template>
            </div>
          </QhxTabPanel>
        </QhxTabs>
      </section>
    </main>
  </div>
</template>

<style scoped>
.search-input-shell {
  background: #fff;
  border: 1px solid rgb(229 231 235 / 0.9);
  box-shadow:
    inset 2px 2px 6px rgb(15 23 42 / 0.04),
    inset -2px -2px 6px rgb(255 255 255 / 0.9);
}

.dark .search-input-shell {
  background: rgb(17 24 39 / 0.9);
  border-color: rgb(55 65 81 / 0.9);
  box-shadow:
    inset 2px 2px 6px rgb(0 0 0 / 0.25),
    inset -1px -1px 4px rgb(255 255 255 / 0.03);
}
</style>
