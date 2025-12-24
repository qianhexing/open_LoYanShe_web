<script setup lang="ts">
import type { Library, PaginationResponse, Shop, LibraryVideo } from '@/types/api';
import { getLibraryDetail, getLibraryList, getLibraryVideo } from '@/api/library'
import html2canvas from 'html2canvas';
import QhxTag from '~/components/Qhx/Tag.vue';
import type { image } from 'html2canvas/dist/types/css/types/image';
import LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'
import { getWardrobeListOptions } from '@/api/wardrobe'
import { useToast } from '#imports'
import type { Wiki } from '@/types/api'
const user = useUserStore()
const config = useConfigStore()
const route = useRoute()
const toast = useToast()
const id = route.params.id as string
const { data } = await useAsyncData('libraryDeatil', () => {
  return getLibraryDetail({ library_id: Number.parseInt(id) })
}, {})
const library = ref<Library | null>(null)
const libraryRef = ref(null)
const shop = ref<Shop | null>(null)
const style_list = ref<Wiki[]>([])
const parent = ref<Library | null>(null)
const child_list = ref<Library[]>([])
const library_video = ref<LibraryVideo[]>([])
library.value = data.value?.library ?? null
style_list.value = data.value?.style_list ?? []
parent.value = data.value?.parent ?? null
shop.value = data.value?.shop ?? null
if (library.value && library.value?.library_type === '系列') {
  const { data } = await useAsyncData('librarys', () => {
    return getLibraryList({
      filter_list: [{
        field: 'parent_id',
        op: 'and',
        value: id
      }],
      page: 1,
      pageSize: 999
    })
  }, {})
  child_list.value = data.value?.rows ?? []
}
const fetchLibraryVideo = () => {
  const params = {
    pk_id: Number.parseInt(id)
  }
  getLibraryVideo(params)
    .then((res) => {
      library_video.value = res
    })
}
onMounted(() => {
  fetchLibraryVideo()
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
const jumpToWiki = (params: WikiParams) => {
  console.log(params)
}
useHead({
  title: library.value ? library.value.name : 'Lolita图鉴',
  meta: [
    {
      name: 'keywords',
      content: `${library.value?.name} Lo研社,Lolita图鉴,Lolita图书馆`
    },
    {
      name: 'description',
      content: '洛丽塔图书馆汇总,Lolita图书馆'
    }
  ]
})
const { captureElement: capture } = useScreenshot()
const captureScreen = async () => {
  if (libraryRef.value) {
    try {
      capture(libraryRef.value, 'my-screenshot.png')
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  }
};
const exchangeRate = (shop_country: number, price: number) => {
  if (!config.config) {
    return false
  }
  const index = config.config.money_type.findIndex((item) => {
    return item.value === shop_country
  })
  if (!price) {
    return false
  }
  if (index !== -1 && config.config.money_type[index].exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (price / config.config.exchange_rate[exchange_rate]).toFixed(2)
  }
  return false
}

// 加入衣柜相关
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const wardrobeAddLibraryRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const wardrobeCount = ref(0)
const isInWardrobe = ref(false)
const wardrobeLoading = ref(false)

// 检查是否已加入衣柜
const checkWardrobeStatus = async () => {
  if (!library.value?.library_id || !user.token) {
    return
  }
  
  wardrobeLoading.value = true
  try {
    const data = await getWardrobeListOptions({
      library_id: library.value.library_id
    })
    // 检查是否有至少一个衣柜包含该图鉴
    isInWardrobe.value = data.some(item => item.is_wardrobe !== 0 && !!item.is_wardrobe)
    // 统计已加入的衣柜数量
    wardrobeCount.value = data.filter(item => item.is_wardrobe !== 0 && !!item.is_wardrobe).length
  } catch (error) {
    console.error('检查衣柜状态失败:', error)
  } finally {
    wardrobeLoading.value = false
  }
}

// 监听衣柜添加成功事件
const handleWardrobeChange = () => {
  // 重新检查状态
  checkWardrobeStatus()
  // 更新总数
  if (library.value) {
    wardrobeCount.value = (wardrobeCount.value || 0) + 1
    isInWardrobe.value = true
  }
}

// 打开加入衣柜流程 - 第一步：选择图鉴颜色
const handleAddToWardrobe = () => {
  if (!user.token) {
    toast.add({
      title: '请先登录',
      description: '请先登录',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  if (!library.value) {
    toast.add({
      title: '图鉴信息不存在',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  libraryTypeColorChooseRef.value?.showModel(library.value)
}

// 图鉴颜色选择完成 - 第二步：打开衣柜选择组件
const handleLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddLibraryRef.value?.showModel(data)
}

// 初始化时检查状态
watch(() => library.value, (newLibrary) => {
  if (newLibrary) {
    wardrobeCount.value = newLibrary.wardrobe_count || 0
    checkWardrobeStatus()
  }
}, { immediate: true })

onMounted(() => {
  if (library.value) {
    wardrobeCount.value = library.value.wardrobe_count || 0
    checkWardrobeStatus()
  }
})
</script>
<template>
  <div class="container mx-auto p-4 max-md:p-2">
    <div v-if="library" ref="libraryRef" class="bg-qhx-bg-card rounded-lg shadow-lg" :key="library.library_id">
      <div class="p-3 flex max-md:block max-md:px-1">
        <div class="flex my-2 w-[434px] max-md:w-full relative">
          <div
            class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]"
            :class="child_list.length > 0 || parent ? 'ml-3' : ''">
            {{ library.library_type }}</div>
          <QhxPreviewImage :key="library.library_id" :list="[{ src: library.cover, alt: library.name }]" :className="child_list.length > 0 || parent ? 'cursor-pointer ml-3 w-[300px] max-md:w-0 max-md:flex-1 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'
            : 'cursor-pointer w-full ml-0 h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
          </QhxPreviewImage>
          <!-- <img :src="`${BASE_IMG}${library.cover}`" :alt="library.name"
            class=" h-[430px]  object-cover rounded-[10px] shadow-lg border border-gray-200"
            :class="child_list.length > 0 || parent ? 'ml-3 w-[300px] max-md:w-0 max-md:flex-1' : 'w-full ml-0'"
            loading="lazy" /> -->
          <div class="w-[110px] h-[430px] overflow-y-auto overflow-x-hidden library-list-wrap ml-3"
            v-if="child_list.length > 0 || parent">
            <div class="w-[100px]" v-if="child_list && child_list.length > 0">
              <nuxt-link :to="`/library/detail/${item.library_id}`" v-for="(item) in child_list" :key="item.library_id"
                class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                <div
                  class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                  {{ item.library_type }}</div>
                <img :src="`${BASE_IMG}${item.cover}`" :alt="item.name"
                  class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
              </nuxt-link>
            </div>
            <div class="w-[100px]" v-else-if="parent">
              <nuxt-link :to="`/library/detail/${parent.library_id}`"
                class="mb-[10px] relative block last:mb-[0px] cursor-pointer">
                <div
                  class=" absolute left-0 top-0 p-1 bg-qhx-primary text-qhx-inverted text-xs rounded-tl-[10px] rounded-br-[10px]">
                  {{ parent.library_type }}</div>
                <img :src="`${BASE_IMG}${parent.cover}`" :alt="parent.name"
                  class="w-[100px] h-[100px] object-cover rounded-[10px] shadow-lg" loading="lazy" />
              </nuxt-link>
            </div>
          </div>
        </div>
        <div class="m-2 flex-1">
          <div class="library-info">
            <h1 class="mb-3 text-lg font-semibold">{{ library.name }}</h1>
          </div>
          <div class="text-qhx-primary m-2 font-semibold" v-if="library.library_price">
            <div>
              参考价 {{ library.library_price }} {{ formatLabel(library.shop_country || 0, config.config?.money_type) }}
            </div>
            <div class=" text-sm" v-if="library.shop_country !== undefined && exchangeRate(library.shop_country, library.library_price)">
              汇率换算参考 <p style="color: #ffaa7f;">{{ exchangeRate(library.shop_country, library.library_price) +
                '元' }}
              </p>
            </div>
          </div>
          <!-- 信息表 -->
          <div v-if="library.size_image" class="mb-4">
            <h3 class="text-sm m-1">信息表</h3>
            <div class="flex flex-wrap my-2">
              <QhxPreviewImage
                :list="library.size_image.split(',').map((image) => { return { src: image + '?x-oss-process=image/quality,q_80/resize,w_300,h_300' } })"
                :preview="library.size_image.split(',')"
                :className="'cursor-pointer ml-3 w-[100px] h-[100px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
              </QhxPreviewImage>
            </div>
          </div>
          <!-- 主题 -->
          <div v-if="library.theme" class="mb-1">
            <h3 class="text-sm m-1">主题</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.theme.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 版型/部位 -->
          <div v-if="library.library_pattern" class="mb-1">
            <h3 class="text-sm m-1">版型/部位</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.library_pattern.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 发售时间 -->
          <div v-show="library.sale_time" class="mb-1">
            <h3 class="text-sm m-1">发售时间</h3>
            <p class="text-xs p-2">{{ library.sale_time }}</p>
          </div>
          <div v-if="style_list" class="mb-1">
            <h3 class="text-sm m-1">主要风格</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in style_list" :key="index">
                {{ tags.wiki_name }}
              </QhxTag>
            </div>
          </div>
          <!-- 颜色 -->
          <div v-if="library.color" class="mb-1">
            <h3 class="text-sm m-1">颜色</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.color.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 柄图元素 -->
          <div v-if="library.pattern_elements" class="mb-1">
            <h3 class="text-sm m-1">柄图元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.pattern_elements.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- Design Elements -->
          <div v-if="library.design_elements" class="mb-4">
            <h3 class="text-sm m-1">设计元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.design_elements.split(',')" :key="index">
                {{ tags }}
              </QhxTag>
            </div>
          </div>
          <!-- Fabric Composition -->
          <div v-if="library.fabric_composition" class="mb-4">
            <h3 class="text-sm m-1">面料成分</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.fabric_composition.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: tags.split('%').length > 1 ? tags.split('%')[1] : tags, type_id: 15 })"
                class="cursor-pointer">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 主料 -->
          <div v-if="library.cloth_elements" class="mb-4">
            <h3 class="text-sm m-1">主料</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(tags, index) in library.cloth_elements.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: tags, type_id: 5 })" class="cursor-pointer">
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 辅料/里衬 -->
          <div v-if="library.secondary_cloth" class="mb-4">
            <h3 class="text-sm m-1">辅料/里衬</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag v-for="(item, index) in library.secondary_cloth.split(',')" :key="index"
                @click="jumpToWiki({ wiki_name: item, type_id: 5 })" class="cursor-pointer">
                {{ item }}
              </QhxTag>
            </div>
          </div>

          <!-- 笔记 -->
          <div v-show="library.notes" class="mb-4">
            <h3 class="text-sm m-1">笔记</h3>
            <div class="text-xs p-2" v-html="library.notes"></div>
          </div>


          <!-- 尺码 -->
          <div v-show="library.size" class="mb-4">
            <h3 class="text-sm m-1">尺码</h3>
            <p class="text-xs p-2">{{ library.size }}</p>
          </div>
          <div class="flex justify-center">
            <div class=" flex-1 text-center">
              <UserGoodBtn :pk_type="2" :pk_id="library.library_id" :good_count="library.good_count" :need_judge="true">
              </UserGoodBtn>
            </div>
            <div class=" flex-1 text-center">
              <UserCollectBtn :collect_count="library.collect_count" :pk_type="2" :pk_id="library.library_id"
                :need_judge="true"></UserCollectBtn>
            </div>
            <div class=" flex-1 text-center">
              <div @click="handleAddToWardrobe" class="cursor-pointer inline-block">
                <div class="flex items-center">
                  <UIcon 
                    name="i-heroicons-archive-box-20-solid" 
                    class="text-[26px]"
                    :class="isInWardrobe ? 'text-[#409EFF]' : 'text-gray-500'" 
                  />
                  <div class="text-base ml-1">{{ wardrobeCount }}</div>
                </div>
              </div>
            </div>
            <!-- <div class=" flex-1 text-center">
              <UIcon :name="'i-heroicons-heart-20-solid'" class=" text-[26px] text-[#409EFF] cursor-pointer" @click="captureScreen()"/>
            </div> -->
          </div>
        </div>
      </div>
      <div v-if="shop" class="p-3 px-6">
        <ShopItem :item="shop" size="small"></ShopItem>
      </div>
    </div>
    <div v-if="library && library_video.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <div class="p-3 max-md:block">
        <h1 class="mb-3 text-lg font-semibold">人台图</h1>
        <div class="flex flex-wrap pb-3 max-md:justify-center">
          <div v-for="(item) in library_video" class="w-[100px] h-[100px] mr-3 mb-2 relative">
            <QhxPreviewImage
              :list="[{ src: item.addr.split(',')[0] + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: library.name }]"
              :preview="item.addr.split(',').map((image) => { return { src: image, title: item.title }})"
              :className="'cursor-pointer ml-3 w-[100px] h-[100px] relative  object-cover rounded-[10px] shadow-lg border border-gray-200'">
              <div class=" absolute right-[-20px] top-[-10px] w-[20px] h-[20px] flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-[50%]">{{ item.addr.split(',').length }}</div>
            </QhxPreviewImage>
          </div>
        </div>
      </div>
    </div>
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['返图']">
        <QhxTabPanel :index="0">
          <template #default="{ isActive }">
            <div class="bg-white">
              <CommunityForeignList :pk_type="7" :pk_id="library.library_id" :can_load="isActive"/>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    
    <!-- 加入衣柜相关组件 -->
    <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <WardrobeAddLibrary ref="wardrobeAddLibraryRef" @change="handleWardrobeChange" />
  </div>
</template>

<style scoped>
.library-list-wrap::-webkit-scrollbar {
  width: 6px;
  /* 垂直滚动条宽度 */
}

/* 滚动条轨道 */
.library-list-wrap::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 10px;
}

/* 滚动条滑块 */
.library-list-wrap::-webkit-scrollbar-thumb {
  background: #bbbbbb;
  border-radius: 10px;
}

/* 滚动条滑块悬停状态 */
.library-list-wrap::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>
