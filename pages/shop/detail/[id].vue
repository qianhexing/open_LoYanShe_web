<script setup lang="ts">
import type { Shop, PaginationResponse, LibraryPipe } from '@/types/api';
import { getShopDetail } from '@/api/shop';
import { getLibraryPipeList, getLibraryPipeListAll } from '@/api/library';
import { getEventRedblackList } from '@/api/event_redblack';
import type { UserBlackBtn, UserGoodBtn } from '#components';
import type LibraryPipeManage from '@/components/library/LibraryPipeManage.vue'
import type PhysicalShopModal from '@/components/shop/PhysicalShopModal.vue'
import type { PhysicalShop } from '@/types/api'
import { BASE_IMG } from '@/utils/ipConfig'

const user = useUserStore()
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const canManagePhysicalShop = computed(() => {
  const currentUser = user.user
  const accessLevel = currentUser?.access_level ?? 0
  return !!currentUser && accessLevel >= (config.value?.min_add_library || 0)
})
const route = useRoute()
const id = route.params.id as string
const { data } = await useAsyncData('shopDeatil', () => {
  return getShopDetail({ shop_id: Number.parseInt(id) })
}, {})
const detail = ref<Shop | null>(null)
const shop = ref<Shop | null>(null)
const goodBtn = ref<InstanceType<typeof UserGoodBtn> | null>(null)
const blackBtn = ref<InstanceType<typeof UserBlackBtn> | null>(null)
const library_pipe = ref<LibraryPipe[]>([])
import dayjs from 'dayjs'
detail.value = data.value ?? null
const router = useRouter()
const selectLibraryPipe = (item: LibraryPipe) => {
  console.log(item)
  // router.push(`/library/detail/${item.library?.library_id}`)
}
const fetchLibraryPipe = () => {
  getLibraryPipeListAll({ shop_id: Number.parseInt(id), end_time: dayjs().format('YYYY-MM-DD'), pk_type: 0 })
    .then((res) => {
      library_pipe.value = res
    })
}
const formateState = (state: number) => {
  const item = config.value?.pipe_state.find(item => item.value === state)
  return item?.label
}
onMounted(async () => {
  if (!detail.value) {
    try {
      detail.value = await getShopDetail({ shop_id: Number.parseInt(id) })
    } catch {
      // useAsyncData 未带回详情时客户端补拉失败则保持空状态
    }
  }
  fetchLibraryPipe()
  void prefetchShopEventCount()
})

async function prefetchShopEventCount() {
  const shopId = detail.value?.shop_id
  if (shopId == null) return
  try {
    const res = await getEventRedblackList({
      page: 1,
      pageSize: 1,
      pk_id: shopId,
      pk_type: 0
    })
    shopEventTabCount.value = res.count ?? 0
  } catch {
    // 角标预取失败时保持不显示
  }
}
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: detail.value ? detail.value.shop_name : 'Lolita店铺汇总',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.shop_name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
const libraryPipeManageRef = ref<InstanceType<typeof LibraryPipeManage> | null>(null)
const physicalShopModalRef = ref<InstanceType<typeof PhysicalShopModal> | null>(null)

const showLibraryPipeManage = () => {
  libraryPipeManageRef.value?.showModel({ shop_id: Number.parseInt(id) })
}

function formatPhysicalShopAddress(shop: PhysicalShop) {
  return [shop.province, shop.city, shop.area, shop.address].filter(Boolean).join('')
}

function physicalShopLogo(shop: PhysicalShop) {
  const logo = shop.physical_logo
  if (logo) return `${BASE_IMG}${logo}`
  if (detail.value?.shop_logo) return `${BASE_IMG}${detail.value.shop_logo}`
  return `${BASE_IMG}static/plan_cover/default.jpg`
}

function buildPhysicalShopMapLink(shop: PhysicalShop) {
  const address = formatPhysicalShopAddress(shop)
  const { latitude, longitude } = shop
  if (latitude != null && latitude !== '' && longitude != null && longitude !== '') {
    const title = encodeURIComponent(shop.physical_name || '实体店')
    const content = encodeURIComponent(address)
    return `https://api.map.baidu.com/marker?location=${latitude},${longitude}&title=${title}&content=${content}&output=html`
  }
  if (address) {
    return `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(address)}&output=html`
  }
  return ''
}

function showPhysicalShop(item: PhysicalShop) {
  physicalShopModalRef.value?.showModel(item)
}

function openPhysicalShopMap(shop: PhysicalShop) {
  const link = buildPhysicalShopMapLink(shop)
  if (link) window.open(link, '_blank')
}

function jumpToAddPhysicalShop() {
  router.push(`/addPhysicalShop?shop_id=${id}`)
}

function jumpToEditPhysicalShop(physicalShop: PhysicalShop) {
  if (!physicalShop.physical_id) return
  router.push(`/addPhysicalShop?physical_id=${physicalShop.physical_id}&shop_id=${id}`)
}

const shopPipeTabCounts = computed(() => [
  library_pipe.value.length > 0 ? library_pipe.value.length : undefined,
  undefined
])

const shopContentTabCounts = computed(() => [
  shopLibraryTabCount.value,
  shopEventTabCount.value
])

const shopLibraryTabCount = ref<number | undefined>(
  detail.value?.count_library != null ? detail.value.count_library : undefined
)
const shopEventTabCount = ref<number | undefined>(undefined)

watch(
  () => detail.value?.count_library,
  (count) => {
    if (count != null) shopLibraryTabCount.value = count
  }
)
</script>
<template>
  <div class="container mx-auto p-4 max-md:p-2">
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="detail.shop_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full relative">
          <QhxPreviewImage :key="detail.shop_id" :list="[{ src: detail.shop_logo, alt: detail.shop_name }]" :className="'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
        </div>
        <div class="m-2 flex-1">
          <div>
            <h1 class="mb-3 text-lg font-semibold">{{ detail?.shop_name }}</h1>
          </div>
          <h3 class="text-sm m-1" v-html="detail.shop_describe" v-if="detail.shop_describe"></h3>
          <div class="flex justify-center p-3">
            <QhxJellyButton>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                @click="showLibraryPipeManage"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                管理店铺状态流
              </button>
            </QhxJellyButton>
          </div>
          <div class="flex justify-center p-3 flex-wrap gap-y-2">
            <div class=" flex-1 text-center min-w-[88px]">
              <UserGoodBtn ref="goodBtn" :pk_type="1" :pk_id="detail.shop_id" :good_count="detail.good_count || 0" :need_judge="true">
              </UserGoodBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]">
              <UserCollectBtn :collect_count="detail.collect_count ?? 0" :pk_type="1" :pk_id="detail.shop_id" :need_judge="true">
              </UserCollectBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]">
              <UserBlackBtn ref="blackBtn" :pk_type="1" :pk_id="detail.shop_id" :black_count="detail.black_count || 0" :need_judge="true">
              </UserBlackBtn>
            </div>
            <div class=" flex-1 text-center min-w-[88px]" v-if="goodBtn && blackBtn">
              赞黑比 {{ blackBtn.blackCount ? (goodBtn.goodCount / blackBtn.blackCount).toFixed(2) : goodBtn.goodCount ? goodBtn.goodCount : '--' }}
            </div>
          </div>
          <!-- 主营风格 -->
          <div v-if="detail.style_list  && detail.style_list?.length" class="mb-1">
            <h3 class="text-sm m-1">主营风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主营类型 -->
          <div v-if="detail.type_list && detail.type_list?.length > 0" class="mb-1">
            <h3 class="text-sm m-1">主营类型</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in detail.type_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 主体 -->
          <div v-if="detail.main_type" class="mb-1">
            <h3 class="text-sm m-1">主体</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in formatShopMainType(detail.main_type)" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>
          <!-- 实体店 -->
          <div class="mb-3">
            <div class="flex items-center justify-between mb-2 px-1">
              <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">实体店</h3>
              <QhxJellyButton v-if="canManagePhysicalShop">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                  @click="jumpToAddPhysicalShop"
                >
                  <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                  收录实体店
                </button>
              </QhxJellyButton>
            </div>
            <div v-if="detail.physical_shop && detail.physical_shop.length > 0" class="space-y-2">
              <div
                v-for="physicalShop in detail.physical_shop"
                :key="physicalShop.physical_id"
                class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gradient-to-r from-white to-gray-50/60 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
              >
                <div class="flex items-center gap-3 p-3">
                  <img
                    :src="physicalShopLogo(physicalShop)"
                    :alt="physicalShop.physical_name || '实体店'"
                    class="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0 cursor-pointer shadow-sm"
                    loading="lazy"
                    @click="showPhysicalShop(physicalShop)"
                  />
                  <div
                    class="flex-1 min-w-0 cursor-pointer"
                    @click="showPhysicalShop(physicalShop)"
                  >
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {{ physicalShop.physical_name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {{ formatPhysicalShopAddress(physicalShop) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <QhxJellyButton v-if="canManagePhysicalShop">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        @click.stop="jumpToEditPhysicalShop(physicalShop)"
                      >
                        编辑
                      </button>
                    </QhxJellyButton>
                    <QhxJellyButton v-if="buildPhysicalShopMapLink(physicalShop)">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-qhx-primary/40 text-qhx-primary hover:bg-qhx-primary/5"
                        @click.stop="openPhysicalShopMap(physicalShop)"
                      >
                        <UIcon name="i-heroicons-map-pin" class="w-3.5 h-3.5" />
                        去导航
                      </button>
                    </QhxJellyButton>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-gray-500 dark:text-gray-400 px-1">
              暂无实体店信息
            </div>
          </div>
          <!-- 代表作 -->
          <div v-if="detail.masterpiece_list && detail.masterpiece_list.length > 0" class="mb-1">
            <h3 class="text-sm m-1">代表作</h3>
            <div class="flex flex-wrap gap-2">
              <div v-for="library in detail.masterpiece_list">
                <LibraryItem :item="library" size="mini" :className="' w-[100px] cursor-pointer'"></LibraryItem>
              </div>
            </div>
          </div>
          <!-- 关联的店铺 -->
          <div v-if="detail.related_shop_list && detail.related_shop_list.length > 0" class="mb-3">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 px-1">关联的店铺</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div
                v-for="relatedShop in detail.related_shop_list"
                :key="relatedShop.shop_id"
                class="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/50 p-2 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <ShopItem
                  :item="relatedShop"
                  size="small"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="detail && library_pipe.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs
        sticky
        panel-min-height="min(50vh, 480px)"
        :tabs="['近期工作流', '图表版']"
        :tab-counts="shopPipeTabCounts"
      >
        <QhxTabPanel :index="0">
          <div class=" bg-white">
            <div v-if="library_pipe.length > 0">
              <div v-for="value in library_pipe" :key="value.pipe_id">
                <div v-if="value.library">
                  <LibraryItem :need-jump="false" :item="value.library" size="mini-list" class="w-full">
                    <template #extra>
                      <div class="p-2 flex items-center">
                        <QhxTag :active="true"> {{ formateState(value.state || 0) }} </QhxTag>
                        <h3 class="p-2">起止时间</h3>
                        <QhxTag :active="true">{{ dayjs(value.start_time).format('YY-MM-DD') }}</QhxTag> - 
                        <QhxTag :active="true">{{ dayjs(value.end_time).format('YY-MM-DD') }}</QhxTag>
                      </div>
                    </template>
                  </LibraryItem>
                </div>
              </div>
            </div>
          </div>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <div class=" bg-white" v-if="isActive">
              <div v-if="library_pipe.length > 0" class="p-3">
                <h3 class="text-sm m-1">近期工作流</h3>
                <div class="flex flex-wrap gap-2">
                  <QhxTimePipe :timePipe="[...library_pipe]" @select="selectLibraryPipe"></QhxTimePipe>
                </div>
              </div>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs
        sticky
        panel-min-height="min(50vh, 480px)"
        :tabs="['图鉴', '大事记']"
        :tab-counts="shopContentTabCounts"
      >
        <QhxTabPanel :index="0">
          <div class=" bg-white">
            <LibraryList
              :filter_list="[{ field: 'shop_id', op: 'and', value: id }]"
              :size="'big'"
              @count-change="shopLibraryTabCount = $event"
            />
          </div>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <EventRedblack
              v-if="isActive"
              :pk_id="detail.shop_id"
              :pk_type="0"
              :can_load="isActive"
              @load="shopEventTabCount = $event"
            />
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    <LibraryPipeManage ref="libraryPipeManageRef" />
    <PhysicalShopModal
      ref="physicalShopModalRef"
      :fallback-logo="detail?.shop_logo"
    />
  </div>
</template>

<style scoped>

</style>


