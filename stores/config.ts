// stores/config.ts
import { defineStore } from 'pinia'
import { getConfig } from '@/api/index'
import type { Config } from '@/types/api'
import { useCookie } from '#app'

interface configState {
  isPc: boolean
  config?: Config | null
  loading: boolean
}
export const useConfigStore = defineStore('config', {
  state: ():configState => ({
    isPc: true,
    config: null,
    loading: false
  }),
  
  actions: {
    setIsPc(isPc: boolean) {
      this.isPc = isPc
    },
    
    async getConfig(forceRefresh = false) {
      // 已有缓存且不强制刷新
      const storedConfig = sessionStorage.getItem('app_config');
      if (storedConfig && !forceRefresh) {
        this.config = JSON.parse(storedConfig); // 解析存储的 JSON
        return this.config;
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
        sessionStorage.setItem('app_config', JSON.stringify(this.config));
        return response
      } catch (err) {
      } finally {
        this.loading = false
      }
    }
  }
})