<script setup lang="ts">
import { getAlbumDetail, getAlbumList, insertAlbum, updateAlbum } from '@/api/album'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { AlbumChildInput } from '@/types/api'

interface ChildFormItem {
  key: string
  album_id?: number
  album_cover: string
  album_title: string
  album_desc: string
  sort: number
}

const emit = defineEmits<{ success: [] }>()

const toast = useToast()
const configStore = useConfigStore()

const show = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const type = ref(0) // 0 新增 1 编辑
const editingAlbumId = ref<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })
const originalChildIds = ref<number[]>([])
const wasPublicOnLoad = ref(false)
const isPublicLocked = ref(false)
const showPublicConfirmModal = ref(false)
const publicConfirmPosition = ref({ x: 0, y: 0 })

const coverPickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const childCoverPickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const activeChildCoverIndex = ref<number | null>(null)

const form = ref({
  album_title: '',
  album_cover: '',
  album_desc: '',
  is_private: true,
  sort: 0,
})

const children = ref<ChildFormItem[]>([])

const getImageParams = () => configStore.config?.image_params || ''

const coverPreviewUrl = computed(() => {
  const preview = coverPickerRef.value?.previewImages?.[0]?.url?.trim()
  if (preview) return preview
  const cover = form.value.album_cover
  if (cover) return `${BASE_IMG}${cover}${getImageParams()}`
  return ''
})

const modalTitle = computed(() => {
  if (type.value === 0) return '新建打卡相册'
  return wasPublicOnLoad.value ? '编辑公开成就簿' : '编辑打卡相册'
})

const isExistingChild = (child: ChildFormItem) => child.album_id != null

const newChildren = computed(() => children.value.filter((child) => !isExistingChild(child)))

const createChildKey = () => `child_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createEmptyChild = (sort = 1): ChildFormItem => ({
  key: createChildKey(),
  album_cover: '',
  album_title: '',
  album_desc: '',
  sort,
})

const getChildCoverPreview = (child: ChildFormItem) => {
  if (child.album_cover) return `${BASE_IMG}${child.album_cover}${getImageParams()}`
  return ''
}

const initData = () => {
  coverPickerRef.value?.clear()
  childCoverPickerRef.value?.clear()
  activeChildCoverIndex.value = null
  form.value = {
    album_title: '',
    album_cover: '',
    album_desc: '',
    is_private: true,
    sort: 0,
  }
  children.value = [createEmptyChild()]
  editingAlbumId.value = null
  originalChildIds.value = []
  wasPublicOnLoad.value = false
  isPublicLocked.value = false
  showPublicConfirmModal.value = false
  type.value = 0
}

const openCoverPicker = () => {
  if (wasPublicOnLoad.value) return
  coverPickerRef.value?.triggerInput()
}

const clearCover = (e: MouseEvent) => {
  if (wasPublicOnLoad.value) return
  e.stopPropagation()
  coverPickerRef.value?.clear()
  form.value.album_cover = ''
}

const openChildCoverPicker = (index: number) => {
  const child = children.value[index]
  if (wasPublicOnLoad.value && child && isExistingChild(child)) return
  activeChildCoverIndex.value = index
  childCoverPickerRef.value?.triggerInput()
}

const clearChildCover = (index: number, e: MouseEvent) => {
  const child = children.value[index]
  if (wasPublicOnLoad.value && child && isExistingChild(child)) return
  e.stopPropagation()
  children.value[index].album_cover = ''
}

const onUpdateCoverFiles = async (files: File[]) => {
  if (wasPublicOnLoad.value) return
  if (files.length > 0) {
    try {
      const result = await uploadImage(files[0])
      form.value.album_cover = result.file_url
    } catch (error) {
      console.error('封面上传失败:', error)
      toast.add({
        title: '封面上传失败',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
    }
  } else {
    form.value.album_cover = ''
  }
}

const onUpdateChildCoverFiles = async (files: File[]) => {
  const index = activeChildCoverIndex.value
  if (index == null || !children.value[index]) return
  if (wasPublicOnLoad.value && isExistingChild(children.value[index])) return

  if (files.length > 0) {
    try {
      const result = await uploadImage(files[0])
      children.value[index].album_cover = result.file_url
    } catch (error) {
      console.error('子目标封面上传失败:', error)
      toast.add({
        title: '子目标封面上传失败',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red',
      })
    }
  } else {
    children.value[index].album_cover = ''
  }
}

const addChild = () => {
  const maxSort = children.value.reduce((max, item) => Math.max(max, item.sort), 0)
  children.value.push(createEmptyChild(maxSort + 1))
}

const removeChild = (index: number) => {
  const child = children.value[index]
  if (wasPublicOnLoad.value && child && isExistingChild(child)) {
    toast.add({
      title: '不可删除已有打卡目标',
      description: '公开成就簿的已有打卡目标不可删除',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }

  if (children.value.length <= 1 && !wasPublicOnLoad.value) {
    toast.add({
      title: '至少保留一个打卡目标',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }
  children.value.splice(index, 1)
}

const loadAlbumForEdit = async (albumId: number) => {
  detailLoading.value = true
  try {
    const [detail, childRes] = await Promise.all([
      getAlbumDetail({ album_id: albumId }),
      getAlbumList({ parent_id: albumId, page: 1, pageSize: 200 }),
    ])

    form.value.album_title = detail.album_title || ''
    form.value.album_cover = detail.album_cover || ''
    form.value.album_desc = detail.album_desc || ''
    form.value.is_private = (detail.is_private ?? 1) === 1
    form.value.sort = detail.sort ?? 0
    wasPublicOnLoad.value = (detail.is_private ?? 1) === 0
    isPublicLocked.value = wasPublicOnLoad.value

    const childRows = childRes.rows ?? []
    originalChildIds.value = childRows.map((item) => item.album_id)

    if (childRows.length > 0) {
      children.value = childRows.map((item, index) => ({
        key: createChildKey(),
        album_id: item.album_id,
        album_cover: item.album_cover || '',
        album_title: item.album_title || '',
        album_desc: item.album_desc || '',
        sort: item.sort ?? index + 1,
      }))
    } else {
      children.value = [createEmptyChild()]
    }

    await nextTick()
    if (coverPickerRef.value && detail.album_cover) {
      coverPickerRef.value.previewImages = [{
        id: `img_${Date.now()}`,
        file: undefined as unknown as File,
        url: BASE_IMG + detail.album_cover,
      }]
    }
  } catch (error) {
    console.error('加载相册详情失败:', error)
    toast.add({
      title: '加载相册详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red',
    })
    closeModel()
  } finally {
    detailLoading.value = false
  }
}

const showModel = async (albumId?: number, event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
  } else if (typeof window !== 'undefined') {
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }
  }

  initData()
  show.value = true

  if (albumId) {
    type.value = 1
    editingAlbumId.value = albumId
    await loadAlbumForEdit(albumId)
  }
}

const closeModel = () => {
  show.value = false
  initData()
}

const handleClose = () => {
  closeModel()
}

const onPrivateToggle = (nextPrivate: boolean) => {
  if (isPublicLocked.value && nextPrivate) {
    toast.add({
      title: '公开后不能再改回私有',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return
  }

  if (form.value.is_private && !nextPrivate) {
    if (typeof window !== 'undefined') {
      publicConfirmPosition.value = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }
    }
    showPublicConfirmModal.value = true
    return
  }

  form.value.is_private = nextPrivate
}

const confirmGoPublic = () => {
  form.value.is_private = false
  isPublicLocked.value = true
  showPublicConfirmModal.value = false
}

const cancelGoPublic = () => {
  showPublicConfirmModal.value = false
}

const buildChildPayload = (item: ChildFormItem, index: number): AlbumChildInput => {
  const payload: AlbumChildInput = {
    album_title: item.album_title.trim() || `目标 ${index + 1}`,
    album_cover: item.album_cover || undefined,
    album_desc: item.album_desc.trim() || undefined,
    pk_type: 0,
    target_num: 1,
    points_num: 10,
    conditions: { logic: 'AND', rules: [] },
    sort: item.sort ?? index + 1,
  }
  if (item.album_id) payload.album_id = item.album_id
  return payload
}

const validateForm = () => {
  if (!wasPublicOnLoad.value && !form.value.album_title.trim()) {
    toast.add({ title: '请填写相册标题', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return false
  }

  if (!wasPublicOnLoad.value && children.value.length === 0) {
    toast.add({ title: '请至少添加一个打卡目标', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return false
  }

  if (wasPublicOnLoad.value && newChildren.value.length === 0) {
    toast.add({
      title: '请新增打卡目标',
      description: '公开成就簿仅可新增打卡目标，简介与已有目标不可修改',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange',
    })
    return false
  }

  const childrenToValidate = wasPublicOnLoad.value ? newChildren.value : children.value
  for (let i = 0; i < childrenToValidate.length; i++) {
    if (!childrenToValidate[i].album_title.trim()) {
      toast.add({
        title: `请填写新增目标 ${i + 1} 的标题`,
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange',
      })
      return false
    }
  }

  return true
}

const handleSubmit = async () => {
  if (loading.value || detailLoading.value) return
  if (!validateForm()) return

  loading.value = true
  try {
    const isPrivate = form.value.is_private ? 1 : 0

    if (type.value === 0) {
      const childPayload = children.value.map(buildChildPayload)
      await insertAlbum({
        album_title: form.value.album_title.trim(),
        album_cover: form.value.album_cover || undefined,
        album_desc: form.value.album_desc.trim() || undefined,
        is_private: isPrivate,
        sort: form.value.sort,
        children: childPayload,
      })
      toast.add({ title: '创建成功', icon: 'i-heroicons-check-circle', color: 'green' })
    } else if (editingAlbumId.value) {
      if (wasPublicOnLoad.value) {
        const childPayload = newChildren.value.map((item, index) => buildChildPayload(item, index))
        await updateAlbum({
          album_id: editingAlbumId.value,
          children: childPayload,
        })
      } else {
        const childPayload = children.value.map(buildChildPayload)
        const currentIds = children.value
          .map((item) => item.album_id)
          .filter((id): id is number => id != null)
        const deleteChildIds = originalChildIds.value.filter((id) => !currentIds.includes(id))

        await updateAlbum({
          album_id: editingAlbumId.value,
          album_title: form.value.album_title.trim(),
          album_cover: form.value.album_cover || undefined,
          album_desc: form.value.album_desc.trim() || undefined,
          is_private: isPrivate,
          sort: form.value.sort,
          children: childPayload,
          delete_child_ids: deleteChildIds.length > 0 ? deleteChildIds : undefined,
        })
      }
      toast.add({ title: '保存成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }

    emit('success')
    closeModel()
  } catch (error) {
    console.error('保存相册失败:', error)
    toast.add({
      title: type.value === 0 ? '创建失败' : '保存失败',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="flex max-h-[min(640px,calc(100dvh-4rem))] w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-xl dark:border-gray-700/50 dark:bg-gray-800">
      <div class="flex shrink-0 items-center justify-between border-b border-gray-200/60 px-4 py-3 dark:border-gray-700">
        <h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">{{ modalTitle }}</h2>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          @click="closeModel"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div v-if="detailLoading" class="flex justify-center py-16">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-qhx-primary" />
        </div>

        <div v-else class="space-y-4">
          <div
            v-if="wasPublicOnLoad"
            class="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
          >
            公开成就簿仅可<strong class="font-semibold">新增打卡目标</strong>，相册简介、封面、标题及已有打卡目标不可修改或删除。
          </div>

          <UFormGroup label="相册标题">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-qhx-primary/50 hover:bg-qhx-primary/5 dark:border-gray-600 dark:bg-gray-700/50"
                :class="{ 'cursor-not-allowed opacity-60': wasPublicOnLoad }"
                aria-label="选择封面"
                @click="openCoverPicker"
              >
                <img
                  v-if="coverPreviewUrl"
                  :src="coverPreviewUrl"
                  alt="相册封面"
                  class="h-full w-full object-cover"
                />
                <div v-else class="flex h-full w-full items-center justify-center text-gray-400">
                  <UIcon name="i-heroicons-photo" class="h-5 w-5" />
                </div>
                <button
                  v-if="coverPreviewUrl && !wasPublicOnLoad"
                  type="button"
                  class="absolute right-0 top-0 z-10 flex h-4 w-4 items-center justify-center rounded-bl bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="清除封面"
                  @click="clearCover"
                >
                  <UIcon name="i-heroicons-x-mark" class="h-3 w-3" />
                </button>
              </button>
              <UInput
                v-model="form.album_title"
                placeholder="我的 Lolita 打卡"
                size="sm"
                class="min-w-0 flex-1"
                :disabled="wasPublicOnLoad"
                :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
              />
            </div>
          </UFormGroup>

          <UFormGroup label="相册描述">
            <UTextarea
              v-model="form.album_desc"
              placeholder="可选，介绍这个成就簿"
              :rows="2"
              size="sm"
              :disabled="wasPublicOnLoad"
              :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
            />
          </UFormGroup>

          <UFormGroup label="可见性">
            <div class="flex items-center gap-2">
              <UToggle
                :model-value="form.is_private"
                :disabled="isPublicLocked && !form.is_private"
                @update:model-value="onPrivateToggle"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ form.is_private ? '私有（仅本人可见）' : '公开（可分享到相册市场）' }}
              </span>
            </div>
            <p v-if="!form.is_private" class="mt-1 text-xs text-gray-500">
              公开相册会出现在相册市场，其他用户可添加到你的目标
            </p>
            <p v-if="isPublicLocked && !form.is_private" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
              公开后不能再改回私有；简介与已有打卡目标不可修改或删除，仅可新增打卡目标
            </p>
          </UFormGroup>

          <div class="border-t border-gray-200/60 pt-3 dark:border-gray-700">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">打卡目标</span>
              <UButton
                size="xs"
                variant="soft"
                icon="i-heroicons-plus"
                class="bg-qhx-primary/10 text-qhx-primary hover:bg-qhx-primary/20"
                @click="addChild"
              >
                添加目标
              </UButton>
            </div>

            <div class="space-y-2">
              <div
                v-for="(child, index) in children"
                :key="child.key"
                class="rounded-lg border p-2"
                :class="
                  wasPublicOnLoad && isExistingChild(child)
                    ? 'border-gray-200/40 bg-gray-100/60 opacity-90 dark:border-gray-600/30 dark:bg-gray-900/40'
                    : 'border-gray-200/50 bg-gray-50/80 dark:border-gray-600/50 dark:bg-gray-800/60'
                "
              >
                <div v-if="wasPublicOnLoad && isExistingChild(child)" class="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  已有打卡目标（不可修改）
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white transition-colors hover:border-qhx-primary/50 hover:bg-qhx-primary/5 dark:border-gray-600 dark:bg-gray-700/50"
                    :class="{ 'cursor-not-allowed opacity-60': wasPublicOnLoad && isExistingChild(child) }"
                    :aria-label="`目标 ${index + 1} 封面`"
                    @click="openChildCoverPicker(index)"
                  >
                    <img
                      v-if="getChildCoverPreview(child)"
                      :src="getChildCoverPreview(child)"
                      :alt="`目标 ${index + 1} 封面`"
                      class="h-full w-full object-cover"
                    />
                    <div v-else class="flex h-full w-full items-center justify-center text-gray-400">
                      <UIcon name="i-heroicons-photo" class="h-4 w-4" />
                    </div>
                    <button
                      v-if="child.album_cover && !(wasPublicOnLoad && isExistingChild(child))"
                      type="button"
                      class="absolute right-0 top-0 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-bl bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="清除封面"
                      @click="clearChildCover(index, $event)"
                    >
                      <UIcon name="i-heroicons-x-mark" class="h-2.5 w-2.5" />
                    </button>
                  </button>

                  <UInput
                    v-model="child.album_title"
                    placeholder="目标标题"
                    size="sm"
                    class="min-w-0 flex-1"
                    :disabled="wasPublicOnLoad && isExistingChild(child)"
                    :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
                  />

                  <UButton
                    v-if="!(wasPublicOnLoad && isExistingChild(child))"
                    color="red"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-trash"
                    class="shrink-0"
                    @click="removeChild(index)"
                  />
                </div>

                <UTextarea
                  v-model="child.album_desc"
                  placeholder="描述（可选）"
                  :rows="2"
                  size="sm"
                  class="mt-2"
                  :disabled="wasPublicOnLoad && isExistingChild(child)"
                  :ui="{ base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary' }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 justify-end gap-2 border-t border-gray-200/60 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
        <UButton color="gray" variant="ghost" size="sm" @click="closeModel">取消</UButton>
        <UButton
          :loading="loading"
          :disabled="detailLoading"
          size="sm"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="handleSubmit"
        >
          {{ type === 0 ? '创建' : wasPublicOnLoad ? '保存新增目标' : '保存' }}
        </UButton>
      </div>
    </div>
  </QhxModal>

  <QhxImagePicker
    ref="coverPickerRef"
    class="hidden"
    :multiple="false"
    @update:files="onUpdateCoverFiles"
  />
  <QhxImagePicker
    ref="childCoverPickerRef"
    class="hidden"
    :multiple="false"
    @update:files="onUpdateChildCoverFiles"
  />

  <QhxModal
    v-model="showPublicConfirmModal"
    :trigger-position="publicConfirmPosition"
    :close-on-backdrop="false"
    @close="cancelGoPublic"
  >
    <div class="w-[90vw] max-w-md overflow-hidden rounded-2xl border border-gray-200/50 bg-white shadow-2xl dark:border-gray-700/50 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">确认公开</h3>
      </div>
      <div class="px-6 py-4">
        <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          公开后将出现在相册市场，其他用户可添加到你的目标。
        </p>
        <p class="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
          公开后将不能再改回私有；简介与已有打卡目标不可修改或删除，仅可新增打卡目标，请确认是否继续？
        </p>
      </div>
      <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
        <UButton color="gray" variant="outline" @click="cancelGoPublic">取消</UButton>
        <UButton class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover" @click="confirmGoPublic">
          确认公开
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>
