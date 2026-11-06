<!-- 选择小工具：左封面 + 右上名称下介绍，一行一项 -->
<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div
      class="flex max-h-[90vh] w-[95vw] max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-800"
    >
      <div
        class="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-sky-50 px-5 py-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-800"
      >
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">选择小工具</h3>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">点击一行选中，再确认插入</p>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-100 group dark:hover:bg-gray-700"
          aria-label="关闭"
          @click="closeModel"
        >
          <UIcon
            name="i-heroicons-x-mark"
            class="h-5 w-5 text-gray-500 transition-colors group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200"
          />
        </button>
      </div>

      <div class="flex-shrink-0 space-y-3 px-4 pb-2 pt-3">
        <UInput
          v-model="keywords"
          placeholder="搜索名称或简介…"
          class="flex-1 focus:ring-0"
          :autofocus="false"
          :ui="{
            base: 'focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline:
                  'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-cyan-500',
              },
            },
          }"
          @keyup.enter="search"
          @update:model-value="onKeywordInput"
        >
          <template #leading>
            <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400" />
          </template>
        </UInput>

        <div class="flex items-center justify-between gap-2">
          <div
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              chooseItem
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-700/50 dark:text-gray-500'
            "
          >
            <UIcon name="material-symbols:check-circle-rounded" class="text-sm" />
            {{ chooseItem ? '已选 1' : '未选择' }}
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-full bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
            :disabled="!chooseItem"
            @click="confirmChoose"
          >
            确认选择
          </button>
        </div>
      </div>

      <div
        class="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
      >
        <div v-if="listData.length" class="space-y-2">
          <button
            v-for="tool in listData"
            :key="tool.tool_id"
            type="button"
            class="group flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            :class="
              isSelected(tool.tool_id)
                ? 'border-cyan-500 bg-cyan-50/80 ring-2 ring-cyan-500/30 dark:border-cyan-400 dark:bg-cyan-950/30'
                : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-cyan-500/50 dark:hover:bg-gray-700/70'
            "
            @click="chooseTool(tool)"
          >
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-600"
            >
              <img
                v-if="resolveIcon(tool.icon)"
                :src="resolveIcon(tool.icon)!"
                alt=""
                class="h-full w-full object-cover"
                loading="lazy"
              >
              <span
                v-else
                class="text-base font-semibold text-cyan-600 dark:text-cyan-300"
              >{{ initialOf(tool.tool_name) }}</span>
            </div>
            <div class="min-w-0 flex-1 py-0.5">
              <div class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ tool.tool_name || '未命名' }}
              </div>
              <div class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {{ tool.tool_desc?.trim() || '暂无简介' }}
              </div>
            </div>
            <div
              v-if="isSelected(tool.tool_id)"
              class="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-white shadow-sm"
            >
              <UIcon name="i-heroicons-check-20-solid" class="h-3.5 w-3.5" />
            </div>
          </button>
        </div>

        <div v-else-if="!loading" class="py-14 text-center">
          <div class="flex flex-col items-center gap-3">
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50"
            >
              <UIcon name="i-heroicons-sparkles" class="text-3xl text-gray-300 dark:text-gray-500" />
            </div>
            <p class="text-sm text-gray-400 dark:text-gray-500">暂无小工具</p>
          </div>
        </div>

        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-cyan-500" />
        </div>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getMiniToolList } from '@/api/mini_tool'
import type { MiniTool } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

const emit = defineEmits<{
  choose: [list: MiniTool[]]
}>()

const show = ref(false)
const keywords = ref('')
const loading = ref(false)
const listData = ref<MiniTool[]>([])
const chooseItem = ref<MiniTool | null>(null)
const clickPosition = ref({ x: 0, y: 0 })
let searchTimer: ReturnType<typeof setTimeout> | null = null
let loadedOnce = false

function resolveIcon(icon?: string | null): string | null {
  const p = typeof icon === 'string' ? icon.trim() : ''
  if (!p) return null
  if (/^https?:\/\//i.test(p)) return p
  return `${BASE_IMG}${p.replace(/^\//, '')}`
}

function initialOf(name?: string | null) {
  const s = (name || '?').trim()
  return s ? s.slice(0, 1) : '?'
}

function isSelected(id?: number) {
  return chooseItem.value?.tool_id != null && chooseItem.value.tool_id === id
}

function closeModel() {
  show.value = false
  init()
}

function handleClose() {
  closeModel()
}

function showModel(event?: MouseEvent) {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  } else {
    clickPosition.value = { x: 0, y: 0 }
  }
  show.value = true
  if (!loadedOnce) {
    void loadList()
  }
}

function init() {
  keywords.value = ''
  chooseItem.value = null
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

function chooseTool(tool: MiniTool) {
  if (isSelected(tool.tool_id)) {
    chooseItem.value = null
    return
  }
  chooseItem.value = tool
}

function confirmChoose() {
  if (!chooseItem.value) {
    useToast().add({
      title: '请选择小工具',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    return
  }
  emit('choose', [chooseItem.value])
  closeModel()
}

function search() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  void loadList()
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    void loadList()
  }, 320)
}

async function loadList() {
  loading.value = true
  try {
    const kw = keywords.value.trim()
    const data = await getMiniToolList(kw ? { keyword: kw } : {})
    listData.value = (Array.isArray(data) ? data : data?.rows || []).filter(
      (t) => t?.tool_id != null && Number.isFinite(Number(t.tool_id))
    )
    loadedOnce = true
  } catch (e) {
    console.error(e)
    listData.value = []
    useToast().add({
      title: '小工具加载失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel,
})
</script>
