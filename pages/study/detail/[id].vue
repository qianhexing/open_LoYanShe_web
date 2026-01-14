<script setup lang="ts">
import type { Study } from '@/types/api';
import { getStudyId, getStudyForeignList } from '@/api/study'
import { BASE_IMG } from '@/utils/ipConfig'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = route.params.id as string

// --- 状态定义 ---
const detail = ref<Study | null>(null)
const activeTab = ref(0)
const currentListId = ref<number>(0)
const initLoading = ref(true) // 新增：页面初始化加载状态

// SEO
useHead({
  title: computed(() => detail.value ? `${detail.value.study_title} - Lo研社` : 'Lolita研习'),
})

// --- 初始化数据 ---
const initData = async () => {
  try {
    initLoading.value = true // 开始加载
    const res = await getStudyId({ study_id: Number(id) })
    const data = (res as any).data || res
    detail.value = data

    // 逻辑：有子分类选第一个，没有选自己
    if (detail.value?.child && detail.value.child.length > 0) {
      activeTab.value = 0
      currentListId.value = detail.value.child[0].study_id
    } else {
      currentListId.value = Number(id)
    }
  } catch (e) {
    console.error('获取专题详情失败', e)
  } finally {
    initLoading.value = false // 结束加载
  }
}

// --- 瀑布流数据获取---
const waterfallFetch = async (page: number, pageSize: number) => {
  try {
    const res = await getStudyForeignList({
      page: page,
      pageSize: pageSize,
      study_id: currentListId.value
    })

    const resData = (res as any).data || res
    const rawRows = resData.rows || []

    // 数据清洗
    const processedRows = rawRows.map((item: any) => {
      let cover = item.foreign?.cover
      let title = item.foreign?.title
      let avatar = ''
      let username = ''

      if (item.pk_type === 0 && item.community) {
        // 帖子处理
        if (item.community.img_list) {
          const imgs = item.community.img_list.split(',')
          if (imgs.length > 0) cover = imgs[0]
        }
        if (!title && item.community.content) {
          title = stripHtml(item.community.content)
        }
        avatar = item.community.user_avatar
        username = item.community.user_name
      } else if (item.pk_type === 1 && item.library) {
        // 图鉴处理
        cover = item.library.cover
        title = item.library.name
      }

      // 路径拼接
      if (cover && !cover.startsWith('http')) cover = BASE_IMG + cover
      if (avatar && !avatar.startsWith('http')) avatar = BASE_IMG + avatar

      return {
        ...item,
        id: item.pk_id,
        title: title || '无标题',
        cover: cover || '/placeholder.png',
        user: { avatar, nickname: username },
        type_name: getTypeName(item.pk_type)
      }
    })

    return {
      rows: processedRows,
      count: resData.count || 0
    }
  } catch (e) {
    console.error('加载失败', e)
    return { rows: [], count: 0 }
  }
}

// --- 交互逻辑 ---
const handleTabChange = (index: number) => {
  activeTab.value = index
  if (detail.value?.child?.[index]) {
    // 改变 Key 触发组件重置
    currentListId.value = detail.value.child[index].study_id
  }
}

// 点击投稿按钮
const handlePost = () => {
  toast.add({
    title: '错误',
    description: '暂时只支持APP端',
    icon: 'i-heroicons-exclamation-circle',
    color: 'red'
  })
}

// 点击封面跳转
const handleCoverClick = (item: any) => {
  // 只有帖子类型才跳转到 /post/${id}
  if (item.pk_type === 0) {
    router.push(`/post/${item.id}`)
  }
}

const stripHtml = (html: string) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').substring(0, 40).trim()
}

const getTypeName = (type: number) => {
  const map: Record<number, string> = { 0: '帖子', 1: '图鉴', 2: '店铺', 3: '合集', 4: '研习', 6: '链接' }
  return map[type] || ''
}

onMounted(() => {
  initData()
})
</script>

<template>
  <div class="container mx-auto p-4 min-h-screen">

    <div class="mb-6 bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-full transition">
          <span class="i-heroicons-arrow-left text-gray-600"></span>
        </button>
        <h1 class="text-xl font-bold text-gray-800">{{ detail?.study_title || 'Loading...' }}</h1>
      </div>
    </div>

    <div v-if="initLoading" class="flex justify-center py-20">
      <QhxLoading :loading="true" />
    </div>

    <div v-else>
      <div v-if="detail?.child && detail.child.length > 0" class="mb-4">
        <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button v-for="(item, index) in detail.child" :key="item.study_id" @click="handleTabChange(index)"
            class="px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border" :class="activeTab === index
              ? 'bg-pink-500 text-white border-pink-500 shadow-md'
              : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'">
            {{ item.study_title }}
          </button>
        </div>
      </div>

      <div
        class="mb-6 bg-pink-50 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-pink-100 transition group">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition">
            <span class="i-heroicons-plus w-6 h-6"></span>
          </div>
          <div>
            <UButton icon="i-heroicons-plus" block color="primary" size="lg" class="mb-6 font-bold" @click="handlePost">
              加入研习 / 投稿
            </UButton>
          </div>
        </div>
        <span class="i-heroicons-chevron-right text-gray-400"></span>
      </div>

      <ClientOnly>
        <div class="min-h-[300px]">
          <QhxWaterList v-if="currentListId" :key="currentListId" :fetch-data="waterfallFetch">
            <template #default="{ item }">
              <div
                class="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-2 break-inside-avoid hover:shadow-md transition group">

                <div class="relative cursor-pointer" @click="handleCoverClick(item)">
                  <img :src="item.cover" class="w-full h-auto object-cover min-h-[150px] bg-gray-50" loading="lazy"
                    alt="cover" />
                  <div v-if="item.pk_type === 1"
                    class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                    图鉴
                  </div>
                </div>

                <div class="p-3">
                  <h3
                    class="font-bold text-gray-800 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-pink-500 transition">
                    {{ item.title }}
                  </h3>

                  <div class="flex items-center justify-between mt-2">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                      <img :src="item.user?.avatar || '/placeholder-avatar.png'"
                        class="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 object-cover" />
                      <span class="text-xs text-gray-400 truncate max-w-[80px]">
                        {{ item.user?.nickname || 'Lo娘' }}
                      </span>
                    </div>

                  </div>
                </div>

              </div>
            </template>
          </QhxWaterList>
        </div>
      </ClientOnly>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 0px;
  width: 0px;
}

.custom-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>