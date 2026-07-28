<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif">
    <!-- WebView 状态栏占位：layouts/default 中 ?statusbar= -->
    <div
      v-if="configStore.statusBarHeight > 0"
      class="shrink-0 relative z-10"
      aria-hidden="true"
      :style="{ height: `${configStore.statusBarHeight}px` }"
    />

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

    <!-- 未登录状态 -->
    <div v-else-if="notLoggedIn" class="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full">
         <div class="text-6xl mb-6">🔒</div>
         <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">需要登录</h2>
         <p class="text-gray-600 dark:text-gray-300 mb-8">请登录后查看您的年度总结，或者通过分享链接查看他人的总结。</p>
         <button 
           @click="handleLogin"
           class="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
         >
           去登录
         </button>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else class="relative z-10 pb-32">
      <!-- 顶部操作栏 -->
      <div
        v-if="showSettings"
        class="fixed right-4 z-50 flex items-center gap-3"
        :style="{ top: `${16 + (configStore.statusBarHeight || 0)}px` }"
      >
        <button
          @click="showPostModal = true"
          class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">发帖分享</span>
        </button>
        <!-- 公开切换 -->
        <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-300">{{ isAnnualReport ? '公开' : '私密' }}</span>
          <button
            @click="toggleAnnualReport"
            :disabled="updatingReport"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
            :class="isAnnualReport ? 'bg-qhx-primary' : 'bg-gray-300 dark:bg-gray-600'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="isAnnualReport ? 'translate-x-6' : 'translate-x-1'"
            ></span>
          </button>
        </div>
        <!-- 分享按钮 -->
        <button
          @click="handleShare"
          class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span class="text-xl">🔗</span>
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">分享</span>
        </button>
      </div>
      <div
        v-else-if="userStore.user?.user_id"
        class="fixed right-4 z-50 flex items-center gap-3"
        :style="{ top: `${16 + (configStore.statusBarHeight || 0)}px` }"
      >
        <button
          @click="jumpToYearlySummary"
          class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-gray-200">去看我的</span>
        </button>

      </div>
      
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
          <div v-if="summaryData.user_info" class="flex items-center justify-center gap-2 mt-4">
             <img 
              v-if="summaryData.user_info.user_face" 
              :src="formatImg(summaryData.user_info.user_face)" 
              class="w-8 h-8 rounded-full border border-pink-200"
              alt="Avatar"
              @click="jumpToUserDetail(summaryData.user_info.user_id)"
            />
            <span class="text-gray-600 dark:text-gray-300 font-medium">{{ summaryData.user_info.user_name }}</span>
          </div>
          
          <!-- 风格标签 -->
          <div v-if="summaryData.user_info?.main_style?.length" class="flex flex-wrap items-center justify-center gap-2 mt-3 mb-2 max-w-lg mx-auto">
             <span 
               v-for="(tag, idx) in summaryData.user_info.main_style" 
               :key="idx"
               class="px-3 py-1 text-xs rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 border border-pink-100 dark:border-pink-800"
             >
               # {{ tag.label }} ({{ getStylePercentage(tag.value) }}%)
             </span>
          </div>

          <p class="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
            Lolita Fashion之旅
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
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-1">入驻Lo星时长</p>
            <h3 class="text-4xl font-bold text-gray-800 dark:text-gray-100">
              <span class="counter">{{ summaryData.years_in_lolita }}</span>
              <span class="text-lg ml-1 font-normal">天</span>
            </h3>
          </div>

          <!-- 年度消费 -->
          <div 
            ref="spendingCardRef"
            class="bg-[#000] lg:col-span-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[2rem] p-8 shadow-xl text-white relative overflow-hidden group"
          >
            <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
            <div class="relative z-10 flex flex-col justify-between h-full">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="text-pink-100 text-sm font-medium uppercase tracking-wider mb-2">总花费</p>
                  <h3 class="text-4xl md:text-6xl font-bold mb-1">
                    <span class="text-3xl align-top opacity-80">¥</span>
                    <span class="counter">{{ formatNumber(summaryData.total_year_spending) }}</span>
                  </h3>
                </div>
                <div class="flex-1">
                  <p class="text-pink-100 text-sm font-medium uppercase tracking-wider mb-2">今年花费</p>
                  <h3 class="text-4xl md:text-6xl font-bold mb-1">
                    <span class="text-3xl align-top opacity-80">¥</span>
                    <span class="counter">{{ formatNumber(summaryData.total_spending) }}</span>
                  </h3>
                </div>
              </div>
              <p class="text-pink-100/80 text-sm mt-4">衣柜里永远缺一条裙子！</p>
            </div>
          </div>

          <!-- 购买统计 & 总入柜统计 -->
          <div 
            ref="purchaseCardRef"
            class="lg:col-span-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700"
          >
            <!-- 年度入柜 -->
            <div class="mb-8">
              <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                <span>📊</span>
                <span>年度入柜</span>
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-5 gap-4" v-if="summaryData.purchase_stats?.length">
                <div 
                  v-for="(stat, index) in summaryData.purchase_stats" 
                  :key="index"
                  class="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                >
                  <span class="text-2xl font-bold text-gray-800 dark:text-gray-100 counter">{{ stat.value }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ stat.label }}</span>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 dark:text-gray-400">
                <div>暂无数据</div>
                <div>提示: 衣柜服饰-购入时间设置为今年，才能统计</div>
              </div>
            </div>

            <!-- 总入柜 (新增) -->
             <div v-if="summaryData.total_wardrobe_stats?.length || summaryData.total_purchase_stats?.length">
              <div class="h-px bg-gray-200 dark:bg-gray-700 my-6"></div>
              <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                <span>👗</span>
                <span>衣柜总览</span>
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div 
                  v-for="(stat, index) in (summaryData.total_purchase_stats || summaryData.total_wardrobe_stats)" 
                  :key="'total-'+index"
                  class="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span class="text-2xl font-bold text-gray-800 dark:text-gray-100 counter">{{ stat.value }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ stat.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
        <!-- 相册展示 (重点) -->
      <div v-if="summaryData.ablumn_items?.length" class="max-w-5xl mx-auto px-4 md:px-8 mb-16">
        <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
          <span>📸</span>
          <span>年度打卡</span>
        </h3>
        <!-- 改为 3 列布局 -->
        <div class="grid grid-cols-3 gap-4">
          <div 
            v-for="album in summaryData.ablumn_items" 
            :key="album.album_id"
            class="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 pb-2"
          >
             <!-- 保持宽高比容器 -->
             <div class="relative aspect-square overflow-hidden rounded-t-2xl">
                <QhxPreviewImage 
                  v-if="album?.cover"
                  :list="[{ 
                    src: (album.cover|| '').replace(BASE_IMG, ''), 
                    alt: album.ablumn?.album_title || '相册封面',
                    title: album.ablumn?.album_title || '未命名相册'
                  }]"
                  className="w-full aspect-[3/4] object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
                />
                <div v-else class="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl">
                  📁
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span class="text-white font-medium truncate">{{ album.ablumn?.album_title || '未命名相册' }}</span>
                </div>
             </div>
             
             <!-- Note 展示 -->
             <div v-if="album.note" class="px-3 py-3">
               <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                 {{ album.note }}
               </p>
             </div>
             <div v-else class="px-3 py-3 text-center">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{{ album.ablumn?.album_title || '未命名相册' }}</span>
             </div>
          </div>
        </div>
      </div>
      <div v-else class="max-w-5xl mx-auto px-4 md:px-8 mb-16">
        <div class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700 text-center">
          <div v-if="showSettings" class="flex flex-col items-center gap-4">
            <div class="text-5xl mb-2">📸</div>
            <p class="text-gray-600 dark:text-gray-300 text-lg mb-4">还没有年度打卡记录</p>
            <NuxtLink
              to="/album/detail/34/"
              class="px-8 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-full font-bold transition-colors shadow-lg shadow-qhx-primary/30 inline-flex items-center gap-2"
            >
              <span>去打卡年终总结</span>
            </NuxtLink>
          </div>
          <div v-else class="flex flex-col items-center gap-2">
            <div class="text-5xl mb-2">📭</div>
            <p class="text-gray-600 dark:text-gray-300 text-lg">暂无数据</p>
          </div>
        </div>
      </div>

      <!-- 详细列表区域 -->
      <div class="max-w-5xl mx-auto px-4 md:px-8 space-y-16">

        <!-- 最喜欢的物品，按部位分组 -->
        <template v-if="summaryData.favorite?.length">
          <div v-if="summaryData.favorite.length === 1" class="w-full">
            <YearlySummarySection
              :title="`最喜欢的${summaryData.favorite[0].label}`"
              :icon="getFavoriteIcon(summaryData.favorite[0].label)"
              :items="summaryData.favorite[0].value"
              :delay="0.3"
            />
          </div>
          <div v-else-if="summaryData.favorite.length === 2" class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <YearlySummarySection
              v-for="(fav, index) in summaryData.favorite"
              :key="fav.label"
              :title="`最喜欢的${fav.label}`"
              :icon="getFavoriteIcon(fav.label)"
              :items="fav.value"
              :delay="0.3 + index * 0.1"
            />
          </div>
          <template v-else>
            <YearlySummarySection
              v-for="(fav, index) in summaryData.favorite"
              :key="fav.label"
              :title="`最喜欢的${fav.label}`"
              :icon="getFavoriteIcon(fav.label)"
              :items="fav.value"
              :delay="0.3 + index * 0.1"
            />
          </template>
        </template>

        <YearlySummarySection
          v-if="summaryData.most_worn?.length"
          title="穿着率最高的"
          icon="⭐"
          :items="summaryData.most_worn"
          :delay="0.6"
        />

        <!-- 店铺排行 -->
        <div v-if="summaryData.shop_list?.length" class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700">
          <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
            <span>🛍️</span>
            <span>常买的店</span>
          </h3>
          <div class="flex flex-wrap gap-4">
             <div 
               v-for="(shopItem, idx) in summaryData.shop_list.slice(0, 4)"
               :key="idx"
               class="flex items-center gap-3 bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600"
             >
                <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                  <img 
                    v-if="shopItem.shop?.shop_logo"
                    :src="formatImg(shopItem.shop.shop_logo)"
                    class="w-full h-full object-cover"
                    alt="Shop"
                  />
                  <span v-else class="flex items-center justify-center w-full h-full text-xs">Shop</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-800 dark:text-gray-200">{{ shopItem.shop?.shop_name || shopItem.label }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">购买 {{ shopItem.value }} 次</span>
                </div>
             </div>
          </div>
        </div>

        <!-- 拉黑店铺 -->
        <div 
          v-if="summaryData.blacklisted_shops?.length"
          ref="blacklistRef"
          class="bg-red-50/80 dark:bg-red-900/20 backdrop-blur-md rounded-[2rem] p-8 shadow-lg border border-red-100 dark:border-red-900/50"
        >
          <div class="flex items-center gap-2 mb-6 justify-center">
            <span class="text-2xl">⛔</span>
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">拉黑的店</h2>
          </div>
          <div class="flex flex-wrap justify-center gap-6">
            <div
              v-for="shop in summaryData.blacklisted_shops"
              :key="shop.shop_id"
              class="flex flex-col items-center gap-2 group"
            >
              <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-red-200 dark:border-red-800 shadow-sm group-hover:scale-110 transition-transform">
                <img 
                  :src="formatImg(shop.shop_logo)"
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
      <div class="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none" v-if="!port">
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

    <!-- 发帖弹窗 -->
    <ClientOnly>
      <YearlySummaryPostModal
        v-model="showPostModal"
        :user-id="userStore.user?.user_id"
        @success="handlePostSuccess"
      />
    </ClientOnly>

    <!-- 快速登录弹窗 -->
    <YearlySummaryLoginModal
      v-model="showLoginModal"
      @success="handleLoginSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, reactive } from 'vue'
import type { YearlySummaryData } from '@/api/yearlySummary'
import { getYearlySummary } from '@/api/yearlySummary'
import { BASE_IMG } from '@/utils/ipConfig'
import { useUserStore } from '@/stores/user'
import { changeUserInfo, getUserMy } from '@/api/user'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import type { User, Community } from '@/types/api'
import { useConfigStore } from '@/stores/config'
import { insertBrowTime } from '@/api/brow_time'
import dayjs from 'dayjs'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
let uni: any;
const { $gsap } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const configStore = useConfigStore()
const toast = useToast()

const loading = ref(true)
const notLoggedIn = ref(false)
const isAnnualReport = ref(0)
const updatingReport = ref(false)
const showLoginModal = ref(false)

const summaryData = ref<YearlySummaryData>({
  user_info: { user_id: 0, user_name: '', user_face: '', main_style_name: '', main_style: [] },
  ablumn_items: [],
  years_in_lolita: 0,
  total_spending: 0,
  purchase_stats: [],
  total_wardrobe_stats: [],
  total_purchase_stats: [],
  favorite: [],
  most_worn: [],
  blacklisted_shops: [],
  shop_list: []
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
const showPostModal = ref(false)

const port = computed(() => configStore.getPort())
// 判断是否显示设置按钮（只有当前用户id等于URL中的user_id时才显示）
const showSettings = computed(() => {
  const userId = route.query.user_id
  const currentUserId = userStore.user?.user_id
  return userId && currentUserId && Number.parseInt(userId as string) === currentUserId
})

const formatNumber = (num: number): string => {
  if (num === 0) return '0'
  if (num === null) return '0'
  if (num === undefined) return '0'
  return num.toLocaleString('zh-CN')
}

const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

// 计算风格标签占比
const getStylePercentage = (value: number): string => {
  if (!summaryData.value.user_info?.main_style?.length) return '0'
  const total = summaryData.value.user_info.main_style.reduce((sum, tag) => sum + (tag.value || 0), 0)
  if (total === 0) return '0'
  return ((value / total) * 100).toFixed(1)
}

const { buildLoginTo } = useLoginRedirect()

const handleLogin = () => {
    router.push(buildLoginTo())
}

// 切换年度总结公开状态
const toggleAnnualReport = async () => {
  if (updatingReport.value) return
  
  updatingReport.value = true
  try {
    const newValue = isAnnualReport.value === 1 ? 0 : 1
    await changeUserInfo({
      is_annual_report: newValue
    })
    isAnnualReport.value = newValue
    toast.add({
      title: newValue === 1 ? '已公开年度总结' : '已取消公开年度总结',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    console.error('更新年度总结公开状态失败:', error)
    toast.add({
      title: '更新失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    updatingReport.value = false
  }
}

// 分享功能
const copyUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl();
  try {
    await copyCurrentUrl()
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const handleShare = async () => {
  try {
    const { copyCurrentUrl } = useCopyCurrentUrl()
    const result = await copyCurrentUrl()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch (error) {
    console.error('复制链接失败:', error)
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// 发帖成功回调
const handlePostSuccess = async (community: Community) => {
  // 设置为公开
  if ( !isAnnualReport.value) {
    toggleAnnualReport()
  }
  // 可以在这里添加成功后的操作，比如刷新数据等
  console.log('发帖成功')
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/community/communityDetail/communityDetail?id=${community.community_id}`,
		});
	} else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'CommunityDetail',
        params: {
          id: community.community_id
        }
      }));
    } else {
      window.open(`/community/detail/${community.community_id}`, '_blank')
    }
  }
}

// 根据部位名称获取图标
const getFavoriteIcon = (label: string): string => {
  const iconMap: Record<string, string> = {
    '小物': '💍',
    '袜子': '🧦',
    '包包': '👜',
    '鞋子': '👠',
    '头饰': '👑',
    '手套': '🧤',
    '其他': '✨'
  }
  return iconMap[label] || '✨'
}

const jumpToYearlySummary = () => {
  window.open(`/yearlySummary?user_id=${userStore.user?.user_id}`, '_blank')
}

const jumpToUserDetail = (userId: number) => {
  // router.push(`/user/detail/${userId}`)
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/userSpace/userSpace?id=${userId}`,
		});
	}
}
// 模拟数据 (保留原有逻辑，更新结构)
const getMockData = (): YearlySummaryData => {
  const baseImageUrl = 'static/library_app/20986_176590718554587.JPG'
  
  return {
    user_info: {
      user_id: 1,
      user_name: 'Lo娘',
      user_face: baseImageUrl,
      main_style_name: '甜系,哥特',
      main_style: [
        { label: '甜系', value: 85 },
        { label: '哥特', value: 40 },
        { label: '古典', value: 20 },
        { label: '日常', value: 15 }
      ]
    },
    ablumn_items: Array(5).fill({
        album_id: 1,
        user_id: 1,
        note: '这是一段关于这个相册的美好回忆，记录了今年最喜欢的穿搭时刻。✨',
        ablumn: {
            album_id: 1,
            parent_id: 0,
            album_title: '我的相册',
            album_cover: baseImageUrl
        }
    }),
    years_in_lolita: 5,
    total_spending: 25888,
    purchase_stats: [
      { label: '裙子', value: 15 },
      { label: '小物', value: 12 },
      { label: '袜子', value: 20 },
      { label: '包包', value: 8 },
      { label: '鞋子', value: 6 }
    ],
    total_wardrobe_stats: [
      { label: '裙子', value: 150 },
      { label: '小物', value: 300 },
      { label: '袜子', value: 120 },
      { label: '包包', value: 45 },
      { label: '鞋子', value: 30 }
    ],
    total_purchase_stats: [
      { label: '裙子', value: 150 },
      { label: '小物', value: 300 },
      { label: '袜子', value: 120 },
      { label: '包包', value: 45 },
      { label: '鞋子', value: 30 }
    ],
    favorite: [
      {
        label: '小物',
        value: Array(4).fill({
          clothes_id: 5,
          wardrobe_id: 1,
          clothes_part: '小物',
          is_favorite: 1,
          add_time: new Date(),
          library: {
            library_id: 1,
            name: '蕾丝发带',
            cover: baseImageUrl,
            square_cover: baseImageUrl,
            pattern_elements: '',
            design_elements: '',
            theme: ''
          },
          price: 88,
          times: 25,
          date: new Date(),
          is_enable: 1
        }).map((item, i) => ({ ...item, clothes_id: i + 5 }))
      },
      {
        label: '袜子',
        value: Array(4).fill({
          clothes_id: 9,
          wardrobe_id: 1,
          clothes_part: '袜子',
          is_favorite: 1,
          add_time: new Date(),
          library: {
              library_id: 2,
              name: '白色蕾丝袜',
              cover: baseImageUrl,
              square_cover: baseImageUrl,
              pattern_elements: '',
              design_elements: '',
              theme: ''
          },
          price: 68,
          times: 35,
          date: new Date(),
          is_enable: 1
        }).map((item, i) => ({ ...item, clothes_id: i + 9 }))
      }
    ],
    most_worn: Array(4).fill({
      clothes_id: 17,
      wardrobe_id: 1,
      price: 988,
      times: 45,
      date: new Date(),
      is_enable: 1,
      library: {
          library_id: 3,
          name: '经典款粉色OP',
          cover: baseImageUrl,
          square_cover: baseImageUrl,
          pattern_elements: '',
          design_elements: '',
          theme: ''
      }
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
      }
    ],
    shop_list: [
        {
            label: '1',
            value: 10,
            shop: {
                shop_id: 1,
                shop_name: 'Angelic Pretty',
                shop_logo: baseImageUrl,
                shop_country: 1
            }
        },
        {
            label: '2',
            value: 5,
            shop: {
                shop_id: 2,
                shop_name: 'Baby, the Stars Shine Bright',
                shop_logo: baseImageUrl,
                shop_country: 1
            }
        }
    ]
  }
}
const loadData = async () => {
  try {
    loading.value = true
    
    // 检查登录状态
    const userId = route.query.user_id
    // 尝试从 cookie 或 localStorage 获取 token
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null)
    
    if (!userId && !token) {
        notLoggedIn.value = true
        loading.value = false
        return
    }

    await new Promise(resolve => setTimeout(resolve, 800))
    
    // 构建 API 参数
    const params: { user_id?: number } = {}
    if (userId) {
        params.user_id = Number.parseInt(userId as string)
    }
    
    summaryData.value = await getYearlySummary(params)
    
    // 如果是当前用户，获取年度总结公开状态
    if (showSettings.value) {
      try {
        const userInfo = await getUserMy()
        const userData = userInfo as User & { is_annual_report?: number }
        isAnnualReport.value = userData.is_annual_report ?? 0
      } catch (error) {
        console.error('获取用户年度总结公开状态失败:', error)
      }
    }
  } catch (error) {
    // 判断是否有token
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null)
    
    if (!token) {
      // 没有token，显示登录弹窗
      showLoginModal.value = true
      summaryData.value = getMockData()
    } else {
      // 有token但请求失败，使用模拟数据
      summaryData.value = getMockData()
    }
  } finally {
    loading.value = false
    if (!notLoggedIn.value) {
        await nextTick()
        initAnimations()
    }
  }
}

// 登录成功回调
const handleLoginSuccess = async () => {
  // 重新加载数据
  await loadData()
}

// 错误处理函数
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybeObj = error as Record<string, unknown>
    if (typeof maybeObj.message === 'string') return maybeObj.message
  }
  return '操作失败，请稍后重试'
}

const initAnimations = () => {
  if (!$gsap) return

  const tl = $gsap.timeline()

  // Header 动画
  if (titleRef.value) {
    tl.from(titleRef.value, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power4.out'
    })
  }
  if (subtitleRef.value) {
    tl.from(subtitleRef.value, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    }, '-=0.5')
  }

  // 卡片入场
  const cards = [yearsCardRef.value, spendingCardRef.value, purchaseCardRef.value].filter(Boolean)
  
  if (cards.length > 0) {
      $gsap.from(cards, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out',
        delay: 0.5
      })
  }

  // 数字增长动画
  const counters = document.querySelectorAll('.counter')
  for (const counter of counters) {
    // 简单的数字增长，不需要复杂插件
    const el = counter as HTMLElement
    const target = Number.parseInt(el.textContent?.replace(/,/g, '') || '0', 10)
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
  }
}

const user = computed(() => userStore.user)

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  setTimeout(() => {
    // 如果有token，则获取用户信息
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null)
    if (token) {
      getUserMy().then((res) => {
        // 如果路由没有user_id，则设置user_id为当前用户id
        if (!route.query.user_id) {
          // route.query.user_id = res.user_id.toString()
          window.location.href = `/yearlySummary?user_id=${res.user_id}`
        }
      })
    }
    // 如果路由有user_id，则加载数据
    if (route.query.user_id) {
      loadData()
    } else if (!token) {
      // 如果既没有token也没有路由user_id参数，则触发登录弹窗
      showLoginModal.value = true
    }
  })
  setTimeout(() => {
    if (user.value?.user_id === 1) {
      return
    }
    insertBrowTime({ id: dayjs(new Date()).format('YYYYMMDD'), type: 'yearly_summary' })
  }, 5000)
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