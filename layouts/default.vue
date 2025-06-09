<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
    <UNotifications position="top-0 right-0" />
    <Header />
    <main class="container mx-auto px-4 pt-20">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// 组件会自动导入
</script> 
