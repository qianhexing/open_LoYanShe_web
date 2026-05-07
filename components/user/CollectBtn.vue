<!-- 互动数据组件 -->
<script setup lang="ts">
import { getFavoriteOptions, isCollect as judgeCollect, insertCollect } from '@/api/collect'
import type FavoriteModel from '~/components/Favorite/OptionsModal.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
const user = useUserStore()
interface Props {
  pk_id: number
  pk_type: number
  collect_count?: number
  is_collect?: boolean,
  need_judge?: boolean
  need_axios?: boolean
  /** default：星标+数量；follow：用户空间等场景的「关注 / 已关注」文案 */
  variant?: 'default' | 'follow'
}

const props = withDefaults(defineProps<Props>(), {
  need_judge: false,
  need_axios: true,
  variant: 'default',
})

// 内部状态
const collectCount = ref(props.collect_count || 0)
const isCollect = ref(props.is_collect || false)
watch(() => props.collect_count, (newVal) => {
  collectCount.value = newVal || 0
})
watch(() => props.is_collect, (newVal) => {
  isCollect.value = newVal
})
const FavoriteRef = ref<InstanceType<typeof FavoriteModel> | null>(null)
const emit = defineEmits(['change', 'handleClick'])
/** 关注模式：拉列表并自动提交时的等待态 */
const followAutoLoading = ref(false)
/** 关注模式：取消关注确认框 */
const unfollowConfirmOpen = ref(false)
const unfollowModalPosition = ref({ x: 0, y: 0 })
const unfollowConfirmLoading = ref(false)
onMounted(async () => {
  if (props.need_judge && user.token) {
    try {
      const resault = await judgeCollect({
        pk_id: props.pk_id,
        collect_type: props.pk_type.toString()
      })
      isCollect.value = resault
    } catch (error) {
    }
  }
})
/** 与 OptionsModal 一致：拉取收藏夹列表时 collect_type 4 按 2 请求 */
const collectTypeForFavoriteOptions = (pkType: number) => (pkType === 4 ? 2 : pkType)

/**
 * 关注模式且当前未关注：拉取收藏夹后自动选中并提交，不弹确认框。
 * 优先使用接口已标记 is_collect 的夹；否则使用列表第一个。
 */
const followAutoInsert = async () => {
  if (followAutoLoading.value) return
  const toast = useToast()
  followAutoLoading.value = true
  try {
    const list = await getFavoriteOptions({
      pk_id: props.pk_id,
      collect_type: collectTypeForFavoriteOptions(props.pk_type),
    })
    if (!list?.length) {
      toast.add({
        title: '暂无收藏夹',
        description: '请先创建收藏夹后再关注',
        icon: 'i-heroicons-information-circle',
        color: 'amber',
      })
      return
    }
    const already = list.filter((o) => o.is_collect === 1).map((o) => o.id)
    const firstId = list[0]?.id
    const ids = already.length > 0 ? already : firstId != null ? [firstId] : []
    if (!ids.length) {
      toast.add({
        title: '关注失败',
        description: '收藏夹数据异常',
        icon: 'i-heroicons-x-circle',
        color: 'red',
      })
      return
    }
    const ok = await insertCollect({
      pk_id: props.pk_id,
      ids,
      collect_type: props.pk_type,
    })
    if (ok) {
      if (!isCollect.value) {
        isCollect.value = true
        collectCount.value += 1
      }
      toast.add({
        title: '已关注',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
      emit('change', true)
    } else {
      toast.add({
        title: '关注失败',
        description: '请稍后重试',
        icon: 'i-heroicons-x-circle',
        color: 'red',
      })
    }
  } catch {
    toast.add({
      title: '关注失败',
      description: '网络异常，请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    followAutoLoading.value = false
  }
}

/** 关注模式：从所有收藏夹移除（与 OptionsModal 全不选后提交一致） */
const confirmUnfollow = async () => {
  if (unfollowConfirmLoading.value) return
  const toast = useToast()
  unfollowConfirmLoading.value = true
  try {
    await insertCollect({
      pk_id: props.pk_id,
      ids: [],
      collect_type: props.pk_type,
    })
    const still = await judgeCollect({
      pk_id: props.pk_id,
      collect_type: props.pk_type.toString(),
    })
    const was = isCollect.value
    isCollect.value = still
    if (was && !still) {
      collectCount.value = Math.max(0, collectCount.value - 1)
      emit('change', false)
      toast.add({
        title: '已取消关注',
        icon: 'i-heroicons-check-circle',
        color: 'green',
      })
    } else if (still) {
      toast.add({
        title: '取消关注失败',
        description: '请稍后重试',
        icon: 'i-heroicons-x-circle',
        color: 'red',
      })
    }
  } catch {
    toast.add({
      title: '取消关注失败',
      description: '网络异常，请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    unfollowConfirmLoading.value = false
    unfollowConfirmOpen.value = false
  }
}

const closeUnfollowConfirm = () => {
  unfollowConfirmOpen.value = false
}

const onUnfollowModalClose = () => {
  unfollowConfirmLoading.value = false
}

// 处理收藏
const toggleLike = async (e: MouseEvent) => {
  if (!user.token) {
    const toast = useToast()
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  if (!props.need_axios) {
    emit('handleClick', {
      pk_id: props.pk_id,
      collect_type: props.pk_type,
    })
    return
  }
  if (props.variant === 'follow' && isCollect.value) {
    unfollowModalPosition.value = {
      x: e.clientX + 50,
      y: e.clientY,
    }
    unfollowConfirmOpen.value = true
    return
  }
  if (props.variant === 'follow' && !isCollect.value) {
    await followAutoInsert()
    return
  }
  FavoriteRef.value?.showModel({
    pk_id: props.pk_id,
    collect_type: props.pk_type
  }, e)
}
const handleChange = (item: boolean) => {
  if (!isCollect.value && item) {
    isCollect.value = true
    collectCount.value += 1
  } else if (isCollect.value && !item) {
    isCollect.value = false
    collectCount.value -= 1
  }
}

</script>
<template>
  <div @click="toggleLike" class=" cursor-pointer inline-block">
    <FavoriteOptionsModal
      v-if="props.need_axios && props.variant !== 'follow'"
      ref="FavoriteRef"
      @change="handleChange"
    />
    <QhxModal
      v-if="props.variant === 'follow'"
      v-model="unfollowConfirmOpen"
      :trigger-position="unfollowModalPosition"
      @close="onUnfollowModalClose"
    >
      <div class="p-6 w-[320px] max-w-[90vw] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg border border-gray-200/50 dark:border-gray-700/50">
        <h3 class="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">
          取消关注
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          确定取消关注？将从你的收藏夹中移除该用户。
        </p>
        <div class="flex justify-end gap-2 mt-6">
          <UButton
            type="button"
            color="gray"
            variant="soft"
            :disabled="unfollowConfirmLoading"
            @click.stop="closeUnfollowConfirm"
          >
            暂不
          </UButton>
          <UButton
            type="button"
            class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
            :loading="unfollowConfirmLoading"
            @click.stop="confirmUnfollow"
          >
            确定取消
          </UButton>
        </div>
      </div>
    </QhxModal>
    <slot
      :child-data="{
        collect_count: collectCount,
        is_collect: isCollect,
      }"
    >
      <div
        v-if="props.variant === 'follow'"
        class="collect-follow-neu inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 select-none outline-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-qhx-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-qhx-bg"
        :class="[
          isCollect
            ? 'collect-follow-neu--active border-qhx-primary/25 bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover'
            : 'collect-follow-neu--idle border-qhx-border/30 bg-qhx-bg-card text-qhx-primary hover:text-qhx-secondary',
          followAutoLoading && 'pointer-events-none cursor-wait opacity-60',
        ]"
      >
        <UIcon
          v-if="!followAutoLoading"
          :name="isCollect ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'"
          class="size-[0.95rem] shrink-0 opacity-95"
          :class="isCollect ? 'text-qhx-inverted' : 'text-qhx-primary'"
        />
        <span class="tabular-nums">{{ followAutoLoading ? '…' : isCollect ? '已关注' : '关注' }}</span>
      </div>
      <div v-else class="flex items-center">
        <UIcon name="ant-design:star-filled" class="text-[26px]"
        :class="isCollect ? 'text-[#FFD166]' : 'text-gray-500'" />
        <div class="text-base ml-1">{{ collectCount }}</div>
      </div>
    </slot>
  </div>
</template>

<style scoped>
/* 拟态层次：阴影与 inset 使用主题变量，配色与 qhx-* / tailwind 主题一致 */
.collect-follow-neu--idle {
  box-shadow:
    4px 4px 14px color-mix(in srgb, var(--text-color) 11%, transparent),
    -3px -3px 12px color-mix(in srgb, var(--background-color) 62%, #ffffff),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
html.dark .collect-follow-neu--idle {
  box-shadow:
    5px 5px 18px rgba(0, 0, 0, 0.36),
    -4px -4px 14px color-mix(in srgb, var(--primary-color) 12%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.collect-follow-neu--idle:hover {
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
}
.collect-follow-neu--idle:active {
  box-shadow:
    inset 3px 3px 10px color-mix(in srgb, var(--text-color) 9%, transparent),
    inset -2px -2px 8px color-mix(in srgb, var(--background-color) 45%, #ffffff);
}
html.dark .collect-follow-neu--idle:active {
  box-shadow:
    inset 3px 3px 12px rgba(0, 0, 0, 0.32),
    inset -2px -2px 8px color-mix(in srgb, var(--primary-color) 8%, transparent);
}
.collect-follow-neu--active {
  box-shadow:
    inset 3px 3px 12px color-mix(in srgb, #000000 24%, transparent),
    inset -2px -2px 8px color-mix(in srgb, #ffffff 22%, transparent),
    0 4px 16px color-mix(in srgb, var(--primary-color) 36%, transparent);
}
html.dark .collect-follow-neu--active {
  box-shadow:
    inset 3px 3px 14px rgba(0, 0, 0, 0.32),
    inset -2px -2px 8px color-mix(in srgb, var(--primary-color) 20%, transparent),
    0 4px 18px color-mix(in srgb, var(--primary-color) 26%, transparent);
}
.collect-follow-neu--active:active {
  box-shadow:
    inset 4px 4px 14px color-mix(in srgb, #000000 28%, transparent),
    inset -1px -1px 6px color-mix(in srgb, #ffffff 14%, transparent);
}
</style>
