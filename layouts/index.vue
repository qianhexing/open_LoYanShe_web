<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="border-t py-4">
      <div class="container mx-auto px-4 text-center text-gray-500">
        <p>© {{ new Date().getFullYear() }} 我的网站. 保留所有权利.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import Header from '~/components/header.vue'
</script>
