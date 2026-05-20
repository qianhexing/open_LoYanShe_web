<script setup lang="ts">
import dayjs from 'dayjs'
import { BASE_IMG } from '@/utils/ipConfig'
import { getFavoriteListVisitor } from '@/api/collect'
import type { FavoriteFolder } from '@/types/api'

const userStoreRefs = storeToRefs(useUserStore())
const { user } = userStoreRefs

const page = ref(1)
const pageSize = 18
const list = ref<FavoriteFolder[]>([])
const total = ref(0)
const loading = ref(false)

const coverSrc = (row: FavoriteFolder) =>
  `${BASE_IMG}${row.favorite_pic || 'static/plan_cover/default.jpg'}`

const formatDate = (d?: string) => (d ? dayjs(d).format('YYYY-MM-DD') : '—')

const hasMore = computed(() => list.value.length < total.value)

async function fetchFolders(reset = false) {
  if (!user.value?.user_id) return
  loading.value = true
  try {
    if (reset) page.value = 1
    const data = await getFavoriteListVisitor({
      user_id: user.value.user_id,
      page: page.value,
      pageSize,
    })
    const rows = data.rows ?? []
    total.value = data.count ?? 0
    if (reset) list.value = rows
    else list.value = [...list.value, ...rows]
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value += 1
  await fetchFolders(false)
}

onMounted(() => {
  if (user.value?.user_id) fetchFolders(true)
})
</script>

<template>
  <div class="container mx-auto min-h-screen px-4 py-6">
    <div v-if="!user" class="flex items-center justify-center h-[50vh] text-gray-600">
      请先登录
    </div>
    <div v-else>
      <div class="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">我的收藏夹</h1>
          <p class="text-sm text-gray-500 mt-1">查看与管理你的收藏夹</p>
        </div>
      </div>

      <div
        v-if="!loading && list.length === 0"
        class="flex flex-col items-center justify-center py-20 text-gray-500 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80"
      >
        <UIcon name="material-symbols:bookmark-outline-rounded" class="text-5xl mb-3 text-gray-300" />
        <p>暂无收藏夹</p>
      </div>

      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <NuxtLink
          v-for="item in list"
          :key="item.id"
          :to="`/favorite/${item.id}`"
          class="group flex gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-pink-100 transition-all"
        >
          <div class="w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden bg-gray-100">
            <img
              :src="coverSrc(item)"
              :alt="item.favorite_name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            >
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 truncate group-hover:text-pink-600 transition-colors">
              {{ item.favorite_name }}
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <UBadge color="gray" variant="soft" size="xs">
                {{ item.collect_count ?? 0 }} 个收藏
              </UBadge>
              <UBadge :color="item.is_private === 1 ? 'amber' : 'green'" variant="soft" size="xs">
                {{ item.is_private === 1 ? '私有' : '公开' }}
              </UBadge>
            </div>
            <div class="text-xs text-gray-400 mt-2">
              {{ formatDate(item.create_time) }}
            </div>
            <p v-if="item.favorite_desc" class="text-xs text-gray-500 mt-1 line-clamp-2">
              {{ item.favorite_desc }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center py-8 text-gray-500">
        加载中…
      </div>

      <div v-if="user && list.length > 0 && hasMore && !loading" class="flex justify-center mt-8">
        <UButton color="primary" variant="outline" @click="loadMore">
          加载更多
        </UButton>
      </div>
    </div>
  </div>
</template>
