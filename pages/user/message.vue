<template>
  <div class="container mx-auto p-4 pb-20 max-w-4xl">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">我的通知</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">查看您收到的所有通知消息</p>
    </div>

    <!-- 通知列表 -->
    <QhxWaterList
      v-if="layoutReady"
      ref="waterList"
      :fetch-data="async (page, pageSize) => {
        try {
          const response = await getNoticeList({
            page: page,
            pageSize: pageSize
          })
          return {
            rows: response.rows,
            count: response.count
          }
        } catch (error) {
          console.error('获取通知列表失败:', error)
          return {
            rows: [],
            count: 0
          }
        }
      }"
      :columns="1"
      :itemKey="0"
      :columns_768="1"
      :enableWaterfall="false"
      :enableLoadMore="true"
    >
      <template #default="{ item }">
        <div class="px-2 pb-4">
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start gap-4">
              <!-- 通知图标 -->
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <span class="text-lg">
                  {{ item.type === 0 ? '📢' : '💬' }}
                </span>
              </div>
              
              <!-- 通知内容 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ item.type === 0 ? '全体通知' : '个人通知' }}
                  </span>
                  <span v-if="item.date" class="text-xs text-gray-400 dark:text-gray-500">
                    {{ formatDate(item.date) }}
                  </span>
                </div>
                <!-- <p class="leading-relaxed whitespace-pre-wrap">
                  {{ item.notice_content || '暂无内容' }}
                </p> -->
                <p class="">
                  <SafeRichText :nodes="parseRichText(item.notice_content || '')"></SafeRichText>
                </p>

              </div>
            </div>
          </div>
        </div>
      </template>
    </QhxWaterList>
  </div>
</template>

<script setup lang="ts">
import { getNoticeList } from '@/api/message_center'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import dayjs from 'dayjs'
import { parseRichText } from '@/utils/public'

// 禁用 SSR
definePageMeta({
  ssr: false
})

const layoutReady = inject('layoutReady') as Ref<boolean>
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)

// 获取通知系统的方法
const { markNotificationAsRead } = useNotification()

// 格式化日期
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return ''
  try {
    return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
  } catch {
    return dateStr
  }
}

// 监听 layoutReady，页面加载完成后清空通知
watch(layoutReady, (newVal) => {
  if (newVal) {
    // 页面加载完成后，清空通知
    markNotificationAsRead()
  }
}, { immediate: true })

// SEO 配置
useHead({
  title: '我的通知 - Lo研社',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,通知,消息'
    },
    {
      name: 'description',
      content: '查看您收到的所有通知消息'
    }
  ]
})
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>

