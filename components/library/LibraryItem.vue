<script setup lang="ts">
import type { Library } from '@/types/api';
import type LibraryTypeColorChoose from '@/components/library/LibraryTypeColorChoose.vue'
import type WardrobeAddLibrary from '@/components/Wardrobe/WardrobeAddLibrary.vue'
import { useToast } from '#imports'

let uni: any;
interface Props {
  item: Library,
  className?: string,
  needShop?: boolean,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  showActions?: boolean // 是否显示操作按钮（点赞、收藏、加衣柜）
}
const emit = defineEmits(['imageLoad', 'good-click', 'collect-click', 'wardrobe-click', 'wardrobe-change'])
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const toast = useToast()
const user = useUserStore()
const props = withDefaults(defineProps<Props>(), {
  needShop: true,
  size: 'big',
  needJump: true,
  showActions: false
})
const port = computed(() => configStore.getPort())
// 响应式变量
const size = toRef(props, 'size')
const { needShop, needJump, showActions } = props

const item = toRef(props, 'item')

// 加衣柜相关
const libraryTypeColorChooseRef = ref<InstanceType<typeof LibraryTypeColorChoose> | null>(null)
const wardrobeAddLibraryRef = ref<InstanceType<typeof WardrobeAddLibrary> | null>(null)
const wardrobeCount = ref(0)
const isInWardrobe = ref(false)

// 检查是否已加入衣柜
// const checkWardrobeStatus = async () => {
//   if (!item.library_id || !user.token) {
//     return
//   }
  
//   try {
//     const data = await getWardrobeListOptions({
//       library_id: item.library_id
//     })
//     isInWardrobe.value = data.some(item => item.is_wardrobe !== 0 && !!item.is_wardrobe)
//     wardrobeCount.value = data.filter(item => item.is_wardrobe !== 0 && !!item.is_wardrobe).length
//   } catch (error) {
//     console.error('检查衣柜状态失败:', error)
//   }
// }

// 监听衣柜添加成功事件
const handleWardrobeChange = () => {
  if (item.value.library_id) {
    wardrobeCount.value = (wardrobeCount.value || 0) + 1
    isInWardrobe.value = true
  }
  emit('wardrobe-change', { library_id: item.value.library_id })
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
  
  if (!item) {
    toast.add({
      title: '图鉴信息不存在',
      icon: 'i-heroicons-exclamation-circle',
      color: 'red'
    })
    return
  }
  
  // 通知父级处理
  emit('wardrobe-click', { library: item.value })
  
  // 也可以直接在这里处理
  // libraryTypeColorChooseRef.value?.showModel(item.value)
}

// 图鉴颜色选择完成 - 第二步：打开衣柜选择组件
const handleLibraryTypeColorChoose = (data: { library: Library; clothes_img: string }) => {
  wardrobeAddLibraryRef.value?.showModel(data)
}

// 点赞点击处理
const handleGoodClick = (data: { pk_id: number; pk_type: number; type: number }) => {
  emit('good-click', { ...data, library_id: item.value.library_id })
}

// 收藏点击处理
const handleCollectClick = (data: { pk_id: number; collect_type: number }, event?: MouseEvent) => {
  // 如果没有事件对象，创建一个默认的
  const clickEvent = event || new MouseEvent('click', { 
    bubbles: true, 
    cancelable: true,
    clientX: 0,
    clientY: 0
  })
  emit('collect-click', { ...data, library_id: item.value.library_id }, clickEvent)
}

const imageLoad = () => {
  emit('imageLoad')
}

// 初始化时检查状态
// watch(() => item.library_id, (newId) => {
//   if (newId && showActions) {
//     wardrobeCount.value = item.wardrobe_count || 0
//     checkWardrobeStatus()
//   }
// }, { immediate: true })

// onMounted(() => {
//   if (item.library_id && showActions) {
//     wardrobeCount.value = item.wardrobe_count || 0
//     checkWardrobeStatus()
//   }
// })
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (!item.value.library_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/library/libraryDetail/libraryDetail?id=${id}`,
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
          id: item.library_id
        }
      }));
    } else {
      // 普通网页环境
      // window.location.href = `https://lolitalibrary.com/library/detail/${item.library_id}`;
      window.open(`/library/detail/${id}`, '_blank')
    }
	}
  // navigateTo(`/library/detail/${id}`)
  
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-1 m-1 rounded'">
    <div v-if="size === 'big'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)">
      <div class="">
        <img @load="imageLoad" :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
          :alt="item.name" class="w-full rounded-[10px] border border-gray-200 my-2" loading="lazy" />
      </div>
      <div class="mx-1">
        <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
      </div>
    </div>
    <div v-else-if="size === 'mid'" :to="`/library/detail/${item.library_id}`" class=" flex" @click="handleJump(item.library_id)">
      <div class="w-[50%]">
        <img @load="imageLoad" :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
          :alt="item.name" class="w-[100%] object-cover rounded-[10px] border border-gray-200 my-2" loading="lazy" />
      </div>
      <div class="mx-1 flex-1">
        <h3 class="text-base font-semibold text-gray-900 w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
        <!-- 转换为vue3的写法 -->
        <div>
          <div class="flex flex-wrap">
            <QhxTag v-if="item.library_price" :active="true">参考价￥ {{ item.library_price }} {{ formatLabel(item.shop_country || item.shop?.shop_country || 0, config?.money_type) }}</QhxTag>
            <div v-if="item.library_pattern">
              <QhxTag>{{ item.library_pattern }}</QhxTag>
            </div>
            <div v-if="item.library_type">
              <QhxTag>{{ item.library_type }}</QhxTag>
            </div>
            <div v-if="item.state">
              <QhxTag>{{ item.state }}</QhxTag>
            </div>
          </div>
          <div v-if="item.pattern_elements">
            柄图:
            <QhxTag v-for="element in item.pattern_elements.split(',')" :key="element">{{ element }}</QhxTag>
          </div>
          <div v-if="item.design_elements">
            设计:
            <QhxTag>{{ item.design_elements }}</QhxTag>
          </div>
          <slot name="tagInfo"></slot>
        </div>
        <!-- if (this.item.library_pattern) {
            Flex({ justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
              if (this.item.library_pattern) {
                QhxTag({ text: '版型: ' + this.item.library_pattern })
                  .padding({
                    right: 5
                  })
              }
            }
            .padding({
              bottom: 10
            })
          }
          if (this.item.library_type) {
            Flex({ justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
              Text('类型:')
              QhxTag({ text: this.item.library_type })
                .padding({
                  left: 5
                })
            }
            .padding({
              bottom: 10
            })
          }
          if (this.item.state) {
            Flex({ justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
              Text('状态:')
              QhxTag({ text: this.item.state })
                .padding({
                  left: 5
                })
            }
            .padding({
              bottom: 10
            })
          }
          if (this.item.pattern_elements) {
            Flex({ justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center, wrap: FlexWrap.Wrap }) {
              Text('柄图:')
              ForEach(this.item.pattern_elements.split(','), (tag: string) => {
                QhxTag({ text: tag })
                  .padding({
                    left: 5,
                    bottom: 5
                  })
              })
            }
            .padding({
              bottom: 10
            })
          }
          if (this.item.design_elements) {
            Flex({ justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center, wrap: FlexWrap.Wrap }) {
              Text('设计:')
              ForEach(this.item.design_elements.split(','), (tag: string) => {
                QhxTag({ text: tag })
                  .padding({
                    left: 5,
                    bottom: 5
                  })
              })
            }
            .padding({
              bottom: 10
            })
          } -->


      </div>
    </div>
    <div v-else-if="size === 'mini'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
        :alt="item.name" class="w-[100px] h-[100px] rounded-[10px]" loading="lazy" />
      <div class="mx-1">
        <h3 class="text-base truncate w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
      </div>
    </div>
    <div v-else-if="size === 'mini-list'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)" >
      <div class="flex items-center">
        <img @load="imageLoad" :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
          :alt="item.name" class="w-[100px] h-[100px] rounded-[10px] object-cover" loading="lazy" />
        <div class="mx-1 flex-1 overflow-hidden">
          <h3 class="text-base truncate w-full transition-colors duration-300">
            {{ item.name }}
          </h3>
          <div class="flex flex-wrap">
            <QhxTag v-if="item.library_price" :active="true">参考价￥ {{ item.library_price }} {{ formatLabel(item.shop_country || item.shop?.shop_country || 0, config?.money_type) }}</QhxTag>
            <QhxTag v-if="item.library_pattern">{{ item.library_pattern }}</QhxTag>
            <QhxTag v-if="item.library_type">{{ item.library_type }}</QhxTag>
            <QhxTag v-if="item.pattern_elements">{{ item.pattern_elements }}</QhxTag>
            <QhxTag v-if="item.design_elements">{{ item.design_elements }}</QhxTag>
          </div>
          <slot name="tagInfo"></slot>
        </div>
      </div>
      <slot name="extra"></slot>
    </div>
    <!-- 操作按钮区域 -->
    <div v-if="showActions" class="flex justify-around items-center gap-4 mt-3 pt-1 border-gray-200 dark:border-gray-700">
      <UserGoodBtn 
        :pk_type="2" 
        :pk_id="item.library_id" 
        :good_count="item.good_count || 0" 
        :is_good="item.is_good === 1 ? true : false"
        :need_judge="false"
        :need_axios="false"
        @handle-click="handleGoodClick"
        class=""
      />
      <UserCollectBtn 
        :collect_count="item.collect_count || 0" 
        :pk_type="2" 
        :is_collect="item.is_collect === 1 ? true : false"
        :pk_id="item.library_id"
        :need_judge="false"
        :need_axios="false"
        @handle-click="handleCollectClick"
      />
      <div @click.stop="handleAddToWardrobe" class="cursor-pointer inline-block">
        <div class="flex items-center">
          <UIcon 
            name="hugeicons:wardrobe-04" 
            class="text-[26px]"
            :class="item.is_wardrobe === 1 ? 'text-[#409EFF]' : 'text-gray-500'" 
          />
          <div class="text-base ml-1">{{ wardrobeCount || item.wardrobe_count || 0 }}</div>
        </div>
      </div>
    </div>
    <div class="shop mx-2" v-if="item.shop && needShop">
      <ShopItem :item="item.shop" :need-jump="needJump"></ShopItem>
    </div>
    
    <!-- 加入衣柜相关组件 -->
    <!-- <LibraryTypeColorChoose ref="libraryTypeColorChooseRef" @choose="handleLibraryTypeColorChoose" />
    <WardrobeAddLibrary ref="wardrobeAddLibraryRef" @change="handleWardrobeChange" /> -->
  </div>
</template>

<style scoped></style>
