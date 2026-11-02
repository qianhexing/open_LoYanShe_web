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
        <UFormGroup label="词条配图（最多20张）">
          <QhxImagePicker :multiple="true" :max="ILLUSTRATION_MAX" ref="illustrationRef" />
        </UFormGroup>

        <!-- 词条封面 -->
        <UFormGroup label="词条封面">
          <UInput
            v-model="coverLink"
            placeholder="直接粘贴图片链接（有链接时优先使用）"
            class="mb-3 flex-1 focus:ring-0"
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
          <QhxImagePicker :multiple="false" ref="coverRef" />
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
import type { InsertWikiParams, UpdateWikiParams, WikiDetail } from '@/api/wiki'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { insertWiki, updateWiki } from '@/api/wiki'
import { uploadImage } from '@/api'
import { useToast } from '#imports'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import { contentToEditorFormat } from '@/utils/public'
import { unref } from 'vue'
const show = ref<boolean>(false)
const clickPosition = ref({ x: 0, y: 0 })
const emit = defineEmits(['success'])
const toast = useToast()
const configStore = useConfigStore()

const wiki_id = ref<number | null>(null)
const type = ref<number>(0) // 0 新增 1 编辑
const loading = ref<boolean>(false)

const ILLUSTRATION_MAX = 20
const illustrationRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const coverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
/** 封面外链；有值时提交优先于本地上传 */
const coverLink = ref('')

function parseIllustrationPaths(raw?: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, ILLUSTRATION_MAX)
}

function isAbsoluteCoverUrl(path: string): boolean {
  return /^https?:\/\//i.test(path.trim())
}

/** 站内 CDN 存相对路径，外链保持完整 URL */
function normalizeCoverValue(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith(BASE_IMG)) return t.slice(BASE_IMG.length)
  return t
    .replace(/^https?:\/\/www\.lolitalibrary\.com\/ali\//i, '')
    .replace(/^https?:\/\/image\.lolitalibrary\.com\//i, '')
}

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
  coverLink.value = ''
  illustrationRef.value?.clear()
  coverRef.value?.clear()
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
    const existingCover = item.cover || ''
    form.value = {
      wiki_name: item.wiki_name || '',
      type_id:
        typeof item.type_id === 'string'
          ? Number.parseInt(item.type_id)
          : (item.type_id as number) || 0,
      other_name: item.other_name || '',
      wiki_describe: contentToEditorFormat(item.wiki_describe || '', { getEmojiUrl }),
      wiki_illustration: item.wiki_illustration || '',
      cover: existingCover
    }
    coverLink.value = isAbsoluteCoverUrl(existingCover) ? existingCover.trim() : ''
    nextTick(() => {
      illustrationRef.value?.clear()
      coverRef.value?.clear()
      const illustrationPaths = parseIllustrationPaths(item.wiki_illustration)
      if (illustrationPaths.length) {
        illustrationRef.value?.seedFromPaths(illustrationPaths)
      }
      // 有外链时以链接为准，不再回填本地选择器，避免与链接抢优先级
      if (existingCover && !coverLink.value && coverRef.value) {
        coverRef.value.seedFromPaths([existingCover])
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

const uploadPickerUrls = async (
  picker: InstanceType<typeof QhxImagePicker> | null,
  maxCount?: number,
): Promise<string[]> => {
  const raw = picker?.previewImages as unknown
  const list = (Array.isArray(raw) ? raw : unref(raw as never)) as Array<{ file?: File; url?: string }>
  const rows = Array.isArray(list) ? list : []
  const sliced = typeof maxCount === 'number' ? rows.slice(0, maxCount) : rows
  const urls = await Promise.all(sliced.map((item) => fetchUpload(item)))
  return urls.filter((url): url is string => Boolean(url))
}

/** 有链接优先用链接；否则用本地上传；再回退已有 cover */
async function resolveCoverForSubmit(): Promise<string> {
  const link = coverLink.value.trim()
  if (link) return normalizeCoverValue(link)
  const coverUrls = await uploadPickerUrls(coverRef.value, 1)
  if (coverUrls[0]) return coverUrls[0]
  return form.value.cover?.trim() || ''
}

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
    const cover = await resolveCoverForSubmit()
    const illustrationUrls = await uploadPickerUrls(illustrationRef.value, ILLUSTRATION_MAX)

    if (type.value === 0) {
      const params: InsertWikiParams = {
        wiki_name: form.value.wiki_name.trim(),
        type_id: form.value.type_id,
        other_name: form.value.other_name?.trim() || undefined,
        wiki_describe: form.value.wiki_describe?.trim() || undefined,
        cover,
      }
      if (illustrationUrls.length > 0) {
        params.wiki_illustration = illustrationUrls.join(',')
      }
      await insertWiki(params)
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      const params: UpdateWikiParams = {
        wiki_id: wiki_id.value as number,
        wiki_name: form.value.wiki_name.trim(),
        other_name: form.value.other_name?.trim() || undefined,
        wiki_describe: form.value.wiki_describe?.trim() || undefined,
        wiki_illustration: illustrationUrls.join(','),
        cover,
      }
      await updateWiki(params)
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
