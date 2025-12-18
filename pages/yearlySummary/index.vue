<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center min-h-screen">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
        <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">Loading Memories...</p>
    </div>

    <!-- 主要内容 -->
    <div v-else class="relative z-10 pb-32">
      <!-- 顶部 Header -->
      <header class="pt-20 pb-12 px-4 text-center relative">
        <div class="inline-block relative">
          <h1 
            ref="titleRef"
            class="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent tracking-tight"
          >
            {{ currentYear }}
          </h1>
          <span class="absolute -top-6 -right-8 text-2xl animate-bounce">✨</span>
        </div>
        <div ref="subtitleRef" class="space-y-2">
          <p class="text-xl md:text-2xl text-pink-500 dark:text-pink-400 font-medium tracking-wide">
            Yearly Summary
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
            Lolita Fashion Journey
          </p>
        </div>
      </header>

      <!-- 核心数据网格 -->
      <div class="max-w-5xl mx-auto px-4 md:px-8 mb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- 入坑时间 -->
          <div 
            ref="yearsCardRef"
            class="lg:col-span-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700 flex flex-col items-center justify-center text-center group hover:-translate-y-1 transition-transform duration-300"
          >
            <div class="w-16 h-16 bg-pink-50 dark:bg-pink-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span class="text-3xl">🕰️</span>
            </div>
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-1">入坑时长</p>
            <h3 class="text-4xl font-bold text-gray-800 dark:text-gray-100">
              <span class="counter">{{ summaryData.years_in_lolita }}</span>
              <span class="text-lg ml-1 font-normal">年</span>
            </h3>
          </div>

          <!-- 年度消费 -->
          <div 
            ref="spendingCardRef"
            class="lg:col-span-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[2rem] p-8 shadow-xl text-white relative overflow-hidden group"
          >
            <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
            <div class="relative z-10 flex flex-col justify-between h-full">
              <div>
                <p class="text-pink-100 text-sm font-medium uppercase tracking-wider mb-2">Total Spending</p>
                <h3 class="text-5xl md:text-6xl font-bold mb-1">
                  <span class="text-3xl align-top opacity-80">¥</span>
                  <span class="counter">{{ formatNumber(summaryData.total_spending) }}</span>
                </h3>
              </div>
              <p class="text-pink-100/80 text-sm mt-4">为热爱买单的每一分，都变成了更好的自己</p>
            </div>
          </div>

          <!-- 购买统计 -->
          <div 
            ref="purchaseCardRef"
            class="lg:col-span-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700"
          >
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>年度战利品</span>
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div 
                v-for="(stat, index) in summaryData.purchase_stats" 
                :key="index"
                class="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
              >
                <span class="text-2xl font-bold text-gray-800 dark:text-gray-100 counter">{{ stat.value }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ stat.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细列表区域 -->
      <div class="max-w-5xl mx-auto px-4 md:px-8 space-y-16">
        <YearlySummarySection
          v-if="summaryData.latest_dress?.length"
          title="最新的裙子"
          icon="👗"
          :items="summaryData.latest_dress"
          :delay="0.2"
        />

        <YearlySummarySection
          v-if="summaryData.favorite_accessories?.length"
          title="最喜欢的小物"
          icon="💍"
          :items="summaryData.favorite_accessories"
          :delay="0.3"
        />
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
           <YearlySummarySection
            v-if="summaryData.favorite_socks?.length"
            title="最喜欢的袜子"
            icon="🧦"
            :items="summaryData.favorite_socks"
            :delay="0.4"
          />

           <YearlySummarySection
            v-if="summaryData.favorite_bags?.length"
            title="最喜欢的包包"
            icon="👜"
            :items="summaryData.favorite_bags"
            :delay="0.5"
          />
        </div>

        <YearlySummarySection
          v-if="summaryData.most_worn?.length"
          title="穿着率最高的"
          icon="⭐"
          :items="summaryData.most_worn"
          :delay="0.6"
        />

        <!-- 拉黑店铺 -->
        <div 
          v-if="summaryData.blacklisted_shops?.length"
          ref="blacklistRef"
          class="bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md rounded-[2rem] p-8 shadow-lg border border-red-100 dark:border-red-900/50"
        >
          <div class="flex items-center gap-2 mb-6 justify-center">
            <span class="text-2xl">⛔</span>
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">避雷指南</h2>
          </div>
          <div class="flex flex-wrap justify-center gap-6">
            <div
              v-for="shop in summaryData.blacklisted_shops"
              :key="shop.shop_id"
              class="flex flex-col items-center gap-2 group"
            >
              <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-red-200 dark:border-red-800 shadow-sm group-hover:scale-110 transition-transform">
                <img 
                  :src="`${BASE_IMG}${shop.shop_logo.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_60/resize,w_150`"
                  :alt="shop.shop_name"
                  class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                />
              </div>
              <span class="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-red-500 transition-colors">
                {{ shop.shop_name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 FAB -->
      <div class="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <button
          @click="showPosterModal = true"
          class="pointer-events-auto bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <span class="text-xl group-hover:rotate-12 transition-transform">📸</span>
          <span class="font-bold tracking-wide">生成年度分享图</span>
        </button>
      </div>
    </div>

    <!-- 海报弹窗 -->
    <YearlySummaryPoster
      v-model="showPosterModal"
      :summary-data="summaryData"
      :current-year="currentYear"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import type { YearlySummaryData } from '@/api/yearlySummary'
import { BASE_IMG } from '@/utils/ipConfig'

const { $gsap } = useNuxtApp()

const loading = ref(true)
const summaryData = ref<YearlySummaryData>({
  years_in_lolita: 0,
  total_spending: 0,
  purchase_stats: []
})

const currentYear = computed(() => new Date().getFullYear())

// Refs
const titleRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const yearsCardRef = ref<HTMLElement | null>(null)
const spendingCardRef = ref<HTMLElement | null>(null)
const purchaseCardRef = ref<HTMLElement | null>(null)
const blacklistRef = ref<HTMLElement | null>(null)

const showPosterModal = ref(false)

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

// 模拟数据 (保留原有逻辑)
const getMockData = (): YearlySummaryData => {
  const baseImageUrl = 'static/library_app/20986_176590718554587.JPG'
  
  return {
    years_in_lolita: 5,
    total_spending: 25888,
    purchase_stats: [
      { label: '裙子', value: 15 },
      { label: '小物', value: 12 },
      { label: '袜子', value: 20 },
      { label: '包包', value: 8 },
      { label: '鞋子', value: 6 }
    ],
    latest_dress: Array(4).fill({
      clothes_id: 1,
      wardrobe_id: 1,
      clothes_img: baseImageUrl,
      clothes_note: '甜美系粉色OP',
      price: 888,
      times: 5,
      date: new Date(),
      is_enable: 1
    }).map((item, i) => ({ ...item, clothes_id: i + 1 })),
    favorite_accessories: Array(4).fill({
      clothes_id: 5,
      wardrobe_id: 1,
      clothes_img: baseImageUrl,
      clothes_note: '蕾丝发带',
      price: 88,
      times: 25,
      date: new Date(),
      is_enable: 1
    }).map((item, i) => ({ ...item, clothes_id: i + 5 })),
    favorite_socks: Array(4).fill({
      clothes_id: 9,
      wardrobe_id: 1,
      clothes_img: baseImageUrl,
      clothes_note: '白色蕾丝袜',
      price: 68,
      times: 35,
      date: new Date(),
      is_enable: 1
    }).map((item, i) => ({ ...item, clothes_id: i + 9 })),
    favorite_bags: Array(4).fill({
      clothes_id: 13,
      wardrobe_id: 1,
      clothes_img: baseImageUrl,
      clothes_note: '粉色手提包',
      price: 388,
      times: 18,
      date: new Date(),
      is_enable: 1
    }).map((item, i) => ({ ...item, clothes_id: i + 13 })),
    most_worn: Array(4).fill({
      clothes_id: 17,
      wardrobe_id: 1,
      clothes_img: baseImageUrl,
      clothes_note: '经典款粉色OP',
      price: 988,
      times: 45,
      date: new Date(),
      is_enable: 1
    }).map((item, i) => ({ ...item, clothes_id: i + 17 })),
    blacklisted_shops: [
      {
        shop_id: 1,
        shop_name: 'XX店铺',
        shop_logo: baseImageUrl,
        shop_country: 1
      },
      {
        shop_id: 2,
        shop_name: 'YY店铺',
        shop_logo: baseImageUrl,
        shop_country: 1
      },
      {
        shop_id: 3,
        shop_name: 'ZZ店铺',
        shop_logo: baseImageUrl,
        shop_country: 1
      }
    ]
  }
}

const loadData = async () => {
  try {
    loading.value = true
    await new Promise(resolve => setTimeout(resolve, 800))
    summaryData.value = getMockData()
  } catch (error) {
    console.error(error)
    summaryData.value = getMockData()
  } finally {
    loading.value = false
    await nextTick()
    initAnimations()
  }
}

const initAnimations = () => {
  if (!$gsap) return

  const tl = $gsap.timeline()

  // Header 动画
  tl.from(titleRef.value, {
    y: 50,
    opacity: 0,
    duration: 1,
    ease: 'power4.out'
  })
  .from(subtitleRef.value, {
    y: 20,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out'
  }, '-=0.5')

  // 卡片入场
  const cards = [yearsCardRef.value, spendingCardRef.value, purchaseCardRef.value]
  
  $gsap.from(cards, {
    y: 50,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out',
    delay: 0.5
  })

  // 数字增长动画
  const counters = document.querySelectorAll('.counter')
  counters.forEach(counter => {
    // 简单的数字增长，不需要复杂插件
    const el = counter as HTMLElement
    const target = parseInt(el.textContent?.replace(/,/g, '') || '0')
    const obj = { val: 0 }
    
    $gsap.to(obj, {
      val: target,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => {
        el.innerText = Math.floor(obj.val).toLocaleString('zh-CN')
      },
      delay: 0.8 // 稍晚于卡片出现
    })
  })
}

onMounted(() => {
  loadData()
})

useHead({
  title: `${currentYear.value}年度总结 - Lo研社`,
})
</script>

<style scoped>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
</style>