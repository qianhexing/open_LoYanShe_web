<template>
  <QhxModal :model-value="modelValue" @update:model-value="handleUpdate" @close="handleClose">
    <div class="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden max-w-4xl w-full h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10 bg-white dark:bg-gray-800">
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">生成分享图</h3>
        <button
          @click="handleClose"
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 预览区域 -->
      <div class="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4 md:p-8">
        <div v-if="generating" class="flex flex-col items-center justify-center h-full absolute inset-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500 mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400 font-medium">正在绘制美好回忆...</p>
          <p class="text-xs text-gray-400 mt-2">处理图片可能需要一点时间</p>
        </div>
        
        <!-- 海报容器：固定宽度 750px (2x mobile width) -->
        <div class="relative shadow-2xl origin-top transform-gpu transition-transform duration-300" :style="previewStyle">
          <div 
            ref="posterRef"
            class="w-[750px] bg-[#fffcfc] text-gray-800 overflow-hidden relative pb-12"
          >
            <!-- 装饰背景 -->
            <div class="absolute inset-0 z-0 pointer-events-none">
              <!-- 顶部渐变 -->
              <div class="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-pink-50 to-transparent"></div>
              
              <!-- 装饰圆点 -->
              <div class="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-purple-100 rounded-full blur-3xl opacity-50"></div>
              <div class="absolute top-[400px] left-[-100px] w-[300px] h-[300px] bg-pink-100 rounded-full blur-3xl opacity-50"></div>
              
              <!-- 网格纹理 -->
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="opacity-[0.03]">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
            
            <!-- 内容区域 -->
            <div class="relative z-10 p-10 flex flex-col gap-8">
              <!-- Header: 保持与页面相似的排版 -->
              <div class="text-center mt-8">
                <h1 class="text-[80px] font-bold text-gray-800 leading-none tracking-tighter" style="font-family: serif;">
                  {{ currentYear }}
                </h1>
                <div class="flex items-center justify-center gap-4 mt-2">
                  <div class="h-[1px] w-12 bg-gray-300"></div>
                  <p class="text-xl text-pink-500 font-medium tracking-widest uppercase">Yearly Summary</p>
                  <div class="h-[1px] w-12 bg-gray-300"></div>
                </div>
                <p class="text-sm text-gray-400 mt-2 tracking-[0.3em] uppercase">Lolita Fashion Journey</p>
              </div>

              <!-- 核心数据卡片 -->
              <div class="grid grid-cols-3 gap-6">
                <!-- 入坑 -->
                <div class="col-span-1 bg-white/80 rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center aspect-square text-center">
                  <span class="text-5xl mb-4 filter drop-shadow-sm">🕰️</span>
                  <p class="text-gray-400 text-xs mb-1 uppercase tracking-wider">Since</p>
                  <p class="text-4xl font-bold text-gray-800 font-serif">
                    {{ summaryData.years_in_lolita }}<span class="text-base ml-1 font-sans font-normal text-gray-500">年</span>
                  </p>
                </div>

                <!-- 消费 (占据2列) -->
                <div class="col-span-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[2rem] p-8 shadow-md text-white flex flex-col justify-between relative overflow-hidden">
                  <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
                  <p class="text-pink-100 text-sm font-medium uppercase tracking-widest z-10">Total Spending</p>
                  <div class="z-10 mt-2">
                    <p class="text-5xl font-bold leading-none">
                      <span class="text-2xl opacity-80 align-top mr-1">¥</span>{{ formatNumber(summaryData.total_spending) }}
                    </p>
                  </div>
                  <p class="text-pink-100/80 text-xs mt-4 z-10">每一分热爱都值得铭记</p>
                </div>
              </div>

              <!-- 购买统计 -->
              <div class="bg-white/80 rounded-[2rem] p-8 shadow-sm border border-gray-100">
                <h3 class="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span class="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                  年度战利品
                </h3>
                <div class="flex justify-between px-2">
                  <div v-for="(stat, index) in summaryData.purchase_stats" :key="index" class="flex flex-col items-center">
                    <div class="text-3xl font-bold text-gray-800 mb-1 font-serif">{{ stat.value }}</div>
                    <div class="text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full">{{ stat.label }}</div>
                  </div>
                </div>
              </div>

              <!-- 图片展示 Section -->
              <div class="space-y-8">
                <!-- Latest Dress -->
                <div v-if="summaryData.latest_dress?.length" class="w-full">
                  <div class="flex items-center gap-3 mb-5 px-2">
                    <span class="text-2xl">👗</span>
                    <h3 class="text-xl font-bold text-gray-800 font-serif">最新的裙子</h3>
                  </div>
                  <div class="grid grid-cols-4 gap-4">
                    <div 
                      v-for="item in summaryData.latest_dress.slice(0, 4)" 
                      :key="item.clothes_id" 
                      class="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                    >
                       <div class="aspect-[3/4] overflow-hidden bg-gray-50">
                         <img 
                          :src="getImageUrl(item.clothes_img)"
                          class="w-full h-full object-cover poster-image"
                          crossorigin="anonymous"
                        />
                       </div>
                       <div class="p-3 bg-white">
                         <div class="text-[10px] text-gray-500 line-clamp-1 mb-1">{{ item.clothes_note }}</div>
                         <div class="text-xs font-bold text-pink-500">¥{{ formatNumber(item.price) }}</div>
                       </div>
                    </div>
                  </div>
                </div>

                <!-- Most Worn -->
                <div v-if="summaryData.most_worn?.length" class="w-full">
                  <div class="flex items-center gap-3 mb-5 px-2">
                    <span class="text-2xl">⭐</span>
                    <h3 class="text-xl font-bold text-gray-800 font-serif">穿着率最高</h3>
                  </div>
                  <div class="grid grid-cols-4 gap-4">
                    <div 
                      v-for="item in summaryData.most_worn.slice(0, 4)" 
                      :key="item.clothes_id" 
                      class="relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                    >
                       <div class="aspect-[3/4] overflow-hidden bg-gray-50">
                         <img 
                          :src="getImageUrl(item.clothes_img)"
                          class="w-full h-full object-cover poster-image"
                          crossorigin="anonymous"
                        />
                       </div>
                       <div class="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm">
                         <span class="text-xs font-bold text-gray-800">{{ item.times }}次</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 底部黑名单 (如果有) -->
              <div v-if="summaryData.blacklisted_shops?.length" class="bg-red-50 rounded-[2rem] p-6 border border-red-100">
                <div class="flex items-center justify-center gap-2 mb-4 text-red-800/70 font-bold">
                  <span>⛔</span>
                  <span>避雷指南</span>
                </div>
                <div class="flex flex-wrap justify-center gap-4">
                  <span 
                    v-for="shop in summaryData.blacklisted_shops" 
                    :key="shop.shop_id"
                    class="px-3 py-1 bg-white text-gray-600 text-xs rounded-full border border-red-100"
                  >
                    {{ shop.shop_name }}
                  </span>
                </div>
              </div>

              <!-- Footer -->
              <div class="mt-8 pt-8 border-t border-dashed border-gray-300 text-center">
                <div class="inline-flex items-center gap-3 px-6 py-2 bg-gray-900 text-white rounded-full">
                  <span class="font-serif italic">Lo研社</span>
                  <span class="w-1 h-1 bg-gray-500 rounded-full"></span>
                  <span class="text-xs tracking-widest uppercase">My Lolita Summary</span>
                </div>
                <div class="mt-4 text-[10px] text-gray-400">
                  Generated at {{ new Date().toLocaleDateString() }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
        <button
          @click="handleClose"
          class="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="generatePoster"
          :disabled="generating"
          class="px-8 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
        >
          <span v-if="!generating">保存图片</span>
          <span v-else>处理中...</span>
        </button>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { YearlySummaryData } from '@/api/yearlySummary'
import { useScreenshot } from '@/composables/useScreenshot'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps<{
  modelValue: boolean
  summaryData: YearlySummaryData
  currentYear: number
}>()

const emit = defineEmits(['update:modelValue'])

const { captureElement } = useScreenshot()
const posterRef = ref<HTMLElement | null>(null)
const generating = ref(false)
const scale = ref(1)

// 图片 Base64 缓存
const imageCache = ref<Record<string, string>>({})

// 计算预览缩放比例，适应屏幕
const updateScale = () => {
  if (typeof window === 'undefined') return
  const isMobile = window.innerWidth < 800
  // 留出 padding
  const availableWidth = window.innerWidth - (isMobile ? 32 : 64)
  if (availableWidth < 750) {
    scale.value = availableWidth / 750
  } else {
    scale.value = 1
  }
}

const previewStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  marginBottom: `-${(750 * (1 - scale.value))}px` // 修正缩放后的空白
}))

const formatNumber = (num: number): string => {
  return num?.toLocaleString('zh-CN') || '0'
}

// 图片转 Base64 工具
const urlToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = url
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        try {
          const dataURL = canvas.toDataURL('image/png')
          resolve(dataURL)
        } catch (e) {
          // 如果 tainted，这里会报错，说明服务器不支持 CORS
          console.warn('Image tainted, returning original url', e)
          resolve(url)
        }
      } else {
        resolve(url)
      }
    }
    img.onerror = (e) => {
      console.warn('Image load failed', url, e)
      resolve(url)
    }
  })
}

// 获取图片 URL，优先使用缓存的 Base64
const getImageUrl = (url: string) => {
  if (!url) return ''
  const fullUrl = `${BASE_IMG}${url.replace(BASE_IMG, '')}`.replace('http://', 'https://')
  const processedUrl = `${fullUrl}?x-oss-process=image/quality,q_80/resize,w_300`
  
  // 如果生成中且有缓存，返回 base64
  if (generating.value && imageCache.value[processedUrl]) {
    return imageCache.value[processedUrl]
  }
  
  return processedUrl
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleUpdate = (value: boolean) => {
  emit('update:modelValue', value)
}

const generatePoster = async () => {
  if (!posterRef.value || generating.value) return

  try {
    generating.value = true
    
    // 1. 预处理所有图片为 Base64
    const images = Array.from(posterRef.value.querySelectorAll('img.poster-image'))
    const tasks = images.map(async (img) => {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('data:')) {
        try {
          const base64 = await urlToBase64(src)
          imageCache.value[src] = base64
        } catch (e) {
          console.error('Failed to convert image', src)
        }
      }
    })
    
    await Promise.all(tasks)
    
    // 2. 等待 Vue 更新 DOM (此时 getImageUrl 会返回 Base64)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500)) // 额外等待渲染
    
    // 3. 截图
    const fileName = `Lo研社_年度总结_${props.currentYear}.png`
    await captureElement(posterRef.value, fileName, {
      scale: 2, 
      backgroundColor: '#fffcfc'
    })
    
  } catch (error) {
    console.error('生成海报失败:', error)
    alert('生成失败，可能是网络原因或图片跨域限制')
  } finally {
    generating.value = false
    // 清理缓存，恢复显示原图URL，减轻内存压力
    imageCache.value = {} 
  }
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    generating.value = false
    nextTick(() => updateScale())
  }
})
</script>

<style scoped>
/* 确保字体加载 */
.font-serif {
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
</style>