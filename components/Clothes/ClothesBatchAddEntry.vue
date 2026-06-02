<script setup lang="ts">
import type { Wardrobe, Library } from '@/types/api'
import type ClothesBatchAdd from '@/components/Clothes/ClothesBatchAdd.vue'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import { insertClothesMultiple } from '@/api/wardrobe'
import { BASE_IMG } from '@/utils/ipConfig'

const emit = defineEmits<{
  success: []
}>()

type EntryStep = 'menu' | 'import'

const toast = useToast()
const show = ref(false)
const step = ref<EntryStep>('menu')
const loading = ref(false)
const clickPosition = ref({ x: 0, y: 0 })
const wardrobe = ref<Wardrobe | null>(null)
const lastOpenEvent = ref<MouseEvent | undefined>()
const importLibraries = ref<Library[]>([])

const clothesBatchAddRef = ref<InstanceType<typeof ClothesBatchAdd> | null>(null)
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)

const setClickPosition = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }
}

const reset = () => {
  step.value = 'menu'
  importLibraries.value = []
}

const closeModel = () => {
  show.value = false
  reset()
}

const ensureWardrobe = (item: Wardrobe | null): item is Wardrobe & { wardrobe_id: number } => {
  if (!item?.wardrobe_id) {
    toast.add({
      title: '请先选择衣柜',
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return false
  }
  return true
}

const showModel = (item: Wardrobe | null, event?: MouseEvent) => {
  if (!ensureWardrobe(item)) return
  setClickPosition(event)
  lastOpenEvent.value = event
  wardrobe.value = item
  reset()
  show.value = true
}

const mergeLibraries = (list: Library[]) => {
  const ids = new Set(importLibraries.value.map((i) => i.library_id))
  for (const lib of list) {
    if (lib.library_id != null && !ids.has(lib.library_id)) {
      importLibraries.value.push(lib)
      ids.add(lib.library_id)
    }
  }
}

const onChooseBatchAdd = () => {
  show.value = false
  clothesBatchAddRef.value?.showModel(wardrobe.value, lastOpenEvent.value)
}

const onChooseBatchImport = () => {
  show.value = false
  libraryChooseRef.value?.showModel()
}

const onLibraryChoose = (list: Library[]) => {
  if (!list.length) return
  mergeLibraries(list)
  step.value = 'import'
  show.value = true
}

const openMoreLibrary = () => {
  show.value = false
  libraryChooseRef.value?.showModel()
}

const removeImportLibrary = (libraryId: number) => {
  importLibraries.value = importLibraries.value.filter((i) => i.library_id !== libraryId)
}

const backToMenu = () => {
  step.value = 'menu'
}

const libraryCoverPath = (cover?: string) => {
  if (!cover) return ''
  return cover.replace(BASE_IMG, '')
}

const submitImport = async () => {
  const withCover = importLibraries.value.filter((lib) => lib.cover)
  if (!withCover.length) {
    toast.add({
      title: '请至少选择一条有封面的图鉴',
      icon: 'i-heroicons-exclamation-circle',
      color: 'amber',
    })
    return
  }
  if (loading.value || !wardrobe.value?.wardrobe_id) return
  loading.value = true
  try {
    await insertClothesMultiple({
      wardrobe_id: wardrobe.value.wardrobe_id,
      clothes_list: withCover.map((lib) => ({
        clothes_img: libraryCoverPath(lib.cover),
        clothes_note: lib.name?.trim() || undefined,
      })),
    })
    toast.add({
      title: `已批量导入 ${withCover.length} 件服饰`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    emit('success')
    closeModel()
  } catch {
    toast.add({
      title: '批量导入失败',
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
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="reset">
    <div
      class="w-[95vw] max-w-md max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
    >
      <!-- 方式选择 -->
      <template v-if="step === 'menu'">
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">批量添加服饰</h2>
            <p v-if="wardrobe?.wardrobe_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              衣柜：{{ wardrobe.wardrobe_name }}
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
        <div class="p-6 space-y-3">
          <button
            type="button"
            class="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-600 hover:border-qhx-primary hover:bg-pink-50/50 dark:hover:bg-pink-900/10 transition-colors text-left"
            @click="onChooseBatchImport"
          >
            <div
              class="w-12 h-12 rounded-full bg-qhx-primary/10 text-qhx-primary flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-book-open" class="text-2xl" />
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-gray-900 dark:text-gray-100">批量导入</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                从图鉴多选后导入衣柜，可继续增删
              </div>
            </div>
          </button>
          <button
            type="button"
            class="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-600 hover:border-qhx-primary hover:bg-pink-50/50 dark:hover:bg-pink-900/10 transition-colors text-left"
            @click="onChooseBatchAdd"
          >
            <div
              class="w-12 h-12 rounded-full bg-qhx-primary/10 text-qhx-primary flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-squares-plus" class="text-2xl" />
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-gray-900 dark:text-gray-100">批量添加</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                多选图片上传并填写名称
              </div>
            </div>
          </button>
        </div>
      </template>

      <!-- 图鉴导入回显 -->
      <template v-else>
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <div class="flex items-center gap-2 min-w-0">
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
              @click="backToMenu"
            >
              <UIcon name="i-heroicons-arrow-left" class="text-gray-500" />
            </button>
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">批量导入</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                已选 {{ importLibraries.length }} 条图鉴
              </p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
            @click="closeModel"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          <UButton
            color="primary"
            variant="soft"
            class="w-full justify-center"
            icon="i-heroicons-plus"
            @click="openMoreLibrary"
          >
            继续选择图鉴
          </UButton>

          <div v-if="importLibraries.length" class="space-y-2">
            <div
              v-for="item in importLibraries"
              :key="item.library_id"
              class="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600 min-w-0"
            >
              <div class="flex-1 min-w-0 overflow-hidden">
                <LibraryItem :needJump="false" size="mini-list" :item="item" />
              </div>
              <QhxJellyButton>
                <button
                  type="button"
                  class="w-8 h-8 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white shrink-0"
                  @click.stop="removeImportLibrary(item.library_id!)"
                >
                  <UIcon name="i-heroicons-x-mark" class="text-sm" />
                </button>
              </QhxJellyButton>
            </div>
          </div>
          <div v-else class="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            暂未选择图鉴，点击上方按钮添加
          </div>
        </div>

        <div
          class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <UButton color="gray" variant="ghost" :disabled="loading" @click="closeModel">取消</UButton>
          <UButton
            color="primary"
            :loading="loading"
            :disabled="!importLibraries.length"
            @click="submitImport"
          >
            确认导入
          </UButton>
        </div>
      </template>
    </div>
  </QhxModal>

  <clothes-batch-add ref="clothesBatchAddRef" @success="emit('success')" />
  <LibraryChoose
    ref="libraryChooseRef"
    :multiple="true"
    :keywordMode="true"
    @choose="onLibraryChoose"
  />
</template>
