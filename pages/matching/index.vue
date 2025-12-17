<script setup lang="ts">
import { getMatchingListListVisitor, type MatchingListItem } from '@/api/matching_list'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import { BASE_IMG } from '@/utils/ipConfig'
// biome-ignore lint/suspicious/noExplicitAny: uni-webview-js 类型声明缺失
let uni: any;
const layoutReady = inject('layoutReady') as Ref<boolean>
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const port = computed(() => configStore.getPort())
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const router = useRouter()
const keyword = ref('')
const value = ref('')
const filterList = ref<Record<string, unknown>>({})

// SEO 配置
useHead({
  title: '搭配列表',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,搭配,Lolita搭配'
    },
    {
      name: 'description',
      content: 'Lolita搭配汇总'
    }
  ]
})

onMounted(async () => {
  // @ts-ignore - uni-webview-js 类型声明缺失
  uni = await import('@dcloudio/uni-webview-js').catch((err: unknown) => {
    console.error('Failed to load uni-webview-js:', err);
  }); 
})
definePageMeta({
  name: 'matching',
  ssr: false
})

// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  waterList.value?.refresh()
}

// 跳转到搭配详情
const jumpToMatchingDetail = (item: MatchingListItem) => {
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (!item.matching_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		uni.navigateTo({
			url: `/pages/wardrobe/matchingDetail?id=${item.matching_id}`,
		});
	} else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: { url: `https://lolitalibrary.com/matching/detail/${item.matching_id}` }
      }));
    } else {
      // navigateTo(`/matching/detail/${item.matching_id}`)
      window.open(`/matching/detail/${item.matching_id}`, '_blank')
    }
  }
}

// 获取数据
const fetchMatchingData = async (page: number, pageSize: number) => {
  const params: { page: number; pageSize: number; keyword?: string; filter_list?: Record<string, unknown> } = {
    page: page,
    pageSize: pageSize,
    filter_list: {} as Record<string, unknown>,
    keyword: ''
  }
  const currentKeyword = keyword.value
  const currentFilterList = filterList.value
  if (currentKeyword) {
    params.keyword = currentKeyword
  }
  if (currentFilterList && Object.keys(currentFilterList).length > 0) {
    params.filter_list = currentFilterList as Record<string, unknown>
  }
  const response = await getMatchingListListVisitor(params)
  const data = response.rows
  return {
    rows: data,
    count: response.count
  }
}
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 搜索框 -->
    <div class="px-4 pb-3" v-if="true">
      <div class="w-full flex items-center gap-2">
        <UInput
          v-model="value"
          placeholder="搜索搭配"
          class="flex-1 focus:ring-0"
          :autofocus="false"
          @keyup.enter="handleSearch"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }"
        />
        <UButton
          icon="i-heroicons-magnifying-glass"
          variant="ghost"
          color="gray"
          @click="handleSearch"
        />
      </div>
    </div>

    <!-- 瀑布流列表 -->
    <QhxWaterList
      v-if="layoutReady"
      ref="waterList"
      :fetch-data="(page: number, pageSize: number) => fetchMatchingData(page, pageSize)"
      :columns="5"
      :itemKey="1"
      :columns_768="2"
      :enableWaterfall="true"
      :enableLoadMore="true"
    >
      <template #default="{ item, debouncedApplyLayout }">
        <div
          class="bg-white rounded-lg border-2 border-black shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer mx-1 mb-2 p-2"
          @click="jumpToMatchingDetail(item)"
        >
          <!-- 图片区域 -->
          <div class="w-full overflow-hidden rounded-t-lg" v-if="item.cover">
            <img
              :src="`${BASE_IMG}${item.cover}`"
              :alt="item.note || '搭配图片'"
              class="w-full object-cover"
              loading="lazy"
              @load="debouncedApplyLayout"
            />
          </div>

          <!-- 标题 -->
          <div
            v-if="item.note"
            class="matching-title px-2 py-1 text-sm line-clamp-1 h-6 leading-6"
          >
            {{ item.note }}
          </div>

          <!-- 用户信息 -->
          <div class="matching-user flex justify-end items-center h-7 px-2">
            <div class="user-face w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img
                :src="`${BASE_IMG}${item.user_face}?x-oss-process=image/quality,q_100/resize,w_20`"
                :alt="item.user_name"
                class="w-6 h-6 object-cover"
              />
            </div>
            <div class="user-name text-xs ml-1 text-gray-600">
              {{ item.user_name }}
            </div>
          </div>

          <!-- 主风格标签 -->
          <div
            v-if="item.main_style"
            class="matching-tags px-2 pb-1 text-xs text-red-500 line-clamp-1 h-5 leading-5"
          >
            <span
              v-for="(tag, index) in item.main_style.split(',')"
              :key="index"
              class="inline-block mr-1"
            >
              ★{{ tag }}
            </span>
          </div>

          <!-- 标签列表 -->
          <div
            v-if="item.tags_list && item.tags_list.length > 0"
            class="matching-tags px-2 pb-2 text-xs text-red-500 line-clamp-1 h-5 leading-5"
          >
            <span
              v-for="tag in item.tags_list"
              :key="tag.tags_id"
              class="inline-block mr-1"
            >
              #{{ tag.tags_name }}
            </span>
          </div>
        </div>
      </template>
    </QhxWaterList>
  </div>
</template>

