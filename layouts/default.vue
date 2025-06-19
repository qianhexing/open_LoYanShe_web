<template>
  <div class="min-h-screen background transition-colors duration-300">
    <UNotifications position="top-0 right-0" />
    <Header />
    <main class="container mx-auto px-4 pt-20">
      <slot />
    </main>
    <main class="container">
      <slot name="screen"/>
    </main>
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
