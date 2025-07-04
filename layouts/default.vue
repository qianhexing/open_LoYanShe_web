
<script setup lang="ts">
const themeStore = useThemeStore()
const userStore = useUserStore()
const times = ref(1)
const jumpToLoyanshe = () => {
  if (times.value >= 3) {
    window.location.href = 'https://a.app.qq.com/o/simple.jsp?pkgname=uni.lolita'
  } else {
    times.value += 1
  }
}
// 组件会自动导入
onMounted(() => {
  themeStore.setTheme('light')
  userStore.initialize()
  // themeStore.loadFromLocalStorage()
})
</script> 
<template>
  <div class="min-h-screen background transition-colors duration-300">
    <UNotifications position="top-0 right-0" />
    <Header />
    <main class="container mx-auto pb-4 pt-20">
      <slot />
    </main>
    <main class="container">
      <slot name="screen"/>
    </main>
    <div class="fixed w-full z-50 bottom-0 left-0 text-center">
      <div class="flex justify-center">
        <a href="https://beian.miit.gov.cn/" target="_blank" class="flex justify-center"><img src="https://lolitalibrary.com/ali/static/batb.png" > 闽ICP备19007279号-1</a>
      </div>
      <div>
        <a href="https://afdian.com/a/qianhexing" style="color: #409EFF; margin-right: 10px;" target="_blank">赞助:爱发电@千河星</a>
        <a href="https://weibo.com/u/6052516131" style="color: #409EFF; margin-right: 10px;" target="_blank">微博:@千河星</a>
        <a href="https://www.xiaohongshu.com/user/profile/64845f56000000000f006100" style="color: #409EFF; margin-right: 10px;" target="_blank">小红书:@千河星</a>
        <span href="https://afdian.com/a/qianhexing" style="color: #409EFF; margin-right: 10px;" target="_blank" @click="jumpToLoyanshe()">Lo研社</span>
        <!-- <p>IP地址位置数据由<a href="https://www.cz88.net">纯真CZ88</a>提供支持</p> -->
      </div>
    </div>
  </div>
</template>

<style>
.background{
  background-color: var(--background-color);
}
</style>
