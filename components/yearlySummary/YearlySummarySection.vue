<template>
  <div 
    ref="sectionRef"
    class="relative group/section"
  >
    <!-- 装饰标题背景 -->
    <div class="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
      <div class="bg-white dark:bg-gray-800 px-6 py-2 rounded-full shadow-lg border border-pink-100 dark:border-pink-900 flex items-center gap-2">
        <span class="text-xl">{{ icon }}</span>
        <h2 class="text-lg font-serif font-bold text-gray-800 dark:text-gray-100">
          {{ title }}
        </h2>
      </div>
    </div>

    <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-[2rem] shadow-xl p-8 pt-10 border border-white/50 dark:border-gray-700 relative overflow-hidden">
      <!-- 背景装饰 -->
      <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-100/50 to-purple-100/50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform duration-700 group-hover/section:scale-110"></div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-0">
        <div
          v-for="(item, index) in items"
          :key="item.clothes_id"
          ref="itemRefs"
          class="group relative aspect-[3/4] perspective-1000"
        >
          <div class="w-full h-full relative transform-style-3d transition-all duration-500 group-hover:rotate-y-12">
            <!-- 卡片主体 -->
            <div class="absolute inset-0 bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-600 group-hover:shadow-xl transition-shadow duration-300">
              <!-- 图片 -->
              <div class="h-3/4 overflow-hidden relative">
                <img 
                  :src="`${BASE_IMG}${item.clothes_img.replace(BASE_IMG, '')}?x-oss-process=image/quality,q_70/resize,w_300`"
                  :alt="item.clothes_note || '服饰'"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <!-- 信息 -->
              <div class="h-1/4 p-3 flex flex-col justify-between bg-white dark:bg-gray-800 relative z-10">
                <div v-if="item.clothes_note" class="text-xs font-medium text-gray-700 dark:text-gray-200 line-clamp-2 leading-snug">
                  {{ item.clothes_note }}
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span v-if="item.price" class="text-xs font-bold text-pink-500 dark:text-pink-400 font-mono">
                    ¥{{ formatNumber(item.price) }}
                  </span>
                  <span v-if="item.times" class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                    {{ item.times }}次
                  </span>
                </div>
              </div>
            </div>
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
  icon?: string
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
    // 简单的入场动画
    $gsap.from(sectionRef.value, {
      opacity: 0,
      y: 30,
      duration: 0.8,
      delay: props.delay || 0,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.value,
        start: 'top bottom-=100',
        toggleActions: 'play none none reverse'
      }
    })

    if (itemRefs.value.length > 0) {
      $gsap.from(itemRefs.value, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.1,
        delay: (props.delay || 0) + 0.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.value,
          start: 'top bottom-=100'
        }
      })
    }
  }
})
</script>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
.transform-style-3d {
  transform-style: preserve-3d;
}
.rotate-y-12 {
  transform: rotateY(12deg);
}
</style>