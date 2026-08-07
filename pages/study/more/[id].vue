<script setup lang="ts">
import type { Study } from '@/types/api'
import { getStudyList, getStudyId, insertStudy, updateStudy } from '@/api/study'
import type StudyAdd from '@/components/study/StudyAdd.vue'
import {
  STUDY_107_NOUN_CATEGORY_DEFS,
  STUDY_107_NOUN_PARENT_ID
} from '@/utils/study107NounCategories'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const user = useUserStore()
const id = computed(() => Number(route.params.id) || 0)
const studyAddRef = ref<InstanceType<typeof StudyAdd> | null>(null)

// 分页
const pageSize = 40
const page = ref(1)
const list = ref<Study[]>([])
const total = ref(0)
const parent = ref<Study | null>(null)
const isLoading = ref(false)
const seedingCategories = shallowRef(false)

const isNounGlossaryPage = computed(() => id.value === STUDY_107_NOUN_PARENT_ID)

const missingNounCategories = computed(() => {
  if (!isNounGlossaryPage.value) return []
  const titles = new Set(list.value.map((r) => r.study_title))
  return STUDY_107_NOUN_CATEGORY_DEFS.filter((c) => !titles.has(c.study_title))
})

const openAddStudy = (e?: MouseEvent) => {
  studyAddRef.value?.showModel(null, id.value, e)
}

const handleStudySaved = async () => {
  await fetchList()
}

/** 在 107 下补齐已确认的 1–6 分类（study_type=1 · studyMore） */
const seedNounCategories = async () => {
  if (!isNounGlossaryPage.value || seedingCategories.value) return
  if (!user.token) {
    toast.add({
      title: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  const todo = missingNounCategories.value
  if (!todo.length) {
    toast.add({
      title: '分类已齐全',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    return
  }
  seedingCategories.value = true
  try {
    for (const cat of todo) {
      const created = await insertStudy({
        study_title: cat.study_title,
        study_desc: '',
        study_cover: null,
        study_type: 1,
        study_url: '',
        sort: cat.sort,
        parent_id: STUDY_107_NOUN_PARENT_ID
      })
      const studyUrl = `pages/study/studyMore?id=${created.study_id}`
      await updateStudy({
        study_id: created.study_id,
        study_title: cat.study_title,
        study_desc: '',
        study_cover: created.study_cover ?? null,
        study_type: 1,
        study_url: studyUrl,
        sort: cat.sort,
        parent_id: STUDY_107_NOUN_PARENT_ID
      })
    }
    toast.add({
      title: `已新增 ${todo.length} 个分类`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    await fetchList()
  } catch (e) {
    console.error('初始化名词释义分类失败', e)
    toast.add({
      title: '初始化分类失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    seedingCategories.value = false
  }
}

// SEO
useHead({
  title: computed(() => parent.value ? `${parent.value.study_title} - 更多 - Lo研社` : '研习更多 - Lo研社'),
})

// 获取父级信息
const fetchParent = async () => {
  if (!id.value) return
  try {
    const res = await getStudyId({ study_id: id.value })
    parent.value = res as Study
  } catch (e) {
    console.error('获取研习信息失败', e)
  }
}

// 获取子列表
const fetchList = async (isLoadMore = false) => {
  if (!id.value) return
  if (isLoading.value && !isLoadMore) return
  isLoading.value = true

  try {
    if (!isLoadMore) {
      page.value = 1
    }
    const currentPage = page.value
    const res = await getStudyList({
      page: currentPage,
      pageSize,
      parent_id: id.value,
    })
    const rows = res.rows ?? []
    const count = res.count ?? 0
    const data = res as Record<string, unknown>
    if (data?.parent && !parent.value) {
      parent.value = data.parent as Study
    }

    if (isLoadMore) {
      list.value = [...list.value, ...rows]
    } else {
      list.value = rows
    }
    total.value = count
  } catch (e) {
    console.error('获取研习列表失败', e)
  } finally {
    isLoading.value = false
  }
}

// 加载更多
const loadMore = () => {
  if (isLoading.value) return
  const maxPage = Math.ceil(total.value / pageSize)
  if (page.value >= maxPage) return
  page.value += 1
  fetchList(true)
}

const hasMore = computed(() => page.value < Math.ceil(total.value / pageSize))

// 初始化
onMounted(async () => {
  await fetchParent()
  await fetchList()
})
</script>

<template>
  <div class="container mx-auto p-4 pb-20 min-h-screen">
    <!-- 顶部返回 + 父级标题 -->
    <div class="mb-4 flex items-center gap-3">
      <button
        type="button"
        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
        @click="router.back()"
      >
        <span class="i-heroicons-arrow-left text-lg text-gray-600 dark:text-gray-400" />
      </button>
      <div v-if="parent" class="study-title flex items-center gap-3 flex-1 min-w-0">
        <img
          :src="`${BASE_IMG}${parent.study_cover || 'static/plan_cover/default.jpg'}`"
          :alt="parent.study_title"
          class="w-10 h-10 rounded-lg object-cover shrink-0"
          loading="lazy"
        >
        <span class="font-bold text-gray-800 dark:text-gray-200 truncate">{{ parent.study_title }}</span>
      </div>
      <div v-else class="flex-1" />
      <UButton
        v-if="isNounGlossaryPage && missingNounCategories.length"
        :loading="seedingCategories"
        icon="i-heroicons-rectangle-stack"
        size="sm"
        color="gray"
        variant="soft"
        class="shrink-0"
        @click="seedNounCategories"
      >
        初始化分类({{ missingNounCategories.length }})
      </UButton>
      <UButton
        icon="i-heroicons-plus"
        size="sm"
        class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover shrink-0"
        @click="(e: MouseEvent) => openAddStudy(e)"
      >
        新增研习
      </UButton>
    </div>

    <!-- 子列表 4 列网格 -->
    <div class="study-list-wrap grid grid-cols-4 gap-2">
      <div
        v-for="child in list"
        :key="child.study_id"
        class="study-list-box relative"
      >
        <StudyItem :item="child" size="mini" />
        <span
          v-if="child.count && child.count > 0"
          class="absolute top-1 right-2 min-w-[20px] h-5 px-1 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center"
        >
          {{ child.count > 99 ? '99+' : child.count }}
        </span>
      </div>
    </div>

    <!-- 加载更多 -->
    <div class="mt-6 flex justify-center">
      <div
        v-if="isLoading && list.length > 0"
        class="text-gray-500 text-sm"
      >
        加载中…
      </div>
      <button
        v-else-if="hasMore && list.length > 0"
        type="button"
        class="px-6 py-2 text-sm rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        @click="loadMore"
      >
        加载更多
      </button>
      <div
        v-else-if="list.length > 0"
        class="text-gray-400 text-sm"
      >
        没有更多了
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!isLoading && list.length === 0" class="text-center text-gray-500 py-16">
      <p class="mb-4">暂无研习内容</p>
      <UButton
        icon="i-heroicons-plus"
        class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover"
        @click="(e: MouseEvent) => openAddStudy(e)"
      >
        添加第一条
      </UButton>
    </div>

    <StudyAdd ref="studyAddRef" @success="handleStudySaved" />
  </div>
</template>

<style scoped>
.study-cover {
  box-shadow: 1px 1px 10px rgba(0, 0, 0, 0.1);
}
</style>
