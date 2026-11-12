// stores/config.ts
import { defineStore } from 'pinia'
import { getConfig } from '@/api/index'
import type { Config } from '@/types/api'

/** App 嵌入多页跳转复用：localStorage 缓存 1 小时，避免每个 WebView 冷启动都打 /config */
const APP_CONFIG_STORAGE_KEY = 'app_config_v1'
const APP_CONFIG_TTL_MS = 60 * 60 * 1000

interface StoredAppConfig {
  savedAt: number
  config: Config
}

function readCachedConfig(): Config | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = localStorage.getItem(APP_CONFIG_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAppConfig
    if (!parsed?.config || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > APP_CONFIG_TTL_MS) {
      localStorage.removeItem(APP_CONFIG_STORAGE_KEY)
      return null
    }
    return parsed.config
  } catch {
    try {
      localStorage.removeItem(APP_CONFIG_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

function writeCachedConfig(config: Config) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const payload: StoredAppConfig = { savedAt: Date.now(), config }
    localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

/** layout 中 import('@dcloudio/uni-webview-js') 后缓存，避免各处重复动态 import */
export interface UniWebviewJsModule {
  navigateTo?: (options: { url: string; fail?: (err?: unknown) => void }) => void
}

interface configState {
  isPc: boolean
  config?: Config | null
  loading: boolean
  port: MessagePort | null
  isMobile: boolean
  windowWidth: number
  statusBarHeight: number
  /**
   * iOS Tab 内嵌外链底部留白（pt，含安全区）。
   * 来自 query `tabbar`；盖层二级页不带，保持 0。
   */
  tabBarHeight: number
  /** 仅在 Html5Plus 环境下由 layout 注入，普通浏览器为 null */
  uniWebviewJs: UniWebviewJsModule | null
}
export const useConfigStore = defineStore('config', {
  state: ():configState => ({
    isPc: true,
    config: null,
    loading: false,
    port: null as MessagePort | null, // 鸿蒙 WebView 的 MessagePort
    isMobile: false,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    statusBarHeight: 0,
    tabBarHeight: 0,
    uniWebviewJs: null
  }),
  
  getters: {
    // 判断是否为移动端（窗口宽度小于 768px）
    checkIsMobile(): boolean {
      return this.windowWidth < 768
    }
  },
  
  actions: {
    setIsPc(isPc: boolean) {
      this.isPc = isPc
    },
    // 更新窗口宽度并重新计算是否移动端
    updateWindowWidth(width: number) {
      this.windowWidth = width
      this.isMobile = this.checkIsMobile
    },
    // 初始化移动端检测（在组件挂载时调用）
    initMobileDetection() {
      if (typeof window === 'undefined') return
      
      this.windowWidth = window.innerWidth
      this.isMobile = this.checkIsMobile
      
      // 监听窗口大小变化
      const handleResize = () => {
        this.updateWindowWidth(window.innerWidth)
      }
      
      window.addEventListener('resize', handleResize)
      
      // 返回清理函数（可选，用于组件卸载时清理）
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    },
    setPort(port: MessagePort) {
      this.port = port
    },
    getPort() {
      return this.port
    },
    clearPort() {
      this.port = null
    },
    setStatusBarHeight(height: number) {
      this.statusBarHeight = height
    },
    getStatusBarHeight() {
      return this.statusBarHeight
    },
    setTabBarHeight(height: number) {
      this.tabBarHeight = height > 0 ? height : 0
    },
    getTabBarHeight() {
      return this.tabBarHeight
    },
    setUniWebviewJs(mod: UniWebviewJsModule | null) {
      this.uniWebviewJs = mod
    },
    async getConfig(forceRefresh = false) {
      // 内存已有且不强制刷新
      if (this.config && !forceRefresh) {
        return this.config
      }

      // localStorage 1h 缓存：嵌入页跳转 / 新开 WebView 同域可复用
      if (import.meta.client && !forceRefresh) {
        const cached = readCachedConfig()
        if (cached) {
          this.config = cached
          return cached
        }
      }

      this.loading = true
      try {
        const response = await getConfig()
        this.config = response
        if (import.meta.client) {
          writeCachedConfig(response)
        }
        return response
      } catch {
        // 请求失败时若有过期缓存也可兜底（仍超过 TTL 则没有）
        if (import.meta.client && !this.config) {
          try {
            const raw = localStorage.getItem(APP_CONFIG_STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw) as StoredAppConfig
              if (parsed?.config) {
                this.config = parsed.config
                return parsed.config
              }
            }
          } catch {
            /* ignore */
          }
        }
      } finally {
        this.loading = false
      }
    }
  }
})