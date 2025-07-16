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
    <div v-if="size === 'mini'" class="flex items-center">
      <UserFace :user="user" :size="size"></UserFace>
      <div class="ml-2">{{ user.user_name }}</div>
    </div>
  </div>
</template>

<style scoped>
</style>


