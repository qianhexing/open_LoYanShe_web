// stores/auth.ts
import { defineStore } from 'pinia'
import { loginIn, registerUser, sendVerificationCode } from '@/api/user'
import type { Permission } from '@/api/user'
import type { User } from '@/types/api';

export const useUserStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as User | null,
    permission: [] as Permission[]

  }),
  
  actions: {
    // 登录方法
    async login(phone: string, password: string) {
      try {
        // 调用API登录
        const response = await loginIn({
          user_phone: phone,
          user_password: password
        })
        
        // 假设返回数据中有token字段
        this.setToken(response.token)
        // 可以在这里存储用户信息
        if (response.data) {
          this.setUserInfo({
            user_id: response.data.userId,
            user_name: response.data.userName,
            user_face: response.data.userFace
          })
        } else {
          this.user = null
        }
        this.permission = response.permission
        window.location.reload()
        return Promise.resolve(response)
      } catch (error) {
        this.clearToken()
        return Promise.reject(error)
      }
    },
    // 使用 localStorage 存储 token
    setToken(token: string) {
      this.token = token
      if (import.meta.client) { // 新的客户端环境检查方式
        localStorage.setItem('token', token)
      }
    },
    // 使用 localStorage 存储 token
    setUserInfo(user: User) {
      this.user = user
      if (import.meta.client) { // 新的客户端环境检查方式
        localStorage.setItem('userInfo', JSON.stringify(user))
      }
    },
    
    // 从 localStorage 加载 token
    loadToken() {
      if (import.meta.client) {
        const token = localStorage.getItem('token')
        if (token) this.token = token
        const userInfo = localStorage.getItem('userInfo')
        if (userInfo) {
          try{
            this.user = JSON.parse(userInfo)
          } catch(error) {
            console.log('设置用户信息错误')
          }
        }
        console.log('当前', this.token, this.user)
      }
    },
    
    // 清除 token
    clearToken() {
      this.token = null
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        window.location.reload()
      }
    },

    // 注册方法
    async register(params: {
      user_phone: string
      user_name: string
      user_password: string
      phone_code: string
      verification_code: string
    }) {
      try {
        const response = await registerUser(params)
        
        // 注册成功后自动登录
        this.setToken(response.token)
        if (response.data) {
          this.setUserInfo({
            user_id: response.data.userId,
            user_name: response.data.userName,
            user_face: response.data.userFace
          })
        }
        this.permission = response.permission
        return Promise.resolve(response)
      } catch (error) {
        return Promise.reject(error)
      }
    },

    // 发送验证码
    async sendCode(phone: string, phoneCode: string) {
      try {
        const response = await sendVerificationCode({
          user_phone: phone,
          phone_code: phoneCode
        })
        return Promise.resolve(response)
      } catch (error) {
        return Promise.reject(error)
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