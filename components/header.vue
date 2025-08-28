<template>
  <header class="fixed w-full top-0 z-50 border-b dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <!-- 左侧 Logo -->
        <NuxtLink to="/" class="text-xl font-bold text-gray-900 dark:text-white hidden md:flex">
          Lo 研社
        </NuxtLink>

        <!-- <div>{{ $t('header.home') }}</div> -->
        <!-- <h1 class="text-xl mt-4">{{ $t('welcome') }}</h1> -->
        <!-- 中间导航 -->
        <nav class="flex items-center gap-4  overflow-x-auto">
          <UButton v-for="item in navItems" :key="item.to" :to="item.to" variant="ghost" color="gray">
            {{ item.label }}
          </UButton>
        </nav>
        <div class=" flex items-center">
          <LocaleSwitcher class="mr-3"/>
           <!-- 右侧操作区 -->
          <div class="flex items-center gap-4" v-show="!user">
            <LoginBox />
          </div>
          <div class="flex items-center gap-4" v-show="user">
            <!-- <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name"
            class="w-8 h-8 object-cover rounded-[40px] border border-gray-200 my-2" loading="lazy" /> -->
            <UserBox></UserBox>
          </div>
        </div>
      </div>
    </header>
</template>

<script setup lang="ts">

const show = ref(true)
const userStore = storeToRefs(useUserStore()) 
const { user } = userStore
const { t } = useI18n()
const navItems = computed(() => [
  { label: t('header.home'), to: "/" },
  { label: t('header.library'), to: "/library" },
  { label: t('header.shop'), to: "/shop" },
  { label: t('header.collection'), to: "/compilations" },
  { label: t('header.community'), to: "/community" },
  { label: t('header.study'), to: "/study" },
])
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
