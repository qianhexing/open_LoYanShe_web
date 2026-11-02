<script setup lang="ts">
import type { MiniTool, MiniToolHistoryItem } from '@/types/api'
import {
  getMiniToolHistoryList,
  getMiniToolList,
  reportMiniToolUse,
} from '~/api/mini_tool'
import { BASE_IMG } from '@/utils/ipConfig'
import { openMiniToolUrl } from '~/utils/openMiniTool'

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const toast = useToast()
const configStore = useConfigStore()

// biome-ignore lint/suspicious/noExplicitAny: @dcloudio/uni-webview-js 无类型声明
let uni: any

const toolList = ref<MiniTool[]>([])
const recentList = ref<MiniTool[]>([])
const loadingList = ref(false)
const loadingRecent = ref(false)
const keyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const isLoggedIn = computed(() => {
  const uid = user.value?.user_id
  return uid != null && Number.isFinite(Number(uid))
})

function resolveIcon(icon?: string | null, name?: string | null): string | null {
  const p = typeof icon === 'string' ? icon.trim() : ''
  if (!p) return null
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

function initialOf(name?: string | null) {
  const s = (name || '?').trim()
  return s ? s.slice(0, 1) : '?'
}

async function loadToolList() {
  loadingList.value = true
  try {
    const kw = keyword.value.trim()
    const data = await getMiniToolList(kw ? { keyword: kw } : {})
    toolList.value = Array.isArray(data) ? data : data?.rows || []
  } catch (e) {
    console.error(e)
    toolList.value = []
    toast.add({
      title: '小工具加载失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    loadingList.value = false
  }
}

async function loadRecent() {
  if (!isLoggedIn.value) {
    recentList.value = []
    return
  }
  loadingRecent.value = true
  try {
    const data = await getMiniToolHistoryList({ page: 1, pageSize: 12 })
    recentList.value = (data?.rows || [])
      .map((row: MiniToolHistoryItem) => row.mini_tool)
      .filter((t): t is MiniTool => !!t && t.tool_id != null)
  } catch (e) {
    console.error(e)
    recentList.value = []
  } finally {
    loadingRecent.value = false
  }
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    loadToolList()
  }, 320)
}

async function openTool(tool: MiniTool) {
  const id = Number(tool.tool_id)
  if (!Number.isFinite(id)) return
  // 先打开容器；同时上报 use（登录会写最近使用）
  openMiniToolUrl(id, {
    uni,
    port: configStore.getPort?.() ?? null,
  })
  try {
    await reportMiniToolUse({ tool_id: id })
    if (isLoggedIn.value) {
      // 乐观更新最近使用：移到最前
      const rest = recentList.value.filter((t) => Number(t.tool_id) !== id)
      recentList.value = [tool, ...rest].slice(0, 12)
    }
  } catch (e) {
    console.error(e)
  }
}

watch(isLoggedIn, (ok) => {
  if (ok) loadRecent()
  else recentList.value = []
})

onMounted(async () => {
  uni = await (
    // @ts-expect-error：@dcloudio/uni-webview-js 无声明文件
    import('@dcloudio/uni-webview-js')
  ).catch(() => undefined)
  await Promise.all([loadToolList(), loadRecent()])
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="fmt-root mb-8 min-w-0">
    <!-- 最近使用 -->
    <section
      v-if="isLoggedIn"
      class="mb-6 min-w-0"
    >
      <h2 class="features-section-title mb-3 flex items-center gap-2 px-1">
        <span class="fmt-section-icon">
          <UIcon
            name="i-heroicons-clock"
            class="size-4 text-qhx-primary"
          />
        </span>
        最近使用
      </h2>
      <p
        v-if="loadingRecent"
        class="px-1 text-xs text-[#9a858a]"
      >
        加载中…
      </p>
      <p
        v-else-if="recentList.length === 0"
        class="px-1 text-xs text-[#9a858a]"
      >
        打开小工具后会出现在这里
      </p>
      <div
        v-else
        class="grid grid-cols-4 gap-2.5 md:flex md:flex-wrap md:gap-3"
      >
        <button
          v-for="tool in recentList"
          :key="`recent-${tool.tool_id}`"
          type="button"
          class="features-tile group flex min-w-0 w-full shrink-0 flex-col items-center gap-2 p-2.5 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.99] md:w-[5.75rem]"
          @click="openTool(tool)"
        >
          <div
            class="features-icon-well flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-[1.03] md:h-11 md:w-11"
          >
            <img
              v-if="resolveIcon(tool.icon, tool.tool_name)"
              :src="resolveIcon(tool.icon, tool.tool_name)!"
              alt=""
              class="h-full w-full object-cover"
            />
            <span
              v-else
              class="text-sm font-semibold text-qhx-primary"
            >{{ initialOf(tool.tool_name) }}</span>
          </div>
          <span
            class="line-clamp-2 w-full break-words text-center text-[11px] font-medium leading-tight text-[#4f3f43] md:text-xs"
          >
            {{ tool.tool_name || '未命名' }}
          </span>
        </button>
      </div>
    </section>

    <!-- 小工具清单 -->
    <section class="min-w-0">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 class="features-section-title flex min-w-0 items-center gap-2">
          <span class="fmt-section-icon">
            <UIcon
              name="i-heroicons-sparkles"
              class="size-4 text-qhx-primary"
            />
          </span>
          小工具
        </h2>
        <span class="text-[11px] text-[#9a858a]">按使用人数排序</span>
      </div>

      <div class="mb-3 flex gap-2 px-1">
        <input
          v-model="keyword"
          type="search"
          class="fmt-search min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-[#4f3f43] outline-none transition-shadow focus:ring-2 focus:ring-qhx-primary/35"
          placeholder="搜索名称或简介"
          @input="onKeywordInput"
          @keydown.enter="loadToolList"
        >
        <button
          type="button"
          class="features-chip-btn shrink-0 rounded-xl px-3 py-2 text-xs font-medium text-[#4f3f43] outline-none transition-all hover:bg-qhx-primary/10 focus-visible:ring-2 focus-visible:ring-qhx-primary/40"
          @click="loadToolList"
        >
          搜索
        </button>
      </div>

      <p
        v-if="loadingList"
        class="px-1 text-xs text-[#9a858a]"
      >
        加载中…
      </p>
      <p
        v-else-if="toolList.length === 0"
        class="px-1 text-xs text-[#9a858a]"
      >
        暂无小工具
      </p>
      <div
        v-else
        class="grid grid-cols-2 gap-2.5"
      >
        <button
          v-for="tool in toolList"
          :key="`tool-${tool.tool_id}`"
          type="button"
          class="features-tile group flex w-full cursor-pointer flex-col gap-2 p-3 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-qhx-primary/40 active:scale-[0.99] sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
          @click="openTool(tool)"
        >
          <div class="flex min-w-0 w-full items-center gap-2.5 sm:w-auto sm:shrink-0">
            <div
              class="features-icon-well flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-[1.03] sm:h-10 sm:w-10"
            >
              <img
                v-if="resolveIcon(tool.icon, tool.tool_name)"
                :src="resolveIcon(tool.icon, tool.tool_name)!"
                alt=""
                class="h-full w-full object-cover"
              />
              <span
                v-else
                class="text-sm font-semibold text-qhx-primary"
              >{{ initialOf(tool.tool_name) }}</span>
            </div>
            <div class="min-w-0 flex-1 sm:hidden">
              <div class="line-clamp-2 text-sm font-medium leading-snug text-[#4f3f43]">
                {{ tool.tool_name || '未命名' }}
              </div>
            </div>
          </div>
          <div class="min-w-0 sm:flex-1 sm:text-left">
            <div class="mb-0 hidden font-medium text-[#4f3f43] sm:mb-0.5 sm:block">
              {{ tool.tool_name || '未命名' }}
            </div>
            <div class="line-clamp-2 text-[11px] leading-relaxed text-[#9a858a] sm:text-xs">
              {{ tool.tool_desc || '暂无简介' }}
            </div>
            <div class="mt-1 text-[10px] tabular-nums text-[#b09aa0]">
              使用 {{ Number(tool.use_count || 0) }}
            </div>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fmt-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--primary-color) 14%, white);
}

.fmt-search {
  background: #fffbfc;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 8%, transparent);
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
