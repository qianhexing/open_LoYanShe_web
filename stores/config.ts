// stores/config.ts
import { defineStore } from 'pinia'
import { getConfig } from '@/api/index'
import type { Config } from '@/types/api'

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
      if (this.config && !forceRefresh) return this.config
      
      this.loading = true
      try {
        
        const response = await getConfig()

        // 更新状态
        this.config = response
        console.log(response, '返回配置')
        return response
      } catch (err) {
      } finally {
        this.loading = false
      }
    }
  }
})