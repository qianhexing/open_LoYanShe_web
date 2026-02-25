<template>
  <div class="container mx-auto p-4 pb-20 max-w-4xl">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">经验获取记录</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">查看您的经验获取历史记录</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
      <p class="text-sm text-gray-500">加载中...</p>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!loading && recordList.length === 0"
      class="text-center py-12"
    >
      <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500">暂无经验获取记录</p>
    </div>

    <!-- 记录列表 -->
    <div v-else class="space-y-2">
      <div
        v-for="item in recordList"
        :key="item.record_id"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
                {{ item.note || '经验获取' }}
              </span>
              <span class="text-sm font-semibold text-qhx-primary">+{{ item.num }}</span>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatDate(item.create_time) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExpRecord } from '@/types/api'
import { getExpRecordList } from '@/api/user_exp'
import dayjs from 'dayjs'

definePageMeta({
  ssr: false
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const recordList = ref<ExpRecord[]>([])
const loading = ref(true)

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return ''
  try {
    return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
  } catch {
    return dateStr
  }
}

const fetchRecordList = async () => {
  loading.value = true
  try {
    const res = await getExpRecordList()
    recordList.value = res.rows || []
  } catch (error) {
    console.error('获取经验记录失败:', error)
    recordList.value = []
  } finally {
    loading.value = false
  }
}

watch(
  layoutReady,
  (ready) => {
    if (ready) fetchRecordList()
  },
  { immediate: true }
)

useHead({
  title: '经验获取记录 - Lo研社',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,经验,经验记录'
    },
    {
      name: 'description',
      content: '查看您的经验获取历史记录'
    }
  ]
})
</script>
