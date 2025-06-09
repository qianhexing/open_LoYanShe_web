// stores/auth.ts
import { defineStore } from 'pinia'

export const useUserStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as any,
  }),
  
  actions: {
    // 使用 localStorage 存储 token
    setToken(token: string) {
      this.token = token
      if (import.meta.client) { // 新的客户端环境检查方式
        localStorage.setItem('token', token)
      }
    },
    
    // 从 localStorage 加载 token
    loadToken() {
      if (import.meta.client) {
        const token = localStorage.getItem('token')
        if (token) this.token = token
      }
    },
    
    // 清除 token
    clearToken() {
      this.token = null
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem('token')
      }
    },
    
    // 初始化时加载 token
    initialize() {
      this.loadToken()
      if (this.token) {
        // this.fetchUser()
      }
    }
  }
})