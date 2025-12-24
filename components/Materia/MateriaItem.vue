<script setup lang="ts">
import type { Material } from '@/types/api';
import { useSceneStore } from '@/stores/sence'
interface Props {
  item: Material,
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
const sceneStore = useSceneStore()
const { size, needJump } = props
const item = props.item
const emit = defineEmits(['choose'])
const handleClick = (element: Material) => {
  emit('choose', element)
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full relative'">
    <div v-if="compact" class="w-full flex flex-col items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95" @click="handleClick(item)">
      <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
        class="object-cover w-[50px] h-[50px] rounded-md border border-gray-200 dark:border-gray-700 shadow-sm"
        loading="lazy" />
      <div class="w-full px-0.5">
        <h3 class="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate text-center leading-tight">
          {{ item.materia_title }}
        </h3>
      </div>
      <div v-if="sceneStore.loading" class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-md">
        <span class="text-[10px] text-gray-600 dark:text-gray-400">加载中……</span>
      </div>
    </div>
    <div v-else>
      <div class="w-full flex justify-center relative items-center pt-4 px-4 pb-2 bg-white cursor-pointer" @click="handleClick(item)">
        <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`"
          class="object-cover w-full  h-[100px] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy" />
      </div>
      <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
        <h3
          class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
          {{ item.materia_title }}
        </h3>
      </div>
      <div v-if="sceneStore.loading" class="absolute top-0 left-0 w-full h-full bg-white/50 flex items-center justify-center">
          <span class="text-gray-600">加载中……</span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>