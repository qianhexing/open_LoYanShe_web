<script lang="ts" setup>
const { awesome } = useAppConfig()
definePageMeta({ layout: 'page' })
useHead({ titleTemplate: '', title: awesome?.name || 'Lo研社' })
</script>

<template>
  <div class="flex items-center justify-center h-screen w-screen">
    <div class="text-4xl font-bold">Lo研社</div>
  </div>
</template>
