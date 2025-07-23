<template>
  <header class="fixed w-full top-0 z-50 border-b dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <!-- 左侧 Logo -->
        <NuxtLink to="/" class="text-xl font-bold text-gray-900 dark:text-white hidden md:flex">
          Lo 研社
        </NuxtLink>

        <!-- 中间导航 -->
        <nav class="flex items-center gap-4  overflow-x-auto">
          <UButton v-for="item in navItems" :key="item.to" :to="item.to" variant="ghost" color="gray">
            {{ item.label }}
          </UButton>
        </nav>

        <!-- 右侧操作区 -->
        <div class="flex items-center gap-4" v-if="!user">
          <LoginBox />
        </div>
        <div class="flex items-center gap-4" v-show="user">
          <!-- <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name"
          class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" /> -->
          <UserBox></UserBox>
        </div>
      </div>
    </header>
</template>

<script setup lang="ts">

const show = ref(true)
const userStore = storeToRefs(useUserStore()) 
const { user } = userStore

const navItems = [
  { label: "首页", to: "/" },
  { label: "图鉴", to: "/library" },
  { label: "店铺", to: "/shop" },
  { label: "合集", to: "/compilations" },
  { label: "社区", to: "/community" },
  // { label: "百科", to: "/lolitaWiki" },
  { label: "研习", to: "/study" },
];
const handleMouseEnter = () => {
  show.value = true
  console.log('显示')
}
const handleMouseLeave = () => {
  show.value = false
}

onMounted(() => {
  setTimeout(() => {
    show.value = false
  }, 3000);
})
</script>
