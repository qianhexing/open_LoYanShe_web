<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif flex items-center justify-center">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
        <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
    </div>

    <!-- 快速登录弹窗 -->
    <ClientOnly>
      <YearlySummaryLoginModal
        v-model="showLoginModal"
        @success="handleLoginSuccess"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { getUserMy } from '@/api/user'
import { useConfigStore } from '@/stores/config'

const userStore = useUserStore()
const configStore = useConfigStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const loading = ref(true)
const showLoginModal = ref(false)

let uni: any
const port = computed(() => configStore.getPort())

// 跳转到衣柜详情页
const jumpToWardrobe = (userId: number) => {
  const wardrobeUrl = `/wardrobe/detail/${userId}`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    router.push(wardrobeUrl)
    // uni.navigateTo({
    //   url: `/pages/wardrobe/wardrobe?user_id=${userId}`,
    //   fail: () => {
    //     console.log('跳转错误')
    //   }
    // })
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com${wardrobeUrl}`
        }
      }))
    } else {
      // 普通网页环境
      router.push(wardrobeUrl)
    }
  }
}

// 检查登录状态并跳转
const checkLoginAndJump = async () => {
  try {
    loading.value = true
    
    // 检查是否有 token
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null)
    
    if (!token) {
      // 没有 token，显示登录弹窗
      loading.value = false
      showLoginModal.value = true
      return
    }
    
    // 有 token，尝试获取用户信息
    try {
      const userInfo = await getUserMy()
      if (userInfo?.user_id) {
        // 已登录，跳转到自己的衣柜
        jumpToWardrobe(userInfo.user_id)
        return
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
    
    // 获取用户信息失败，显示登录弹窗
    loading.value = false
    showLoginModal.value = true
  } catch (error) {
    console.error('检查登录状态失败:', error)
    loading.value = false
    showLoginModal.value = true
  }
}

// 登录成功回调
const handleLoginSuccess = async () => {
  try {
    // 重新获取用户信息
    const userInfo = await getUserMy()
    if (userInfo?.user_id) {
      jumpToWardrobe(userInfo.user_id)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    toast.add({
      title: '获取用户信息失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
  
  // 延迟检查，确保 store 已初始化
  setTimeout(() => {
    checkLoginAndJump()
  }, 100)
})

useHead({
  title: '我的衣柜 - Lo研社',
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

