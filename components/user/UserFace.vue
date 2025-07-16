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
      <div class=" w-[40px] h-[40px] relative">
        <img :src="`${BASE_IMG}${user.user_face}`" :alt="user.user_name || 'lo研社'"
          class="rounded-[50%] w-full h-full object-cover round" loading="lazy" />
        <img :src="`${BASE_IMG}${user.avatar.avatar_frame}`" :alt="user.user_name || 'lo研社'"
          v-if="user.avatar"
          class="rounded w-full h-full object-cover scale-110 origin-center absolute z-10 left-0 top-0" loading="lazy" />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>


