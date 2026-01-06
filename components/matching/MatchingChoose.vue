<!-- 选择搭配组件 -->
<template>
  <UModal v-model="show" :overlay="true" :ui="{ width: 'max-w-3xl' }">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h3 class="text-lg font-semibold">选择搭配</h3>
      <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="closeModel" />
    </div>

    <div class="p-4 space-y-4">
      <!-- 搜索框 -->
      <UInput
        v-model="keywords"
        placeholder="搜索搭配 多条件空格分割."
        class="flex-1 focus:ring-0"
        :autofocus="false"
        @keyup.enter="search"
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

      <!-- 筛选栏 -->
      <div class="flex justify-between items-center">
        <div v-show="choose_item">已选择 1</div>
        <UButton color="primary" @click="confirmChoose">确认选择</UButton>
      </div>
      <div class="space-y-6 max-h-[60vh] overflow-y-auto">
        <!-- 已选列表 -->
        <div v-if="choose_item" class="space-y-2">
          <div class="bg-qhx-primary flex items-center p-2 rounded-lg">
            <img
              v-if="choose_item.cover"
              :src="`${BASE_IMG}${choose_item.cover}?x-oss-process=image/quality,q_100/resize,w_100`"
              :alt="choose_item.note || '搭配图片'"
              class="w-20 h-20 object-cover rounded-lg"
            />
            <div class="ml-3 flex-1">
              <div class="font-semibold text-sm">{{ choose_item.note || '未命名搭配' }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ choose_item.user_name }}</div>
            </div>
            <QhxJellyButton>
              <div class="h-[30px] text-center px-1 cursor-pointer" @click="choose_item = null">
                <div
                  class="m-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center"
                  style="font-size: 22px">
                  <UIcon name="ant-design:close-outlined" class="text-[22px] text-[#ffffff]" />
                </div>
              </div>
            </QhxJellyButton>
          </div>
        </div>

        <!-- 可选列表 -->
        <div v-if="listData.length" class="space-y-2">
          <div
            v-for="item in listData"
            :key="item.matching_id"
            v-show="!choose_item || choose_item.matching_id !== item.matching_id"
            class="flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            @click="chooseMatching(item)"
          >
            <img
              v-if="item.cover"
              :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_100`"
              :alt="item.note || '搭配图片'"
              class="w-20 h-20 object-cover rounded-lg"
            />
            <div class="ml-3 flex-1">
              <div class="font-semibold text-sm">{{ item.note || '未命名搭配' }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ item.user_name }}</div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!listData.length && !loading" class="text-center text-gray-400 py-6">
          暂无数据
        </div>
        <div class="py-3">
          <QhxLoading :loading="loading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore"></QhxLoading>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getMatchingListList } from '@/api/matching_list'
import type { MatchingListItem } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'

const props = defineProps({
  needStatus: { type: Boolean, default: true },
  filter_list: { type: Array as () => any[], default: () => [] },
  needExamin: { type: Boolean, default: true }
})
const emit = defineEmits(['choose'])

const show = ref(false)
const keywords = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const total = ref(0)
const listData = ref<MatchingListItem[]>([])
const choose_item = ref<MatchingListItem | null>(null)
const toast = useToast()

const closeModel = () => {
  show.value = false
  init()
}
const showModel = () => {
  show.value = true
}

const loadMore = async () => {
  if (loading.value) {
    return
  }
  // 加载更多数据
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value += 1
    try {
      await getMatchingList()
    } catch (error) {
      page.value -= 1
    }
  }
}
const search = () => {
  page.value = 1
  getMatchingList()
}

function chooseMatching(item: MatchingListItem) {
  choose_item.value = item
}

function confirmChoose() {
  if (!choose_item.value) {
    toast.add({
      title: '请选择搭配',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  emit('choose', choose_item.value)
  closeModel()
}

function init() {
  keywords.value = ''
  choose_item.value = null
  page.value = 1
}

const getMatchingList = async (initPage: number | undefined = undefined, initPageSize: number | undefined = undefined) => {
  if (loading.value) return
  loading.value = true
  let params: any = {
    page: initPage || page.value,
    pageSize: initPageSize || pageSize.value,
    keyword: keywords.value,
    filter_list: props.filter_list
  }

  try {
    const res = await getMatchingListList(params)
    if (page.value === 1) {
      listData.value = res.rows
    } else {
      listData.value = [...listData.value, ...res.rows]
    }
    total.value = res.count
  } catch (error) {
    console.error('获取搭配列表失败:', error)
  } finally {
    loading.value = false
  }
}

defineExpose({
  showModel,
  closeModel
})

onMounted(() => {
  if (show.value) {
    getMatchingList()
  }
})

watch(show, (newVal) => {
  if (newVal) {
    getMatchingList()
  }
})
</script>

<style scoped></style>

