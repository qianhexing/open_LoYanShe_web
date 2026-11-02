<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { getLibraryList, getLibraryVideo } from '@/api/library'
import type { Library, LibraryVideo } from '@/types/api'
import type { LibraryTypeColorChooseResult } from '@/utils/libraryClothesSeed'
import { BASE_IMG } from '@/utils/ipConfig'

withDefaults(defineProps<{
  needStatus?: boolean
  needHiddenTabbar?: boolean
  filter_list?: Array<Record<string, unknown>>
  multiple?: boolean
  need_parent?: boolean
}>(), {
  needStatus: true,
  needHiddenTabbar: false,
  filter_list: () => [],
  multiple: false,
  need_parent: true
})

const emit = defineEmits<{
  choose: [payload: LibraryTypeColorChooseResult]
}>()

const capsuleBtnUi = { rounded: 'rounded-full' } as const
const DEFAULT_LIBRARY_COVER = 'static/plan_cover/default.jpg'

interface LibrarySkuItem {
  library_pattern: string
  library_price?: number
  cover?: string
}

interface TypeOption {
  key: string
  label: string
  cover: string
  library: Library
  kind: 'library' | 'sku'
}

const parseLibraryJsonData = (jsonData: unknown): Record<string, unknown> => {
  if (jsonData == null) return {}
  if (typeof jsonData === 'string') {
    try {
      const parsed = JSON.parse(jsonData)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
    return jsonData as Record<string, unknown>
  }
  return {}
}

const extractSkuListFromJsonData = (jsonData: unknown): LibrarySkuItem[] => {
  const data = parseLibraryJsonData(jsonData)
  const raw = data.sku
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return []
    }
  }
  return list
    .map((item): LibrarySkuItem | null => {
      if (!item || typeof item !== 'object' || !('library_pattern' in item)) return null
      const record = item as LibrarySkuItem
      const pattern = String(record.library_pattern ?? '').trim()
      if (!pattern) return null
      const cover = record.cover != null ? String(record.cover).trim() : undefined
      return {
        library_pattern: pattern,
        library_price: record.library_price != null ? Number(record.library_price) : undefined,
        cover: cover || undefined
      }
    })
    .filter((item): item is LibrarySkuItem => item != null)
}

const normalizeCoverPath = (cover?: string | null): string => {
  if (!cover?.trim()) return DEFAULT_LIBRARY_COVER
  return cover
    .trim()
    .replace(BASE_IMG, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^\//, '')
}

const resolveCoverPath = (cover?: string | null, fallback?: string | null): string => {
  if (cover?.trim()) return normalizeCoverPath(cover)
  if (fallback?.trim()) return normalizeCoverPath(fallback)
  return DEFAULT_LIBRARY_COVER
}

const coverImageUrl = (path?: string | null) =>
  `${BASE_IMG}${normalizeCoverPath(path)}?x-oss-process=image/quality,q_60/resize,w_150`

const buildTypeOptions = (libraryList: Library[], primaryItem: Library): TypeOption[] => {
  const childLibraries = libraryList.filter((lib) => lib.library_id !== primaryItem.library_id)
  if (childLibraries.length) {
    return childLibraries.map((item) => ({
      key: `lib-${item.library_id}`,
      label: item.library_type || item.name || '图鉴',
      cover: resolveCoverPath(item.cover),
      library: item,
      kind: 'library' as const
    }))
  }

  const skuItems = extractSkuListFromJsonData(primaryItem.json_data)
  if (!skuItems.length) return []

  const patternNames = primaryItem.library_pattern
    ? primaryItem.library_pattern.split(',').map((s) => s.trim()).filter(Boolean)
    : skuItems.map((item) => item.library_pattern)
  const uniquePatterns = patternNames.filter((name, index, arr) => arr.indexOf(name) === index)
  const skuByPattern = new Map(skuItems.map((item) => [item.library_pattern, item]))

  return uniquePatterns.map((pattern) => {
    const sku = skuByPattern.get(pattern)
    return {
      key: `sku-${pattern}`,
      label: pattern,
      cover: resolveCoverPath(sku?.cover, primaryItem.cover),
      library: primaryItem,
      kind: 'sku' as const
    }
  })
}

const show = shallowRef(false)
const loading = shallowRef(false)
const primaryLibrary = shallowRef<Library | null>(null)
const typeOptions = shallowRef<TypeOption[]>([])
const typeOptionKind = shallowRef<'library' | 'sku' | null>(null)
const imageList = shallowRef<Array<{ title: string; image: string[] }>>([])
const selectedTypeKeys = shallowRef<string[]>([])
const selected = shallowRef<string | null>(null)
const clickPosition = shallowRef({ x: 0, y: 0 })
let loadSeq = 0

const typeSectionTitle = computed(() => {
  if (typeOptionKind.value === 'library') return '子图鉴'
  if (typeOptionKind.value === 'sku') return '版型'
  return '类型'
})

const typeSelectHint = computed(() => {
  if (typeOptionKind.value === 'library') return '子图鉴可多选，下面是封面（单选）'
  if (typeOptionKind.value === 'sku') return '版型可多选，下面是封面（单选）'
  return '类型可多选，下面是封面（单选）'
})

const toggleType = (option: TypeOption) => {
  const current = selectedTypeKeys.value
  selectedTypeKeys.value = current.includes(option.key)
    ? current.filter((key) => key !== option.key)
    : [...current, option.key]
}

const chooseClothesImg = (url: string) => {
  selected.value = url
}

const getLibraryVideoAll = async (pk_id: number): Promise<LibraryVideo[]> => {
  return getLibraryVideo({ pk_id: Number.parseInt(String(pk_id), 10) })
}

const init = () => {
  selected.value = null
  primaryLibrary.value = null
  selectedTypeKeys.value = []
  typeOptions.value = []
  typeOptionKind.value = null
  imageList.value = []
}

const closeModel = () => {
  loadSeq += 1
  show.value = false
  init()
}

const showModel = async (item: Library, event?: MouseEvent) => {
  const seq = ++loadSeq
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  show.value = true
  primaryLibrary.value = item
  loading.value = true
  let libraryList: Library[] = [item]
  const nextImages: Array<{ title: string; image: string[] }> = []
  const libraryCover = resolveCoverPath(item.cover)
  selectedTypeKeys.value = []

  if (item.detail_image) {
    nextImages.push({
      title: '详情图',
      image: [
        libraryCover,
        ...item.detail_image.split(',').filter(Boolean).map((img) => resolveCoverPath(img, item.cover))
      ]
    })
  }

  if (item.library_type === '系列') {
    try {
      const result = await getLibraryList({
        page: 1,
        pageSize: 999,
        filter_list: [{
          field: 'parent_id',
          value: item.library_id,
          op: 'and'
        }]
      })
      if (seq !== loadSeq) return
      if (result.rows && result.rows.length > 0) {
        libraryList = [item, ...result.rows]
      }
    } catch (e) {
      console.error('获取子图鉴失败:', e)
    }
  }
  if (seq !== loadSeq) return

  try {
    const video = await getLibraryVideoAll(item.library_id)
    for (const child of video) {
      nextImages.push({
        title: child.title || '人台图',
        image: (child.addr ?? '').split(',').filter(Boolean).map((img) => resolveCoverPath(img, item.cover))
      })
    }
  } catch (e) {
    console.error('获取图片列表失败:', e)
  }
  if (seq !== loadSeq) return

  const hasChildLibraries = libraryList.length > 1
  const hasDetailImage = Boolean(item.detail_image?.trim())
  if (!hasChildLibraries && !hasDetailImage) {
    const coverInList = nextImages.some((group) =>
      group.image.some((img) => normalizeCoverPath(img) === libraryCover)
    )
    if (!coverInList) {
      nextImages.unshift({
        title: '图鉴封面',
        image: [libraryCover]
      })
    }
  }

  const options = buildTypeOptions(libraryList, item)
  typeOptions.value = options
  typeOptionKind.value = options[0]?.kind ?? null
  imageList.value = nextImages
  selected.value = !hasChildLibraries && !hasDetailImage && options.length <= 1
    ? libraryCover
    : null
  loading.value = false
}

const choose = () => {
  if (!primaryLibrary.value) return
  const selectedOptions = typeOptions.value.filter((option) => selectedTypeKeys.value.includes(option.key))
  emit('choose', {
    library: primaryLibrary.value,
    clothes_img: selected.value,
    selected_type_labels: selectedOptions.map((option) => option.label).filter(Boolean),
    selected_type_covers: selectedOptions.map((option) => normalizeCoverPath(option.cover))
  })
  closeModel()
}

defineExpose({ showModel })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :z-index="240" :close-on-backdrop="false" @close="closeModel">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold">选择图鉴型色</h2>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <div v-if="loading" class="flex justify-center py-10">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl text-qhx-primary" />
        </div>
        <template v-else>
          <div v-if="typeOptions.length > 1" class="space-y-2">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ typeSectionTitle }}</div>
            <div class="cover-type-row">
              <button
                v-for="option in typeOptions"
                :key="option.key"
                type="button"
                class="cover-pick-tile cover-pick-tile--row"
                :class="selectedTypeKeys.includes(option.key) ? 'cover-pick-tile--active' : ''"
                @click="toggleType(option)"
              >
                <img :src="coverImageUrl(option.cover)" :alt="option.label || '图鉴封面'" class="cover-pick-img" />
                <span v-if="option.label" class="cover-pick-badge">{{ option.label }}</span>
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ typeSelectHint }}</p>
          </div>

          <div v-if="!imageList.length && typeOptions.length <= 1" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            暂无可选图片
          </div>

          <div v-for="(image, index) in imageList" :key="`${image.title}-${index}`" class="space-y-2">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ image.title }}</div>
            <div class="grid grid-cols-4 sm:grid-cols-5 gap-3">
              <button
                v-for="(imgUrl, imgIndex) in image.image"
                :key="`${imgUrl}-${imgIndex}`"
                type="button"
                class="cover-pick-tile"
                :class="selected === normalizeCoverPath(imgUrl) ? 'cover-pick-tile--active' : ''"
                @click="chooseClothesImg(normalizeCoverPath(imgUrl))"
              >
                <img :src="coverImageUrl(imgUrl)" :alt="`${image.title} - ${imgIndex + 1}`" class="cover-pick-img" />
              </button>
            </div>
          </div>
        </template>
      </div>

      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton color="gray" variant="ghost" :ui="capsuleBtnUi" class="px-6" @click="closeModel">
          取消
        </UButton>
        <UButton
          :disabled="loading"
          :ui="capsuleBtnUi"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="choose"
        >
          确认选择
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<style scoped>
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
