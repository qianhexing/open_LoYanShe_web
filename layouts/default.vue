<template>
  <div class="min-h-screen bg-qhx-bg transition-colors duration-300">
    <UNotifications position="top-0 right-0" />
    <Header />
    <main class="container mx-auto px-4 pt-20">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const themeStore = useThemeStore()
useHead({
  htmlAttrs: {
    'data-theme': themeStore.currentTheme
  }
})
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
