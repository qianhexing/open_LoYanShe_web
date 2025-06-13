<template>
  <header class="fixed w-full top-0 z-50 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between">
      <!-- 左侧 Logo -->
      <NuxtLink to="/" class="text-xl font-bold text-gray-900 dark:text-white">
        Lo 研社
      </NuxtLink>

      <!-- 中间导航 -->
      <nav class="hidden md:flex items-center gap-4">
        <UButton
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          variant="ghost"
          color="gray"
        >
          {{ item.label }}
        </UButton>
      </nav>

      <!-- 右侧操作区 -->
      <div class="flex items-center gap-4">
        <UButton icon="i-heroicons-user-circle">
          登录
        </UButton>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const navItems = [
	{ label: "首页", to: "/" },
	{ label: "图鉴", to: "/library" },
	{ label: "店铺", to: "/shop" },
	{ label: "合集", to: "/compilations" },
	{ label: "社区", to: "/community" },
	{ label: "百科", to: "/lolitaWiki" },
];
</script>
