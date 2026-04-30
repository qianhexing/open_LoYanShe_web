<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :close-on-backdrop="false" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? '新增百科词条' : '编辑百科词条' }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
      </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-6 flex-1">
        <!-- 词条名称 -->
        <UFormGroup label="词条名称" required>
          <UInput
            v-model="form.wiki_name"
            placeholder="请输入词条名称"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>

        <!-- 词条类型（仅新增时显示） -->
        <UFormGroup v-if="type === 0" label="词条类型" required>
          <USelect
            v-model="form.type_id"
            :options="wikiTypeOptions"
            placeholder="请选择词条类型"
            value-attribute="value"
            option-attribute="label"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>

        <!-- 其他名称 -->
        <UFormGroup label="其他名称">
          <UInput
            v-model="form.other_name"
            placeholder="请输入其他名称（别名、外文名等）"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </UFormGroup>

        <!-- 词条描述 -->
        <UFormGroup label="词条描述">
          <ClientOnly>
            <QhxRichTextEditor
              v-model="form.wiki_describe"
              placeholder="请输入词条描述..."
              :min-height="150"
              :max-height="300"
              :enable-topic="false"
              :enable-emoji="true"
              :enable-mention="false"
              :enable-internal-link="true"
            />
          </ClientOnly>
        </UFormGroup>

        <!-- 词条配图 -->
        <UFormGroup label="词条配图">
          <QhxImagePicker :multiple="false" @update:files="onUpdateIllustrationFiles" ref="illustrationRef" />
        </UFormGroup>

        <!-- 词条封面 -->
        <UFormGroup label="词条封面">
          <QhxImagePicker :multiple="false" @update:files="onUpdateCoverFiles" ref="coverRef" />
        </UFormGroup>
      </div>
      <!-- 底部 -->
      <div class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
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

<script setup lang="ts">
import type { WikiDetail } from '@/api/wiki'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { insertWiki, updateWiki } from '@/api/wiki'
import { uploadImage } from '@/api'
import { useToast } from '#imports'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import { contentToEditorFormat, type RichNode } from '@/utils/public'
const show = ref<boolean>(false)
const clickPosition = ref({ x: 0, y: 0 })
const emit = defineEmits(['success'])
const toast = useToast()
const configStore = useConfigStore()

const wiki_id = ref<number | null>(null)
const type = ref<number>(0) // 0 新增 1 编辑
const loading = ref<boolean>(false)

const illustrationRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const wikiTypeOptions = computed(() => {
  const list = configStore.config?.wiki_type || []
  return list.map((item: { value: number; label: string }) => ({
    label: item.label,
    value: item.value
  }))
})

const form = ref<{
  wiki_name: string
  type_id: number
  other_name: string
  wiki_describe: string
  wiki_illustration: string
  cover: string
}>({
  wiki_name: '',
  type_id: 0,
  other_name: '',
  wiki_describe: '',
  wiki_illustration: '',
  cover: ''
})

const resetForm = () => {
  form.value = {
    wiki_name: '',
    type_id: wikiTypeOptions.value.length ? wikiTypeOptions.value[0].value : 0,
    other_name: '',
    wiki_describe: '',
    wiki_illustration: '',
    cover: ''
  }
  wiki_id.value = null
  if (illustrationRef.value) illustrationRef.value.previewImages = []
  if (coverRef.value) coverRef.value.previewImages = []
}

const handleClose = () => {
  closeModel()
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

const showModel = (item: WikiDetail | null = null, defaultTypeId?: number, event?: MouseEvent) => {
  setTriggerPosition(event)
  if (item) {
    type.value = 1
    wiki_id.value =
      typeof item.wiki_id === 'number' ? item.wiki_id : Number.parseInt(String(item.wiki_id))
    const emojiConfig = configStore.config?.emoji_config ?? []
    const getEmojiUrl = (id: number) => {
      for (const cat of emojiConfig) {
        const emoji = cat.list?.find((e: { value: number }) => e.value === id)
        if (emoji?.url) return BASE_IMG + emoji.url
      }
      return ''
    }
    form.value = {
      wiki_name: item.wiki_name || '',
      type_id:
        typeof item.type_id === 'string'
          ? Number.parseInt(item.type_id)
          : (item.type_id as number) || 0,
      other_name: item.other_name || '',
      wiki_describe: contentToEditorFormat(item.wiki_describe || '', { getEmojiUrl }),
      wiki_illustration: item.wiki_illustration || '',
      cover: item.cover || ''
    }
    nextTick(() => {
      if (item.wiki_illustration && illustrationRef.value) {
        illustrationRef.value.previewImages = [
          { file: undefined as unknown as File, url: BASE_IMG + item.wiki_illustration }
        ]
      }
      if (item.cover && coverRef.value) {
        coverRef.value.previewImages = [
          { file: undefined as unknown as File, url: BASE_IMG + item.cover }
        ]
      }
    })
  } else {
    type.value = 0
    resetForm()
    if (defaultTypeId !== undefined) {
      form.value.type_id = defaultTypeId
    } else if (wikiTypeOptions.value.length > 0) {
      form.value.type_id = wikiTypeOptions.value[0].value
    }
  }
  show.value = true
}

const closeModel = () => {
  show.value = false
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
      title: '图片上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
  return ''
}

const onUpdateIllustrationFiles = () => {}
const onUpdateCoverFiles = () => {}

const submit = async () => {
  if (loading.value) return

  if (!form.value.wiki_name?.trim()) {
    toast.add({
      title: '请填写词条名称',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  if (type.value === 0 && !form.value.type_id) {
    toast.add({
      title: '请选择词条类型',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  loading.value = true
  try {
    const params: Record<string, unknown> = {
      wiki_name: form.value.wiki_name.trim(),
      other_name: form.value.other_name?.trim() || undefined,
      wiki_describe: form.value.wiki_describe?.trim() || undefined
    }

    if (type.value === 0) {
      params.type_id = form.value.type_id
      const illustrationList = illustrationRef.value?.previewImages || []
      if (illustrationList.length > 0) {
        const url = await fetchUpload(illustrationList[0])
        if (url) params.wiki_illustration = url
      }
      const coverList = coverRef.value?.previewImages || []
      if (coverList.length > 0) {
        const url = await fetchUpload(coverList[0])
        if (url) params.cover = url
      }
      await insertWiki(params as Parameters<typeof insertWiki>[0])
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      params.wiki_id = wiki_id.value as number
      const illustrationList = illustrationRef.value?.previewImages || []
      if (illustrationList.length > 0) {
        const url = await fetchUpload(illustrationList[0])
        if (url) params.wiki_illustration = url
      } else {
        params.wiki_illustration = form.value.wiki_illustration || ''
      }
      const coverList = coverRef.value?.previewImages || []
      if (coverList.length > 0) {
        const url = await fetchUpload(coverList[0])
        if (url) params.cover = url
      } else {
        params.cover = form.value.cover || ''
      }
      await updateWiki(params as Parameters<typeof updateWiki>[0])
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    emit('success')
    closeModel()
  } catch (error) {
    console.error('Wiki 保存失败:', error)
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>
