<template>
  <div class="space-y-4">
    <div
      v-for="(item, index) in list"
      :key="`user-${item.user_id || index}`"
      class="bg-white dark:bg-gray-700 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-4 md:p-6 cursor-pointer"
      @click="handleJumpToUser(item.user_id)"
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

        <!-- 头像 -->
        <div class="flex-shrink-0">
          <img
            :src="item.user_face || '/default-avatar.png'"
            :alt="item.user_name || '用户'"
            class="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            loading="lazy"
          />
        </div>

        <!-- 信息 -->
        <div class="flex-1 min-w-0">
          <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate mb-2">
            {{ item.user_name || '匿名用户' }}
          </h3>
          <div class="flex items-center gap-4 text-sm md:text-base text-gray-600 dark:text-gray-400">
            <span>
              等级 <span class="text-indigo-500 font-semibold">{{ item.level || 0 }}</span>
            </span>
            <span>
              经验值 <span class="text-green-500 font-semibold">{{ item.exp || 0 }}</span>
            </span>
          </div>
        </div>

        <!-- 等级和经验值（大屏显示） -->
        <div class="hidden md:flex flex-shrink-0 items-center">
          <div class="text-right">
            <div class="text-2xl font-bold text-indigo-500">
              Lv.{{ item.level || 0 }}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ item.exp || 0 }} 经验
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/types/api'

interface Props {
  list: User[]
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

// 跳转到用户详情页
const handleJumpToUser = (user_id?: number) => {
  if (!user_id) return
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境
    uni.navigateTo({
      url: `/pages/userSpace/userSpace?id=${user_id}`,
      fail: () => {
        console.log('跳转错误')
      }
    })
  } else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'UserSpace',
        params: {
          id: user_id
        }
      }))
    } else {
      // 普通网页环境
      window.open(`/userSpace/${user_id}`, '_blank')
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

