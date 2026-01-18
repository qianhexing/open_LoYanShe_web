/**
 * 通知系统 - 基于 WebSocket 的实时通知管理
 */

import type { WebSocketMessage } from './useWebSocket'

export interface NotificationData {
  id?: string | number
  title?: string
  content?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  icon?: string
  color?: string
  [key: string]: any
}

// 全局 WebSocket send 方法引用（用于多实例共享）
type WebSocketSendFn = (data: Record<string, unknown> | string) => boolean
let globalWsSend: WebSocketSendFn | null = null

export const useNotification = () => {
  const toast = useToast()
  const userStore = useUserStore()

  /**
   * 获取 WebSocket 地址
   * 根据环境自动选择开发或生产地址
   */
  const getWebSocketUrl = (): string => {
    if (process.client) {
      const hostname = window.location.hostname
      // 开发环境
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'ws://localhost:3003/getNotice'
      }
      // 生产环境 - 根据实际配置调整
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${hostname}:3003/getNotice`
    }
    // 默认开发环境
    return 'ws://localhost:3003/getNotice'
  }

  /**
   * 获取 token
   */
  const getToken = (): string | null => {
    if (process.client) {
      // 优先从 store 获取
      if (userStore.token) {
        return userStore.token
      }
      // 从 cookie 获取
      const cookieToken = useCookie('token').value
      if (cookieToken) {
        return cookieToken
      }
      // 从 localStorage 获取
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem('token')
      }
    }
    return null
  }

  /**
   * 处理通知消息
   */
  const handleNotification = (data: NotificationData) => {
    // 显示通知
    // toast.add({
    //   title: data.title || '新通知',
    //   description: data.content || '',
    //   icon: data.icon || 'i-heroicons-bell',
    //   color: data.color || (data.type === 'error' ? 'red' : data.type === 'success' ? 'green' : data.type === 'warning' ? 'orange' : 'primary'),
    //   timeout: 5000
    // })

    // 可以在这里添加其他处理逻辑，比如：
    // - 更新通知数量
    // - 播放提示音
    // - 存储到本地
    console.log('收到通知:', data)
    
    // 设置通知状态为 true
    userStore.setHasNotification(true)
  }

  /**
   * 处理清除通知消息（用于多页签同步）
   */
  const handleClearNotification = () => {
    console.log('收到清除通知消息')
    // 清除通知状态
    userStore.setHasNotification(false)
  }

  /**
   * 标记通知为已读，发送消息给服务器
   */
  const markNotificationAsRead = () => {
    if (!globalWsSend) {
      console.warn('WebSocket 未连接，无法发送已读消息')
      // 即使 WebSocket 未连接，也清除本地通知状态
      userStore.setHasNotification(false)
      return false
    }

    try {
      const success = globalWsSend({
        type: 'notification_read'
      })
      
      if (success) {
        console.log('已发送通知已读消息')
        // 本地也清除通知状态
        userStore.setHasNotification(false)
      } else {
        // 发送失败，也清除本地状态（避免用户重复点击）
        userStore.setHasNotification(false)
      }
      
      return success
    } catch (error) {
      console.error('发送通知已读消息失败:', error)
      // 出错时也清除本地状态
      userStore.setHasNotification(false)
      return false
    }
  }

  /**
   * 初始化 WebSocket 连接
   */
  const initWebSocket = () => {
    const token = getToken()
    
    if (!token) {
      console.log('未找到 token，跳过 WebSocket 连接')
      return null
    }

    const wsUrl = getWebSocketUrl()
    console.log('初始化 WebSocket 连接:', wsUrl)

    const { connect, disconnect, status, isConnected, send } = useWebSocket({
      url: wsUrl,
      token: token,
      autoReconnect: true,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
      onConnected: (data) => {
        console.log('WebSocket 连接成功:', data)
      },
      onMessage: (message: WebSocketMessage) => {
        // 处理不同类型的消息
        if (message.type === 'notification') {
          // 通知类型消息
          handleNotification(message.data || message)
        } else if (message.type === 'clear_notification') {
          // 清除通知类型消息（用于多页签同步）
          handleClearNotification()
        } else if (message.type === 'debug') {
          // handleNotification(message.data || message)

          // 错误消息
          // toast.add({
          //   title: '调试',
          //   description: message.message || '发生调试',
          //   icon: 'i-heroicons-x-circle',
          //   color: 'blue'
          // })
        } else if (message.type === 'error') {
          // 错误消息
          toast.add({
            title: '错误',
            description: message.message || '发生错误',
            icon: 'i-heroicons-x-circle',
            color: 'red'
          })
        } else {
          // 其他类型消息
          console.log('收到消息:', message)
        }
      },
      onError: (error) => {
        console.error('WebSocket 错误:', error)
      },
      onClose: (event) => {
        console.log('WebSocket 连接关闭:', event.code, event.reason)
        // 连接关闭时清空全局 send 方法引用
        globalWsSend = null
      }
    })

    // 保存 send 方法引用到全局变量（用于多实例共享）
    globalWsSend = send

    // 自动连接
    connect()

    return {
      connect,
      disconnect,
      status,
      isConnected,
      markNotificationAsRead
    }
  }

  return {
    initWebSocket,
    getToken,
    getWebSocketUrl,
    markNotificationAsRead
  }
}

