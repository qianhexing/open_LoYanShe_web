<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Library } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { normalizeClothesImgPath } from '@/utils/libraryClothesSeed'
import {
  loadLibraryCoverImageGroups,
  type LibraryCoverImageGroup,
  type LibraryCoverTypeOption
} from '@/utils/libraryCoverImages'

export interface LibraryCoverChoosePayload {
  clothesImg: string | null
  typeLabels: string[]
  typeCovers: string[]
}
import { useQhxToast } from '@/composables/useQhxToast'

const emit = defineEmits<{
  choose: [payload: LibraryCoverChoosePayload]
}>()

const toast = useQhxToast()
const capsuleBtnUi = { rounded: 'rounded-full' } as const
const show = shallowRef(false)
const loading = shallowRef(false)
const groups = shallowRef<LibraryCoverImageGroup[]>([])
const typeOptions = shallowRef<LibraryCoverTypeOption[]>([])
const selectedTypeKeys = shallowRef<string[]>([])
const selected = shallowRef<string | null>(null)
const clickPosition = shallowRef({ x: 0, y: 0 })

const coverImageUrl = (path: string) =>
  `${BASE_IMG}${path}?x-oss-process=image/quality,q_60/resize,w_150`

const showModel = async (library: Library, currentPath?: string | null, event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  show.value = true
  loading.value = true
  selected.value = normalizeClothesImgPath(currentPath) ?? null
  groups.value = []
  typeOptions.value = []
  selectedTypeKeys.value = []
  try {
    const next = await loadLibraryCoverImageGroups(library)
    groups.value = next.groups
    typeOptions.value = next.typeOptions
    if (!next.groups.length && !next.typeOptions.length) {
      toast.add({ title: '该图鉴暂无可选图片', color: 'orange' })
    }
  } catch {
    toast.add({ title: '加载图鉴图片失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

const close = () => {
  show.value = false
}

const toggleType = (key: string) => {
  const current = selectedTypeKeys.value
  selectedTypeKeys.value = current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key]
}

const confirm = () => {
  const picked = typeOptions.value.filter((option) => selectedTypeKeys.value.includes(option.key))
  if (!selected.value && !picked.length) {
    toast.add({ title: '请选择图片或版型', color: 'orange' })
    return
  }
  emit('choose', {
    clothesImg: selected.value,
    typeLabels: picked.map((option) => option.label).filter(Boolean),
    typeCovers: picked.map((option) => option.cover)
  })
  close()
}

defineExpose({ showModel })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :z-index="320" :close-on-backdrop="false" @close="close">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold">更换封面</h2>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          @click="close"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div v-if="loading" class="flex justify-center py-10">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl text-qhx-primary" />
        </div>
        <template v-else>
        <div v-if="typeOptions.length" class="space-y-2">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-200">版型</div>
          <div class="cover-type-row">
            <button
              v-for="option in typeOptions"
              :key="option.key"
              type="button"
              class="cover-pick-tile cover-pick-tile--row"
              :class="selectedTypeKeys.includes(option.key) ? 'cover-pick-tile--active' : ''"
              @click="toggleType(option.key)"
            >
              <img :src="coverImageUrl(option.cover)" :alt="option.label" class="cover-pick-img" />
              <span v-if="option.label" class="cover-pick-badge">{{ option.label }}</span>
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">版型可多选，下面是封面（单选）</p>
        </div>
        <div v-if="!groups.length && !typeOptions.length" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          暂无可选图片
        </div>
        <div v-for="(group, index) in groups" :key="`${group.title}-${index}`" class="space-y-2">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ group.title }}</div>
          <div class="grid grid-cols-4 sm:grid-cols-5 gap-3">
            <button
              v-for="(imgUrl, imgIndex) in group.images"
              :key="`${imgUrl}-${imgIndex}`"
              type="button"
              class="cover-pick-tile"
              :class="selected === imgUrl ? 'cover-pick-tile--active' : ''"
              @click="selected = imgUrl"
            >
              <img :src="coverImageUrl(imgUrl)" :alt="`${group.title} - ${imgIndex + 1}`" class="cover-pick-img" />
            </button>
          </div>
        </div>
        </template>
      </div>

      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton color="gray" variant="ghost" :ui="capsuleBtnUi" class="px-6" @click="close">
          取消
        </UButton>
        <UButton
          :ui="capsuleBtnUi"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="confirm"
        >
          确认选择
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
/* 1:1：旧版安卓 WebView 不支持 aspect-ratio，用 padding 撑开 */
.cover-pick-tile {
  position: relative;
  display: block;
  width: 100%;
  height: 0;
  margin: 0;
  padding: 0 0 100%;
  border: 0;
  line-height: 0;
  font-size: 0;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 0 0 1px #e5e7eb;
}

.cover-pick-tile--active {
  box-shadow: 0 0 0 2px #ec4899;
}

.cover-type-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 横向滚动里百分比 padding 会按整行宽度计算，改成固定边长 */
.cover-pick-tile--row {
  width: 72px;
  height: 72px;
  padding: 0;
  flex: 0 0 72px;
}

.dark .cover-pick-tile {
  box-shadow: 0 0 0 1px #4b5563;
}

.dark .cover-pick-tile--active {
  box-shadow: 0 0 0 2px #ec4899;
}

.cover-pick-img {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

.cover-pick-badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  max-width: 100%;
  padding: 2px 4px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.2;
  color: #fff;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: #faa2ae;
  border-radius: 0 12px 0 6px;
}
</style>
