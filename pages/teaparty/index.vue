<script setup lang="ts">
import type { Teaparty, PaginationResponse } from '@/types/api';
import { getTeapartyList } from '@/api/teapart';
import { BASE_IMG } from '@/utils/ipConfig';
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type TeapartyAdd from '@/components/Teaparty/TeapartyAdd.vue'

const { t } = useI18n()
const layoutReady = inject('layoutReady') as Ref<boolean>
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const teapartyAddRef = ref<InstanceType<typeof TeapartyAdd> | null>(null)
const router = useRouter()
const route = useRoute()

// 搜索关键词
const keyword = ref('')
const value = ref('')

// 筛选条件
const teaType = ref<number | undefined>(undefined)
const province = ref<string | undefined>(undefined)
const city = ref<string | undefined>(undefined)
const area = ref<string | undefined>(undefined)

// SEO 配置
useHead({
  title: '茶会列表',
  meta: [
    {
      name: 'keywords',
      content: '茶会,Lo研社,洛丽塔茶会'
    },
    {
      name: 'description',
      content: '洛丽塔茶会列表'
    }
  ]
})

definePageMeta({
  name: 'teaparty'
})

// 统一处理搜索逻辑
const handleSearch = () => {
  keyword.value = value.value.trim()
  waterList.value?.refresh()
}

// 打开新增茶会弹窗
const openAddTeaparty = (e?: MouseEvent) => {
  teapartyAddRef.value?.showModel(null, false, e)
}

// 新增/编辑成功后刷新列表
const handleTeapartySaved = () => {
  waterList.value?.refresh()
}

// 跳转到茶会详情
const jumpToDetail = (teaId: number) => {
  router.push(`/teaparty/detail/${teaId}`)
}

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 搜索栏 -->
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索茶会标题或描述..."
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

      <!-- 新增茶会 -->
      <div class="flex items-center justify-end">
        <UButton
          icon="i-heroicons-plus"
          class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          @click="(e: MouseEvent) => openAddTeaparty(e)"
        >
          新增茶会
        </UButton>
      </div>
    </div>

    <!-- 茶会列表 - 瀑布流 -->
    <QhxWaterList
      v-if="layoutReady"
      ref="waterList"
      :fetch-data="async (page, pageSize) => {
        const response = await getTeapartyList({
          page,
          pageSize,
          keyword: keyword || undefined,
          tea_type: teaType,
          province: province,
          city: city,
          area: area
        })
        return {
          rows: response.rows,
          count: response.count
        }
      }"
      :columns="4"
      :itemKey="0"
      :columns_768="2"
      :enableWaterfall="true"
      :enableLoadMore="true"
    >
      <template #default="{ item, debouncedApplyLayout }">
        <div class="custom-item" :key="item.tea_id">
          <div
            class="bg-white dark:bg-gray-800 p-2 m-1 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 dark:border-gray-700"
            @click="jumpToDetail(item.tea_id!)"
          >
            <!-- 封面图片 -->
            <div v-if="item.tea_cover" class="relative w-full overflow-hidden">
              <img
                :src="`${BASE_IMG}${item.tea_cover}`"
                :alt="item.tea_title"
                class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                @load="debouncedApplyLayout"
              />
              <!-- <div
                v-if="item.current_number !== undefined && item.limit_number !== undefined"
                class="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs font-medium"
              >
                {{ item.current_number }}/{{ item.limit_number }}
              </div> -->
            </div>

            <!-- 内容区域 -->
            <div class="p-4">
              <!-- 标题 -->
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                {{ item.tea_title }}
              </h3>

              <!-- 描述 -->
              <p
                v-if="item.tea_desc"
                class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2"
              >
                {{ item.tea_desc }}
              </p>

              <!-- 时间信息 -->
              <div class="space-y-1 mb-3">
                <div v-if="item.start_time" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  <span>开始: {{ formatDate(item.start_time) }}</span>
                </div>
                <div v-if="item.end_time" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  <span>结束: {{ formatDate(item.end_time) }}</span>
                </div>
              </div>

              <!-- 地点信息 -->
              <div v-if="item.province || item.city || item.area" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                <span>{{ [item.province, item.city, item.area].filter(Boolean).join(' ') }}</span>
              </div>

              <!-- 管理员信息 -->
              <div v-if="item.user" class="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <img
                  v-if="item.user.user_face"
                  :src="`${BASE_IMG}${item.user.user_face}`"
                  :alt="item.user.user_name"
                  class="w-6 h-6 rounded-full object-cover"
                />
                <span class="text-xs text-gray-600 dark:text-gray-400">
                  {{ item.user.user_name || '管理员' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </QhxWaterList>

    <!-- 新增/编辑弹窗 -->
    <TeapartyAdd ref="teapartyAddRef" @success="handleTeapartySaved" />
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

