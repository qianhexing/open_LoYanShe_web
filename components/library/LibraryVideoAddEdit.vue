<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LibraryVideo } from '@/types/api'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { BASE_IMG } from '@/utils/ipConfig'
import { uploadImage } from '@/api'
import { insertLibraryVideo, updateLibraryVideo } from '@/api/library'

const props = withDefaults(defineProps<{
  pkId: number
  pkType?: number
}>(), {
  pkType: 0
})

const emit = defineEmits<{
  (e: 'success'): void
}>()

const toast = useToast()

const show = ref(false)
const loading = ref(false)
const type = ref<0 | 1>(0) // 0 新增 1 编辑
const videoId = ref<number | null>(null)
const clickPosition = ref({ x: 0, y: 0 })

const imagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const form = ref({
  title: '',
  is_show: 0
})

const setTriggerPosition = (event?: MouseEvent) => {
  if (event) {
    clickPosition.value = { x: event.clientX, y: event.clientY }
    return
  }
  // SSR-safe：仅在客户端取窗口尺寸
  if (import.meta.client) {
    clickPosition.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  } else {
    clickPosition.value = { x: 0, y: 0 }
  }
}

const initData = () => {
  form.value = { title: '', is_show: 0 }
  videoId.value = null
  if (imagePickerRef.value) {
    imagePickerRef.value.previewImages = []
  }
}

const closeModel = () => {
  show.value = false
  initData()
}

const showModel = (event?: MouseEvent) => {
  type.value = 0
  setTriggerPosition(event)
  show.value = true
}

const editModel = (item: LibraryVideo, event?: MouseEvent) => {
  type.value = 1
  setTriggerPosition(event)
  show.value = true
  videoId.value = item.video_id || null
  form.value.title = item.title || ''
  form.value.is_show = typeof item.is_show === 'number' ? item.is_show : 0
  setTimeout(() => {  
    if (imagePickerRef.value) {
      const urls = (item.addr || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        console.log(urls, 'urls')
      imagePickerRef.value.previewImages = urls.map((key) => ({
        id: `img_${Date.now()}_${Math.random()}`,
        file: undefined as unknown as File,
        url: BASE_IMG + key
      }))
    }
  })
  
}

const fetchUpload = async (img: { file?: File; url?: string }) => {
  if (img.file) {
    const res = await uploadImage(img.file)
    return res.file_url
  }
  if (img.url) {
    return img.url.replace(BASE_IMG, '')
  }
  return ''
}

const submit = async () => {
  if (loading.value) return

  if (!form.value.title.trim()) {
    toast.add({ title: '错误', description: '请填写标题', color: 'red' })
    return
  }

  const list = imagePickerRef.value?.previewImages || []
  if (list.length <= 0) {
    toast.add({ title: '错误', description: '请至少选择 1 张人台图', color: 'red' })
    return
  }

  loading.value = true
  try {
    const addr: string[] = []
    for (const img of list) {
      const key = await fetchUpload(img)
      if (key) addr.push(key)
    }

    if (addr.length <= 0) {
      toast.add({ title: '错误', description: '图片上传失败或未选择图片', color: 'red' })
      return
    }

    const params = {
      pk_id: props.pkId,
      pk_type: props.pkType,
      title: form.value.title,
      is_show: form.value.is_show,
      addr: addr.join(',')
    }

    if (type.value === 0) {
      await insertLibraryVideo(params)
      toast.add({ title: '成功', description: '添加成功', color: 'green' })
    } else {
      await updateLibraryVideo({ ...params, video_id: videoId.value as number })
      toast.add({ title: '成功', description: '修改成功', color: 'green' })
    }
    emit('success')
    closeModel()
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel,
  editModel
})
</script>

<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="closeModel">
    <div
      class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50"
    >
      <!-- 头部 -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0"
      >
        <h2 class="text-xl font-bold">
          {{ type === 0 ? '新增人台图组' : '编辑人台图组' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon
            name="i-heroicons-x-mark"
            class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
          />
        </button>
      </div>

      <!-- 内容 -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <UFormGroup label="标题" required>
          <UInput
            v-model="form.title"
            placeholder="标题"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: { white: { outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary' } }
            }"
          />
        </UFormGroup>

        <UFormGroup label="是否显示">
          <URadioGroup
            v-model="form.is_show"
            :options="[
              { label: '显示', value: 0 },
              { label: '隐藏', value: 1 }
            ]"
          />
        </UFormGroup>

        <UFormGroup label="人台图" class="space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            最多上传 18 张，支持拖拽排序
          </p>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 p-3">
            <!-- 不走 SSR：服务端不渲染图片选择器 -->
            <QhxImagePicker ref="imagePickerRef" :multiple="true" :max="18" />
          </div>
        </UFormGroup>
      </div>

      <!-- 底部 -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton color="gray" variant="ghost" @click="closeModel" class="px-6">
          取消
        </UButton>
        <UButton
          :loading="loading"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="submit"
        >
          {{ type === 1 ? '确认修改' : '确认添加' }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>


