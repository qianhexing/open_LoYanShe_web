<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { Wardrobe } from '@/types/api'
import QhxModal from '@/components/Qhx/Modal.vue'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { ImagePickerPreviewItem } from '@/components/Qhx/ImagePicker.vue'
import { extractClothesFromImage, insertClothes } from '@/api/wardrobe'
import type { ClothesExtractFromImageParams } from '@/api/wardrobe'
import { uploadImage, uploadImageToTemp } from '@/api'
import ClothesExtractResultItem from '@/components/Clothes/ClothesExtractResultItem.vue'
import {
  CLOTHES_EXTRACT_MAX_IMAGES,
  createExtractDrafts,
  mapExtractToClothesAddItem,
  mapExtractToInsertPayload,
  normalizeClothesExtractResult,
  resolveExtractCoverPath,
  toPublicImageUrl,
  type ClothesExtractAddItem,
  type ClothesExtractDraft,
} from '@/utils/clothesExtract'

const emit = defineEmits<{
  confirm: [item: ClothesExtractAddItem]
  success: []
}>()

const capsuleBtnUi = { rounded: 'rounded-full' } as const
const { t } = useI18n()
const toast = useQhxToast()

const show = shallowRef(false)
const loading = shallowRef(false)
const batchLoading = shallowRef(false)
const insertingKey = shallowRef<string | null>(null)
const step = shallowRef<'pick' | 'review'>('pick')
const clickPosition = ref({ x: 0, y: 0 })
const wardrobe = shallowRef<Wardrobe | null>(null)
const drafts = ref<ClothesExtractDraft[]>([])
const coverByKey = ref<Record<string, ImagePickerPreviewItem | null>>({})
const pendingKey = shallowRef<string | null>(null)
const pickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const previewCount = shallowRef(0)

watch(
  () => pickerRef.value?.previewImages,
  (images) => {
    previewCount.value = images?.length ?? 0
  },
  { deep: true },
)

const maxImages = CLOTHES_EXTRACT_MAX_IMAGES
const wardrobeName = computed(() => wardrobe.value?.wardrobe_name ?? '')
const selectedDrafts = computed(() => drafts.value.filter((d) => d.selected && !d.inserted))
const canBatchInsert = computed(() => selectedDrafts.value.length > 0 && !batchLoading.value && !loading.value)

const setClickPosition = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
    return
  }
  if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
}

const reset = () => {
  step.value = 'pick'
  drafts.value = []
  coverByKey.value = {}
  pendingKey.value = null
  insertingKey.value = null
  pickerRef.value?.clear()
}

const closeModel = () => {
  show.value = false
  reset()
}

const showModel = (item: Wardrobe | null, event?: MouseEvent) => {
  if (!item?.wardrobe_id) {
    toast.add({
      title: t('clothes.extract.select_wardrobe_first'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  setClickPosition(event)
  wardrobe.value = item
  reset()
  show.value = true
}

const collectPublicUrls = async (): Promise<string[]> => {
  const images = pickerRef.value?.previewImages ?? []
  if (images.length > maxImages) {
    throw new Error(`最多选择 ${maxImages} 张图`)
  }
  const urls: string[] = []
  for (const img of images) {
    if (img.file) {
      const uploaded = await uploadImageToTemp(img.file)
      const publicUrl = toPublicImageUrl(uploaded.file_url)
      if (!publicUrl) throw new Error('图片上传后未获得公网地址')
      urls.push(publicUrl)
      continue
    }
    const existing = img.url?.trim() ?? ''
    if (/^https?:\/\//i.test(existing) && !existing.startsWith('blob:')) {
      urls.push(existing)
      continue
    }
    throw new Error('请选择本地图片后再识别')
  }
  return urls
}

const extract = async () => {
  if (loading.value) return
  const count = pickerRef.value?.previewImages?.length ?? 0
  if (!count) {
    toast.add({
      title: t('clothes.extract.select_images_first'),
      description: t('clothes.extract.max_images_desc', { max: maxImages }),
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  if (count > maxImages) {
    toast.add({
      title: t('clothes.extract.max_images', { max: maxImages }),
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  loading.value = true
  try {
    let urls: string[] = []
    try {
      urls = await collectPublicUrls()
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      toast.add({
        title: t('clothes.extract.upload_failed'),
        description: message,
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
      return
    }
    if (!urls.length) {
      toast.add({
        title: t('clothes.extract.upload_one'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'amber',
      })
      return
    }
    const payload: ClothesExtractFromImageParams =
      urls.length === 1
        ? { url: urls[0] }
        : { urls }
    const raw = await extractClothesFromImage(payload)
    const parsed = normalizeClothesExtractResult(raw)
    drafts.value = createExtractDrafts(parsed.items)
    coverByKey.value = {}
    pendingKey.value = null
    step.value = 'review'
  } catch {
    // 接口错误已由 httpCore 提示
  } finally {
    loading.value = false
  }
}

const backToPick = () => {
  step.value = 'pick'
}

const updateDraftItem = (key: string, item: ClothesExtractDraft['item']) => {
  const row = drafts.value.find((d) => d.key === key)
  if (row) row.item = item
}

const updateDraftSelected = (key: string, selected: boolean) => {
  const row = drafts.value.find((d) => d.key === key)
  if (row) row.selected = selected
}

const onCoverChange = (key: string, preview: ImagePickerPreviewItem | null) => {
  coverByKey.value = { ...coverByKey.value, [key]: preview }
}

const fillItem = async (draft: ClothesExtractDraft) => {
  const current = wardrobe.value
  if (!current?.wardrobe_id || draft.inserted || loading.value) return
  const preview = coverByKey.value[draft.key]
  if (preview?.file) {
    try {
      draft.item.clothes_img = await uploadCoverFile(preview.file)
    } catch {
      toast.add({
        title: t('clothes.extract.cover_failed'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
      return
    }
  }
  pendingKey.value = draft.key
  emit('confirm', mapExtractToClothesAddItem(current, draft.item))
}

const uploadCoverFile = async (file: File) => {
  const uploaded = await uploadImage(file)
  return uploaded.file_url
}

const insertDraft = async (draft: ClothesExtractDraft): Promise<boolean> => {
  const current = wardrobe.value
  if (!current?.wardrobe_id || draft.inserted) return false
  const clothesImg = await resolveExtractCoverPath(
    coverByKey.value[draft.key],
    draft.item.clothes_img,
    uploadCoverFile,
  )
  await insertClothes(mapExtractToInsertPayload(current.wardrobe_id, draft.item, clothesImg))
  draft.inserted = true
  draft.selected = false
  return true
}

const insertOne = async (draft: ClothesExtractDraft) => {
  if (insertingKey.value || batchLoading.value) return
  insertingKey.value = draft.key
  try {
    await insertDraft(draft)
    toast.add({
      title: t('clothes.extract.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    emit('success')
  } catch {
    // 接口错误已由 httpCore 提示
  } finally {
    insertingKey.value = null
  }
}

const insertSelected = async () => {
  if (!canBatchInsert.value) return
  const rows = selectedDrafts.value
  batchLoading.value = true
  let ok = 0
  try {
    for (const draft of rows) {
      try {
        if (await insertDraft(draft)) ok += 1
      } catch {
        // 单条失败继续
      }
    }
    if (ok) {
      toast.add({
        title: t('clothes.extract.saved_count', { count: ok }),
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
      emit('success')
    } else {
      toast.add({
        title: t('clothes.extract.save_failed'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
    }
  } finally {
    batchLoading.value = false
  }
}

const markInserted = () => {
  const key = pendingKey.value
  if (key == null) return
  const row = drafts.value.find((d) => d.key === key)
  if (row) {
    row.inserted = true
    row.selected = false
  }
  pendingKey.value = null
}

defineExpose({ showModel, markInserted })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :z-index="190" @close="reset">
    <div
      class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
    >
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50/80 to-purple-50/60 dark:from-gray-800 dark:to-gray-800 shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <button
            v-if="step === 'review'"
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
            @click="backToPick"
          >
            <UIcon name="i-heroicons-arrow-left" class="text-gray-500" />
          </button>
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
              {{ step === 'review' ? t('clothes.extract.result') : t('clothes.extract.title') }}
            </h2>
            <p v-if="wardrobeName" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {{ t('clothes.extract.wardrobe', { name: wardrobeName }) }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div v-show="step === 'pick'" class="space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('clothes.extract.hint', { max: maxImages }) }}
          </p>
          <UFormGroup :label="t('clothes.extract.images', { current: previewCount, max: maxImages })">
            <QhxImagePicker ref="pickerRef" :multiple="true" :max="maxImages" />
          </UFormGroup>
        </div>

        <div v-if="step === 'review'" class="space-y-3">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('clothes.extract.review_hint', { count: drafts.length }) }}
          </p>
          <div v-if="drafts.length" class="space-y-3">
            <ClothesExtractResultItem
              v-for="(draft, index) in drafts"
              :key="draft.key"
              :item="draft.item"
              :index="index"
              :selected="draft.selected"
              :inserted="draft.inserted"
              :inserting="insertingKey === draft.key"
              :disabled="batchLoading"
              @update:item="updateDraftItem(draft.key, $event)"
              @update:selected="updateDraftSelected(draft.key, $event)"
              @cover-change="onCoverChange(draft.key, $event)"
              @fill="fillItem(draft)"
              @insert="insertOne(draft)"
            />
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('clothes.extract.empty') }}
          </p>
        </div>
      </div>

      <div
        class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
      >
        <UButton color="gray" variant="ghost" :ui="capsuleBtnUi" :disabled="loading || batchLoading" @click="closeModel">
          {{ step === 'review' ? t('clothes.extract.done') : t('common.cancel') }}
        </UButton>
        <UButton
          v-if="step === 'review'"
          color="primary"
          :ui="capsuleBtnUi"
          :loading="batchLoading"
          :disabled="!canBatchInsert"
          @click="insertSelected"
        >
          {{ selectedDrafts.length ? t('clothes.extract.save_selected', { count: selectedDrafts.length }) : t('clothes.extract.save_selected_empty') }}
        </UButton>
        <UButton
          v-if="step === 'pick'"
          color="primary"
          :ui="capsuleBtnUi"
          :loading="loading"
          @click="extract"
        >
          {{ t('clothes.extract.start') }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>
