// stores/auth.ts
import { defineStore } from 'pinia'
import { loginIn, registerUser, sendVerificationCode, getUserMy, changeUserInfo } from '@/api/user'
import type { Permission } from '@/api/user'
import type { User } from '@/types/api';

export const useUserStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as User | null,
    permission: [] as Permission[],
    hasNotification: false as boolean

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
        // 调用 getUserMy 获取完整用户信息并缓存
        if (response.data) {
          try {
            const userInfo = await getUserMy()
            this.setUserInfo(userInfo)
          } catch (error) {
            // 如果获取失败，使用登录返回的基础信息
            this.setUserInfo({
              user_id: response.data.userId,
              user_name: response.data.userName,
              user_face: response.data.userFace,
              permission_list: response.data.permission_list || response.permission.map(item => item.permissions)
            })
          }
        } else {
          this.user = null
        }
        this.permission = response.permission
        // window.location.reload()
        return Promise.resolve(response)
      } catch (error) {
        // this.clearToken()
        return Promise.reject(error)
      }
    },
    // 使用 localStorage 存储 token
    setToken(token: string) {
      this.token = token
      if (process.client && typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('token', token)
      }
    },
    // 使用 localStorage 存储 token
    setUserInfo(user: User) {
      this.user = user
      if (process.client && typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('userInfo', JSON.stringify(user))
      }
    },
    
    // 从 localStorage 加载 token
    loadToken() {
      return new Promise((resolve, reject) => {
        if (process.client && typeof window !== 'undefined' && window.localStorage) {
          let token: string | null = null
          
          let userInfo: string | null = null
          try {
            token = localStorage.getItem('token')
            userInfo = localStorage.getItem('userInfo')
          } catch (error) {
            console.log('获取用户信息错误')
          }
          if (token) this.token = token
          if (userInfo) {
            try{
              this.user = JSON.parse(userInfo)
            } catch(error) {
              console.log('设置用户信息错误')
            }
          }
          console.log('当前', this.token, this.user)
        }
        resolve(true)
      })
      
    },
    
    // 清除 token
    clearToken() {
      this.token = null
      this.user = null
      if (process.client && typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        window.location.reload()
      }
    },
    clearUserInfo() {
      this.user = null
      this.token = null
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
      }
    },

    // 注册方法
    async register(params: {
      user_phone: string
      user_name: string
      user_password: string
      sms_code: string
    }) {
      try {
        const response = await registerUser(params)
        
        // 注册成功后自动登录
        // this.setToken(response.token)
        // if (response.data) {
        //   this.setUserInfo({
        //     user_id: response.data.userId,
        //     user_name: response.data.userName,
        //     user_face: response.data.userFace
        //   })
        // }
        // this.permission = response.permission
        await this.login(params.user_phone, params.user_password)
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
    async initialize() {
      await this.loadToken()
      if (this.token) {
        // this.fetchUser()
      }
    },
    
    // 检查权限
    hasPermi(permission: string): boolean {
      // 优先使用 user.permission_list
      if (this.user?.permission_list && this.user.permission_list.length > 0) {
        return this.user.permission_list.some(p => p === permission)
      }
      // 如果没有 permission_list，使用 this.permission
      if (this.permission && this.permission.length > 0) {
        return this.permission.some(p => p.permissions === permission)
      }
      console.log(permission, 'permission')
      return false
    },
    
    // 设置通知状态
    setHasNotification(hasNotification: boolean) {
      this.hasNotification = hasNotification
    },
    
    // 获取用户信息并更新 store
    async fetchUserInfo() {
      try {
        const userInfo = await getUserMy()
        this.setUserInfo(userInfo)
        return userInfo
      } catch (error) {
        console.error('获取用户信息失败:', error)
        throw error
      }
    },
    
    // 更新用户信息并重新拉取数据缓存
    async updateUserInfo(params: User) {
      try {
        // 保存用户信息
        await changeUserInfo(params)
        // 重新拉取用户信息并更新 store
        await this.fetchUserInfo()
        return this.user
      } catch (error) {
        console.error('更新用户信息失败:', error)
        throw error
      }
    },
    
    // 更新消息配置（仅更新 message_config）
    // async updateMessageConfig(messageConfig: Record<string, unknown>) {
    //   try {
    //     // 获取现有的 message_config
    //     const userWithConfig = this.user as User & { message_config?: string | Record<string, unknown> }
    //     let config: Record<string, unknown> = {}
        
    //     if (userWithConfig?.message_config) {
    //       try {
    //         config = typeof userWithConfig.message_config === 'string'
    //           ? JSON.parse(userWithConfig.message_config)
    //           : userWithConfig.message_config
    //       } catch (error) {
    //         console.error('解析现有 message_config 失败:', error)
    //         config = {}
    //       }
    //     }
        
    //     // 合并新的配置
    //     config = { ...config, ...messageConfig }
        
    //     // 更新用户信息并重新拉取数据
    //     await this.updateUserInfo({
    //       message_config: config
    //     })
        
    //     return this.user
    //   } catch (error) {
    //     console.error('更新消息配置失败:', error)
    //     throw error
    //   }
    // }
  }
})