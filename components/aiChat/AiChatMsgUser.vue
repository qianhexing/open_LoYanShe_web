<script setup lang="ts">
defineProps<{ text?: string }>()
</script>

<template>
  <div
    class="max-w-[90%] rounded-2xl rounded-tr-md bg-qhx-primary/22 px-3.5 py-2 text-sm leading-relaxed text-qhx-text shadow-[5px_5px_14px_var(--neo-raise-d),-4px_-4px_14px_var(--neo-raise-l)] dark:bg-qhx-primary/18">
    {{ text }}
  </div>
</template>
