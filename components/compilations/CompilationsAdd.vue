<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { insertComp, updateComp } from '@/api/compilations'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import type { Compilations } from '@/types/api'

const emit = defineEmits(['success'])

const compCoverRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const show = ref(false)
const loading = ref(false)
const type = ref(0) // 0 创建 1 编辑
const clickPosition = ref({ x: 0, y: 0 })

const form = ref<{
  comp_id: number | undefined
  comp_name: string
  comp_describe: string
  is_open: number // 0否 1是
}>({
  comp_id: undefined,
  comp_name: '',
  comp_describe: '',
  is_open: 0 // 默认不开放
})

const showModel = (item: Compilations | null = null, event?: MouseEvent) => {
  // 记录触发位置（如果有事件对象）
  if (event) {
    clickPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  } else {
    // 默认位置：屏幕中心
    clickPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }

  // 设置类型：0=创建，1=编辑
  type.value = item?.comp_id ? 1 : 0

  // 初始化表单数据
  if (item) {
    form.value.comp_id = item.comp_id || undefined
    form.value.comp_name = item.comp_name || ''
    form.value.comp_describe = item.comp_describe || ''
    form.value.is_open = item.is_open !== undefined ? item.is_open : 0
    
    // 处理封面图片
    nextTick(() => {
      if (compCoverRef.value) {
        if (item.comp_cover) {
          compCoverRef.value.previewImages = [{
            id: `img_${Date.now()}_${Math.random()}`,
            file: undefined as unknown as File,
            url: BASE_IMG + item.comp_cover
          }]
        } else {
          compCoverRef.value.previewImages = []
        }
      }
    })
  } else {
    // 如果没有传入 item，重置表单
    initData()
  }

  show.value = true
}

const closeModel = () => {
  show.value = false
  initData()
}

const handleClose = () => {
  closeModel()
}

const initData = () => {
  form.value = {
    comp_id: undefined,
    comp_name: '',
    comp_describe: '',
    is_open: 0 // 默认不开放
  }
  // 清空图片选择器
  if (compCoverRef.value) {
    compCoverRef.value.previewImages = []
  }
}

const fetchUpload = async (file: { file?: File; url: string }) => {
  let url: string
  if (file.file) {
    const res = await uploadImage(file.file)
    url = res.file_url
  } else {
    url = file.url.replace(BASE_IMG, '')
  }
  return url
}

const insert = async () => {
  if (loading.value) {
    return
  }
  
  // 验证必填字段
  if (!form.value.comp_name || form.value.comp_name.trim() === '') {
    const toast = useToast()
    toast.add({
      title: '请输入合集名称',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }

  loading.value = true
  const toast = useToast()
  
  try {
    const params: Partial<Compilations> = {
      comp_name: form.value.comp_name.trim(),
      pk_type: 0, // 必传，0是图鉴合集
      comp_describe: form.value.comp_describe.trim() || null,
      is_open: form.value.is_open // 是否开放添加：0否 1是
    }

    // 上传封面图片
    if (compCoverRef.value && compCoverRef.value.previewImages.length > 0) {
      try {
        const imageItem = compCoverRef.value.previewImages[0]
        const comp_cover = await fetchUpload({
          file: imageItem.file,
          url: imageItem.url || ''
        })
        params.comp_cover = comp_cover
      } catch (error) {
        console.log('上传封面失败', error)
        params.comp_cover = null
      }
    } else {
      params.comp_cover = null
    }

    if (type.value === 0) {
      // 创建
      await insertComp(params)
      toast.add({
        title: '创建成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      // 编辑
      if (form.value.comp_id) {
        params.comp_id = form.value.comp_id
        await updateComp(params)
      } else {
        throw new Error('合集ID不存在')
      }
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    
    emit('success')
    closeModel()
  } catch (error) {
    console.error(type.value === 0 ? '创建失败:' : '修改失败:', error)
    toast.add({
      title: type.value === 0 ? '创建失败' : '修改失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel
})
</script>

<template>
  <!-- Popup -->
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-xl font-bold">
          {{ type === 0 ? '创建合集' : '编辑合集' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        <!-- 主要信息板块 -->
        <div class="space-y-6">
          <!-- 合集名称（必填） -->
          <UFormGroup label="合集名称" required>
            <UInput
              v-model="form.comp_name"
              placeholder="请输入合集名称"
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

          <!-- 合集描述 -->
          <UFormGroup label="合集描述">
            <UTextarea 
              v-model="form.comp_describe" 
              placeholder="请输入合集描述（可选）" 
              :rows="4" 
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

          <!-- 合集封面 -->
          <UFormGroup label="合集封面" class="space-y-2">
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <QhxImagePicker :multiple="false" ref="compCoverRef" />
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 可选择一张图片作为合集封面（可选）
            </p>
          </UFormGroup>

          <!-- 是否开放添加 -->
          <UFormGroup label="是否开放添加">
            <URadioGroup 
              v-model="form.is_open"
              class="ring-qhx-primary text-qhx-primary"
              :ui="{
                wrapper: 'p-2',
              }"
              :uiRadio="{
                wrapper: 'p-2',
                border: 'text-qhx-primary cursor-pointer',
                color: 'qhx-primary',
              }"
              :options="[
                { value: 0, label: '否' },
                { value: 1, label: '是' }
              ]" 
            />
            <p v-if="form.is_open === 1" class="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
              <span>当前合集其他用户也可以添加图鉴</span>
            </p>
          </UFormGroup>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
        <UButton 
          color="gray" 
          variant="ghost"
          @click="closeModel"
          class="px-6"
        >
          取消
        </UButton>
        <UButton
          :loading="loading"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-6 shadow-lg shadow-pink-500/30 transition-all duration-200"
          @click="insert"
        >
          {{ type === 1 ? '确认修改' : '确认创建' }}
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

