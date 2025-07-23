<script setup lang="ts">
// 新增单条合集数据
import { getStudyList } from '@/api/study';
import type { PaginationResponse, Study } from '@/types/api'
const router = useRouter()
const route = useRoute()
const column = ref(3)
// 分页参数
const pageSize = 20
// const total = ref(0)
// const list = ref<Shop[]>([])
const page = ref(Number(route.query.page) || 1)
const keywords = ref('')
const value = ref('')
// 使用`use$Post`请求函数
const fetchList = async (): Promise<PaginationResponse<Study>> => {
  try {
    const response = await getStudyList({
      page: page.value,
      pageSize: pageSize,
      parent_id: 0
    })
    return response
  } catch (error) {
    if (process.client) {
      console.error('获取合集列表失败:', error)
    }

    // 返回一个空的结构，防止前端 .rows 报错
    return {
      rows: [],
      count: 0
    }
  }
}


const { data } = await useAsyncData('compilations', fetchList, {
  watch: [page, keywords]
})

const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)

const isLoading = computed(() => false)


// SEO 配置
useHead({
  title: 'Lolita文化研究与学习',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita合集汇总,Lolita'
    },
    {
      name: 'description',
      content: 'Lolita合集'
    }
  ]
})
// 页码改变处理函数
const handlePageChange = (current: number) => {
  page.value = current
  router.push({
    query: {
      ...route.query,
      page: current
    },
    force: true
  })
}
const waterList = () => {
  if (!window) {
    return
  }
  const layout = useWaterfallLayout('.study-list', column.value)
  // biome-ignore lint/complexity/noForEach: <explanation>
  layout.forEach(({ index, top, left }) => {
    const el = document.querySelectorAll<HTMLElement>('.study-list')[index]
    // el.style.position = 'absolute'
    el.style.top = `${top}px`
    el.style.left = `${left}px`
    el.style.display = 'block'
  })
}
onMounted(() => {
  if (window.innerWidth < 768) {
    column.value = 1
  } else {
    waterList()
  }
})
// 统一处理搜索逻辑
const handleSearch = () => {
  keywords.value = value.value.trim()
  // 执行搜索操作（示例）

  if (keywords.value) {
    page.value = 1
  }
}
</script>
<template>
  <div class="container mx-auto p-4 pb-20">
    <!-- <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4  pb-3">
      <div class="w-full flex items-center">
        <UInput
          v-model="value"
          placeholder="搜索店铺 多条件空格分割."
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
    </div> -->

    <!-- 空状态 -->
    <!-- <div v-else-if="!list?.length" class="text-center text-gray-500 py-8">
      暂无数据
    </div> -->
    <div class="relative min-h-[600px] flex max-md:block" v-if="total > 0">
      <div v-for="study in list" :key="study.study_id"
        class="study-list w-full md:w-1/3  max-md:static absolute  rounded-[18px] transition-all duration-300 flex flex-col items-center overflow-hidden">
        <div class="polaroid-card w-full m-3">
          <div class="flex items-center w-full p-3">
            <div class=" w-[40px] h-[40px] relative">
              <img :src="`${BASE_IMG}${study.study_cover || 'static/plan_cover/default.jpg'}`"
                :alt="study.study_title || 'lo研社'" class="w-full h-full object-cover round" loading="lazy" />
            </div>
            <div class="ml-2 flex-1">{{ study.study_title }}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 w-full max-md:grid-cols-3 p-3">
            <div v-for="(child, index) in study.child">
              <StudyItem :item="child" v-if="index < 11"></StudyItem>
              <div v-else class="text-center">
                <div>
                  <img :src="`${BASE_IMG}${child.study_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="child.study_title"
                    class="w-[60px] h-[60px] rounded-[10px] shadow-sm object-cover border border-gray-200 my-2 mx-auto"
                    loading="lazy" />
                </div>
                <div class="mx-2">
                  更多
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      暂无数据
    </div>

    <!-- 分页组件 -->
    <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination v-model="page" :total="total / 2" :ui="{
        wrapper: 'flex items-center gap-1',
        base: 'flex items-center gap-1',
      }" @change="handlePageChange" />
    </div>
  </div>
</template>

<style scoped></style>
