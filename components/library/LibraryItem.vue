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
  // navigateTo(`/library/detail/${id}`)
  window.open(`/library/detail/${id}`, '_blank')
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
      <div class="mx-4">
        <h3 class="text-base font-semibold text-gray-900 truncate w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
      </div>
    </div>
    <div v-if="size === 'mini'" :to="`/library/detail/${item.library_id}`" @click="handleJump(item.library_id)">
      <img @load="imageLoad" :src="`${BASE_IMG}${item.cover}?x-oss-process=image/quality,q_100/resize,w_300`"
        :alt="item.name" class="w-[100px] h-[100px] rounded-[10px]" loading="lazy" />
      <div class="mx-4">
        <h3 class="text-base truncate w-full transition-colors duration-300">
          {{ item.name }}
        </h3>
      </div>
    </div>
    <div class="shop mx-2" v-if="item.shop && needShop">
      <ShopItem :item="item.shop" :need-jump="needJump"></ShopItem>
    </div>
  </div>
</template>

<style scoped></style>
