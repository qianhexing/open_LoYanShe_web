<template>
  <div class="container mx-auto min-h-screen" v-if="user">
    <div class="flex justify-between items-center p-4">
      <div class="text-lg font-medium text-gray-800 dark:text-gray-200">
        审核未通过/待审核图鉴
      </div>
      <!-- <NuxtLink
        to="/library/my"
        class="text-sm text-qhx-primary hover:underline"
      >
        我的图鉴
      </NuxtLink> -->
    </div>
    <div class="flex flex-wrap gap-2 px-4 pb-4">
      <QhxTag
        v-for="opt in examinOptions"
        :key="opt.value"
        :active="selectedExamin === opt.value"
        class="cursor-pointer"
        @click="changeExaminFilter(opt.value)"
      >
        {{ opt.label }}
      </QhxTag>
    </div>
    <QhxWaterList
      ref="waterList"
      :fetch-data="fetchExaminLibraryList"
      :columns="3"
      :itemKey="0"
      :columns_768="1"
      :enableWaterfall="true"
      :enableLoadMore="true"
    >
      <template #default="{ item, debouncedApplyLayout }">
        <div class="custom-item m-2" :key="item.library_id">
          <div class="p-2 polaroid-card">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-500">审核状态：</span>
              <span
                class="text-xs font-medium px-2 py-0.5 rounded"
                :class="examinStateClass(item.examin)"
              >
                {{ formateExaminState(item.examin) }}
              </span>
            </div>
            <div
              v-if="item.examin_reason"
              class="text-xs text-amber-600 dark:text-amber-400 mb-2 line-clamp-2"
            >
              审核意见：{{ item.examin_reason }}
            </div>
            <LibraryItem
              :size="'mini-list'"
              :item="item"
              @image-load="debouncedApplyLayout"
            />
          </div>
        </div>
      </template>
    </QhxWaterList>
  </div>
  <!-- <div v-else class="flex justify-center items-center min-h-screen text-gray-500">
    请先登录
  </div> -->
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getLibraryList } from '@/api/library'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'

const userStore = storeToRefs(useUserStore())
const { user } = userStore
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)

// 审核状态筛选：''=全部(1,2,3) 1=待审核 2=拒绝 3=永久拒绝
const selectedExamin = ref<'' | 1 | 2 | 3>('')
const examinOptions: { label: string; value: '' | 1 | 2 | 3 }[] = [
  { label: '全部', value: '' },
  { label: '待审核', value: 1 },
  { label: '拒绝', value: 2 },
  { label: '永久拒绝', value: 3 }
]

const changeExaminFilter = (value: '' | 1 | 2 | 3) => {
  selectedExamin.value = value
  waterList.value?.refresh()
}

// examin 非0：1待审核 2拒绝 3永久拒绝，显示全部用户的
const fetchExaminLibraryList = async (page: number, pageSize: number) => {
  const examinArr = selectedExamin.value === '' ? [1, 2, 3] : [selectedExamin.value]
  const response = await getLibraryList({
    page,
    pageSize,
    filter_list: [],
    examin: examinArr
  })
  return {
    rows: response.rows,
    count: response.count
  }
}

const formateExaminState = (state: number | undefined) => {
  if (state === undefined) return '未知'
  switch (state) {
    case 0:
      return '通过'
    case 1:
      return '待审核'
    case 2:
      return '拒绝'
    case 3:
      return '永久拒绝'
    default:
      return '未知'
  }
}

const examinStateClass = (state: number | undefined) => {
  switch (state) {
    case 1:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 2:
    case 3:
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}
</script>

<style scoped>
.polaroid-card {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-sm;
}
</style>
