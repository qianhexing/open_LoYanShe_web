<script setup lang="ts">
/**
 * 更换头像框 — 对齐 uni-app `pages/user/changeAvatarframe/changeAvatarframe`
 */
import {
  changeUserAvatarFrame,
  exchangeDeco,
  getAvatarFrameList,
  type AvatarFrameItem,
} from '@/api/avatar_frame'
import AvatarFrameList from '@/components/user/AvatarFrameList.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import { BASE_IMG } from '@/utils/ipConfig'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybeObj = error as Record<string, unknown>
    if (typeof maybeObj.message === 'string') return maybeObj.message
    if (typeof maybeObj.msg === 'string') return maybeObj.msg
  }
  return ''
}

useHead({
  title: '更换头像框 - Lo研社',
})

const userStore = useUserStore()
const toast = useToast()
const router = useRouter()

const list = ref<AvatarFrameItem[]>([])
const page = ref(1)
const pageSize = 20
const count = ref(0)
const loading = ref(false)
const saving = ref(false)
const selectedId = ref<number | null>(null)
/** 预览用相对路径（无框为空） */
const previewFramePath = ref('')

const showExchangeModal = ref(false)
const exchangeItem = ref<AvatarFrameItem | null>(null)
const exchanging = ref(false)

const userFaceSrc = computed(() => {
  const face = userStore.user?.user_face
  if (!face) return '/default-avatar.png'
  if (/^https?:\/\//i.test(face)) return face
  return `${BASE_IMG}${face.replace(/^\//, '')}`
})

const previewFrameSrc = computed(() => {
  const path = previewFramePath.value
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${BASE_IMG}${path.replace(/^\//, '')}`
})

const hasMore = computed(() => list.value.length < count.value)

const exchangeModalContent = computed(() => {
  const item = exchangeItem.value
  if (!item) return ''
  const cost = item.is_free || 0
  return `是否使用 ${cost} 经验兑换「${item.frame_name || '该头像框'}」？`
})

function toRelativeFramePath(path?: string | null): string {
  if (!path) return ''
  return path.replace(BASE_IMG, '').replace(/^\//, '')
}

function syncSelectedFromUser() {
  if (selectedId.value !== null) return
  const current = toRelativeFramePath(userStore.user?.avatar?.avatar_frame)
  if (!current) {
    selectedId.value = 0
    previewFramePath.value = ''
    return
  }
  previewFramePath.value = current
  const match = list.value.find((v) => {
    const itemPath = toRelativeFramePath(v.avatar_frame)
    return itemPath && (itemPath === current || current.endsWith(itemPath))
  })
  if (match) selectedId.value = match.frame_id
}

function normalizeRows(rows: AvatarFrameItem[]): AvatarFrameItem[] {
  return rows.map((v) => {
    const path = v.avatar_frame || ''
    return {
      ...v,
      avatar_frame: path && !/^https?:\/\//i.test(path) ? `${BASE_IMG}${path.replace(/^\//, '')}` : path,
      // 对齐 uni：付费且未拥有（user_deco 为空）不可直接选用，需先兑换
      disabled: v.is_free !== 0 && (v.user_deco === null || v.user_deco === undefined),
    }
  })
}

async function fetchList(nextPage = page.value) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getAvatarFrameList({ page: nextPage, pageSize })
    const rows = normalizeRows(res.rows || [])
    if (nextPage === 1) list.value = rows
    else list.value = [...list.value, ...rows]
    count.value = res.count || 0
    page.value = nextPage
    syncSelectedFromUser()
  } catch (error) {
    toast.add({
      title: '加载失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    loading.value = false
  }
}

function chooseFrame(item: AvatarFrameItem | null) {
  if (!item) {
    selectedId.value = 0
    previewFramePath.value = ''
    return
  }
  selectedId.value = item.frame_id
  previewFramePath.value = toRelativeFramePath(item.avatar_frame)
}

function openExchange(item: AvatarFrameItem) {
  exchangeItem.value = item
  showExchangeModal.value = true
}

async function confirmExchange() {
  if (!exchangeItem.value || exchanging.value) return
  exchanging.value = true
  try {
    const res = await exchangeDeco(0, exchangeItem.value.frame_id)
    const cost = res.cost ?? exchangeItem.value.is_free ?? 0
    toast.add({
      title: `兑换成功，消耗 ${cost} 经验`,
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    showExchangeModal.value = false
    exchangeItem.value = null
    await fetchList(1)
  } catch (error) {
    toast.add({
      title: '兑换失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    exchanging.value = false
  }
}

async function loadMore() {
  if (loading.value) {
    toast.add({ title: '正在加载', icon: 'i-heroicons-exclamation-triangle', color: 'orange' })
    return
  }
  if (!hasMore.value) {
    toast.add({ title: '没有更多', icon: 'i-heroicons-information-circle', color: 'gray' })
    return
  }
  await fetchList(page.value + 1)
}

async function confirmUse() {
  if (selectedId.value === null) {
    toast.add({ title: '请先选择头像框', icon: 'i-heroicons-exclamation-triangle', color: 'orange' })
    return
  }
  if (saving.value) return
  saving.value = true
  try {
    await changeUserAvatarFrame(selectedId.value)
    await userStore.fetchUserInfo()
    toast.add({
      title: '修改成功',
      icon: 'i-heroicons-check-circle',
      color: 'green',
    })
    setTimeout(() => {
      router.back()
    }, 600)
  } catch (error) {
    toast.add({
      title: '修改失败',
      description: getErrorMessage(error),
      icon: 'i-heroicons-x-circle',
      color: 'red',
    })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!userStore.token) {
    await navigateTo('/login')
    return
  }
  if (!userStore.user) {
    try {
      await userStore.fetchUserInfo()
    } catch {
      /* ignore */
    }
  }
  const current = toRelativeFramePath(userStore.user?.avatar?.avatar_frame)
  previewFramePath.value = current
  if (!current) selectedId.value = 0
  await fetchList(1)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50/80 via-gray-50 to-gray-50 pb-28 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
    <div class="mx-auto max-w-2xl px-4 pt-5 md:pt-8">
      <div class="mb-5">
        <button
          type="button"
          class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-qhx-primary"
          @click="router.back()"
        >
          <Icon name="i-heroicons-arrow-left" class="h-4 w-4" />
          返回
        </button>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          更换头像框
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          点击下方头像框可预览效果
        </p>
      </div>

      <!-- 预览 -->
      <section class="mb-6 rounded-3xl border border-pink-100/80 bg-white p-6 text-center shadow-sm dark:border-pink-900/40 dark:bg-gray-800">
        <div class="mb-4 text-sm font-semibold tracking-wide text-qhx-primary">
          头像预览
        </div>
        <div class="mx-auto flex h-28 w-28 items-center justify-center">
          <div class="relative h-24 w-24">
            <img
              :src="userFaceSrc"
              alt="头像预览"
              class="h-24 w-24 rounded-full object-cover shadow-md ring-2 ring-pink-100 dark:ring-pink-900/40"
            >
            <img
              v-if="previewFrameSrc"
              :src="previewFrameSrc"
              alt="头像框"
              class="pointer-events-none absolute inset-0 z-10 origin-center scale-110 object-cover"
            >
          </div>
        </div>
        <p class="text-xs text-gray-400">
          点击下方头像框可预览效果
        </p>
      </section>

      <section>
        <h2 class="mb-3 px-1 text-sm font-semibold text-qhx-primary">
          选择头像框
        </h2>
        <AvatarFrameList
          :list="list"
          :selected-id="selectedId"
          @choose="chooseFrame"
          @exchange="openExchange"
        />

        <div class="mt-4 flex justify-center">
          <button
            v-if="hasMore || loading"
            type="button"
            class="rounded-full border border-pink-200 bg-white px-4 py-2 text-sm text-qhx-primary disabled:opacity-50 dark:border-pink-900 dark:bg-gray-800"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? '加载中…' : '加载更多' }}
          </button>
          <p
            v-else-if="list.length > 0"
            class="text-xs text-gray-400"
          >
            已加载全部
          </p>
        </div>
      </section>
    </div>

    <!-- 底部确认 -->
    <div class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <div class="mx-auto max-w-2xl">
        <QhxJellyButton class="w-full">
          <button
            type="button"
            class="w-full rounded-full bg-gradient-to-r from-[#faa2ae] to-[#f88a9a] py-3 text-base font-semibold text-white shadow-lg shadow-pink-200/60 disabled:opacity-60"
            :disabled="saving || selectedId === null"
            @click="confirmUse"
          >
            {{ saving ? '提交中…' : '确认使用' }}
          </button>
        </QhxJellyButton>
      </div>
    </div>

    <QhxModal v-model="showExchangeModal" :close-on-backdrop="!exchanging">
      <div class="w-[min(92vw,22rem)] rounded-2xl bg-white p-5 dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          兑换头像框
        </h3>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {{ exchangeModalContent }}
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            :disabled="exchanging"
            @click="showExchangeModal = false"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-full bg-qhx-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            :disabled="exchanging"
            @click="confirmExchange"
          >
            {{ exchanging ? '兑换中…' : '确认兑换' }}
          </button>
        </div>
      </div>
    </QhxModal>
  </div>
</template>
