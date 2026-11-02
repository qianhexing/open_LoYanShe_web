<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Community } from '@/types/api'
import { insertCommunityForeign } from '@/api/community'
import type { CommunityPostForeignContext } from '@/utils/communityPost'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'

const CommunityChoose = defineAsyncComponent(
  () => import('@/components/community/CommunityChoose.vue')
)
const CommunityPostModal = defineAsyncComponent(
  () => import('@/components/community/CommunityPostModal.vue')
)

/** 茶会返图 community foreign（pk_type 见 types/api CommunityForeign） */
const TEA_RETURN_PK_TYPE = 6 as const

const props = defineProps<{
  teaId: number
}>()

const user = useUserStore()
const toast = useToast()

const foreignRefreshKey = ref(0)
const linkLoading = ref(false)
const showReturnPostModal = ref(false)

const communityChooseRef = ref<{ showModel: (e?: MouseEvent) => void } | null>(null)
const returnPostModalRef = ref<{
  open: (e?: MouseEvent) => void
  close: () => void
} | null>(null)

const foreignPk = computed((): CommunityPostForeignContext | null => {
  if (!Number.isFinite(props.teaId)) return null
  return { pk_id: props.teaId, pk_type: TEA_RETURN_PK_TYPE }
})

function requireLogin(): boolean {
  if (user.token) return true
  toast.add({
    title: '请先登录',
    icon: 'i-heroicons-exclamation-circle',
    color: 'orange'
  })
  return false
}

function openChooseCommunity(e?: MouseEvent) {
  if (!requireLogin()) return
  communityChooseRef.value?.showModel(e)
}

async function onCommunityChosen(item: Community) {
  linkLoading.value = true
  try {
    await insertCommunityForeign({
      pk_type: TEA_RETURN_PK_TYPE,
      community_id: item.community_id,
      pk_id: props.teaId
    })
    toast.add({
      title: '已关联到本茶会返图',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    foreignRefreshKey.value += 1
  } catch (error: unknown) {
    console.error('关联茶会返图帖子失败:', error)
    const msg = error instanceof Error ? error.message : '请稍后重试'
    toast.add({
      title: '关联失败',
      description: msg,
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    linkLoading.value = false
  }
}

function openNewReturnPost(e?: MouseEvent) {
  if (!requireLogin()) return
  returnPostModalRef.value?.open(e)
}

function onReturnPostSuccess() {
  foreignRefreshKey.value += 1
}
</script>

<template>
  <div class="py-4">
    <p class="text-sm text-gray-500 dark:text-gray-400 text-center px-4 pt-1 pb-2">
      分享你与这场茶会相关的返图，或关联已有帖子
    </p>
    <div class="flex flex-wrap gap-2 justify-center px-4 pb-4">
      <QhxJellyButton>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5 disabled:opacity-50"
          :disabled="linkLoading"
          @click="openChooseCommunity($event)"
        >
          <UIcon name="i-heroicons-link" class="w-4 h-4" />
          {{ linkLoading ? '处理中…' : '关联已有帖子' }}
        </button>
      </QhxJellyButton>
      <QhxJellyButton>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover disabled:opacity-50"
          @click="openNewReturnPost($event)"
        >
          <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
          投稿返图
        </button>
      </QhxJellyButton>
    </div>
    <CommunityForeignList
      :key="foreignRefreshKey"
      :pk_type="TEA_RETURN_PK_TYPE"
      :pk_id="teaId"
      allow-delete-foreign
    />
    <ClientOnly>
      <CommunityChoose
        ref="communityChooseRef"
        :only-mine="true"
        title="选择要关联的返图帖子"
        placeholder="搜索我的帖子..."
        @choose="onCommunityChosen"
      />
      <CommunityPostModal
        ref="returnPostModalRef"
        v-model="showReturnPostModal"
        :foreign-pk="foreignPk"
        modal-title="投稿返图"
        :skip-summary-link="true"
        :success-redirect="false"
        @success="onReturnPostSuccess"
      />
    </ClientOnly>
  </div>
</template>
