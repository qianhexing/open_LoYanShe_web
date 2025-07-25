<template>
  <div class="w-full">
    <div v-show="isActive">
      <slot :currentIndex="currentIndex" :isActive="isActive" :firstLoading="firstLoading"/>
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'

const props = defineProps<{
  index: number
}>()
const firstLoading = ref(false)

const currentIndex = inject('currentIndex') as Ref<number>
const isActive = computed(() => {
  if (currentIndex.value === props.index) {
    firstLoading.value = true
  }
  return currentIndex.value === props.index
})
</script>