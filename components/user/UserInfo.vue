<script setup lang="ts">
import type { User } from '@/types/api'
import { computed, onMounted } from 'vue'

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

const configStore = useConfigStore()
const port = computed(() => configStore.getPort())

// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any

onMounted(async () => {
  try {
    // @ts-expect-error uni-webview-js 类型定义问题
    uni = await import('@dcloudio/uni-webview-js').catch(() => null)
  } catch { /* empty */ }
})

const jumpToUserSpace = () => {
  if (!props.needJump) return
  const userId = props.user.user_id
  console.log(configStore.statusBarHeight, 'statusBarHeight')

  if (!userId) return
  console.log(configStore.statusBarHeight, 'statusBarHeight')
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus')

  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/common/outerLink2?url=https://lolitalibrary.com/userSpace/${userId}`,
      fail: () => {
        console.log('跳转用户空间失败')
      },
    })
  } else if (port.value) {
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'UserSpace',
      params: { id: userId },
    }))
  } else {
    navigateTo(`/userSpace/${userId}`)
  }
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


