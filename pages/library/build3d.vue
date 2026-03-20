<script setup lang="ts">
import type { LibraryVideo, Library } from '@/types/api'
import { getLibraryVideoList, insertLibraryVideo, updateLibraryVideo } from '@/api/library'
import { BASE_IMG } from '@/utils/ipConfig'
import { uploadFileToOSS } from '@/utils/ossUpload'
import authGlobal from '@/middleware/auth.global'
import SPZModelViewer from '@/components/ModelViewer/SPZModelViewer.vue'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'

definePageMeta({
  name: 'library-build3d',
  middleware: [authGlobal]
})
useHead({
  title: '3D建设',
  meta: [
    { name: 'description', content: '3D建设 - 洛丽塔图鉴3D模型展示' }
  ]
})

const router = useRouter()
const toast = useToast()
const userStore = storeToRefs(useUserStore())
const { user } = userStore
const keywords = ref('')
const createTime = ref('')
const waterList = ref<InstanceType<typeof import('@/components/Qhx/WaterList.vue')['default']> | null>(null)
const layoutReady = inject('layoutReady') as Ref<boolean>

// 新增/编辑弹窗
const showAddModal = ref(false)
const editingVideo = ref<LibraryVideo | null>(null)
const formData = reactive({
  pk_id: 0 as number,
  pk_type: 2 as number,
  addr: '' as string,
  title: '' as string,
  cover: '' as string,
  video_id: undefined as number | undefined
})
const selectedLibrary = ref<Library | null>(null)
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const spzFileInput = ref<HTMLInputElement | null>(null)
const uploadingSpz = ref(false)
const selectedSpzFiles = ref<Array<{ name: string; url: string }>>([])
const submitting = ref(false)
const coverPickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

const fetchData = async (page: number, pageSize: number) => {
  const response = await getLibraryVideoList({
    page,
    pageSize,
    keywords: keywords.value?.trim() || undefined,
    create_time: createTime.value || undefined,
    pk_type: 2
  })
  return {
    rows: response.rows,
    count: response.count
  }
}

const handleSearch = () => {
  waterList.value?.refresh()
}

const spzModelViewerRef = ref<{ showModel: (models: Array<{ url: string; type?: 'splat' | 'model'; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; options?: Record<string, unknown> }>) => Promise<void> } | null>(null)

const handleVideoClick = (item: LibraryVideo) => {
  if (item.pk_type === 2 && item.addr) {
    const modelUrls = item.addr.split(',').filter(url => url.trim())
    const modelList = modelUrls.map((url, index) => ({
      url: url.trim(),
      type: 'splat' as const,
      position: [index * 3, 0, 0] as [number, number, number],
      options: {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/'
      }
    }))
    spzModelViewerRef.value?.showModel(modelList)
  }
}

const jumpToLibraryDetail = (library: Library | undefined) => {
  if (library?.library_id) {
    router.push(`/library/detail/${library.library_id}`)
  }
}

const canEdit = (item: LibraryVideo) => {
  const uid = user.value?.user_id
  const user_id = item.user_id
  return uid != null && user_id != null && uid === user_id
}

// 打开新增
const handleAdd = () => {
  editingVideo.value = null
  resetForm()
  showAddModal.value = true
}

// 打开编辑
const handleEdit = (item: LibraryVideo) => {
  editingVideo.value = item
  formData.pk_id = item.pk_id ?? 0
  formData.pk_type = 2
  formData.addr = item.addr ?? ''
  formData.title = item.title ?? ''
  formData.cover = item.cover ?? ''
  formData.video_id = item.video_id
  selectedLibrary.value = item.library ?? null
  if (item.addr) {
    selectedSpzFiles.value = item.addr.split(',').filter(u => u.trim()).map(url => ({
      name: url.split('/').pop() || 'model.spz',
      url: url.trim()
    }))
  } else {
    selectedSpzFiles.value = []
  }
  showAddModal.value = true
}

// 打开图鉴选择
const openLibraryChoose = (e?: MouseEvent) => {
  libraryChooseRef.value?.showModel(e)
}

// 图鉴选择回调
const onLibraryChoose = (list: Library[]) => {
  if (list.length > 0) {
    selectedLibrary.value = list[0]
    formData.pk_id = list[0].library_id ?? 0
  }
}

// 选择/上传 spz 文件
const handleSpzFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  for (const file of Array.from(input.files)) {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.spz')) {
      toast.add({
        title: '仅支持 .spz 格式',
        description: `"${file.name}" 格式不正确`,
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      continue
    }
    await uploadSpzFile(file)
  }
  input.value = ''
}

// 拖拽上传
const handleSpzFileDrop = async (event: DragEvent) => {
  if (!event.dataTransfer?.files?.length) return
  for (const file of Array.from(event.dataTransfer.files)) {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.spz')) {
      toast.add({
        title: '仅支持 .spz 格式',
        description: `"${file.name}" 格式不正确`,
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      continue
    }
    await uploadSpzFile(file)
  }
}

const uploadSpzFile = async (file: File) => {
  uploadingSpz.value = true
  try {
    const result = await uploadFileToOSS(file, 'library')
    selectedSpzFiles.value.push({
      name: file.name,
      url: result.file_url
    })
    formData.addr = selectedSpzFiles.value.map(f => f.url).join(',')
    toast.add({
      title: '上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('上传失败', error)
    toast.add({
      title: '上传失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    uploadingSpz.value = false
  }
}

// 移除已选 spz
const removeSpzFile = (index: number) => {
  selectedSpzFiles.value.splice(index, 1)
  formData.addr = selectedSpzFiles.value.map(f => f.url).join(',')
}

// 封面上传
const handleCoverChange = async (files: File[]) => {
  if (files.length === 0) return
  try {
    const result = await uploadFileToOSS(files[0], 'library')
    formData.cover = result.file_url
    coverPickerRef.value?.clear()
    toast.add({
      title: '封面上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('封面上传失败:', error)
    toast.add({
      title: '封面上传失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

const resetForm = () => {
  formData.pk_id = 0
  formData.pk_type = 2
  formData.addr = ''
  formData.title = ''
  formData.cover = ''
  formData.video_id = undefined
  selectedLibrary.value = null
  selectedSpzFiles.value = []
}

const handleCloseModal = () => {
  showAddModal.value = false
  editingVideo.value = null
  resetForm()
  coverPickerRef.value?.clear()
}

const handleSubmit = async () => {
  if (!formData.pk_id) {
    toast.add({
      title: '请选择图鉴',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  if (!formData.addr?.trim()) {
    toast.add({
      title: '请上传 .spz 模型文件',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  submitting.value = true
  try {
    if (editingVideo.value?.video_id) {
      await updateLibraryVideo({
        video_id: editingVideo.value.video_id,
        pk_id: formData.pk_id,
        pk_type: 2,
        addr: formData.addr.trim(),
        title: formData.title || undefined,
        cover: formData.cover || undefined
      })
      toast.add({ title: '更新成功', icon: 'i-heroicons-check-circle', color: 'green' })
    } else {
      await insertLibraryVideo({
        pk_id: formData.pk_id,
        pk_type: 2,
        addr: formData.addr.trim(),
        title: formData.title || undefined,
        cover: formData.cover || undefined
      })
      toast.add({ title: '添加成功', icon: 'i-heroicons-check-circle', color: 'green' })
    }
    handleCloseModal()
    waterList.value?.refresh()
  } catch (error) {
    console.error('提交失败', error)
    toast.add({
      title: editingVideo.value ? '更新失败' : '添加失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="container mx-auto min-h-screen pb-8">
    <!-- 搜索区域 -->
    <div class="px-4 py-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="keywords"
          placeholder="关键词搜索，如：洛丽塔 甜系"
          class="flex-1 min-w-[200px]"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-lg'
          }"
          @keyup.enter="handleSearch"
        />
        <UInput
          v-model="createTime"
          type="date"
          placeholder="选择日期"
          class="w-[160px]"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary',
            rounded: 'rounded-lg'
          }"
        />
        <UButton color="primary" @click="handleSearch">
          搜索
        </UButton>
        <UButton class="bg-qhx-primary text-qhx-inverted" icon="i-heroicons-plus" @click="handleAdd">
          新增
        </UButton>
        <UButton variant="outline" @click="router.push('/library')">
          返回图鉴
        </UButton>
      </div>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        3D建设 - 展示所有3D人台图，支持关键词和日期筛选
      </div>
    </div>

    <!-- 瀑布流列表 -->
    <QhxWaterList
      v-if="layoutReady"
      ref="waterList"
      :fetch-data="fetchData"
      :columns="4"
      :columns-768="2"
      :page-size="12"
      :item-key="1"
      :enable-waterfall="true"
      :enable-load-more="true"
    >
      <template #default="{ item, debouncedApplyLayout }">
        <div class="custom-item p-2" :key="item.video_id">
          <div class="bg-qhx-bg-card rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <!-- 图鉴基本信息 -->
            <div
              v-if="item.library"
              class="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              @click="jumpToLibraryDetail(item.library)"
            >
              <div class="flex gap-3">
                <img
                  v-if="item.library.cover"
                  :src="BASE_IMG + item.library.cover + '?x-oss-process=image/quality,q_80/resize,w_150,h_150'"
                  :alt="item.library.name"
                  class="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                >
                <div v-else class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UIcon name="i-heroicons-photo" class="w-8 h-8 text-gray-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium truncate" :title="item.library.name">
                    {{ item.library.name }}
                  </h3>
                  <p v-if="item.library.shop?.shop_name" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {{ item.library.shop.shop_name }}
                  </p>
                  <p v-if="item.title" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {{ item.title }}
                  </p>
                </div>
              </div>
            </div>
            <!-- 3D LibraryVideo 展示 -->
            <div class="p-3 pt-0">
              <div
                @click="handleVideoClick(item)"
                class="cursor-pointer w-full aspect-square max-w-[160px] mx-auto relative object-cover rounded-[10px] shadow-lg border border-gray-200 dark:border-gray-600 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <img
                  v-if="item.cover"
                  :src="BASE_IMG + item.cover + '?x-oss-process=image/quality,q_80/resize,w_300,h_300'"
                  :alt="item.title || item.library?.name"
                  class="w-full h-full object-cover"
                  @load="debouncedApplyLayout"
                >
                <div v-else class="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <UIcon name="i-heroicons-cube" class="w-12 h-12 text-gray-400" />
                </div>
                <div class="absolute left-0 top-0 px-1.5 py-0.5 flex justify-center items-center bg-qhx-primary text-[10px] text-qhx-inverted rounded-br-[4px] font-semibold">
                  3D
                </div>
                <div v-if="item.addr" class="absolute right-1 top-1 w-5 h-5 flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-full">
                  {{ item.addr.split(',').length }}
                </div>
              </div>
            </div>
            <!-- 编辑按钮 - 单独一行，仅创建者可见 -->
            <div
              v-if="canEdit(item)"
              class="px-3 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700"
              @click.stop="handleEdit(item)"
            >
              <UButton
                block
                variant="outline"
                size="sm"
                icon="i-heroicons-pencil"
                class="text-qhx-primary border-qhx-primary"
              >
                编辑
              </UButton>
            </div>
          </div>
        </div>
      </template>
      <template #empty>
        暂无3D模型数据
      </template>
    </QhxWaterList>

    <SPZModelViewer ref="spzModelViewerRef" />

    <!-- 新增/编辑弹窗 -->
    <UModal v-model="showAddModal" :ui="{ width: 'max-w-2xl' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ editingVideo ? '编辑3D模型' : '新增3D模型' }}
            </h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="handleCloseModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <!-- 选择图鉴 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              选择图鉴
            </label>
            <div
              class="flex items-center gap-3 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-qhx-primary transition-colors"
              @click="openLibraryChoose"
            >
              <div v-if="selectedLibrary" class="flex items-center gap-3 flex-1 min-w-0">
                <img
                  v-if="selectedLibrary.cover"
                  :src="BASE_IMG + selectedLibrary.cover + '?x-oss-process=image/quality,q_80/resize,w_80,h_80'"
                  :alt="selectedLibrary.name"
                  class="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                >
                <div v-else class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UIcon name="i-heroicons-photo" class="w-6 h-6 text-gray-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ selectedLibrary.name }}</p>
                  <p v-if="selectedLibrary.shop?.shop_name" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ selectedLibrary.shop.shop_name }}</p>
                </div>
                <UIcon name="i-heroicons-pencil" class="text-gray-400 flex-shrink-0" />
              </div>
              <div v-else class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-plus-circle" class="text-xl" />
                <span>点击选择图鉴</span>
              </div>
            </div>
          </div>

          <!-- 模型上传 (仅 .spz) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              模型文件 (.spz)
            </label>
            <input
              ref="spzFileInput"
              type="file"
              accept=".spz"
              multiple
              class="hidden"
              @change="handleSpzFileSelect"
            >
            <div
              v-if="selectedSpzFiles.length === 0"
              class="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-qhx-primary transition-colors"
              @click="spzFileInput?.click()"
              @dragover.prevent
              @drop.prevent="handleSpzFileDrop"
            >
              <UIcon name="i-heroicons-cube" class="text-4xl text-gray-400 mx-auto mb-2" />
              <p class="text-sm text-gray-600 dark:text-gray-400">
                点击选择或拖拽 .spz 文件
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">
                仅支持 .spz 格式
              </p>
            </div>
            <div v-else class="space-y-2">
              <div
                class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                v-for="(file, idx) in selectedSpzFiles"
                :key="idx"
              >
                <UIcon name="i-heroicons-cube" class="text-qhx-primary flex-shrink-0" />
                <span class="flex-1 truncate text-sm">{{ file.name }}</span>
                <UButton
                  v-if="!uploadingSpz"
                  size="xs"
                  variant="ghost"
                  icon="i-heroicons-x-mark"
                  @click="removeSpzFile(idx)"
                />
              </div>
              <UButton
                v-if="!uploadingSpz"
                size="sm"
                variant="outline"
                icon="i-heroicons-plus"
                @click="spzFileInput?.click()"
              >
                继续添加
              </UButton>
              <div v-if="uploadingSpz" class="flex items-center gap-1 text-sm text-gray-500">
                <span class="w-4 h-4 border-2 border-qhx-primary border-t-transparent rounded-full animate-spin" />
                上传中...
              </div>
            </div>
          </div>

          <!-- 封面图 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              封面图
            </label>
            <div v-if="formData.cover" class="mb-2">
              <img
                :src="formatImg(formData.cover)"
                alt="封面预览"
                class="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              >
              <UButton
                size="xs"
                variant="ghost"
                color="gray"
                class="mt-1"
                @click="formData.cover = ''"
              >
                移除封面
              </UButton>
            </div>
            <QhxImagePicker
              ref="coverPickerRef"
              :multiple="false"
              @update:files="handleCoverChange"
            />
          </div>

          <!-- 标题 (可选) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              标题 (可选)
            </label>
            <UInput v-model="formData.title" placeholder="请输入标题" />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="handleCloseModal">
              取消
            </UButton>
            <UButton
              :loading="submitting"
              class="bg-qhx-primary text-qhx-inverted"
              @click="handleSubmit"
            >
              {{ editingVideo ? '更新' : '添加' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <LibraryChoose
      ref="libraryChooseRef"
      :multiple="false"
      @choose="onLibraryChoose"
    />
  </div>
</template>
