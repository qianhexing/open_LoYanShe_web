<script setup lang="ts">
    const props = defineProps<{
      images: string[]
    }>()
    
    const currentIndex = ref(0)
    
    // 上一张
    const prev = () => {
      if (currentIndex.value > 0) {
        currentIndex.value--
      }
    }
    
    // 下一张
    const next = () => {
      if (currentIndex.value < props.images.length - 1) {
        currentIndex.value++
      }
    }
    
    // 简单的图片错误处理（这里以后可以细化）
    const handleImageError = (e: Event) => {
      const target = e.target as HTMLImageElement
      target.src = 'https://placehold.co/600x800/e2e8f0/94a3b8?text=Image+Lost'
    }
    </script>
    
    <template>
      <div class="relative w-full h-full overflow-hidden group bg-gray-100">
        
        <div 
          class="flex w-full h-full transition-transform duration-500 ease-out"
          :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
        >
          <div 
            v-for="(img, index) in images" 
            :key="index" 
            class="w-full h-full flex-shrink-0"
          >
            <img 
              :src="img" 
              class="w-full h-full object-cover select-none pointer-events-none" 
              draggable="false"
              @error="handleImageError"
            />
          </div>
        </div>
    
        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          <div 
            v-for="(_, idx) in images" 
            :key="idx"
            class="w-1.5 h-1.5 rounded-full transition-all duration-300"
            :class="currentIndex === idx ? 'bg-white w-3' : 'bg-white/50'"
          ></div>
        </div>
    
        <template v-if="images.length > 1">
          
          <button 
            v-show="currentIndex > 0"
            @click.stop="prev"
            class="absolute left-3 top-1/2 -translate-y-1/2 z-20 cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 active:scale-95 hover:scale-100"
          >
            <div class="w-9 h-9 rounded-full bg-pink-500 shadow-lg flex items-center justify-center border border-pink-400">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
               </svg>
            </div>
          </button>
    
          <button 
            v-show="currentIndex < images.length - 1"
            @click.stop="next"
            class="absolute right-3 top-1/2 -translate-y-1/2 z-20 cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 active:scale-95 hover:scale-100"
          >
            <div class="w-9 h-9 rounded-full bg-pink-500 shadow-lg flex items-center justify-center border border-pink-400">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
               </svg>
            </div>
          </button>
        </template>
    
        <div v-if="images.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <span class="text-3xl">🖼️</span>
            <span class="text-xs mt-2">暂无图片</span>
        </div>
    
      </div>
    </template>