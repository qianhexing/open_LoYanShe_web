// stores/config.ts
import { defineStore } from 'pinia'
import { wardrobeConfig } from '@/api/wardrobe'
import type { Config } from '@/types/api'
import type { WardrobeConfigInterface  } from '@/api/wardrobe'


interface configState {
  config?: WardrobeConfigInterface | null
}
export const useWardrobeStore = defineStore('wardrobe', {
  state: ():configState => ({
    config: null,
  }),
  
  actions: {
    async getWardrobeConfig(forceRefresh = false) {
      try {
        
        const response = await wardrobeConfig()
        // try {
        //   configCookie.value = response
        // } catch (error) {
        //   console.log(error, '配置错误')
        // }
        // 更新状态
        const clothes_part: Array<string>= []
        const data = {
          ...response
        }
        // biome-ignore lint/complexity/noForEach: <explanation>
        response.clothes_part.forEach((child) => { child.split(',').forEach((item2) => {clothes_part.push(item2)}) })
        data.clothes_part = [...new Set(clothes_part)]
        this.config = data
        return data
      } catch (err) {
      }
    }
  }
})