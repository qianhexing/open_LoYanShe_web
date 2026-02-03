<script setup lang="ts">
import type { Compilations, PaginationResponse, Library } from '@/types/api';
import { getCompById, getCompDetailList, insertCompDetailArray, deleteCompList, deleteCompListUser } from '@/api/compilations'
import { BASE_IMG } from '@/utils/ipConfig'
import type { MatchingListItem } from '@/api/matching_list'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type MatchingChoose from '@/components/matching/MatchingChoose.vue'
import LibraryItem from '@/components/library/LibraryItem.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'

const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const toast = useToast()
const id = route.params.id as string

const copyCompUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl()
  await copyCurrentUrl()
  toast.add({
    title: '复制成功',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
}
// 布局就绪状态
const layoutReady = ref(false)
const waterListRef = ref<InstanceType<typeof QhxWaterList> | null>(null)

// 获取合集详情
const { data } = await useAsyncData('compDeatil', () => {
  return getCompById({ comp_id: Number.parseInt(id) })
}, {})
const detail = ref<Compilations | null>(null)
detail.value = data.value ?? null

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN')
}

// 标签页
const currentNav = ref(0)
const navList = [
  { name: '合集列表' },
  { name: '考据研究' },
  { name: '评论区' }
]

const navChange = (index: number) => {
  currentNav.value = index
}

// 列表数据
const keywords = ref('')

// 获取合集列表数据（用于瀑布流）
const fetchCompilationsList = async (page: number, pageSize: number) => {
  try {
    const params = {
      comp_id: Number.parseInt(id),
      page: page,
      pageSize: pageSize,
      keywords: keywords.value || undefined
    }
    const res = await getCompDetailList(params)
    const data = res.rows.map((child: any) => {
      if (child.library) {
        return child.library
      } else if (child.matching_list) {
        return child
      } else {
        return child
      }
    })
    return {
      rows: data,
      count: res.count
    }
  } catch (error) {
    console.error('获取合集列表失败:', error)
    return {
      rows: [],
      count: 0
    }
  }
}

// 搜索
const search = () => {
  // 刷新瀑布流数据
  if (waterListRef.value) {
    waterListRef.value.refresh()
  }
}

// 添加图鉴/搭配
const showAddLibrary = ref(false)
const showAddMatching = ref(false)
const addLibraryList = ref<Library[]>([])
const addMatching = ref<MatchingListItem | null>(null)
const loading = ref(false)

const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)
const matchingChooseRef = ref<InstanceType<typeof MatchingChoose> | null>(null)

const showLibraryChoose = () => {
  libraryChooseRef.value?.showModel()
}

const showMatchingChoose = () => {
  matchingChooseRef.value?.showModel()
}

const libraryChoose = (items: Library[]) => {
  addLibraryList.value = items
  showAddLibrary.value = true
}

const matchingChoose = (item: MatchingListItem) => {
  addMatching.value = item
  showAddMatching.value = true
}

const insertCompDetail = async () => {
  const library_id: number[] = []
  if (detail.value?.pk_type === 0) {
    if (addLibraryList.value.length === 0) {
      toast.add({
        title: '请选择图鉴',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }
    addLibraryList.value.forEach((item) => {
      library_id.push(item.library_id)
    })
  } else {
    if (!addMatching.value) {
      toast.add({
        title: '请选择搭配',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }
    library_id.push(addMatching.value.matching_id)
  }
  
  if (loading.value) {
    toast.add({
      title: '请求中请稍候',
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }
  
  loading.value = true
  try {
    await insertCompDetailArray({
      comp_id: Number.parseInt(id),
      library_id: library_id
    })
    toast.add({
      title: '新增成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    reload()
  } catch (error) {
    console.error('新增失败:', error)
    toast.add({
      title: '新增失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    addLibraryList.value = []
    addMatching.value = null
    loading.value = false
    showAddLibrary.value = false
    showAddMatching.value = false
  }
}

// 删除
const showDeleteLibrary = ref(false)
const operateItem = ref<any>(null)

const openDelete = () => {
  openDeleteMode.value = !openDeleteMode.value
}

const openDeleteMode = ref(false)

const deleteCompListItem = async () => {
  if (!operateItem.value) return
  
  let library_id: number | null = null
  if (detail.value?.pk_type === 0) {
    library_id = operateItem.value.library_id
  } else {
    library_id = operateItem.value.matching_list?.matching_id
  }
  
  if (!library_id) return
  
  try {
    // 根据权限判断调用哪个删除接口
    if (user.hasPermi('comp:detail:delete')) {
      await deleteCompList({
        comp_id: Number.parseInt(id),
        library_id: library_id
      })
    } else {
      await deleteCompListUser({
        comp_id: Number.parseInt(id),
        library_id: library_id
      })
    }
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    reload()
  } catch (error) {
    console.error('删除失败:', error)
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    showDeleteLibrary.value = false
    operateItem.value = null
  }
}

const reload = () => {
  // 刷新瀑布流数据
  if (waterListRef.value) {
    waterListRef.value.refresh()
  }
}

// 分享
const showShareList = ref(false)
const shareList = [
  { text: '分享到QQ' },
  { text: '分享到微博' }
]

const shareBtn = (index: number) => {
  // 分享功能实现
  showShareList.value = false
}

// 跳转到贡献者列表
const jumpToContribution = () => {
  navigateTo(`/compilations/contribution?id=${id}`)
}

// 跳转到发送社区
const jumpToSendCommunity = () => {
  navigateTo(`/community/send?pk_id=${id}&pk_type=5`)
}

// 预览图片
const previewImage = (urls: string[], index: number) => {
  // 图片预览功能
}

// 判断是否是创建者
const isCreator = computed(() => {
  if (!detail.value || !user.user?.user_id) return false
  return detail.value.create_user === user.user.user_id
})

// 判断是否显示添加按钮（is_open = 1 或者是当前用户）
const canAddItem = computed(() => {
  if (!detail.value || !user.token) return false
  // 如果是开放编辑或者是创建者，则显示添加按钮
  return detail.value.is_open === 1 || isCreator.value
})

// 初始化
onMounted(() => {
  layoutReady.value = true
})

useHead({
  title: detail.value ? detail.value.comp_name || 'Lolita合集' : 'Lolita合集',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.comp_name || ''} Lo研社,Lolita合集,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div v-if="detail" class="container mx-auto px-1 py-3">
      <!-- 封面 -->
      <div class="w-full md:flex">
        <div  v-if="(detail as any).sence_id || detail.comp_cover" class="w-full md:w-[700px] mb-4 p-2 rounded-lg overflow-hidden">
          <iframe
            v-if="(detail as any).sence_id"
            border="0"
            frameborder="0"
            :src="`https://lolitalibrary.com/scene/detail/${(detail as any).sence_id}`"
            class="w-full aspect-[4/3]"
          ></iframe>
          <img
            v-else-if="detail.comp_cover"
            :src="BASE_IMG + detail.comp_cover"
            :alt="detail.comp_name || '合集封面'"
            class="w-full aspect-[4/3] object-cover rounded-lg"
          />
        </div>

        <!-- 标题和描述 -->
        <div class="mb-4 md:flex-1 md:ml-4">
          <h1 class="text-2xl font-bold text-qhx-primary mb-2">{{ detail.comp_name }}</h1>
          <div class="text-sm text-gray-500 mb-2">{{ formatDate(detail.create_date) }}</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm text-gray-500">编辑权限：</span>
            <QhxTag :class="detail.is_open === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'">
              {{ detail.is_open === 1 ? '开放编辑' : '仅创建者可编辑' }}
            </QhxTag>
          </div>
          <div class="text-base text-gray-700 dark:text-gray-300" v-if="detail.comp_describe">
            {{ detail.comp_describe }}
          </div>
        </div>
      </div>

      <!-- 功能按钮 -->
      <div class="flex justify-center items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <button
          @click="copyCompUrl"
          class="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <UIcon name="i-heroicons-share" class="text-2xl" />
          <span class="text-xs">分享</span>
        </button>
        <!-- <button
          v-if="detail.pk_type === 0"
          @click="jumpToContribution"
          class="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <UIcon name="i-heroicons-book-open" class="text-2xl" />
          <span class="text-xs">贡献者列表</span>
        </button> -->
        <button
          v-if="isCreator"
          @click="openDelete"
          :class="[
            'flex flex-col items-center gap-1 transition-colors',
            openDeleteMode ? 'text-qhx-primary' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          ]"
        >
          <UIcon name="i-heroicons-trash" class="text-2xl" />
          <span class="text-xs">整理合集</span>
        </button>
      </div>

      <!-- 标签页 -->
      <div class="mb-4">
        <div class="flex border-b border-gray-200 dark:border-gray-700">
          <button
            v-for="(nav, index) in navList"
            :key="index"
            @click="navChange(index)"
            :class="[
              'px-6 py-3 text-sm font-medium transition-colors border-b-2',
              currentNav === index
                ? 'border-qhx-primary text-qhx-primary'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            {{ nav.name }}
          </button>
        </div>
      </div>

      <!-- 合集列表 -->
      <div v-show="currentNav === 0">
        <!-- 添加按钮 -->
        <div class="flex justify-center mb-4" v-if="canAddItem">
          <button
            v-if="detail.pk_type === 0"
            @click="showLibraryChoose"
            class="flex items-center gap-2 px-4 py-2 bg-qhx-primary text-white rounded-full hover:bg-qhx-primaryHover transition-colors"
          >
            <UIcon name="i-heroicons-plus" class="text-lg" />
            <span>补充图鉴</span>
          </button>
          <button
            v-else
            @click="showMatchingChoose"
            class="flex items-center gap-2 px-4 py-2 bg-qhx-primary text-white rounded-full hover:bg-qhx-primaryHover transition-colors"
          >
            <UIcon name="i-heroicons-plus" class="text-lg" />
            <span>投稿搭配</span>
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="mb-4">
          <UInput
            v-model="keywords"
            placeholder="检索关键词"
            class="flex-1 focus:ring-0"
            @keyup.enter="search"
            @blur="search"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-full',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-white dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </div>

        <!-- 图鉴列表 - 瀑布流 -->
        <QhxWaterList
          v-if="detail.pk_type === 0 && layoutReady"
          ref="waterListRef"
          :fetch-data="fetchCompilationsList"
          :columns="5"
          :itemKey="0"
          :columns_768="2"
          :enableWaterfall="true"
          :enableLoadMore="true"
        >
          <template #default="{ item, debouncedApplyLayout }">
            <div class="custom-item relative" :key="item.library_id">
              <LibraryItem
                :item="item"
                :size="'big'"
                @image-load="debouncedApplyLayout"
              />
              <div
                v-if="openDeleteMode"
                class="absolute top-2 right-2 w-6 h-6 bg-qhx-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-qhx-primaryHover transition-colors z-10"
                @click="operateItem = item; showDeleteLibrary = true"
              >
                <UIcon name="i-heroicons-trash" class="text-white text-sm" />
              </div>
            </div>
          </template>
        </QhxWaterList>

        <!-- 搭配列表 - 瀑布流 -->
        <QhxWaterList
          v-if="detail.pk_type === 1 && layoutReady"
          ref="waterListRef"
          :fetch-data="fetchCompilationsList"
          :columns="3"
          :itemKey="1"
          :columns_768="1"
          :enableWaterfall="true"
          :enableLoadMore="true"
        >
          <template #default="{ item, debouncedApplyLayout }">
            <div
              class="custom-item bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 m-1"
              :key="item.library_id || item.matching_list?.matching_id"
            >
              <div class="relative">
                <div
                  v-if="item.matching_list?.cover"
                  class="w-full rounded-lg overflow-hidden cursor-pointer mb-2"
                  @click="previewImage([BASE_IMG + item.matching_list.cover], 0)"
                >
                  <img
                    :src="`${BASE_IMG}${item.matching_list.cover}?x-oss-process=image/quality,q_80/resize,w_600`"
                    :alt="item.matching_list.note || '搭配图片'"
                    class="w-full h-auto object-cover"
                    loading="lazy"
                    @load="debouncedApplyLayout"
                  />
                </div>
                <div class="px-2 pb-2">
                  <NuxtLink
                    :to="`/wardrobe/matchingDetail?id=${item.library_id}`"
                    class="font-bold text-base mb-2 hover:text-qhx-primary transition-colors line-clamp-2 block"
                  >
                    {{ item.matching_list?.note }}
                  </NuxtLink>
                  <div class="flex items-center gap-2 mb-2">
                    <img
                      v-if="item.user_face"
                      :src="`${BASE_IMG}${item.user_face}?x-oss-process=image/quality,q_100/resize,w_20`"
                      :alt="item.user_name"
                      class="w-5 h-5 rounded-full object-cover"
                    />
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.user_name }}</span>
                  </div>
                  <div
                    v-if="item.matching_list?.main_style"
                    class="text-xs text-qhx-primary mb-1 line-clamp-1"
                  >
                    <span
                      v-for="(tag, idx) in item.matching_list.main_style.split(',')"
                      :key="idx"
                      class="mr-1"
                    >
                      ★{{ tag }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatDate(item.date) }}
                  </div>
                </div>
                <div
                  v-if="openDeleteMode"
                  class="absolute top-2 right-2 w-6 h-6 bg-qhx-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-qhx-primaryHover transition-colors z-10"
                  @click="operateItem = item.matching_list; showDeleteLibrary = true"
                >
                  <UIcon name="i-heroicons-trash" class="text-white text-sm" />
                </div>
              </div>
            </div>
          </template>
        </QhxWaterList>
      </div>

      <!-- 考据研究 -->
      <div v-show="currentNav === 1" class="min-h-[80vh]">
        <!-- <div class="flex justify-center mb-4" v-if="user.token">
          <button
            @click="jumpToSendCommunity"
            class="flex items-center gap-2 px-4 py-2 bg-qhx-primary text-white rounded-full hover:bg-qhx-primaryHover transition-colors"
          >
            <UIcon name="i-heroicons-plus" class="text-lg" />
            <span>考据研究</span>
          </button>
        </div> -->
        <CommunityForeignList :pk_type="5" :pk_id="Number.parseInt(id)" />
      </div>

      <!-- 评论区 -->
      <div v-show="currentNav === 2" class="min-h-[80vh]">
        <CommentSection :type="'comp'" :id="Number.parseInt(id)" />
      </div>
    </div>

    <!-- 选择图鉴组件 -->
    <LibraryChoose
      ref="libraryChooseRef"
      :multiple="true"
      :need-status="false"
      @choose="libraryChoose"
      :keywordMode="true"
    />

    <!-- 选择搭配组件 -->
    <MatchingChoose
      ref="matchingChooseRef"
      :filter-list="user.token && user.user ? [{ field: 'user_id', op: 'and', value: user.user.user_id }] : []"
      @choose="matchingChoose"
    />

    <!-- 确认添加图鉴弹窗 -->
    <UModal v-model="showAddLibrary">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">确定要添加该图鉴吗?</h3>
        </template>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="item in addLibraryList"
            :key="item.library_id"
            class="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <img
              v-if="item.cover"
              :src="`${BASE_IMG}${item.cover}`"
              :alt="item.name"
              class="w-24 h-24 object-cover rounded-lg"
            />
            <div class="flex-1">
              <div class="font-bold mb-2">{{ item.name }}</div>
              <div>
                图鉴类型: <QhxTag>{{ item.library_type }}</QhxTag>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAddLibrary = false">取消</UButton>
            <UButton color="primary" @click="insertCompDetail">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- 确认添加搭配弹窗 -->
    <UModal v-model="showAddMatching">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">确定要添加该搭配吗?</h3>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showAddMatching = false">取消</UButton>
            <UButton color="primary" @click="insertCompDetail">确认</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- 确认删除弹窗 -->
    <UModal v-model="showDeleteLibrary">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">
            确定要删除该{{ detail?.pk_type === 0 ? '图鉴' : '搭配' }}吗?
          </h3>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showDeleteLibrary = false">取消</UButton>
            <UButton color="red" @click="deleteCompListItem">确认删除</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- 分享弹窗 -->
    <UModal v-model="showShareList">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">分享</h3>
        </template>
        <div class="space-y-2">
          <button
            v-for="(share, index) in shareList"
            :key="index"
            @click="shareBtn(index)"
            class="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {{ share.text }}
          </button>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
