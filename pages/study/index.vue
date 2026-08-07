<script setup lang="ts">
import { getStudyList } from '@/api/study'
import type { PaginationResponse, Study } from '@/types/api'
import type StudyAdd from '@/components/study/StudyAdd.vue'

const router = useRouter()
const route = useRoute()
const column = shallowRef(3)
const pageSize = 20
const page = shallowRef(Number(route.query.page) || 1)
const keywords = shallowRef('')
const studyAddRef = ref<InstanceType<typeof StudyAdd> | null>(null)

const fetchList = async (): Promise<PaginationResponse<Study>> => {
  try {
    const response = await getStudyList({
      page: page.value,
      pageSize: pageSize,
      parent_id: 0
    })
    return response
  } catch (error) {
    if (import.meta.client) {
      console.error('获取研习列表失败:', error)
    }
    return {
      rows: [],
      count: 0
    }
  }
}

const { data, refresh } = await useAsyncData('study-list', fetchList, {
  watch: [page, keywords]
})

const list = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.count ?? 0)

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
  if (!import.meta.client) return
  const layout = useWaterfallLayout('.study-list', column.value)
  // biome-ignore lint/complexity/noForEach: <explanation>
  layout.forEach(({ index, top, left }) => {
    const el = document.querySelectorAll<HTMLElement>('.study-list')[index]
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

const openAddStudy = (e?: MouseEvent) => {
  studyAddRef.value?.showModel(null, 0, e)
}

const handleStudySaved = async () => {
  await refresh()
  await nextTick()
  if (column.value > 1) {
    waterList()
  }
}
</script>

<template>
  <div class="container mx-auto p-4 pb-20">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">研习</h1>
      <UButton
        icon="i-heroicons-plus"
        class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
        @click="(e: MouseEvent) => openAddStudy(e)"
      >
        新增研习
      </UButton>
    </div>

    <div class="relative min-h-[600px] flex max-md:block" v-if="total > 0">
      <div
        v-for="study in list"
        :key="study.study_id"
        class="study-list w-full md:w-1/3 max-md:static absolute rounded-[18px] transition-all duration-300 flex flex-col items-center overflow-hidden"
      >
        <div class="polaroid-card w-full m-3">
          <div class="flex items-center w-full p-3">
            <div class="w-[40px] h-[40px] relative">
              <img
                :src="`${BASE_IMG}${study.study_cover || 'static/plan_cover/default.jpg'}`"
                :alt="study.study_title || 'lo研社'"
                class="w-full h-full object-cover round"
                loading="lazy"
              />
            </div>
            <div class="ml-2 flex-1">{{ study.study_title }}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 w-full max-md:grid-cols-3 p-3">
            <div v-for="(child, index) in study.child" :key="child.study_id">
              <StudyItem v-if="index < 11" :item="child" />
              <div
                v-else
                class="text-center cursor-pointer"
                @click="router.push(`/study/more/${study.study_id}`)"
              >
                <div>
                  <img
                    :src="`${BASE_IMG}${child.study_cover || 'static/plan_cover/default.jpg'}`"
                    :alt="child.study_title"
                    class="w-[60px] h-[60px] rounded-[10px] shadow-sm object-cover border border-gray-200 my-2 mx-auto"
                    loading="lazy"
                  />
                </div>
                <div class="mx-2">更多</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      <p class="mb-4">暂无数据</p>
      <UButton
        icon="i-heroicons-plus"
        class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
        @click="(e: MouseEvent) => openAddStudy(e)"
      >
        添加第一条
      </UButton>
    </div>

    <div v-if="total > 0" class="mt-8 flex justify-center">
      <UPagination
        v-model="page"
        :total="total / 2"
        :ui="{
          wrapper: 'flex items-center gap-1',
          base: 'flex items-center gap-1'
        }"
        @change="handlePageChange"
      />
    </div>

    <StudyAdd ref="studyAddRef" @success="handleStudySaved" />
  </div>
</template>

<style scoped></style>
