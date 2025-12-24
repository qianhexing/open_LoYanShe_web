<script setup lang="ts">
import type { Effect } from '@/types/api';
interface Props {
  item: Effect,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  compact?: boolean // 紧凑模式
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
  compact: false
})
const { size, needJump } = props
const item = props.item
const emit = defineEmits(['choose'])
const handleClick = (element: Effect) => {
  emit('choose', element)
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <div v-if="compact" class="w-full flex flex-col items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95" @click="handleClick(item)">
      <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
        class="object-cover w-[50px] h-[50px] rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
        loading="lazy" />
      <div class="w-full px-0.5">
        <h3 class="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate text-center leading-tight">
          {{ item.effect_title }}
        </h3>
      </div>
    </div>
    <div v-else>
      <div class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white cursor-pointer" @click="handleClick(item)">
        <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
          class="object-cover w-full  h-[100px] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy" />
      </div>
      <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
        <h3
          class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
          {{ item.effect_title }}
        </h3>
      </div>
    </div>
  </div>
</template>

<style scoped></style>