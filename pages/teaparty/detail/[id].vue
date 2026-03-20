<template>
  <div class="min-h-screen bg-[#fff8f8] dark:bg-[#1a1a1a] relative overflow-hidden font-serif">
    <!-- 动态背景 -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://lolitalibrary.com/assets/img/pattern-dot.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      <div class="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-pink-200/30 to-purple-200/30 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full blur-3xl animate-blob"></div>
      <div class="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/20 to-pink-200/20 dark:from-blue-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-[20%] right-[20%] w-[700px] h-[700px] bg-gradient-to-t from-purple-200/20 to-pink-200/30 dark:from-purple-900/10 dark:to-pink-900/10 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center min-h-screen">
      <div class="relative">
        <div class="w-16 h-16 border-4 border-pink-100 rounded-full"></div>
        <div class="absolute top-0 left-0 w-16 h-16 border-4 border-pink-400 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p class="mt-4 text-pink-400 dark:text-pink-300 tracking-widest text-sm uppercase">加载中...</p>
    </div>

    <!-- 主要内容 -->
    <div v-else-if="detail" class="relative z-10 pb-20">
      <!-- 顶部操作栏 -->
      <div class="fixed top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <button
          @click="goBack"
          class="pointer-events-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center shadow-lg border border-white/50 dark:border-gray-700 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
        >
          <UIcon name="i-heroicons-arrow-left" class="text-lg" />
        </button>
        <div class="flex items-center gap-3 pointer-events-auto">
          <button
            @click="handleShare"
            class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-2 hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
          >
            <UIcon name="ic:round-share" class="text-lg" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">分享</span>
          </button>
        </div>
      </div>

      <!-- 顶部封面 + 标题 -->
      <section class="pt-16 pb-6 px-4 md:px-0 max-w-5xl mx-auto">
        <div class="grid md:grid-cols-[320px,1fr] gap-6 items-start">
          <!-- 封面 -->
          <div class="relative group">
            <div
      v-if="detail.tea_cover"
              class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-3xl p-2 shadow-xl border border-white/50 dark:border-gray-700 overflow-hidden"
            >
              <img
                :src="fullCoverUrl"
                :alt="detail.tea_title || '茶会封面'"
                class="w-full h-full max-h-[420px] object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div
                v-if="detail.start_time || detail.end_time"
                class="absolute bottom-4 left-4 right-4 bg-black/40 text-white text-xs px-3 py-2 rounded-full flex items-center justify-between gap-2 backdrop-blur-sm"
              >
                <div class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  <span>{{ formatDate(detail.start_time) }}</span>
                </div>
                <span v-if="detail.end_time">~ {{ formatDate(detail.end_time) }}</span>
              </div>
            </div>
            <div
              v-else
              class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/50 dark:border-gray-700 flex items-center justify-center h-[260px] text-gray-400"
            >
              暂无封面
            </div>
          </div>

          <!-- 标题与关键信息 -->
          <div class="space-y-4">
            <h1
              class="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent tracking-tight"
            >
              {{ detail.tea_title || '未命名茶会' }}
            </h1>

            <p
              v-if="detail.tea_desc"
              class="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base whitespace-pre-line"
            >
              {{ detail.tea_desc }}
            </p>

            <!-- 时间与人数 -->
            <div class="space-y-2 text-sm">
              <div v-if="detail.start_time || detail.end_time" class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <UIcon name="i-heroicons-calendar" class="w-5 h-5 text-pink-500" />
                <div class="space-y-0.5">
                  <div v-if="detail.start_time">
                    <span class="font-medium">开始：</span>{{ formatDate(detail.start_time) }}
                  </div>
                  <div v-if="detail.end_time">
                    <span class="font-medium">结束：</span>{{ formatDate(detail.end_time) }}
                  </div>
                  <div v-if="detail.start_time && detail.end_time" class="text-xs text-gray-500">
                    预计时长：{{ durationText }}
                  </div>
                </div>
              </div>

              <div
                v-if="detail.limit_number || detail.current_number"
                class="flex items-center gap-2 text-gray-600 dark:text-gray-300"
              >
                <UIcon name="i-heroicons-user-group" class="w-5 h-5 text-purple-500" />
                <div>
                  <span class="font-medium">人数：</span>
                  <span v-if="detail.current_number !== undefined">
                    {{ detail.current_number }} / {{ detail.limit_number || '不限' }}
                  </span>
                  <span v-else>
                    {{ detail.limit_number ? `上限 ${detail.limit_number} 人` : '人数不限' }}
                  </span>
                </div>
              </div>

              <div v-if="locationText" class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-blue-500" />
                <span class="truncate">
                  <span class="font-medium">地点：</span>{{ locationText }}
                </span>
              </div>

              <div v-if="detail.latitude && detail.longitude" class="flex items-center gap-2 text-xs text-gray-500">
                <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
                <span>坐标：{{ detail.latitude }}, {{ detail.longitude }}</span>
                <a
                  :href="mapLink"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 underline"
                >
                  打开地图
                  <UIcon name="i-heroicons-arrow-up-right" class="w-3 h-3" />
                </a>
              </div>
            </div>

            <!-- 发起人 -->
            <div
              v-if="detail.user"
              class="flex items-center gap-3 mt-4 p-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 border border-white/50 dark:border-gray-700 shadow-sm"
            >
              <img
                v-if="detail.user.user_face"
                :src="`${BASE_IMG}${detail.user.user_face}`"
                :alt="detail.user.user_name || '发起人头像'"
                class="w-9 h-9 rounded-full object-cover"
              />
              <div class="flex-1 min-w-0">
                <div class="text-xs text-gray-500 dark:text-gray-400">收录人</div>
                <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {{ detail.user.user_name || '管理员' }}
                </div>
              </div>
            </div>

            <!-- 参与方式提示（仅展示，不提供操作） -->
            <!-- <div v-if="detail.join_way" class="flex flex-wrap items-center gap-2 mt-4 text-xs text-gray-500">
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
              <span>
                参与方式：{{ detail.join_way === 2 ? '需要发起人审批' : '直接参与' }}
              </span>
            </div> -->
          </div>
        </div>
      </section>

      <!-- 内容区：详情图片 -->
      <section class="px-4 md:px-0 max-w-5xl mx-auto space-y-10">
        <!-- 详情图片 -->
        <div v-if="imageList.length" class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <UIcon name="i-heroicons-photo" class="w-5 h-5 text-pink-500" />
            茶会现场预览
          </h2>
          <div class="grid md:grid-cols-2 gap-4">
            <div
              v-for="(image, index) in imageList"
              :key="index"
              class="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-2 shadow-md border border-white/50 dark:border-gray-700 overflow-hidden"
            >
              <QhxPreviewImage
                :list="[
                  {
                    src: image.replace(BASE_IMG, ''),
                    alt: `${detail.tea_title || '茶会'} - 第${index + 1}张`,
                    title: detail.tea_title || '茶会'
                  }
                ]"
                :preview="[image.replace(BASE_IMG, '')]"
                className="w-full max-w-full h-auto object-cover rounded-xl cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>

      </section>

      <!-- 返图板块 -->
      <section class="px-4 md:px-0 max-w-5xl mx-auto mt-6">
        <QhxTabs :tabs="['返图']">
          <QhxTabPanel :index="0">
            <template #default="{ isActive }">
              <div v-if="isActive" class="py-4">
                <CommunityForeignList
                  v-if="detail?.tea_id"
                  :pk_type="6"
                  :pk_id="detail.tea_id"
                />
              </div>
            </template>
          </QhxTabPanel>
        </QhxTabs>
      </section>
    </div>

    <!-- 无数据状态 -->
    <div v-else class="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div
        class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/50 dark:border-gray-700 max-w-md w-full"
      >
        <div class="text-5xl mb-6">🍵</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">茶会不存在</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-8">该茶会可能已被删除或不存在。</p>
        <UButton
          color="primary"
          class="px-8 py-3 rounded-full font-bold shadow-lg shadow-pink-500/30"
          @click="goBack"
        >
          返回
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted } from 'vue'
import type { Ref } from 'vue'
import type { Teaparty } from '@/types/api'
import { getTeapartyById } from '@/api/teapart'
import { BASE_IMG } from '@/utils/ipConfig'
import { useCopyCurrentUrl } from '@/composables/useCopyCurrentUrl'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
// 如果后续需要根据是否登录展示额外信息，可再引入 useUserStore

const loading = ref(true)
const detail = ref<Teaparty | null>(null)

// 完整封面地址
const fullCoverUrl = computed(() => {
  if (!detail.value?.tea_cover) return ''
  const cover = detail.value.tea_cover
  if (cover.startsWith('http')) return cover
  return `${BASE_IMG}${cover.startsWith('/') ? cover : `/${cover}`}`
})

// 地址文案
const locationText = computed(() => {
  if (!detail.value) return ''
  const { province, city, area, address } = detail.value
  return [province, city, area, address].filter(Boolean).join(' ')
})

// 地图链接（百度拾取）
const mapLink = computed(() => {
  if (!detail.value?.latitude || !detail.value?.longitude) return '#'
  const { latitude, longitude } = detail.value
  const title = encodeURIComponent(detail.value.tea_title || '茶会地点')
  const content = encodeURIComponent(locationText.value || '')
  return `https://api.map.baidu.com/marker?location=${latitude},${longitude}&title=${title}&content=${content}&output=html`
})

// 详情图片列表
const imageList = computed(() => {
  if (!detail.value?.detail_image) return []
  return detail.value.detail_image
    .split(',')
    .map(img => img.trim())
    .filter(img => img.length > 0)
    .map(img => {
      if (img.startsWith(BASE_IMG)) {
        return img
      }
      return `${BASE_IMG}${img.startsWith('/') ? img : `/${img}`}`
    })
})

// 时间格式化
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 时长文案
const durationText = computed(() => {
  if (!detail.value?.start_time || !detail.value?.end_time) return ''
  const start = new Date(detail.value.start_time as unknown as string)
  const end = new Date(detail.value.end_time as unknown as string)
  const diffMs = end.getTime() - start.getTime()
  if (diffMs <= 0) return ''
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours < 24) {
    return `${diffHours.toFixed(1)} 小时`
  }
  const diffDays = diffHours / 24
  return `${diffDays.toFixed(1)} 天`
})

// 加载详情
const loadDetail = async () => {
  try {
    loading.value = true
    const id = route.params.id as string
    const teaId = Number.parseInt(id)
    if (Number.isNaN(teaId)) {
      throw new Error('无效的茶会 ID')
    }
    detail.value = await getTeapartyById({ tea_id: teaId })
  } catch (error) {
    console.error('加载茶会详情失败:', error)
    toast.add({
      title: '加载失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 返回
const goBack = () => {
  router.back()
}

// 分享
const handleShare = async () => {
  try {
    const { copyCurrentUrl } = useCopyCurrentUrl()
    const result = await copyCurrentUrl()
    if (result?.success) {
      toast.add({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      toast.add({
        title: '复制失败',
        description: result?.message || '请手动复制链接',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
    }
  } catch (error) {
    console.error('复制链接失败:', error)
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// 等待布局准备好再加载（与茶会列表保持一致）
const layoutReady = inject('layoutReady') as Ref<boolean> | undefined

onMounted(async () => {
  if (!layoutReady) {
    await loadDetail()
    return
  }

  if (layoutReady.value) {
    await loadDetail()
  }
})

watch(
  () => layoutReady?.value,
  async (val) => {
    if (val) {
      await loadDetail()
    }
  }
)

useHead({
  title: computed(() =>
    detail.value ? `${detail.value.tea_title || '茶会详情'} - Lo研社茶会` : '茶会详情 - Lo研社'
  ),
  meta: [
    {
      name: 'description',
      content: computed(
        () => detail.value?.tea_desc || 'Lo研社 · 洛丽塔茶会详情'
      )
    }
  ]
})
</script>

<style scoped>
@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
</style>


