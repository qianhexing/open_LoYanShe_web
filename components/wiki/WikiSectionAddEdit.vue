<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" :close-on-backdrop="false" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? '新增段落' : '编辑段落' }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
      </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-6 flex-1">
        <!-- 段落标题 -->
        <UFormGroup label="段落标题" required>
          <UInput
            v-model="form.section_title"
            placeholder="请输入段落标题"
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

        <!-- 段落内容 -->
        <UFormGroup label="段落内容">
          <ClientOnly>
            <QhxRichTextEditor
              v-model="form.section_content"
              placeholder="请输入段落内容..."
              :min-height="150"
              :max-height="300"
              :enable-topic="false"
              :enable-emoji="true"
              :enable-mention="false"
              :enable-internal-link="true"
            />
          </ClientOnly>
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
import type { WikiSection } from '@/api/wiki'
import { insertWikiSectionApi, updateWikiSection } from '@/api/wiki'
import { useToast } from '#imports'
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import { contentToEditorFormat } from '@/utils/public'

const show = ref<boolean>(false)
const clickPosition = ref({ x: 0, y: 0 })
const emit = defineEmits(['success'])
const toast = useToast()
const configStore = useConfigStore()

const wiki_id = ref<number>(0)
const section_id = ref<number | null>(null)
const type = ref<number>(0) // 0 新增 1 编辑
const loading = ref<boolean>(false)

const form = ref<{
  section_title: string
  section_content: string
}>({
  section_title: '',
  section_content: ''
})

const resetForm = () => {
  form.value = {
    section_title: '',
    section_content: ''
  }
  section_id.value = null
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

const showModel = (item: WikiSection | null, parentWikiId: number, event?: MouseEvent) => {
  setTriggerPosition(event)
  wiki_id.value = parentWikiId
  if (item) {
    type.value = 1
    section_id.value = item.section_id
    const emojiConfig = configStore.config?.emoji_config ?? []
    const getEmojiUrl = (id: number) => {
      for (const cat of emojiConfig) {
        const emoji = cat.list?.find((e: { value: number }) => e.value === id)
        if (emoji?.url) return BASE_IMG + emoji.url
      }
      return ''
    }
    form.value = {
      section_title: item.section_title || '',
      section_content: contentToEditorFormat(item.section_content || '', { getEmojiUrl })
    }
  } else {
    type.value = 0
    resetForm()
  }
  show.value = true
}

const closeModel = () => {
  show.value = false
}

const submit = async () => {
  if (loading.value) return

  if (!form.value.section_title?.trim()) {
    toast.add({
      title: '请填写段落标题',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  loading.value = true
  try {
    if (type.value === 0) {
      await insertWikiSectionApi({
        wiki_id: wiki_id.value,
        section_title: form.value.section_title.trim(),
        section_content: form.value.section_content?.trim() || '',
        sort: 0
      })
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      const sid = section_id.value
      if (sid == null) return
      await updateWikiSection({
        section_id: sid,
        section_title: form.value.section_title.trim(),
        section_content: form.value.section_content?.trim() || ''
      })
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    emit('success')
    closeModel()
  } catch (error) {
    console.error('段落保存失败:', error)
  } finally {
    loading.value = false
  }
}

defineExpose({ showModel })
</script>
