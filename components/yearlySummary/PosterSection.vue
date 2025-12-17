<template>
  <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 border-2 border-pink-200 dark:border-pink-800">
    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
      {{ title }}
    </h2>
    <div class="grid grid-cols-4 gap-4">
      <div
        v-for="item in items"
        :key="item.clothes_id"
        class="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900 dark:to-purple-900 rounded-2xl overflow-hidden border border-pink-200 dark:border-pink-700"
      >
        <!-- 图片 -->
        <div class="aspect-square relative overflow-hidden">
          <img 
            :src="`${BASE_IMG}${item.clothes_img.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_80/resize,w_300`"
            :alt="item.clothes_note || '服饰'"
            class="w-full h-full object-cover"
          />
        </div>
        
        <!-- 信息 -->
        <div class="p-2">
          <div v-if="item.clothes_note" class="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
            {{ item.clothes_note }}
          </div>
          <div v-if="item.price" class="text-xs text-pink-600 dark:text-pink-400">
            ¥{{ formatNumber(item.price) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

defineProps<{
  title: string
  items: WardrobeClothes[]
}>()

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

