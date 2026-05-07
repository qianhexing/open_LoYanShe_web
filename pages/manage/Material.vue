<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 头部 -->
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">素材管理</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">管理您的3D场景素材</p>
        </div>
        <UButton
          @click="showAddModal = true"
          class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
          icon="i-heroicons-plus"
        >
          添加素材
        </UButton>
      </div>

      <!-- 搜索栏 -->
      <div class="mb-6">
        <div class="flex gap-2">
          <UInput
            v-model="searchKeyword"
            placeholder="搜索素材标题..."
            class="flex-1"
            icon="i-heroicons-magnifying-glass"
            @keyup.enter="handleSearch"
          />
          <UButton
            @click="handleSearch"
            class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
          >
            搜索
          </UButton>
          <UButton
            v-if="searchKeyword"
            @click="handleReset"
            variant="outline"
          >
            重置
          </UButton>
        </div>
      </div>

      <!-- 瀑布流列表 -->
      <QhxWaterList
        ref="waterList"
        v-if="layoutReady"
        :fetch-data="fetchMaterialData"
        :columns="4"
        :itemKey="0"
        :columns_768="2"
        :enableWaterfall="true"
        :enableLoadMore="true"
        :pageSize="20"
      >
        <template #default="{ item, debouncedApplyLayout }">
          <div class="px-2 pb-4">
            <div
              class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
              @image-load="debouncedApplyLayout"
            >
              <!-- 图片 -->
              <div class="relative aspect-square bg-gray-100 dark:bg-gray-700">
                <img
                  :src="formatImg(item.cover || 'static/plan_cover/default.jpg')"
                  :alt="item.materia_title || '素材'"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @load="debouncedApplyLayout"
                />
                <!-- 操作按钮 -->
                <div class="absolute top-2 right-2 flex gap-1">
                  <QhxJellyButton>
                    <div class="h-[50px] text-center px-1 cursor-pointer">
                      <div
                        @click="handleEdit(item)"
                        class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer shadow-lg">
                        <UIcon name="i-heroicons-pencil" class="text-[18px] text-[#ffffff]" />
                      </div>
                      <div class="text-[10px] text-white font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">编辑</div>
                    </div>
                  </QhxJellyButton>
                  <QhxJellyButton>
                    <div class="h-[50px] text-center px-1 cursor-pointer">
                      <div
                        @click="handleDelete(item)"
                        class="m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-red-500 flex items-center justify-center cursor-pointer shadow-lg">
                        <UIcon name="i-heroicons-trash" class="text-[18px] text-[#ffffff]" />
                      </div>
                      <div class="text-[10px] text-white font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">删除</div>
                    </div>
                  </QhxJellyButton>
                </div>
                <!-- 状态标签 -->
                <div class="absolute top-2 left-2 flex flex-wrap gap-1">
                  <span
                    v-if="item.is_private === 1"
                    class="px-2 py-1 text-xs rounded bg-yellow-500/80 text-white"
                  >
                    私有
                  </span>
                  <span
                    v-if="item.is_enable === 1"
                    class="px-2 py-1 text-xs rounded bg-red-500/80 text-white"
                  >
                    已删除
                  </span>
                </div>
              </div>
              <!-- 信息 -->
              <div class="p-3">
                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                  {{ item.materia_title || '未命名素材' }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(item.create_time) }}
                </p>
              </div>
            </div>
          </div>
        </template>
        <template #empty>
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📦</div>
            <p class="text-gray-500 dark:text-gray-400">暂无素材</p>
            <UButton
              @click="showAddModal = true"
              class="mt-4 bg-qhx-primary text-white hover:bg-qhx-primaryHover"
            >
              添加第一个素材
            </UButton>
          </div>
        </template>
      </QhxWaterList>
    </div>

    <!-- 添加/编辑弹窗 -->
    <UModal v-model="showAddModal" :ui="{ width: 'max-w-2xl' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ editingMaterial ? '编辑素材' : '添加素材' }}
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
          <!-- 标题 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              素材标题
            </label>
            <UInput
              v-model="formData.materia_title"
              placeholder="请输入素材标题"
            />
          </div>

          <!-- 素材文件 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              素材文件 (GLTF/GLB)
            </label>
            <!-- 文件选择器 -->
            <div class="space-y-2">
              <input
                ref="materialFileInput"
                type="file"
                accept=".gltf,.glb"
                class="hidden"
                @change="handleMaterialFileSelect"
              />
              <div
                v-if="!formData.materia_url"
                class="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-qhx-primary transition-colors"
                @click="materialFileInput?.click()"
                @dragover.prevent
                @drop.prevent="handleMaterialFileDrop"
              >
                <div class="flex flex-col items-center gap-2">
                  <UIcon name="i-heroicons-cube" class="text-4xl text-gray-400" />
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    点击选择或拖拽 GLTF/GLB 文件
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500">
                    支持 .gltf 和 .glb 格式
                  </p>
                </div>
              </div>
              <!-- 已选择文件显示 -->
              <div
                v-if="formData.materia_url"
                class="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="flex-shrink-0 w-10 h-10 bg-qhx-primary/10 rounded-lg flex items-center justify-center">
                      <UIcon name="i-heroicons-cube" class="text-xl text-qhx-primary" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {{ selectedMaterialFileName || '素材文件' }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ formatFileSize(selectedMaterialFileSize) }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UButton
                      v-if="!uploadingMaterial"
                      size="xs"
                      variant="ghost"
                      icon="i-heroicons-x-mark"
                      @click="clearMaterialFile"
                    >
                      移除
                    </UButton>
                    <UButton
                      v-else
                      size="xs"
                      variant="ghost"
                      disabled
                    >
                      <span class="flex items-center gap-1">
                        <span class="w-4 h-4 border-2 border-qhx-primary border-t-transparent rounded-full animate-spin"></span>
                        上传中...
                      </span>
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 封面图（GLB/GLTF 上传成功后会自动截屏并上传，也可手动改） -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              封面图
            </label>
            <div v-if="formData.cover" class="mb-2">
              <img
                :src="formatImg(formData.cover)"
                alt="封面预览"
                class="w-32 h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
              />
            </div>
            <QhxImagePicker
              ref="coverPicker"
              :multiple="false"
              @update:files="handleCoverChange"
            />
          </div>

          <!-- 隐私设置 -->
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <UCheckbox
                v-model="isPrivateChecked"
                @change="formData.is_private = isPrivateChecked ? 1 : 0"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">设为私密</span>
            </label>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="ghost"
              @click="handleCloseModal"
            >
              取消
            </UButton>
            <UButton
              :loading="submitting"
              class="bg-qhx-primary text-white hover:bg-qhx-primaryHover"
              @click="handleSubmit"
            >
              {{ editingMaterial ? '更新' : '添加' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- 删除确认弹窗 -->
    <UModal v-model="showDeleteModal" :ui="{ width: 'max-w-md' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-red-600">确认删除</h3>
        </template>
        <p class="text-gray-700 dark:text-gray-300">
          确定要删除素材 "{{ deletingMaterial?.materia_title || '未命名' }}" 吗？此操作不可恢复。
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="ghost"
              @click="showDeleteModal = false"
            >
              取消
            </UButton>
            <UButton
              :loading="deleting"
              color="red"
              @click="confirmDelete"
            >
              删除
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <MateriaGltfCoverCapture ref="gltfCoverRef" v-model="formData.cover" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { Material } from '@/types/api'
import { getMaterialctList, insertMaterial, updateMaterial, deleteMaterial, type InsertMaterialParams } from '@/api/material'
import { uploadFileToOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import dayjs from 'dayjs'

// 禁用 SSR
definePageMeta({
  ssr: false
})

const toast = useToast()

// 数据
const submitting = ref(false)
const deleting = ref(false)
const searchKeyword = ref('')
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)

// 弹窗状态
const showAddModal = ref(false)
const showDeleteModal = ref(false)
const editingMaterial = ref<Material | null>(null)
const deletingMaterial = ref<Material | null>(null)

// 表单数据
const formData = reactive<InsertMaterialParams>({
  materia_title: '',
  materia_url: '',
  cover: null,
  is_private: 0,
  options: {}
})

// 复选框状态
const isPrivateChecked = ref(false)

// 组件引用
const materialFileInput = ref<HTMLInputElement | null>(null)
const coverPicker = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const gltfCoverRef = ref<{
  generateAndUploadFromFile: (file: File) => Promise<string>
} | null>(null)

// 素材文件相关
const uploadingMaterial = ref(false)
const selectedMaterialFileName = ref('')
const selectedMaterialFileSize = ref(0)

// 格式化图片 URL
const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

const layoutReady = inject('layoutReady') as Ref<boolean>

// 格式化日期
const formatDate = (date: Date | string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

// 获取素材数据（用于 WaterList）
const fetchMaterialData = async (page: number, pageSize: number) => {
  try {
    const params: { page: number; pageSize: number; keyword?: string } = {
      page,
      pageSize
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    const response = await getMaterialctList(params)
    return {
      rows: response.rows || [],
      count: response.count || 0
    }
  } catch (error) {
    console.error('获取素材列表失败:', error)
    toast.add({
      title: '获取素材列表失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    return {
      rows: [],
      count: 0
    }
  }
}

// 搜索
const handleSearch = () => {
  if (waterList.value) {
    waterList.value.refresh()
  }
}

// 重置搜索
const handleReset = () => {
  searchKeyword.value = ''
  if (waterList.value) {
    waterList.value.refresh()
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / (k ** i)).toFixed(2)} ${sizes[i]}`
}

// 处理素材文件选择
const handleMaterialFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await uploadMaterialFile(input.files[0])
  }
}

// 处理拖拽上传
const handleMaterialFileDrop = async (event: DragEvent) => {
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    // 检查文件类型
    const fileName = file.name.toLowerCase()
    if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
      await uploadMaterialFile(file)
    } else {
      toast.add({
        title: '文件格式错误',
        description: '请选择 .gltf 或 .glb 格式的文件',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  }
}

// 上传素材文件
const uploadMaterialFile = async (file: File) => {
  // 检查文件类型
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.gltf') && !fileName.endsWith('.glb')) {
    toast.add({
      title: '文件格式错误',
      description: '请选择 .gltf 或 .glb 格式的文件',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  uploadingMaterial.value = true
  selectedMaterialFileName.value = file.name
  selectedMaterialFileSize.value = file.size

  try {
    // 使用 OSS 上传
    const result = await uploadFileToOSS(file, 'material')
    formData.materia_url = result.file_url
    formData.pk_id = result.file_id
    toast.add({
      title: '文件上传成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    try {
      await gltfCoverRef.value?.generateAndUploadFromFile(file)
    } catch (coverErr) {
      console.error('GLB/GLTF 自动封面失败:', coverErr)
      toast.add({
        title: '素材已上传，封面未自动生成',
        description: '可手动在下方选择封面图',
        icon: 'i-heroicons-exclamation-triangle',
        color: 'orange'
      })
    }
  } catch (error) {
    console.error('文件上传失败:', error)
    toast.add({
      title: '文件上传失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    // 清除选择
    selectedMaterialFileName.value = ''
    selectedMaterialFileSize.value = 0
  } finally {
    uploadingMaterial.value = false
  }
}

// 清除素材文件
const clearMaterialFile = () => {
  formData.materia_url = ''
  selectedMaterialFileName.value = ''
  selectedMaterialFileSize.value = 0
  if (materialFileInput.value) {
    materialFileInput.value.value = ''
  }
}

// 处理封面图上传
const handleCoverChange = async (files: File[]) => {
  if (files.length === 0) return
  try {
    const result = await uploadFileToOSS(files[0])
    formData.cover = result.file_url
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

// 编辑素材
const handleEdit = (item: Material) => {
  editingMaterial.value = item
  formData.materia_title = item.materia_title || ''
  formData.materia_url = item.materia_url || ''
  formData.cover = item.cover
  formData.is_private = item.is_private ?? 0
  formData.options = item.options || {}
  isPrivateChecked.value = formData.is_private === 1
  formData.pk_id = item.pk_id
  // 如果有素材文件，显示文件名（从 URL 中提取）
  if (formData.materia_url) {
    const urlParts = formData.materia_url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    selectedMaterialFileName.value = fileName || '素材文件'
    // 文件大小未知，设为 0
    selectedMaterialFileSize.value = 0
  } else {
    selectedMaterialFileName.value = ''
    selectedMaterialFileSize.value = 0
  }
  
  showAddModal.value = true
}

// 删除素材
const handleDelete = (item: Material) => {
  deletingMaterial.value = item
  showDeleteModal.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!deletingMaterial.value) return
  deleting.value = true
  try {
    await deleteMaterial(deletingMaterial.value.materia_id)
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    showDeleteModal.value = false
    deletingMaterial.value = null
    if (waterList.value) {
      waterList.value.refresh()
    }
  } catch (error) {
    console.error('删除失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    deleting.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formData.materia_url) {
    toast.add({
      title: '请上传素材文件',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  submitting.value = true
  try {
    if (editingMaterial.value) {
      // 更新
      await updateMaterial({
        ...formData,
        materia_id: editingMaterial.value.materia_id
      })
      toast.add({
        title: '更新成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      // 新增
      await insertMaterial(formData)
      toast.add({
        title: '添加成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    handleCloseModal()
    if (waterList.value) {
      waterList.value.refresh()
    }
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: editingMaterial.value ? '更新失败' : '添加失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

// 关闭弹窗
const handleCloseModal = () => {
  showAddModal.value = false
  editingMaterial.value = null
  formData.materia_title = ''
  formData.materia_url = null
  formData.cover = null
  formData.is_private = 0
  formData.options = {}
  formData.pk_id = null
  isPrivateChecked.value = false
  selectedMaterialFileName.value = ''
  selectedMaterialFileSize.value = 0
  if (materialFileInput.value) {
    materialFileInput.value.value = ''
  }
  if (coverPicker.value) {
    coverPicker.value.clear()
  }
}

useHead({
  title: '素材管理 - Lo研社'
})
</script>

<style scoped>
</style>
