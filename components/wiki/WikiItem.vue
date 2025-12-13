<script setup lang="ts">
import type { Wiki } from '@/types/api';
let uni: any;
interface Props {
  item: Wiki,
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
const port = computed(() => configStore.getPort())
// 响应式变量
const size = toRef(props, 'size')
// 转换为响应式
const { needJump } = toRefs(props)
const item = props.item
const imageLoad = () => {
  emit('imageLoad')
}
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const handleJump = (id: number | string) => {
  if (!needJump.value) {
    return
  }
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (!item.wiki_id) return
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/lolitaWiki/lolitaWiki?id=${id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
    if (port.value) {
      // 鸿蒙系统
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'LolitaWiki',
        params: {
          id: item.wiki_id
        }
      }));
    } else {
      // 普通网页环境
      window.open(`/lolitaWiki/${id}`, '_blank')
    }
	}
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" @click="handleJump(item.wiki_id)">
      {{ needJump }}
      <div class="px-4 py-8 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-2">
            <img :src="`${BASE_IMG}${item.cover || 'static/plan_cover/default.jpg'}`" :alt="item.wiki_name" class="w-[100%] h-[100%] object-cover rounded-[10px] border border-gray-200 my-2" loading="lazy" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
            {{ item.wiki_name }}
          </h3>
          <QhxTag v-if="item.type_id" class="mt-2">排序序号: {{ item.sort }}</QhxTag>
        </div>
      </div>
    </div>
    <div v-else-if="size === 'mid'" class="flex" @click="handleJump(item.wiki_id)">
      <div class="w-[50%] flex items-center justify-center">
        <div class="text-3xl">📚</div>
      </div>
      <div class="mx-1 flex-1">
        <h3 class="text-base font-semibold text-gray-900 w-full transition-colors duration-300">
          {{ item.wiki_name }}
        </h3>
        <div class="flex flex-wrap mt-2">
          <QhxTag v-if="item.type_id">{{ item.type_id }}</QhxTag>
        </div>
      </div>
    </div>
    <div v-else-if="size === 'mini'" @click="handleJump(item.wiki_id)">
      <div class="text-center">
        <div class="text-2xl mb-1">📚</div>
        <h3 class="text-sm truncate w-full transition-colors duration-300">
          {{ item.wiki_name }}
        </h3>
        <QhxTag v-if="item.type_id" class="mt-1 text-xs">{{ item.type_id }}</QhxTag>
      </div>
    </div>
    <div v-else-if="size === 'mini-list'" @click="handleJump(item.wiki_id)">
      <div class="flex items-center">
        <div class="w-[60px] h-[60px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-[10px]">
          <div class="text-2xl">📚</div>
        </div>
        <div class="mx-1 flex-1 overflow-hidden">
          <h3 class="text-base truncate w-full transition-colors duration-300">
            {{ item.wiki_name }}
          </h3>
          <div class="flex flex-wrap mt-1">
            <QhxTag v-if="item.type_id" class="text-xs">{{ item.type_id }}</QhxTag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

