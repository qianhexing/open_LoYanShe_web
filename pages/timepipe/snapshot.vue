<template>
  <div class="container mx-auto min-h-screen p-4">
    <!-- 顶部控制栏 -->
    <div class="flex flex-wrap items-center gap-4 mb-6 sticky top-0 bg-white/90 backdrop-blur z-50 p-4 shadow-sm rounded-lg">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-gray-700">选择日期:</span>
        <QhxDatePicker v-model="picked" @change="onChange" />
      </div>
      
      <div class="flex items-center gap-4">
        <div class="text-sm text-gray-600">
          <span class="font-bold">{{ formattedDate }}</span> 上新总数: <span class="text-primary-600 font-bold">{{ list.length }}</span>
          (共 {{ chunks.length }} 组)
        </div>
        
        <UButton 
          :loading="isDownloading"
          color="primary" 
          icon="i-heroicons-arrow-down-tray"
          @click="handleDownloadAll"
        >
          批量下载所有截图
        </UButton>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
    </div>

    <!-- 内容展示区 -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20 max-w-[1920px] mx-auto">
      <div 
        v-for="(chunk, chunkIndex) in chunks" 
        :key="chunkIndex"
        :ref="(el) => setChunkRef(el, chunkIndex)"
        class="bg-white shadow-xl overflow-hidden relative group"
      >
        <!-- 下载当前组按钮 (hover显示) -->
        <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
           <UButton size="xs" color="gray" icon="i-heroicons-camera" @click="downloadChunk(chunkIndex)">下载此图</UButton>
        </div>

        <!-- 9.6:16 容器 -->
        <!-- aspect ratio: 9.6 / 16 = 0.6 (3:5) -->
        <div class="w-full aspect-[3/5] bg-white">
          <div class="w-full h-full grid grid-cols-3 grid-rows-3">
            <div 
              v-for="(item, itemIndex) in chunk" 
              :key="item.id || itemIndex" 
              class="relative w-full h-full overflow-hidden"
            >
              <!-- 封面图 (铺满) -->
              <img 
                :src="getImageUrl(item.item?.cover)" 
                class="w-full h-full object-cover block"
                loading="lazy"
                crossorigin="anonymous" 
              />
              
              <!-- 底部信息浮层 -->
              <div class="absolute bottom-4 left-0 w-full flex flex-col items-center justify-end pointer-events-none px-2">
                <div class="bg-white/60 backdrop-blur-[2px] px-3 py-1.5 rounded-md flex flex-col items-center justify-center max-w-full shadow-sm">
                   <!-- 图鉴名称 -->
                   <div class="text-xs font-bold text-black leading-tight text-center line-clamp-1 break-all mb-1">
                    {{ item.item?.name }}
                  </div>
                  <!-- 店铺信息 -->
                  <div class="flex items-center gap-1.5 justify-center">
                    <img 
                      v-if="item.item?.shop?.shop_logo"
                      :src="getImageUrl(item.item?.shop?.shop_logo)" 
                      class="w-5 h-5 rounded-full object-cover bg-white shadow-sm flex-shrink-0"
                      crossorigin="anonymous"
                    />
                    <span class="text-[10px] font-medium text-gray-800 truncate max-w-[80px]">
                      {{ item.item?.shop?.shop_name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 填充空白格子 (如果不足9个) -->
            <div 
              v-for="n in (9 - chunk.length)" 
              :key="`empty-${n}`" 
              class="bg-gray-50 flex items-center justify-center"
            >
              <UIcon name="i-heroicons-photo" class="text-gray-200 text-4xl" />
            </div>
          </div>
        </div>
        
        <!-- 底部页码标记 (可选) -->
        <div class="bg-gray-50 py-1 text-center text-xs text-gray-400 font-mono">
           {{ formattedDate }} - P{{ chunkIndex + 1 }}
        </div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && list.length === 0" class="text-center py-20 text-gray-500">
      该日期暂无上新数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { getLibraryPipeList } from '@/api/library'
import { useScreenshot } from '@/composables/useScreenshot'
import { BASE_IMG } from '@/utils/ipConfig'
import type { LibraryPipe } from '@/types/api'

// 状态
const picked = ref<Date>(new Date())
const list = ref<LibraryPipe[]>([])
const loading = ref(false)
const isDownloading = ref(false)
const chunkRefs = ref<(HTMLElement | null)[]>([])

// 设置Ref
const setChunkRef = (el: any, index: number) => {
  chunkRefs.value[index] = el as HTMLElement | null
}

// 计算属性
const formattedDate = computed(() => dayjs(picked.value).format('YYYY-MM-DD'))

// 将列表分割为9个一组
const chunks = computed(() => {
  const result = []
  for (let i = 0; i < list.value.length; i += 9) {
    result.push(list.value.slice(i, i + 9))
  }
  return result
})

// 监听列表变化，重置refs
watch(chunks, () => {
  chunkRefs.value = []
})

// 工具函数：获取图片URL
const getImageUrl = (path?: string) => {
  if (!path) return `${BASE_IMG}static/plan_cover/default.jpg`
  return `${BASE_IMG}${path}`
}

// 获取数据
const fetchData = async () => {
  loading.value = true
  list.value = []
  try {
    // pageSize: 999 获取全部
    const res = await getLibraryPipeList({
      page: 1,
      pageSize: 999,
      time: formattedDate.value
    })
    list.value = res.rows || []
  } catch (error) {
    console.error('Failed to fetch library pipe list:', error)
    useToast().add({ title: '获取数据失败', color: 'red' })
  } finally {
    loading.value = false
  }
}

// 截图功能
const { captureElement } = useScreenshot()

const downloadChunk = async (index: number) => {
  const element = chunkRefs.value[index]
  if (!element) return
  
  try {
    await captureElement(element, `上新_${formattedDate.value}_${index + 1}.png`, {
        scale: 2,
        backgroundColor: '#ffffff'
    })
  } catch (e) {
    console.error(e)
  }
}

const handleDownloadAll = async () => {
  if (chunks.value.length === 0) return
  isDownloading.value = true
  
  const toast = useToast()
  toast.add({ title: '开始批量下载...', color: 'blue' })

  try {
    // 串行下载，避免浏览器卡死
    for (let i = 0; i < chunks.value.length; i++) {
      if (chunkRefs.value[i]) {
        await downloadChunk(i)
        // 稍微等待一下，给浏览器喘息时间
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    toast.add({ title: '下载完成', color: 'green' })
  } catch (error) {
    console.error(error)
    toast.add({ title: '下载过程中出错', color: 'red' })
  } finally {
    isDownloading.value = false
  }
}

// 监听日期变化
const onChange = () => {
  fetchData()
}

// 初始化
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
/* 确保截图时样式一致 */
.aspect-\[3\/5\] {
  aspect-ratio: 3 / 5;
}
</style>