<template>
  <div class="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500 mx-auto mb-4"></div>
        <p class="text-pink-600 dark:text-pink-400 text-lg">加载年度总结中...</p>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else ref="summaryContainer" class="pb-20">
      <!-- 顶部标题区域 -->
      <div class="relative overflow-hidden pt-8 pb-12 px-4 md:px-8">
        <div class="max-w-4xl mx-auto text-center">
          <h1 
            ref="titleRef"
            class="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
          >
            {{ currentYear }}年度总结
          </h1>
          <p 
            ref="subtitleRef"
            class="text-lg md:text-xl text-gray-600 dark:text-gray-300"
          >
            记录你的Lolita时尚之旅 ✨
          </p>
        </div>
        <!-- 装饰性元素 -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div class="decoration-1 absolute top-10 left-10 w-20 h-20 bg-pink-200 dark:bg-pink-900 rounded-full opacity-20 blur-xl"></div>
          <div class="decoration-2 absolute top-20 right-20 w-32 h-32 bg-purple-200 dark:bg-purple-900 rounded-full opacity-20 blur-xl"></div>
          <div class="decoration-3 absolute bottom-10 left-1/4 w-16 h-16 bg-pink-300 dark:bg-pink-800 rounded-full opacity-15 blur-lg"></div>
        </div>
      </div>

      <!-- 数据卡片区域 -->
      <div class="max-w-4xl mx-auto px-4 md:px-8 space-y-8">
        <!-- 入坑年数 -->
        <div 
          ref="yearsCardRef"
          class="card-animate bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 md:p-8 border-2 border-pink-200 dark:border-pink-800"
        >
          <div class="flex items-center justify-center mb-4">
            <div class="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
              <span class="text-3xl md:text-4xl">🎀</span>
            </div>
          </div>
          <h2 class="text-2xl md:text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">
            入坑 {{ summaryData.years_in_lolita }} 年
          </h2>
          <p class="text-center text-gray-600 dark:text-gray-400">
            感谢你陪伴Lolita时尚走过的每一天
          </p>
        </div>

        <!-- 消费统计 -->
        <div 
          ref="spendingCardRef"
          class="card-animate bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900 dark:to-purple-900 rounded-3xl shadow-xl p-6 md:p-8 border-2 border-pink-300 dark:border-pink-700"
        >
          <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">
            💰 今年共消费
          </h2>
          <div class="text-center">
            <div class="text-4xl md:text-6xl font-bold text-pink-600 dark:text-pink-400 mb-2">
              ¥{{ formatNumber(summaryData.total_spending) }}
            </div>
            <p class="text-gray-600 dark:text-gray-400">每一分都是对美好的投资</p>
          </div>
        </div>

        <!-- 购买统计 -->
        <div 
          v-if="summaryData.purchase_stats && summaryData.purchase_stats.length > 0"
          ref="purchaseCardRef"
          class="card-animate bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 md:p-8 border-2 border-pink-200 dark:border-pink-800"
        >
          <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
            📊 今年共买
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="(stat, index) in summaryData.purchase_stats"
              :key="index"
              class="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900 dark:to-purple-900 rounded-2xl p-4 text-center border border-pink-200 dark:border-pink-700"
            >
              <div class="text-2xl md:text-3xl font-bold text-pink-600 dark:text-pink-400 mb-1">
                {{ stat.value }}
              </div>
              <div class="text-sm md:text-base text-gray-700 dark:text-gray-300">
                {{ stat.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 最新的裙子 -->
        <YearlySummarySection
          v-if="summaryData.latest_dress && summaryData.latest_dress.length > 0"
          ref="latestDressRef"
          title="👗 最新的裙子"
          :items="summaryData.latest_dress"
          :delay="0.4"
        />

        <!-- 最喜欢的小物 -->
        <YearlySummarySection
          v-if="summaryData.favorite_accessories && summaryData.favorite_accessories.length > 0"
          ref="favoriteAccessoriesRef"
          title="💍 最喜欢的小物"
          :items="summaryData.favorite_accessories"
          :delay="0.5"
        />

        <!-- 最喜欢的袜子 -->
        <YearlySummarySection
          v-if="summaryData.favorite_socks && summaryData.favorite_socks.length > 0"
          ref="favoriteSocksRef"
          title="🧦 最喜欢的袜子"
          :items="summaryData.favorite_socks"
          :delay="0.6"
        />

        <!-- 最喜欢的包包 -->
        <YearlySummarySection
          v-if="summaryData.favorite_bags && summaryData.favorite_bags.length > 0"
          ref="favoriteBagsRef"
          title="👜 最喜欢的包包"
          :items="summaryData.favorite_bags"
          :delay="0.7"
        />

        <!-- 穿着率最高的 -->
        <YearlySummarySection
          v-if="summaryData.most_worn && summaryData.most_worn.length > 0"
          ref="mostWornRef"
          title="⭐ 穿着率最高的"
          :items="summaryData.most_worn"
          :delay="0.8"
        />

        <!-- 拉黑的店铺 -->
        <div 
          v-if="summaryData.blacklisted_shops && summaryData.blacklisted_shops.length > 0"
          ref="blacklistRef"
          class="card-animate bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 md:p-8 border-2 border-red-200 dark:border-red-800"
        >
          <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
            ⛔ 今年拉黑的店铺
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="(shop, index) in summaryData.blacklisted_shops"
              :key="shop.shop_id"
              class="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900 dark:to-pink-900 rounded-2xl p-4 border border-red-200 dark:border-red-700"
            >
              <div v-if="shop.shop_logo" class="w-16 h-16 mx-auto mb-2 rounded-full overflow-hidden">
                <img 
                  :src="`${BASE_IMG}${shop.shop_logo.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_60/resize,w_150`"
                  :alt="shop.shop_name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="text-center text-sm md:text-base font-semibold text-gray-800 dark:text-gray-100">
                {{ shop.shop_name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 生成海报按钮 -->
      <div class="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <button
          @click="showPosterModal = true"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-4 px-8 rounded-full shadow-2xl transform transition-all duration-300 hover:scale-110 active:scale-95 flex items-center gap-2"
        >
          <span class="text-xl">📸</span>
          <span class="text-lg">生成分享图</span>
        </button>
      </div>
    </div>

    <!-- 海报生成弹窗 -->
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

// 动画引用
const summaryContainer = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const yearsCardRef = ref<HTMLElement | null>(null)
const spendingCardRef = ref<HTMLElement | null>(null)
const purchaseCardRef = ref<HTMLElement | null>(null)
const blacklistRef = ref<HTMLElement | null>(null)

const showPosterModal = ref(false)

// 格式化数字
const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

// 模拟数据
const getMockData = (): YearlySummaryData => {
  const baseImageUrl = 'https://lolitalibrary.com/ali/static/library_app/20986_176590718554587.JPG'
  
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
    latest_dress: [
      {
        clothes_id: 1,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '甜美系粉色OP',
        price: 888,
        times: 5,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 2,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '优雅系蓝色JSK',
        price: 1288,
        times: 8,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 3,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '可爱系黄色OP',
        price: 666,
        times: 3,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 4,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '复古系紫色JSK',
        price: 1588,
        times: 12,
        date: new Date(),
        is_enable: 1
      }
    ],
    favorite_accessories: [
      {
        clothes_id: 5,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '蕾丝发带',
        price: 88,
        times: 25,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 6,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '珍珠项链',
        price: 168,
        times: 20,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 7,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '蝴蝶结发夹',
        price: 58,
        times: 30,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 8,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '蕾丝手套',
        price: 128,
        times: 15,
        date: new Date(),
        is_enable: 1
      }
    ],
    favorite_socks: [
      {
        clothes_id: 9,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '白色蕾丝袜',
        price: 68,
        times: 35,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 10,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '粉色过膝袜',
        price: 78,
        times: 28,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 11,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '黑色连裤袜',
        price: 88,
        times: 22,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 12,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '白色短袜',
        price: 48,
        times: 40,
        date: new Date(),
        is_enable: 1
      }
    ],
    favorite_bags: [
      {
        clothes_id: 13,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '粉色手提包',
        price: 388,
        times: 18,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 14,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '白色单肩包',
        price: 488,
        times: 15,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 15,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '复古手提箱',
        price: 688,
        times: 10,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 16,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '可爱小挎包',
        price: 288,
        times: 20,
        date: new Date(),
        is_enable: 1
      }
    ],
    most_worn: [
      {
        clothes_id: 17,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '经典款粉色OP',
        price: 988,
        times: 45,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 18,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '百搭款蓝色JSK',
        price: 1288,
        times: 38,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 19,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '日常款白色OP',
        price: 888,
        times: 32,
        date: new Date(),
        is_enable: 1
      },
      {
        clothes_id: 20,
        wardrobe_id: 1,
        clothes_img: baseImageUrl,
        clothes_note: '优雅款紫色JSK',
        price: 1588,
        times: 28,
        date: new Date(),
        is_enable: 1
      }
    ],
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

// 加载数据
const loadData = async () => {
  try {
    loading.value = true
    // 暂时使用模拟数据，等接口准备好后可以切换
    // const data = await getYearlySummary({ year: currentYear.value })
    // summaryData.value = data
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 800))
    summaryData.value = getMockData()
  } catch (error) {
    console.error('加载年度总结数据失败:', error)
    // 使用模拟数据作为fallback
    summaryData.value = getMockData()
  } finally {
    loading.value = false
    await nextTick()
    initAnimations()
  }
}

// 初始化动画
const initAnimations = () => {
  if (!$gsap) return

  // 创建时间线
  const tl = $gsap.timeline()

  // 标题动画
  if (titleRef.value) {
    tl.from(titleRef.value, {
      opacity: 0,
      y: -30,
      duration: 0.8,
      ease: 'power3.out'
    }, 0)
  }

  if (subtitleRef.value) {
    tl.from(subtitleRef.value, {
      opacity: 0,
      y: -20,
      duration: 0.8,
      ease: 'power3.out'
    }, 0.2)
  }

  // 卡片依次出现动画
  const cards = [
    yearsCardRef.value,
    spendingCardRef.value,
    purchaseCardRef.value,
    blacklistRef.value
  ].filter(Boolean)

  tl.from(cards, {
    opacity: 0,
    y: 50,
    duration: 0.6,
    stagger: 0.15,
    ease: 'back.out(1.2)'
  }, 0.4)

  // 添加浮动动画到装饰元素
  const decorations = summaryContainer.value?.querySelectorAll('.animate-pulse')
  if (decorations && decorations.length > 0) {
    $gsap.to(decorations, {
      y: '+=20',
      duration: 3,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    })
  }
}

onMounted(() => {
  loadData()
})

// SEO
useHead({
  title: `${currentYear.value}年度总结 - Lo研社`,
  meta: [
    {
      name: 'description',
      content: `查看你的${currentYear.value}年Lolita时尚之旅年度总结`
    }
  ]
})
</script>

<style scoped>
.card-animate {
  animation: fadeInUp 0.6s ease-out forwards;
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.decoration-1,
.decoration-2,
.decoration-3 {
  animation: float 6s ease-in-out infinite;
}

.decoration-2 {
  animation-delay: 2s;
}

.decoration-3 {
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.1);
  }
}
</style>

