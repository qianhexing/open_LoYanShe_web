<script setup lang="ts">
defineProps<{ error: string }>()
</script>

<template>
  <div
    class="max-w-[90%] rounded-2xl bg-[color-mix(in_srgb,var(--error-color),transparent_86%)] px-3.5 py-2 text-sm text-[var(--error-color)] shadow-[inset_3px_3px_8px_color-mix(in_srgb,var(--error-color),transparent_58%),inset_-3px_-3px_8px_var(--neo-inset-l)]">
    {{ error }}
  </div>
</template>
