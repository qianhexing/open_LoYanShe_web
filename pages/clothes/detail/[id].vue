<script setup lang="ts">
import type { WardrobeClothes, Library, Shop, Wardrobe } from '@/types/api'

// 扩展 WardrobeClothes 类型以包含关联数据
interface ExtendedWardrobeClothes extends WardrobeClothes {
  library?: Library
  wardrobe?: Wardrobe
  origin_shop?: Shop
  plan?: {
    plan_id?: number
    [key: string]: unknown
  }
  sence_id?: number
  image_list?: string[]
}
import { getClothesDetail, updateClothes, deteleClothes } from '@/api/wardrobe'
import type ClothesAdd from '@/components/Clothes/ClothesAdd.vue'
import type QhxSelect from '@/components/Qhx/Select.vue'
import { BASE_IMG } from '@/utils/ipConfig'
let uni: any;
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
const isMobile = computed(() => configStore.isMobile)
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const route = useRoute()
const router = useRouter()
const config = useConfigStore()
const user = useUserStore()
const toast = useToast()
const id = route.params.id as string

const detail = ref<ExtendedWardrobeClothes | null>(null)
const currentTab = ref(0)
const sortMode = ref(false)
const showDeleteModal = ref(false)
const showDeleteLinkModal = ref(false)
const showAddClothesModal = ref(false)
const showAddMemoryModal = ref(false)
const showChooseCommunityModal = ref(false)
const showDeleteCommunityModal = ref(false)
const selectedClothes = ref<WardrobeClothes | null>(null)
const selectedCommunity = ref<{ community_id: number;[key: string]: unknown } | null>(null)
const memoryCount = ref(0)
const matchingCount = ref(0)

// 组件引用
const addEditClothesRef = ref<InstanceType<typeof ClothesAdd> | null>(null)
const numSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const timesSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

// 数字选择器选项
const numOptions = Array.from({ length: 100 }, (_, i) => ({
  label: `${i + 1}`,
  value: i + 1
}))

const timesOptions = Array.from({ length: 1000 }, (_, i) => ({
  label: `${i}`,
  value: i
}))

const fetchClothesDetail = async () => {
  try {
    const response = await getClothesDetail({ clothes_id: Number.parseInt(id) })
    const data = response
    if (data) {
      if (data.detail_image) {
        data.detail_image_list = data.detail_image.split(',')
      } else {
        data.detail_image_list = []
      }
      if (data.main_style && data.main_style !== '' && config.config?.main_style) {
        const mian_style_option = config.config?.main_style
        const main_style_list: { label: string; value: number }[] = []
        data.main_style.split(',').map((item) => {
          const index = mian_style_option.findIndex((element) => {
            return element.value === Number.parseInt(item)
          })
          if (index !== -1 && mian_style_option[index]) {
            main_style_list.push(mian_style_option[index] as { label: string; value: number })
          }
        })
        data.main_style_list = main_style_list
      } else {
        data.main_style_list = []
      }
      if (data.include_clothes && data.include_clothes !== '' && data.include && data.include.length > 0) {
        const include: WardrobeClothes[] = []
        for (const idStr of data.include_clothes.split(',')) {
          if (!data.include) continue
          const index = data.include.findIndex((child) => {
            return child.clothes_id === Number.parseInt(idStr)
          })
          if (index !== -1) {
            include.push(data.include[index])
          }
        }
        data.include = include
      }
    }
    detail.value = data
  } catch (error) {
    console.error('获取服饰详情失败:', error)
    toast.add({
      title: '获取详情失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 判断是否是当前用户拥有的服饰
const isOwner = computed(() => {
  return detail.value?.wardrobe && detail.value.wardrobe.user_id === user.user?.user_id
})

// 编辑服饰
const editClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item)
  }
}

// 复制服饰
const copyClothes = () => {
  if (addEditClothesRef.value && detail.value) {
    const item = {
      ...detail.value,
      wardrobe_name: detail.value.wardrobe?.wardrobe_name
    }
    addEditClothesRef.value.showModel(item, true)
  }
}

// 删除服饰
const confirmDelete = async () => {
  if (!detail.value) return
  try {
    await deteleClothes({
      clothes_id: detail.value.clothes_id
    })
    toast.add({
      title: '删除成功',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })

    const isInUniApp =
      typeof window !== 'undefined' &&
      navigator.userAgent.includes('Html5Plus');
    if (isInUniApp && typeof uni !== 'undefined' && uni.navigateBack) {
      uni.navigateBack()
    } else {
      if (port.value) {
        port.value.postMessage(JSON.stringify({
          type: 'BackAndReload'
        }))
      } else {
        router.back()
      }
    }
  } catch (error) {
    toast.add({
      title: '删除失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteModal.value = false
  }
}

// 设置最爱
const setFavorite = async (is_favorite: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      is_favorite
    })
    if (detail.value) {
      detail.value.is_favorite = is_favorite
    }
    toast.add({
      title: is_favorite === 1 ? '已设为最爱' : '已取消最爱',
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  }
}

// 更新数量
const updateNum = async (num: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      num
    })
    if (detail.value) {
      detail.value.num = num
    }
  } catch (error) {
    console.error('更新数量失败:', error)
  }
}

// 更新穿着次数
const updateTimes = async (times: number) => {
  if (!detail.value || !isOwner.value) return
  try {
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      times
    })
    if (detail.value) {
      detail.value.times = times
    }
  } catch (error) {
    console.error('更新穿着次数失败:', error)
  }
}

// 跳转到图鉴详情
const jumpToLibrary = (library: Library) => {
  router.push(`/library/detail/${library.library_id}`)
}

// 跳转到店铺详情
const jumpToShop = (shop_id: number) => {
  router.push(`/shop/detail/${shop_id}`)
}

// 跳转到关联服饰详情
const jumpToClothes = (item: WardrobeClothes) => {
  router.push(`/clothes/detail/${item.clothes_id}`)
}

// 跳转到衣柜
const jumpToWardrobe = () => {
  if (detail.value?.wardrobe_id && detail.value.wardrobe?.user_id) {
    router.push(`/wardrobe/detail/${detail.value.wardrobe.user_id}?wardrobe_id=${detail.value.wardrobe_id}`)
  }
}

// 格式化日期
const formatDate = (date: Date | string | undefined) => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN')
}

// 格式化货币标签
type MoneyType = { value: number; label: string; exchange_rate?: string }
const formatLabel = (shop_country: number | undefined, money_type: MoneyType[]) => {
  if (!shop_country || !money_type) return ''
  const item = money_type.find((m) => m.value === shop_country)
  return item ? item.label : ''
}

// 汇率换算
const exchangeRate = (shop_country: number | undefined, price: number | undefined): string | false => {
  if (!shop_country || !price || !config.config) return false
  const index = config.config.money_type.findIndex((item) => {
    return item.value === shop_country
  })
  if (index !== -1 && config.config.money_type[index]?.exchange_rate) {
    const exchange_rate = config.config.money_type[index].exchange_rate
    if (!config.config.exchange_rate[exchange_rate]) {
      return false
    }
    return (Number.parseFloat(String(price)) / Number.parseFloat(String(config.config.exchange_rate[exchange_rate]))).toFixed(2)
  }
  return false
}

// 预览图片（由 QhxPreviewImage 组件处理）

// 删除关联服饰
const deleteLinkClothes = async () => {
  if (!detail.value || !selectedClothes.value) return
  try {
    let include_clothes: string[] = []
    if (detail.value.include_clothes) {
      include_clothes = detail.value.include_clothes.split(',')
    }
    if (!selectedClothes.value) return
    const index = include_clothes.findIndex((item) => {
      return Number.parseInt(item, 10) === selectedClothes.value.clothes_id
    })
    if (index !== -1) {
      include_clothes.splice(index, 1)
      await updateClothes({
        clothes_id: detail.value.clothes_id,
        include_clothes: include_clothes.length === 0 ? null : include_clothes.join(',')
      })
      await fetchClothesDetail()
      toast.add({
        title: '取消关联成功',
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }
  } catch (error) {
    toast.add({
      title: '操作失败',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
  } finally {
    showDeleteLinkModal.value = false
    selectedClothes.value = null
  }
}

// 上移关联服饰
const upItem = async (index: number) => {
  if (index === 0 || !detail.value || !detail.value.include_clothes) return
  try {
    const include_clothes = detail.value.include_clothes.split(',')
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index - 1]
    include_clothes[index - 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('上移失败:', error)
  }
}

// 下移关联服饰
const downItem = async (index: number) => {
  if (!detail.value || !detail.value.include || index >= detail.value.include.length - 1) return
  try {
    const include_clothes = detail.value.include_clothes?.split(',') || []
    const temp = include_clothes[index]
    include_clothes[index] = include_clothes[index + 1]
    include_clothes[index + 1] = temp
    await updateClothes({
      clothes_id: detail.value.clothes_id,
      include_clothes: include_clothes.join(',')
    })
    await fetchClothesDetail()
  } catch (error) {
    console.error('下移失败:', error)
  }
}

// 编辑成功回调
const onEditSuccess = () => {
  fetchClothesDetail()
}

// 记忆数量更新
const onMemoryCountChange = (count: number) => {
  memoryCount.value = count
}

// 搭配数量更新
const onMatchingCountChange = (count: number) => {
  matchingCount.value = count
}

onMounted(async () => {
  setTimeout(async () => {
    await fetchClothesDetail()
  })
})

useHead({
  title: detail.value?.clothes_note || '服饰详情',
  meta: [
    {
      name: 'keywords',
      content: `${detail.value?.clothes_note || ''} Lo研社,Lolita服饰,Lolita衣柜`
    },
    {
      name: 'description',
      content: detail.value?.clothes_note || 'Lolita服饰详情'
    }
  ]
})
const jumpToScene = (sence_id: number) => {
  const sceneUrl = `/scene/detail/${sence_id}?edit=1`
  const fullUrl = `https://lolitalibrary.com${sceneUrl}`
  
  const isInUniApp =
    typeof window !== 'undefined' &&
    navigator.userAgent.includes('Html5Plus');
  
  if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
    // UniApp WebView 环境 - 使用 outerlink
    uni.navigateTo({
      url: `/pages/common/outerLink?url=${fullUrl}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
  } else if (port.value) {
    // 鸿蒙系统 - 使用 outerlink
    port.value.postMessage(JSON.stringify({
      type: 'jump',
      path: 'Outlink',
      params: {
        url: fullUrl
      }
    }))
  } else {
    // 普通浏览器环境
    window.open(sceneUrl, '_blank')
  }
}
</script>

<template>
  <div>
    <clothes-add ref="addEditClothesRef" @success="onEditSuccess"></clothes-add>

    <!-- 有场景ID时的布局：全屏背景 + 可拖拽半模态框 -->
    <template v-if="detail && detail.sence_id">
      <!-- 全屏场景背景 -->
      <div class="fixed inset-0 w-screen h-screen z-0">
        <iframe :src="`https://lolitalibrary.com/scene/detail/${detail.sence_id}`" class="w-full h-full border-0"
          frameborder="0"></iframe>
      </div>

      <!-- 可拖拽的半模态框 -->
      <QhxBottomDrawer :direction="isMobile ? 'bottom' : 'right'">
        <div v-if="detail" class="bg-qhx-bg-card">
          <!-- 标签页 -->
          <QhxTabs :tabs="['基本信息', '记忆']" @change="(index) => currentTab = index">
            <!-- 基本信息标签页 -->
            <QhxTabPanel :index="0">
              <template #default="{ isActive }">
                <div v-show="isActive" class="py-2">
                  <!-- 标题和操作按钮 -->
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold flex-1">
                      {{ detail.clothes_note || '暂无名称' }}
                    </h2>
                    <div v-if="isOwner" class="flex gap-2 ml-2">
                      <QhxJellyButton>

                        <div class="h-[60px] text-center px-[1px]  cursor-pointer">
                          <div
                            class="bg-qhx-primary my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                             @click="jumpToScene(detail.sence_id)">
                            <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">编辑场景</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-[1px  cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="copyClothes">
                            <UIcon name="i-heroicons-document-duplicate" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">复制</div>
                        </div>
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-[1px  cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="editClothes">
                            <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">修改</div>
                        </div>
                        
                      </QhxJellyButton>
                      <QhxJellyButton>
                        <div class="h-[60px] text-center px-[1px  cursor-pointer">
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            @click="showDeleteModal = true">
                            <UIcon name="i-heroicons-trash" class="text-[22px] text-[#ffffff]" />
                          </div>
                          <div class=" text-[12px]">删除</div>
                        </div>
                      </QhxJellyButton>
                    </div>
                  </div>

                  <!-- 信息内容 -->
                  <div class="space-y-3">
                    <!-- 笔记 -->
                    <div v-if="detail.note" class="text-sm text-gray-600">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 是否最爱 -->
                    <div v-if="detail.is_favorite !== undefined" class="flex items-center gap-2">
                      <span class="text-sm">是否最爱：</span>
                      <button v-if="isOwner" @click="setFavorite(detail.is_favorite === 1 ? 0 : 1)" class="text-2xl"
                        :class="detail.is_favorite === 1 ? 'text-red-500' : 'text-gray-300'">
                        <UIcon name="i-heroicons-heart-solid" />
                      </button>
                      <span v-else class="text-sm">
                        {{ detail.is_favorite === 1 ? '是' : '否' }}
                      </span>
                    </div>

                    <!-- 状态 -->
                    <div v-if="detail.wardrobe_status" class="text-sm">
                      状态：{{ detail.wardrobe_status }}
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span class="text-sm">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.num" type="number" :min="1" class="w-20"
                          @blur="updateNum(detail.num || 1)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price" class="text-sm">
                      价格：￥{{ detail.price }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" class="text-sm">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span class="text-sm">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.times" type="number" :min="0" class="w-20"
                          @blur="updateTimes(detail.times || 0)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" class="text-sm">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" class="text-sm">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" class="text-sm">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>

                    <!-- 来源 -->
                    <div v-if="!detail.library && !detail.origin_shop && detail.origin" class="text-sm">
                      来源：{{ detail.origin }}
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div class="font-semibold">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" class="text-sm mb-2">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" class="text-sm mb-2">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 来源店铺 -->
                    <div v-if="detail.origin_shop" class="border-t pt-3 mt-3">
                      <h3 class="text-lg font-semibold mb-3">来源店铺</h3>
                      <div class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                        @click="jumpToShop(detail.origin_shop!.shop_id)">
                        <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.origin_shop.shop_name" />
                        <div class="font-semibold">{{ detail.origin_shop.shop_name }}</div>
                      </div>
                    </div>

                    <!-- 详情图片列表 -->
                    <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                      <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                        :list="[{ src: img, alt: detail.clothes_note || '' }]" :preview="detail.detail_image_list"
                        className="w-full rounded-lg" />
                    </div>

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <UButton color="primary" @click="jumpToWardrobe">查看该衣柜</UButton>
                    </div>
                  </div>
                </div>
              </template>
            </QhxTabPanel>

            <!-- 记忆标签页 -->
            <QhxTabPanel :index="1">
              <template #default="{ isActive }">
                <div v-if="isActive" class="py-2">
                  <div class="text-sm text-gray-500 text-center mb-4">
                    发帖记录你与小裙子之间的美好记忆
                  </div>
                  <CommunityForeignList :pk_type="2" :pk_id="Number.parseInt(id, 10)" />
                </div>
              </template>
            </QhxTabPanel>
          </QhxTabs>
        </div>
      </QhxBottomDrawer>
    </template>

    <!-- 没有场景ID时的原有布局 -->
    <div v-else class="container mx-auto p-4 max-md:p-2">
      <div v-if="detail" class="bg-qhx-bg-card rounded-lg shadow-lg">
        <!-- 标签页 -->
        <QhxTabs :tabs="['基本信息', '记忆']" @change="(index) => currentTab = index">
          <!-- 基本信息标签页 -->
          <QhxTabPanel :index="0">
            <template #default="{ isActive }">
              <div v-show="isActive" class="p-4 max-md:p-2">
                <!-- 图片区域 -->
                <div class="flex max-md:block gap-4 mb-4">
                  <!-- 主图 -->
                  <div class="flex-1">
                    <div v-if="detail.include && detail.include.length > 0" class="mb-4">
                      <div class="grid grid-cols-3 gap-2">
                        <div class="col-span-2">
                          <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                            :preview="[detail.clothes_img]" className="w-full aspect-[3/4] object-cover rounded-lg" />
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, index) in detail.include" :key="item.clothes_id" class="relative">
                            <QhxPreviewImage :list="[{ src: item.clothes_img, alt: item.clothes_note || '' }]"
                              :preview="[item.clothes_img]" className="w-full aspect-square object-cover rounded-lg" />
                            <div v-if="isOwner && sortMode"
                              class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer"
                              @click.stop="selectedClothes = item; showDeleteLinkModal = true">
                              <UIcon name="i-heroicons-x-mark" class="text-xs" />
                            </div>
                            <div v-if="isOwner && sortMode && index < detail.include.length - 1"
                              class="absolute top-1/2 -right-1 -translate-y-1/2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                              @click.stop="downItem(index)">
                              <UIcon name="i-heroicons-arrow-right" class="text-xs" />
                            </div>
                            <div v-if="isOwner && sortMode && index !== 0"
                              class="absolute top-1/2 -left-1 -translate-y-1/2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                              @click.stop="upItem(index)">
                              <UIcon name="i-heroicons-arrow-left" class="text-xs" />
                            </div>
                            <div class="text-xs text-center mt-1 cursor-pointer" @click="jumpToClothes(item)">
                              {{ item.clothes_note || item.library?.name || '' }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-else-if="detail.clothes_part && detail.clothes_part.split(',').length > 1 && detail.detail_image_list && detail.detail_image_list.length > 0"
                      class="mb-4">
                      <div class="grid grid-cols-3 gap-2">
                        <div class="col-span-2">
                          <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                            :preview="[detail.clothes_img]" className="w-full aspect-[3/4] object-cover rounded-lg" />
                        </div>
                        <div class="space-y-2">
                          <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                            :list="[{ src: img, alt: detail.clothes_note || '' }]" :preview="[img]"
                            className="w-full aspect-square object-cover rounded-lg" />
                        </div>
                      </div>
                    </div>
                    <div v-else>
                      <QhxPreviewImage :list="[{ src: detail.clothes_img, alt: detail.clothes_note || '' }]"
                        :preview="[detail.clothes_img]" className="w-full aspect-[3/4] object-cover rounded-lg" />
                    </div>
                  </div>

                  <!-- 信息区域 -->
                  <div class="flex-1 space-y-3">
                    <!-- 标题和操作按钮 -->
                    <div class="flex items-start justify-between">
                      <h2 class="text-xl font-bold flex-1">
                        {{ detail.clothes_note || '暂无名称' }}
                      </h2>
                      <div v-if="isOwner" class="flex gap-2 ml-2">
                        <QhxJellyButton>
                          <!-- 排序 -->
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            :class="sortMode ? 'bg-red-500' : 'bg-qhx-primary'" @click="sortMode = !sortMode">
                            <UIcon name="i-heroicons-bars-3-bottom-left" class="text-[22px] text-[#ffffff]" />
                          </div>
                        </QhxJellyButton>

                        <QhxJellyButton>
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            :class="sortMode ? 'bg-red-500' : 'bg-qhx-primary'" @click="copyClothes">
                            <UIcon name="i-heroicons-document-duplicate" class="text-[22px] text-[#ffffff]" />
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            :class="sortMode ? 'bg-red-500' : 'bg-qhx-primary'" @click="editClothes">
                            <UIcon name="i-heroicons-pencil-square" class="text-[22px] text-[#ffffff]" />
                          </div>
                        </QhxJellyButton>
                        <QhxJellyButton>
                          <div
                            class="my-[5px] mx-auto text-white rounded-[50%] h-[30px] w-[30px] bg-qhx-primary flex items-center justify-center cursor-pointer"
                            :class="sortMode ? 'bg-red-500' : 'bg-qhx-primary'" @click="showDeleteModal = true">
                            <UIcon name="i-heroicons-trash" class="text-[22px] text-[#ffffff]" />
                          </div>
                        </QhxJellyButton>
                      </div>
                    </div>

                    <!-- 笔记 -->
                    <div v-if="detail.note" class="text-sm text-gray-600">
                      笔记：{{ detail.note }}
                    </div>

                    <!-- 是否最爱 -->
                    <div v-if="detail.is_favorite !== undefined" class="flex items-center gap-2">
                      <span class="text-sm">是否最爱：</span>
                      <button v-if="isOwner" @click="setFavorite(detail.is_favorite === 1 ? 0 : 1)" class="text-2xl"
                        :class="detail.is_favorite === 1 ? 'text-red-500' : 'text-gray-300'">
                        <UIcon name="i-heroicons-heart-solid" />
                      </button>
                      <span v-else class="text-sm">
                        {{ detail.is_favorite === 1 ? '是' : '否' }}
                      </span>
                    </div>

                    <!-- 状态 -->
                    <div v-if="detail.wardrobe_status" class="text-sm">
                      状态：{{ detail.wardrobe_status }}
                    </div>

                    <!-- 拥有数量 -->
                    <div v-if="detail.num !== undefined && detail.num !== null" class="flex items-center gap-2">
                      <span class="text-sm">拥有数量：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.num" type="number" :min="1" class="w-20"
                          @blur="updateNum(detail.num || 1)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.num }}</span>
                    </div>

                    <!-- 风格 -->
                    <div v-if="detail.main_style_list && detail.main_style_list.length > 0"
                      class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">风格：</span>
                      <QhxTag v-for="(style, index) in detail.main_style_list" :key="index" :active="true">
                        {{ style.label }}
                      </QhxTag>
                    </div>

                    <!-- 价格 -->
                    <div v-if="detail.price" class="text-sm">
                      价格：￥{{ detail.price }}
                    </div>

                    <!-- 尺码 -->
                    <div v-if="detail.size" class="text-sm">
                      尺码：{{ detail.size }}
                    </div>

                    <!-- 穿着次数 -->
                    <div v-if="detail.times !== undefined && detail.times !== null" class="flex items-center gap-2">
                      <span class="text-sm">穿着次数：</span>
                      <div v-if="isOwner" class="flex items-center gap-2">
                        <UInput v-model.number="detail.times" type="number" :min="0" class="w-20"
                          @blur="updateTimes(detail.times || 0)" :ui="{
                            base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
                            rounded: 'rounded-full',
                            padding: { xs: 'px-4 py-2' },
                            color: {
                              white: {
                                outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
                              }
                            }
                          }" />
                      </div>
                      <span v-else class="text-sm">{{ detail.times }}</span>
                    </div>

                    <!-- 次均价格 -->
                    <div v-if="detail.times && detail.times > 0 && detail.price" class="text-sm">
                      次均价格：￥{{ (detail.price / detail.times).toFixed(2) }}
                    </div>

                    <!-- 颜色 -->
                    <div v-if="detail.color" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">颜色：</span>
                      <div v-for="(color, index) in detail.color.split(',')" :key="index"
                        class="w-8 h-8 rounded-full border-2 border-gray-300" :style="{ background: color }"></div>
                    </div>

                    <!-- 部位 -->
                    <div v-if="detail.clothes_part" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">部位：</span>
                      <QhxTag v-for="(part, index) in detail.clothes_part.split(',')" :key="index" :active="true">
                        {{ part }}
                      </QhxTag>
                    </div>

                    <!-- 标签 -->
                    <div v-if="detail.tags" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">标签：</span>
                      <QhxTag v-for="(tag, index) in detail.tags.split(',')" :key="index" :active="true">
                        {{ tag }}
                      </QhxTag>
                    </div>

                    <!-- 收纳 -->
                    <div v-if="detail.position" class="text-sm">
                      收纳：{{ detail.position }}
                    </div>

                    <!-- 季节 -->
                    <div v-if="detail.season" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm">季节：</span>
                      <QhxTag v-for="(season, index) in detail.season.split(',')" :key="index" :active="true">
                        {{ season }}
                      </QhxTag>
                    </div>

                    <!-- 购入时间 -->
                    <div v-if="detail.add_time" class="text-sm">
                      购入：{{ formatDate(detail.add_time) }}
                    </div>

                    <!-- 来源 -->
                    <div v-if="!detail.library && !detail.origin_shop && detail.origin" class="text-sm">
                      来源：{{ detail.origin }}
                    </div>

                    <!-- 图鉴信息 -->
                    <div v-if="detail.library" class="border-t pt-3 mt-3">
                      <div class="flex items-center gap-3 mb-3 cursor-pointer" @click="jumpToLibrary(detail.library!)">
                        <img :src="BASE_IMG + detail.library.cover" class="w-12 h-12 rounded-full object-cover"
                          :alt="detail.library.name" />
                        <div class="flex-1">
                          <div class="font-semibold">{{ detail.library.name }}</div>
                          <div v-if="detail.library.library_price" class="text-sm text-gray-600">
                            ￥{{ detail.library.library_price }}
                            <span v-if="detail.library.shop_country">
                              {{ formatLabel(detail.library.shop_country, config.config?.money_type || []) }}
                            </span>
                          </div>
                          <div v-if="detail.library.library_price && detail.library.shop_country"
                            class="text-xs text-orange-500">
                            <template v-if="exchangeRate(detail.library.shop_country, detail.library.library_price)">
                              汇率换算参考：{{ exchangeRate(detail.library.shop_country, detail.library.library_price) }}元
                            </template>
                          </div>
                        </div>
                      </div>
                      <div v-if="detail.library.library_type" class="text-sm mb-2">
                        类型：<QhxTag :active="true">{{ detail.library.library_type }}</QhxTag>
                      </div>
                      <div v-if="detail.library.state" class="text-sm mb-2">
                        状态：<QhxTag :active="true">{{ detail.library.state }}</QhxTag>
                      </div>
                      <div v-if="detail.library.pattern_elements"
                        class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        柄图：
                        <QhxTag v-for="(item, index) in detail.library.pattern_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.design_elements" class="text-sm mb-2 flex items-center gap-2 flex-wrap">
                        设计：
                        <QhxTag v-for="(item, index) in detail.library.design_elements.split(',')" :key="index"
                          :active="true">
                          {{ item }}
                        </QhxTag>
                      </div>
                      <div v-if="detail.library.date" class="text-xs text-gray-500">
                        {{ formatDate(detail.library.date) }}
                      </div>
                    </div>

                    <!-- 关联服饰 -->
                    <!-- <div v-if="isOwner && detail.include && detail.include.length < 10" class="mt-4">
                    <UButton icon="i-heroicons-plus" color="primary" @click="showAddClothesModal = true">
                      关联服饰
                    </UButton>
                  </div>
                  <div v-else-if="isOwner && detail.include && detail.include.length >= 10"
                    class="text-sm text-center text-gray-500 mt-4">
                    最多关联10条
                  </div> -->

                    <!-- 查看衣柜按钮 -->
                    <div v-if="route.query.needBack === '1'" class="text-center mt-4">
                      <UButton color="primary" @click="jumpToWardrobe">查看该衣柜</UButton>
                    </div>
                  </div>
                </div>

                <!-- 来源店铺 -->
                <div v-if="detail.origin_shop" class="border-t pt-4 mt-4">
                  <h3 class="text-lg font-semibold mb-3">来源店铺</h3>
                  <div class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    @click="jumpToShop(detail.origin_shop!.shop_id)">
                    <img :src="BASE_IMG + detail.origin_shop.shop_logo" class="w-12 h-12 rounded-full object-cover"
                      :alt="detail.origin_shop.shop_name" />
                    <div class="font-semibold">{{ detail.origin_shop.shop_name }}</div>
                  </div>
                </div>

                <!-- 详情图片列表 -->
                <div v-if="detail.detail_image_list && detail.detail_image_list.length > 0" class="mt-4 space-y-2">
                  <QhxPreviewImage v-for="(img, index) in detail.detail_image_list" :key="index"
                    :list="[{ src: img, alt: detail.clothes_note || '' }]" :preview="detail.detail_image_list"
                    className="w-full rounded-lg" />
                </div>
              </div>
            </template>
          </QhxTabPanel>

          <!-- 记忆标签页 -->
          <QhxTabPanel :index="1">
            <template #default="{ isActive }">
              <div v-if="isActive" class="p-4 max-md:p-2">
                <!-- <div v-if="isOwner" class="mb-4">
                <UButton icon="i-heroicons-plus" color="primary" @click="showAddMemoryModal = true">
                  添加记忆
                </UButton>
              </div> -->
                <div class="text-sm text-gray-500 text-center mb-4">
                  发帖记录你与小裙子之间的美好记忆
                </div>
                <CommunityForeignList :pk_type="2" :pk_id="Number.parseInt(id, 10)" />
              </div>
            </template>
          </QhxTabPanel>

          <!-- 搭配标签页 -->
          <!-- <QhxTabPanel :index="2">
          <template #default="{ isActive }">
            <div v-if="isActive" class="p-4 max-md:p-2">
              <div class="text-sm text-gray-500 mb-4">
                这里显示与该服饰相关的搭配记录
              </div>
            </div>
          </template>
        </QhxTabPanel> -->
        </QhxTabs>
      </div>

      <!-- 删除确认弹窗 -->
      <UModal v-model="showDeleteModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要删除吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeleteModal = false">取消</UButton>
            <UButton color="red" @click="confirmDelete">确定</UButton>
          </div>
        </div>
      </UModal>

      <!-- 删除关联确认弹窗 -->
      <UModal v-model="showDeleteLinkModal" title="操作确认">
        <div class="p-4">
          <p class="mb-4">确定要取消关联吗？</p>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showDeleteLinkModal = false">取消</UButton>
            <UButton color="red" @click="deleteLinkClothes">确定</UButton>
          </div>
        </div>
      </UModal>
    </div>
  </div>
</template>
