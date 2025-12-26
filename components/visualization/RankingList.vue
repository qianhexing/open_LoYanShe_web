<template>
  <div class="fixed left-4 top-20 z-10 w-64 max-h-[80vh] overflow-y-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-xl shadow-lg p-4 custom-scrollbar">
    <h3 class="text-lg font-bold mb-4 text-gray-900 dark:text-white">地域分布排名</h3>
    <div class="space-y-3">
      <div 
        v-for="item in data" 
        :key="item.name"
        class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div 
          class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white"
          :class="[
            item.rank <= 3 ? ['bg-yellow-500', 'bg-gray-400', 'bg-orange-500'][item.rank - 1] : 'bg-gray-300 dark:bg-gray-600'
          ]"
        >
          {{ item.rank }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.name }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ item.percent }}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              class="bg-blue-500 h-1.5 rounded-full" 
              :style="{ width: item.percent }"
            ></div>
          </div>
          <div class="text-xs text-right text-gray-500 mt-0.5">
            {{ item.count }} 人
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface RankItem {
  rank: number
  name: string
  count: number
  percent: string
}

defineProps<{
  data: RankItem[]
}>()
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}
</style>
