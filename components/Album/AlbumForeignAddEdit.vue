<template>
  <QhxModal v-model="show" :trigger-position="clickPosition" @close="handleClose">
    <div class="w-[95vw] max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 flex-shrink-0">
        <h2 class="text-lg font-semibold">
          {{ type === 0 ? '达成成就' : type === 1 ? '重新打卡' : '成就展示' }}
        </h2>
        <button
          @click="closeModel"
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <UIcon name="i-heroicons-x-mark" class="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <div class="space-y-6 max-h-[70vh] overflow-y-auto p-6">
          <!-- 成就信息展示 -->
          <div v-if="info">
            <!-- 封面展示 -->
            <div v-if="!info.album_foreign || (info.album_foreign && !info.album_foreign.cover)" class="mb-4">
              <div class="relative w-full rounded-lg overflow-hidden shadow-md" :style="{ aspectRatio: '20/15' }">
                <img 
                  :src="BASE_IMG + info.album_cover" 
                  :alt="info.album_title"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                  <div class="p-4 w-full text-white">
                    <h3 class="text-xl font-semibold mb-2 text-center">{{ info.album_title }}</h3>
                    <SafeRichText v-if="albumDescNodes.length > 0" :nodes="albumDescNodes" class="text-sm" />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 多图轮播展示 -->
            <div v-else class="mb-4">
              <div v-if="info.album_foreign.cover && info.album_foreign.cover.length > 0" class="mb-4">
                <div class="grid grid-cols-3 gap-2 mb-4">
                  <div 
                    v-for="(img, index) in info.album_foreign.cover" 
                    :key="index"
                    class="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <QhxPreviewImage 
                      :list="[{ src: img, alt: `成就图片 ${index + 1}` }]"
                      :preview="info.album_foreign.cover"
                      className="w-full h-full object-cover"
                    />
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all pointer-events-none"></div>
                  </div>
                </div>
              </div>
              <h3 class="text-xl font-semibold mb-2 text-center">{{ info.album_title }}</h3>
              <SafeRichText v-if="albumDescNodes.length > 0" :nodes="albumDescNodes" class="text-sm mb-4" />
            </div>
            
            <!-- 成就进度 -->
            <div v-if="info.pk_type === 1 && info.progress" class="mb-4">
              <div class="text-sm text-gray-600 mb-2">成就进度</div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  class="bg-qhx-primary h-2.5 rounded-full transition-all duration-300" 
                  :style="{ width: `${info.progress}%` }"
                ></div>
              </div>
              <div class="text-xs text-gray-500 mt-1 text-right">{{ info.progress }}%</div>
            </div>
            
            <!-- 达成时间 -->
            <div v-if="info.album_foreign && info.album_foreign.create_time" class="text-sm text-gray-600 mb-4">
              达成时间: {{ formatDate(info.album_foreign.create_time) }}
            </div>
            
            <!-- 封面图片上传（仅新增和修改模式） -->
            <div v-if="info.pk_type === 0 && type !== 2" class="mb-4">
              <UFormGroup label="成就封面">
                <QhxImagePicker 
                  :multiple="true" 
                  @update:files="onUpdateCoverFiles" 
                  ref="coverImageRef" 
                />
                <p class="text-xs text-gray-500 mt-2">请上传至少一张封面图片</p>
              </UFormGroup>
            </div>
            
            <!-- 笔记输入（仅新增和修改模式） -->
            <div v-if="type !== 2" class="mb-4">
              <UFormGroup label="笔记">
                <UTextarea 
                  v-model="form.note" 
                  placeholder="记录你的成就心得..." 
                  :rows="4"
                  maxlength="3000"
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
                <div class="text-xs text-gray-500 mt-1 text-right">
                  {{ form.note?.length || 0 }}/3000
                </div>
              </UFormGroup>
            </div>
            
            <!-- 笔记展示（仅展示模式） -->
            <div v-if="type === 2 && info.album_foreign && info.album_foreign.note && info.album_foreign.note !== ''" class="mb-4">
              <div class="text-sm font-medium text-gray-700 mb-2">笔记</div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {{ info.album_foreign.note }}
              </div>
            </div>
          </div>
          
          <!-- 加载中状态 -->
          <div v-else class="flex justify-center items-center py-8">
            <div class="text-gray-500">加载中...</div>
          </div>
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <div v-if="type !== 2" class="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <UButton color="gray" @click="closeModel">取消</UButton>
        <UButton 
          v-if="info && info.can_achieved"
          :loading="loading" 
          size="xs" 
          class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
          @click="handleSubmit"
        >
          {{ type === 1 ? '重新打卡' : '达成成就' }}
        </UButton>
        <UButton 
          v-else-if="info"
          disabled
          size="xs"
        >
          未达成
        </UButton>
        <UButton 
          v-else
          disabled
          size="xs"
        >
          加载中
        </UButton>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { insertAlbumForeign, getAlbumDetail, updateAlbumForeign } from '@/api/album'
import { uploadImage } from '@/api'
import { BASE_IMG } from '@/utils/ipConfig'
import { useToast } from '#imports'
import { parseRichText } from '@/utils/public'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { Album } from '@/types/api'
import type { RichNode } from '@/utils/public'
import dayjs from 'dayjs'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'

// 扩展 Album 类型以包含成就相关信息
interface ExtendedAlbum extends Album {
  album_desc?: string
  pk_type?: number
  progress?: number
  can_achieved?: boolean
  album_foreign?: {
    cover?: string[]
    note?: string
    create_time?: string | Date
  }
}

const emit = defineEmits(['success'])

const show = ref<boolean>(false)
const loading = ref<boolean>(false)
const type = ref<number>(0) // 0 新增 1 修改 2 展示
const album_id = ref<number | null>(null)
const user_id = ref<number | null>(null)
const info = ref<ExtendedAlbum | null>(null)
const toast = useToast()
const clickPosition = ref({ x: 0, y: 0 })

// 图片选择器引用
const coverImageRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)

// 表单数据
const form = ref<{
  note: string
}>({
  note: ''
})

// 解析成就描述为富文本节点
const albumDescNodes = computed<RichNode[]>(() => {
  if (!info.value?.album_desc) return []
  try {
    return parseRichText(info.value.album_desc)
  } catch (error) {
    console.error('解析富文本失败:', error)
    return []
  }
})

// 格式化日期
const formatDate = (date: string | Date | undefined): string => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

// 显示新增弹窗
const showModel = (item: { album_id: number }, event?: MouseEvent) => {
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
  show.value = true
  type.value = 0
  album_id.value = item.album_id
  user_id.value = null
  fetchAlbumDetail()
}

// 显示修改弹窗
const editModel = (item: { album_id: number }, event?: MouseEvent) => {
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
  show.value = true
  type.value = 1
  album_id.value = item.album_id
  user_id.value = null
  fetchAlbumDetail()
}

// 显示成就展示弹窗
const showAchieve = (item: { album_id: number; user_id?: number }, event?: MouseEvent) => {
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
  show.value = true
  type.value = 2
  album_id.value = item.album_id
  user_id.value = item.user_id || null
  fetchAlbumDetail()
}

// 获取成就详情
const fetchAlbumDetail = async () => {
  try {
    if (!album_id.value) return
    
    const params: { album_id: number; user_id?: number } = {
      album_id: album_id.value
    }
    if (user_id.value) {
      params.user_id = user_id.value
    }
    
    const response = await getAlbumDetail(params)
    // API 返回的数据可能包含扩展字段，使用类型断言
    const albumInfo = response as unknown as ExtendedAlbum
    
    // 处理封面图片数组
    if (albumInfo.album_foreign?.cover) {
      if (typeof albumInfo.album_foreign.cover === 'string') {
        albumInfo.album_foreign.cover = albumInfo.album_foreign.cover.split(',').filter(Boolean)
      }
    }
    
    info.value = albumInfo
    
    // 如果是修改模式，设置已有的封面图片和笔记
    if (type.value === 1 && albumInfo.album_foreign) {
      nextTick(() => {
        if (coverImageRef.value && albumInfo.album_foreign?.cover && albumInfo.album_foreign.cover.length > 0) {
          coverImageRef.value.previewImages = albumInfo.album_foreign.cover.map((img: string) => ({
            url: BASE_IMG + img,
            file: undefined as unknown as File
          }))
        }
        form.value.note = albumInfo.album_foreign.note || ''
      })
    } else {
      form.value.note = ''
    }
  } catch (error) {
    console.error('获取成就详情失败:', error)
    toast.add({
      title: '获取成就详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 处理封面图片更新
const onUpdateCoverFiles = (files: File[]) => {
  // 文件已通过 QhxImagePicker 处理
}

// 上传图片
const fetchUpload = async (file: { file?: File; url: string }): Promise<string> => {
  try {
    let url: string
    if (file.file) {
      const res = await uploadImage(file.file)
      url = res.file_url
    } else {
      url = file.url.replace(BASE_IMG, '')
    }
    return url
  } catch (error) {
    console.error('图片上传失败:', error)
    toast.add({
      title: '图片上传失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    throw error
  }
}

// 提交表单
const handleSubmit = async () => {
  if (loading.value) {
    toast.add({
      title: '请求中请稍后',
      icon: 'i-heroicons-exclamation-circle',
      color: 'warning'
    })
    return
  }
  
  // 验证封面图片
  if (info.value?.pk_type === 0) {
    if (!coverImageRef.value || coverImageRef.value.previewImages.length === 0) {
      toast.add({
        title: '请上传封面',
        icon: 'i-heroicons-exclamation-circle',
        color: 'warning'
      })
      return
    }
  }
  
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      album_id: album_id.value,
      note: form.value.note || ''
    }
    
    // 处理封面图片
    if (info.value?.pk_type === 0 && coverImageRef.value && coverImageRef.value.previewImages.length > 0) {
      const coverUrls = await Promise.all(
        coverImageRef.value.previewImages.map(img => fetchUpload(img))
      )
      params.cover = coverUrls.join(',')
    }
    
    if (type.value === 0) {
      await insertAlbumForeign(params)
      toast.add({
        title: '达成成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await updateAlbumForeign(params)
      toast.add({
        title: '修改成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
    
    emit('success')
    closeModel()
  } catch (error) {
    console.error('操作失败:', error)
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 关闭弹窗
const closeModel = () => {
  show.value = false
  initData()
}

// 处理关闭事件
const handleClose = () => {
  closeModel()
}

// 初始化数据
const initData = () => {
  info.value = null
  form.value = {
    note: ''
  }
  album_id.value = null
  user_id.value = null
  
  // 清空图片选择器
  nextTick(() => {
    if (coverImageRef.value) {
      coverImageRef.value.clear()
    }
  })
}

defineExpose({
  showModel,
  editModel,
  showAchieve
})
</script>

<style scoped>

</style>
