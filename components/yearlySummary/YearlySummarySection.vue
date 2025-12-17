<template>
  <div 
    ref="sectionRef"
    class="card-animate bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 md:p-8 border-2 border-pink-200 dark:border-pink-800"
  >
    <h2 class="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
      {{ title }}
    </h2>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="(item, index) in items"
        :key="item.clothes_id"
        ref="itemRefs"
        class="group relative bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900 dark:to-purple-900 rounded-2xl overflow-hidden border border-pink-200 dark:border-pink-700 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
      >
        <!-- 图片 -->
        <div class="aspect-square relative overflow-hidden">
          <img 
            :src="`${BASE_IMG}${item.clothes_img.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_70/resize,w_300`"
            :alt="item.clothes_note || '服饰'"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
          <!-- 遮罩层 -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        
        <!-- 信息 -->
        <div class="p-3">
          <div v-if="item.clothes_note" class="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
            {{ item.clothes_note }}
          </div>
          <div v-if="item.price" class="text-xs text-pink-600 dark:text-pink-400">
            ¥{{ formatNumber(item.price) }}
          </div>
          <div v-if="item.times" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            穿着 {{ item.times }} 次
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { WardrobeClothes } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps<{
  title: string
  items: WardrobeClothes[]
  delay?: number
}>()

const { $gsap } = useNuxtApp()

const sectionRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN')
}

onMounted(async () => {
  await nextTick()
  if ($gsap && sectionRef.value) {
    $gsap.from(sectionRef.value, {
      opacity: 0,
      y: 50,
      duration: 0.6,
      delay: props.delay || 0,
      ease: 'power2.out'
    })

    // 子项动画
    if (itemRefs.value.length > 0) {
      $gsap.from(itemRefs.value, {
        opacity: 0,
        scale: 0.8,
        duration: 0.4,
        stagger: 0.05,
        delay: (props.delay || 0) + 0.2,
        ease: 'back.out(1.7)'
      })
    }
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

