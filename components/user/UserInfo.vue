<script setup lang="ts">
import type { User } from '@/types/api'
import { openUserSpaceTab } from '@/composables/useLibraryDetailNavigation'

interface Props {
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转主页
  user: User
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: false,
})
const { size } = props

const jumpToUserSpace = () => {
  if (!props.needJump) return
  openUserSpaceTab(props.user.user_id)
}
</script>
<template>
  <div :class="props.className ?? ''">
    <div
      v-if="size === 'mini'"
      :class="[
        'inline-flex max-w-full items-center',
        props.needJump && props.user.user_id
          ? 'cursor-pointer rounded-md hover:opacity-90 transition-opacity'
          : '',
      ]"
      :role="props.needJump && props.user.user_id ? 'button' : undefined"
      :tabindex="props.needJump && props.user.user_id ? 0 : undefined"
      @click="jumpToUserSpace"
      @keydown.enter.prevent="jumpToUserSpace"
      @keydown.space.prevent="jumpToUserSpace"
    >
      <UserFace :user="user" :size="size"></UserFace>
      <div class="ml-2">{{ user.user_name }}</div>
    </div>
  </div>
</template>

<style scoped>
</style>


