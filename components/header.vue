<template>
  <header class="fixed w-full top-0 z-50 border-b dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 shadow-sm">
      <div class="container mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
        <!-- 左侧 Logo 和汉堡菜单 -->
        <div class="flex items-center gap-2 md:gap-0">
          <!-- 手机端汉堡菜单 -->
          <button
            @click="mobileMenuOpen = true"
            class="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="打开菜单"
          >
            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <!-- Logo -->
          <NuxtLink to="/" class="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center">
            Lo 研社
          </NuxtLink>
        </div>

        <!-- 桌面端导航 -->
        <nav class="hidden md:flex items-center gap-4">
          <UButton v-for="item in navItems" :key="item.to" :to="item.to" variant="ghost" color="gray">
            {{ item.label }}
          </UButton>
        </nav>

        <!-- 右侧操作区 -->
        <div class="flex items-center gap-2 md:gap-4">
          <LocaleSwitcher class="hidden sm:block mr-0 md:mr-3"/>
          <!-- 右侧操作区 -->
          <div class="flex items-center gap-2 md:gap-4" v-show="!user">
            <LoginBox />
          </div>
          <div class="flex items-center gap-2 md:gap-4" v-show="user">
            <!-- 消息图标 -->
            <button
              @click="handleMessageClick"
              class="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="消息"
            >
              <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <!-- 红点提示 -->
              <span
                v-if="hasNotification"
                class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
              ></span>
            </button>
            <UserBox></UserBox>
          </div>
        </div>
      </div>

      <!-- 手机端抽屉菜单 -->
      <QhxDrawer
        v-model="mobileMenuOpen"
        direction="left"
        :size="'280px'"
        :mobile-size="'85vw'"
      >
        <div class="h-full flex flex-col bg-white dark:bg-gray-900">
          <!-- 抽屉头部 -->
          <div class="flex items-center justify-between p-4 border-b dark:border-gray-800">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">菜单</h2>
            <button
              @click="mobileMenuOpen = false"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="关闭菜单"
            >
              <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 导航菜单 -->
          <nav class="flex-1 overflow-y-auto py-4">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              @click="mobileMenuOpen = false"
              class="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-l-4 border-transparent hover:border-qhx-primary dark:hover:border-qhx-primary"
              :class="{ 'bg-gray-50 dark:bg-gray-800 border-qhx-primary text-qhx-primary dark:text-qhx-primary': route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)) }"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <!-- 抽屉底部 -->
          <div class="p-4 border-t dark:border-gray-800">
            <div class="mb-3">
              <LocaleSwitcher />
            </div>
            <div v-if="!user" class="mb-2">
              <LoginBox />
            </div>
            <div v-if="user" class="text-sm text-gray-600 dark:text-gray-400">
              {{ user.user_name }}
            </div>
          </div>
        </div>
      </QhxDrawer>
    </header>
</template>

<script setup lang="ts">
const mobileMenuOpen = ref(false)
const userStore = useUserStore()
const userStoreRefs = storeToRefs(userStore)
const { user, hasNotification } = userStoreRefs
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// 获取通知系统的方法
const { markNotificationAsRead } = useNotification()

// 处理消息点击
const handleMessageClick = () => {
  // 跳转到消息页面
  router.push('/user/message')
}

const navItems = computed(() => [
  { label: t('header.home'), to: "/" },
  { label: t('header.library'), to: "/library" },
  { label: t('header.shop'), to: "/shop" },
  { label: t('header.collection'), to: "/compilations" },
  { label: t('header.community'), to: "/community" },
  { label: t('header.study'), to: "/study" },
])

// 监听路由变化，关闭移动端菜单
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})
</script>
