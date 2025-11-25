<script setup lang="ts">
import type { Wardrobe } from '@/types/api';
let uni: any;
interface Props {
  item: Wardrobe,
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const emit = defineEmits(['imageLoad'])
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const props = withDefaults(defineProps<Props>(), {
  size: 'big',
  needJump: true
})
// 响应式变量
const size = toRef(props, 'size')
const { needJump } = props
const item = props.item
const imageLoad = () => {
  emit('imageLoad')
}
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const handleJump = (item: Wardrobe) => {
  if (!needJump) {
    return
  }
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (!item.wardrobe_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/wardrobe/wardrobe?user_id=${item.user_id}&wardrobe_id=${item.wardrobe_id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
		// 普通网页环境
    window.open(`/wardrobe/detail/${item.user_id}?wardrobe_id=${item.wardrobe_id}`, '_blank')
	}
  
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" @click="handleJump(item)">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
        :alt="item.wardrobe_name" class="w-full rounded-[10px] border border-gray-200 my-2" loading="lazy" />
      <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
        {{ item.wardrobe_name }}
      </h3>
    </div>
    <div v-else-if="size === 'list'" @click="handleJump(item)" class="flex items-center">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.wardrobe_cover || 'static/plan_cover/default.jpg'}`"
        :alt="item.wardrobe_name" class="w-[100px] h-[100px] rounded-[10px] object-cover" loading="lazy" />
      <div class="mx-1 flex-1">
        <h3 class="text-base truncate w-full transition-colors duration-300">
          {{ item.wardrobe_name }}
        </h3>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
