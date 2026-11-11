<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Library } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { ImagePickerPreviewItem } from '@/components/Qhx/ImagePicker.vue'
import type {
  ClothesExtractItem,
  ClothesExtractLibraryCandidate,
  ClothesExtractShopCandidate,
} from '@/api/wardrobe'
import {
  applyLibraryCandidate,
  applyShopCandidate,
  clearLibraryCandidate,
  extractItemMeta,
  extractItemTitle,
  libraryCandidateCover,
  selectedShopCandidate,
  toRelativeClothesImg,
} from '@/utils/clothesExtract'

const { t } = useI18n()

const props = defineProps<{
  item: ClothesExtractItem
  index: number
  selected: boolean
  inserted: boolean
  inserting: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:item': [item: ClothesExtractItem]
  'update:selected': [selected: boolean]
  fill: []
  insert: []
  coverChange: [preview: ImagePickerPreviewItem | null]
}>()

const pickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const title = computed(() => extractItemTitle(props.item, props.index))
const meta = computed(() => extractItemMeta(props.item))
const libraries = computed(() => props.item.library_candidates ?? [])
const shops = computed(() => props.item.shop_candidates ?? [])
const activeLibraryId = computed(() => props.item.library_id ?? null)
const activeShop = computed(() => selectedShopCandidate(props.item))
const colorDots = computed(() =>
  (props.item.color ?? '')
    .split(/[,，]/)
    .map((c) => c.trim())
    .filter((c) => /^#?[0-9a-fA-F]{3,8}$/.test(c))
    .map((c) => (c.startsWith('#') ? c : `#${c}`)),
)

const cardClass = computed(() => {
  if (props.inserted) {
    return 'border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20'
  }
  if (props.selected) {
    return 'border-qhx-primary/45 bg-qhx-primary/[0.04] dark:bg-qhx-primary/10'
  }
  return 'border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800'
})

const seedCover = (path?: string | null) => {
  if (!pickerRef.value) return
  const t = path?.trim()
  if (t) pickerRef.value.seedFromPaths([t])
  else pickerRef.value.clear()
}

watch(
  () => props.item.clothes_img,
  (path) => {
    seedCover(path)
  },
)

watch(
  () => pickerRef.value?.previewImages,
  (images) => {
    emit('coverChange', images?.[0] ?? null)
  },
  { deep: true },
)

watch(pickerRef, (picker) => {
  if (picker) seedCover(props.item.clothes_img)
})

onMounted(() => {
  seedCover(props.item.clothes_img)
})

const candidateAsLibrary = (candidate: ClothesExtractLibraryCandidate): Library => ({
  library_id: candidate.library_id,
  name: candidate.name?.trim() || `图鉴 #${candidate.library_id}`,
  cover: toRelativeClothesImg(libraryCandidateCover(candidate)) || '',
})

const chooseLibrary = (candidate: ClothesExtractLibraryCandidate) => {
  if (props.inserted || props.disabled) return
  if (props.item.library_id === candidate.library_id) {
    emit('update:item', clearLibraryCandidate(props.item))
    return
  }
  emit('update:item', applyLibraryCandidate(props.item, candidate))
}

const chooseShop = (candidate: ClothesExtractShopCandidate) => {
  if (props.inserted || props.disabled) return
  emit('update:item', applyShopCandidate(props.item, candidate))
}

const isShopActive = (candidate: ClothesExtractShopCandidate) => {
  const active = activeShop.value
  if (!active) return false
  if (candidate.shop_id != null && active.shop_id != null) return candidate.shop_id === active.shop_id
  return Boolean(candidate.shop_name && candidate.shop_name === active.shop_name)
}

const toggleSelected = () => {
  if (props.inserted || props.disabled) return
  emit('update:selected', !props.selected)
}
</script>

<template>
  <div
    class="rounded-2xl border p-3.5 space-y-3.5 transition-colors"
    :class="cardClass"
  >
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="mt-1 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors"
        :class="selected
          ? 'border-qhx-primary bg-qhx-primary text-white'
          : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'"
        :disabled="inserted || disabled"
        :aria-checked="selected"
        role="checkbox"
        @click="toggleSelected"
      >
        <UIcon v-if="selected" name="i-heroicons-check-mini" class="w-3.5 h-3.5" />
      </button>
      <div class="w-[88px] shrink-0">
        <QhxImagePicker
          ref="pickerRef"
          compact
          :max="1"
          :disabled="inserted || disabled"
        />
      </div>
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <p class="font-semibold text-gray-900 dark:text-gray-100 break-words leading-snug">
            {{ title }}
          </p>
          <span
            v-if="inserted"
            class="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            {{ t('clothes.extract.inserted') }}
          </span>
        </div>
        <p
          v-if="meta"
          class="text-xs text-gray-500 dark:text-gray-400 break-words leading-relaxed"
        >
          {{ meta }}
        </p>
        <div v-if="colorDots.length" class="flex flex-wrap gap-1 pt-0.5">
          <span
            v-for="hex in colorDots"
            :key="hex"
            class="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20 shadow-sm"
            :style="{ backgroundColor: hex }"
            :title="hex"
          />
        </div>
      </div>
    </div>

    <div v-if="libraries.length" class="space-y-2">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
        {{ t('clothes.extract.library_candidates') }}<span class="font-normal text-gray-400 dark:text-gray-500">{{ t('clothes.extract.library_candidates_hint') }}</span>
      </p>
      <div class="extract-lib-grid">
        <button
          v-for="candidate in libraries"
          :key="candidate.library_id"
          type="button"
          class="extract-lib-pick text-left min-w-0"
          :class="candidate.library_id === activeLibraryId ? 'extract-lib-pick--active' : ''"
          :disabled="inserted || disabled"
          @click="chooseLibrary(candidate)"
        >
          <LibraryItem
            :item="candidateAsLibrary(candidate)"
            size="mini"
            :need-jump="false"
            :need-shop="false"
            class-name="bg-qhx-bg-card polaroid-card shadow-md p-1 rounded h-full"
          />
        </button>
      </div>
    </div>

    <div v-if="shops.length" class="space-y-1.5">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('clothes.extract.shop_candidates') }}</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="(candidate, shopIndex) in shops"
          :key="candidate.shop_id ?? candidate.shop_name ?? shopIndex"
          type="button"
          :disabled="inserted || disabled"
          @click="chooseShop(candidate)"
        >
          <QhxTag :active="isShopActive(candidate)">
            {{ candidate.shop_name || `店铺 #${candidate.shop_id}` }}
          </QhxTag>
        </button>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-0.5">
      <UButton
        size="xs"
        color="gray"
        variant="soft"
        :ui="{ rounded: 'rounded-full' }"
        :disabled="inserted || inserting || disabled"
        @click="emit('fill')"
      >
        {{ t('clothes.extract.fill_form') }}
      </UButton>
      <UButton
        size="xs"
        color="primary"
        :ui="{ rounded: 'rounded-full' }"
        :loading="inserting"
        :disabled="inserted || disabled"
        @click="emit('insert')"
      >
        {{ inserted ? t('clothes.extract.inserted') : t('clothes.extract.insert_direct') }}
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.extract-lib-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.extract-lib-pick {
  width: 100%;
  border-radius: 12px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.extract-lib-pick:hover:not(:disabled) {
  transform: translateY(-1px);
}

.extract-lib-pick--active {
  box-shadow: 0 0 0 2px var(--primary-color, #ff9eb5);
}

.extract-lib-pick:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.extract-lib-pick :deep(.inline-block) {
  display: block;
  width: 100%;
}

.extract-lib-pick :deep(img) {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.extract-lib-pick :deep(h3) {
  font-size: 11px;
  line-height: 1.3;
  margin-top: 2px;
}

.extract-lib-pick :deep(.mx-1) {
  margin-left: 2px;
  margin-right: 2px;
}

@media (min-width: 640px) {
  .extract-lib-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .extract-lib-pick {
    width: 108px;
    border-radius: 14px;
  }

  .extract-lib-pick :deep(img) {
    width: 100px;
    height: 100px;
  }

  .extract-lib-pick :deep(h3) {
    font-size: 12px;
  }
}
</style>
