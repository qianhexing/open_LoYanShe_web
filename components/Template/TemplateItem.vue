<script setup lang="ts">
import type { TemplateInterface } from '@/types/api';
interface Props {
  item: TemplateInterface,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true
})
const { size, needJump } = props
const item = props.item
const emit = defineEmits(['choose'])
const handleClick = (element: TemplateInterface) => {
  console.log(element)
  emit('choose', element)
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <div class="w-full flex justify-center items-center pt-4 px-4 pb-2 bg-white" @click="handleClick(item)">
      <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
        class="object-cover w-full h-[20vw] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
        loading="lazy" />
    </div>
    <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
      <h3
        class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
        {{ item.title }}
      </h3>
    </div>
  </div>
</template>

<style scoped></style>