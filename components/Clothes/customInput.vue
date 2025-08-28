<template>
  <QhxModal v-model="show" :trigger-position="clickPosition">
    <div class="p-6 w-[400px] max-md:w-[90vw] bg-white rounded-[10px] max-h-[50vh] overflow-y-auto">
      <UInput v-model="title" :placeholder="'标题'" class="flex-1 focus:ring-0" :ui="{
        base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
        rounded: 'rounded-[10px]',
        padding: { xs: 'px-4 py-2' },
        color: {
          white: {
            outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
          }
        }
      }" />
      <UButton type="submit" block class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-6"
        @click="add()">
        添加
      </UButton>
    </div>
  </QhxModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const show = ref(false)
const title = ref('')
const clickPosition = ref({ x: 0, y: 0 })
const showModel = (e: MouseEvent) => {
  show.value = true
  if (e) {
    clickPosition.value = {
      x: e.clientX, y: e.clientY
    }
  }
}
const emit = defineEmits(['insert'])
const add = () => {
  if (title.value === '') {
    return
  }
  emit('insert', title.value)
  show.value = false
  title.value = ''
}
defineExpose({ showModel })
</script>

<style scoped>

</style>
