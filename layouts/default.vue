
<script setup lang="ts">
import { useLayoutStyle } from '~/composables/useLayoutStyle'
import { getUserMy } from '~/api/user'
import { useNotification } from '~/composables/useNotification'
import { hasNotice } from '@/api/message_center'
import type { UniWebviewJsModule } from '@/stores/config'
import {
  handleNativeInboundPayload,
  installAndroidNativeBridge,
  installIosNativeBridge,
  isAndroidWebview,
  isIosWebview,
  isNativeAppShell,
  markAndroidShell,
  markHarmonyShell,
  markIosShell,
} from '@/utils/nativeShell'
import { normalizeAppLocale } from '@/stores/language'
const themeStore = useThemeStore()
const userStore = useUserStore()
const configStore = useConfigStore()
const languageStore = useLanguageStore()
const HarmonyOS = ref<string | null>(null)
const isFromMobie = ref(true)
const times = ref(1)
const isHome = ref(false)
const cachedPages = ref(['library']) // 根据你的实际页面名称修改
const colorMode = useColorMode()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let uni: any
const jumpToLoyanshe = () => {
  if (times.value >= 3) {
    window.location.href = 'https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita'
  } else {
    times.value += 1
  }
}

const { layoutStyle, setLayoutStyle } = useLayoutStyle() // 0 带上下栏；1 空白。页面可调用 setLayoutStyle 覆盖
const blank_list = [
  'matching/my',
  'user/signIn',
  '/userSpace/', '/exhibition/wardrobe/', '/exhibition/',
  '/humanPlatform/', '/user/plan', '/user/signIn', '/user/center', '/user/message', '/post/', '/distributedMaps', '/visualization/wardrobe', '/visualization/shop-cloud', '/rank', '/yearlySummary', '/user/changePassword','/matching/detail','/album/detail', '/album', 'clothes/detail', 'scene/detail', 'wardrobe/detail', 'wardrobe/statistics', 'wardrobe/square', 'register', 'login', 'lighting-debug', 'timepipe', 'user/edit', 'user/changeAvatarFrame', '/journal', '/shop/shanzheng', '/shop/detail', '/library/detail', '/library/search', '/search/', '/features', 'ai/chat', '/teaparty/detail', '/teaparty/snapshot', '/user/signIn/snapshot', '/wishBottle', '/community/detail', '/community/post', '/community/edit']
const route = useRoute()

function readQueryClient(): string {
  const c = route.query?.client
  const v = Array.isArray(c) ? c[0] : c
  return String(v || '').toLowerCase()
}

function isAppShellQuery(): boolean {
  const client = readQueryClient()
  return client === 'ios' || client === 'android' || client === 'harmony' || client === 'harmonyos'
}

if (route.query?.token) {
  useUserStore().setToken(route.query.token.toString())
}
// Uni / iOS / 鸿蒙外链：?lang=en|zh|ja（亦接受 locale）→ localStorage.lang + cookie，供请求头注入
{
  const raw = route.query?.lang ?? route.query?.locale
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v != null && String(v).trim() !== '') {
    languageStore.setLocale(normalizeAppLocale(v))
  } else {
    languageStore.initLocale()
  }
}
if (route.query?.statusbar) {
  const statusBarHeight = Number(route.query.statusbar)
  if (!Number.isNaN(statusBarHeight) && statusBarHeight >= 0) {
    configStore.setStatusBarHeight(statusBarHeight <= 5 ? 50 : statusBarHeight)
  }
}
// iOS Tab 内嵌外链：底部 Tab 高度（含安全区），供 H5 留底；盖层二级页不带此参数
{
  const raw = route.query?.tabbar ?? route.query?.tabBar ?? route.query?.tabbarHeight
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v != null && String(v).trim() !== '') {
    const tabBarHeight = Number(v)
    if (!Number.isNaN(tabBarHeight) && tabBarHeight >= 0) {
      configStore.setTabBarHeight(tabBarHeight)
    }
  }
}
// iOS / Android 原生外链：首屏即隐藏上下栏，并写入 session 供站内跳转保持
{
  const client = readQueryClient()
  if (client === 'ios') {
    markIosShell()
    isFromMobie.value = true
  } else if (client === 'android') {
    markAndroidShell()
    isFromMobie.value = true
  } else if (client === 'harmony' || client === 'harmonyos') {
    markHarmonyShell()
    isFromMobie.value = true
  }
}

// App 壳 / 已标记原生壳：setup 即放开子页，避免多等一轮 onMounted
const layoutReady = ref(isAppShellQuery() || (process.client && isNativeAppShell()))
provide('layoutReady', layoutReady)

// 用户信息：不阻塞 layout 树；token 已写入 store，后台拉详情
const { data: userInfo } = useAsyncData('user-info', async () => {
  if (route.query?.token) {
    try {
      const res = await getUserMy()
      userStore.setUserInfo(res)
      return res
    } catch {
      return null
    }
  }
  if (import.meta.client) {
    await userStore.initialize()
    return userStore.user
  }
  return null
}, {
  server: false,
  lazy: true,
  default: () => null,
})

const judgeIsHome = () => {
  // preference 才会真正关掉 system 跟随；只写 value 挡不住 iOS 暗色
  colorMode.preference = 'light'
  // App 嵌入：强制空白壳，不渲染 Header/Footer
  if (isAppShellQuery() || (import.meta.client && isNativeAppShell())) {
    layoutStyle.value = 1
    isFromMobie.value = true
  } else {
    const is_blank = blank_list.find((path) => route.path.includes(path))
    if (is_blank && route.path !== '/') {
      layoutStyle.value = 1
    } else {
      layoutStyle.value = 0
    }
  }
  if (route.path === '/') {
    isHome.value = true
  } else {
    isHome.value = false
  }
}
judgeIsHome()

async function applyShellLocale(raw: unknown) {
  const fromObj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as { lang?: unknown; locale?: unknown }).lang ??
        (raw as { lang?: unknown; locale?: unknown }).locale
      : raw
  const lang = normalizeAppLocale(fromObj)
  languageStore.setLocale(lang)
  try {
    const i18n = useI18n()
    if (i18n.locale.value !== lang) {
      await i18n.setLocale(lang)
    }
  } catch {
    /* i18n 未就绪 */
  }
}

function applyNativeInbound(raw: unknown) {
  handleNativeInboundPayload(raw, {
    onSetTheme: (data) => {
      // if (data === 1) themeStore.setTheme('dark')
      // else themeStore.setTheme('light')
    },
    onSetLang: (data) => {
      void applyShellLocale(data)
    },
  })
}

watch(
  () => route.path,
  () => {
    judgeIsHome()
  }
)
watch(
  () => route.query.client,
  (client) => {
    const v = String((Array.isArray(client) ? client[0] : client) || '').toLowerCase()
    if (v === 'ios') {
      markIosShell()
      isFromMobie.value = true
    } else if (v === 'android') {
      markAndroidShell()
      isFromMobie.value = true
    }
  },
)
watch(
  () => route.query.lang ?? route.query.locale,
  (raw) => {
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v == null || String(v).trim() === '') return
    void applyShellLocale(v)
  },
)
const preventZoom = (e: TouchEvent) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
};

const handleInit = (event: MessageEvent) => {
  if (event.data !== '__init_port__') return

  // iOS / Android 不走 MessagePort：忽略建连，通信见 install*NativeBridge
  if (isIosWebview()) {
    markIosShell()
    isFromMobie.value = true
    return
  }
  if (isAndroidWebview() || readQueryClient() === 'android') {
    markAndroidShell()
    isFromMobie.value = true
    return
  }

  const [port] = event.ports
  if (!port) return
  configStore.setPort(port)
  isFromMobie.value = true
  markHarmonyShell()
  port.onmessage = (e) => {
    applyNativeInbound(e.data)
  }
}
// WebSocket 通知系统
type WSConnection = {
  connect: () => void
  disconnect: () => void
  status: Readonly<Ref<'disconnected' | 'connecting' | 'connected' | 'error'>>
  isConnected: ComputedRef<boolean>
}
let wsConnection: WSConnection | null = null

// 初始化 WebSocket 连接（如果有 token）
const initNotificationSystem = () => {
  // 原生壳（Uni / iOS / 鸿蒙）不走浏览器 WebSocket 通知
  if (import.meta.client && !navigator.userAgent.includes('Html5Plus') && !isNativeAppShell()) {
    const { initWebSocket } = useNotification()
    const token = useCookie('token').value || (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('token') : null) || userStore.token
    
    if (token) {
      hasNotice().then((res) => {
        userStore.setHasNotification(res)
      })
      const connection = initWebSocket()
      if (connection) {
        wsConnection = connection
      }
    }
  }
}

// 组件会自动导入
onMounted(async () => {
  colorMode.preference = 'light'
  // 壳 query / localStorage 已写入 languageStore，再同步到 nuxt i18n UI 文案
  try {
    const i18n = useI18n()
    if (i18n.locale.value !== languageStore.locale) {
      await i18n.setLocale(languageStore.locale)
    }
  } catch {
    /* ignore */
  }
  /**
   * 先标记 layoutReady，再异步加载 uni-webview-js。
   * 否则刷新/手机 WebView 会卡在 await import，页面长时间白屏。
   */
  layoutReady.value = true
  judgeIsHome()
  // iOS / Android：尽早挂 LoYanSheBridge 下行（不依赖 MessagePort / uni 脚本）
  if (isIosWebview()) {
    markIosShell()
    isFromMobie.value = true
    layoutStyle.value = 1
    installIosNativeBridge({
      onInbound: (raw) => applyNativeInbound(raw),
    })
  } else if (isAndroidWebview()) {
    markAndroidShell()
    isFromMobie.value = true
    layoutStyle.value = 1
    installAndroidNativeBridge({
      onInbound: (raw) => applyNativeInbound(raw),
    })
  }
  const isInUniApp =
    import.meta.client &&
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  uni = await import('@dcloudio/uni-webview-js').catch(() => null)
  if (isInUniApp && uni) {
    isFromMobie.value = true
    layoutStyle.value = 1
    configStore.setUniWebviewJs(uni as UniWebviewJsModule)
  } else if (isNativeAppShell()) {
    // iOS / Android / 鸿蒙壳：继续隐藏 Header、Footer（勿被下方 false 覆盖）
    isFromMobie.value = true
    layoutStyle.value = 1
    if (isIosWebview()) markIosShell()
    else if (isAndroidWebview()) markAndroidShell()
    configStore.setUniWebviewJs(null)
  } else {
    isFromMobie.value = false
    configStore.setUniWebviewJs(null)
    judgeIsHome()
  }
  if (import.meta.client && typeof window !== 'undefined' && window.localStorage) {
    // 原生壳不建 WebSocket；浏览器站内延迟初始化通知
    if (!isNativeAppShell() && !isInUniApp) {
      setTimeout(() => {
        initNotificationSystem()
      }, 500)
    }
    
    configStore.setIsPc(isPC())
    // 与 SSR 占位宽度 1024 对齐：在客户端首次挂上真实视口与 resize 监听
    if (typeof window !== 'undefined' && configStore.windowWidth === 1024) {
      configStore.initMobileDetection()
    }
    configStore.getConfig()
  }
  themeStore.setTheme('light')
  document.addEventListener('touchstart', preventZoom, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  window.addEventListener('message', handleInit)
})

// 监听 token 变化，重新连接或断开连接
watch(
  () => userStore.token,
  (newToken, oldToken) => {
    if (!import.meta.client || isNativeAppShell()) return
    if (newToken && !oldToken) {
      initNotificationSystem()
    } else if (!newToken && oldToken) {
      if (wsConnection) {
        wsConnection.disconnect()
        wsConnection = null
      }
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('touchstart', preventZoom);
  document.removeEventListener('gesturestart', (e) => e.preventDefault());
  window.removeEventListener('message', handleInit)
  
  // 断开 WebSocket 连接
  if (wsConnection) {
    wsConnection.disconnect()
    wsConnection = null
  }
});
</script> 
<template>
  <div class="min-h-screen background transition-colors duration-300">
    <Header v-show="layoutStyle === 0 && !isFromMobie" />
    <div v-show="layoutStyle === 0 && !isFromMobie" class="h-[80px]"></div>
    <div v-if="HarmonyOS" class="w-full h-full absolute top-0 left-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 bottom-0">
      <div class="container mx-auto px-4 py-6">
        <p>鸿蒙消息：{{ HarmonyOS }}</p>
      </div>
    </div>
    <main :class="layoutStyle === 0 && !isFromMobie ? 'container mx-auto pb-4  pt-1 min-h-screen' : ''">
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
    <footer v-show="layoutStyle === 0 && !isFromMobie" class="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 mt-8 left-0 bottom-0 w-full z-50" :class="isHome ? 'fixed' : ''">
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
        
        <div class="text-center mt-3 text-xs text-gray-500 dark:text-gray-400">
          <NuxtLink
            to="/features"
            class="text-qhx-primary hover:underline"
          >
            功能合集
          </NuxtLink>
          <span class="mx-2 text-gray-300 dark:text-gray-600">·</span>
          <span>全站入口导览</span>
        </div>

        <!-- 版权信息 -->
        <div class="text-center mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>&copy; 2019-2025 Lo研社. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
  <!-- <div class="min-h-screen background transition-colors duration-300" v-else>
    <main>
      <slot />
    </main>
  </div> -->
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
.vel-img-title{
  font-size: 16px;
}

/* 容器 */
.liquid-glass {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
}

/* 波纹层 */
.liquid-glass::before {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(255,255,255,0.2) 25%, transparent 70%);
  /* animation: liquid 6s infinite linear; */
}

/* 光泽层 */
.liquid-glass::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255,255,255,0.2), transparent, rgba(255,255,255,0.2));
  mix-blend-mode: overlay;
  /* animation: shine 5s infinite linear; */
}

/* 动画 */
/* @keyframes liquid {
  0% { transform: translate(0,0) rotate(0deg); }
  50% { transform: translate(25%,25%) rotate(180deg); }
  100% { transform: translate(0,0) rotate(360deg); }
} */

/* @keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
} */
</style>