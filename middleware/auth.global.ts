export default defineNuxtRouteMiddleware((to, from) => {
  if (!process.client) return
  // const token = localStorage.getItem('token')
  const token = null


  if (!token && to.path !== '/login') {
    // ⚠️ 只有客户端执行时才有 useToast
    // const toast = useToast()
    // toast.add({
    //   title: '请先登录',
    //   description: '请先登录后访问',
    //   color: 'red',
    //   icon: 'warning'
    // })
    // return navigateTo(from?.path && (from.path !== to.path || to.path === '/') ? from.path : '/')
    // return navigateTo('/')
  }

  if (token && to.path === '/login') {
    return navigateTo('/')
  }
})
