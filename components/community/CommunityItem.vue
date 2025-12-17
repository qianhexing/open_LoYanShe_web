<script setup lang="ts">
import type { Community } from '@/types/api';
interface Props {
  item: Community,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
let uni: any
const configStore = useConfigStore()
const port = computed(() => configStore.getPort())
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const image = ref<Array<string>>([])
const text = ref('')
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true
})
const { size, needJump } = props
const item = props.item
if (item?.content) {
  const rich_res = formatRich(item.content)
  image.value = rich_res.image
  text.value = rich_res.text
}
if (item?.img_list) {
  image.value = [...image.value, ...item.img_list.split(',')]
}
const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  const isInUniApp =
		typeof window !== 'undefined' &&
		navigator.userAgent.includes('Html5Plus');
	if (isInUniApp && typeof uni !== 'undefined' && uni.navigateTo) {
		// UniApp WebView 环境
		uni.navigateTo({
			url: `/pages/community/detail/${id}`,
			fail: () => {
				console.log('跳转错误')
			}
		});
	} else {
    if (port.value) {
      port.value.postMessage(JSON.stringify({
        type: 'jump',
        path: 'CommunityDetail',
        params: {
          id: id
        }
      }));
    } else {
      window.open(`/community/detail/${id}`, '_blank')
    }
  }
  // navigateTo(`/compilations/detail/${id}`)
}
const emit = defineEmits(['load'])

const load = () => {
  emit('load')
}
</script>
<template>
  <div :class="props.className ? props.className :'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" class="py-3">
      <div class="mx-4">
        <UserInfo v-if="item.user" :user="item.user" :size="'mini'" class="pb-2"></UserInfo>
        <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300" @click="handleJump(item.community_id)">
          {{ item.title }}
        </h3>
        <div v-html="text.replace('60vh', '500px')" class="community-content m-1" @click="handleJump(item.community_id)"></div>
        <div class="flex flex-wrap w-full">
          <QhxPreviewImage @load="load" :list="image.map((img) => { return { src: img.replace('https://www.lolitalibrary.com/ali/', '') + '?x-oss-process=image/quality,q_100/resize,w_200,h_200', alt: item.title || 'Lo研社' }})"
            :preview="image.map((img) => { return img.replace('https://www.lolitalibrary.com/ali/', '') })"
            :className="'w-[calc(100%/3-8px)] shadow-lg m-1 object-cover aspect-[1/1] rounded-[10px]'">
          </QhxPreviewImage>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.community-content {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.img-mask {
  background: rgba(0, 0, 0, 0.3);
  width: calc(100% - 8px);
  left: 4px;
  top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
}
</style>