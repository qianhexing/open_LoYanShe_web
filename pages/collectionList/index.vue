<script setup lang="ts">
import type { CollectionList, Comment } from '@/types/api'
import { getCollectionList } from '@/api/collection_list'
import { insertCollection, completedCollection } from '@/api/collection_list'
// eslint-disable-next-line @typescript-eslint/no-import-type-side-effects
import CommentModal from '@/components/community/CommentModal.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type { Library } from '@/types/api'

const layoutReady = inject('layoutReady') as Ref<boolean>
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const user = useUserStore()
const route = useRoute()
const toast = useToast()
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
let uni: any
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const opear_item = ref<CollectionList | null>(null)
const jumpToLibrary = (item: CollectionList) => {
  window.open('/addLibrary', '_blank')
}

const handleJumpToLibrary = (libraryId: number) => {
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/library/libraryDetail/libraryDetail?id=${libraryId}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'LibraryDetail',
        params: {
          id: libraryId
        }
      }));
    } else {
      window.open(`/library/detail/${libraryId}`, '_blank')
    }
  }
}

// 显示图鉴选择弹框
const showChooseLibrary = (item: CollectionList, event?: MouseEvent) => {
  opear_item.value = item
  if (libraryChooseRef.value) {
    libraryChooseRef.value.showModel(event)
  }
}

// 图鉴选择回调（空实现）
const handleLibraryChoose = async (list: Library[]) => {
  // TODO: 实现图鉴选择后的处理逻辑
  console.log('选择的图鉴:', opear_item.value)
  const result = await completedCollection({
    collection_id: opear_item.value?.collection_id,
    pk_id: list[0].library_id,
  })
  console.log('采集结果:', result)
  waterList.value?.refresh(true)
}

// 过滤条件
const keywords = ref('')
const value = ref('')
const onlyUncompleted = ref(false)

// 评论弹框
const showCommentModal = ref(false)
const commentModalRef = ref<{ showModel: (e: { id: number | string; type: string }) => void } | null>(null)

// 图鉴选择组件
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)

// 搜索
const handleSearch = () => {
  keywords.value = value.value.trim()
  waterList.value?.refresh()
}

// 发布采集需求 - 打开发评论弹框
const handleOpenCollectionDemand = () => {
  if (!commentModalRef.value) return
  commentModalRef.value.showModel({
    id: 0,
    type: 'collection'
  })
}

// 评论成功后，插入采集清单
const handleCommentSuccess = async (comment: Comment) => {
  try {
    await insertCollection({
      comment_id: comment.comment_id,
      user_id: user.user?.user_id ?? undefined,
      is_completed: 0,
      pk_type: 0,
    })
    toast.add({
      title: '已发布采集需求',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
    // 刷新列表
    waterList.value?.refresh()
  } catch (error) {
    console.error('插入采集清单失败:', error)
    toast.add({
      title: '插入采集清单失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  }
}

// SEO 配置
useHead({
  title: '采集清单 - Lo研社'
})

definePageMeta({
  name: 'collectionList',
  ssr: false
})
</script>

<template>
  <div class="container mx-auto pt-4 pb-20 overflow-hidden">
    <!-- 顶部筛选与搜索 -->
    <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
      <div class="w-full flex items-center gap-2">
        <UInput
          v-model="value"
          placeholder="按备注或关联信息搜索（视后端支持情况）"
          class="flex-1 focus:ring-0"
          :autofocus="false"
          @keyup.enter="handleSearch"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-full',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline:
                  'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
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
      <div class="flex items-center justify-end gap-3 px-4 max-md:col-span-2">
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <UCheckbox v-model="onlyUncompleted" @change="() => { waterList?.refresh() }" />
          只看未采集
        </label>
      </div>
    </div>
    <div class="text-xs text-qhx-text px-4">
      未收录的裙子可以发布在这里，大家看到会帮忙收录
    </div>

    <!-- 瀑布流列表 -->
    <QhxWaterList
      ref="waterList"
      v-if="layoutReady"
      :fetch-data="async (page, pageSize) => {
        try {
          const response = await getCollectionList({
            page: page,
            pageSize: pageSize,
            user_id: user.user?.user_id,
            is_completed: onlyUncompleted ? 0 : undefined,
            // 预留关键字过滤，后端若支持可在此传参
            // keywords: keywords.value
          })
          return {
            rows: response.rows,
            count: response.count
          }
        } catch (error) {
          console.error('获取采集清单失败:', error)
          return {
            rows: [],
            count: 0
          }
        }
      }"
      :columns="3"
      :itemKey="0"
      :columns_768="1"
      :enableWaterfall="true"
      :enableLoadMore="true"
    >
      <template #default="{ item }">
        <div class="px-2 pb-4">
          <div
            class="w-full h-full bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="text-xs text-gray-400">
                ID：{{ item.clooection_id ?? '—' }}
              </div>
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  item.is_completed
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
                "
              >
                {{ item.is_completed ? '已采集' : '未采集' }}
              </span>
            </div>
            <div>
              <!-- <SafeRichText :nodes="parseRichText(item.comment?.comment_content)"></SafeRichText> -->
              <CommentItem
              v-if="item.comment"
                :item="item.comment"
                :ui="'p-0'"
                :need_bottom="false"
                :key="item.comment_id"
              />
            </div>

            <!-- <div class="text-sm text-gray-600 dark:text-gray-200">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">关联类型</span>
                <span class="font-medium"> {{ item.pk_type ?? '—' }} </span>
              </div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">关联 ID</span>
                <span class="font-medium"> {{ item.pk_id ?? '—' }} </span>
              </div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">评论 ID</span>
                <span class="font-medium"> {{ item.comment_id ?? '—' }} </span>
              </div>
            </div> -->

            <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>发布用户：{{ item?.user?.user_name ?? '—' }}</span>
              <span v-if="item.create_time">
                {{ new Date(item.create_time).toLocaleString() }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-gray-400" v-if="item.is_completed === 0">
              <UButton @click="jumpToLibrary(item)">去收录</UButton>
              <UButton variant="ghost" color="gray" @click="(e: MouseEvent) => showChooseLibrary(item, e)">
                <span>
                  <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                  <span>关联图鉴</span>
                </span>
              </UButton>
            </div>
            <div class="mt-2 flex items-center text-xs cursor-pointer text-gray-400" v-if="item.is_completed === 1 
            && item.library" @click="handleJumpToLibrary(item.library.library_id)">
              <img :src="BASE_IMG + item.library.cover + '?x-oss-process=image/quality,q_100/resize,w_300,h_300'"
              class="w-10 h-10 rounded-full object-cover" alt="图鉴封面">
              <span>{{ item.library.name }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #empty>
        <div class="text-center text-gray-500 py-8">
          暂无采集清单数据
        </div>
      </template>
    </QhxWaterList>

    <!-- 左下角发布采集需求按钮 -->
    <div class="fixed left-4 bottom-20 z-40">
      <button
        type="button"
        class="px-4 py-2 rounded-full bg-qhx-primary hover:bg-qhx-primaryHover text-white shadow-lg shadow-qhx-primary/30 text-sm font-bold flex items-center gap-2"
        @click="handleOpenCollectionDemand"
      >
        <span>➕</span>
        <span>发布采集需求</span>
      </button>
    </div>

    <!-- 发评论弹框 -->
    <CommentModal
      v-model="showCommentModal"
      ref="commentModalRef"
      @success="handleCommentSuccess"
    />

    <!-- 图鉴选择弹框 -->
    <LibraryChoose
      ref="libraryChooseRef"
      :keywordMode="true"
      @choose="handleLibraryChoose"
    />
  </div>
</template>


