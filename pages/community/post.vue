<template>
  <ClientOnly>
    <CommunityPostEditor
      :user-id="userId"
      :skip-summary-link="skipSummaryLink"
      @success="handleSuccess"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
// 设置为仅客户端运行
definePageMeta({
  ssr: false
})

import type { Community } from '@/types/api'

const route = useRoute()
const router = useRouter()

// 从路由参数获取配置
const userId = route.query.userId ? Number(route.query.userId) : undefined
const skipSummaryLink = route.query.skipSummaryLink === 'true'

// 处理发布成功事件
const handleSuccess = (community: Community) => {
  // 组件内部已经处理了跳转，这里可以添加额外的逻辑
  console.log('发布成功:', community)
}
</script>

