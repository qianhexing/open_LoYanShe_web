<template>
  <QhxModal :model-value="modelValue" @update:model-value="handleUpdate" @close="handleClose">
    <div class="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
      <div class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
        <div v-if="generating" class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500 mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">正在生成海报...</p>
        </div>
        
        <div 
          v-else
          ref="posterRef"
          class="poster-container bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 mx-auto rounded-2xl overflow-hidden"
          :style="{ width: posterWidth + 'px', maxWidth: '100%' }"
        >
          <!-- 海报内容 -->
          <div class="p-8 md:p-12">
            <!-- 标题 -->
            <div class="text-center mb-8">
              <h1 class="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                {{ currentYear }}年度总结
              </h1>
              <p class="text-xl text-gray-600 dark:text-gray-300">记录你的Lolita时尚之旅 ✨</p>
            </div>

            <!-- 入坑年数 -->
            <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 mb-6 border-2 border-pink-200 dark:border-pink-800">
              <div class="flex items-center justify-center mb-4">
                <div class="w-20 h-20 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                  <span class="text-4xl">🎀</span>
                </div>
              </div>
              <h2 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">
                入坑 {{ summaryData.years_in_lolita }} 年
              </h2>
            </div>

            <!-- 消费统计 -->
            <div class="bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900 dark:to-purple-900 rounded-3xl shadow-xl p-6 mb-6 border-2 border-pink-300 dark:border-pink-700">
              <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">
                💰 今年共消费
              </h2>
              <div class="text-center">
                <div class="text-5xl font-bold text-pink-600 dark:text-pink-400 mb-2">
                  ¥{{ formatNumber(summaryData.total_spending) }}
                </div>
              </div>
            </div>

            <!-- 购买统计 -->
            <div 
              v-if="summaryData.purchase_stats && summaryData.purchase_stats.length > 0"
              class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 mb-6 border-2 border-pink-200 dark:border-pink-800"
            >
              <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
                📊 今年共买
              </h2>
              <div class="grid grid-cols-3 gap-4">
                <div
                  v-for="(stat, index) in summaryData.purchase_stats"
                  :key="index"
                  class="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900 dark:to-purple-900 rounded-2xl p-4 text-center border border-pink-200 dark:border-pink-700"
                >
                  <div class="text-3xl font-bold text-pink-600 dark:text-pink-400 mb-1">
                    {{ stat.value }}
                  </div>
                  <div class="text-base text-gray-700 dark:text-gray-300">
                    {{ stat.label }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 服饰展示区域 -->
            <div v-if="hasItems" class="space-y-6">
              <!-- 最新的裙子 -->
              <PosterSection
                v-if="summaryData.latest_dress && summaryData.latest_dress.length > 0"
                title="👗 最新的裙子"
                :items="summaryData.latest_dress.slice(0, 4)"
              />

              <!-- 最喜欢的小物 -->
              <PosterSection
                v-if="summaryData.favorite_accessories && summaryData.favorite_accessories.length > 0"
                title="💍 最喜欢的小物"
                :items="summaryData.favorite_accessories.slice(0, 4)"
              />

              <!-- 最喜欢的袜子 -->
              <PosterSection
                v-if="summaryData.favorite_socks && summaryData.favorite_socks.length > 0"
                title="🧦 最喜欢的袜子"
                :items="summaryData.favorite_socks.slice(0, 4)"
              />

              <!-- 最喜欢的包包 -->
              <PosterSection
                v-if="summaryData.favorite_bags && summaryData.favorite_bags.length > 0"
                title="👜 最喜欢的包包"
                :items="summaryData.favorite_bags.slice(0, 4)"
              />

              <!-- 穿着率最高的 -->
              <PosterSection
                v-if="summaryData.most_worn && summaryData.most_worn.length > 0"
                title="⭐ 穿着率最高的"
                :items="summaryData.most_worn.slice(0, 4)"
              />
            </div>

            <!-- 拉黑的店铺 -->
            <div 
              v-if="summaryData.blacklisted_shops && summaryData.blacklisted_shops.length > 0"
              class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 border-2 border-red-200 dark:border-red-800"
            >
              <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
                ⛔ 今年拉黑的店铺
              </h2>
              <div class="grid grid-cols-3 gap-4">
                <div
                  v-for="shop in summaryData.blacklisted_shops.slice(0, 6)"
                  :key="shop.shop_id"
                  class="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900 dark:to-pink-900 rounded-2xl p-4 border border-red-200 dark:border-red-700 text-center"
                >
                  <div v-if="shop.shop_logo" class="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden">
                    <img 
                      :src="`${BASE_IMG}${shop.shop_logo.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_60/resize,w_150`"
                      :alt="shop.shop_name"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {{ shop.shop_name }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部信息 -->
            <div class="text-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">
              <p>Lo研社 - {{ currentYear }}年度总结</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="handleClose"
          class="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="generatePoster"
          :disabled="generating"
          class="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ generating ? '生成中...' : '生成并下载' }}
        </button>
      </div>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { YearlySummaryData } from '@/api/yearlySummary'
import { useScreenshot } from '@/composables/useScreenshot'

const props = defineProps<{
  modelValue: boolean
  summaryData: YearlySummaryData
  currentYear: number
}>()

const emit = defineEmits(['update:modelValue'])

const { captureElement } = useScreenshot()
const posterRef = ref<HTMLElement | null>(null)
const generating = ref(false)

// 海报宽度（移动端和PC端不同）
const posterWidth = computed(() => {
  if (typeof window === 'undefined') return 800
  return window.innerWidth < 768 ? 600 : 800
})

const hasItems = computed(() => {
  return !!(
    (props.summaryData.latest_dress && props.summaryData.latest_dress.length > 0) ||
    (props.summaryData.favorite_accessories && props.summaryData.favorite_accessories.length > 0) ||
    (props.summaryData.favorite_socks && props.summaryData.favorite_socks.length > 0) ||
    (props.summaryData.favorite_bags && props.summaryData.favorite_bags.length > 0) ||
    (props.summaryData.most_worn && props.summaryData.most_worn.length > 0)
  )
})

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
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
    
    // 等待DOM更新
    await nextTick()
    
    // 等待所有图片加载完成
    const images = posterRef.value.querySelectorAll('img')
    const imagePromises = Array.from(images).map((img: HTMLImageElement) => {
      if (img.complete) {
        return Promise.resolve()
      }
      return new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = resolve // 即使失败也继续
        setTimeout(resolve, 3000) // 超时保护
      })
    })
    
    await Promise.all(imagePromises)
    
    // 额外等待确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 生成文件名
    const fileName = `年度总结_${props.currentYear}_${Date.now()}.png`
    
    // 截图并下载（使用高质量设置）
    await captureElement(posterRef.value, fileName, {
      scale: 2,
      backgroundColor: '#ffffff'
    })
    
    // 显示成功提示
    const toast = useToast()
    toast.add({
      title: '成功',
      description: '海报已生成并下载',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('生成海报失败:', error)
    const toast = useToast()
    toast.add({
      title: '错误',
      description: '生成海报失败，请重试',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    generating.value = false
  }
}

// 监听弹窗打开，重置状态
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    generating.value = false
  }
})
</script>

<style scoped>
.poster-container {
  min-height: 600px;
}
</style>

