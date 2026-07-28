<script setup lang="ts">
import type { User } from '@/types/api'
interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  user: User
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
})
const { size } = props
</script>
<template>
  <div :class="props.className ? `${props.className}` :''">
    <div v-if="size === 'mini'">
      <!-- 外层预留头像框 scale-110 溢出空间，避免压到相邻轮播/卡片 -->
      <div class="flex h-[44px] w-[44px] items-center justify-center">
        <div class="relative h-[40px] w-[40px]">
          <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name || 'lo研社'"
            class="rounded-[50%] w-full h-full object-cover round" loading="lazy" />
          <img :src="`${BASE_IMG}${user.avatar.avatar_frame}`" :alt="user.user_name || 'lo研社'"
            v-if="user.avatar"
            class="pointer-events-none absolute inset-0 z-[1] h-full w-full origin-center scale-110 rounded object-cover"
            loading="lazy" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>


