// stores/config.ts
import { defineStore } from 'pinia'
import { getConfig } from '@/api/index'
import type { Config } from '@/types/api'
import { useCookie } from '#app'

interface configState {
  isPc: boolean
  config?: Config | null
  loading: boolean
  port: MessagePort | null
  isMobile: boolean
  windowWidth: number
}
export const useConfigStore = defineStore('config', {
  state: ():configState => ({
    isPc: true,
    config: null,
    loading: false,
    port: null as MessagePort | null, // 鸿蒙 WebView 的 MessagePort
    isMobile: false,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
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
    async getConfig(forceRefresh = false) {
      // 已有缓存且不强制刷新
      if (process.client && typeof window !== 'undefined' && window.sessionStorage) {
      const storedConfig = sessionStorage.getItem('app_config');
        if (storedConfig && !forceRefresh) {
          this.config = JSON.parse(storedConfig); // 解析存储的 JSON
          return this.config;
        }
      }
      
      this.loading = true
      try {
        
        const response = await getConfig()
        // try {
        //   configCookie.value = response
        // } catch (error) {
        //   console.log(error, '配置错误')
        // }
        // 更新状态
        this.config = response
        if (process.client && typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('app_config', JSON.stringify(this.config));
        }
        return response
      } catch (err) {
      } finally {
        this.loading = false
      }
    }
  }
})