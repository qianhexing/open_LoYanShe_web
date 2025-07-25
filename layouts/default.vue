
<script setup lang="ts">
const themeStore = useThemeStore()
const userStore = useUserStore()
const configStore = useConfigStore()
configStore.getConfig()
const times = ref(1)
const isHome = ref(false)
const cachedPages = ref(['library']) // 根据你的实际页面名称修改
const jumpToLoyanshe = () => {
  if (times.value >= 3) {
    window.location.href = 'https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita'
  } else {
    times.value += 1
  }
}
const route = useRoute()
console.log(route.path, '初始路由地址')
const judgeIsHome = () => {
  console.log('当前路由', route.path)
  if (route.path === '/') {
    isHome.value = true
  } else {
    isHome.value = false
  }
}
judgeIsHome()
watch(
  () => route.path,
  (newPath, oldPath) => {
    console.log('路由从', oldPath, '变更为', newPath)
    judgeIsHome()
    // 在这里执行路由变化后的逻辑
  }
)
// 组件会自动导入
onMounted(() => {
  themeStore.setTheme('light')
  userStore.initialize()
  // themeStore.loadFromLocalStorage()
})
</script> 
<template>
  <div class="min-h-screen background transition-colors duration-300">
    <UNotifications position="top-0 right-0" />
    <Header />
    <main class="container mx-auto pb-4  pt-14 min-h-screen">
      <slot />
    </main>
    <!-- <KeepAlive :include="cachedPages" :max="5">
      <main class="container">
        <slot name="screen"/>
      </main>
    </KeepAlive> -->
      <!-- 第二个 main 区域（如果有特殊需求可以单独处理） -->
    <!-- <main class="container">
      <slot name="screen"/>
    </main> -->
    <!-- Footer -->
    <footer class="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 mt-8 left-0 bottom-0 w-full z-50" :class="isHome ? 'fixed' : ''">
      <div class="container mx-auto px-4 py-6">
        <!-- 备案信息 -->
        <div class="flex justify-center items-center mb-4">
          <a 
            href="https://beian.miit.gov.cn/" 
            target="_blank" 
            class="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <img src="https://lolitalibrary.com/ali/static/batb.png" alt="备案图标" class="h-4 w-auto">
            <span class="text-sm">闽ICP备19007279号-1</span>
          </a>
        </div>
        
        <!-- 社交链接 -->
        <div class="flex flex-wrap justify-center items-center gap-4 text-sm">
          <a 
            href="https://afdian.com/a/qianhexing" 
            target="_blank" 
            class="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
            </svg>
            <span>赞助:爱发电@千河星</span>
          </a>
          
          <a 
            href="https://weibo.com/u/6052516131" 
            target="_blank" 
            class="flex items-center space-x-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
            </svg>
            <span>微博:@千河星</span>
          </a>
          
          <a 
            href="https://www.xiaohongshu.com/user/profile/64845f56000000000f006100" 
            target="_blank" 
            class="flex items-center space-x-1 text-pink-600 dark:text-pink-400 hover:text-pink-800 dark:hover:text-pink-300 transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
            </svg>
            <span>小红书:@千河星</span>
          </a>
          
          <button 
            @click="jumpToLoyanshe()" 
            class="flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.71-4.43 1 1 0 00-.315-1.017zM12.5 15a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" clip-rule="evenodd"/>
            </svg>
            <span>Lo研社(狂点我!!!!!)</span>
          </button>
        </div>
        
        <!-- 版权信息 -->
        <div class="text-center mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>&copy; 2019-2025 Lo研社. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.background{
  background-color: var(--background-color);
}
.polaroid-card {
  box-shadow: 0 6px 24px 0 rgba(0,0,0,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.08);
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #f3f3f3;
}
</style>
