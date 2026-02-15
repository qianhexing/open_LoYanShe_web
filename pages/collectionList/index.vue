<script setup lang="ts">
import type { CollectionList, Comment } from '@/types/api'
import { getCollectionList } from '@/api/collection_list'
import { insertCollection, completedCollection } from '@/api/collection_list'
import { refuseCollection } from '@/api/collection_list'
import { insertComment } from '@/api/comment'
// eslint-disable-next-line @typescript-eslint/no-import-type-side-effects
import CommentModal from '@/components/community/CommentModal.vue'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import QhxTabs from '@/components/Qhx/Tabs.vue'
import QhxTabPanel from '@/components/Qhx/TabPanel.vue'
import QhxModal from '@/components/Qhx/Modal.vue'
import VideoUploader from '@/components/Qhx/VideoUploader.vue'
import type LibraryChoose from '@/components/library/LibraryChoose.vue'
import type { Library } from '@/types/api'
import { unref } from 'vue'
import { BASE_IMG } from '@/utils/ipConfig'

const layoutReady = inject('layoutReady') as Ref<boolean>
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const waterListVideo = ref<InstanceType<typeof QhxWaterList> | null>(null)
const currentTab = ref(0) // 0: 图鉴, 1: 视频投稿
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

// 拒绝收录弹窗
const showRefuseModal = ref(false)
const refuseNote = ref('')
const refuseLoading = ref(false)
const refuseTriggerPosition = ref({ x: 0, y: 0 })
const openRefuseModal = (item: CollectionList, e: MouseEvent) => {
  opear_item.value = item
  refuseNote.value = ''
  refuseTriggerPosition.value = { x: e.clientX + 50, y: e.clientY }
  showRefuseModal.value = true
}
const confirmRefuse = async () => {
  const collection_id = opear_item.value?.collection_id
  if (!collection_id) {
    toast.add({ title: '缺少 collection_id', icon: 'i-heroicons-x-circle', color: 'red' })
    return
  }
  if (!refuseNote.value.trim()) {
    toast.add({ title: '请输入拒绝原因', icon: 'i-heroicons-exclamation-circle', color: 'orange' })
    return
  }
  if (refuseLoading.value) return

  refuseLoading.value = true
  try {
    await refuseCollection({
      collection_id,
      note: refuseNote.value.trim()
    })
    toast.add({ title: '已提交拒绝原因', icon: 'i-heroicons-check-circle', color: 'green' })
    showRefuseModal.value = false
    waterList.value?.refresh(true)
  } catch (error) {
    console.error('拒绝收录失败:', error)
    toast.add({
      title: '拒绝收录失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    refuseLoading.value = false
  }
}
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

// 过滤条件 - 图鉴
const keywords = ref('')
const value = ref('')
const onlyUncompleted = ref(false)

// 过滤条件 - 视频投稿
const keywordsVideo = ref('')
const valueVideo = ref('')
const onlyUncompletedVideo = ref(false)

// 评论弹框
const showCommentModal = ref(false)
const commentModalRef = ref<{ showModel: (e: { id: number | string; type: string }) => void } | null>(null)

// 视频投稿弹框
const showVideoModal = ref(false)
const videoNote = ref('')
const videoUrl = ref<string | null>(null)
const videoSubmitting = ref(false)

// 图鉴选择组件
const libraryChooseRef = ref<InstanceType<typeof LibraryChoose> | null>(null)

// 搜索 - 图鉴
const handleSearch = () => {
  keywords.value = value.value.trim()
  waterList.value?.refresh()
}

// 搜索 - 视频投稿
const handleSearchVideo = () => {
  keywordsVideo.value = valueVideo.value.trim()
  waterListVideo.value?.refresh()
}

// 处理只看未采集复选框变更 - 图鉴
const handleOnlyUncompletedChange = () => {
  waterList.value?.refresh()
}

// 处理只看未采集复选框变更 - 视频投稿
const handleOnlyUncompletedChangeVideo = () => {
  waterListVideo.value?.refresh()
}

// 发布采集需求 - 打开发评论弹框或视频投稿弹框
const handleOpenCollectionDemand = () => {
  if (currentTab.value === 1) {
    // 视频投稿标签页，打开视频投稿弹窗
    showVideoModal.value = true
    videoNote.value = ''
    videoUrl.value = null
  } else {
    // 图鉴标签页，打开评论弹窗
    if (!commentModalRef.value) return
    commentModalRef.value.showModel({
      id: 0,
      type: 'collection'
    })
  }
}

// 评论成功后，插入采集清单
const handleCommentSuccess = async (comment: Comment) => {
  try {
    await insertCollection({
      comment_id: comment.comment_id,
      user_id: user.user?.user_id,
      is_completed: 0,
      pk_type: 0, // 图鉴类型
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

// 视频投稿提交
const handleVideoSubmit = async () => {
  if (!videoNote.value.trim()) {
    toast.add({
      title: '请输入备注信息',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }
  
  if (!videoUrl.value) {
    toast.add({
      title: '请选择视频文件',
      icon: 'i-heroicons-exclamation-circle',
      color: 'orange'
    })
    return
  }

  if (videoSubmitting.value) return

  videoSubmitting.value = true
  try {
    // 先创建评论（包含视频链接和备注）
    const commentContent = `<p>${videoNote.value.trim()}</p><p>`
    
    // 使用评论接口创建评论
    const comment = await insertComment({
      page: 1,
      pageSize: 1,
      id: 0,
      type: 'collection',
      comment_content: commentContent,
    })

    // 然后插入采集清单
    await insertCollection({
      comment_id: comment.comment_id,
      user_id: user.user?.user_id,
      is_completed: 0,
      pk_type: 1, // 视频投稿类型
      url: videoUrl.value,
    })

    toast.add({
      title: '已发布视频投稿',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    // 清空表单
    videoNote.value = ''
    videoUrl.value = null
    showVideoModal.value = false

    // 刷新列表
    waterListVideo.value?.refresh()
  } catch (error) {
    console.error('视频投稿失败:', error)
    toast.add({
      title: '视频投稿失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    videoSubmitting.value = false
  }
}

// 标签页切换处理
const handleTabChange = (index: number) => {
  currentTab.value = index
}

// 获取完整的视频 URL
const getVideoUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  // 如果已经是完整 URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  // 否则拼接 BASE_IMG
  return `${BASE_IMG}${url.startsWith('/') ? url.substring(1) : url}`
}

// 从 URL 中提取文件名
const getFileNameFromUrl = (url: string | null | undefined): string => {
  if (!url) return '视频文件'
  try {
    // 提取路径的最后一部分作为文件名
    const path = url.split('/').pop() || url
    // 移除查询参数
    const fileName = path.split('?')[0]
    return fileName || '视频文件'
  } catch {
    return '视频文件'
  }
}

// 点击视频在新标签页打开
const handleVideoClick = (url: string | null | undefined) => {
  if (!url) return
  const fullUrl = getVideoUrl(url)
  if (fullUrl) {
    window.open(fullUrl, '_blank')
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
  <div class="container mx-auto pb-20 overflow-hidden">
    <!-- 标签页 -->
    <QhxTabs :tabs="['图鉴采集', '视频投稿']" @change="handleTabChange">
      <!-- 图鉴标签页 -->
      <QhxTabPanel :index="0">
        <template #default="{ isActive }">
          <div v-if="isActive">
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
                  <UCheckbox v-model="onlyUncompleted" @change="handleOnlyUncompletedChange" />
                  只看未采集
                </label>
              </div>
            </div>
            <div class="text-xs text-qhx-text px-4">
              未收录的裙子可以发布在这里，大家看到会帮忙收录
            </div>
            <div class="text-xs text-qhx-text px-4 text-red-500 mb-1">
              一条对应一个，请勿多条一起发布！！！
            </div>

            <QhxWaterList
              ref="waterList"
              v-if="layoutReady"
              :fetch-data="async (page, pageSize) => {
                try {
                  const keywordValue = unref(keywords).trim()
                  const response = await getCollectionList({
                    page: page,
                    pageSize: pageSize,
                    // user_id: user.user?.user_id,
                    pk_type: 0,
                    is_completed: onlyUncompleted ? 0 : undefined,
                    keywords: keywordValue || undefined
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
                          item.is_completed === 1
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : item.is_completed === 2
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
                        "
                      >
                        {{ item.is_completed === 1 ? '已采集' : item.is_completed === 2 ? '已拒绝' : '未采集' }}
                      </span>
                      {{ item.is_completed }}
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
                      <UButton variant="ghost" color="red" @click="(e: MouseEvent) => openRefuseModal(item, e)">
                        <span>拒绝收录</span>
                      </UButton>
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
                    <div class="mt-2 flex items-center text-xs cursor-pointer text-red-600" v-if="item.is_completed === 2 && item.note"> 
                      <span>拒绝原因：{{ item.note }}</span>
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
          </div>
        </template>
      </QhxTabPanel>

      <!-- 视频投稿标签页 -->
      <QhxTabPanel :index="1">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <!-- 顶部筛选与搜索 -->
            <div class="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-4 pb-3">
              <div class="w-full flex items-center gap-2">
                <UInput
                  v-model="valueVideo"
                  placeholder="按备注或关联信息搜索（视后端支持情况）"
                  class="flex-1 focus:ring-0"
                  :autofocus="false"
                  @keyup.enter="handleSearchVideo"
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
                  @click="handleSearchVideo"
                />
              </div>
              <div class="flex items-center justify-end gap-3 px-4 max-md:col-span-2">
                <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <UCheckbox v-model="onlyUncompletedVideo" @change="handleOnlyUncompletedChangeVideo" />
                  只看未处理
                </label>
              </div>
            </div>
            <div class="text-xs text-qhx-text px-4">
              投稿视频可以发布在这里，我会转成3D模型并收录
            </div>
            <div class="text-xs text-qhx-text px-4 text-red-500 mb-1">
              一条对应一个，请勿多条一起发布！！！
            </div>
            
            <!-- 示例视频 -->
            <div class="px-4 mb-4">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">环绕着裙子拍,角度尽量完整,示例视频：</div>
              <div class="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <video
                  :src="getVideoUrl('video/75f0503cf4ae6c9e061c17d7fc05138d.mp4')"
                  class="w-full h-auto max-h-96 object-contain"
                  controls
                  preload="metadata"
                ></video>
              </div>
            </div>

            <QhxWaterList
              ref="waterListVideo"
              v-if="layoutReady"
              :fetch-data="async (page, pageSize) => {
                try {
                  const keywordValue = unref(keywordsVideo).trim()
                  const response = await getCollectionList({
                    page: page,
                    pageSize: pageSize,
                    // user_id: user.user?.user_id,
                    pk_type: 1,
                    is_completed: onlyUncompletedVideo ? 0 : undefined,
                    keywords: keywordValue || undefined
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
                          item.is_completed === 1
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : item.is_completed === 2
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
                        "
                      >
                        {{ item.is_completed === 1 ? '已完成' : item.is_completed === 2 ? '已拒绝' : '未处理' }}
                      </span>
                      {{ item.is_completed }}
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

                    <!-- 视频文件显示 -->
                    <div v-if="item.url" class="mt-2">
                      <div
                        class="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        @click="handleVideoClick(item.url)"
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3 flex-1 min-w-0">
                            <div class="flex-shrink-0 w-10 h-10 bg-qhx-primary/10 rounded-lg flex items-center justify-center">
                              <UIcon name="i-heroicons-video-camera" class="text-xl text-qhx-primary" />
                            </div>
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {{ getFileNameFromUrl(item.url) || '视频文件' }}
                              </p>
                              <p class="text-xs text-gray-500 dark:text-gray-400">
                                点击在新标签页打开
                              </p>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-arrow-top-right-on-square" class="text-gray-400 dark:text-gray-500 w-5 h-5" />
                          </div>
                        </div>
                      </div>
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
                    <!-- <div class="mt-2 flex items-center justify-between text-xs text-gray-400" v-if="item.is_completed === 0">
                      <UButton @click="jumpToLibrary(item)">去收录</UButton>
                      <UButton variant="ghost" color="red" @click="(e: MouseEvent) => openRefuseModal(item, e)">
                        <span>拒绝收录</span>
                      </UButton>
                      <UButton variant="ghost" color="gray" @click="(e: MouseEvent) => showChooseLibrary(item, e)">
                        <span>
                          <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                          <span>关联图鉴</span>
                        </span>
                      </UButton>
                    </div> -->
                    <div class="mt-2 flex items-center text-xs cursor-pointer text-gray-400" v-if="item.is_completed === 1 
                    && item.library" @click="handleJumpToLibrary(item.library.library_id)">
                      <img :src="BASE_IMG + item.library.cover + '?x-oss-process=image/quality,q_100/resize,w_300,h_300'"
                      class="w-10 h-10 rounded-full object-cover" alt="图鉴封面">
                      <span>{{ item.library.name }}</span>
                    </div>
                    <div class="mt-2 flex items-center text-xs cursor-pointer text-red-600" v-if="item.is_completed === 2 && item.note"> 
                      <span>拒绝原因：{{ item.note }}</span>
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
          </div>
        </template>
      </QhxTabPanel>
    </QhxTabs>

    <!-- 左下角发布采集需求按钮 -->
    <div class="fixed left-4 bottom-20 z-40">
      <button
        type="button"
        class="px-4 py-2 rounded-full bg-qhx-primary hover:bg-qhx-primaryHover text-white shadow-lg shadow-qhx-primary/30 text-sm font-bold flex items-center gap-2"
        @click="handleOpenCollectionDemand"
      >
        <span>➕</span>
        <span>{{ currentTab === 1 ? '投稿环绕视频' : '发布采集需求' }}</span>
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

    <!-- 拒绝收录弹窗 -->
    <QhxModal v-model="showRefuseModal" :trigger-position="refuseTriggerPosition">
      <div class="p-6 w-[420px] bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-base font-bold mb-4 text-gray-800 dark:text-gray-200">拒绝收录</h3>
        <div class="mb-2 text-sm text-gray-600 dark:text-gray-300">
          请输入拒绝原因（将写入 note 字段）
        </div>
        <UTextarea
          v-model="refuseNote"
          placeholder="例如：信息不完整/重复/不符合收录规则…"
          :rows="6"
          class="flex-1 focus:ring-0"
          :ui="{
            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
            rounded: 'rounded-[10px]',
            padding: { xs: 'px-4 py-2' },
            color: {
              white: {
                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
              }
            }
          }"
        />
        <div class="flex gap-3 justify-end mt-4">
          <UButton color="gray" variant="outline" @click="showRefuseModal = false" :disabled="refuseLoading">
            取消
          </UButton>
          <UButton color="red" @click="confirmRefuse" :loading="refuseLoading">
            确认拒绝
          </UButton>
        </div>
      </div>
    </QhxModal>

    <!-- 视频投稿弹窗 -->
    <QhxModal v-model="showVideoModal">
      <div class="p-6 w-[95vw] max-w-2xl bg-white dark:bg-gray-800 rounded-[10px] shadow-lg">
        <h3 class="text-xl font-bold mb-6 text-gray-800 dark:text-gray-200">投稿环绕视频</h3>
        
        <!-- 备注输入框 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            备注信息 <span class="text-red-500">*</span>
          </label>
          <UTextarea
            v-model="videoNote"
            placeholder="请输入视频的相关信息、属于哪条裙子的哪个颜色等..."
            :rows="4"
            class="flex-1 focus:ring-0"
            :ui="{
              base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
              rounded: 'rounded-[10px]',
              padding: { xs: 'px-4 py-2' },
              color: {
                white: {
                  outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                }
              }
            }"
          />
        </div>

        <!-- 视频选择器 -->
        <div class="mb-6">
          <VideoUploader
            v-model="videoUrl"
            label="环绕视频"
            accept=".mp4,.webm,.mov,.avi,.mkv"
            accept-text="支持 .mp4, .webm, .mov, .avi, .mkv 格式"
            upload-path="video"
          />
        </div>

        <!-- 按钮组 -->
        <div class="flex gap-3 justify-end">
          <UButton color="gray" variant="outline" @click="showVideoModal = false" :disabled="videoSubmitting">
            取消
          </UButton>
          <UButton @click="handleVideoSubmit" :loading="videoSubmitting">
            提交投稿
          </UButton>
        </div>
      </div>
    </QhxModal>
  </div>
</template>


