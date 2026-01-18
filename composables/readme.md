# composable目录说明

放置在这个目录视为组合式函数，Nuxt 也会自动引入这些组合式函数，让需要使用的页面或组件可以直接做使用。
[官网文档地址](https://nuxt.com/docs/guide/directory-structure/composables)
### 项目自定义组合式函数
- httpCore
  - 在组件中直接use$XXX使用就好

- useWebSocket
  - WebSocket 连接管理工具
  - 支持自动重连、心跳检测、消息历史等功能
  - 使用示例：
  ```typescript
  const { status, connect, disconnect, send, isConnected, messages } = useWebSocket({
    url: 'ws://localhost:3000/getNotice',
    token: 'your-token',
    autoReconnect: true,
    heartbeatInterval: 30000,
    onMessage: (message) => {
      console.log('收到消息:', message)
    },
    onConnected: (data) => {
      console.log('连接成功:', data)
    }
  })
  ```