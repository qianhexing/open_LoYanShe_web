<script setup lang="ts">
/**
 * GLB/GLTF 素材「仅改标题与封面」弹窗；模型文件只读，不可更换。
 */
import { ref, reactive, watch, computed } from 'vue'
import type { Material } from '@/types/api'
import { updateMaterial, type InsertMaterialParams } from '@/api/material'
import { uploadFileToOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import { materialFileNameFromUrl } from '@/utils/materiaModelKind'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    material: Material | null
  }>(),
  {}
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  success: [row: Material]
}>()

const toast = useToast()
const submitting = ref(false)
const coverPicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const form = reactive({
  materia_title: '',
  cover: null as string | null,
  is_private: 0,
  options: {} as Record<string, unknown>
})

const isPrivateChecked = ref(false)

const materiaTitleInput = computed({
  get: () => form.materia_title ?? '',
  set: (v: string) => {
    form.materia_title = v
  }
})

const materialFileLabel = computed(() =>
  props.material ? materialFileNameFromUrl(props.material.materia_url) : ''
)

const modalOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

function formatImg(url: string) {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

function syncFromMaterial(m: Material | null) {
  if (!m) return
  form.materia_title = m.materia_title || ''
  form.cover = m.cover ?? null
  form.is_private = m.is_private ?? 0
  form.options = (m.options || {}) as Record<string, unknown>
  isPrivateChecked.value = form.is_private === 1
}

watch(
  () => [props.modelValue, props.material] as const,
  ([open, m]) => {
    if (open && m) {
      syncFromMaterial(m)
    }
  }
)

async function handleCoverChange(files: File[]) {
  if (files.length === 0) return
  try {
    const result = await uploadFileToOSS(files[0])
    form.cover = result.file_url
    toast.add({
      title: '封面上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch {
    toast.add({
      title: '封面上传失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  const m = props.material
  if (!m) return
  submitting.value = true
  try {
    const row = await updateMaterial({
      materia_id: m.materia_id,
      materia_title: form.materia_title,
      materia_url: m.materia_url,
      cover: form.cover,
      pk_id: m.pk_id,
      is_private: form.is_private,
      options: form.options as NonNullable<InsertMaterialParams['options']>
    })
    toast.add({
      title: '已保存',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    emit('success', row)
    close()
  } catch (e) {
    console.error(e)
    toast.add({
      title: '保存失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model="modalOpen" :ui="{ width: 'max-w-lg' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">修改素材</h3>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="close" />
        </div>
      </template>

      <div v-if="material" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">素材标题</label>
          <UInput v-model="materiaTitleInput" placeholder="请输入素材标题" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">素材文件 (GLTF/GLB)</label>
          <div
            class="rounded-lg border border-dashed border-amber-300/80 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2"
          >
            <p class="text-xs text-amber-800 dark:text-amber-200/90">
              已绑定 3D 模型文件，仅可修改标题与封面，不能更换模型文件。
            </p>
            <div class="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/80">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="flex-shrink-0 w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center"
                >
                  <UIcon name="i-heroicons-lock-closed" class="text-lg text-gray-500 dark:text-gray-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ materialFileLabel || '素材文件' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">封面图</label>
          <div v-if="form.cover" class="mb-2">
            <img
              :src="formatImg(form.cover)"
              alt="封面预览"
              class="w-32 h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
            />
          </div>
          <QhxImagePicker ref="coverPicker" :multiple="false" @update:files="handleCoverChange" />
        </div>

        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <UCheckbox
              v-model="isPrivateChecked"
              @change="form.is_private = isPrivateChecked ? 1 : 0"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">设为私密</span>
          </label>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="close">取消</UButton>
          <UButton
            :loading="submitting"
            :disabled="!material"
            class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
            @click="submit"
          >
            保存修改
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
