<template>
  <div class="space-y-4">
    <div
      v-for="(item, index) in list"
      :key="`${type}-${item.library_id || index}`"
      class="bg-white dark:bg-gray-700 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-4 md:p-6 cursor-pointer"
      @click="handleJumpToLibrary(item.library_id)"
    >
      <div class="flex items-center gap-4 md:gap-6">
        <!-- 排名 -->
        <div class="flex-shrink-0">
          <div
            v-if="index < 3"
            class="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl"
            :class="{
              'bg-yellow-500': index === 0,
              'bg-gray-400': index === 1,
              'bg-orange-500': index === 2
            }"
          >
            {{ index + 1 }}
          </div>
          <div
            v-else
            class="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-lg md:text-xl"
          >
            {{ index + 1 }}
          </div>
        </div>

        <!-- 图片 -->
        <div class="flex-shrink-0">
          <img
            :src="item.cover || item.square_cover || '/placeholder.png'"
            :alt="item.name || '图鉴'"
            class="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-600"
            loading="lazy"
          />
        </div>

        <!-- 信息 -->
        <div class="flex-1 min-w-0">
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate mb-2">
            {{ item.name || '未知图鉴' }}
          </h3>
          <div class="flex items-center gap-2 text-sm md:text-base text-gray-600 dark:text-gray-400">
            <span v-if="type === 'good'">
              <span class="text-red-500 font-semibold">{{ item.ranking_count || 0 }}</span> 个赞
            </span>
            <span v-else-if="type === 'collect'">
              <span class="text-blue-500 font-semibold">{{ item.ranking_count || 0 }}</span> 次收藏
            </span>
          </div>
        </div>

        <!-- 店铺信息（如果有） -->
        <div v-if="item.shop_logo" class="hidden md:flex flex-shrink-0 items-center gap-2">
          <img
            :src="item.shop_logo"
            alt="店铺"
            class="w-10 h-10 rounded-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RankItem } from '@/api/rank'

interface Props {
  list: RankItem[]
  type: 'good' | 'collect'
}

defineProps<Props>()

// eslint-disable-next-line
let uni: any
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

onMounted(async () => {
  // @ts-ignore uni-webview-js 类型定义问题
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err)
  })
})

// 跳转到图鉴详情页
const handleJumpToLibrary = (library_id?: number) => {
  if (!library_id) return
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/library/libraryDetail/libraryDetail?id=${library_id}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'LibraryDetail',
        params: {
          id: library_id
        }
      }))
    } else {
      // 普通网页环境
      window.open(`/library/detail/${library_id}`, '_blank')
    }
  }
}
</script>

<style scoped>
/* 适配鸿蒙等移动端 */
@media (max-width: 640px) {
  .space-y-4 > * + * {
    margin-top: 1rem;
  }
}
</style>

