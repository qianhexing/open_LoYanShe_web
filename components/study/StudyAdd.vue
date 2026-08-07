<script setup lang="ts">
import type { Study } from '@/types/api'
import {
  insertStudy,
  updateStudy,
  type InsertStudyParams
} from '@/api/study'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import {
  STUDY_INTERNAL_APP_PATH_TEMPLATES,
  STUDY_MAIN_TYPE_FORM_OPTIONS,
  STUDY_TYPE_EXTERNAL,
  STUDY_TYPE_INTERNAL,
  STUDY_TYPE_LEARNING
} from '@/utils/studyTypes'

const emit = defineEmits<{
  success: [study?: Study]
}>()

const toast = useToast()
const configStore = useConfigStore()

const show = shallowRef(false)
const loading = shallowRef(false)
const type = shallowRef(0) // 0 新增 1 编辑
const studyId = shallowRef<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const internalMapPick = shallowRef('')

const form = reactive({
  study_title: '',
  study_desc: '',
  study_cover: null as string | null,
  study_type: STUDY_TYPE_LEARNING as number,
  study_url: '',
  sort: 0,
  parent_id: 0
})

const inputUi = {
  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
  rounded: 'rounded-full',
  padding: { xs: 'px-4 py-2' },
  color: {
    white: {
      outline:
        'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
    }
  }
}

const textareaUi = {
  ...inputUi,
  rounded: 'rounded-[10px]'
}

const studyTypeOptions = [...STUDY_MAIN_TYPE_FORM_OPTIONS]

/** 内部链接：硬编码模板 + 配置里以 pages/ 开头的 value */
const internalMappingOptions = computed(() => {
  const hard = STUDY_INTERNAL_APP_PATH_TEMPLATES.map((t) => ({
    label: t.label,
    value: t.prefix
  }))
  const cfg = configStore.config?.study_type ?? []
  const fromCfg = cfg
    .filter((c) => typeof c.value === 'string' && c.value.trim().startsWith('pages/'))
    .map((c) => {
      const v = String(c.value).trim()
      return { label: v.length > 56 ? `${v.slice(0, 56)}…` : v, value: v }
    })
  const seen = new Set<string>()
  const merged: { label: string; value: string }[] = [{ label: '— 手动输入 —', value: '' }]
  for (const o of [...hard, ...fromCfg]) {
    if (!o.value || seen.has(o.value)) continue
    seen.add(o.value)
    merged.push(o)
  }
  return merged
})

function syncInternalMapPickFromUrl() {
  const url = form.study_url?.trim() || ''
  const opts = internalMappingOptions.value.filter((o) => o.value)
  const hit = [...opts]
    .sort((a, b) => b.value.length - a.value.length)
    .find((o) => url.startsWith(o.value))
  internalMapPick.value = hit?.value ?? ''
}

function onInternalTemplatePick(v: string | number | null) {
  const raw = v == null ? '' : String(v)
  internalMapPick.value = raw
  if (raw) form.study_url = raw
}

watch(
  () => form.study_type,
  (t) => {
    if (t === STUDY_TYPE_LEARNING) {
      form.study_url = ''
      internalMapPick.value = ''
      return
    }
    if (t !== STUDY_TYPE_INTERNAL) {
      internalMapPick.value = ''
      return
    }
    syncInternalMapPickFromUrl()
  }
)

const resetForm = (defaultParentId = 0) => {
  form.study_title = ''
  form.study_desc = ''
  form.study_cover = null
  form.study_type = STUDY_TYPE_LEARNING
  form.study_url = ''
  form.sort = 0
  form.parent_id = defaultParentId
  internalMapPick.value = ''
  studyId.value = null
  coverRef.value?.clear()
}

const setTriggerPosition = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
    return
  }
  if (import.meta.client) {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  } else {
    clickPosition.value = { x: 0, y: 0 }
  }
}

/**
 * 打开弹窗
 * @param item 编辑时传入；新增传 null
 * @param defaultParentId 新增时预填上级 ID（0 为顶级）
 */
const showModel = (
  item: Study | null = null,
  defaultParentId = 0,
  event?: MouseEvent
) => {
  setTriggerPosition(event)
  if (item) {
    type.value = 1
    studyId.value = item.study_id
    form.study_title = item.study_title || ''
    form.study_desc = item.study_desc || ''
    form.study_cover = item.study_cover || null
    form.study_type = item.study_type ?? STUDY_TYPE_LEARNING
    form.study_url = item.study_url || ''
    form.sort = item.sort ?? 0
    form.parent_id = item.parent_id ?? 0
    if (form.study_type === STUDY_TYPE_INTERNAL) {
      syncInternalMapPickFromUrl()
    } else {
      internalMapPick.value = ''
    }
    nextTick(() => {
      if (item.study_cover && coverRef.value) {
        coverRef.value.seedFromPaths([item.study_cover])
      } else {
        coverRef.value?.clear()
      }
    })
  } else {
    type.value = 0
    resetForm(defaultParentId)
  }
  show.value = true
}

const closeModel = () => {
  show.value = false
}

const handleClose = () => {
  closeModel()
}

const fetchUpload = async (file: { file?: File; url?: string }) => {
  try {
    if (file.file) {
      const res = await uploadImage(file.file)
      return res.file_url
    }
    if (file.url) {
      return file.url.replace(BASE_IMG, '')
    }
  } catch (error) {
    console.error(error)
    toast.add({
      title: '封面上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
  return ''
}

const onUpdateCoverFiles = () => {}

const submit = async () => {
  if (loading.value) return

  if (!form.study_title?.trim()) {
    toast.add({
      title: '请填写标题',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  const studyUrlRaw = (form.study_url || '').trim()
  if (form.study_type === STUDY_TYPE_INTERNAL && !studyUrlRaw) {
    toast.add({
      title: '内部链接请填写 APP 路径',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (form.study_type === STUDY_TYPE_EXTERNAL && !studyUrlRaw) {
    toast.add({
      title: '请填写外部链接 URL',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  loading.value = true
  try {
    const coverList = coverRef.value?.previewImages || []
    let cover = form.study_cover || null
    if (coverList.length > 0) {
      const url = await fetchUpload(coverList[0])
      if (url) cover = url
    } else if (type.value === 0) {
      cover = null
    }

    const payload: InsertStudyParams = {
      study_title: form.study_title.trim(),
      study_desc: form.study_desc || '',
      study_cover: cover,
      study_type: form.study_type,
      study_url: form.study_type === STUDY_TYPE_LEARNING ? '' : studyUrlRaw,
      sort: Number(form.sort) || 0,
      parent_id: form.parent_id == null ? 0 : Number(form.parent_id)
    }

    let result: Study | undefined
    if (type.value === 1 && studyId.value != null) {
      result = await updateStudy({ ...payload, study_id: studyId.value })
      toast.add({
        title: '更新成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      result = await insertStudy(payload)
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    emit('success', result)
    closeModel()
  } catch (error) {
    console.error('研习保存失败:', error)
    toast.add({
      title: type.value === 1 ? '更新失败' : '添加失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>

<template>
  <QhxModal
    v-model="show"
    :trigger-position="clickPosition"
    :close-on-backdrop="false"
    @close="handleClose"
  >
    <div
      class="w-[95vw] max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50"
    >
      <div
        class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? '新增研习' : '编辑研习' }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
      </div>

      <div class="space-y-4 max-h-[60vh] overflow-y-auto p-6 flex-1">
        <UFormGroup label="标题" required>
          <UInput
            v-model="form.study_title"
            placeholder="请输入标题"
            class="flex-1 focus:ring-0"
            :ui="inputUi"
          />
        </UFormGroup>

        <UFormGroup label="简介">
          <UTextarea
            v-model="form.study_desc"
            placeholder="可选"
            :rows="3"
            :ui="textareaUi"
          />
        </UFormGroup>

        <UFormGroup label="研习类型">
          <div class="flex flex-wrap gap-2">
            <QhxJellyButton v-for="opt in studyTypeOptions" :key="opt.value">
              <QhxTag
                :active="form.study_type === opt.value"
                class="cursor-pointer"
                @click="form.study_type = opt.value"
              >
                {{ opt.label }}
              </QhxTag>
            </QhxJellyButton>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            0 学习板块 · 1 内部链接（APP pages 路径）· 2 外部链接
          </p>
        </UFormGroup>

        <div
          v-if="form.study_type === STUDY_TYPE_LEARNING"
          class="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
        >
          学习板块将跳转至研习详情页（/study/detail/:id），无需填写链接。
        </div>

        <template v-else-if="form.study_type === STUDY_TYPE_INTERNAL">
          <UFormGroup label="APP 路径模板">
            <USelect
              :model-value="internalMapPick"
              :options="internalMappingOptions"
              placeholder="选择模板，或留空后手动输入"
              value-attribute="value"
              option-attribute="label"
              @update:model-value="onInternalTemplatePick"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              选择模板会填入前缀，请补全 id 等参数。
            </p>
          </UFormGroup>
          <UFormGroup label="APP 路径" required>
            <UInput
              v-model="form.study_url"
              placeholder="例：pages/study/studyMore?id=123"
              class="flex-1 focus:ring-0"
              :ui="inputUi"
            />
          </UFormGroup>
        </template>

        <UFormGroup v-else label="外部链接 URL" required>
          <UInput
            v-model="form.study_url"
            placeholder="https://..."
            class="flex-1 focus:ring-0"
            :ui="inputUi"
          />
        </UFormGroup>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormGroup label="排序">
            <QhxNumberStepper v-model="form.sort" :min="0" />
          </UFormGroup>
          <UFormGroup label="上级 ID">
            <UInput
              v-model.number="form.parent_id"
              type="number"
              placeholder="0 为顶级"
              class="flex-1 focus:ring-0"
              :ui="inputUi"
            />
          </UFormGroup>
        </div>

        <UFormGroup label="封面">
          <QhxImagePicker
            ref="coverRef"
            :multiple="false"
            @update:files="onUpdateCoverFiles"
          />
        </UFormGroup>
      </div>

      <div
        class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <UButton color="gray" @click="closeModel">取消</UButton>
        <UButton
          :loading="loading"
          size="xs"
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="submit"
        >
          {{ type === 1 ? '确认修改' : '确认添加' }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>
