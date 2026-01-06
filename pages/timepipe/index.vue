<template>
  <div class="container mx-auto min-h-screen timepipe-wrapper">
    <!-- 弹幕组件 - 一直存在，只在"上新日历"标签页时显示 -->
    
    <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-40" style="pointer-events: none;">
      <CommentDanmakuComment
        v-show="currentTab === 0"
        ref="danmakuRef"
        type="library_pipe"
        :id="dateId"
        width="100%"
        height="100vh"
        :pageSize="50"
        :speed="danmakuSpeed"
        fontSize="14px"
        class="pointer-events-none"
      />
    </div>
    <QhxTabs sticky :sticky_offset="0" :tabs="['上新日历', '图表版总览', '实体店', '手作娘','出物']" :need_swipe="false" @change="onChangeTab">
      <QhxTabPanel :index="0">
        <template #default="{ isActive }">
          <div>
            <!-- 用户 -->
            <div class=" flex items-center justify-between px-2">
              <div class="">
                技术支持 <a href="https://xhslink.com/m/7NBq8fikmnB">@千河星星</a>
              </div>
              <div class="flex items-center gap-4" v-show="!user">
                <LoginBox />
              </div>
              <div class="flex items-center gap-4" v-show="user">
                <UserBox></UserBox>
              </div>
            </div>
            <QhxDatePicker v-model="picked" @change="onChange" />
            <!-- <HorizontalDatePicker v-model="picked" :compact="isCompact" @change="onChange" /> -->
            <div class="flex justify-between items-center p-2">
              <div class="text-sm text-gray-600">当前选择：{{ dayjs(formatted).format('YY-MM-DD') }}</div>
              <div class="flex items-center gap-2">
                <UButton color="primary" size="sm" @click="layout = layout === '0' ? '1' : '0'"> {{ layout === '0' ?
                  '列表:大图' :
                  '列表:简洁' }} </UButton>
                <UButton color="primary" size="sm" @click="showLibraryPipeAdd()" v-if="userStore.token">自主投稿上新</UButton>
              </div>
            </div>
            <div class="text-sm text-gray-600 p-2" v-if="waterList">
              总数：{{ waterList.total }}
            </div>
            <div class="flex items-center justify-between p-2">
              <div class="flex items-center gap-2 flex-1">
                <!-- 塞选状态 -->
                <UButton type="submit" size="xs" class="bg-qhx-primary text-qhx-inverted hover:bg-qhx-primaryHover mt-2"
                  @click="(e: MouseEvent) => { openPicker(e) }">
                  {{`筛选:${filterStateOptions.find(item => item.value === filterState)?.label}` || '筛选状态'}}
                </UButton>
                <QhxSelect ref="qhxSelectRef" :options="filterStateOptions" :default-value="filterStateOptions[1]"
                  :canCustomize="false" @select="(select) => {
                    filterState = select.value
                    waterList?.refresh()
                  }" />
              </div>
              <div class="flex items-center gap-2">
                <div>今日访问：{{ todayVisit }}</div>
                <QhxJellyButton>
                  <div class="h-[60px] text-center px-1  cursor-pointer flex items-center justify-center">
                    <div @click="copyUrl()"
                      class=" m-[5px] text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center">
                      <UIcon name="ic:round-share" class="text-[22px] text-[#ffffff]" />
                    </div>
                    <div class=" text-sm">分享</div>
                  </div>
                </QhxJellyButton>
              </div>
              <!-- <div>
        <UButton color="primary" size="sm" v-if="userStore.token">已阅</UButton>
      </div> -->
            </div>
            <QhxWaterList v-if="layoutReady" ref="waterList" :fetch-data="async (page, pageSize) => {
              const response = await getLibraryPipeList({ page, pageSize, time: formatted, state: filterState === -1 ? undefined : filterState, examin: 0 })
              return {
                rows: response.rows,
                count: response.count
              }
            }" :columns="3" :itemKey="0" :columns_768="layout === '0' ? 2 : 1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item mr-[1px] mb-1" :key="item.pipe_id">
                  <div class="polaroid-card">
                    <div class="flex justify-between items-center px-2">
                      <QhxTag :active="true"> <div class="text-xs">{{ formateState(item.state) }}</div> </QhxTag>
                      <div class="p-0 flex items-center">
                        <!-- <h3 class="p-2">起止时间</h3> -->
                        <QhxTag :active="true" v-show="layout !== '0'">{{ dayjs(item.start_time).format('YY-MM-DD') }}</QhxTag> -
                        <QhxTag :active="true" v-show="layout !== '0'">{{ dayjs(item.end_time).format('YY-MM-DD') }}</QhxTag>
                        <h3 class="p-0 text-xs text-gray-600">截止: {{ dayjs(item.end_time).diff(dayjs(), 'day') }}天</h3>
                      </div>
                    </div>
                    <div class="px-2 text-sm text-gray-600" v-if="item.note">
                      备注: {{ item.note }}
                    </div>
                    <div v-if="item.item">
                      <LibraryItem :style="layout === '0' ? { marginTop: '-10px' } : { }" :className="'p-1'" :size="layout === '0' ? 'big' : 'mini-list'" :item="item.item"
                        @image-load="debouncedApplyLayout">
                        <template #tagInfo v-if="layout !== '0'">
                          <div v-if="item.library_list && item.library_list.length > 0">
                            <div class="text-sm text-gray-600">
                              {{item.library_list.map((library: Library) => `￥ ${library.library_price}
                              ${formatLabel(library.shop_country || 0, config?.money_type)}
                              ${library.library_type}`).join(',')
                              }}
                            </div>
                          </div>
                        </template>
                      </LibraryItem>
                      <div class="flex justify-center">
                        <div class=" flex-1 text-center" :style="{ transform: 'scale(0.7)' }">
                          <UserGoodBtn :pk_type="2" :pk_id="item.item.library_id" :is_good="item.is_good === 1 ? true : false" :good_count="item.item.good_count" :need_judge="false">
                          </UserGoodBtn>
                        </div>
                        <div class=" flex-1 text-center" :style="{ transform: 'scale(0.7)' }">
                          <UserCollectBtn :collect_count="item.item.collect_count" :pk_type="2" :pk_id="item.item.library_id" :is_collect="item.is_collect === 1 ? true : false"
                            :need_judge="false"></UserCollectBtn>
                        </div>
                        <div class=" flex-1 text-center flex justify-center" :style="{ transform: 'scale(0.7)' }">
                          <div @click="handleAddToWardrobe(item.item)" class="cursor-pointer inline-block">
                            <UIcon name="i-heroicons-archive-box-20-solid" class="text-[26px]" 
                            :class="item.is_wardrobe === 1 ? 'text-[#409EFF]' : 'text-gray-500'" />
                          </div>
                          <div class="text-base ml-1">{{ item.item.wardrobe_count || 0 }}</div>
                        </div>
                        <!-- <div class=" flex-1 text-center">
                          <UIcon :name="'i-heroicons-heart-20-solid'" class=" text-[26px] text-[#409EFF] cursor-pointer" @click="captureScreen()"/>
                        </div> -->
                      </div>
                      <!-- <LibraryItem :className="'p-1'" :size="'mini-list'" v-else :item="item.item"
                      @image-load="debouncedApplyLayout"></LibraryItem> -->
                    </div>

                  </div>
                </div>
              </template>
            </QhxWaterList>
          </div>
        </template>

      </QhxTabPanel>
      <QhxTabPanel :index="1">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div v-if="library_pipe_chart.length > 0">
              <div class="flex flex-wrap gap-2" style="touch-action: none;">
                <QhxTimePipe :timePipe="[...library_pipe_chart]"></QhxTimePipe>
              </div>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="2">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 0 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToShop(item.item?.shop)">
                      <img :src="`${BASE_IMG}${item.item?.shop?.shop_logo || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.physical_name }}</h3>
                        <div class="text-sm text-gray-600">{{ item.item?.address }}</div>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="3">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 2 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToShop(item.item)">
                      <img :src="`${BASE_IMG}${item.item?.shop_logo || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[40px] h-[40px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.shop_name }}</h3>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
      <QhxTabPanel :index="4">
        <template #default="{ isActive }">
          <div v-if="isActive">
            <div>
              <QhxWaterList ref="waterList4" v-if="layoutReady && isActive" :fetch-data="async (page, pageSize) => {
                const response = await getDisplayCabinetList({ page, pageSize, pk_type: 1 })
                return {
                  rows: response.rows,
                  count: response.count,
                }
              }" :columns="2" :itemKey="1" :columns_768="1" :enableWaterfall="true" :enableLoadMore="isActive ? true : false">
              <template #default="{ item, debouncedApplyLayout }">
                <!-- 自定义内容 -->
                <div class="custom-item m-2" :key="item.cabinet_id">
                  <div class="polaroid-card">
                    <div class="flex justify-center items-center cursor-pointer" @click="jumpToUser(item.item?.user_id)">
                      <img :src="`${BASE_IMG}${item.item?.user_face || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[40px] h-[40px] object-cover rounded-full m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.item?.user_name }}</h3>
                      </div>
                    </div>
                    <div class="flex items-center pb-2 flex-wrap cursor-pointer" @click="jumpToWardrobe(item.wardrobe)">
                      <div v-for="clothes in item.wardrobe_clothes" :key="clothes.clothes_id" class="md:w-1/6 w-1/3">
                        <img :src="`${BASE_IMG}${clothes.clothes_img}`" class="w-full aspect-[1/1] object-cover rounded-[20px] p-1"></img>
                      </div>
                    </div>
                    <div class="flex justify-center items-center">
                      <img :src="`${BASE_IMG}${item.wardrobe?.wardrobe_cover || 'static/plan_cover/default.jpg'}`" alt="cover" class="w-[60px] h-[60px] object-cover rounded-[20px] m-2"></img>
                      <div class="flex-1 items-center justify-center">
                        <h3>{{ item.wardrobe?.wardrobe_name }}</h3>
                        <div class="text-sm text-gray-600" @click="coptText(item.wardrobe?.wardrobe_desc)">{{ item.wardrobe?.wardrobe_desc }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </QhxWaterList>
            </div>
          </div>
        </template>
      </QhxTabPanel>
    </QhxTabs>
    <!-- 悬浮按钮 -->
    <div class="fixed bottom-4 right-4" v-show="currentTab === 4" v-if="user?.user_id">
      <UButton color="primary" size="lg" icon="i-heroicons-plus" @click="showChooseWardrobe" />
    </div>
    <WardrobeChoose ref="wardrobeChooseRef" :user_id="user?.user_id" v-if="user?.user_id" @choose="chooseWardrobe"/>
    <!-- 确认框 -->
    <UModal v-model="showConfirm" :ui="{ width: 'max-w-4xl' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">确认添加该衣柜?</h3>
        </template>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="showConfirm = false">取消</UButton>
          <UButton color="primary" @click="addWardrobeToDisplay">确认</UButton>
        </div>
      </UCard>
    </UModal>
    <LibraryPipeAdd ref="libraryPipeAddRef" />
    <!-- <QhxLoading :loading="isLoading" :page="page" :total="total" :page-size="pageSize" @load-more="loadMore">
    </QhxLoading> -->
    <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <WardrobeAddLibrary ref="wardrobeAddLibraryRef" @change="handleWardrobeChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import HorizontalDatePicker from '@/components/Qhx/HorizontalDatePicker.vue'
import { getLibraryPipeList } from '@/api/library'
import type QhxWaterList from '@/components/Qhx/WaterList.vue'
import type { LibraryPipe, Shop, Wardrobe, WardrobeClothes } from '@/types/api'
import { getUserMy } from '@/api/user'
import type { User } from '@/types/api'
import { getBrowTimeOne, insertBrowTime } from '@/api/brow_time'
import { useCopyCurrentUrl } from '~/composables/useCopyCurrentUrl';
import type LibraryPipeAdd from '@/components/library/LibraryPipeAdd.vue'
const libraryPipeAddRef = ref<InstanceType<typeof LibraryPipeAdd> | null>(null)
import { getLibraryPipeListAll } from '@/api/library'
import { getDisplayCabinetList, insertDisplayCabinet } from '@/api/display_cabinet'
import type WardrobeChoose from '@/components/Wardrobe/WardrobeChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'
import type FavoriteOptionsModal from '@/components/Favorite/OptionsModal.vue'
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type DanmakuComment from '@/components/comment/DanmakuComment.vue'
const wardrobeAddLibraryRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const favoriteOptionsModalRef = ref<InstanceType<typeof FavoriteOptionsModal> | null>(null)
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const danmakuRef = ref<InstanceType<typeof DanmakuComment> | null>(null)
const route = useRoute()
const token = ref<string | null>(null) // 传入的token

// 窗口宽度响应式变量
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

// 根据窗口宽度计算弹幕速度
// 速度值越小，弹幕移动越快。窗口越宽，需要的时间应该相应增加
// 基准：1920px 宽度对应速度 40，按比例计算
const danmakuSpeed = computed(() => {
  const baseWidth = 1920 // 基准宽度（像素）
  const baseSpeed = 40 // 基准速度
  // 根据窗口宽度按比例调整速度
  // 窗口越宽，速度值越大（移动越慢），以保持视觉一致性
  return Math.round((windowWidth.value / baseWidth) * baseSpeed)
})

// 监听窗口大小变化
const handleResize = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}
import type { default as QhxSelect, optionsInterface } from '@/components/Qhx/Select.vue'
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const library_pipe_chart = ref<LibraryPipe[]>([])
const fetchLibraryPipeAll = () => {
  getLibraryPipeListAll({ end_time: dayjs().format('YYYY-MM-DD'), pk_type: 0, cache: true })
    .then((res) => {
      library_pipe_chart.value = res
    })
}
import dayjs from 'dayjs'
import type { Library } from '@/types/api'
let uni: any;
const showConfirm = ref(false)
const toast = useToast()
const userStore = storeToRefs(useUserStore())
const { user } = userStore
if (route.query?.token) {
  useUserStore().setToken(route.query.token.toString())
}
const opear_item = ref<Wardrobe[]>([])

const addWardrobeToDisplay = async () => {
  if (opear_item.value.length === 0) {
    toast.add({
      title: '错误',
      description: '请选择衣柜',
      color: 'red'
    })
    return
  }
  const params = {
    wardrobe_id: opear_item.value[0].wardrobe_id,
    pk_type: 1,
    pk_id: opear_item.value[0].user_id,
  }
  const response = await insertDisplayCabinet(params)
  if (response) {
    toast.add({
      title: '成功',
      description: '添加成功',
      color: 'green'
    })
  }
  waterList4.value?.refresh()
  showConfirm.value = false
  opear_item.value = []
}
const layout = ref('1')
const todayVisit = ref(0)
const filterState = ref(0)
const filterStateOptions = [
  { label: '全部', value: -1 },
  { label: '预约中', value: 0 },
  { label: '尾款中', value: 2 },
  { label: '截团制作', value: 2 },
  { label: '现货在售', value: 3 },
  { label: '上新图透', value: 4 }
]
const wardrobeChooseRef = ref<InstanceType<typeof WardrobeChoose> | null>(null)
const showChooseWardrobe = () => {
  wardrobeChooseRef.value?.showModel()
}
// 图鉴颜色选择完成
const handleLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddLibraryRef.value?.showModel(data)
}
const handleWardrobeChange = (data?: WardrobeClothes) => {
  toast.add({
    title: '添加成功',
    icon: 'i-heroicons-check-circle',
    color: 'green'
  })
  
  // 更新对应 item 的状态
  if (waterList.value && data?.library_id) {
    const currentItem = waterList.value.list?.find((item: LibraryPipe) => item.item?.library_id === data.library_id)
    if (currentItem) {
      const updates: Partial<LibraryPipe> = {
        is_wardrobe: 1,
        item: {
          ...currentItem.item,
          is_wardrobe: 1,
          wardrobe_count: (currentItem.item?.wardrobe_count || 0) + 1
        }
      }
      console.log(updates, '刷新item')
      waterList.value.updateItem('pk_id', data.library_id, updates)
    }
  } else {
    // 如果没有传递 library_id，刷新整个列表
    waterList.value?.refresh()
  }
}
// 处理加衣柜点击
const handleAddToWardrobe = (data: Library) => {
  if (!userStore.token.value) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  if (!data) {
    toast.add({
      title: '衣柜信息不存在',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  // 打开图鉴颜色选择
  libraryTypeColorChooseRef.value?.showModel(data)
}
const chooseWardrobe = (wardrobe: Wardrobe[]) => {
  console.log(wardrobe, '选择衣柜')
  showConfirm.value = true
  opear_item.value = wardrobe
}
const qhxSelectRef = ref<InstanceType<typeof QhxSelect>>()
const currentTab = ref(0)
const openPicker = (e: MouseEvent) => {
  qhxSelectRef.value?.showPicker(e)
}
const onChangeTab = (index: number) => {
  if (index === 0) {
    waterList.value?.debouncedApplyLayout()
    // 切换到上新日历 tab 时，如果弹幕未加载则加载弹幕
    nextTick(() => {
      if (danmakuRef.value) {
        danmakuRef.value.reload()
      }
    })
  }
  currentTab.value = index
}
const onChangeFilterState = () => {

}
const formateState = (state: number) => {
  // 0 预约中 1尾款中 2截团制作 3现货在售
  switch (state) {
    case 0:
      return '预约中'
    case 1:
      return '尾款中'
    case 2:
      return '截团制作'
    case 3:
      return '现货在售'
    case 4:
      return '上新图透'
    default:
      return '未知'
  }
}
const coptText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const copyUrl = async () => {
  const { copyCurrentUrl } = useCopyCurrentUrl();
  try {
    await copyCurrentUrl()
    toast.add({
      title: '复制成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '复制失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}
const jumpToUser = (user_id: number) => {
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/userSpace/userSpace?id=${user_id}`,
    })
  }
  else {
    console.log('走普通网页环境')
    window.open(`/user/detail/${user_id}`, '_blank')
    // navigateTo(`/user/detail/${user_id}`)
  }
}
const jumpToShop = (item: Shop) => {
  const shop_id = item.shop_id
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/shop/shopDetail/shopDetail?id=${shop_id}`,
    })
  }
  else {
    console.log('走普通网页环境')
    window.open(`/shop/detail/${shop_id}`, '_blank')
    // navigateTo(`/shop/detail/${shop_id}`)
  }
}
const jumpToWardrobe = (item: Wardrobe) => {
  const user_id = item.user_id
  const wardrobe_id = item.wardrobe_id
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    console.log('走UniApp环境')
    uni.navigateTo({
      url: `/pages/wardrobe/wardrobe?user_id=${user_id}&wardrobe_id=${wardrobe_id}`,
    })
  } else {
    console.log('走普通网页环境')
    window.open(`/wardrobe/detail/${user_id}?wardrobe_id=${wardrobe_id}`, '_blank')
    // navigateTo(`/wardrobe/detail/${user_id}?wardrobe_id=${wardrobe_id}`)
  }
}
const getBrowTime = async () => {
  const response = await getBrowTimeOne({ id: dayjs(new Date()).format('YYYYMMDD'), type: 'library_pipe' })
  todayVisit.value = response.count_times
}
const picked = ref<Date | undefined>(undefined)
const pageSize = 20
const isLoading = ref(false)
const page = ref(1)
const waterList = ref<InstanceType<typeof QhxWaterList> | null>(null)
const waterList4 = ref<InstanceType<typeof QhxWaterList> | null>(null)
const loadMore = () => {
  console.log('是否在加载', isLoading.value)
  if (isLoading.value) {
    return
  }
  isLoading.value = true
  // 加载更多数据
  handlePageChange(page.value + 1)
}
const isCompact = computed(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
})
const handlePageChange = async (current: number) => {
  page.value = current
  try {
    await fetchLibraryPipeList()
  } catch (error) {
    page.value -= 1
  }
}
const formatted = computed(() => {
  const d = picked.value ?? new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

// 计算日期ID（YYMMDD格式，例如：251224 表示 2025-12-24）
const dateId = computed(() => {
  const d = picked.value ?? new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return Number.parseInt(`${yy}${mm}${dd}`, 10)
})

// 监听日期ID变化，自动重新加载弹幕
watch(dateId, () => {
  if (currentTab.value === 0 && danmakuRef.value) {
    nextTick(() => {
      danmakuRef.value?.reload()
    })
  }
})
const reload = () => {
  fetchLibraryPipeList(1, pageSize * page.value)
}
useHead({
  title: 'Lolita上新资讯平台',
  meta: [
    {
      name: 'keywords',
      content: 'Lo研社,Lolita上新资讯平台'
    },
    {
      name: 'description',
      content: 'Lolita上新资讯汇总'
    }
  ]
})

function onChange(d: Date) {
  // 可在此处发起接口或过滤数据
  // console.log('changed', d)
  // page.value = 1
  // reload()
  waterList.value?.refresh()
  // 切换日期时重新加载弹幕
  if (currentTab.value === 0 && danmakuRef.value) {
    nextTick(() => {
      danmakuRef.value?.reload()
    })
  }
}
const list = ref<LibraryPipe[]>([])
const total = ref(0)
const showLibraryPipeAdd = () => {
  libraryPipeAddRef.value?.showModel({})
}
// const jumpToAddLibrary = () => {
//   navigateTo('/addLibrary')
// }
const fetchLibraryPipeList = async (Ipage: number | null = null, IpageSize: number | null = null) => {
  const params = {
    page: Ipage || page.value,
    pageSize: IpageSize || pageSize,
    time: dayjs(picked.value).format('YYYY-MM-DD')
  }
  try {
    const response = await getLibraryPipeList(params)
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
const layoutReady = inject('layoutReady') as Ref<boolean>

watch(
  () => layoutReady.value,
  (val) => {
    if (val) {
      fetchLibraryPipeAll()
    } else {
    }
  },
  { immediate: true }
)

onMounted(async () => {
  
  picked.value = new Date()
  getBrowTime()
  if (userStore.token.value) {
    getUserMy().then((res: User) => {
      console.log(res, '用户信息')
      useUserStore().setUserInfo(res)
    })
  }
  setTimeout(() => {
    handleResize()
    if (user.value?.user_id === 1) {
      return
    }
    insertBrowTime({ id: dayjs(new Date()).format('YYYYMMDD'), type: 'library_pipe' })
  }, 5000)
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
  // fetchLibraryPipeList()
  
  // 监听窗口大小变化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})

onBeforeUnmount(() => {
  // 移除窗口大小监听器
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<style scoped>
.timepipe-wrapper {
  overscroll-behavior: none;
  /* touch-action: none; */
  -webkit-user-select: none;
  user-select: none;
}
.p-4 {
  padding: 16px;
}

.mt-4 {
  margin-top: 16px;
}

.text-sm {
  font-size: 14px;
}

.text-gray-600 {
  color: #4b5563;
}
</style>
