<script setup lang="ts">
import type { Wardrobe } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { insertClothesMultiple } from '@/api/wardrobe'
import type { ClothesBatchInsertItem } from '@/api/wardrobe'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { uploadPairedLiveToOSS } from '@/utils/ossUpload'
import { normalizeRawImgPath } from '@/utils/communityLiveMedia'

const emit = defineEmits<{
  success: []
}>()

const capsuleBtnUi = { rounded: 'rounded-full' } as const

type PreviewItem = NonNullable<InstanceType<typeof QhxImagePicker>['previewImages']>[number]

interface DraftRow {
  id: string
  url: string
  clothes_note: string
  preview: PreviewItem
}

const { t } = useI18n()
const toast = useToast()
const configStore = useConfigStore()

/** iOS Tab 内嵌：底部留白（query.tabbar → configStore） */
const tabBarInsetPx = computed(() => {
  const n = Number(configStore.tabBarHeight || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const modalPanelStyle = computed(() =>
  tabBarInsetPx.value > 0
    ? { maxHeight: `calc(90dvh - ${tabBarInsetPx.value}px)` }
    : undefined
)

const show = ref(false)
const loading = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const wardrobe = ref<Wardrobe | null>(null)
const coverPickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const draftList = ref<DraftRow[]>([])

const syncDraftFromPicker = () => {
  const images = coverPickerRef.value?.previewImages ?? []
  const noteById = new Map(draftList.value.map((d) => [d.id, d.clothes_note]))
  draftList.value = images.map((img, index) => {
    const id = img.id ?? img.url ?? `row_${index}`
    return {
      id,
      url: img.url ?? '',
      clothes_note: noteById.get(id) ?? '',
      preview: img,
    }
  })
}

watch(
  () => coverPickerRef.value?.previewImages,
  () => syncDraftFromPicker(),
  { deep: true },
)

const fetchUpload = async (file: {
  file?: File
  url?: string
  videoFile?: File
  videoUrl?: string
  kind?: 'image' | 'live'
}): Promise<string> => {
  if (file.kind === 'live' && file.videoFile && file.file) {
    return uploadPairedLiveToOSS(file.videoFile, file.file)
  }
  if (file.kind === 'live' && file.videoUrl && !file.videoFile) {
    return normalizeRawImgPath(file.videoUrl)
  }
  if (file.file) {
    const res = await uploadImage(file.file)
    return res.file_url
  }
  if (file.url) {
    return file.url.replace(BASE_IMG, '')
  }
  throw new Error('无效图片')
}

const reset = () => {
  coverPickerRef.value?.clear()
  draftList.value = []
}

const closeModel = () => {
  show.value = false
  reset()
}

const showModel = (item: Wardrobe | null, event?: MouseEvent) => {
  if (!item?.wardrobe_id) {
    toast.add({
      title: t('clothes.batch.select_wardrobe_first'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
  wardrobe.value = item
  reset()
  show.value = true
}

const submit = async () => {
  if (!draftList.value.length) {
    toast.add({
      title: t('clothes.batch.select_cover_first'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const clothes_list: ClothesBatchInsertItem[] = []
    for (const row of draftList.value) {
      try {
        const clothes_img = await fetchUpload(row.preview)
        clothes_list.push({
          clothes_img,
          clothes_note: row.clothes_note.trim() || undefined,
        })
      } catch {
        // 单张失败时跳过
      }
    }
    if (!clothes_list.length) {
      toast.add({
        title: t('clothes.batch.upload_failed'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
      return
    }
    await insertClothesMultiple({
      clothes_list,
      wardrobe_id: wardrobe.value?.wardrobe_id,
    })
    toast.add({
      title: t('clothes.batch.created', { count: clothes_list.length }),
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    emit('success')
    closeModel()
  } catch {
    toast.add({
      title: t('clothes.batch.create_failed'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :bottom-inset="tabBarInsetPx" @close="reset">
    <div
      class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
      :style="modalPanelStyle"
    >
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
      >
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ t('clothes.batch.create_title') }}</h2>
          <p v-if="wardrobe?.wardrobe_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('clothes.batch.wardrobe', { name: wardrobe.wardrobe_name }) }}
          </p>
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
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('clothes.batch.create_hint') }}
        </p>
        <UFormGroup :label="t('clothes.batch.covers')">
          <QhxImagePicker allow-live ref="coverPickerRef" :multiple="true" />
        </UFormGroup>

        <div v-if="draftList.length" class="space-y-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('clothes.batch.info_count', { count: draftList.length }) }}
          </p>
          <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            <div
              v-for="(row, index) in draftList"
              :key="row.id"
              class="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600"
            >
              <span class="text-xs text-gray-400 w-5 shrink-0 text-center">{{ index + 1 }}</span>
              <img
                :src="row.url"
                alt=""
                class="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-600"
              />
              <UFormGroup :label="t('clothes.batch.name')" class="flex-1 min-w-0 mb-0">
                <UInput
                  v-model="row.clothes_note"
                  :placeholder="t('clothes.batch.name_placeholder')"
                  class="w-full"
                />
              </UFormGroup>
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex justify-end gap-2 px-6 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        :style="{
          paddingBottom:
            tabBarInsetPx > 0
              ? '1rem'
              : 'max(1rem, env(safe-area-inset-bottom, 0px))',
        }"
      >
        <UButton color="gray" variant="ghost" :ui="capsuleBtnUi" :disabled="loading" @click="closeModel">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :ui="capsuleBtnUi" :loading="loading" :disabled="!draftList.length" @click="submit">
          {{ t('clothes.batch.confirm_create') }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>
