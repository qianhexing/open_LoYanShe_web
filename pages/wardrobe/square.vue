<script setup lang="ts">
definePageMeta({
  ssr: false,
})

import WardrobeSquare from '@/components/Wardrobe/WardrobeSquare.vue'

const { t } = useI18n()

useSeoMeta({
  title: t('wardrobe.square.title'),
  description: t('wardrobe.square.description'),
})
</script>

<template>
  <WardrobeSquare />
</template>
