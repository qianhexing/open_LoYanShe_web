/**
 * WebSocket 公共方法
 * 基于 test-websocket.html 封装的可复用 WebSocket 连接管理
 */

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WebSocketMessage {
  type: string
  data?: any
  message?: string
  userId?: number | string
  connectionId?: string | number
  [key: string]: any
}

export interface WebSocketOptions {
  /** WebSocket 服务器地址 */
  url: string
  /** 认证 token */
  token?: string
  /** 心跳间隔（毫秒），默认 30000 */
  heartbeatInterval?: number
  /** 是否自动重连，默认 false */
  autoReconnect?: boolean
  /** 自动重连最大次数，默认 5 */
  maxReconnectAttempts?: number
  /** 自动重连延迟（毫秒），默认 3000 */
  reconnectDelay?: number
  /** 连接成功回调 */
  onOpen?: (event: Event) => void
  /** 消息接收回调 */
  onMessage?: (message: WebSocketMessage) => void
  /** 错误回调 */
  onError?: (error: Event) => void
  /** 关闭回调 */
  onClose?: (event: CloseEvent) => void
  /** 连接成功回调（服务器返回 connected 类型消息时） */
  onConnected?: (data: WebSocketMessage) => void
}

export const useWebSocket = (options?: WebSocketOptions) => {
  // 响应式状态
  const status = ref<WebSocketStatus>('disconnected')
  const ws = ref<WebSocket | null>(null)
  const userId = ref<number | string | null>(null)
  const connectionId = ref<string | number | null>(null)
  const messageCount = ref(0)
  const reconnectAttempts = ref(0)
  const messages = ref<Array<{ type: string; content: string; data?: any; timestamp: Date }>>([])

  // 内部状态
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentOptions: WebSocketOptions | null = null

  /**
   * 开始心跳检测
   */
  const startHeartbeat = () => {
    stopHeartbeat()
    if (!currentOptions) return

    const interval = currentOptions.heartbeatInterval || 30000
    heartbeatTimer = setInterval(() => {
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        try {
          ws.value.send(JSON.stringify({ type: 'ping' }))
        } catch (error) {
          console.error('发送心跳失败:', error)
        }
      }
    }, interval)
  }

  /**
   * 停止心跳检测
   */
  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 添加消息到历史记录
   */
  const addMessage = (type: string, content: string, data?: any) => {
    messages.value.push({
      type,
      content,
      data,
      timestamp: new Date()
    })
    messageCount.value++
  }

  /**
   * 清空消息历史
   */
  const clearMessages = () => {
    messages.value = []
    messageCount.value = 0
  }

  /**
   * 自动重连
   */
  const attemptReconnect = () => {
    if (!currentOptions?.autoReconnect) return

    const maxAttempts = currentOptions.maxReconnectAttempts || 5
    const delay = currentOptions.reconnectDelay || 3000

    if (reconnectAttempts.value >= maxAttempts) {
      console.error('达到最大重连次数，停止重连')
      status.value = 'error'
      return
    }

    reconnectAttempts.value++
    status.value = 'connecting'
    addMessage('info', `正在尝试重连 (${reconnectAttempts.value}/${maxAttempts})...`)

    reconnectTimer = setTimeout(() => {
      if (currentOptions) {
        connect(currentOptions)
      }
    }, delay)
  }

  /**
   * 停止自动重连
   */
  const stopReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempts.value = 0
  }

  /**
   * 建立 WebSocket 连接
   */
  const connect = (opts?: WebSocketOptions) => {
    // 如果已有连接，先断开
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      disconnect()
    }

    // 合并选项
    currentOptions = opts || currentOptions || options
    if (!currentOptions) {
      console.error('WebSocket 选项未配置')
      return
    }

    const { url, token, onOpen, onMessage, onError, onClose, onConnected } = currentOptions

    if (!url) {
      console.error('WebSocket URL 未配置')
      status.value = 'error'
      return
    }

    // 构建 WebSocket URL（通过 query 参数传递 token）
    let wsUrl = url
    if (token) {
      const separator = url.includes('?') ? '&' : '?'
      wsUrl = `${url}${separator}token=${encodeURIComponent(token)}`
    }

    status.value = 'connecting'
    addMessage('info', `正在连接到: ${url}`)

    try {
      const websocket = new WebSocket(wsUrl)
      ws.value = websocket

      // 连接打开
      websocket.onopen = (event) => {
        status.value = 'connected'
        addMessage('connected', 'WebSocket 连接已建立')
        startHeartbeat()
        stopReconnect() // 连接成功，重置重连计数
        reconnectAttempts.value = 0
        onOpen?.(event)
      }

      // 接收消息
      websocket.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data)

          if (data.type === 'connected') {
            status.value = 'connected'
            userId.value = data.userId ?? null
            connectionId.value = data.connectionId ?? null
            addMessage('connected', '连接成功', data)
            onConnected?.(data)
          } else if (data.type === 'notification') {
            addMessage('notification', '收到通知', data.data)
            onMessage?.(data)
          } else if (data.type === 'error') {
            addMessage('error', data.message || '发生错误', data)
            onMessage?.(data)
          } else if (data.type === 'pong') {
            // 心跳响应，不记录到消息历史
            console.log('收到心跳响应')
          } else {
            addMessage('info', '收到消息', data)
            onMessage?.(data)
          }
        } catch (e) {
          // 非 JSON 格式消息
          addMessage('info', '收到消息（非JSON格式）', { raw: event.data })
          onMessage?.({ type: 'raw', data: event.data } as WebSocketMessage)
        }
      }

      // 连接错误
      websocket.onerror = (error) => {
        status.value = 'error'
        addMessage('error', 'WebSocket 连接错误', { error: error.toString() })
        onError?.(error)
      }

      // 连接关闭
      websocket.onclose = (event) => {
        status.value = 'disconnected'
        addMessage('info', `连接已关闭 (代码: ${event.code}, 原因: ${event.reason || '无'})`)
        
        // 清空状态信息
        userId.value = null
        connectionId.value = null
        
        stopHeartbeat()
        onClose?.(event)

        // 如果不是主动关闭，尝试重连
        if (event.code !== 1000 && currentOptions?.autoReconnect) {
          attemptReconnect()
        }
      }
    } catch (error) {
      status.value = 'error'
      addMessage('error', '创建 WebSocket 连接失败', { error: error?.toString() })
      console.error('WebSocket 连接失败:', error)
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  const disconnect = () => {
    stopHeartbeat()
    stopReconnect()
    
    if (ws.value) {
      ws.value.close(1000, '主动断开连接')
      ws.value = null
    }
    
    status.value = 'disconnected'
    userId.value = null
    connectionId.value = null
  }

  /**
   * 发送消息
   */
  const send = (data: any) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法发送消息')
      return false
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      ws.value.send(message)
      return true
    } catch (error) {
      console.error('发送消息失败:', error)
      addMessage('error', '发送消息失败', { error: error?.toString() })
      return false
    }
  }

  /**
   * 检查连接状态
   */
  const isConnected = computed(() => status.value === 'connected' && ws.value?.readyState === WebSocket.OPEN)

  // 页面卸载时断开连接
  if (process.client) {
    onBeforeUnmount(() => {
      disconnect()
    })
  }

  // 如果提供了初始选项，自动连接
  if (options && process.client) {
    onMounted(() => {
      connect(options)
    })
  }

  return {
    // 状态
    status: readonly(status),
    userId: readonly(userId),
    connectionId: readonly(connectionId),
    messageCount: readonly(messageCount),
    messages: readonly(messages),
    isConnected,
    
    // 方法
    connect,
    disconnect,
    send,
    clearMessages,
    
    // 内部方法（可选暴露）
    startHeartbeat,
    stopHeartbeat
  }
}

