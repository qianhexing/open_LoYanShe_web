<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string
  }>(),
  { message: '关联已失效' }
)
</script>

<template>
  <p class="text-sm text-amber-600 dark:text-amber-400">{{ message }}</p>
</template>
