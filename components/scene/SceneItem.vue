<script setup lang="ts">
import type { Scene } from '@/types/api';

interface Props {
  item: Scene,
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
const emit = defineEmits(['click'])

const handleClick = () => {
  emit('click', item)
  if (needJump && item.sence_id) {
    window.open(`/scene/detail/${item.sence_id}`, '_blank')
  }
}
</script>

<template>
  <div :class="className ? className : 'w-full'">
    <!-- mini尺寸 -->
    <div 
      v-if="size === 'mini-list'" 
      class="items-center w-full bg-white rounded-lg p-2 border border-gray-200  cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      @click="handleClick"
    >
      <div class="">
        <img 
          :src="`${BASE_IMG}${item.sence_cover || 'static/plan_cover/default.jpg'}`" 
          :alt="item.sence_desc || '场景封面'"
          class="w-full aspect-[4/3] object-cover rounded-md border border-gray-200 dark:border-gray-600"
          loading="lazy" 
        />
      </div>
      <div class="flex-1 ml-3 min-w-0">
        <!-- <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {{ item.sence_desc || '未命名场景' }}
        </h3> -->
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
          {{ item.create_time ? new Date(item.create_time).toLocaleDateString() : '' }}
        </p>
      </div>
    </div>
    
    <!-- mini尺寸 -->
    <div 
      v-else-if="size === 'mini'" 
      class="text-center w-full cursor-pointer"
      @click="handleClick"
    >
      <div>
        <img 
          :src="`${BASE_IMG}${item.sence_cover || 'static/plan_cover/default.jpg'}`" 
          :alt="item.sence_desc || '场景封面'"
          class="w-[60px] h-[60px] rounded-[10px] shadow-sm object-cover border border-gray-200 dark:border-gray-700 mx-auto my-2"
          loading="lazy" 
        />
      </div>
      <div class="mx-2 text-sm text-gray-700 dark:text-gray-300 truncate">
        {{ item.sence_desc || '未命名场景' }}
      </div>
    </div>
    
    <!-- 大尺寸 -->
    <div 
      v-else
      class="w-full cursor-pointer"
      @click="handleClick"
    >
      <div class="relative">
        <img 
          :src="`${BASE_IMG}${item.sence_cover || 'static/plan_cover/default.jpg'}`" 
          :alt="item.sence_desc || '场景封面'"
          class="object-cover w-full h-[100px] rounded-[10px] border border-gray-200 dark:border-gray-800 shadow-sm bg-white"
          loading="lazy" 
        />
      </div>
      <div class="w-full flex flex-col items-center justify-between px-3 pb-4 pt-2 relative">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-center transition-colors duration-300">
          {{ item.sence_desc || '未命名场景' }}
        </h3>
        <div class="flex items-center justify-between w-full mt-1">
          <span class="text-xs text-gray-700 dark:text-gray-400 opacity-70">
            {{ item.create_time ? new Date(item.create_time).toLocaleDateString() : '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

