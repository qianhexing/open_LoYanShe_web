<template>
  <ClientOnly>
    <CommunityPostEditor
      v-if="detail && canEdit"
      :community-id="detail.community_id"
      :initial-title="detail.title ?? ''"
      :initial-content="detail.content ?? ''"
      :initial-img-list="detail.img_list ?? null"
      :initial-type="detail.type ?? '日常交流'"
      skip-summary-link
    />
  </ClientOnly>
</template>

<script setup lang="ts">
import { getCommunityDetail } from '@/api/community'

definePageMeta({
  ssr: false
})

const route = useRoute()
const id = route.params.id as string
const userStore = useUserStore()

if (import.meta.client) {
  await userStore.loadToken()
}

const { data: detail } = await useAsyncData(
  `community-edit-${id}`,
  async () => {
    const res = await getCommunityDetail({ community_id: Number.parseInt(id, 10) })
    return res
  }
)

if (!detail.value) {
  throw createError({ statusCode: 404, statusMessage: '帖子不存在' })
}

const authorId = computed(
  () => detail.value?.user_id ?? detail.value?.user?.user_id
)

const canEdit = computed(() => {
  const uid = userStore.user?.user_id
  const aid = authorId.value
  return uid != null && aid != null && uid === aid
})

watch(
  canEdit,
  (ok) => {
    if (!ok) {
      navigateTo(`/community/detail/${id}`, { replace: true })
    }
  },
  { immediate: true }
)

useHead({
  title: () => (detail.value?.title ? `编辑：${detail.value.title}` : '编辑帖子')
})
</script>
