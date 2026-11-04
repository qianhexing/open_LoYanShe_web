<script setup lang="ts">
import type { Wiki } from '@/types/api';
import { toAbsoluteMediaUrl } from '@/utils/communityLiveMedia'
import { isHtml5PlusWebview, openInNativeShell } from '@/utils/nativeShell'
let uni: any;
interface Props {
  item: Wiki,
  className?: string,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  showManualSort?: boolean // 是否显示手动排序按钮（用于特殊类型）
}
const emit = defineEmits(['imageLoad', 'manualSort'])
const configStore = useConfigStore()
const config = computed(() => configStore.config)
const props = withDefaults(defineProps<Props>(), {
  size: 'big',
  needJump: true,
  showManualSort: false
})
// 响应式变量
const size = toRef(props, 'size')
// 转换为响应式
const { needJump } = toRefs(props)
const item = toRef(props, 'item')
const imageLoad = () => {
  emit('imageLoad')
}
onMounted(async () => {
  uni = await import('@dcloudio/uni-webview-js').catch((err) => {
    console.error('Failed to load uni-webview-js:', err);
  });
})
const handleJump = (id: number | string) => {
  if (!needJump.value) return
  if (!item.value.wiki_id) return
  if (isHtml5PlusWebview() && typeof uni !== 'undefined' && uni.navigateTo) {
    uni.navigateTo({
      url: `/pages/lolitaWiki/lolitaWiki?id=${id}`,
      fail: () => {
        console.log('跳转错误')
      }
    });
    return
  }
  openInNativeShell(`https://lolitalibrary.com/lolitaWiki/detail/${id}`, { uni: null })
}
</script>
<template>
  <div
    :class="props.className ? props.className : 'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" @click="handleJump(item.wiki_id)">
      <div class=" py-1 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-2 flex items-center justify-center">
            <img :src="toAbsoluteMediaUrl(item.cover || 'static/plan_cover/default.jpg')" :alt="item.wiki_name" class="w-[50px] h-[50px] object-cover rounded-[10px] border border-gray-200 my-2" loading="lazy" />
          </div>
          <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
            {{ item.wiki_name }}
          </h3>
          <QhxTag v-if="item.type_id" class="mt-2">排序序号: {{ item.sort }}</QhxTag>
          <div v-if="props.showManualSort" class="mt-2 flex justify-center">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-adjustments-horizontal"
              @click.stop="emit('manualSort', item)"
            >
              手动排序
            </UButton>
          </div>
          <div v-if="item.parent_list && item.parent_list.length > 0" class="w-full flex flex-wrap items-center">
            <div>上级</div>
            <div v-for="parent in item.parent_list" :key="parent.foreign_id" class="flex flex-wrap">
              <QhxTag class="mt-2" :active="true">{{ parent.wiki.wiki_name }}</QhxTag>
            </div>
          </div>
          <div v-if="item.child_list && item.child_list.length > 0" class="w-full flex flex-wrap">
            <div>下级</div>
            <div v-for="child in item.child_list" :key="child.foreign_id">
              <QhxTag class="mt-2" :active="true" >{{ child.wiki.wiki_name }}</QhxTag>
            </div>
          </div>
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

