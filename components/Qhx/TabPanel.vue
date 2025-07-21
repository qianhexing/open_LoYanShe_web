<template>
  <div class="w-full">
    <div v-show="isActive">
      <slot />
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'

const props = defineProps<{
  index: number
}>()

const currentIndex = inject('currentIndex') as Ref<number>
const isActive = computed(() => currentIndex.value === props.index)
</script>