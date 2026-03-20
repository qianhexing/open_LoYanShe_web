<template>
  <div class="w-full">
    <Transition name="tab-fade">
      <div v-show="isActive">
        <slot :currentIndex="currentIndex" :isActive="isActive" :firstLoading="firstLoading"/>
      </div>
    </Transition>
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

<style scoped>
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.2s ease-out;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}
</style>