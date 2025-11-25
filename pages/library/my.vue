<template>
  <div class="container mx-auto min-h-screen" v-if="user">
    <div class="flex justify-between items-center p-2">
      <div class="text-sm text-gray-600">我上传的图鉴</div>
    </div>
    <QhxWaterList ref="waterList" :fetch-data="async (page, pageSize) => {
      if (!user?.user_id) {
        return {
          rows: [],
          count: 0
        }
      }
      const response = await getLibraryList({
        page, pageSize, filter_list: [{
          field: 'user_id',
          op: 'and',
          value: user?.user_id as number
        }],
        examin: [0,1,2,3]
      })
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="3" :itemKey="0" :columns_768="1" :enableWaterfall="true" :enableLoadMore="true">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item m-2" :key="item.pipe_id">
          <div class="p-2 polaroid-card">
            <div class="flex items-center justify-center">
              <div>审核状态：</div>
              <div>{{ formateExaminState(item.examin) }}</div>
            </div>
            <div class="flex items-center justify-center" v-if="item.examin_reason">
              <div>审核意见：</div>
              <div>{{ item.examin_reason }}</div>
            </div>
            <LibraryItem :size="'mini-list'" :item="item" @image-load="debouncedApplyLayout"></LibraryItem>
          </div>
        </div>
      </template>
    </QhxWaterList>
  </div>
  <div v-else class="flex items-center justify-center h-screen">
    请先登录
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import HorizontalDatePicker from '@/components/Qhx/HorizontalDatePicker.vue'
import { getLibraryList } from '@/api/library'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type { Library } from '@/types/api'

const userStore = storeToRefs(useUserStore())
const { user } = userStore
const pageSize = 20
const isLoading = ref(false)
const page = ref(1)
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const isCompact = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})
const formateExaminState = (state: number) => {
  // 审核 0 通过 1待审核 2拒绝
  switch (state) {
    case 0:
      return '通过'
    case 1:
      return '待审核'
    case 2:
      return '拒绝'
  }
  const list = ref<Library[]>([])
  const total = ref(0)
  const fetchLibraryList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
    if (!user.value?.user_id) {
      return {
        rows: [],
        count: 0
      }
    }
    const params = {
      page: Ipage || page.value,
      pageSize: IpageSize || pageSize,
      filter_list: [{
        field: 'user_id',
        op: 'and',
        value: user.value?.user_id
      }],
    }
    try {
      const response = await getLibraryList(params)
      if (page.value === 1) {
        list.value = response.rows
      } else {
        list.value = [...list.value, ...(response.rows ?? [])]
      }
      total.value = response.count
      return response
    } catch (error) {
      if (process.client) {
        console.error('获取店铺列表失败:', error)
      }
      return {
        rows: [],
        count: 0
      }
    }
  }
  onMounted(() => {
  })
}
</script>

<style scoped></style>
