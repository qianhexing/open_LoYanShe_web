<script setup lang="ts">
import type { Library, PaginationResponse, Shop, LibraryVideo, LibraryPipe } from '@/types/api';
import { getLibraryDetail, getLibraryList, getLibraryVideo, getLibraryPipeListAll } from '@/api/library'
import html2canvas from 'html2canvas';
import QhxTag from '~/components/Qhx/Tag.vue';
import type { image } from 'html2canvas/dist/types/css/types/image';
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'
import { getWardrobeListOptions } from '@/api/wardrobe'
import { useToast } from '#imports'
import type { Wiki } from '@/types/api'
import dayjs from 'dayjs'
import PhysicsDrop from '@/components/PhysicsDrop.client.vue'
import { getWikiDetail, type WikiDetailParams } from '@/api/wiki'
import SPZModelViewer from '@/components/ModelViewer/SPZModelViewer.vue'
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
const library_pipe = ref<LibraryPipe[]>([])
const spzModelViewerRef = ref<{ showModel: (models: Array<{ url: string; type?: 'splat' | 'model'; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; options?: Record<string, unknown> }>) => Promise<void> } | null>(null)
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

// 根据状态返回对应的背景颜色
const getStateColor = (state: number): string => {
  switch (state) {
    case 0: // 预约中
      return '#096e00' // 蓝色
    case 1: // 尾款中
      return '#f59e0b' // 橙色
    case 2: // 截团制作
      return '#8b5cf6' // 紫色
    case 3: // 现货在售
      return '#10b981' // 绿色
    case 4: // 上新图透
      return '#ec4899' // 粉色
    default:
      return '#6b7280' // 灰色（未知状态）
  }
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

// 处理人台图点击事件
const handleVideoClick = (item: LibraryVideo) => {
  // 如果是点云类型 (pk_type === 2)，打开点云弹窗
  if (item.pk_type === 2 && item.addr) {
    const modelUrls = item.addr.split(',').filter(url => url.trim())
    const modelList = modelUrls.map((url, index) => ({
      url: url.trim(),
      type: 'splat' as const,
      position: [index * 3, 0, 0] as [number, number, number],
      options: {
        useDracoLoader: true,
        dracoDecoderPath: '/draco/gltf/'
      }
    }))
    spzModelViewerRef.value?.showModel(modelList)
  }
}
const fetchLibraryPipe = () => {
  let pk_id = Number.parseInt(id)
  if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
    pk_id = library.value?.parent_id as number
  }
  getLibraryPipeListAll({
    pk_id: pk_id,
    // end_time: dayjs().format('YYYY-MM-DD'),
    pk_type: 0
  }).then((res) => {
    if (library.value?.library_type !== '系列' && library.value?.parent_id !== 0) {
      library_pipe.value = res.filter((item) => { return item.library_list?.some((child) => child.library_id === Number.parseInt(id)) })
    } else {
      library_pipe.value = res
    }
  })
}
onMounted(() => {
  fetchLibraryVideo()
  fetchLibraryPipe()
})
interface WikiParams {
  wiki_name: string
  type_id: number
}
let uni: { navigateTo?: (options: { url: string; fail?: () => void }) => void } | undefined
onMounted(async () => {
  try {
    // @ts-ignore
    uni = await import('@dcloudio/uni-webview-js')
  } catch (err) {
    console.error('Failed to load uni-webview-js:', err)
    uni = undefined
  }
})
const port = computed(() => config.getPort())
const jumpToWiki = async (params: WikiParams) => {
  const { wiki_name, type_id } = params
  if (!wiki_name) return
  
  try {
    // 调用接口查询 wiki，获取 wiki_id
    const wikiParams: WikiDetailParams = {
      wiki_name: wiki_name.trim(),
      type_id: type_id
    }
    const wikiDetail = await getWikiDetail(wikiParams)
    
    if (!wikiDetail || !wikiDetail.wiki_id) {
      toast.add({
        title: '未找到对应的百科词条',
        icon: 'i-heroicons-exclamation-circle',
        color: 'orange'
      })
      return
    }
    
    const wikiId = typeof wikiDetail.wiki_id === 'number' 
      ? wikiDetail.wiki_id 
      : Number.parseInt(String(wikiDetail.wiki_id))
    
    if (Number.isNaN(wikiId)) {
      toast.add({
        title: '百科ID无效',
        icon: 'i-heroicons-exclamation-circle',
        color: 'red'
      })
      return
    }
    
    // 根据 wiki_id 跳转
    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus')
    
    if (isInUniApp && uni && uni.navigateTo) {
      // UniApp WebView 环境
      uni.navigateTo({
        url: `/pages/lolitaWiki/detail/${wikiId}`,
        fail: () => {
          console.log('跳转错误')
        }
      })
    } else if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'Outlink',
        params: {
          url: `https://lolitalibrary.com/lolitaWiki/detail/${wikiId}`
        }
      }))
    } else {
      // 普通网页环境
      navigateTo(`/lolitaWiki/detail/${wikiId}`)
    }
  } catch (error) {
    console.error('查询wiki失败:', error)
    toast.add({
      title: '查询百科失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
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
    // wardrobeCount.value = data.filter(item => item.is_wardrobe !== 0 && !!item.is_wardrobe).length
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
    console.log(newLibrary,'newLibrary')
    wardrobeCount.value = newLibrary.wardrobe_count || 0
    checkWardrobeStatus()
  }
}, { immediate: true })

onMounted(() => {
  if (library.value) {
    console.log(library.value.wardrobe_count,'初始化时检查状态')
    
    wardrobeCount.value = library.value.wardrobe_count || 0
    checkWardrobeStatus()
  }
})
const jumpToLibraryHistory = () => {
  window.open(`/library/history?library_id=${library.value?.library_id}`, '_blank')
}
const handleEditLibrary = () => {
  window.open(`/addLibrary?library_id=${library.value?.library_id}`, '_blank')
}
const jumpToLibraryVideoManage = () => {
  if (!library.value?.library_id) return
  window.open(`/library/manageVideo/${library.value.library_id}`, '_blank')
}

// PhysicsDrop 组件相关 - 从接口返回的 model_list 动态生成
interface LibraryModelItem {
  foreign_id: number
  pk_type: number
  pk_id: number
  materia_id: number
  create_time: string
  is_enable: number
  material_box?: {
    materia_id: number
    user_id: number
    pk_type: number
    pk_id: number
    create_time: string
    is_enable: number
    is_private: number
    materia_url: string
    materia_title: string
    cover: string | null
    options?: {
      useDracoLoader?: boolean
      [key: string]: unknown
    }
  }
}

const physicsDropModels = computed(() => {
  // 没有图鉴或没有模型列表时不展示
  const modelList = (library.value as Library & { model_list?: LibraryModelItem[] })?.model_list
  if (!library.value || !Array.isArray(modelList)) {
    return []
  }

  // model_list 示例：
  // [
  //   {
  //     foreign_id: 1,
  //     pk_type: 0,
  //     pk_id: 43,
  //     materia_id: 13,
  //     create_time: '2026-02-03T08:48:09.000Z',
  //     is_enable: 0,
  //     material_box: {
  //       materia_id: 13,
  //       user_id: 1,
  //       pk_type: 1,
  //       pk_id: 0,
  //       create_time: '2026-01-01T05:46:51.000Z',
  //       is_enable: 0,
  //       is_private: 0,
  //       materia_url: '/sence/13.glb',
  //       materia_title: '叶子',
  //       cover: null,
  //       options: { useDracoLoader: true }
  //     }
  //   }
  // ]

  return modelList
    // 只取启用并且有 material_box 的数据
    .filter((item): item is LibraryModelItem & { material_box: NonNullable<LibraryModelItem['material_box']> } => {
      return !!item && item.is_enable === 0 && !!item.material_box && !!item.material_box.materia_url
    })
    // 格式化成 PhysicsDrop 组件需要的结构
    .map((item) => ({
      url: item.material_box.materia_url,
      id: item.materia_id ?? item.material_box.materia_id,
      name: item.material_box.materia_title,
      options: item.material_box.options || { useDracoLoader: true }
    }))
})

const handleObjectClick = (data: { url: string; name: string; id: string | number }) => {
  console.log('点击了物体:', data)
  toast.add({
    title: `点击了: ${data.name}`,
    description: `ID: ${data.id}`,
    icon: 'i-heroicons-information-circle',
    color: 'blue'
  })
}

// PhysicsDrop 显示/隐藏控制
const PHYSICS_DROP_VISIBLE_KEY = 'physicsDropVisible'
// 从 localStorage 读取初始状态，默认显示
const getInitialVisibility = (): boolean => {
  if (import.meta.client) {
    const savedState = localStorage.getItem(PHYSICS_DROP_VISIBLE_KEY)
    return savedState !== null ? savedState === 'true' : true
  }
  return true
}
const isPhysicsDropVisible = ref(getInitialVisibility())

// 切换显示/隐藏状态
const togglePhysicsDrop = () => {
  isPhysicsDropVisible.value = !isPhysicsDropVisible.value
  if (import.meta.client) {
    localStorage.setItem(PHYSICS_DROP_VISIBLE_KEY, String(isPhysicsDropVisible.value))
  }
}
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
          <div>
            <QhxTag class="cursor-pointer" v-if="library.examin !== 1" @click="handleEditLibrary" :active="true" color="blue">
              申请纠错
            </QhxTag>
            <QhxTag class="cursor-pointer" v-else :active="true" color="blue">
              已被锁定
            </QhxTag>
            <QhxTag class="cursor-pointer" @click="jumpToLibraryHistory" :active="true" color="blue">
              修改历史
            </QhxTag>
            <!-- v-if="user.hasPermi('library:detail:update')" -->
            <QhxTag class="cursor-pointer" @click="jumpToLibraryVideoManage"  :active="true" color="blue">
              管理人台图
            </QhxTag>
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
          <div v-if="library.state === '预约中'" class="mb-4">
            <h3 class="text-sm m-1">预约时间</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ dayjs(library.start_time).format('YYYY-MM-DD HH:mm') }}</QhxTag>
              <span>-</span>
              <QhxTag :active="true">{{ dayjs(library.end_time).format('YYYY-MM-DD HH:mm') }}</QhxTag>
            </p>
          </div>
          <div v-else-if="library.state === '尾款中'" class="mb-4">
            <h3 class="text-sm m-1">尾款时间</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ dayjs(library.arrears_start).format('YYYY-MM-DD HH:mm') }}</QhxTag>
              <span>-</span>
              <QhxTag :active="true">{{ dayjs(library.arrears_end).format('YYYY-MM-DD HH:mm') }}</QhxTag>
            </p>
          </div>
          <div v-else class="mb-4">
            <h3 class="text-sm m-1">状态</h3>
            <p class="text-xs">
              <QhxTag :active="true">{{ library.state }}</QhxTag>
            </p>
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
              <QhxTag
                v-for="(tags, index) in library.theme.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 14 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- 版型/部位 -->
          <div v-if="library.library_pattern" class="mb-1">
            <h3 class="text-sm m-1">版型/部位</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.library_pattern.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 1 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
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
              <QhxTag
                v-for="(tags, index) in library.pattern_elements.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 3 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {{ tags }}
              </QhxTag>
            </div>
          </div>

          <!-- Design Elements -->
          <div v-if="library.design_elements" class="mb-4">
            <h3 class="text-sm m-1">设计元素</h3>
            <div class="flex flex-wrap gap-2">
              <QhxTag
                v-for="(tags, index) in library.design_elements.split(',')"
                :key="index"
                @click="jumpToWiki({ wiki_name: tags.trim(), type_id: 2 })"
                class="cursor-pointer hover:opacity-80 transition-opacity"
              >
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
            <!-- <div class="text-xs p-2" v-html="library.notes"></div> -->
            <ClientOnly>
              <SafeRichText v-if="library.notes" :nodes="parseRichText(library.notes.replace(/\n/g, '<br>'))" />
            </ClientOnly>
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
                    name="hugeicons:wardrobe-04" 
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
      <div class="flex flex-wrap my-2" v-if="library?.detail_image">
        <QhxPreviewImage
          :list="library.detail_image.split(',').map((image) => { return { src: image + '?x-oss-process=image/quality,q_80/resize,w_300,h_300' } })"
          :preview="library.detail_image.split(',')"
          :className="'cursor-pointer ml-3 w-[100px] h-[100px]  object-cover rounded-[10px] shadow-lg border border-gray-200'">
        </QhxPreviewImage>
      </div>
      <div v-if="shop" class="p-3 px-6">
        <ShopItem :item="shop" size="small"></ShopItem>
      </div>
    </div>
    <div v-if="library && library_video.length > 0" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <div class="p-3 max-md:block">
        <h1 class="mb-3 text-lg font-semibold">人台图</h1>
        <div class="flex flex-wrap pb-3 max-md:justify-center">
          <div v-for="(item) in library_video" :key="item.video_id" class="w-[100px] mr-3 mb-2">
            <div class="relative">
              <!-- 点云类型：点击打开点云弹窗 -->
              <div
                v-if="item.pk_type === 2"
                @click="handleVideoClick(item)"
                class="cursor-pointer ml-3 w-[100px] h-[100px] relative object-cover rounded-[10px] shadow-lg border border-gray-200 overflow-hidden"
              >
                <img
                  v-if="item.cover"
                  :src="BASE_IMG + item.cover + '?x-oss-process=image/quality,q_80/resize,w_300,h_300'"
                  :alt="item.title || library.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <UIcon name="i-heroicons-cube" class="w-8 h-8 text-gray-400" />
                </div>
                <div class="absolute left-[0px] top-[0px] px-1.5 py-0.5 flex justify-center items-center bg-qhx-primary text-[10px] text-qhx-inverted rounded-[4px] font-semibold">
                  3D
                </div>
                <div v-if="item.addr" class="absolute right-[-20px] top-[-10px] w-[20px] h-[20px] flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-[50%]">
                  {{ item.addr.split(',').length }}
                </div>
              </div>
              <!-- 普通类型：使用预览图片组件，优先使用 cover 字段 -->
              <QhxPreviewImage
                v-else
                :list="[{ src: (item.cover || item.addr?.split(',')[0] || '') + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: item.title || library.name }]"
                :preview="item.cover ? [item.cover] : (item.addr ? item.addr.split(',').map((image) => ({ src: image, title: item.title })) : [])"
                :className="'cursor-pointer ml-3 w-[100px] h-[100px] relative  object-cover rounded-[10px] shadow-lg border border-gray-200'">
                <div v-if="item.addr" class=" absolute right-[-20px] top-[-10px] w-[20px] h-[20px] flex justify-center items-center bg-qhx-primary text-xs text-qhx-inverted rounded-[50%]">{{ item.addr.split(',').length }}</div>
              </QhxPreviewImage>
            </div>
            <div v-if="item.title" class="ml-3 mt-2 text-xs text-gray-600 dark:text-gray-400 truncate" :title="item.title">{{ item.title }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- SPZ模型查看器弹窗 -->
    <SPZModelViewer ref="spzModelViewerRef" />
    <div v-if="library" class="bg-qhx-bg-card rounded-lg shadow-lg mt-3">
      <QhxTabs :tabs="['返图', '贩售历史']">
        <QhxTabPanel :index="0">
          <template #default="{ isActive }">
            <div class="bg-white">
              <CommunityForeignList :pk_type="7" :pk_id="library.library_id" :can_load="isActive"/>
            </div>
          </template>
        </QhxTabPanel>
        <QhxTabPanel :index="1">
          <template #default="{ isActive }">
            <div class="bg-white" v-if="isActive">
              <div v-if="library_pipe.length > 0" class="p-4 space-y-3">
                <h3 class="text-base font-semibold mb-1">图鉴状态流</h3>
                <div
                  v-for="pipe in library_pipe"
                  :key="pipe.pipe_id"
                  class="rounded-xl border border-gray-100 bg-gradient-to-r from-white to-gray-50/60 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div class="px-2 py-3 flex items-center justify-between border-b border-gray-50">
                    <div class="flex items-center gap-2">
                      <QhxTag :active="true" :backgroundColor="getStateColor(pipe.state || 0)">
                        <span class="text-xs">{{ formateState(pipe.state || 0) }}</span>
                      </QhxTag>
                      <span class="text-xs text-gray-500">
                        {{ dayjs(pipe.start_time).format('YY-MM-DD') }} - {{ dayjs(pipe.end_time).format('YY-MM-DD') }}
                      </span>
                    </div>
                  </div>
                  <div class="px-4 py-3 flex gap-3 items-start">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="w-[36px] h-[36px] rounded-[50%] flex-shrink-0">
                          <QhxPreviewImage
                            v-if="pipe.library?.cover"
                            :list="[{ src: pipe.library.cover + '?x-oss-process=image/quality,q_80/resize,w_300,h_300', alt: pipe.library.name }]"
                            :preview="[pipe.library.cover]"
                            :className="'w-[36px] h-[36px] rounded-xl object-cover shadow-sm border border-gray-200 cursor-pointer'"
                          />
                        </div>
                        <span class="text-sm font-medium text-gray-800 truncate">
                          {{ pipe.library?.name || library.name }}
                        </span>
                      </div>
                      <p v-if="pipe.note" class="text-xs p-2 text-gray-600 line-clamp-2">
                        备注：{{ pipe.note }}
                      </p>
                      <div
                        v-if="pipe.library_list && pipe.library_list.length > 0"
                        class="mt-2"
                      >
                        <div class="text-xs font-medium text-gray-700 mb-1">
                          包含版型
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <div
                            v-for="child in pipe.library_list"
                            :key="child.library_id"
                            class="flex items-center gap-2  rounded-full px-2 py-1 shadow-sm border border-gray-100"
                            :class="child.library_id === Number.parseInt(id) ? 'bg-qhx-primary text-qhx-inverted' : 'bg-white/80'"
                          >
                            <div class="w-[24px] h-[24px] rounded-full overflow-hidden flex-shrink-0">
                              <QhxPreviewImage
                                v-if="child.cover"
                                :list="[{ src: child.cover + '?x-oss-process=image/quality,q_80/resize,w_200,h_200', alt: child.name }]"
                                :preview="[child.cover]"
                                :className="'w-[24px] h-[24px] rounded-full object-cover cursor-pointer'"
                              />
                            </div>
                            <span class="text-[11px]">
                              {{ child.library_type }}
                              <span v-if="child.library_pattern">· {{ child.library_pattern }}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="p-6 text-center text-gray-500 text-sm">
                暂无状态流
              </div>
            </div>
          </template>
        </QhxTabPanel>
      </QhxTabs>
    </div>
    
    <!-- 加入衣柜相关组件 -->
    <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <WardrobeAddLibrary ref="wardrobeAddLibraryRef" @change="handleWardrobeChange" />
    
    <!-- 物理掉落组件 -->
    <ClientOnly>
      <PhysicsDrop 
        v-if="isPhysicsDropVisible && physicsDropModels.length > 0"
        :models="physicsDropModels"
        @object-click="handleObjectClick"
      />
    </ClientOnly>
    
    <!-- 悬浮开关按钮 -->
    <div class="fixed bottom-8 left-8 z-50 pointer-events-none" v-if="library && physicsDropModels.length > 0">
      <button
        @click="togglePhysicsDrop"
        class="pointer-events-auto bg-gray-900/80 dark:bg-white/80 backdrop-blur-md text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 transform transition-all duration-300 hover:scale-105 active:scale-95 group"
      >
        <UIcon
          :name="isPhysicsDropVisible ? 'weui:eyes-on-filled' : 'weui:eyes-off-filled'"
          class="text-[16px] group-hover:rotate-12 transition-transform"
        />
        <span class="text-sm font-semibold">{{ isPhysicsDropVisible ? '关闭掉落' : '开启掉落' }}</span>
      </button>
    </div>
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
