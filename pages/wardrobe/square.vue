<script setup lang="ts">
definePageMeta({
  ssr: false,
})

import WardrobeSquare from '@/components/Wardrobe/WardrobeSquare.vue'

useSeoMeta({
  title: '逛逛',
  description: '随机翻看公开衣柜',
})
</script>

<template>
  <WardrobeSquare />
</template>
