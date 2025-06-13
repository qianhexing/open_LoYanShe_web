<template>
  <UButton
    :icon="colorMode.value === 'dark' ? 'i-heroicons-moon' : 'i-heroicons-sun'"
    color="gray"
    variant="ghost"
    aria-label="切换主题"
    @click="toggleColorMode"
  />
</template>

<script setup lang="ts">
const colorMode = useColorMode()

// const toggleColorMode = () => {
//   colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
// }
</script> 
