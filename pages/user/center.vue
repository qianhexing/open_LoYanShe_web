<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif flex flex-col">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="relative z-10 flex-1 flex flex-col items-center justify-center">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
        <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
    </div>

    <!-- 未登录时显示登录提示 -->
    <div v-else-if="!user" class="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
      <div class="text-center mb-6">
        <div class="text-6xl mb-4">👤</div>
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">请先登录</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">登录后即可使用快捷入口服务</p>
        <button
          @click="showLoginModal = true"
          class="px-8 py-3 bg-qhx-primary hover:bg-qhx-primaryHover text-white rounded-full font-bold transition-colors shadow-lg"
        >
          去登录
        </button>
      </div>
    </div>

    <!-- 已登录：用户中心内容 -->
    <div v-else class="relative z-10 flex-1 w-full max-w-lg mx-auto px-4 py-8 pb-safe">
      <div class="w-full bg-white dark:bg-gray-800/90 rounded-[24px] shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <!-- 用户信息区域 -->
        <div class="p-6 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-center gap-4 mb-4">
            <img
              :src="`${BASE_IMG}${user.user_face}`"
              :alt="user.user_name"
              class="w-20 h-20 object-cover rounded-full border-2 border-white dark:border-gray-600 shadow-md"
              loading="lazy"
            />
            <div class="flex-1 min-w-0">
              <div class="text-xl font-semibold text-gray-800 dark:text-gray-100 truncate">{{ user.user_name || '未登录' }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: {{ user.user_id || '-' }}</div>
            </div>
          </div>

          <!-- 经验值和等级显示 -->
          <div v-if="user.exp !== undefined && levelConfig.length > 0" class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">等级</span>
                <span class="text-lg font-bold text-pink-600">Lv.{{ user.level || 0 }}</span>
              </div>
              <div v-if="user.star_coin !== undefined" class="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/30 rounded-md px-2 py-1 border border-yellow-200 dark:border-yellow-700">
                <span class="text-sm font-bold text-yellow-600 dark:text-yellow-400">星星币</span>
                <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span class="text-sm font-bold text-yellow-600 dark:text-yellow-400">{{ user.star_coin || 0 }}</span>
              </div>
            </div>

            <!-- 进度条 -->
            <div class="relative h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                class="absolute inset-y-0 left-0 bg-qhx-primary rounded-full transition-all duration-500 ease-out"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ progressPercentage.toFixed(1) }}%</span>
              </div>
            </div>

            <div class="flex items-center justify-between mt-1">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span class="font-medium">{{ user.exp || 0 }}</span>
                <span class="text-gray-400"> / {{ nextLevelExp }}</span>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-500" v-if="!isMaxLevel">
                距离下一级还需 {{ Math.max(0, nextLevelExp - (user.exp || 0)) }} 经验
              </div>
              <div class="text-xs text-pink-600 text-right font-medium" v-else>
                已满级！
              </div>
            </div>
          </div>
        </div>

        <!-- 功能菜单区域 -->
        <div class="p-4">
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="jumpToMySpace"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center group-hover:bg-pink-200 dark:group-hover:bg-pink-800/40 transition-colors">
                <svg class="w-5 h-5 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">我的空间</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">个人主页</div>
              </div>
            </button>

            <button
              @click="jumpToMyWardrobe"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                <UIcon name="hugeicons:wardrobe-04" class="text-[20px] text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">我的衣柜</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">服饰管理</div>
              </div>
            </button>

            <button
              @click="jumpToPlan"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center group-hover:bg-teal-200 dark:group-hover:bg-teal-800/40 transition-colors">
                <svg class="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">定尾计划</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">定金尾款管理</div>
              </div>
            </button>

            <button
              @click="jumpToAddLibrary"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">补充图鉴</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">添加图鉴</div>
              </div>
            </button>

            <button
              @click="jumpToMyLibrary"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">我上传的图鉴</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">图鉴管理</div>
              </div>
            </button>

            <button
              @click="jumpToMyScene"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors">
                <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">3D场景</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">场景管理</div>
              </div>
            </button>

            <button
              @click="jumpToAlbum"
              class="flex items-center gap-2 p-3 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors text-left group"
            >
              <div class="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/40 transition-colors">
                <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-800 dark:text-gray-200">成就簿</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">成就记录</div>
              </div>
            </button>
          </div>

          <!-- 退出登录按钮 -->
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              @click="logout"
              class="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors font-medium"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 添加到主屏幕提示（可选，Safari 用户） -->
      <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
        在 Safari 中点击分享 → 添加到主屏幕，即可快速访问
      </p>
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
import { BASE_IMG } from '@/utils/ipConfig'
import { useConfigStore } from '@/stores/config'
import { getUserMy } from '@/api/user'
import YearlySummaryLoginModal from '@/components/yearlySummary/LoginModal.vue'

const userStore = storeToRefs(useUserStore())
const { user } = userStore
const configStore = useConfigStore()
const router = useRouter()
const toast = useToast()

const loading = ref(true)
const showLoginModal = ref(false)

// 获取等级配置
const levelConfig = computed(() => {
  return configStore.config?.level || []
})

// 计算当前等级
const currentLevel = computed(() => {
  if (!user.value?.exp || levelConfig.value.length === 0) return 1
  const exp = user.value.exp
  for (let i = levelConfig.value.length - 1; i >= 0; i--) {
    if (exp >= levelConfig.value[i]) {
      return i + 1
    }
  }
  return 1
})

// 计算当前等级所需经验
const currentLevelExp = computed(() => {
  if (levelConfig.value.length === 0) return 0
  const level = currentLevel.value
  if (level === 1) return 0
  return levelConfig.value[level - 2] || 0
})

// 计算下一级所需经验
const nextLevelExp = computed(() => {
  if (levelConfig.value.length === 0) return 0
  const level = currentLevel.value
  if (level > levelConfig.value.length) {
    return levelConfig.value[levelConfig.value.length - 1]
  }
  return levelConfig.value[level] || levelConfig.value[1] || 1500
})

const isMaxLevel = computed(() => {
  if (levelConfig.value.length === 0) return false
  return currentLevel.value > levelConfig.value.length
})

// 计算进度百分比
const progressPercentage = computed(() => {
  if (!user.value?.exp || levelConfig.value.length === 0) return 0
  if (isMaxLevel.value) return 100
  const exp = user.value.exp
  const currentExp = currentLevelExp.value
  const nextExp = nextLevelExp.value
  if (nextExp === currentExp) return 100
  const progress = ((exp - currentExp) / (nextExp - currentExp)) * 100
  return Math.min(Math.max(progress, 0), 100)
})

const jumpToMySpace = () => {
  if (user.value) navigateTo(`/userSpace/${user.value.user_id}`)
}
const jumpToMyWardrobe = () => {
  if (user.value) navigateTo(`/wardrobe/detail/${user.value.user_id}`)
}
const jumpToAddLibrary = () => {
  if (user.value) navigateTo('/addLibrary')
}
const jumpToMyLibrary = () => {
  if (user.value) navigateTo('/library/my')
}
const jumpToAlbum = () => {
  if (user.value) navigateTo('/album')
}
const jumpToMyScene = () => {
  if (user.value) navigateTo('/user/sence')
}
const jumpToPlan = () => {
  if (user.value) navigateTo('/user/plan')
}
const logout = () => {
  useUserStore().clearToken()
}

// 检查登录状态
const checkLogin = async () => {
  try {
    loading.value = true
    const token = useCookie('token').value || (import.meta.client ? localStorage.getItem('token') : null)

    if (!token) {
      loading.value = false
      showLoginModal.value = true
      return
    }

    try {
      const userInfo = await getUserMy()
      if (userInfo?.user_id) {
        useUserStore().setUserInfo(userInfo)
      } else {
        showLoginModal.value = true
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      showLoginModal.value = true
    }

    loading.value = false
  } catch (error) {
    console.error('检查登录状态失败:', error)
    loading.value = false
  }
}

// 登录成功回调
const handleLoginSuccess = async () => {
  try {
    const userInfo = await getUserMy()
    if (userInfo?.user_id) {
      useUserStore().setUserInfo(userInfo)
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

onMounted(() => {
  setTimeout(() => {
    checkLogin()
  }, 100)
})

useHead({
  title: '快捷入口 - Lo研社',
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
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 16px);
}
</style>
