<script setup lang="ts">
import type { Library } from '@/types/api';
interface Props {
  item: Library,
  className?: string,
  needShop?: boolean,
  size?: string // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
}
const emit = defineEmits(['imageLoad'])

const props = withDefaults(defineProps<Props>(), {
  needShop: true,
  size: 'big',
  needJump: true
})
const { needShop, size, needJump } = props
const item = props.item
const imageLoad = () => {
  emit('imageLoad')
}
const handleJump = (id: number) => {
  if (!needJump) {
    return
  }
  navigateTo(`/library/detail/${id}`)
}
</script>
<template>
  <div :class="props.className ? props.className :'bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2 rounded'">
    <div v-if="size === 'big'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)">
      <div class="px-4">
        <img
          @load="imageLoad"
          :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
          :alt="item.name"
          class="w-full rounded-[10px] border border-gray-200 my-2"
          loading="lazy"
        />
      </div>
      <div class="mx-4">
        <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
      </div>
    </div>
    <div class="shop mx-2" v-if="item.shop && needShop">
      <ShopItem :item="item.shop" :need-jump="needJump"></ShopItem>
    </div>
  </div>
</template>

<style scoped>
/* 拍立得风格卡片样式 */
.polaroid-card {
  box-shadow: 0 6px 24px 0 rgba(0,0,0,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.08);
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #f3f3f3;
}
</style>


