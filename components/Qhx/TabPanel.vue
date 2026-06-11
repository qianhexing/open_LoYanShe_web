<template>
  <div class="w-full flex-shrink-0 self-stretch qhx-tab-panel">
    <div v-show="isActive" class="qhx-tab-panel__content min-h-[var(--qhx-tab-panel-min-h,0)]">
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

<style scoped>
.qhx-tab-panel {
  min-height: var(--qhx-tab-panel-min-h, auto);
}
</style>