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
        <div v-if="generating" class="flex flex-col items-center justify-center h-full">
          <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500 mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400 font-medium">绘制美好回忆中...</p>
        </div>
        
        <!-- 海报容器：固定宽度 750px (2x mobile width) 以保证清晰度和布局一致性 -->
        <div class="relative shadow-2xl origin-top transform-gpu transition-transform duration-300" :style="previewStyle">
          <div 
            ref="posterRef"
            class="w-[750px] bg-[#fffcfc] text-gray-800 overflow-hidden relative"
          >
            <!-- 装饰背景 (使用绝对定位图片或 SVG，避免使用复杂 CSS 渐变) -->
            <div class="absolute inset-0 z-0 opacity-10 pointer-events-none">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
            
            <!-- 内容区域 -->
            <div class="relative z-10 p-12 flex flex-col items-center gap-8">
              <!-- Header -->
              <div class="text-center">
                <h1 class="text-6xl font-bold text-gray-900 mb-2 tracking-tight" style="font-family: serif;">{{ currentYear }}</h1>
                <div class="h-1 w-20 bg-pink-500 mx-auto mb-4"></div>
                <p class="text-xl text-gray-500 uppercase tracking-widest">Yearly Summary</p>
              </div>

              <!-- 核心数据卡片 -->
              <div class="w-full grid grid-cols-2 gap-6">
                <!-- 入坑 -->
                <div class="bg-white rounded-3xl p-6 shadow-lg border-2 border-pink-100 flex flex-col items-center justify-center aspect-square">
                  <span class="text-5xl mb-4">🎀</span>
                  <div class="text-center">
                    <p class="text-gray-500 text-sm mb-1">LO娘生涯</p>
                    <p class="text-4xl font-bold text-gray-800">
                      {{ summaryData.years_in_lolita }}<span class="text-lg ml-1 font-normal">年</span>
                    </p>
                  </div>
                </div>

                <!-- 消费 -->
                <div class="bg-pink-50 rounded-3xl p-6 shadow-lg border-2 border-pink-200 flex flex-col items-center justify-center aspect-square text-center">
                  <p class="text-pink-800/60 text-sm font-bold uppercase mb-2">Total</p>
                  <p class="text-4xl font-bold text-pink-600 break-all leading-tight">
                    <span class="text-2xl align-top">¥</span>{{ formatNumber(summaryData.total_spending) }}
                  </p>
                  <p class="text-xs text-pink-400 mt-2">为爱买单</p>
                </div>
              </div>

              <!-- 购买统计 -->
              <div class="w-full bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
                <h3 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                  <span>📊</span> 年度战利品
                </h3>
                <div class="flex justify-between px-4">
                  <div v-for="(stat, index) in summaryData.purchase_stats" :key="index" class="text-center">
                    <div class="text-3xl font-bold text-gray-800 mb-1">{{ stat.value }}</div>
                    <div class="text-sm text-gray-500">{{ stat.label }}</div>
                  </div>
                </div>
              </div>

              <!-- 图片展示 Section (复用逻辑但简化样式以适应 html2canvas) -->
              <div v-if="hasItems" class="w-full space-y-8">
                <!-- Latest Dress -->
                <div v-if="summaryData.latest_dress?.length" class="w-full">
                  <h3 class="text-xl font-bold text-gray-800 mb-4 px-2 border-l-4 border-pink-500">最新的裙子</h3>
                  <div class="grid grid-cols-4 gap-3">
                    <div v-for="item in summaryData.latest_dress.slice(0, 4)" :key="item.clothes_id" class="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden relative">
                       <img 
                        :src="getImageUrl(item.clothes_img)"
                        crossorigin="anonymous"
                        class="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <!-- Most Worn -->
                <div v-if="summaryData.most_worn?.length" class="w-full">
                  <h3 class="text-xl font-bold text-gray-800 mb-4 px-2 border-l-4 border-purple-500">穿着率最高</h3>
                  <div class="grid grid-cols-4 gap-3">
                    <div v-for="item in summaryData.most_worn.slice(0, 4)" :key="item.clothes_id" class="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden relative">
                       <img 
                        :src="getImageUrl(item.clothes_img)"
                        crossorigin="anonymous"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center">
                        {{ item.times }}次
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="w-full text-center mt-4 pt-8 border-t border-dashed border-gray-300">
                <div class="flex items-center justify-center gap-2 text-gray-400 text-sm tracking-widest uppercase">
                  <span>Lo研社</span>
                  <span>·</span>
                  <span>Lolita Fashion</span>
                </div>
                <div class="mt-2 w-32 h-32 bg-gray-100 mx-auto rounded-lg flex items-center justify-center text-gray-400 text-xs">
                  (QRCode)
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
          class="px-8 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {{ generating ? '生成中...' : '保存图片' }}
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

// 计算预览缩放比例，适应屏幕
const updateScale = () => {
  if (window.innerWidth < 800) {
    scale.value = (window.innerWidth - 48) / 750
  } else {
    scale.value = 1
  }
}

const previewStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  marginBottom: window.innerWidth < 800 ? `-${(750 * (1 - scale.value))}px` : '0' // 修正缩放后的空白
}))

const hasItems = computed(() => {
  return !!(
    (props.summaryData.latest_dress && props.summaryData.latest_dress.length > 0) ||
    (props.summaryData.most_worn && props.summaryData.most_worn.length > 0)
  )
})

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

const getImageUrl = (url: string) => {
  if (!url) return ''
  // 确保使用 HTTPS
  const fullUrl = `${BASE_IMG}${url.replace(BASE_IMG, '')}`.replace('http://', 'https://')
  // 添加图片处理参数减小体积但保证清晰度
  return `${fullUrl}?x-oss-process=image/quality,q_80/resize,w_300`
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
    await nextTick()
    
    // 强制所有图片加载检查
    const images = Array.from(posterRef.value.querySelectorAll('img'))
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise(resolve => {
        img.onload = resolve
        img.onerror = resolve
        setTimeout(resolve, 5000) // 5s 超时
      })
    }))
    
    // 额外缓冲
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const fileName = `Lo研社_年度总结_${props.currentYear}.png`
    
    await captureElement(posterRef.value, fileName, {
      scale: 2, // 导出 2x 清晰度 (1500px width)
      backgroundColor: '#fffcfc'
    })
    
    // 成功提示 (如果没有 toast，这里 console 即可，或者用 alert)
    console.log('海报生成成功')
    
  } catch (error) {
    console.error('生成海报失败:', error)
    alert('生成失败，请重试')
  } finally {
    generating.value = false
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