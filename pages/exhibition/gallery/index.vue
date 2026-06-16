<script lang="ts">
definePageMeta({ name: 'gallery-index' })
</script>

<script setup lang="ts">
import { DEFAULT_GALLERY_ID } from '@/utils/galleryConfig'

await navigateTo(`/exhibition/gallery/${DEFAULT_GALLERY_ID}`, { replace: true })
</script>

<template>
  <div />
</template>
