<script setup lang="ts">
import { getMatchingDetail, type MatchingListDetail } from '@/api/matching_list'
import { BASE_IMG } from '@/utils/ipConfig'
import dayjs from 'dayjs'
import LibraryList from '@/components/library/LibraryList.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import CommunityForeignList from '@/components/community/CommunityForeignList.vue'
import QhxPreviewImage from '@/components/Qhx/PreviewImage.vue'
import QhxTabs from '@/components/Qhx/Tabs.vue'
import QhxTabPanel from '@/components/Qhx/TabPanel.vue'
import UserInfo from '@/components/user/UserInfo.vue'
import UserGoodBtn from '@/components/user/GoodBtn.vue'
import UserCollectBtn from '@/components/user/CollectBtn.vue'
import type { Library, Shop, User } from '~/types/api'
let uni: any;
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const port = computed(() => configStore.getPort())

// 禁用 SSR
definePageMeta({
  ssr: false
})

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const id = route.params.id as string
const matchingId = Number.parseInt(id, 10)

// 衣服项类型
interface ClothesItem {
  clothes_img: string
  color?: string
  price?: string
  clothes_note?: string
  library?: Library
  origin_shop?: Shop
  origin?: string
}

// 扩展的详情数据类型
interface ExtendedMatchingDetail extends MatchingListDetail {
  main_clothes_item?: ClothesItem
  list?: ClothesItem[]
  clothes_list?: ClothesItem[]
  user?: User
  appointment_time?: string | Date
  is_private?: number
  open_tags?: number
  open_community?: number
  user_id?: number
  activity_list?: Array<{ activity_id: number; activity?: { activity_title: string; activity_cover?: string } }>
  file?: {
    width: number
    height: number
  }
  is_good?: boolean
  is_collect?: boolean
  good_count?: number
  collect_count?: number
}

// 详情数据
const detail = ref<ExtendedMatchingDetail | null>(null)
const isLoading = ref(true)

// 屏幕宽度（用于计算图片高度）
const screenWidth = ref(750)
let resizeHandler: (() => void) | null = null

// 主图高度（计算值）
const mainImageHeight = ref<number | null>(null)
// 右侧列表图片大小（1:1比例）
const rightImageSize = ref<number>(0)
// 右侧列表能放的数量
const rightListCount = ref<number>(0)

// 标签页
const currentTab = ref(0)
const tabs = ['搭配详情', '评论区', '搭配返图']

// 弹窗状态
const showActivityModal = ref(false)
const showAddCommunity = ref(false)
const showChooseCommunity = ref(false)
interface CommunityItem {
  community_id: number
  [key: string]: unknown
}

const chooseCommunity = ref<CommunityItem | null>(null)
const loading = ref(false)

// 点赞和收藏状态（由组件内部管理，这里保留用于初始化）

// 获取详情数据
const fetchDetail = async () => {
  try {
    isLoading.value = true
    const response = await getMatchingDetail({
      matching_id: matchingId
    })
    
    const data = response
    
    // 处理 library_list
    if (data.library_list && data.library_list.length > 0) {
      if (!data.clothes_list) {
        data.clothes_list = []
      }
      for (const child of data.library_list) {
        const clothesItem: ClothesItem = {
          clothes_img: (child as Record<string, unknown>).cover as string,
          library: child as Library
        }
        data.clothes_list.push(clothesItem)
      }
      data.library_list = undefined
    }
    
    // 处理主衣服
    if (!data.cover && !data.mian_clothes) {
      if (data.clothes_list && data.clothes_list.length > 0) {
        data.main_clothes_item = data.clothes_list[0]
        data.clothes_list.splice(0, 1)
      }
    }
    
    detail.value = data as ExtendedMatchingDetail
    
    // 计算主图高度和右侧列表布局
    nextTick(() => {
      calculateLayout()
    })
  } catch (error) {
    console.error('获取搭配详情失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 计算布局
const calculateLayout = () => {
  if (!detail.value) return
  
  const fileData = detail.value.file as { width?: number; height?: number } | undefined
  if (!fileData || typeof fileData.width !== 'number' || typeof fileData.height !== 'number') {
    // 如果没有文件信息，使用默认值或从主图计算
    if (detail.value.cover || detail.value.main_clothes_item) {
      // 可以尝试从图片加载后获取尺寸，这里先使用默认计算
      mainImageHeight.value = null
      rightImageSize.value = 0
      rightListCount.value = 0
    }
    return
  }
  
  // 容器宽度（减去padding和gap）
  const containerPadding = 16 // p-4 = 16px
  const gap = 8 // gap-2 = 8px
  const containerWidth = screenWidth.value - containerPadding * 2
  
  // 主图宽度（2/3）
  const mainImageWidth = (containerWidth - gap) * 2 / 3
  
  // 计算主图高度（保持宽高比）
  const mainHeight = (mainImageWidth / fileData.width) * fileData.height
  mainImageHeight.value = mainHeight
  
  // 右侧区域宽度（1/3），由于使用 aspect-square，图片高度等于宽度
  const rightAreaWidth = (containerWidth - gap) / 3
  rightImageSize.value = rightAreaWidth
  
  // 计算右侧能放多少个（考虑间距和文字区域）
  // 右侧图片高度 = 右侧区域宽度（因为1:1比例）
  const rightImageHeight = rightAreaWidth
  const itemGap = 8 // space-y-2 = 8px
  const textHeight = 50 // 估算文字区域高度（价格+名称+来源，约50px）
  const totalItemHeight = rightImageHeight + textHeight + itemGap
  
  // 计算能放多少个
  const availableHeight = mainHeight
  const count = Math.floor(availableHeight / totalItemHeight)
  rightListCount.value = Math.max(0, count)
  
  // 分配列表数据：将右侧能放的数量分配到 list，剩余的留在 clothes_list
  if (detail.value.clothes_list && detail.value.clothes_list.length > 0) {
    // 如果 list 已存在，需要将之前的项合并回 clothes_list
    if (detail.value.list && detail.value.list.length > 0) {
      // 将之前的 list 项合并回 clothes_list 的开头
      detail.value.clothes_list = [...detail.value.list, ...detail.value.clothes_list]
      detail.value.list = []
    }
    
    // 重新分配：取前 rightListCount.value 个到 list
    const list = detail.value.clothes_list.splice(0, rightListCount.value)
    detail.value.list = list
  } else if (!detail.value.list) {
    // 如果没有 clothes_list，确保 list 存在
    detail.value.list = []
  }
}

// 预览图片
const previewImage = (urls: string[], index = 0) => {
  // 这里可以实现图片预览功能
  console.log('预览图片', urls, index)
}

// 跳转到用户空间
const jumpToUserSpace = (userId: number) => {
  let isInUniApp = false
  if (typeof window !== 'undefined' && navigator.userAgent.includes('Html5Plus')) {
    isInUniApp = true
  }
  if (isInUniApp) {
    uni.navigateTo({
      url: `/pages/user/space?id=${userId}`,
    })
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'UserSpace',
        params: {
          id: userId
        }
      }))
    } else {
      navigateTo(`/user/space?id=${userId}`)
    }
  }
}

// 跳转到图鉴详情
const jumpToLibraryDetail = (libraryId: number) => {
  let isInUniApp = false
  if (typeof window !== 'undefined' && navigator.userAgent.includes('Html5Plus')) {
    isInUniApp = true
  }
  if (isInUniApp) {
    uni.navigateTo({
      url: `/pages/library/detail/${libraryId}`,
    })
  } else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'LibraryDetail',
        params: {
          id: libraryId
        }
      }))
    } else {
      navigateTo(`/library/detail/${libraryId}`)
    }
  }
}

// 跳转到店铺详情
const jumpToShopDetail = (shopId: number) => {
  navigateTo(`/shop/detail/${shopId}`)
}

// 跳转到活动详情
const jumpToActivity = (activityId: number) => {
  navigateTo(`/activity/detail?id=${activityId}`)
}

// 点赞和收藏功能由 UserGoodBtn 和 UserCollectBtn 组件处理

// 生成搭配图
const handleGenerateImage = () => {
  // TODO: 实现生成搭配图功能
  console.log('生成搭配图')
}

// 添加标签
const handleAddTag = () => {
  // TODO: 实现添加标签功能
  console.log('添加标签')
}

// 关联帖子
const handleAddCommunity = () => {
  showAddCommunity.value = true
}

// 确认添加帖子类型
const confirmAddType = (type: number) => {
  if (type === 0) {
    // 关联帖子
    showChooseCommunity.value = true
  } else {
    // 新增帖子
    navigateTo(`/community/send?pk_id=${matchingId}&pk_type=4`)
  }
}

// 选择帖子
const chooseCommunityItem = (item: CommunityItem) => {
  chooseCommunity.value = item
  showChooseCommunity.value = true
}

// 确认关联帖子
const confirmCommunity = async () => {
  if (loading.value) return
  
  if (!chooseCommunity.value) return
  
  try {
    loading.value = true
    // TODO: 调用关联帖子API
    // await insertCommunityForeign({
    //   pk_type: 4,
    //   community_id: chooseCommunity.value.community_id,
    //   pk_id: matchingId
    // })
    
    console.log('关联成功')
    showChooseCommunity.value = false
    // 刷新返图列表
  } catch (error) {
    console.error('关联失败', error)
  } finally {
    loading.value = false
  }
}

// 发送评论
const handleShowComment = () => {
  navigateTo(`/comment/send?id=${matchingId}&type=match`)
}

// 初始化
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  // 设置屏幕宽度监听
  if (process.client && typeof window !== 'undefined') {
    screenWidth.value = window.innerWidth
    resizeHandler = () => {
      screenWidth.value = window.innerWidth
      // 窗口大小改变时重新计算布局
      nextTick(() => {
        calculateLayout()
      })
    }
    window.addEventListener('resize', resizeHandler)
  }
  
  // 获取详情数据
  setTimeout(async () => {
    await fetchDetail()
  })
})

// 清理
onBeforeUnmount(() => {
  if (process.client && typeof window !== 'undefined' && resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})

// SEO
useHead({
  title: computed(() => detail.value?.note || '搭配详情'),
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,搭配,Lolita搭配'
    },
    {
      name: 'description',
      content: computed(() => detail.value?.note || 'Lolita搭配详情')
    }
  ]
})
</script>

<template>
  <div class="container mx-auto p-4 max-md:p-2 pb-20">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="flex justify-center items-center min-h-[400px]">
      <div class="text-gray-500">加载中...</div>
    </div>

    <!-- 详情内容 -->
    <div v-else-if="detail" class="space-y-4">
      <!-- 搭配卡片 -->
      <div class="bg-white rounded-lg border-pink-300 shadow-md overflow-hidden">
        <div id="matchingBox" class="p-2">
          <!-- 主图区域 -->
          <div class="flex gap-2 mb-2">
            <!-- 主图或主衣服 -->
            <div v-if="detail.cover" class="w-2/3">
              <div 
                class="rounded-lg overflow-hidden cursor-pointer"
                @click="previewImage([BASE_IMG + detail.cover], 0)"
              >
                <img
                  :src="`${BASE_IMG}${detail.cover}?x-oss-process=image/quality,q_100/resize,w_800`"
                  :alt="detail.note || '搭配图片'"
                  class="w-full object-cover"
                  :style="mainImageHeight ? { height: `${mainImageHeight}px` } : {}"
                />
              </div>
            </div>
            
            <div v-else-if="detail.main_clothes_item" class="w-2/3">
              <div 
                class="rounded-lg overflow-hidden cursor-pointer relative"
                @click="previewImage([BASE_IMG + detail.main_clothes_item.clothes_img], 0)"
                :style="mainImageHeight ? { height: `${mainImageHeight}px` } : {}"
              >
                <!-- 颜色标签 -->
                <div 
                  v-if="detail.main_clothes_item.color"
                  class="absolute top-2 left-2 z-10 flex flex-wrap gap-1"
                >
                  <div
                    v-for="color in detail.main_clothes_item.color.split(',')"
                    :key="color"
                    class="w-4 h-4 rounded-full shadow-md border border-gray-300"
                    :style="{ backgroundColor: color }"
                  ></div>
                </div>
                <img
                  :src="`${BASE_IMG}${detail.main_clothes_item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_800`"
                  alt="主衣服"
                  class="w-full h-full object-cover"
                />
              </div>
              
              <!-- 主衣服信息 -->
              <div class="mt-2 text-center text-sm">
                <span 
                  v-if="detail.main_clothes_item.price"
                  class="text-red-500 font-semibold mr-2"
                >
                  ￥ {{ detail.main_clothes_item.price }}
                </span>
                <span>{{ detail.main_clothes_item.clothes_note || '' }}</span>
              </div>
              
              <!-- 来源信息 -->
              <div class="mt-1 text-center text-xs text-gray-500">
                <a
                  v-if="detail.main_clothes_item.library"
                  @click.stop="jumpToLibraryDetail(detail.main_clothes_item.library.library_id)"
                  class="hover:text-blue-500 cursor-pointer"
                >
                  {{ detail.main_clothes_item.library.name }}
                </a>
                <a
                  v-else-if="detail.main_clothes_item.origin_shop"
                  @click.stop="jumpToShopDetail(detail.main_clothes_item.origin_shop.shop_id)"
                  class="hover:text-blue-500 cursor-pointer"
                >
                  {{ detail.main_clothes_item.origin_shop.shop_name }}
                </a>
                <span v-else-if="detail.main_clothes_item.origin">
                  来源：{{ detail.main_clothes_item.origin }}
                </span>
              </div>
            </div>

            <!-- 右侧衣服列表 -->
            <div v-if="detail.list && detail.list.length > 0" class="w-1/3 space-y-2">
              <div
                v-for="(item, index) in detail.list"
                :key="index"
                class="relative"
              >
                <!-- 状态标签 -->
                <div
                  v-if="item.library"
                  class="absolute top-0 right-0 z-10 px-1 py-0.5 text-xs text-white bg-red-500 rounded"
                >
                  {{ item.library.state }}
                </div>
                
                <div
                  class="rounded-lg overflow-hidden cursor-pointer relative aspect-square"
                  @click="previewImage([BASE_IMG + item.clothes_img], 0)"
                >
                  <!-- 颜色标签 -->
                  <div
                    v-if="item.color"
                    class="absolute top-1 left-1 z-10 flex flex-wrap gap-1"
                  >
                    <div
                      v-for="color in item.color.split(',')"
                      :key="color"
                      class="w-3 h-3 rounded-full shadow-sm border border-gray-300"
                      :style="{ backgroundColor: color }"
                    ></div>
                  </div>
                  <img
                    :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300,h_300`"
                    alt="衣服"
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <!-- 衣服信息 -->
                <div class="mt-1 text-center text-xs">
                  <span
                    v-if="item.price"
                    class="text-red-500 font-semibold mr-1"
                  >
                    ￥ {{ item.price }}
                  </span>
                  <span class="line-clamp-1">
                    {{ item.clothes_note || (item.library ? item.library.name : '') }}
                  </span>
                </div>
                
                <!-- 来源信息 -->
                <div class="mt-0.5 text-center text-xs text-gray-500">
                  <a
                    v-if="item.library"
                    @click.stop="jumpToLibraryDetail(item.library.library_id)"
                    class="hover:text-blue-500 cursor-pointer line-clamp-1"
                  >
                    {{ item.library.shop ? item.library.shop.shop_name : item.library.name }}
                  </a>
                  <a
                    v-else-if="item.origin_shop"
                    @click.stop="jumpToShopDetail(item.origin_shop.shop_id)"
                    class="hover:text-blue-500 cursor-pointer line-clamp-1"
                  >
                    {{ item.origin_shop.shop_name }}
                  </a>
                  <span v-else-if="item.origin" class="text-xs">
                    来源：{{ item.origin }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 其他衣服列表（下方排列，1:1比例） -->
          <div v-if="detail.clothes_list && detail.clothes_list.length > 0" class="grid grid-cols-3 gap-2 mt-2">
            <div
              v-for="(item, index) in detail.clothes_list"
              :key="index"
              class="relative"
            >
              <div
                class="rounded-lg overflow-hidden cursor-pointer relative aspect-square"
                @click="previewImage([BASE_IMG + item.clothes_img], 0)"
              >
                <!-- 颜色标签 -->
                <div
                  v-if="item.color"
                  class="absolute top-1 left-1 z-10 flex flex-wrap gap-1"
                >
                  <div
                    v-for="color in item.color.split(',')"
                    :key="color"
                    class="w-3 h-3 rounded-full shadow-sm border border-gray-300"
                    :style="{ backgroundColor: color }"
                  ></div>
                </div>
                <img
                  :src="`${BASE_IMG}${item.clothes_img}?x-oss-process=image/quality,q_100/resize,w_300,h_300`"
                  alt="衣服"
                  class="w-full h-full object-cover"
                />
              </div>
              
              <!-- 衣服信息 -->
              <div class="mt-1 text-center text-xs">
                <span
                  v-if="item.price"
                  class="text-red-500 font-semibold mr-1"
                >
                  ￥ {{ item.price }}
                </span>
                <span class="line-clamp-1">
                  {{ item.clothes_note || (item.library ? item.library.name : '') }}
                </span>
              </div>
              
              <!-- 来源信息 -->
              <div class="mt-0.5 text-center text-xs text-gray-500">
                <a
                  v-if="item.library"
                  @click.stop="jumpToLibraryDetail(item.library.library_id)"
                  class="hover:text-blue-500 cursor-pointer line-clamp-1"
                >
                  {{ item.library.shop ? item.library.shop.shop_name : item.library.name }}
                </a>
                <a
                  v-else-if="item.origin_shop"
                  @click.stop="jumpToShopDetail(item.origin_shop.shop_id)"
                  class="hover:text-blue-500 cursor-pointer line-clamp-1"
                >
                  {{ item.origin_shop.shop_name }}
                </a>
                <span v-else-if="item.origin" class="text-xs">
                  来源：{{ item.origin }}
                </span>
              </div>
            </div>
          </div>

          <!-- 标签列表 -->
          <div v-if="detail.tags_list && detail.tags_list.length > 0" class="flex flex-wrap gap-2 mt-3 px-2">
            <span
              v-for="tag in detail.tags_list"
              :key="tag.tags_id"
              class="text-sm text-gray-700"
            >
              #{{ tag.tags_name }}
            </span>
          </div>

          <!-- 主风格标签 -->
          <div v-if="detail.main_style" class="flex flex-wrap gap-2 mt-2 px-2">
            <span
              v-for="(style, index) in detail.main_style.split(',')"
              :key="index"
              class="text-sm text-red-500"
            >
              ★{{ style }}
            </span>
          </div>

          <!-- 备注 -->
          <div v-if="detail.note" class="mt-3 px-2 text-sm text-gray-700">
            {{ detail.note }}
          </div>

          <!-- 编号和用户信息 -->
          <div class="mt-2 px-2 text-xs text-gray-400 flex justify-between">
            <span>编号: {{ detail.matching_id }}</span>
            <span>Lo研社 @{{ detail.user?.user_name || detail.user_name }}</span>
          </div>
        </div>

        <!-- 预定时间和隐私设置 -->
        <div class="px-2 pb-2 flex justify-between items-center text-sm">
          <span v-if="detail.appointment_time">
            预定时间: {{ dayjs(detail.appointment_time).format('YYYY-MM-DD') }}
          </span>
          <span class="text-orange-400">
            {{ detail.is_private === 0 ? '公开' : '私有' }}
          </span>
        </div>

        <!-- 用户信息 -->
        <div
          v-if="detail.user"
          class="px-2 pb-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded"
          @click="jumpToUserSpace(detail.user.user_id)"
        >
          <UserInfo :user="detail.user" />
        </div>

        <!-- 活动列表 -->
        <div
          v-if="detail.activity_list && detail.activity_list.length > 0"
          class="px-2 pb-2 text-center text-sm text-blue-500 cursor-pointer"
          @click="showActivityModal = true"
        >
          ———— 参与 {{ detail.activity_list.length }} 活动 ————
        </div>
      </div>
    </div>
    <!-- 占位 -->
    <div class="h-20"></div>
    <!-- 底部操作栏 -->
    <div
      v-if="detail"
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50"
    >
      <div class="container mx-auto px-4 py-3 flex justify-center gap-8">
        <div class="flex-1 text-center">
          <UserGoodBtn 
            :pk_type="4" 
            :pk_id="detail.matching_id" 
            :good_count="detail.good_count || 0" 
            :is_good="detail.is_good ? true : false"
            :need_judge="true"
          />
        </div>
        <div class="flex-1 text-center">
          <UserCollectBtn 
            :pk_type="4" 
            :pk_id="detail.matching_id" 
            :collect_count="detail.collect_count || 0" 
            :is_collect="detail.is_collect ? true : false"
            :need_judge="true"
          />
        </div>
        <!-- <div class="flex-1 text-center">
          <button
            @click="handleGenerateImage"
            class="flex flex-col items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            <span class="text-xl">🖼️</span>
            <span>生成搭配图</span>
          </button>
        </div> -->
      </div>
    </div>

    <!-- 活动列表弹窗 -->
    <UModal v-model="showActivityModal" title="参与的活动">
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="(item, index) in detail?.activity_list || []"
          :key="index"
          class="flex items-center gap-3 p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          @click="jumpToActivity(item.activity_id)"
        >
          <div class="w-15 h-15 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
            <img
              :src="item.activity?.activity_cover ? `${BASE_IMG}${item.activity.activity_cover}` : `${BASE_IMG}/static/plan_cover/default.jpg`"
              alt="活动封面"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-base font-semibold text-orange-400 line-clamp-1">
              {{ item.activity?.activity_title || '暂无标题' }}
            </div>
          </div>
        </div>
      </div>
    </UModal>

    <!-- 添加帖子类型选择 -->
    <UModal v-model="showAddCommunity" title="选择操作">
      <div class="space-y-2">
        <UButton
          @click="confirmAddType(0)"
          class="w-full"
          color="primary"
        >
          关联帖子
        </UButton>
        <UButton
          @click="confirmAddType(1)"
          class="w-full"
          color="primary"
          variant="outline"
        >
          新增帖子
        </UButton>
      </div>
    </UModal>

    <!-- 确认关联帖子 -->
    <UModal v-model="showChooseCommunity" title="操作确认">
      <div class="space-y-4">
        <p>确定要添加该帖子吗？</p>
        <div class="flex gap-2 justify-end">
          <UButton @click="showChooseCommunity = false" variant="outline">
            取消
          </UButton>
          <UButton @click="confirmCommunity" :loading="loading" color="primary">
            确定
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
/* 使用 Tailwind CSS，不需要额外的样式 */
</style>
