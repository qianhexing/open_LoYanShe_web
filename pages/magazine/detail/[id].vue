<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 弹幕组件 -->
    <div v-if="detail" class="fixed top-0 left-0 w-full h-full pointer-events-none z-40" style="pointer-events: none;">
      <CommentDanmakuComment
        ref="danmakuRef"
        type="magazine"
        :id="detail.magazine_id"
        width="100%"
        height="100vh"
        :pageSize="50"
        :speed="danmakuSpeed"
        fontSize="14px"
        class="pointer-events-none"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center min-h-screen">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
        <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
    </div>

    <!-- 主要内容 -->
    <div v-else-if="detail" class="relative z-10 pb-16">
      <!-- 顶部操作栏 -->
      <div class="fixed top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <button
          @click="goBack"
          class="pointer-events-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-lg border border-white/50 dark:border-gray-700 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span class="text-xl">←</span>
        </button>
        <div class="flex items-center gap-3 pointer-events-auto">
          <button
            @click="handleShare"
            class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span class="text-xl">🔗</span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">分享</span>
          </button>
        </div>
      </div>

      <!-- 标题区域 -->
      <header class="pt-4 pb-8 px-[2px] text-center relative">
        <h1 
          class="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent tracking-tight"
        >
          {{ detail.title }}
        </h1>
        <p v-if="detail.desc" class="text-gray-600 dark:text-gray-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          {{ detail.desc }}
        </p>
      </header>

      <!-- 图片展示区域 - 竖着展示 -->
      <div class="max-w-2xl mx-auto px-[10px]">
        <div class="space-y-2">
          <div 
            v-for="(image, index) in imageList" 
            :key="index"
            class="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[8px] p-2 md:p-6 shadow-xl border border-white/50 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all duration-300"
          >
            <div class="flex justify-center items-start">
              <QhxPreviewImage 
                :list="[{ 
                  src: image.replace(BASE_IMG, ''), 
                  alt: `${detail.title} - 第${index + 1}张`,
                  title: detail.title
                }]"
                :preview="[image.replace(BASE_IMG, '')]"
                className="w-full max-w-full h-auto object-contain rounded-2xl cursor-pointer transition-transform duration-500 group-hover:scale-[1.01]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-else class="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full">
        <div class="text-6xl mb-6">📖</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">杂志不存在</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-8">该杂志可能已被删除或不存在。</p>
        <button 
          @click="goBack"
          class="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
        >
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { Magazine } from '@/types/api'
import { getMagazineDetail } from '@/api/magazine'
import { BASE_IMG } from '@/utils/ipConfig'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import type DanmakuComment from '@/components/comment/DanmakuComment.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const detail = ref<Magazine | null>(null)
const danmakuRef = ref<InstanceType<typeof DanmakuComment> | null>(null)

// 窗口宽度响应式变量
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

// 根据窗口宽度计算弹幕速度
const danmakuSpeed = computed(() => {
  const baseWidth = 1920 // 基准宽度（像素）
  const baseSpeed = 40 // 基准速度
  // 根据窗口宽度按比例调整速度
  // 窗口越宽，速度值越大（移动越慢），以保持视觉一致性
  return Math.round((windowWidth.value / baseWidth) * baseSpeed)
})

// 解析图片列表（逗号分割的字符串）
const imageList = computed(() => {
  if (!detail.value?.image_list) return []
  return detail.value.image_list
    .split(',')
    .map(img => img.trim())
    .filter(img => img.length > 0)
    .map(img => {
      // 确保图片URL包含BASE_IMG前缀
      if (img.startsWith(BASE_IMG)) {
        return img
      }
      return `${BASE_IMG}${img.startsWith('/') ? img : `/${img}`}`
    })
})

// 加载数据
const loadData = async () => {
  try {
    loading.value = true
    const id = route.params.id as string
    const magazineId = Number.parseInt(id)
    
    if (Number.isNaN(magazineId)) {
      throw new Error('无效的杂志ID')
    }
    
    detail.value = await getMagazineDetail({ magazine_id: magazineId })
  } catch (error) {
    console.error('加载杂志详情失败:', error)
    toast.add({
      title: '加载失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 返回
const goBack = () => {
  router.back()
}

// 分享功能
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
const layoutReady = inject('layoutReady') as Ref<boolean>
watch(layoutReady, (newVal) => {
  if (newVal) {
    loadData()
  }
})

// 监听窗口大小变化
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    windowWidth.value = window.innerWidth
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})


useHead({
  title: computed(() => detail.value ? `${detail.value.title} - Lo研社杂志` : '杂志详情 - Lo研社'),
  meta: [
    {
      name: 'description',
      content: computed(() => detail.value?.desc || 'Lo研社杂志详情')
    }
  ]
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
