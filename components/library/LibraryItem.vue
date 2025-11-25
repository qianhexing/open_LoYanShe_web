<script setup lang="ts">
import type { Library } from '@/types/api';
let uni: any;
interface Props {
  item: Library,
  className?: string,
  needShop?: boolean,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const emit = defineEmits(['imageLoad'])
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const props = withDefaults(defineProps<Props>(), {
  needShop: true,
  size: 'big',
  needJump: true
})
// 响应式变量
const size = toRef(props, 'size')
const { needShop, needJump } = props
const item = props.item
const imageLoad = () => {
  emit('imageLoad')
}
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
	if (!item.library_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/library/libraryDetail/libraryDetail?id=${id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
		// 普通网页环境
		// window.location.href = `https://lolitalibrary.com/library/detail/${item.library_id}`;
    window.open(`/library/detail/${id}`, '_blank')
	}
  // navigateTo(`/library/detail/${id}`)
  
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)">
      <div class="px-4">
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
    <div class="shop mx-2" v-if="item.shop && needShop">
      <ShopItem :item="item.shop" :need-jump="needJump"></ShopItem>
    </div>
  </div>
</template>

<style scoped></style>
