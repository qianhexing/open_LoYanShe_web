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
        qq群： 679654177 联系我 qq账号：3292658709 <a href="https://weibo.com/u/6052516131" style="color: #409EFF;" target="_blank">@千河星</a>
        <!-- <p>IP地址位置数据由<a href="https://www.cz88.net">纯真CZ88</a>提供支持</p> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const themeStore = useThemeStore()
// 组件会自动导入
onMounted(() => {
  themeStore.setTheme('light')
  // themeStore.loadFromLocalStorage()
})
</script> 
<style>
.background{
  background-color: var(--background-color);
}
</style>
