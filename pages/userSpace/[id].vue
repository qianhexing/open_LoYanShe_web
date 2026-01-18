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
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
    </div>

    <!-- 主要内容 -->
    <div v-else-if="userInfo" class="relative z-10 pb-32">

      <!-- 用户信息卡片 -->
      <div class="max-w-4xl mx-auto px-4 md:px-8 pt-2">
        <div class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-white/50 dark:border-gray-700">
          <!-- 用户头像和基本信息 -->
          <div class="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
            <!-- 头像 -->
            <UserFace :user="userInfo" />

            <!-- 用户信息 -->
            <div class="flex-1 text-center md:text-left">
              <h1 class="text-xl flex items-center justify-between md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                <div>
                  {{ userInfo.user_name || '未设置昵称' }}
                </div>
                <button
                  v-if="isCurrentUser"
                  @click="handleEdit"
                  class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span class="text-xl">✏️</span>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">编辑</span>
                </button>
              </h1>
              <!-- 个人签名 -->
              <p v-if="userInfo.signature" class="text-gray-600 dark:text-gray-300 text-lg mb-4 italic">
                "{{ userInfo.signature }}"
              </p>
              <p v-else class="text-gray-400 dark:text-gray-500 text-sm mb-4">
                这个人很懒，还没有留下签名
              </p>

              <!-- 风格标签 -->
              <div v-if="userInfo.main_style?.length" class="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                <QhxTag 
                  v-for="(style, idx) in userInfo.main_style" 
                  :key="idx"
                >
                  # {{ style.label }}
                </QhxTag>
              </div>
              <div v-else class="text-gray-400 dark:text-gray-500 text-sm mb-4">
                还没有设置风格标签
              </div>
            </div>
          </div>

          <!-- 详细信息 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <!-- 地址信息 -->
            <div v-if="userInfo.show_area && (userInfo.province || userInfo.city || userInfo.area)" class="flex items-start gap-3">
              <span class="text-2xl">📍</span>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">所在地</p>
                <p class="text-gray-800 dark:text-gray-200 font-medium">
                  {{ [userInfo.province, userInfo.city].filter(Boolean).join(' ') || '未设置' }}
                </p>
              </div>
            </div>
            <div v-else-if="isCurrentUser" class="flex items-start gap-3">
              <span class="text-2xl">📍</span>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">所在地</p>
                <p class="text-gray-400 dark:text-gray-500 text-sm">未设置（可在编辑中设置）</p>
              </div>
            </div>

            <!-- 成就展示 -->
            <!-- <div v-if="userInfo.is_achieve" class="flex items-start gap-3">
              <span class="text-2xl">🏆</span>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">成就</p>
                <p class="text-gray-800 dark:text-gray-200 font-medium">已开启成就展示</p>
              </div>
            </div> -->
          </div>
        </div>
      </div>
    </div>

    <!-- 未找到用户 -->
    <div v-else class="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full">
        <div class="text-6xl mb-6">😕</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">用户不存在</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-8">抱歉，找不到该用户信息。</p>
        <button 
          @click="router.back()"
          class="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-pink-500/30"
        >
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { getUserSpace } from '@/api/user'
import { BASE_IMG } from '@/utils/ipConfig'
import { useUserStore } from '@/stores/user'
import type { User } from '@/types/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const loading = ref(true)
const userInfo = ref<(User & {
  signature?: string
  main_style?: Array<{ label: string; value: number }>
  province?: string
  city?: string
  area?: string
  show_area?: number | boolean
  is_achieve?: number | boolean
}) | null>(null)

// 判断是否是当前用户
const isCurrentUser = computed(() => {
  const userId = route.params.id ? Number.parseInt(route.params.id as string) : null
  const currentUserId = userStore.user?.user_id
  console.log(currentUserId, '当前用户ID',  userId && currentUserId && userId === currentUserId)
  return userId && currentUserId && userId === currentUserId
})

const formatImg = (url: string) => {
  if (!url) return ''
  return `${BASE_IMG}${url.replace(BASE_IMG, '')}`
}

// 编辑按钮点击事件
const handleEdit = () => {
  router.push('/user/edit')
}

// 加载用户信息
const loadUserInfo = async () => {
  try {
    loading.value = true
    
    const userId = route.params.id ? Number.parseInt(route.params.id as string) : null
    
    if (!userId || Number.isNaN(userId)) {
      toast.add({
        title: '参数错误',
        description: '缺少用户ID参数',
        icon: 'i-heroicons-x-circle',
        color: 'red'
      })
      loading.value = false
      return
    }

    const data = await getUserSpace({ user_id: userId })
    userInfo.value = data as typeof userInfo.value
  } catch (error) {
    console.error('获取用户信息失败:', error)
    toast.add({
      title: '获取用户信息失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
    userInfo.value = null
  } finally {
    loading.value = false
  }
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

onMounted(() => {
  if (layoutReady.value) {
    loadUserInfo()
  }
})
const layoutReady = inject('layoutReady') as Ref<boolean>
watch(layoutReady, (newVal) => {
  if (newVal) {
    loadUserInfo()
  }
})
// 监听路由参数变化，当 id 改变时重新加载数据
watch(() => route.params.id, () => {
  loadUserInfo()
})


useHead({
  title: computed(() => {
    if (userInfo.value?.user_name) {
      return `${userInfo.value.user_name} - 用户空间 - Lo研社`
    }
    return '用户空间 - Lo研社'
  }),
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
